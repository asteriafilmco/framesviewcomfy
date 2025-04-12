import { ComfyWorkflowError } from '@/app/models/errors';
import { ComfyUIConnRefusedError } from '@/app/constants';

type ComfyUIWSEventType = "status" | "executing" | "execution_cached" | "progress" | "executed" | "execution_error" | "execution_success";

interface IComfyUIWSEventData {
    type: ComfyUIWSEventType;
    data: { [key: string]: unknown };
}

export interface IComfyUINodeError {
    type: string;
    message: string;
}

export interface IComfyUIError {
    message: string;
    node_errors: { [key: number]: IComfyUINodeError[] }
}

export class ComfyImageOutputFile {
    public fileName: string;
    public subFolder: string;
    public outputType: string;

    constructor({ fileName, subFolder, outputType }: { fileName: string, subFolder: string, outputType: string }) {
        this.fileName = fileName;
        this.subFolder = subFolder;
        this.outputType = outputType;
    }
}

export class ComfyUIAPIService {
    private baseUrl: string;
    private ws: WebSocket;
    private clientId: string;
    private promptId: string | undefined = undefined;
    private isPromptRunning: boolean;
    private workflowStatus: ComfyUIWSEventType | undefined;
    private secure: boolean;
    private httpBaseUrl: string;
    private wsBaseUrl: string;
    private outputFiles: Array<{ [key: string]: string }>;

    constructor(clientId: string, customEndpoint?: string) {
        this.secure = process.env.COMFYUI_SECURE === "true";
        this.httpBaseUrl = this.secure ? "https://" : "http://";
        this.wsBaseUrl = this.secure ? "wss://" : "ws://";
        this.baseUrl = customEndpoint || process.env.COMFYUI_API_URL || "127.0.0.1:8188";
        this.clientId = clientId;
        try {
            this.ws = new WebSocket(`${this.getUrl("ws")}/ws?clientId=${this.clientId}`);
            this.connect();
        } catch (error) {
            console.error(error);
            throw error;
        }
        this.isPromptRunning = false;
        this.workflowStatus = undefined;
        this.outputFiles = [];
    }

    private getUrl(protocol: "http" | "ws") {
        if (protocol === "http") {
            return `${this.httpBaseUrl}${this.baseUrl}`;
        }
        return `${this.wsBaseUrl}${this.baseUrl}`;
    }

    private async connect() {
        try {
            this.ws.onopen = () => {
                console.log("WebSocket connection opened");
            };

            this.ws.onmessage = (event) => {
                // console.log("WebSocket message received:", event.data);
                this.comfyEventDataHandler(event.data);
            };
        } catch (error) {
            console.error(error);
            throw new Error("WebSocket connection error");
        }
    }

    private comfyEventDataHandler(eventData: string) {
        let event: IComfyUIWSEventData | undefined;
        try {
            event = JSON.parse(eventData) as IComfyUIWSEventData;
        } catch (error) {
            // console.log("Error parsing event data:", eventData);
            // console.error(error);
            return;
        }

        const data = event.data as { [key: string]: unknown };
        const currentPromptId = ("prompt_id" in data) ? data.prompt_id as string : this.promptId;

        if (this.promptId && currentPromptId !== this.promptId) {
             console.log(`[WS] Skipping event for prompt ${currentPromptId} (tracking ${this.promptId})`);
             return true;
        }

        switch (event.type) {
            case "status":
                // console.log("Status:", event.data);
                this.workflowStatus = event.type;
                break;
            case "executing":
                // console.log("Executing:", event.data);
                this.workflowStatus = event.type;
                break;
            case "execution_cached":
                // console.log("Execution cached:", event.data);
                this.workflowStatus = event.type;
                break;
            case "progress":
                // console.log("Progress:", event.data);
                this.workflowStatus = event.type;
                break;
            case "executed":
                console.log("Executed:", event.data);
                const executedPromptId = data.prompt_id as string;
                 if (executedPromptId) {
                    this.parseOutputFiles(data);
                 } else {
                     console.error("[ERROR] Received 'executed' event without a prompt_id:", data);
                 }
                this.workflowStatus = event.type;
                break;
            case "execution_error":
                // console.log("Execution error:", event.data);
                this.isPromptRunning = false;
                this.workflowStatus = event.type;
                break;
            case "execution_success":
                // console.log("Execution success:", event.data);
                this.isPromptRunning = false;
                this.workflowStatus = event.type;
                break;
            default:
                // console.log("Unknown event type:", event.type);
                this.workflowStatus = event.type;
                break;
        }
    }

