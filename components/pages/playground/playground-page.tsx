/* eslint-disable @next/next/no-img-element */
import {
    Settings,
    X,
    BookmarkIcon,
    WandSparkles
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Fragment, useEffect, useState } from "react";
import { Header } from "@/components/header";
import PlaygroundForm from "./playground-form";
import { Loader } from "@/components/loader";
import { usePostPlayground } from "@/hooks/playground/use-post-playground";
import { ActionType, type IViewComfy, type IViewComfyWorkflow, useViewComfy } from "@/app/providers/view-comfy-provider";
import { ErrorAlertDialog } from "@/components/ui/error-alert-dialog";
import { ApiErrorHandler } from "@/lib/api-error-handler";
import type { ResponseError } from "@/app/models/errors";
import BlurFade from "@/components/ui/blur-fade";
import TextFade from "@/components/ui/text-fade";
import { cn } from "@/lib/utils";
import WorkflowSwitcher from "@/components/workflow-switchter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PreviewOutputsImageGallery } from "@/components/images-preview"
import { useMediaQuery } from '@/hooks/use-media-query';
import { MobileMasonryGallery } from "@/components/mobile-masonry-gallery";
import { MobileGenerationForm } from "@/components/mobile-generation-form";
import { MobileHistoryGallery } from "@/components/mobile-history-gallery";
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

const apiErrorHandler = new ApiErrorHandler();

