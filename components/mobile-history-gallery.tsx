/* eslint-disable @next/next/no-img-element */
"use client";
import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import BlurFade from "@/components/ui/blur-fade";
import { Image, ImageIcon, DownloadIcon, TrashIcon, FolderIcon, X, RefreshCw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/loader";
import TextFade from "@/components/ui/text-fade";

// History item structure from localStorage
interface HistoryItem {
  type: string;
  data: string; // base64 data
  timestamp: number;
  timeFormatted: string;
  url?: string; // Added during processing
}

// File item structure from comfy/output directory
interface OutputFileItem {
  name: string;
  path: string;
  created: string; // ISO string
  size: number;
  url?: string; // Added during processing
  isFileSystem?: boolean; // Flag to indicate this is from filesystem, not localStorage
  timestamp?: number; // Added during processing
  fallbackUrls?: Record<string, string>; // Multiple URLs for fallback
  prompt?: string; // Prompt used to generate the image
  isLatestGeneration?: boolean; // Flag to indicate if this is the latest generation
}

interface MobileHistoryGalleryProps {
  onClose: () => void;
  latestResult?: { outputs: Blob, url: string, prompt?: string }[] | null;
  onRegenerate?: (item: OutputFileItem) => void;
  onVariation?: (item: OutputFileItem) => void;
  isGenerating?: boolean; // Add this to track if generation is in progress
}

export function MobileHistoryGallery({ 
  onClose, 
  latestResult, 
  onRegenerate, 
  onVariation,
  isGenerating = false  // Default to false
}: MobileHistoryGalleryProps) {
  const [historyItems, setHistoryItems] = useState<OutputFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileSystemEnabled, setFileSystemEnabled] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [selectedImage, setSelectedImage] = useState<OutputFileItem | null>(null);
  const [processedItems, setProcessedItems] = useState<OutputFileItem[]>([]);

  // Convert base64 back to object URL
  const base64ToObjectUrl = (item: HistoryItem): string => {
    try {
      if (!item.data.includes('base64')) {
        console.error('Invalid base64 data for item:', item);
        return '';
      }
      
      const parts = item.data.split(',');
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: item.type });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Error converting base64 to URL:', err);
      return '';
    }
  };

  // Load files from comfy/output directory
  const loadOutputFiles = async () => {
    try {
      const response = await fetch('/api/comfy/outputs');
      if (!response.ok) {
        console.error('[History] Error fetching output files:', response.statusText);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.outputs || !Array.isArray(data.outputs)) {
        console.error('[History] Invalid response format from outputs API:', data);
        return [];
      }
      
      // Process the files with multiple URL options for fallback
      const outputFiles: OutputFileItem[] = data.outputs.map((file: OutputFileItem) => {
        // Create multiple URL options for the same file
        const urls = {
          // API route (primary)
          api: `/api/comfy/static/${encodeURIComponent(file.name)}`,
          // Public directory fallback
          public: `/comfy/output/${encodeURIComponent(file.name)}`,
          // Original path
          original: file.path
        };
        
        return {
          ...file,
          url: urls.api, // Use API route as primary option
          fallbackUrls: urls, // Store all URLs for fallback
          isFileSystem: true,
          timestamp: new Date(file.created).getTime(),
        };
      });
      
      console.log(`[History] Loaded ${outputFiles.length} files from filesystem`);
      return outputFiles;
    } catch (err) {
      console.error('[History] Error loading output files:', err);
      return [];
    }
  };

  // Load history from localStorage
  const loadLocalStorageHistory = () => {
    try {
      const historyString = localStorage.getItem('comfyHistory') || '[]';
      const history = JSON.parse(historyString) as HistoryItem[];
      
      // Process items to create object URLs
      const processedItems = history.map(item => ({
        ...item,
        url: base64ToObjectUrl(item)
      }));
      
      console.log(`[History] Loaded ${processedItems.length} items from localStorage`);
      return processedItems;
    } catch (err) {
      console.error('Error loading localStorage history:', err);
      return [];
    }
  };

  // Combined history loading function
  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Load files from filesystem
      const filesystemHistory = await loadOutputFiles();
      
      // Sort by timestamp (newest first)
      const sortedHistory = filesystemHistory.sort((a, b) => {
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      
      setHistoryItems(sortedHistory);
      setProcessedItems(sortedHistory); // Initially set all items
      console.log(`[History] Loaded: ${sortedHistory.length} items`);
    } catch (err) {
      setError('Error loading history: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clear localStorage history
  const clearLocalStorageHistory = () => {
    try {
      localStorage.removeItem('comfyHistory');
      console.log('[History] localStorage history cleared');
    } catch (err) {
      console.error('Error clearing localStorage history:', err);
    }
  };

  // Clear all history
  const clearHistory = () => {
    try {
      // Re-load to refresh files
      loadHistory();
      console.log('[History] History refreshed');
    } catch (err) {
      setError('Error refreshing history: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error refreshing history:', err);
    }
  };

  // Toggle filesystem history
  const toggleFileSystemHistory = () => {
    setFileSystemEnabled(!fileSystemEnabled);
  };

  // Effect to reload history when fileSystemEnabled changes
  useEffect(() => {
    loadHistory();
  }, [fileSystemEnabled]);

  // Download an image
  const handleDownload = (item: OutputFileItem) => {
    if (!item.url) return;
    
    // Use fallback URLs if available
    let downloadUrl = item.url;
    
    if (item.fallbackUrls) {
      // Try the API URL first, then public, then original
      downloadUrl = item.fallbackUrls.api || item.fallbackUrls.public || item.fallbackUrls.original || item.url;
    }
    
    window.open(downloadUrl, '_blank');
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    loadHistory();
    
    return () => {
      // No need to revoke URLs since we're not creating blob URLs anymore
    };
  }, []);

  // Split images into columns for masonry layout, but feature the latest result if available
  const displayItems = [...processedItems];
  const featuredItem = latestResult && latestResult.length > 0 ? 
    {
      name: `Generated_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
      path: "",
      created: new Date().toISOString(),
      size: 0,
      url: latestResult[0].url,
      isLatestGeneration: true,
      timestamp: Date.now(),
      outputs: latestResult[0].outputs,
      prompt: latestResult[0].prompt || "Generated with the current workflow settings", // Use prompt from latestResult if available
    } : displayItems.length > 0 ? displayItems.shift() : null;

  // Run diagnostics for static file access
  const runDiagnostics = async () => {
    try {
      setLoading(true);
      
      // Call the debug endpoint
      const response = await fetch('/api/comfy/debug-static');
      if (!response.ok) {
        throw new Error(`Error status: ${response.status}`);
      }
      
      const data = await response.json();
      setDebugInfo(data);
      setShowDebug(true);
      
    } catch (err) {
      setError('Error running diagnostics: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  if (showDebug && debugInfo) {
    return (
      <div className="w-full p-4">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            <TextFade>Static File Diagnostics</TextFade>
          </h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDebug(false)}
          >
            Back to Gallery
          </Button>
        </div>
        
        <div className="bg-muted p-4 rounded-md mb-4">
          <h3 className="font-medium mb-2">
            <TextFade>Output Directory</TextFade>
          </h3>
          <p className="text-sm mb-1">Path: {debugInfo.outputDir}</p>
          <p className="text-sm mb-1">Exists: {debugInfo.outputDirExists ? 'Yes' : 'No'}</p>
          <p className="text-sm mb-1">File Count: {debugInfo.fileCount}</p>
        </div>
        
        <div className="bg-muted p-4 rounded-md mb-4">
          <h3 className="font-medium mb-2">Test Files</h3>
          {Object.entries(debugInfo.testFiles).map(([filename, info]: [string, any]) => (
            <div key={filename} className="mb-3 border-b pb-2">
              <p className="text-sm font-medium">{filename}</p>
              <p className="text-xs">Exists: {info.exists ? 'Yes' : 'No'}</p>
              <p className="text-xs">Size: {info.size} bytes</p>
              <p className="text-xs mb-1">API Path: {info.apiPath}</p>
              <div className="flex space-x-2 mt-1">
                <a 
                  href={info.apiPath} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-500 underline"
                >Test API Path</a>
                <a 
                  href={info.rewritePath} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-500 underline"
                >Test Rewrite Path</a>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-muted p-4 rounded-md mb-4">
          <h3 className="font-medium mb-2">All Files</h3>
          <div className="max-h-40 overflow-y-auto">
            <ul className="text-xs">
              {debugInfo.allFiles.map((file: string) => (
                <li key={file} className="mb-1">
                  {file}
                  <a 
                    href={`/api/comfy/static/${encodeURIComponent(file)}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="ml-2 text-blue-500 underline"
                  >View</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="bg-muted p-4 rounded-md">
          <h3 className="font-medium mb-2">Config</h3>
          <p className="text-xs mb-1">CWD: {debugInfo.config.cwd}</p>
          <p className="text-xs mb-1">Asset Prefix: {debugInfo.config.nextPublicAssetPrefix}</p>
          <pre className="text-xs bg-gray-900 text-white p-2 rounded mt-2 overflow-x-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => loadHistory()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (historyItems.length === 0 && !featuredItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">
          <TextFade>No history items found. Generate some images first!</TextFade>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-0 overflow-y-auto">
      {/* Full screen preview */}
      {selectedImage && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          {/* Close Button (Top Right) */}
          <div className="absolute top-4 right-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
              className="h-8 w-8 bg-background/50 hover:bg-background/70"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Image Content */}
          <div className="flex-shrink-0 w-full max-w-md flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.url}
              alt={selectedImage.name}
              className="max-w-full max-h-[75vh] object-contain"
            />
          </div>
          
          {/* Details Bar (Bottom) */}
          <div 
            className="w-full max-w-md mt-4 px-2 flex justify-between items-center" 
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking details
          >
            {/* Left: Text (Filename & Prompt) */}
            <div className="text-left flex-1 overflow-hidden mr-4">
              <h3 className="text-xs font-semibold truncate text-white">
                {selectedImage.isLatestGeneration ? 'Latest Generation' : selectedImage.name}
              </h3>
              {(selectedImage.prompt || selectedImage.isLatestGeneration) && (
                <p className="text-xs text-white/80 mt-0.5 break-words">
                  {selectedImage.prompt || "Generated with the current workflow settings"}
                </p>
              )}
            </div>
            
            {/* Right: Buttons */}
            <div className="flex space-x-2 flex-shrink-0">
              {/* Remix Button */}
              {onRegenerate && (
                <Button 
                  variant="secondary"
                  size="icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerate(selectedImage);
                    setSelectedImage(null); // Close the fullscreen view
                  }}
                  aria-label="Remix image"
                  className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              
              {/* Variation Button */}
              {onVariation && (
                <Button 
                  variant="secondary"
                  size="icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onVariation(selectedImage);
                    setSelectedImage(null); // Close the fullscreen view
                  }}
                  aria-label="Create variation"
                  className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              )}
              
              {/* Download Button */}
              <Button 
                variant="secondary"
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedImage);
                }}
                aria-label="Download image"
                className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>

              {/* Share Button */}
              <Button 
                variant="secondary"
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.share?.({
                    title: selectedImage.name,
                    text: selectedImage.prompt || 'Check out this image',
                    url: selectedImage.url
                  }).catch(console.error);
                }}
                aria-label="Share image"
                className="h-8 w-8 bg-black/20 hover:bg-black/40 text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Featured image (latest generation) */}
      {featuredItem && (
        <div className="mb-4 p-0">
          <BlurFade
            delay={0.01}
            duration={0.2}
            blur="0px"
            inView
            className="w-full"
          >
            <div 
              className="overflow-hidden shadow-md cursor-pointer"
              style={{ 
                border: 'none', 
                borderColor: 'transparent',
                borderRadius: '0'
              }}
              onClick={() => setSelectedImage(featuredItem)}
            >
              <div 
                className="w-full relative flex items-center justify-center"
                style={{ border: 'none', borderColor: 'transparent' }}
              >
                {isGenerating ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Loader className="w-12 h-12 mb-2" />
                    <p className="text-white text-center px-4">Generating variation...</p>
                  </div>
                ) : null}
                <img 
                  src={(featuredItem as any).url} 
                  alt="Latest generation" 
                  className={cn(
                    "w-full h-auto max-h-[70vh]",
                    isGenerating ? "opacity-50" : ""
                  )}
                  style={{ border: 'none', borderColor: 'transparent' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                  }}
                />
                {(featuredItem as any).isLatestGeneration && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                      Latest
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </BlurFade>
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader />
        </div>
      ) : historyItems.length === 0 && !featuredItem ? (
        <div className="text-center py-12">
          <FolderIcon className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-4 text-lg font-medium">No images yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Generated images will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-0 m-0">
          {/* Render items in a row-based layout */}
          {displayItems.map((item, index) => (
            <HistoryTile 
              key={item.url || index}
              item={item}
              index={index}
              onDownload={() => handleDownload(item)}
              onSelect={() => setSelectedImage(item)}
              onRegenerate={() => onRegenerate?.(item)}
              canRegenerate={!!onRegenerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface HistoryTileProps {
  item: OutputFileItem;
  index: number;
  onDownload: () => void;
  onSelect: () => void;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
}

function HistoryTile({ item, index, onDownload, onSelect, onRegenerate, canRegenerate }: HistoryTileProps) {
  const [imageError, setImageError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  
  // Get the available URLs for fallback
  const getUrls = () => {
    if ('fallbackUrls' in item && item.fallbackUrls) {
      return Object.values(item.fallbackUrls);
    } 
    return [item.url];
  };
  
  // Handle image load error by trying next URL
  const handleImageError = () => {
    const urls = getUrls();
    if (currentUrlIndex < urls.length - 1) {
      // Try next URL in the list
      setCurrentUrlIndex(currentUrlIndex + 1);
    } else {
      // All URLs failed, show error state
      setImageError(true);
    }
  };
  
  // Get the current URL to use
  const getCurrentUrl = () => {
    const urls = getUrls();
    return urls[currentUrlIndex] || '';
  };
  
  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get display text for the item
  const getDisplayText = () => {
    return item.name;
  };

  // Get timestamp for the item
  const getTimestamp = () => {
    return new Date(item.created).getTime();
  };

  // Check if item is from filesystem
  const isFileSystem = 'isFileSystem' in item && item.isFileSystem;
  
  // Effect for Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update visibility state when intersection changes
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      {
        rootMargin: '0px', // Adjust as needed
        threshold: 0.1   // Trigger when 10% visible
      }
    );

    if (tileRef.current) {
      observer.observe(tileRef.current);
    }

    // Cleanup observer on component unmount
    return () => {
      if (tileRef.current) {
        observer.unobserve(tileRef.current);
      }
      observer.disconnect();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <BlurFade 
      delay={0.02 * index}
      duration={0.2}
      blur="2px"
      inView 
      className="w-full"
    >
      <motion.div
        ref={tileRef} // Attach ref here
        whileTap={{ scale: 0.97 }}
        onClick={onSelect}
        className="relative overflow-hidden shadow-md bg-background cursor-pointer h-auto"
        style={{ border: 'none', borderColor: 'transparent', borderRadius: '0' }}
      >
        {item.url && !imageError ? (
          <div 
            className="relative w-full aspect-square"
            style={{ border: 'none', borderColor: 'transparent' }}
          >
            {isVisible && (
              <img
                src={getCurrentUrl()} 
                alt={getDisplayText()}
                className="w-full h-full object-cover"
                style={{ border: 'none', borderColor: 'transparent' }}
                onError={handleImageError}
              />
            )}
            {!isVisible && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <ImageIcon className="h-10 w-10 text-muted-foreground/50 animate-pulse" />
              </div>
            )}
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" 
              style={{ border: 'none', borderColor: 'transparent' }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center aspect-square p-2 bg-muted">
            <ImageIcon className="h-10 w-10 mb-2 text-muted-foreground" />
          </div>
        )}
      </motion.div>
    </BlurFade>
  );
} 