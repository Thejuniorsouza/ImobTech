// Edge Function: delete-user-data
// Implements LGPD FR-018: cascade-delete all user data when called by the
// authenticated user. Uses service_role to bypass RLS for cascade deletions.
// Returns a summary of deleted records.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

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

        // Use service_role to verify the JWT and perform all operations
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

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

        const userId = user.id;

        const summary: Record<string, number> = {};

        // 1. Collect all property IDs owned by this user
        const { data: properties } = await supabaseAdmin
            .from("properties")
            .select("id")
            .eq("owner_id", userId);

        const propertyIds = (properties ?? []).map((p: { id: string }) => p.id);

        // 2. Collect all contract IDs related to this user (as owner or tenant)
        const { data: contracts } = await supabaseAdmin
            .from("contracts")
            .select("id")
            .or(`owner_id.eq.${userId},tenant_id.eq.${userId}`);

        const contractIds = (contracts ?? []).map((c: { id: string }) => c.id);

        // 3. Delete storage files
        const storageSummary = { deleted: 0, errors: 0 };

        // Property photos
        if (propertyIds.length > 0) {
            for (const propertyId of propertyIds) {
                const { data: files } = await supabaseAdmin.storage
                    .from("property-photos")
                    .list(propertyId);
                if (files && files.length > 0) {
                    const paths = files.map(
                        (f: { name: string }) => `${propertyId}/${f.name}`,
                    );
                    await supabaseAdmin.storage
                        .from("property-photos")
                        .remove(paths);
                    storageSummary.deleted += paths.length;
                }
            }
        }

        // Inspection photos (via contracts)
        if (contractIds.length > 0) {
            for (const contractId of contractIds) {
                const { data: files } = await supabaseAdmin.storage
                    .from("inspection-photos")
                    .list(contractId);
                if (files && files.length > 0) {
                    const paths = files.map(
                        (f: { name: string }) => `${contractId}/${f.name}`,
                    );
                    await supabaseAdmin.storage
                        .from("inspection-photos")
                        .remove(paths);
                    storageSummary.deleted += paths.length;
                }
            }
        }

        // Contract PDFs
        if (contractIds.length > 0) {
            for (const contractId of contractIds) {
                const { data: files } = await supabaseAdmin.storage
                    .from("contract-pdfs")
                    .list(contractId);
                if (files && files.length > 0) {
                    const paths = files.map(
                        (f: { name: string }) => `${contractId}/${f.name}`,
                    );
                    await supabaseAdmin.storage
                        .from("contract-pdfs")
                        .remove(paths);
                    storageSummary.deleted += paths.length;
                }
            }
        }

        // Shared documents
        const { data: sharedFiles } = await supabaseAdmin.storage
            .from("shared-documents")
            .list(userId);
        if (sharedFiles && sharedFiles.length > 0) {
            const paths = sharedFiles.map(
                (f: { name: string }) => `${userId}/${f.name}`,
            );
            await supabaseAdmin.storage.from("shared-documents").remove(paths);
            storageSummary.deleted += paths.length;
        }

        summary["storage_files"] = storageSummary.deleted;

        // 4. Delete database records in dependency order

        // Inspection photos (references inspections)
        if (contractIds.length > 0) {
            const { data: inspections } = await supabaseAdmin
                .from("inspections")
                .select("id")
                .in("contract_id", contractIds);
            const inspectionIds = (inspections ?? []).map(
                (i: { id: string }) => i.id,
            );

            if (inspectionIds.length > 0) {
                const { data: deletedPhotos } = await supabaseAdmin
                    .from("inspection_photos")
                    .delete()
                    .in("inspection_id", inspectionIds)
                    .select("id");
                summary["inspection_photos"] = (deletedPhotos ?? []).length;
            }

            // Inspections
            const { data: deletedInspections } = await supabaseAdmin
                .from("inspections")
                .delete()
                .in("contract_id", contractIds)
                .select("id");
            summary["inspections"] = (deletedInspections ?? []).length;

            // Invoice adjustments
            const { data: invoices } = await supabaseAdmin
                .from("invoices")
                .select("id")
                .in("contract_id", contractIds);
            const invoiceIds = (invoices ?? []).map(
                (i: { id: string }) => i.id,
            );

            if (invoiceIds.length > 0) {
                const { data: deletedAdjustments } = await supabaseAdmin
                    .from("invoice_adjustments")
                    .delete()
                    .in("invoice_id", invoiceIds)
                    .select("id");
                summary["invoice_adjustments"] = (
                    deletedAdjustments ?? []
                ).length;
            }

            // Invoices
            const { data: deletedInvoices } = await supabaseAdmin
                .from("invoices")
                .delete()
                .in("contract_id", contractIds)
                .select("id");
            summary["invoices"] = (deletedInvoices ?? []).length;

            // Documents
            const { data: deletedDocuments } = await supabaseAdmin
                .from("documents")
                .delete()
                .in("contract_id", contractIds)
                .select("id");
            summary["documents"] = (deletedDocuments ?? []).length;

            // Contracts
            const { data: deletedContracts } = await supabaseAdmin
                .from("contracts")
                .delete()
                .in("id", contractIds)
                .select("id");
            summary["contracts"] = (deletedContracts ?? []).length;
        }

        // Properties
        if (propertyIds.length > 0) {
            const { data: deletedProperties } = await supabaseAdmin
                .from("properties")
                .delete()
                .in("id", propertyIds)
                .select("id");
            summary["properties"] = (deletedProperties ?? []).length;
        }

        // Contract templates owned by user
        const { data: deletedTemplates } = await supabaseAdmin
            .from("contract_templates")
            .delete()
            .eq("owner_id", userId)
            .select("id");
        summary["contract_templates"] = (deletedTemplates ?? []).length;

        // Audit logs for this user
        const { data: deletedAuditLogs } = await supabaseAdmin
            .from("audit_logs")
            .delete()
            .eq("user_id", userId)
            .select("id");
        summary["audit_logs"] = (deletedAuditLogs ?? []).length;

        // Profile
        const { data: deletedProfile } = await supabaseAdmin
            .from("profiles")
            .delete()
            .eq("id", userId)
            .select("id");
        summary["profiles"] = (deletedProfile ?? []).length;

        // Delete auth user (must be last)
        const { error: deleteAuthError } =
            await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteAuthError) {
            console.error(
                "Failed to delete auth user:",
                deleteAuthError.message,
            );
        }
        summary["auth_user"] = deleteAuthError ? 0 : 1;

        return new Response(
            JSON.stringify({
                success: true,
                user_id: userId,
                deleted: summary,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        console.error("delete-user-data error:", message);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
