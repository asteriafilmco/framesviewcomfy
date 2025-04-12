import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface FileResult {
    exists: boolean;
    size: number;
    fullPath: string;
    apiPath: string;
    rewritePath: string;
}

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

        // Check for test files
        const testFiles = ['test.png', 'Blue.png'];
        const fileResults: Record<string, FileResult> = {};
        
        for (const file of testFiles) {
            const filePath = path.join(comfyOutputDir, file);
            fileResults[file] = {
                exists: fs.existsSync(filePath),
                size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
                fullPath: filePath,
                apiPath: `/api/comfy/static/${encodeURIComponent(file)}`,
                rewritePath: `/comfy/output/${encodeURIComponent(file)}`
            };
        }
        
        // Test the static API route directly
        const staticApiResponse = await fetch(`http://localhost:3000/api/comfy/static/test.png`).catch(err => {
            return { ok: false, status: 'error', message: err.message };
        });
        
        return NextResponse.json({
            status: 'success',
            outputDir: comfyOutputDir,
            outputDirExists: fs.existsSync(comfyOutputDir),
            fileCount: fs.readdirSync(comfyOutputDir).length,
            allFiles: fs.readdirSync(comfyOutputDir),
            testFiles: fileResults,
            staticApiTest: {
                ok: staticApiResponse.ok,
                status: staticApiResponse.status,
                rewriteTest: 'Visit /comfy/output/test.png to test rewrite rule'
            },
            config: {
                cwd: process.cwd(),
                nextPublicAssetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || 'not set',
                nextConfig: 'Check next.config.mjs for rewrites'
            }
        });
    } catch (error) {
        console.error('[ERROR] Error in debug-static API:', error);
        return NextResponse.json({ 
            error: 'Test failed', 
            message: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
} 