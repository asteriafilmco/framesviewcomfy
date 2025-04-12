"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SettingsForm() {
    return (
        <div className="grid gap-4 p-4">
            <h3 className="text-lg font-medium">Settings</h3>
            <div className="grid gap-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input id="api-key" placeholder="Enter your API key" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="theme">Theme</Label>
                {/* Placeholder for theme toggle/select */}
                <p className="text-sm text-muted-foreground">Theme selection coming soon.</p>
            </div>
            <Button size="sm">Save Settings</Button>
        </div>
    );
} 