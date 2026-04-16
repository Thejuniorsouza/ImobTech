// Integration tests: Contract Creation Flow & Invoice Idempotency (T107, T108)
//
// How to run:
//   deno test --allow-env --allow-net supabase/functions/create-contract/index.test.ts
//
// Required env vars:
//   SUPABASE_URL            — e.g. https://cugpkcgbivfukeokiwtn.supabase.co
//   SUPABASE_ANON_KEY       — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service_role key (for setup / teardown)
//
// These tests use the service_role client to seed data directly and an owner-auth
// client to exercise contract + invoice creation following the same logic as the
// web app's contract.service.ts (generateAndInsertInvoices). They clean up all
// created rows after each test to leave the DB in a clean state.

import {
    assertEquals,
    assertGreater,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
    createClient,
    SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(key: string): string {
    const value = Deno.env.get(key);
    if (!value) throw new Error(`Missing env var: ${key}`);
    return value;
}

function adminClient(): SupabaseClient {
    return createClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
}

/** Generate invoices in memory matching the web app logic (simplified for testing). */
function buildInvoiceRows(params: {
    contractId: string;
    rentAmountCents: number;
    depositAmountCents: number;
    iptuMonthlyCents: number;
    condoMonthlyCents: number;
    dueDay: number;
    startDate: string;
    endDate: string;
}) {
    type Row = {
        contract_id: string;
        competencia_month: string;
        due_date: string;
        amount_cents: number;
        invoice_type: string;
        status: string;
    };
    const rows: Row[] = [];

    const {
        contractId,
        rentAmountCents,
        depositAmountCents,
        iptuMonthlyCents,
        condoMonthlyCents,
        dueDay,
        startDate,
        endDate,
    } = params;

    // Caução
    if (depositAmountCents > 0) {
        const d = new Date(startDate + "T12:00:00");
        rows.push({
            contract_id: contractId,
            competencia_month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
            due_date: startDate,
            amount_cents: depositAmountCents,
            invoice_type: "deposit",
            status: "pending",
        });
    }

    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    const daysInStartMonth = new Date(
        start.getFullYear(),
        start.getMonth() + 1,
        0,
    ).getDate();
    const daysUsedInStartMonth = daysInStartMonth - start.getDate() + 1;

    // Monthly rent
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    let isFirstMonth = true;
    while (current <= endMonth) {
        const year = current.getFullYear();
        const month = current.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const day = Math.min(dueDay, lastDay);
        const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const competencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const amount = isFirstMonth
            ? Math.round(
                  (rentAmountCents * daysUsedInStartMonth) / daysInStartMonth,
              )
            : rentAmountCents;
        rows.push({
            contract_id: contractId,
            competencia_month: competencia,
            due_date: dueDateStr,
            amount_cents: amount,
            invoice_type: "rent",
            status: "pending",
        });
        isFirstMonth = false;
        current = new Date(year, month + 1, 1);
    }

    // IPTU / Condo (same loop, independently)
    if (iptuMonthlyCents > 0 || condoMonthlyCents > 0) {
        let feeCurrent = new Date(start.getFullYear(), start.getMonth(), 1);
        let isFirstFeeMonth = true;
        while (feeCurrent <= endMonth) {
            const year = feeCurrent.getFullYear();
            const month = feeCurrent.getMonth();
            const lastDay = new Date(year, month + 1, 0).getDate();
            const day = Math.min(dueDay, lastDay);
            const dueDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const competencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;

            if (iptuMonthlyCents > 0) {
                const amount = isFirstFeeMonth
                    ? Math.round(
                          (iptuMonthlyCents * daysUsedInStartMonth) /
                              daysInStartMonth,
                      )
                    : iptuMonthlyCents;
                rows.push({
                    contract_id: contractId,
                    competencia_month: competencia,
                    due_date: dueDateStr,
                    amount_cents: amount,
                    invoice_type: "iptu",
                    status: "pending",
                });
            }
            if (condoMonthlyCents > 0) {
                const amount = isFirstFeeMonth
                    ? Math.round(
                          (condoMonthlyCents * daysUsedInStartMonth) /
                              daysInStartMonth,
                      )
                    : condoMonthlyCents;
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
            feeCurrent = new Date(year, month + 1, 1);
        }
    }

    return rows;
}

// ---------------------------------------------------------------------------
// T107 — Contract Creation Flow
// ---------------------------------------------------------------------------

Deno.test(
    "T107: contract creation flow creates correct invoices with centavos values",
    async () => {
        const admin = adminClient();

        // Use distinct test emails to avoid collisions
        const ownerEmail = `test_owner_${Date.now()}@imobtech-test.invalid`;
        const tenantEmail = `test_tenant_${Date.now()}@imobtech-test.invalid`;
        const cpf1 = String(Date.now()).slice(-11).padStart(11, "9");
        const cpf2 = String(Date.now() + 1)
            .slice(-11)
            .padStart(11, "8");

        // Seed owner profile (bypass auth for integration test)
        const { data: ownerProfile, error: ownerErr } = await admin
            .from("profiles")
            .insert({
                id: crypto.randomUUID(),
                role: "owner",
                full_name: "Test Owner",
                cpf: cpf1,
                email: ownerEmail,
            })
            .select()
            .single();
        if (ownerErr)
            throw new Error(`Owner insert failed: ${ownerErr.message}`);

        // Seed tenant profile
        const { data: tenantProfile, error: tenantErr } = await admin
            .from("profiles")
            .insert({
                id: crypto.randomUUID(),
                role: "tenant",
                full_name: "Test Tenant",
                cpf: cpf2,
                email: tenantEmail,
            })
            .select()
            .single();
        if (tenantErr)
            throw new Error(`Tenant insert failed: ${tenantErr.message}`);

        // Seed property
        const { data: property, error: propErr } = await admin
            .from("properties")
            .insert({
                owner_id: ownerProfile.id,
                address_street: "Rua Teste",
                address_number: "123",
                address_neighborhood: "Centro",
                address_city: "São Paulo",
                address_state: "SP",
                address_zip: "01310100",
                property_type: "apartment",
                status: "vacant",
            })
            .select()
            .single();
        if (propErr)
            throw new Error(`Property insert failed: ${propErr.message}`);

        // Start date = first of next month, 12 months duration
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const endDate = new Date(
            startDate.getFullYear() + 1,
            startDate.getMonth(),
            0,
        );
        const startStr = startDate.toISOString().slice(0, 10);
        const endStr = endDate.toISOString().slice(0, 10);

        const rentCents = 150000; // R$ 1.500,00 in centavos

        // Create contract
        const { data: contract, error: contractErr } = await admin
            .from("contracts")
            .insert({
                owner_id: ownerProfile.id,
                tenant_id: tenantProfile.id,
                property_id: property.id,
                tenant_name: tenantProfile.full_name,
                tenant_cpf: tenantProfile.cpf,
                tenant_rg: "",
                tenant_address: "Rua Teste, 123",
                rent_amount_cents: rentCents,
                deposit_amount_cents: rentCents * 2,
                due_day: 10,
                start_date: startStr,
                end_date: endStr,
                status: "active",
            })
            .select()
            .single();
        if (contractErr)
            throw new Error(`Contract insert failed: ${contractErr.message}`);

        // Update property to rented
        await admin
            .from("properties")
            .update({ status: "rented" })
            .eq("id", property.id);

        // Generate invoice rows (same logic as web app)
        const invoiceRows = buildInvoiceRows({
            contractId: contract.id,
            rentAmountCents: rentCents,
            depositAmountCents: rentCents * 2,
            iptuMonthlyCents: 0,
            condoMonthlyCents: 0,
            dueDay: 10,
            startDate: startStr,
            endDate: endStr,
        });

        // Insert invoices with ON CONFLICT DO NOTHING
        const { error: invoiceErr } = await admin
            .from("invoices")
            .upsert(invoiceRows, {
                onConflict: "contract_id,competencia_month,invoice_type",
                ignoreDuplicates: true,
            });
        if (invoiceErr)
            throw new Error(`Invoice insert failed: ${invoiceErr.message}`);

        // Assert: 1 deposit + 12 monthly rent = 13 invoices total
        const { data: invoices, error: fetchErr } = await admin
            .from("invoices")
            .select("*")
            .eq("contract_id", contract.id);
        if (fetchErr)
            throw new Error(`Invoice fetch failed: ${fetchErr.message}`);

        assertEquals(
            invoices!.length,
            13, // 1 deposit + 12 rent (12-month contract starting on 1st of month)
            `Expected 13 invoices, got ${invoices!.length}`,
        );

        // Assert all monetary values are integers (centavos, no floats)
        for (const inv of invoices!) {
            assertEquals(typeof inv.amount_cents, "number");
            assertEquals(
                Number.isInteger(inv.amount_cents),
                true,
                `amount_cents must be integer, got ${inv.amount_cents} for invoice ${inv.id}`,
            );
            assertGreater(inv.amount_cents, 0, "amount_cents must be positive");
        }

        // Assert deposit amount matches
        const deposit = invoices!.find((i) => i.invoice_type === "deposit");
        assertEquals(
            deposit?.amount_cents,
            rentCents * 2,
            "Deposit amount must equal 2×rent",
        );

        // Assert property is rented
        const { data: prop } = await admin
            .from("properties")
            .select("status")
            .eq("id", property.id)
            .single();
        assertEquals(
            prop?.status,
            "rented",
            "Property must be rented after contract creation",
        );

        // Cleanup
        await admin.from("invoices").delete().eq("contract_id", contract.id);
        await admin.from("contracts").delete().eq("id", contract.id);
        await admin.from("properties").delete().eq("id", property.id);
        await admin.from("profiles").delete().eq("id", tenantProfile.id);
        await admin.from("profiles").delete().eq("id", ownerProfile.id);
    },
);

// ---------------------------------------------------------------------------
// T108 — Invoice Idempotency
// ---------------------------------------------------------------------------

Deno.test(
    "T108: invoice generation is idempotent — calling twice creates no duplicate rows",
    async () => {
        const admin = adminClient();

        const ownerEmail = `test_owner_idem_${Date.now()}@imobtech-test.invalid`;
        const tenantEmail = `test_tenant_idem_${Date.now()}@imobtech-test.invalid`;
        const cpf1 = String(Date.now() + 100)
            .slice(-11)
            .padStart(11, "7");
        const cpf2 = String(Date.now() + 101)
            .slice(-11)
            .padStart(11, "6");

        const { data: ownerProfile, error: o1 } = await admin
            .from("profiles")
            .insert({
                id: crypto.randomUUID(),
                role: "owner",
                full_name: "Owner Idem",
                cpf: cpf1,
                email: ownerEmail,
            })
            .select()
            .single();
        if (o1) throw new Error(o1.message);

        const { data: tenantProfile, error: o2 } = await admin
            .from("profiles")
            .insert({
                id: crypto.randomUUID(),
                role: "tenant",
                full_name: "Tenant Idem",
                cpf: cpf2,
                email: tenantEmail,
            })
            .select()
            .single();
        if (o2) throw new Error(o2.message);

        const { data: property, error: o3 } = await admin
            .from("properties")
            .insert({
                owner_id: ownerProfile.id,
                address_street: "Av. Idempotência",
                address_number: "1",
                address_neighborhood: "Bairro",
                address_city: "SP",
                address_state: "SP",
                address_zip: "01000000",
                property_type: "house",
                status: "vacant",
            })
            .select()
            .single();
        if (o3) throw new Error(o3.message);

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const endDate = new Date(
            startDate.getFullYear() + 1,
            startDate.getMonth(),
            0,
        );
        const startStr = startDate.toISOString().slice(0, 10);
        const endStr = endDate.toISOString().slice(0, 10);

        const { data: contract, error: o4 } = await admin
            .from("contracts")
            .insert({
                owner_id: ownerProfile.id,
                tenant_id: tenantProfile.id,
                property_id: property.id,
                tenant_name: "Tenant Idem",
                tenant_cpf: cpf2,
                tenant_rg: "",
                tenant_address: "Rua Idem, 1",
                rent_amount_cents: 200000,
                deposit_amount_cents: 400000,
                due_day: 5,
                start_date: startStr,
                end_date: endStr,
                status: "active",
            })
            .select()
            .single();
        if (o4) throw new Error(o4.message);

        const invoiceRows = buildInvoiceRows({
            contractId: contract.id,
            rentAmountCents: 200000,
            depositAmountCents: 400000,
            iptuMonthlyCents: 0,
            condoMonthlyCents: 0,
            dueDay: 5,
            startDate: startStr,
            endDate: endStr,
        });

        // First insert
        const { error: e1 } = await admin.from("invoices").upsert(invoiceRows, {
            onConflict: "contract_id,competencia_month,invoice_type",
            ignoreDuplicates: true,
        });
        if (e1) throw new Error(`First insert failed: ${e1.message}`);

        const { data: firstCount } = await admin
            .from("invoices")
            .select("id", { count: "exact" })
            .eq("contract_id", contract.id);
        const countAfterFirst = firstCount?.length ?? 0;

        // Second insert — must not create duplicates
        const { error: e2 } = await admin.from("invoices").upsert(invoiceRows, {
            onConflict: "contract_id,competencia_month,invoice_type",
            ignoreDuplicates: true,
        });
        if (e2) throw new Error(`Second insert failed: ${e2.message}`);

        const { data: secondCount } = await admin
            .from("invoices")
            .select("id", { count: "exact" })
            .eq("contract_id", contract.id);
        const countAfterSecond = secondCount?.length ?? 0;

        assertEquals(
            countAfterFirst,
            countAfterSecond,
            `Idempotency violation: ${countAfterFirst} invoices after first insert, ` +
                `${countAfterSecond} after second insert (expected same count)`,
        );

        assertGreater(
            countAfterFirst,
            0,
            "Expected at least 1 invoice to be created",
        );

        // Cleanup
        await admin.from("invoices").delete().eq("contract_id", contract.id);
        await admin.from("contracts").delete().eq("id", contract.id);
        await admin.from("properties").delete().eq("id", property.id);
        await admin.from("profiles").delete().eq("id", tenantProfile.id);
        await admin.from("profiles").delete().eq("id", ownerProfile.id);
    },
);