    public async queuePrompt(workflow: object) {
        const data = {
            "prompt": workflow,
            "client_id": this.clientId,
        }
        let queuedPromptId: string | undefined = undefined;
        try {
            const response = await fetch(`${this.getUrl("http")}/prompt`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {

                let resError: IComfyUIError | string;
                try {
                    const responseError = await response.json();
                    if (responseError.error?.message) {
                        resError = {
                            message: responseError.error.message,
                            node_errors: responseError.node_errors || [],
                        }
                    } else {
                        resError = responseError;
                    }
                } catch (error) {
                    resError = await response.text();
                }
                console.error(resError);
                throw resError;

            }

            if (!response.body) {
                throw new Error("No response body");
            }

            const responseData = await response.json();
            queuedPromptId = responseData.prompt_id;
            this.promptId = queuedPromptId;

            if (queuedPromptId === undefined) {
                throw new Error("Prompt ID is undefined");
            }

            this.isPromptRunning = true;
            this.workflowStatus = undefined;
            this.outputFiles = [];

            while (this.isPromptRunning) {
                if (this.ws.readyState !== WebSocket.OPEN) {
                     console.error("[ERROR] WebSocket closed during prompt execution.");
                     throw new ComfyWorkflowError({ message: "WebSocket closed during execution", errors: [] });
                }
                 await new Promise(resolve => setTimeout(resolve, 100));
            }
            console.log(`[API] Prompt execution finished for ${queuedPromptId}. Final status: ${this.workflowStatus}`);

            if (this.workflowStatus === "execution_error") {
                throw new ComfyWorkflowError({
                    message: "ComfyUI workflow execution error",
                    errors: []
                });
            }
            
            const currentOutputFiles = [...this.outputFiles];
            this.outputFiles = [];
            return { outputFiles: currentOutputFiles, promptId: queuedPromptId };

        } catch (error: any) {
            console.error(`[API] Error during queuePrompt for promptId ${queuedPromptId}:`, error);
            if (queuedPromptId) {
                // this.promptStore.delete(queuedPromptId);
                 console.log(`[API] Cleaned up stored workflow due to error for promptId: ${queuedPromptId}`);
            }
            this.isPromptRunning = false;
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [ComfyUIConnRefusedError(this.getUrl("http"))]
                });
            }
            throw error;
        } finally {
             this.promptId = undefined;
             this.isPromptRunning = false;
        }
    }

    public async getOutputFiles({ file }: { file: { [key: string]: string } }) {

        const data = new URLSearchParams({ ...file }).toString();

        try {
            const response = await fetch(`${this.getUrl("http")}/view?${encodeURI(data)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    const fileName = file.filename || "";
                    throw new ComfyWorkflowError({
                        message: "File not found",
                        errors: [`The file ${fileName} was not found in the ComfyUI output directory`]
                    });
                }
                const responseError = await response.json();
                throw responseError;
            }

            return await response.blob();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error(error);
            if (error?.cause?.code === "ECONNREFUSED") {
                throw new ComfyWorkflowError({
                    message: "Cannot connect to ComfyUI",
                    errors: [ComfyUIConnRefusedError(this.getUrl("http"))]
                });
            }
            throw error;
        }
    }

    private parseOutputFiles(data: { [key: string]: any }) {
        // console.log(`[API] Parsing output files from executed event data`);
        if (!data.output) {
             console.log(`[API] No 'output' key found in executed data.`);
            return;
        }

        let currentExecutionFiles: Array<{ [key: string]: string }> = [];

        if (data.output.images && Array.isArray(data.output.images)) {
            currentExecutionFiles = data.output.images;
             // console.log(`[API] Found ${currentExecutionFiles.length} images in data.output.images`);
        } else if (typeof data.output === 'object') {
             for (const nodeId in data.output) {
                 const nodeOutput = data.output[nodeId];
                 if (nodeOutput?.images && Array.isArray(nodeOutput.images)) {
                     // console.log(`[API] Found ${nodeOutput.images.length} images in node ${nodeId} output`);
                     currentExecutionFiles.push(...nodeOutput.images);
                 }
             }
        } else {
             console.warn(`[WARN] Unexpected output structure in 'executed' event:`, data.output);
             return;
        }

         this.outputFiles = currentExecutionFiles.map(fileInfo => ({
             filename: fileInfo.filename,
             subfolder: fileInfo.subfolder || '',
             type: fileInfo.type || 'output'
         }));
    }
}
