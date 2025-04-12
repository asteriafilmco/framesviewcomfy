import { NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises'; // Import promises version
import path from 'path';

// Minimal interface for the chunk structure we need
interface PngTextChunk {
    name: string;
    keyword?: string;
    text?: string;
    // Add other properties if needed based on library output
}

// Function to manually find a tEXt chunk in a PNG buffer
const findPngTextChunk = (buffer: Buffer, keyword: string): string | undefined => {
    try {
        // Check for PNG signature
        if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
            // console.warn('Not a valid PNG file or buffer too short.');
            return undefined;
        }

        let offset = 8; // Start after PNG signature
        while (offset < buffer.length) {
            const length = buffer.readUInt32BE(offset);
            const typeOffset = offset + 4;
            const type = buffer.toString('ascii', typeOffset, typeOffset + 4);
            const dataOffset = typeOffset + 4;
            const crcOffset = dataOffset + length;

            if (type === 'tEXt') {
                // Find the null separator between keyword and text
                const nullSeparatorIndex = buffer.indexOf(0, dataOffset, 'ascii');
                if (nullSeparatorIndex !== -1 && nullSeparatorIndex < crcOffset) {
                    const currentKeyword = buffer.toString('ascii', dataOffset, nullSeparatorIndex);
                    if (currentKeyword === keyword) {
                        const text = buffer.toString('utf8', nullSeparatorIndex + 1, crcOffset);
                        return text;
                    }
                }
            }

            // Move to the next chunk (Length + Type + Data + CRC = 4 + 4 + length + 4 bytes)
            offset = crcOffset + 4;

            // Basic safety check
            if (offset > buffer.length) {
                 console.warn('[WARN] PNG parsing went beyond buffer length.');
                 break;
            }
        }
    } catch (e) {
        console.error('[ERROR] Error manually parsing PNG chunks:', e);
    }
    return undefined;
};

export async function GET() {
    try {
        // Get the ComfyUI output directory from environment variable or use default
        const comfyOutputDir = process.env.COMFY_OUTPUT_DIR || path.join(process.cwd(), 'comfy', 'output');
        
        console.log('[DEBUG] ComfyUI output directory:', comfyOutputDir);
        console.log('[DEBUG] Directory exists?', fs.existsSync(comfyOutputDir));
        
        // Check if directory exists
        if (!fs.existsSync(comfyOutputDir)) {
            console.log('[ERROR] Output directory not found:', comfyOutputDir);
            return NextResponse.json({ error: 'Output directory not found' }, { status: 404 });
        }

        // Read all files in the directory
        const files = fs.readdirSync(comfyOutputDir);
        // console.log('[DEBUG] Files found in directory:', files);
        
        // Filter for image files and get their stats and prompt
        const outputs = await Promise.all( // Use Promise.all for async operations inside map
            files
            .filter(file => /\.png$/i.test(file)) // Filter specifically for PNG files now
            .map(async (file) => { // Make the map callback async
                const filePath = path.join(comfyOutputDir, file);
                let stats: fs.Stats;
                let fileBuffer: Buffer | undefined;
                let prompt: string | undefined = undefined;

                try {
                    // Read file stats and content
                    stats = await fsp.stat(filePath); // Use async stat
                    fileBuffer = await fsp.readFile(filePath);

                    // --- Extract prompt using manual parser ---
                    const promptJsonString = findPngTextChunk(fileBuffer, 'prompt');
                    if (promptJsonString) {
                        try {
                            const promptData = JSON.parse(promptJsonString);
                            let extractedText: string | undefined = undefined;
                            for (const nodeId in promptData) {
                                const node = promptData[nodeId];
                                if (node?.class_type?.includes('CLIPTextEncode') && node?.inputs?.text) {
                                    extractedText = node.inputs.text;
                                    break;
                                }
                            }
                            prompt = extractedText;
                            if (!prompt) {
                                 console.warn(`[WARN] Found prompt JSON in ${file}, but couldn't extract text from expected location.`);
                            }
                        } catch (parseError) {
                            console.warn(`[WARN] Failed to parse embedded prompt JSON in ${file}:`, parseError);
                             if (typeof promptJsonString === 'string' && promptJsonString.length < 500) {
                                 prompt = promptJsonString;
                             }
                        }
                    } else {
                         console.log(`[DEBUG] No 'prompt' text chunk found in ${file}`);
                    }
                     if (!prompt) {
                         const workflowJsonString = findPngTextChunk(fileBuffer, 'workflow');
                         if (workflowJsonString) {
                             console.log(`[DEBUG] Found 'workflow' chunk in ${file}, implement parsing if needed.`);
                         }
                     }
                    // --- End extract prompt ---

                } catch (readError: any) {
                    console.error(`[ERROR] Failed to read or process file ${filePath}:`, readError);
                    // If we can't read the file, we can't return info for it
                    return null; // Mark for filtering out later
                }

                // Ensure stats is defined before accessing birthtime/size
                if (!stats) return null;

                return {
                    name: file,
                    path: `/comfy/output/${encodeURIComponent(file)}`, // Keep original path for client
                    created: stats.birthtime,
                    size: stats.size,
                    prompt: prompt // Add the prompt here
                };
            })
        );
        
         // Filter out null results (from read errors) and sort
        const validOutputs = outputs.filter(output => output !== null) as Array<Exclude<typeof outputs[number], null>>;
        validOutputs.sort((a, b) => b.created.getTime() - a.created.getTime());
        
        // console.log('[DEBUG] Found', validOutputs.length, 'PNG files with prompts (if available)');
        // console.log('[DEBUG] First few outputs:', validOutputs.slice(0, 3));

        return NextResponse.json({ outputs: validOutputs });
    } catch (error) {
        console.error('[ERROR] Error reading outputs:', error);
        return NextResponse.json({ error: 'Failed to read outputs' }, { status: 500 });
    }
} 