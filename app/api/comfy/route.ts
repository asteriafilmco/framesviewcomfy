import { ComfyUIService } from '@/app/services/comfyui-service';
import { type NextRequest, NextResponse } from 'next/server';
import { ErrorResponseFactory } from '@/app/models/errors';
import { v4 as uuidv4 } from 'uuid';
import { IViewComfy } from '@/app/interfaces/comfy-input';
import { firebaseAdmin } from '@/lib/firebase';

const errorResponseFactory = new ErrorResponseFactory();
const db = firebaseAdmin.firestore();

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    let workflow = undefined;
    if (formData.get('workflow') && formData.get('workflow') !== 'undefined') {
        workflow = JSON.parse(formData.get('workflow') as string);
    }

    let viewComfy: IViewComfy = {inputs: [], textOutputEnabled: false};
    if (formData.get('viewComfy') && formData.get('viewComfy') !== 'undefined') {
        viewComfy = JSON.parse(formData.get('viewComfy') as string);
    }

    for (const [key, value] of Array.from(formData.entries())) {
        if (key !== 'workflow') {
            if (value instanceof File) {
                viewComfy.inputs.push({ key, value });
            }
        }
    }

    if (!viewComfy) {
        return new NextResponse("viewComfy is required", { status: 400 });
    }

    try {
        // Check for custom endpoint in headers
        const customEndpoint = request.headers.get('X-Custom-Comfy-Endpoint');
        
        // Pass custom endpoint to ComfyUIService if present
        const comfyUIService = new ComfyUIService(customEndpoint || undefined);
        const stream = await comfyUIService.runWorkflow({ workflow, viewComfy });
        
        const saveGenerationToFirestore = async (workflowId: string, viewComfy: IViewComfy, filename: string, timestamp: number) => {
            try {
                await db.collection('generations').add({
                    workflowId,
                    viewComfy,
                    filename,
                    timestamp,
                });
            } catch (error) {
                console.error('Error saving generation to Firestore:', error);
            }
        };

        await saveGenerationToFirestore(
            uuidv4(),
            viewComfy,
            "generated_images.bin",
            Date.now());

        return new NextResponse<ReadableStream<Uint8Array>>(stream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="generated_images.bin"'
            }
        });
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    } catch (error: unknown) {
        const responseError = errorResponseFactory.getErrorResponse(error);

        return NextResponse.json(responseError, {
            status: 500,
        });
    }
}
