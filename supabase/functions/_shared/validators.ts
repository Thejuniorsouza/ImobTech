// Zod-like validators for Edge Function inputs (using Deno std).
// Lightweight validation without external deps.

export interface ValidationError {
    field: string;
    message: string;
}

export function validateCreateContract(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    if (typeof data !== "object" || data === null) {
        return [
            { field: "body", message: "Request body must be a JSON object." },
        ];
    }
    const body = data as Record<string, unknown>;

    if (!body.property_id || typeof body.property_id !== "string") {
        errors.push({
            field: "property_id",
            message: "property_id is required (UUID string).",
        });
    }
    if (!body.tenant_email || typeof body.tenant_email !== "string") {
        errors.push({
            field: "tenant_email",
            message: "tenant_email is required.",
        });
    }
    if (!body.tenant_name || typeof body.tenant_name !== "string") {
        errors.push({
            field: "tenant_name",
            message: "tenant_name is required.",
        });
    }
    if (
        !body.tenant_cpf ||
        typeof body.tenant_cpf !== "string" ||
        !/^\d{11}$/.test(body.tenant_cpf)
    ) {
        errors.push({
            field: "tenant_cpf",
            message: "tenant_cpf must be exactly 11 digits.",
        });
    }
    if (
        typeof body.rent_amount_cents !== "number" ||
        body.rent_amount_cents <= 0
    ) {
        errors.push({
            field: "rent_amount_cents",
            message: "rent_amount_cents must be a positive integer (centavos).",
        });
    }
    if (
        typeof body.deposit_amount_cents !== "number" ||
        body.deposit_amount_cents < 0
    ) {
        errors.push({
            field: "deposit_amount_cents",
            message: "deposit_amount_cents must be a non-negative integer.",
        });
    }
    if (
        typeof body.due_day !== "number" ||
        !Number.isInteger(body.due_day) ||
        body.due_day < 1 ||
        body.due_day > 28
    ) {
        errors.push({
            field: "due_day",
            message: "due_day must be an integer between 1 and 28.",
        });
    }
    if (
        !body.start_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.start_date as string)
    ) {
        errors.push({
            field: "start_date",
            message: "start_date must be an ISO date string (YYYY-MM-DD).",
        });
    }
    if (
        !body.end_date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.end_date as string)
    ) {
        errors.push({
            field: "end_date",
            message: "end_date must be an ISO date string (YYYY-MM-DD).",
        });
    }
    if (
        body.start_date &&
        body.end_date &&
        new Date(body.end_date as string) <= new Date(body.start_date as string)
    ) {
        errors.push({
            field: "end_date",
            message: "end_date must be after start_date.",
        });
    }

    return errors;
}

export function validateTerminateContract(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    if (typeof data !== "object" || data === null) {
        return [
            { field: "body", message: "Request body must be a JSON object." },
        ];
    }
    const body = data as Record<string, unknown>;
    if (!body.contract_id || typeof body.contract_id !== "string") {
        errors.push({
            field: "contract_id",
            message: "contract_id is required (UUID string).",
        });
    }
    return errors;
}
