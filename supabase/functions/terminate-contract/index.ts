// Edge Function: terminate-contract
// Marks a contract as terminated, sets the property back to vacant,
// cancels (not deletes) all future pending invoices, and creates a
// proportional penalty invoice (multa rescisória).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { validateTerminateContract } from "../_shared/validators.ts";
import type { TerminateContractRequest } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({ error: "Method not allowed." }),
                {
                    status: 405,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

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

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // Verify the user JWT directly with admin client (avoids anon-key format issues)
        const token = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: userError,
        } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized." }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = (await req.json()) as unknown;
        const validationErrors = validateTerminateContract(body);
        if (validationErrors.length > 0) {
            return new Response(
                JSON.stringify({
                    error: "Validation failed.",
                    details: validationErrors,
                }),
                {
                    status: 422,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const { contract_id } = body as TerminateContractRequest;

        // Verify contract ownership
        const { data: contract, error: contractError } = await supabaseAdmin
            .from("contracts")
            .select(
                "id, owner_id, property_id, status, rent_amount_cents, start_date, end_date, due_day",
            )
            .eq("id", contract_id)
            .single();

        if (contractError || !contract) {
            return new Response(
                JSON.stringify({ error: "Contrato não encontrado." }),
                {
                    status: 404,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }
        if (contract.owner_id !== user.id) {
            return new Response(JSON.stringify({ error: "Acesso negado." }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        // Allow re-running termination if contract is already terminated
        // (idempotent recovery from partial failures)
        const alreadyTerminated = contract.status === "terminated";
        if (contract.status !== "active" && !alreadyTerminated) {
            return new Response(
                JSON.stringify({ error: "Contrato não está ativo." }),
                {
                    status: 409,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];

        // 1. Cancel (not delete) all future pending invoices
        const { error: cancelError } = await supabaseAdmin
            .from("invoices")
            .update({ status: "cancelled" })
            .eq("contract_id", contract_id)
            .eq("status", "pending")
            .gt("due_date", todayStr);
        if (cancelError)
            throw new Error(
                `Falha ao cancelar faturas: ${cancelError.message}`,
            );

        // 2. Calculate and insert penalty invoice (multa rescisória)
        //    fine = 3 × rent × (remaining_months / total_months), capped at 3 × rent
        const startDate = new Date(contract.start_date + "T12:00:00");
        const endDate = new Date(contract.end_date + "T12:00:00");
        const totalMonths = Math.max(
            1,
            (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                (endDate.getMonth() - startDate.getMonth()),
        );
        const remainingMonths = Math.min(
            Math.max(
                0,
                (endDate.getFullYear() - today.getFullYear()) * 12 +
                    (endDate.getMonth() - today.getMonth()),
            ),
            totalMonths,
        );
        const fineCents = Math.round(
            (3 * contract.rent_amount_cents * remainingMonths) / totalMonths,
        );

        if (fineCents > 0) {
            const dueMonth = today.getMonth();
            const dueYear = today.getFullYear();
            const lastDayOfMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
            const dueDay = Math.min(contract.due_day, lastDayOfMonth);
            const dueDateStr = `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
            const competenciaMonth = `${dueYear}-${String(dueMonth + 1).padStart(2, "0")}-01`;

            // Check if fine invoice already exists (idempotency)
            const { data: existingFine } = await supabaseAdmin
                .from("invoices")
                .select("id")
                .eq("contract_id", contract_id)
                .eq("invoice_type", "fine")
                .maybeSingle();

            if (!existingFine) {
                const { error: fineError } = await supabaseAdmin
                    .from("invoices")
                    .insert({
                        contract_id,
                        competencia_month: competenciaMonth,
                        due_date: dueDateStr,
                        amount_cents: fineCents,
                        invoice_type: "fine",
                        status: "pending",
                    });
                if (fineError)
                    throw new Error(
                        `Falha ao criar multa: ${fineError.message}`,
                    );
            }
        }

        // 3. Mark contract as terminated
        const { error: terminateError } = await supabaseAdmin
            .from("contracts")
            .update({ status: "terminated" })
            .eq("id", contract_id);
        if (terminateError)
            throw new Error(
                `Falha ao rescindir contrato: ${terminateError.message}`,
            );

        // 4. Set property back to vacant
        const { error: vacateError } = await supabaseAdmin
            .from("properties")
            .update({ status: "vacant" })
            .eq("id", contract.property_id);
        if (vacateError)
            throw new Error(`Falha ao liberar imóvel: ${vacateError.message}`);

        return new Response(
            JSON.stringify({
                success: true,
                contract_id,
                fine_cents: fineCents,
                remaining_months: remainingMonths,
                total_months: totalMonths,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (err) {
        console.error("terminate-contract error:", err);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor." }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});
