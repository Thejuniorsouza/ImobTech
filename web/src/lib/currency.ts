export function centsToDisplay(cents: number): string {
    return (cents / 100).toFixed(2);
}

export function displayToCents(value: string): number {
    return Math.round(parseFloat(value.replace(",", ".")) * 100);
}

export function formatBRL(cents: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(cents / 100);
}

export function formatBRLCompact(cents: number): string {
    const value = cents / 100;
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
    return formatBRL(cents);
}
