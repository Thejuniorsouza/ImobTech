import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { CalendarDays, X } from "lucide-react";

interface DatePickerProps {
    label?: string;
    id?: string;
    value: string; // "YYYY-MM-DD"
    onChange: (value: string) => void;
    required?: boolean;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
}

function parseDate(value: string): Date | undefined {
    if (!value) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
    label,
    id,
    value,
    onChange,
    required,
    placeholder = "Selecionar data",
    minDate,
    maxDate,
}: DatePickerProps) {
    const [open, setOpen] = useState(false);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selected = parseDate(value);

    const displayValue = selected
        ? selected.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
          })
        : "";

    const handleOpen = useCallback(() => {
        if (buttonRef.current) {
            const r = buttonRef.current.getBoundingClientRect();
            setPopupPos({
                top: r.bottom + 4 + window.scrollY,
                left: r.left + window.scrollX,
                width: r.width,
            });
        }
        setOpen((v) => !v);
    }, []);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const t = e.target as Node;
            if (
                containerRef.current?.contains(t) ||
                popupRef.current?.contains(t)
            )
                return;
            setOpen(false);
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    return (
        <div className="flex flex-col gap-1.5" ref={containerRef}>
            {label && (
                <label
                    htmlFor={id}
                    className="text-sm font-medium text-gray-700"
                >
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    ref={buttonRef}
                    id={id}
                    type="button"
                    onClick={handleOpen}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm border rounded-xl bg-white transition-colors ${
                        open
                            ? "border-primary-500 ring-2 ring-primary-100"
                            : "border-gray-200 hover:border-primary-300"
                    }`}
                >
                    <span
                        className={
                            displayValue ? "text-gray-900" : "text-gray-400"
                        }
                    >
                        {displayValue || placeholder}
                    </span>
                    <div className="flex items-center gap-1">
                        {value && (
                            <span
                                role="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                }}
                                className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
                            >
                                <X className="w-3.5 h-3.5" />
                            </span>
                        )}
                        <CalendarDays className="w-4 h-4 text-gray-400" />
                    </div>
                </button>

                {open &&
                    createPortal(
                        <div
                            ref={popupRef}
                            style={{
                                position: "absolute",
                                top: popupPos.top,
                                left: popupPos.left,
                                minWidth: Math.max(popupPos.width, 280),
                                zIndex: 99999,
                            }}
                            className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3"
                        >
                            <DayPicker
                                mode="single"
                                selected={selected}
                                onSelect={(day: Date | undefined) => {
                                    if (day) {
                                        onChange(formatDate(day));
                                        setOpen(false);
                                    }
                                }}
                                locale={ptBR}
                                disabled={[
                                    ...(minDate ? [{ before: minDate }] : []),
                                    ...(maxDate ? [{ after: maxDate }] : []),
                                ]}
                                defaultMonth={selected ?? new Date()}
                                required={required}
                            />
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );
}
