import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getComfyUIRandomSeed() {
  const minCeiled = Math.ceil(0);
  const maxFloored = Math.floor(2 ** 32);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

/**
 * Gets the full image path by prefixing relative paths with NEXT_PUBLIC_API_URL when needed
 * @param imagePath The original image path
 * @returns The full image path with proper API URL prefix if needed
 */
export function getFullImagePath(imagePath: string | null): string | null {
  if (!imagePath) return null;
  
  // Check if it's a relative path (starts with /)
  if (imagePath.startsWith('/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    // Only add the API URL if it exists and we're not already using an absolute URL
    if (apiUrl && !imagePath.startsWith('http')) {
      // Remove trailing slash from API URL if it exists
      const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      return `${baseUrl}${imagePath}`;
    }
  }
  
  return imagePath;
}