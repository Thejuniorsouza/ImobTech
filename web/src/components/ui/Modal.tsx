import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal({
    open,
    onClose,
    title,
    children,
    className,
}: ModalProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                onClick={onClose}
            />
            <div
                className={cn(
                    "relative bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-y-auto",
                    className ?? "max-w-lg mx-4",
                )}
            >
                {title && (
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                        <h2 className="text-base font-semibold text-gray-900">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
