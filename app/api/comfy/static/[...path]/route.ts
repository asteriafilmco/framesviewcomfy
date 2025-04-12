import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
    try {
        // Log the request for debugging
        console.log('[DEBUG] Static file request for path:', params.path);
        
        // Get the ComfyUI output directory from environment variable or use default
        const comfyOutputDir = process.env.COMFY_OUTPUT_DIR || path.join(process.cwd(), 'comfy', 'output');
        console.log('[DEBUG] ComfyUI output directory:', comfyOutputDir);
        
        // Handle case of single filename without any path segments
        let filePath: string;
        if (params.path.length === 1) {
            // If just a single filename, use it directly
            filePath = path.join(comfyOutputDir, params.path[0]);
        } else {
            // Otherwise join all path segments
            filePath = path.join(comfyOutputDir, ...params.path);
        }
        
        console.log('[DEBUG] Resolved file path:', filePath);
        
        // Sanity check for directory traversal
        const normalizedFilePath = path.normalize(filePath);
        const normalizedOutputDir = path.normalize(comfyOutputDir);
        
        console.log('[DEBUG] Normalized file path:', normalizedFilePath);
        console.log('[DEBUG] Normalized output dir:', normalizedOutputDir);
        console.log('[DEBUG] File exists?', fs.existsSync(normalizedFilePath));
        
        const isWithinOutputDir = normalizedFilePath.startsWith(normalizedOutputDir);
        console.log('[DEBUG] Path starts with output dir?', isWithinOutputDir);
        
        // Check if file exists and is within the output directory
        if (!fs.existsSync(normalizedFilePath)) {
            console.log('[ERROR] File not found:', normalizedFilePath);
            return new NextResponse('File not found', { status: 404 });
        }
        
        if (!isWithinOutputDir) {
            console.log('[ERROR] Path traversal attempt:', normalizedFilePath);
            return new NextResponse('Access denied', { status: 403 });
        }

        // Read the file
        const fileStats = fs.statSync(normalizedFilePath);
        console.log('[DEBUG] File size:', fileStats.size, 'bytes');
        
        if (!fileStats.isFile()) {
            console.log('[ERROR] Not a file:', normalizedFilePath);
            return new NextResponse('Not a file', { status: 400 });
        }
        
        const fileBuffer = fs.readFileSync(normalizedFilePath);
        
        // Determine content type
        const contentType = mime.lookup(normalizedFilePath) || 'application/octet-stream';
        console.log('[DEBUG] Content type:', contentType);

        // Return the file with appropriate headers
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(fileBuffer.length),
                'Cache-Control': 'public, max-age=31536000',
                // Add debug header to help troubleshoot
                'X-Debug-Path': params.path.join('/'),
                'X-Debug-Filepath': normalizedFilePath.replace(process.cwd(), '[CWD]')
            },
        });
    } catch (error) {
        console.error('[ERROR] Error serving static file:', error);
        return new NextResponse('Internal Server Error: ' + (error instanceof Error ? error.message : String(error)), { status: 500 });
    }
} 