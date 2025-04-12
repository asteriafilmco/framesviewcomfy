"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowUp, WandSparkles, BookmarkIcon, RefreshCw } from "lucide-react";
import PlaygroundForm from "@/components/pages/playground/playground-form";
import { IViewComfyWorkflow } from "@/app/providers/view-comfy-provider";
import { Badge } from "@/components/ui/badge";
import BlurFade from "@/components/ui/blur-fade";
import TextFade from "@/components/ui/text-fade";
import { Loader } from "@/components/loader";
import { cn } from "@/lib/utils";

// Define animation styles
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .slide-container {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
  }
  
  .slide-initial {
    transform: translateY(-100%);
    opacity: 0;
  }
  
  .slide-in {
    transform: translateY(0);
    opacity: 1;
  }
  
  .slide-up {
    transform: translateY(-100%);
    opacity: 0;
  }
`;

interface MobileGenerationFormProps {
  isOpen: boolean;
  onClose: () => void;
  viewComfyJSON: IViewComfyWorkflow | undefined;
  onSubmit: (data: IViewComfyWorkflow) => void;
  loading: boolean;
  latestResult: { outputs: Blob, url: string }[] | null;
}

interface PreviewImage {
  url: string;
  alt: string;
}

export function MobileGenerationForm({
  isOpen,
  onClose,
  viewComfyJSON,
  onSubmit,
  loading,
  latestResult
}: MobileGenerationFormProps) {
  // Keep track of all generations in the current session
  const [sessionGenerations, setSessionGenerations] = useState<Array<{
    timestamp: number;
    results: { outputs: Blob, url: string }[];
  }>>([]);

  // State for full-screen preview
  const [selectedImage, setSelectedImage] = useState<PreviewImage | null>(null);
  
  // Animation state
  const [slideState, setSlideState] = useState<'initial' | 'in' | 'up'>('initial');
  const [isVisible, setIsVisible] = useState(false);
  
  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setSlideState('initial');
      
      // Small delay to ensure the initial class is applied first
      const timer = setTimeout(() => {
        setSlideState('in');
      }, 50);
      
      return () => clearTimeout(timer);
    } else {
      setSlideState('initial');
      setIsVisible(false);
    }
  }, [isOpen]);
  
  // Custom close handler that triggers the slide up animation
  const handleClose = () => {
    setSlideState('up');
    
    // Delay the actual close to allow the animation to play
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // Add new generations to the session history
  useEffect(() => {
    if (latestResult && latestResult.length > 0) {
      setSessionGenerations(prev => [{
        timestamp: Date.now(),
        results: latestResult
      }, ...prev]);
    }
  }, [latestResult]);

  // Clear session generations when form is closed
  useEffect(() => {
    if (!isOpen) {
      setSessionGenerations([]);
    }
  }, [isOpen]);

  // Lock scroll when form is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isVisible || !viewComfyJSON) {
    return null;
  }

  return (
    <div className={cn(
      "slide-container bg-background", 
      `slide-${slideState}`
    )}>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      
      {/* Full screen preview */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedImage(null)}
              className="h-8 w-8 bg-background/50 hover:bg-background/70"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div 
            className="flex items-center justify-center w-full h-full p-4"
          >
            <div className="w-full max-w-md aspect-square overflow-hidden">
              <img
                src={selectedImage.url}
                alt={selectedImage.alt}
                className="w-full h-full object-cover"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background z-10">
        <h2 className="text-lg font-medium truncate">
          <TextFade>{viewComfyJSON.title}</TextFade>
        </h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          className="hover:bg-muted transition-colors"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Scrollable Container for both Form and Generations */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {/* Form Section with Background */}
          <div className="sticky top-0 bg-background z-10">
            <div className="p-4 border-b">
              <PlaygroundForm 
                viewComfyJSON={viewComfyJSON} 
                onSubmit={onSubmit} 
                loading={loading} 
              />
              
              {/* Loading Indicator */}
              {loading && (
                <div
                  className="flex items-center justify-center"
                  style={{
                    animation: "fadeIn 0.3s ease-in-out"
                  }}
                >
                  <div className="relative w-full aspect-square max-w-[400px] mx-auto bg-muted/50 rounded-lg">
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loader className="w-16 h-16 mb-4" />
                      <p className="text-muted-foreground">Generating your image...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Generations Section */}
          {sessionGenerations.length > 0 && (
            <div className="flex flex-col gap-8 p-4">
              {sessionGenerations.map((generation, genIndex) => (
                <div key={generation.timestamp} className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">
                      {genIndex === 0 && loading ? 'Previous Generation' : genIndex === 0 ? 'Latest Generation' : `Generation ${sessionGenerations.length - genIndex}`}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(generation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <BlurFade
                    delay={0.01}
                    duration={0.2}
                    blur="0px"
                    inView
                    className="w-full"
                  >
                    <div className="rounded-lg overflow-hidden shadow-md">
                      {generation.results.map((result, index) => (
                        <div 
                          key={index} 
                          className="w-full relative aspect-square flex items-center justify-center cursor-pointer group"
                          onClick={() => setSelectedImage({
                            url: result.url,
                            alt: `Generation ${sessionGenerations.length - genIndex} result ${index + 1}`
                          })}
                        >
                          <img 
                            src={result.url} 
                            alt={`Generation ${sessionGenerations.length - genIndex} result ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </BlurFade>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 