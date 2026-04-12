import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: boolean;
}

export function Card({
    className,
    padding = true,
    children,
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                "bg-white rounded-2xl shadow-sm border border-gray-100",
                padding && "p-5",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex items-center justify-between mb-4", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardTitle({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
    return (
        <h3
            className={cn("text-[15px] font-semibold text-gray-900", className)}
            {...props}
        >
            {children}
        </h3>
    );
}
