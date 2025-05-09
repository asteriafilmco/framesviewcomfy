import { IViewComfy } from "@/app/interfaces/comfy-input";
import type { ResponseError } from "@/app/models/errors";
import { useState, useCallback, useEffect } from "react"

const url = "/api/comfy"

export interface IUsePostPlayground {
    viewComfy: IViewComfy,
    workflow?: object,
    onSuccess: (outputs: Blob[]) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => void,
}

export const usePostPlayground = () => {
    const [loading, setLoading] = useState(false);
    const [customEndpoint, setCustomEndpoint] = useState<string | null>(null);
    
    // Load custom endpoint from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedEndpoint = localStorage.getItem('viewcomfy-endpoint');
            setCustomEndpoint(savedEndpoint);
        }
    }, []);

    const doPost = useCallback(async ({ viewComfy, workflow, onSuccess, onError }: IUsePostPlayground) => {
        setLoading(true);
        try {
            const formData = new FormData();
            const viewComfyJSON: IViewComfy = { 
                    inputs:[],
                    textOutputEnabled: viewComfy.textOutputEnabled ?? false
                };
            for (const { key, value } of viewComfy.inputs) {
                if (value instanceof File) {
                    formData.append(key, value);
                } else {
                    viewComfyJSON.inputs.push({ key, value });
                }
            }

            formData.append('workflow', JSON.stringify(workflow));
            formData.append('viewComfy', JSON.stringify(viewComfyJSON));
            
            // Create headers object and add endpoint if available
            const headers: Record<string, string> = {};
            if (customEndpoint) {
                headers['X-Custom-Comfy-Endpoint'] = customEndpoint;
            }
            
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
                headers
            });

            if (!response.ok) {
                const responseError: ResponseError = await response.json();
                throw responseError;
            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const reader = response.body.getReader();
            let buffer = new Uint8Array(0);
            const output: Blob[] = [];
            const separator = new TextEncoder().encode('--BLOB_SEPARATOR--');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer = concatUint8Arrays(buffer, value);

                let separatorIndex: number;
                // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
                while ((separatorIndex = findSubarray(buffer, separator)) !== -1) {
                    const outputPart = buffer.slice(0, separatorIndex);
                    buffer = buffer.slice(separatorIndex + separator.length);

                    const mimeEndIndex = findSubarray(outputPart, new TextEncoder().encode('\r\n\r\n'));
                    if (mimeEndIndex !== -1) {
                        const mimeType = new TextDecoder().decode(outputPart.slice(0, mimeEndIndex)).split(': ')[1];
                        const outputData = outputPart.slice(mimeEndIndex + 4);
                        const blob = new Blob([outputData], { type: mimeType });
                        output.push(blob);
                    }
                }
            }

            onSuccess(output);
        } catch (error) {
            onError(error);
        }
        setLoading(false);
    }, [customEndpoint]);

    return { doPost, loading };
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
}

function findSubarray(arr: Uint8Array, separator: Uint8Array): number {
    outer: for (let i = 0; i <= arr.length - separator.length; i++) {
        for (let j = 0; j < separator.length; j++) {
            if (arr[i + j] !== separator[j]) {
                continue outer;
            }
        }
        return i;
    }
    return -1;
}
