import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        // Get the ComfyUI output directory from environment variable or use default
        const comfyOutputDir = process.env.COMFY_OUTPUT_DIR || path.join(process.cwd(), 'comfy', 'output');
        
        // Check if directory exists
        if (!fs.existsSync(comfyOutputDir)) {
            return NextResponse.json({ 
                error: 'Output directory not found',
                path: comfyOutputDir
            }, { status: 404 });
        }

        // Check if test.png exists
        const testPngPath = path.join(comfyOutputDir, 'test.png');
        const testPngExists = fs.existsSync(testPngPath);
        
        // Get list of files in output directory
        const files = fs.readdirSync(comfyOutputDir);
        
        return NextResponse.json({
            status: 'success',
            outputDir: comfyOutputDir,
            testPngExists,
            testPngPath,
            testPngRelativePath: '/comfy/output/test.png',
            fileCount: files.length,
            files: files.map(file => ({
                name: file,
                path: `/comfy/output/${encodeURIComponent(file)}`,
                size: fs.statSync(path.join(comfyOutputDir, file)).size
            }))
        });
    } catch (error) {
        console.error('[ERROR] Error in test-fs API:', error);
        return NextResponse.json({ 
            error: 'Test failed', 
            message: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
} 