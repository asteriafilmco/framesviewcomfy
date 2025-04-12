import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Get the ComfyUI output directory from environment variable or use default
        const comfyOutputDir = process.env.COMFY_OUTPUT_DIR || path.join(process.cwd(), 'comfy', 'output');
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(comfyOutputDir)) {
            console.log('[TEST] Creating output directory:', comfyOutputDir);
            fs.mkdirSync(comfyOutputDir, { recursive: true });
        }
        
        // Create a test file if there are no files
        const files = fs.readdirSync(comfyOutputDir);
        console.log('[TEST] Files in directory:', files);
        
        if (files.length === 0 || !files.includes('test-file.html')) {
            // Create a simple HTML file
            const testHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test File</title>
            </head>
            <body>
                <h1>Test File</h1>
                <p>This is a test file created at ${new Date().toISOString()}</p>
            </body>
            </html>
            `;
            
            const testFilePath = path.join(comfyOutputDir, 'test-file.html');
            console.log('[TEST] Creating test file at:', testFilePath);
            fs.writeFileSync(testFilePath, testHtml);
        }
        
        // Check if the test file exists and is accessible
        const testFilePath = path.join(comfyOutputDir, 'test-file.html');
        const testFileExists = fs.existsSync(testFilePath);
        console.log('[TEST] Test file exists?', testFileExists);
        
        // Get absolute and relative paths for debugging
        const absolutePath = path.resolve(testFilePath);
        const relativePath = path.relative(process.cwd(), testFilePath);
        
        return NextResponse.json({
            success: true,
            outputDir: comfyOutputDir,
            outputDirExists: fs.existsSync(comfyOutputDir),
            files: fs.readdirSync(comfyOutputDir),
            testFilePath: testFilePath,
            testFileExists: testFileExists,
            absolutePath: absolutePath,
            relativePath: relativePath,
            cwd: process.cwd(),
            accessUrl: `/comfy/output/test-file.html`
        });
    } catch (error) {
        console.error('[ERROR] Test output error:', error);
        return NextResponse.json({ 
            error: 'Test failed', 
            message: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
} 