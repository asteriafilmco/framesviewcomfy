"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react"; // Use ArrowUp for closing
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

// Define animation styles (copied from MobileGenerationForm)
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

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  // Animation state
  const [slideState, setSlideState] = useState<'initial' | 'in' | 'up'>('initial');
  const [isVisible, setIsVisible] = useState(false);
  
  // Settings state
  const [apiKey, setApiKey] = useState<string>("");
  const [endpoint, setEndpoint] = useState<string>("");
  const { toast } = useToast();

  // Load saved settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiKey = localStorage.getItem('viewcomfy-api-key') || "";
      const savedEndpoint = localStorage.getItem('viewcomfy-endpoint') || "";
      setApiKey(savedApiKey);
      setEndpoint(savedEndpoint);
    }
  }, []);

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
      // Don't immediately hide, wait for animation
      // setIsVisible(false); 
    }
  }, [isOpen]);

  // Custom close handler that triggers the slide up animation
  const handleClose = () => {
    setSlideState('up');
    
    // Delay the actual close to allow the animation to play
    setTimeout(() => {
      onClose(); 
      // Reset state after closing fully
      setIsVisible(false);
      setSlideState('initial');
    }, 300); 
  };

  // Lock scroll when form is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = ""; // Ensure scroll is unlocked on unmount
    };
  }, [isOpen]);

  // Save settings
  const handleSaveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('viewcomfy-api-key', apiKey);
      localStorage.setItem('viewcomfy-endpoint', endpoint);
      
      // Show success toast
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
      
      // Close the panel
      handleClose();
    }
  };

  if (!isVisible && slideState !== 'up') { // Keep rendering during slide-up animation
    return null;
  }

  return (
    <div className={cn(
      "slide-container bg-background", 
      `slide-${slideState}`
    )}>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* Fixed Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background z-10">
        <h2 className="text-lg font-medium">Settings</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClose}
          className="hover:bg-muted transition-colors"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Actual Settings Form Content */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="endpoint">ComfyUI Endpoint</Label>
            <Input 
              id="endpoint" 
              placeholder="e.g., 127.0.0.1:8188" 
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your ComfyUI server address. Default is 127.0.0.1:8188.
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input 
              id="api-key" 
              placeholder="Enter your API key" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="theme">Theme</Label>
            {/* Placeholder for theme toggle/select */}
            <p className="text-sm text-muted-foreground">Theme selection coming soon.</p>
          </div>
          
          <Button size="sm" onClick={handleSaveSettings}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
} 