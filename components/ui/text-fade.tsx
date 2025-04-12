"use client";

import { cn } from "@/lib/utils";

interface TextFadeProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

// Simplified component with no animations
export default function TextFade({
  children,
  className,
  as: Component = "span",
}: TextFadeProps) {
  return (
    <Component className={cn("text-fade-wrapper", className)}>
      {children}
    </Component>
  );
} 