function PlaygroundPageContent() {
    const [results, SetResults] = useState<{ [key: string]: { outputs: Blob, url: string, prompt: string }[] }>({});
    const { viewComfyState, viewComfyStateDispatcher } = useViewComfy();
    const isMobile = useMediaQuery("(max-width: 431px)");
    const viewMode = process.env.NEXT_PUBLIC_VIEW_MODE === "true";
    const [errorAlertDialog, setErrorAlertDialog] = useState<{ open: boolean, errorTitle: string | undefined, errorDescription: React.JSX.Element, onClose: () => void }>({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
    const [mobileFormOpen, setMobileFormOpen] = useState(false);
    const [currentMobileView, setCurrentMobileView] = useState<'generate' | 'history'>('generate');
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'complete'>('idle');
    const [latestResult, setLatestResult] = useState<{ outputs: Blob, url: string, prompt: string }[] | null>(null);
    const [historyResult, setHistoryResult] = useState<{ outputs: Blob, url: string, prompt: string }[] | null>(null);
    const [isVariationInProgress, setIsVariationInProgress] = useState(false);
    const [latestWasVariationFromHistory, setLatestWasVariationFromHistory] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (viewMode) {
            const fetchViewComfy = async () => {
                try {
                    const response = await fetch("/api/playground");

                    if (!response.ok) {
                        const responseError: ResponseError =
                            await response.json();
                        throw responseError;
                    }
                    const data = await response.json();
                    viewComfyStateDispatcher({ type: ActionType.INIT_VIEW_COMFY, payload: data.viewComfyJSON });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    if (error.errorType) {
                        const responseError =
                            apiErrorHandler.apiErrorToDialog(error);
                        setErrorAlertDialog({
                            open: true,
                            errorTitle: responseError.title,
                            errorDescription: <>{responseError.description}</>,
                            onClose: () => { },
                        });
                    } else {
                        setErrorAlertDialog({
                            open: true,
                            errorTitle: "Error",
                            errorDescription: <>{error.message}</>,
                            onClose: () => { },
                        });
                    }
                }
            };
            fetchViewComfy();
        }
    }, [viewMode, viewComfyStateDispatcher]);

    const { doPost, loading } = usePostPlayground();

    function onSubmit(data: IViewComfyWorkflow, options?: { isVariation?: boolean }) {
        const inputs: { key: string, value: string }[] = [];

        for (const dataInputs of data.inputs) {
            for (const input of dataInputs.inputs) {
                inputs.push({ key: input.key, value: input.value });
            }
        }

        for (const advancedInput of data.advancedInputs) {
            for (const input of advancedInput.inputs) {
                inputs.push({ key: input.key, value: input.value });
            }
        }

        const generationData = {
            inputs: inputs,
            textOutputEnabled: data.textOutputEnabled ?? false
        };

        // Set variation flags when variation is in progress
        setIsVariationInProgress(options?.isVariation || false);
        
        // Track if this was generated from the form view (not a variation from history)
        if (!options?.isVariation && currentMobileView === 'generate') {
            setLatestWasVariationFromHistory(false);
        }
        
        // Set generation state to show loading animation
        setGenerationState('generating');
        
        doPost({
            viewComfy: generationData,
            workflow: viewComfyState.currentViewComfy?.workflowApiJSON,
            onSuccess: (data) => {
                onSetResults(data);
            }, onError: (error) => {
                // Reset generation state on error
                setGenerationState('idle');
                setIsVariationInProgress(false);
                
                const errorDialog = apiErrorHandler.apiErrorToDialog(error);
                setErrorAlertDialog({
                    open: true,
                    errorTitle: errorDialog.title,
                    errorDescription: <> {errorDialog.description} </>,
                    onClose: () => {
                        setErrorAlertDialog({ open: false, errorTitle: undefined, errorDescription: <></>, onClose: () => { } });
                    }
                });
            }
        });
    }

    // Helper to convert Blob to base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Function to save to local history
    const saveToLocalHistory = async (timestamp: number, blobs: Blob[]) => {
        try {
            // Convert blobs to base64 strings for storage
            const storedOutputs = await Promise.all(blobs.map(async (blob) => {
                return {
                    type: blob.type,
                    data: await blobToBase64(blob),
                    timestamp,
                    timeFormatted: new Date(timestamp).toISOString()
                };
            }));
            
            // Get existing history
            const historyString = localStorage.getItem('comfyHistory') || '[]';
            const history = JSON.parse(historyString);
            
            // Add new outputs and save (limit to recent 50 items)
            const updatedHistory = [...storedOutputs, ...history].slice(0, 50);
            localStorage.setItem('comfyHistory', JSON.stringify(updatedHistory));
            
            console.log(`[History] Saved ${storedOutputs.length} items to localStorage`);
        } catch (err) {
            console.error('Error saving to history:', err);
        }
    };

    const onSetResults = (data: Blob[]) => {
        const timestamp = Date.now();
        // Extract current prompt from workflow if available
        let currentPrompt = "Generated image";
        if (viewComfyState.currentViewComfy?.viewComfyJSON?.inputs) {
            // Find the prompt input in the workflow
            const promptInput = viewComfyState.currentViewComfy.viewComfyJSON.inputs
                .flatMap(group => group.inputs)
                .find(input => input.key.toLowerCase().includes('prompt'));
            
            if (promptInput) {
                currentPrompt = promptInput.value;
            }
        }
        
        const newGeneration = data.map((output) => ({ 
            outputs: output, 
            url: URL.createObjectURL(output),
            prompt: currentPrompt 
        }));
        
        // Always update the results state for global history
        SetResults((prevResults) => ({
            [timestamp]: newGeneration,
            ...prevResults
        }));
        
        // Update the appropriate result state based on source
        if (isVariationInProgress) {
            // For variations, only update the history result
            // Clean up previous history result first
            if (historyResult) {
                for (const output of historyResult) {
                    URL.revokeObjectURL(output.url);
                }
            }
            setHistoryResult(newGeneration);
        } else {
            // For normal generations, update the generation result
            // Clean up previous latest result first
            if (latestResult) {
                for (const output of latestResult) {
                    URL.revokeObjectURL(output.url);
                }
            }
            setLatestResult(newGeneration);
            
            // Also update history result if we're in history view
            if (currentMobileView === 'history') {
                // Clean up previous history result first
                if (historyResult) {
                    for (const output of historyResult) {
                        URL.revokeObjectURL(output.url);
                    }
                }
                setHistoryResult(newGeneration);
            }
        }
        
        // Reset the variation flag
        setIsVariationInProgress(false);
        setGenerationState('complete');
    };

    // Function to save a generated image as a preview image
    const saveAsPreviewImage = async (blob: Blob, index: number = 0) => {
        if (!viewComfyState.currentViewComfy) return;
        
        try {
            // Convert the Blob to a File object
            const fileName = `generated_image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
            const file = new File([blob], fileName, { type: blob.type });
            
            // Upload the file using the preview-images API
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/playground/preview-images', {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload preview image');
            }
            
            const data = await response.json();
            const imageUrl = data.url;
            
            // Create a copy of the current workflow
            const updatedWorkflow = { 
                ...viewComfyState.currentViewComfy,
                viewComfyJSON: { 
                    ...viewComfyState.currentViewComfy.viewComfyJSON
                } 
            };
            
            // Initialize previewImages array if it doesn't exist
            if (!updatedWorkflow.viewComfyJSON.previewImages) {
                updatedWorkflow.viewComfyJSON.previewImages = [null, null, null];
            }
            
            // Update the preview image at the specified index
            if (updatedWorkflow.viewComfyJSON.previewImages) {
                updatedWorkflow.viewComfyJSON.previewImages[index] = imageUrl;
            }
            
            // Update the workflow state
            viewComfyStateDispatcher({
                type: ActionType.UPDATE_CURRENT_VIEW_COMFY,
                payload: updatedWorkflow
            });
            
            // Save the updated workflow
            const saveResponse = await fetch('/api/playground', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    viewComfy: updatedWorkflow
                }),
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to save workflow with new preview image');
            }
            
            toast({
                title: "Preview image saved",
                description: "The workflow preview image has been updated.",
            });
            
        } catch (error) {
            console.error('Error saving preview image:', error);
            toast({
                title: "Error saving preview image",
                description: "Failed to update the workflow preview image.",
                variant: "destructive"
            });
        }
    };

    // Effect to clean up resources when component unmounts
    useEffect(() => {
        return () => {
            // Clean up all object URLs
            cleanupResults();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clean up resources
    const cleanupResults = () => {
        // Reset tracking flags
        setLatestWasVariationFromHistory(false);
        setIsVariationInProgress(false);
        
        // Revoke object URLs from results
        for (const generation of Object.values(results)) {
            for (const output of generation) {
                URL.revokeObjectURL(output.url);
            }
        }
        
        // Revoke object URLs from latestResult
        if (latestResult) {
            for (const output of latestResult) {
                URL.revokeObjectURL(output.url);
            }
        }
        
        // Revoke object URLs from historyResult
        if (historyResult) {
            for (const output of historyResult) {
                URL.revokeObjectURL(output.url);
            }
        }
    };

    // Reset when switching back to generation view
    const resetGenerationView = () => {
        setCurrentMobileView('generate');
        setGenerationState('idle');
        // Reset generation state
        setLatestWasVariationFromHistory(false);
    };

    const onSelectChange = (data: IViewComfy) => {
        return viewComfyStateDispatcher({
            type: ActionType.UPDATE_CURRENT_VIEW_COMFY,
            payload: { ...data }
        });
    }
    
    // Handle workflow selection in mobile view
    const handleWorkflowSelect = (workflow: IViewComfy) => {
        onSelectChange(workflow);
        if (isMobile) {
            setMobileFormOpen(true);
        }
    }

    // Function to create a variation of an image with a new seed
    const createVariation = () => {
        if (!viewComfyState.currentViewComfy?.viewComfyJSON) return;
        
        // Create a deep clone of the current workflow
        const workflowClone = JSON.parse(JSON.stringify(viewComfyState.currentViewComfy.viewComfyJSON));
        
        // Find seed inputs in the workflow - they typically have "seed" in their name
        let foundSeedInput = false;
        
        // Look in regular inputs
        for (const inputGroup of workflowClone.inputs) {
            for (const input of inputGroup.inputs) {
                if (input.key.toLowerCase().includes('seed')) {
                    // Generate a new random seed (typical range is 0-4294967295)
                    const newSeed = Math.floor(Math.random() * 4294967295).toString();
                    input.value = newSeed;
                    foundSeedInput = true;
                    console.log(`Changed seed to: ${newSeed}`);
                }
            }
        }
        
        // Look in advanced inputs if not found in regular inputs
        if (!foundSeedInput && workflowClone.advancedInputs) {
            for (const inputGroup of workflowClone.advancedInputs) {
                for (const input of inputGroup.inputs) {
                    if (input.key.toLowerCase().includes('seed')) {
                        // Generate a new random seed
                        const newSeed = Math.floor(Math.random() * 4294967295).toString();
                        input.value = newSeed;
                        foundSeedInput = true;
                        console.log(`Changed seed to: ${newSeed}`);
                    }
                }
            }
        }
        
        // Track this as a variation from history if we're in history view
        if (currentMobileView === 'history') {
            setLatestWasVariationFromHistory(true);
        }
        
        if (foundSeedInput) {
            // Submit the modified workflow, marking it as a variation
            onSubmit(workflowClone, { isVariation: true });
        } else {
            // If no seed parameter was found, just resubmit the original workflow
            // The backend might still generate variation due to internal randomness
            onSubmit(viewComfyState.currentViewComfy.viewComfyJSON, { isVariation: true });
            console.log("No seed parameter found, resubmitting original workflow");
        }
    };

    if (!viewComfyState.currentViewComfy) {
        return <>
            <div className="flex flex-col h-screen">
                <ErrorAlertDialog open={errorAlertDialog.open} errorTitle={errorAlertDialog.errorTitle} errorDescription={errorAlertDialog.errorDescription} onClose={errorAlertDialog.onClose} />
            </div>
        </>;
    }
    
    // Mobile view for Viewcomfy workflow gallery
    if (isMobile && viewMode) {
        return (
            <>
                <div className="flex flex-col h-full w-full overflow-hidden">
                    {/* Content views */}
                    {currentMobileView === 'generate' && generationState === 'idle' && (
                        <div className="flex-1 h-full w-full">
                            <MobileMasonryGallery 
                                viewComfys={viewComfyState.viewComfys} 
                                onWorkflowSelect={(workflow) => {
                                    setLatestWasVariationFromHistory(false);
                                    handleWorkflowSelect(workflow);
                                }} 
                            />
                        </div>
                    )}

                    {currentMobileView === 'history' && (
                        <div className="flex-1 h-full w-full p-0 overflow-hidden">
                            <MobileHistoryGallery 
                                onClose={() => resetGenerationView()}
                                latestResult={historyResult}
                                onRegenerate={(item) => {
                                    if (viewComfyState.currentViewComfy?.viewComfyJSON) {
                                        // Instead of immediately submitting, just navigate to the form
                                        resetGenerationView();
                                        setMobileFormOpen(true);
                                        // No onSubmit call, so user can modify parameters
                                    }
                                }}
                                onVariation={(item) => {
                                    createVariation();
                                    // Stay on history view to show loading state there
                                    // No need to switch views
                                }}
                                isGenerating={loading}
                            />
                        </div>
                    )}

                    {/* Generation form */}
                    <MobileGenerationForm
                        isOpen={mobileFormOpen}
                        onClose={() => {
                            setMobileFormOpen(false);
                            setGenerationState('idle');
                            if (latestWasVariationFromHistory) {
                                setLatestResult(null);
                            }
                        }}
                        viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON}
                        onSubmit={onSubmit}
                        loading={loading}
                        latestResult={latestWasVariationFromHistory ? null : latestResult}
                    />

                    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
                        <div className="flex items-center gap-2 p-2 rounded-full bg-background/90 backdrop-blur-sm shadow-lg border">
                            <Button
                                variant={currentMobileView === 'generate' ? "default" : "outline"}
                                className="rounded-full px-6 transition-none"
                                onClick={() => {
                                    setMobileFormOpen(false);
                                    setCurrentMobileView('generate');
                                    setGenerationState('idle');
                                    // Reset variation history flag when returning to generation view
                                    setLatestWasVariationFromHistory(false);
                                    // Clear latestResult if it was from a history variation
                                    if (latestWasVariationFromHistory) {
                                        setLatestResult(null);
                                    }
                                }}
                            >
                                <WandSparkles className="size-4 mr-2" />
                                Generate
                            </Button>
                            <Button
                                variant={currentMobileView === 'history' ? "default" : "outline"}
                                className="rounded-full px-6 transition-none"
                                onClick={() => {
                                    setMobileFormOpen(false);
                                    setCurrentMobileView('history');
                                }}
                            >
                                <BookmarkIcon className="size-4 mr-2" />
                                History
                            </Button>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    
    // Desktop view (original)
    return (
        <>
            <div className="flex flex-col h-full">
                {!(isMobile && viewMode) && <Header title="" />}
                <div className="md:hidden w-full flex pl-4 gap-x-2">
                    <WorkflowSwitcher viewComfys={viewComfyState.viewComfys} currentViewComfy={viewComfyState.currentViewComfy} onSelectChange={onSelectChange} />
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden self-bottom w-[85px] gap-1">
                                <Settings className="size-4" />
                                Settings
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="max-h-[80vh] gap-4 px-4 h-full">
                            <PlaygroundForm viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} onSubmit={onSubmit} loading={loading} />
                        </DrawerContent>
                    </Drawer>
                </div>
                <main className="grid overflow-hidden flex-1 gap-4 p-2 md:grid-cols-2 lg:grid-cols-3">
                    <div className="relative hidden flex-col items-start gap-8 md:flex overflow-hidden">
                        {viewComfyState.viewComfys.length > 0 && viewComfyState.currentViewComfy && (
                            <div className="px-3 w-full">
                                <WorkflowSwitcher viewComfys={viewComfyState.viewComfys} currentViewComfy={viewComfyState.currentViewComfy} onSelectChange={onSelectChange} />
                            </div>
                        )}
                        {viewComfyState.currentViewComfy && <PlaygroundForm viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} onSubmit={onSubmit} loading={loading} />}

                    </div>
                    <div className="relative h-full min-h-[50vh] rounded-xl bg-muted/50 px-1 lg:col-span-2">
                        <ScrollArea className="relative flex h-full w-full flex-col">
                            {(Object.keys(results).length === 0) && !loading && (
                                <>  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
                                    <PreviewOutputsImageGallery viewComfyJSON={viewComfyState.currentViewComfy?.viewComfyJSON} />
                                </div>
                                    <Badge variant="outline" className="absolute right-3 top-3">
                                        Output
                                    </Badge>
                                </>
                            )}
                            {loading ? (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                    <Loader />
                                </div>
                            ) : (
                                <div className="flex-1 h-full p-4 flex overflow-y-auto">
                                    <div className="flex flex-col w-full h-full">
                                        {Object.entries(results).map(([timestamp, generation], index, array) => (
                                            <div className="flex flex-col gap-4 w-full h-full" key={timestamp}>
                                                <div className="flex flex-wrap w-full h-full gap-4" key={timestamp}>
                                                    {generation.map((output) => (
                                                        <Fragment key={output.url}>
                                                            <div
                                                                key={output.url}
                                                                className="relative group flex items-center justify-center px-4 sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)]"
                                                            >
                                                                {(output.outputs.type.startsWith('image/')) && (
                                                                    <>
                                                                        <BlurFade key={output.url} delay={0.25} inView className="flex items-center justify-center w-full h-full">
                                                                            <img
                                                                                src={output.url}
                                                                                alt={`${output.url}`}
                                                                                className={cn("max-w-full max-h-full w-auto h-auto object-contain rounded-md transition-all hover:scale-105")}
                                                                            />
                                                                        </BlurFade>
                                                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <Button 
                                                                                variant="secondary" 
                                                                                size="sm" 
                                                                                className="bg-background/80 backdrop-blur-sm"
                                                                                onClick={() => saveAsPreviewImage(output.outputs, 0)}>
                                                                                <BookmarkIcon className="h-4 w-4 mr-1" />
                                                                                Set as preview
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {(output.outputs.type.startsWith('video/')) && (
                                                                    <video
                                                                        key={output.url}
                                                                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-md"
                                                                        autoPlay
                                                                        loop

                                                                    >
                                                                        <track default kind="captions" srcLang="en" src="SUBTITLE_PATH" />
                                                                        <source src={output.url} />
                                                                    </video>
                                                                )}
                                                            </div>
                                                            {(output.outputs.type.startsWith('text/')) && (
                                                                <pre className="whitespace-pre-wrap break-words text-sm bg-white rounded-md w-full">
                                                                    {URL.createObjectURL(output.outputs) && (
                                                                        <object
                                                                            data={output.url}
                                                                            type={output.outputs.type}
                                                                            className="w-full"
                                                                        >
                                                                            Unable to display text content
                                                                        </object>
                                                                    )}
                                                                </pre>
                                                            )}
                                                        </Fragment>
                                                    ))}
                                                </div>
                                                <hr className={
                                                    `w-full py-4 
                                                ${index !== array.length - 1 ? 'border-gray-300' : 'border-transparent'}
                                                `}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </main>
                <ErrorAlertDialog open={errorAlertDialog.open} errorTitle={errorAlertDialog.errorTitle} errorDescription={errorAlertDialog.errorDescription} onClose={errorAlertDialog.onClose} />
            </div>
        </>
    );
}

export default function PlaygroundPage() {
    return (
        <PlaygroundPageContent />
    );
}
