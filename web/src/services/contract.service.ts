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
            .neq("status", "cancelled")
            .order("due_date", { ascending: true });
        if (error) throw error;
        return (data ?? []) as Invoice[];
    },

    async markInvoicePaid(invoiceId: string, paidAt: string): Promise<void> {
        const { error } = await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: paidAt })
            .eq("id", invoiceId);
        if (error) throw error;
    },

    async deleteInvoice(invoiceId: string): Promise<void> {
        const { error } = await supabase
            .from("invoices")
            .delete()
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
            /** Tenant physical move-in date. Defaults to start_date if not provided. */
            entry_date?: string;
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

        const entryDateStr = params.entry_date || params.start_date;

        // Caução — due on entry_date, competencia = entry month
        if (params.deposit_amount_cents > 0) {
            const d = new Date(entryDateStr + "T12:00:00");
            const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
            rows.push({
                contract_id: contractId,
                competencia_month: competencia,
                due_date: entryDateStr,
                amount_cents: params.deposit_amount_cents,
                invoice_type: "deposit",
                status: "pending",
            });
        }

        // Monthly invoices
        const startDate = new Date(entryDateStr + "T12:00:00");
        const endDate = new Date(params.end_date + "T12:00:00");
        const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        // Proration helpers for IPTU/condo first month
        const daysInStartMonth = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            0,
        ).getDate();
        const daysUsedInStartMonth = daysInStartMonth - startDate.getDate() + 1;

        // IPTU / Condo: generate from entry month (first = prorated, rest = full)
        if (params.iptu_monthly_cents > 0 || params.condo_monthly_cents > 0) {
            let feeCurrent = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                1,
            );
            let isFirstFeeMonth = true;
            while (feeCurrent <= endMonth) {
                const year = feeCurrent.getFullYear();
                const month = feeCurrent.getMonth();
                const lastDay = new Date(year, month + 1, 0).getDate();
                const day = Math.min(params.due_day, lastDay);
                const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const competencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;

                if (params.iptu_monthly_cents > 0) {
                    const amount = isFirstFeeMonth
                        ? Math.round(
                              (params.iptu_monthly_cents *
                                  daysUsedInStartMonth) /
                                  daysInStartMonth,
                          )
                        : params.iptu_monthly_cents;
                    rows.push({
                        contract_id: contractId,
                        competencia_month: competencia,
                        due_date: dueDateStr,
                        amount_cents: amount,
                        invoice_type: "iptu",
                        status: "pending",
                    });
                }
                if (params.condo_monthly_cents > 0) {
                    const amount = isFirstFeeMonth
                        ? Math.round(
                              (params.condo_monthly_cents *
                                  daysUsedInStartMonth) /
                                  daysInStartMonth,
                          )
                        : params.condo_monthly_cents;
                    rows.push({
                        contract_id: contractId,
                        competencia_month: competencia,
                        due_date: dueDateStr,
                        amount_cents: amount,
                        invoice_type: "condo",
                        status: "pending",
                    });
                }
                isFirstFeeMonth = false;
                feeCurrent.setMonth(feeCurrent.getMonth() + 1);
            }
        }

        // Rent: starts from month 2 (30 days after entry)
        let rentCurrent = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            1,
        );
        while (rentCurrent <= endMonth) {
            const year = rentCurrent.getFullYear();
            const month = rentCurrent.getMonth();
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
            rentCurrent.setMonth(rentCurrent.getMonth() + 1);
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
            paid_at?: string | null;
        },
    ): Promise<void> {
        const { error } = await supabase
            .from("invoices")
            .update(data)
            .eq("id", id);
        if (error) throw error;
    },

    async terminateContract(contractId: string): Promise<{
        fine_cents: number;
        remaining_days: number;
        total_days: number;
    }> {
        const { data, error } = await supabase.functions.invoke(
            "terminate-contract",
            { body: { contract_id: contractId } },
        );
        if (error) throw error;
        return data as {
            fine_cents: number;
            remaining_months: number;
            total_months: number;
        };
    },

    /** Preview penalty amount without calling the edge function */
    calcTerminationFine(
        rentAmountCents: number,
        startDate: string,
        endDate: string,
    ): { fine_cents: number; remaining_months: number; total_months: number } {
        const today = new Date();
        const start = new Date(startDate + "T12:00:00");
        const end = new Date(endDate + "T12:00:00");
        const totalMonths = Math.max(
            1,
            (end.getFullYear() - start.getFullYear()) * 12 +
                (end.getMonth() - start.getMonth()),
        );
        const remainingMonths = Math.min(
            Math.max(
                0,
                (end.getFullYear() - today.getFullYear()) * 12 +
                    (end.getMonth() - today.getMonth()),
            ),
            totalMonths,
        );
        const fine_cents = Math.round(
            (3 * rentAmountCents * remainingMonths) / totalMonths,
        );
        return {
            fine_cents,
            remaining_months: remainingMonths,
            total_months: totalMonths,
        };
    },
};
