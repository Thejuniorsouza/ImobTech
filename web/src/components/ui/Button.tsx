import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
    primary: "bg-primary-700 hover:bg-primary-800 text-white shadow-sm",
    secondary: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700",
    ghost: "hover:bg-gray-100 text-gray-600",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm",
};

const sizeClasses: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2",
};

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    children,
    className,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center font-medium rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed",
                variantClasses[variant],
                sizeClasses[size],
                className,
            )}
            {...props}
        >
            {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                icon
            )}
            {children}
        </button>
    );
}
