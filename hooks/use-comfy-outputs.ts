import { useState, useEffect } from 'react';

interface ComfyOutput {
    name: string;
    path: string;
    created: string;
    size: number;
}

export function useComfyOutputs() {
    const [outputs, setOutputs] = useState<ComfyOutput[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOutputs = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/comfy/outputs');
            if (!response.ok) {
                throw new Error('Failed to fetch outputs');
            }
            const data = await response.json();
            setOutputs(data.outputs);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch outputs');
            setOutputs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOutputs();
        
        // Set up polling to check for new outputs every 10 seconds
        const interval = setInterval(fetchOutputs, 10000);
        return () => clearInterval(interval);
    }, []);

    return {
        outputs,
        loading,
        error,
        refresh: fetchOutputs
    };
} 