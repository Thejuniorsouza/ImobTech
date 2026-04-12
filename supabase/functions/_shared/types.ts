// Shared TypeScript types for Supabase Edge Functions.
// These mirror the domain types defined in the PostgreSQL schema.

export type UserRole = "owner" | "tenant";
export type PropertyType = "house" | "apartment" | "commercial";
export type PropertyStatus = "vacant" | "rented";
export type ContractStatus = "active" | "terminated";
export type InvoiceStatus = "pending" | "paid" | "overdue";
export type InvoiceType = "rent" | "deposit" | "iptu" | "condo";
export type InspectionType = "entry" | "exit";
export type AdjustmentType = "refund" | "correction";

export interface CreateContractRequest {
    property_id: string;
    template_id?: string;
    // Tenant data
    tenant_email: string;
    tenant_name: string;
    tenant_cpf: string;
    tenant_rg?: string;
    tenant_address?: string;
    // Contract terms
    rent_amount_cents: number;
    deposit_amount_cents: number;
    due_day: number;
    start_date: string; // ISO date string
    end_date: string; // ISO date string
}

export interface CreateContractResponse {
    contract_id: string;
    pdf_storage_path: string;
    invoices_created: number;
}

export interface TerminateContractRequest {
    contract_id: string;
}

export interface DashboardMetricsResponse {
    total_active_contracts: number;
    total_receivable_cents: number;
    total_received_cents: number;
    contracts_expiring_soon: number;
    properties_by_due_day: Array<{
        due_day: number;
        properties: Array<{
            contract_id: string;
            property_address: string;
            tenant_name: string;
            invoice_status: InvoiceStatus | null;
            invoice_amount_cents: number | null;
        }>;
    }>;
}

export interface GenerateAdRequest {
    property_id: string;
}

export interface GenerateAdResponse {
    olx: { title: string; description: string };
    zap: { title: string; description: string };
    vivareal: { title: string; description: string };
}

/** Allowed template variable placeholders to prevent injection. */
export const ALLOWED_PLACEHOLDERS = new Set([
    "owner_name",
    "owner_cpf",
    "owner_address",
    "tenant_name",
    "tenant_cpf",
    "tenant_rg",
    "tenant_address",
    "property_address",
    "property_city",
    "contract_duration_months",
    "start_date",
    "end_date",
    "due_day",
    "rent_amount",
    "deposit_amount",
    "iptu_monthly",
    "condo_monthly",
    "contract_date",
]);
