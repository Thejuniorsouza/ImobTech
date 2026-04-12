// Edge Function: dashboard-metrics
// Returns aggregated financial metrics for the authenticated owner.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import type { DashboardMetricsResponse } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header." }),
                {
                    status: 401,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } },
        );

        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized." }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const now = new Date();
        const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const thirtyDaysFromNow = new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000,
        )
            .toISOString()
            .split("T")[0];

        // Active contracts
        const { data: activeContracts, error: contractsError } =
            await supabaseClient
                .from("contracts")
                .select("id, due_day, tenant_name, property_id")
                .eq("owner_id", user.id)
                .eq("status", "active");

        if (contractsError) throw contractsError;

        const totalActiveContracts = activeContracts?.length ?? 0;

        // Contracts expiring soon (within 30 days)
        const { count: contractsExpiringSoon } = await supabaseClient
            .from("contracts")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", user.id)
            .eq("status", "active")
            .lte("end_date", thirtyDaysFromNow);

        // Current month invoices
        const contractIds = (activeContracts ?? []).map(
            (c: { id: string }) => c.id,
        );

        let totalReceivableCents = 0;
        let totalReceivedCents = 0;
        const propertiesByDueDayMap = new Map<
            number,
            Array<{
                contract_id: string;
                property_address: string;
                tenant_name: string;
                invoice_status: string | null;
                invoice_amount_cents: number | null;
            }>
        >();

        if (contractIds.length > 0) {
            const { data: invoices } = await supabaseClient
                .from("invoices")
                .select("contract_id, invoice_type, amount_cents, status")
                .in("contract_id", contractIds)
                .eq("invoice_type", "rent")
                .eq("competencia_month", currentMonthStart);

            // Property details for address
            const { data: properties } = await supabaseClient
                .from("properties")
                .select(
                    "id, address_street, address_number, address_neighborhood, address_city",
                )
                .in(
                    "id",
                    (activeContracts ?? []).map(
                        (c: { property_id: string }) => c.property_id,
                    ),
                );

            const propertyMap = new Map(
                (properties ?? []).map(
                    (p: {
                        id: string;
                        address_street: string;
                        address_number: string;
                        address_neighborhood: string;
                        address_city: string;
                    }) => [
                        p.id,
                        `${p.address_street}, ${p.address_number} - ${p.address_neighborhood}, ${p.address_city}`,
                    ],
                ),
            );

            const invoiceMap = new Map(
                (invoices ?? []).map(
                    (inv: {
                        contract_id: string;
                        amount_cents: number;
                        status: string;
                    }) => [
                        inv.contract_id,
                        { amount_cents: inv.amount_cents, status: inv.status },
                    ],
                ),
            );

            for (const contract of activeContracts ?? []) {
                const invoice = invoiceMap.get(contract.id);
                const address =
                    propertyMap.get(contract.property_id) ??
                    "Endereço não disponível";

                if (invoice) {
                    totalReceivableCents += invoice.amount_cents;
                    if (invoice.status === "paid")
                        totalReceivedCents += invoice.amount_cents;
                }

                const dayGroup =
                    propertiesByDueDayMap.get(contract.due_day) ?? [];
                dayGroup.push({
                    contract_id: contract.id,
                    property_address: address,
                    tenant_name: contract.tenant_name,
                    invoice_status: invoice?.status ?? null,
                    invoice_amount_cents: invoice?.amount_cents ?? null,
                });
                propertiesByDueDayMap.set(contract.due_day, dayGroup);
            }
        }

        const propertiesByDueDay = Array.from(propertiesByDueDayMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([due_day, properties]) => ({ due_day, properties }));

        const response: DashboardMetricsResponse = {
            total_active_contracts: totalActiveContracts,
            total_receivable_cents: totalReceivableCents,
            total_received_cents: totalReceivedCents,
            contracts_expiring_soon: contractsExpiringSoon ?? 0,
            properties_by_due_day: propertiesByDueDay,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("dashboard-metrics error:", err);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor." }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});
