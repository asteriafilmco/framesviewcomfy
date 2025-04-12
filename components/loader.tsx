import "../app/styles.scss";
import { cn } from "@/lib/utils";

interface LoaderProps {
    className?: string;
}

export function Loader({ className }: LoaderProps = {}) {
    return (
        <div className={cn("flex items-center justify-center", className)}>
            {[...Array(15)].map((_, i) => (
                <div key={i} className={`circ circ-${i + 1}`}></div>
            ))}
        </div>
    )
}