export enum UserRole {
    Owner = "owner",
    Tenant = "tenant",
}

export enum PropertyType {
    House = "house",
    Apartment = "apartment",
    Commercial = "commercial",
    Land = "land",
}

export enum PropertyStatus {
    Vacant = "vacant",
    Rented = "rented",
}

export enum ContractStatus {
    Active = "active",
    Terminated = "terminated",
    Expired = "expired",
}

export enum InvoiceStatus {
    Pending = "pending",
    Paid = "paid",
    Overdue = "overdue",
    Cancelled = "cancelled",
}

export enum InvoiceType {
    Rent = "rent",
    Deposit = "deposit",
    Iptu = "iptu",
    Condo = "condo",
    Other = "other",
    Fine = "fine",
}

export enum InspectionType {
    Entry = "entry",
    Exit = "exit",
}

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
    [PropertyType.House]: "Casa",
    [PropertyType.Apartment]: "Apartamento",
    [PropertyType.Commercial]: "Comercial",
    [PropertyType.Land]: "Terreno",
};

export const PROPERTY_STATUS_LABEL: Record<PropertyStatus, string> = {
    [PropertyStatus.Vacant]: "Vago",
    [PropertyStatus.Rented]: "Alugado",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
    [ContractStatus.Active]: "Ativo",
    [ContractStatus.Terminated]: "Encerrado",
    [ContractStatus.Expired]: "Expirado",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
    [InvoiceStatus.Pending]: "Pendente",
    [InvoiceStatus.Paid]: "Pago",
    [InvoiceStatus.Overdue]: "Atrasado",
    [InvoiceStatus.Cancelled]: "Cancelado",
};

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
    [InvoiceType.Rent]: "Aluguel",
    [InvoiceType.Deposit]: "Caução",
    [InvoiceType.Iptu]: "IPTU",
    [InvoiceType.Condo]: "Condomínio",
    [InvoiceType.Other]: "Outro",
    [InvoiceType.Fine]: "Multa rescisória",
};
