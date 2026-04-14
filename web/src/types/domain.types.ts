import {
    PropertyStatus,
    PropertyType,
    ContractStatus,
    InvoiceStatus,
    InvoiceType,
    InspectionType,
    UserRole,
} from "../lib/constants";

export interface Profile {
    id: string;
    full_name: string;
    cpf: string;
    phone: string | null;
    email: string;
    rg: string | null;
    address: string | null;
    nationality: string | null;
    marital_status: string | null;
    profession: string | null;
    role: UserRole;
    created_at: string;
    updated_at: string;
}

export interface Property {
    id: string;
    owner_id: string;
    address_street: string;
    address_number: string;
    address_complement: string | null;
    address_neighborhood: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    property_type: PropertyType;
    area_sqm: number;
    bedrooms: number | null;
    bathrooms: number | null;
    iptu_monthly_cents: number;
    condo_monthly_cents: number;
    status: PropertyStatus;
    photo_urls: string[];
    registration_number: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface ContractTemplate {
    id: string;
    owner_id: string | null;
    name: string;
    body: string;
    is_system: boolean;
    created_at: string;
}

export interface Contract {
    id: string;
    owner_id: string;
    tenant_id: string;
    property_id: string;
    template_id: string | null;
    tenant_name: string;
    tenant_cpf: string;
    tenant_rg: string | null;
    tenant_address: string | null;
    tenant_email: string | null;
    tenant_phone: string | null;
    tenant_nationality: string | null;
    tenant_marital_status: string | null;
    tenant_profession: string | null;
    rent_amount_cents: number;
    deposit_amount_cents: number;
    due_day: number;
    start_date: string;
    end_date: string;
    status: ContractStatus;
    pdf_storage_path: string | null;
    created_at: string;
    updated_at: string;
    // joins
    property?: Property;
}

export interface Invoice {
    id: string;
    contract_id: string;
    competencia_month: string; // "YYYY-MM-01"
    due_date: string;
    amount_cents: number;
    invoice_type: InvoiceType;
    status: InvoiceStatus;
    paid_at: string | null;
    created_at: string;
    updated_at: string;
    // joins
    contract?: Contract;
}

export interface InvoiceAdjustment {
    id: string;
    invoice_id: string;
    reason: string;
    amount_cents: number;
    created_at: string;
}

export interface Inspection {
    id: string;
    contract_id: string;
    type: InspectionType;
    notes: string | null;
    inspection_date: string;
    created_at: string;
    photos?: InspectionPhoto[];
}

export interface InspectionPhoto {
    id: string;
    inspection_id: string;
    storage_path: string;
    room_name: string | null;
    description: string | null;
    created_at: string;
    url?: string;
}

export interface Document {
    id: string;
    contract_id: string;
    uploader_id: string;
    storage_path: string;
    file_name: string;
    document_type: string;
    created_at: string;
    uploader?: Profile;
}

export interface AuditLog {
    id: string;
    user_id: string;
    table_name: string;
    record_id: string;
    action: string;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    created_at: string;
}
