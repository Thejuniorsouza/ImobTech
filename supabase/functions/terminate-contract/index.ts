// Edge Function: terminate-contract
// Marks a contract as terminated, sets the property back to vacant,
// and cancels all future pending invoices.

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
            .select("id, owner_id, property_id, status")
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
        if (contract.status !== "active") {
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

        // Terminate the contract
        await supabaseAdmin
            .from("contracts")
            .update({ status: "terminated" })
            .eq("id", contract_id);

        // Set property back to vacant
        await supabaseAdmin
            .from("properties")
            .update({ status: "vacant" })
            .eq("id", contract.property_id);

        // Cancel all future pending invoices
        const today = new Date().toISOString().split("T")[0];
        await supabaseAdmin
            .from("invoices")
            .delete()
            .eq("contract_id", contract_id)
            .eq("status", "pending")
            .gt("due_date", today);

        return new Response(JSON.stringify({ success: true, contract_id }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
