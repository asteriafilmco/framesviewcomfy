/* eslint-disable @next/next/no-img-element */
"use client";
import { cn, getFullImagePath } from "@/lib/utils";
import React, { useState } from "react";
import { motion } from "framer-motion";
import type { IViewComfy, IViewComfyWorkflow } from "@/app/providers/view-comfy-provider";
import BlurFade from "@/components/ui/blur-fade";
import { ImageIcon } from "lucide-react";

interface MasonryGalleryProps {
  viewComfys: IViewComfy[];
  onWorkflowSelect: (workflow: IViewComfy) => void;
}

export function MobileMasonryGallery({
  viewComfys,
  onWorkflowSelect,
}: MasonryGalleryProps) {
  // Split workflows into columns for masonry layout
  const leftColumn = viewComfys.filter((_, i) => i % 2 === 0);
  const rightColumn = viewComfys.filter((_, i) => i % 2 === 1);

  return (
    <div className="w-full p-0">
      <div className="grid grid-cols-2 gap-2 px-0">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          {leftColumn.map((viewComfy, index) => (
            <WorkflowTile 
              key={viewComfy.viewComfyJSON.id} 
              viewComfy={viewComfy} 
              index={index}
              onSelect={() => onWorkflowSelect(viewComfy)}
            />
          ))}
        </div>
        
        {/* Right column */}
        <div className="flex flex-col gap-2">
          {rightColumn.map((viewComfy, index) => (
            <WorkflowTile 
              key={viewComfy.viewComfyJSON.id} 
              viewComfy={viewComfy} 
              index={index + 1}
              onSelect={() => onWorkflowSelect(viewComfy)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface WorkflowTileProps {
  viewComfy: IViewComfy;
  index: number;
  onSelect: () => void;
}

function WorkflowTile({ viewComfy, index, onSelect }: WorkflowTileProps) {
  const { viewComfyJSON } = viewComfy;
  const [imageError, setImageError] = useState(false);
  
  // Get the first valid preview image
  const rawPreviewImage = !imageError && viewComfyJSON.previewImages?.find(img => img !== null && img !== "") || null;
  
  // Use the shared utility function to get the full image path
  const previewImage = getFullImagePath(rawPreviewImage);
  
  // Generate a background color based on the workflow title for the placeholder
  const getColorFromTitle = (title: string) => {
    const hash = title.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 85%)`;
  };
  
  return (
    <BlurFade 
      delay={0.05 * index} 
      inView 
      className="w-full"
    >
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={onSelect}
        className="relative overflow-hidden shadow-md bg-background"
        style={{ borderRadius: '0' }}
      >
        {previewImage ? (
          <div className="relative w-full aspect-square">
            <img
              src={previewImage}
              alt={viewComfyJSON.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2">
              <h3 className="text-sm font-medium text-white truncate">{viewComfyJSON.title}</h3>
            </div>
          </div>
        ) : (
          <div 
            className="flex flex-col items-center justify-center aspect-square p-2"
            style={{ backgroundColor: getColorFromTitle(viewComfyJSON.title) }}
          >
            <ImageIcon className="h-10 w-10 mb-2 text-background/80" />
            <h3 className="text-sm font-medium text-center text-background/90">{viewComfyJSON.title}</h3>
          </div>
        )}
      </motion.div>
    </BlurFade>
  );
} 