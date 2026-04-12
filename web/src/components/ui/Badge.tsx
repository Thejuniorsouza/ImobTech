import { cn } from "../../lib/utils";

type BadgeVariant =
    | "active"
    | "paid"
    | "pending"
    | "overdue"
    | "vacant"
    | "rented"
    | "system"
    | "gray";

const variants: Record<BadgeVariant, string> = {
    active: "bg-emerald-100 text-emerald-800",
    paid: "bg-emerald-100 text-emerald-800",
    pending: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-700",
    vacant: "bg-sky-100 text-sky-700",
    rented: "bg-primary-100 text-primary-700",
    system: "bg-purple-100 text-purple-700",
    gray: "bg-gray-100 text-gray-600",
};

interface BadgeProps {
    variant?: BadgeVariant;
    className?: string;
    children: React.ReactNode;
}

export function Badge({ variant = "gray", className, children }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-none",
                variants[variant],
                className,
            )}
        >
            {children}
        </span>
    );
}
