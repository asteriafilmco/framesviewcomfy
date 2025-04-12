"use client"

import * as React from "react"
import { MoonIcon } from "@radix-ui/react-icons"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
    const { theme } = useTheme()

    return (
        <Button 
            variant="outline" 
            size="icon" 
            className="relative h-9 w-9 rounded-md cursor-default opacity-80"
            disabled={true}
        >
            <MoonIcon className="h-5 w-5" />
            <span className="sr-only">Dark mode enabled</span>
        </Button>
    )
}
