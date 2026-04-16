// Integration tests: Cross-tenant RLS Isolation (T109)
//
// How to run:
//   deno test --allow-env --allow-net supabase/tests/rls_isolation.test.ts
//
// Required env vars:
//   SUPABASE_URL              — e.g. https://cugpkcgbivfukeokiwtn.supabase.co
//   SUPABASE_ANON_KEY         — public anon key
//   SUPABASE_SERVICE_ROLE_KEY — service_role key (for seeding + teardown)
//
// These tests verify that RLS policies correctly prevent cross-owner data leakage.
// Owner B's RLS-authenticated client must return zero rows when querying
// contracts, invoices, and properties that belong to Owner A.

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
    createClient,
    SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

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

// ---------------------------------------------------------------------------
// T109 — Cross-tenant RLS isolation
// ---------------------------------------------------------------------------

Deno.test("T109: owner A's data is invisible to owner B via RLS", async () => {
    const admin = adminClient();
    const now = Date.now();

    // ------------------------------------------------------------------
    // Seed owner A and owner B using service_role (bypasses RLS)
    // We use real auth.users entries so that RLS policies via auth.uid() work.
    // ------------------------------------------------------------------
    const ownerAEmail = `rls_owner_a_${now}@imobtech-test.invalid`;
    const ownerBEmail = `rls_owner_b_${now}@imobtech-test.invalid`;
    const ownerAPassword = `Test@${now}A`;
    const ownerBPassword = `Test@${now}B`;

    // Create auth users
    const { data: authA, error: authAErr } = await admin.auth.admin.createUser({
        email: ownerAEmail,
        password: ownerAPassword,
        email_confirm: true,
        user_metadata: {
            full_name: "RLS Owner A",
            role: "owner",
            cpf: String(now).slice(-11).padStart(11, "1"),
        },
    });
    if (authAErr) throw new Error(`Create auth user A: ${authAErr.message}`);

    const { data: authB, error: authBErr } = await admin.auth.admin.createUser({
        email: ownerBEmail,
        password: ownerBPassword,
        email_confirm: true,
        user_metadata: {
            full_name: "RLS Owner B",
            role: "owner",
            cpf: String(now + 1)
                .slice(-11)
                .padStart(11, "2"),
        },
    });
    if (authBErr) throw new Error(`Create auth user B: ${authBErr.message}`);

    const ownerAId = authA.user!.id;
    const ownerBId = authB.user!.id;

    // Profiles (auto-created by trigger, but ensure they exist)
    await admin.from("profiles").upsert({
        id: ownerAId,
        role: "owner",
        full_name: "RLS Owner A",
        cpf: String(now).slice(-11).padStart(11, "1"),
        email: ownerAEmail,
    });
    await admin.from("profiles").upsert({
        id: ownerBId,
        role: "owner",
        full_name: "RLS Owner B",
        cpf: String(now + 1)
            .slice(-11)
            .padStart(11, "2"),
        email: ownerBEmail,
    });

    // Seed a tenant (needed as contract.tenant_id FK)
    const tenantCpf = String(now + 2)
        .slice(-11)
        .padStart(11, "3");
    const { data: authTenant, error: authTenantErr } =
        await admin.auth.admin.createUser({
            email: `rls_tenant_${now}@imobtech-test.invalid`,
            password: `Tenant@${now}`,
            email_confirm: true,
            user_metadata: {
                full_name: "RLS Tenant",
                role: "tenant",
                cpf: tenantCpf,
            },
        });
    if (authTenantErr)
        throw new Error(`Create tenant: ${authTenantErr.message}`);
    const tenantId = authTenant.user!.id;

    await admin.from("profiles").upsert({
        id: tenantId,
        role: "tenant",
        full_name: "RLS Tenant",
        cpf: tenantCpf,
        email: `rls_tenant_${now}@imobtech-test.invalid`,
    });

    // ------------------------------------------------------------------
    // Seed Owner A's property, contract, and invoice as service_role
    // ------------------------------------------------------------------
    const { data: propertyA, error: pAErr } = await admin
        .from("properties")
        .insert({
            owner_id: ownerAId,
            address_street: "Rua Owner A",
            address_number: "1",
            address_neighborhood: "Bairro A",
            address_city: "SP",
            address_state: "SP",
            address_zip: "01000001",
            property_type: "apartment",
            status: "rented",
        })
        .select()
        .single();
    if (pAErr) throw new Error(`Property A: ${pAErr.message}`);

    const startDate = new Date();
    startDate.setDate(1);
    const endDate = new Date(
        startDate.getFullYear() + 1,
        startDate.getMonth(),
        0,
    );

    const { data: contractA, error: cAErr } = await admin
        .from("contracts")
        .insert({
            owner_id: ownerAId,
            tenant_id: tenantId,
            property_id: propertyA.id,
            tenant_name: "RLS Tenant",
            tenant_cpf: tenantCpf,
            tenant_rg: "",
            tenant_address: "Rua Teste, 1",
            rent_amount_cents: 100000,
            deposit_amount_cents: 200000,
            due_day: 10,
            start_date: startDate.toISOString().slice(0, 10),
            end_date: endDate.toISOString().slice(0, 10),
            status: "active",
        })
        .select()
        .single();
    if (cAErr) throw new Error(`Contract A: ${cAErr.message}`);

    const { error: iAErr } = await admin.from("invoices").insert({
        contract_id: contractA.id,
        competencia_month: startDate.toISOString().slice(0, 7) + "-01",
        due_date: startDate.toISOString().slice(0, 10),
        amount_cents: 100000,
        invoice_type: "rent",
        status: "pending",
    });
    if (iAErr) throw new Error(`Invoice A: ${iAErr.message}`);

    // ------------------------------------------------------------------
    // Authenticate as Owner B and query Owner A's data
    // ------------------------------------------------------------------
    const clientB = createClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_ANON_KEY"),
    );
    const { error: signInErr } = await clientB.auth.signInWithPassword({
        email: ownerBEmail,
        password: ownerBPassword,
    });
    if (signInErr) throw new Error(`Sign in B: ${signInErr.message}`);

    // Owner B queries properties — must return zero rows for Owner A's properties
    const { data: propertiesSeenByB, error: pErr } = await clientB
        .from("properties")
        .select("id")
        .eq("id", propertyA.id);
    if (pErr) throw new Error(`Properties query B: ${pErr.message}`);
    assertEquals(
        (propertiesSeenByB ?? []).length,
        0,
        `RLS violation: owner B can see owner A's property (id=${propertyA.id})`,
    );

    // Owner B queries contracts — must return zero rows for Owner A's contracts
    const { data: contractsSeenByB, error: cErr } = await clientB
        .from("contracts")
        .select("id")
        .eq("id", contractA.id);
    if (cErr) throw new Error(`Contracts query B: ${cErr.message}`);
    assertEquals(
        (contractsSeenByB ?? []).length,
        0,
        `RLS violation: owner B can see owner A's contract (id=${contractA.id})`,
    );

    // Owner B queries invoices — must return zero rows for Owner A's invoices
    const { data: invoicesSeenByB, error: iErr } = await clientB
        .from("invoices")
        .select("id")
        .eq("contract_id", contractA.id);
    if (iErr) throw new Error(`Invoices query B: ${iErr.message}`);
    assertEquals(
        (invoicesSeenByB ?? []).length,
        0,
        `RLS violation: owner B can see owner A's invoices (contract_id=${contractA.id})`,
    );

    // ------------------------------------------------------------------
    // Sign out B, verify Owner A's authenticated client CAN see own data
    // ------------------------------------------------------------------
    await clientB.auth.signOut();

    const clientA = createClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_ANON_KEY"),
    );
    const { error: signInAErr } = await clientA.auth.signInWithPassword({
        email: ownerAEmail,
        password: ownerAPassword,
    });
    if (signInAErr) throw new Error(`Sign in A: ${signInAErr.message}`);

    const { data: propertiesSeenByA, error: pAqErr } = await clientA
        .from("properties")
        .select("id")
        .eq("id", propertyA.id);
    if (pAqErr) throw new Error(`Properties query A: ${pAqErr.message}`);
    assertEquals(
        (propertiesSeenByA ?? []).length,
        1,
        "Owner A must be able to see own property",
    );

    await clientA.auth.signOut();

    // ------------------------------------------------------------------
    // Cleanup (service_role)
    // ------------------------------------------------------------------
    await admin.from("invoices").delete().eq("contract_id", contractA.id);
    await admin.from("contracts").delete().eq("id", contractA.id);
    await admin.from("properties").delete().eq("id", propertyA.id);
    await admin.from("profiles").delete().eq("id", tenantId);
    await admin.from("profiles").delete().eq("id", ownerAId);
    await admin.from("profiles").delete().eq("id", ownerBId);
    await admin.auth.admin.deleteUser(tenantId);
    await admin.auth.admin.deleteUser(ownerAId);
    await admin.auth.admin.deleteUser(ownerBId);
});
