import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label
                    htmlFor={id}
                    className="text-sm font-medium text-gray-700"
                >
                    {label}
                </label>
            )}
            <input
                id={id}
                className={cn(
                    "w-full px-3 py-2 text-sm bg-gray-50 border rounded-xl outline-none transition-colors",
                    error
                        ? "border-red-400 focus:border-red-500 focus:bg-white"
                        : "border-gray-200 focus:border-primary-400 focus:bg-white",
                    className,
                )}
                {...props}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea({ label, error, className, id, ...props }, ref) {
        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={id}
                        className="text-sm font-medium text-gray-700"
                    >
                        {label}
                    </label>
                )}
                <textarea
                    id={id}
                    ref={ref}
                    className={cn(
                        "w-full px-3 py-2 text-sm bg-gray-50 border rounded-xl outline-none transition-colors resize-none",
                        error
                            ? "border-red-400 focus:border-red-500 focus:bg-white"
                            : "border-gray-200 focus:border-primary-400 focus:bg-white",
                        className,
                    )}
                    {...props}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
        );
    },
);
