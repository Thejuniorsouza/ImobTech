import { supabase } from "./supabase";
import type {
    Contract,
    ContractTemplate,
    Invoice,
} from "../types/domain.types";

export const contractService = {
    async listByOwner(ownerId: string): Promise<Contract[]> {
        const { data, error } = await supabase
            .from("contracts")
            .select(
                "*, property:properties(id,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,address_zip,property_type,area_sqm,bedrooms,bathrooms,parking_spaces,iptu_monthly_cents,condo_monthly_cents,registration_number,description)",
            )
            .eq("owner_id", ownerId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async listByTenant(tenantId: string): Promise<Contract[]> {
        const { data, error } = await supabase
            .from("contracts")
            .select("*, property:properties(*)")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async get(id: string): Promise<Contract | null> {
        const { data, error } = await supabase
            .from("contracts")
            .select("*, property:properties(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listTemplates(ownerId: string): Promise<ContractTemplate[]> {
        const { data, error } = await supabase
            .from("contract_templates")
            .select("*")
            .or(`owner_id.eq.${ownerId},is_system.eq.true`)
            .order("is_system", { ascending: false })
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async createTemplate(
        ownerId: string,
        name: string,
        body: string,
    ): Promise<ContractTemplate> {
        const { data, error } = await supabase
            .from("contract_templates")
            .insert({ owner_id: ownerId, name, body, is_system: false })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await supabase
            .from("contract_templates")
            .delete()
            .eq("id", id);
        if (error) throw error;
    },

    async updateTemplate(
        id: string,
        name: string,
        body: string,
    ): Promise<ContractTemplate> {
        const { data, error } = await supabase
            .from("contract_templates")
            .update({ name, body })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async listInvoicesByContract(contractId: string): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from("invoices")
            .select("*")
            .eq("contract_id", contractId)
            .order("due_date", { ascending: true });
        if (error) throw error;
        return data ?? [];
    },

    async listInvoicesByOwner(ownerId: string): Promise<Invoice[]> {
        const { data, error } = await supabase
            .from("invoices")
            .select(
                "*, contract:contracts!inner(owner_id,tenant_name,property:properties(address_street,address_number))",
            )
            .eq("contract.owner_id", ownerId)
            .order("due_date", { ascending: true });
        if (error) throw error;
        return data ?? [];
    },

    async markInvoicePaid(invoiceId: string): Promise<void> {
        const { error } = await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", invoiceId);
        if (error) throw error;
    },

    async createContract(data: {
        owner_id: string;
        tenant_id: string;
        property_id: string;
        template_id: string | null;
        tenant_name: string;
        tenant_cpf: string;
        tenant_rg: string;
        tenant_address: string;
        tenant_email?: string;
        tenant_phone?: string;
        tenant_nationality?: string;
        tenant_marital_status?: string;
        tenant_profession?: string;
        rent_amount_cents: number;
        deposit_amount_cents: number;
        due_day: number;
        start_date: string;
        end_date: string;
    }): Promise<Contract> {
        const { data: result, error } = await supabase
            .from("contracts")
            .insert({ ...data, status: "active", pdf_storage_path: null })
            .select()
            .single();
        if (error) throw error;
        return result;
    },

    /** Generates deposit invoice (if deposit > 0) + monthly rent/IPTU/condo invoices. */
    async generateAndInsertInvoices(
        contractId: string,
        params: {
            rent_amount_cents: number;
            deposit_amount_cents: number;
            iptu_monthly_cents: number;
            condo_monthly_cents: number;
            due_day: number;
            start_date: string;
            end_date: string;
        },
    ): Promise<void> {
        type Row = {
            contract_id: string;
            competencia_month: string;
            due_date: string;
            amount_cents: number;
            invoice_type: string;
            status: string;
        };
        const rows: Row[] = [];

        // Caução — due on start_date, competencia = start month
        if (params.deposit_amount_cents > 0) {
            const d = new Date(params.start_date + "T12:00:00");
            const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
            rows.push({
                contract_id: contractId,
                competencia_month: competencia,
                due_date: params.start_date,
                amount_cents: params.deposit_amount_cents,
                invoice_type: "deposit",
                status: "pending",
            });
        }

        // Monthly invoices
        const startDate = new Date(params.start_date + "T12:00:00");
        const endDate = new Date(params.end_date + "T12:00:00");
        let current = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            1,
        );
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= endMonth) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();
            const day = Math.min(params.due_day, lastDay);
            const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const competencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;

            rows.push({
                contract_id: contractId,
                competencia_month: competencia,
                due_date: dueDateStr,
                amount_cents: params.rent_amount_cents,
                invoice_type: "rent",
                status: "pending",
            });
            if (params.iptu_monthly_cents > 0) {
                rows.push({
                    contract_id: contractId,
                    competencia_month: competencia,
                    due_date: dueDateStr,
                    amount_cents: params.iptu_monthly_cents,
                    invoice_type: "iptu",
                    status: "pending",
                });
            }
            if (params.condo_monthly_cents > 0) {
                rows.push({
                    contract_id: contractId,
                    competencia_month: competencia,
                    due_date: dueDateStr,
                    amount_cents: params.condo_monthly_cents,
                    invoice_type: "condo",
                    status: "pending",
                });
            }
            current.setMonth(current.getMonth() + 1);
        }

        if (rows.length === 0) return;
        const { error } = await supabase.from("invoices").insert(rows);
        if (error) throw error;
    },

    async updateInvoice(
        id: string,
        data: {
            amount_cents?: number;
            due_date?: string;
            invoice_type?: string;
            status?: string;
        },
    ): Promise<void> {
        const { error } = await supabase
            .from("invoices")
            .update(data)
            .eq("id", id);
        if (error) throw error;
    },
};
