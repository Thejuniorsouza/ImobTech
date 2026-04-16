// Edge Function: generate-contract-pdf
// Creates a contract, generates invoices idempotently, generates PDF,
// saves to Storage, and updates property status to 'rented'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { validateCreateContract } from "../_shared/validators.ts";
import type {
    CreateContractRequest,
    CreateContractResponse,
} from "../_shared/types.ts";
import { ALLOWED_PLACEHOLDERS } from "../_shared/types.ts";

Deno.serve(async (req: Request) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        // Only allow POST
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

        // Validate auth
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

        // Use service role for privileged operations
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        // Use service role client with user's auth header for RLS-scoped queries
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } },
        );

        // Identify the calling user via admin (avoids anon-key format issues)
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

        // Parse and validate body
        const body = (await req.json()) as unknown;
        const validationErrors = validateCreateContract(body);
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

        const data = body as CreateContractRequest;

        // Step 1: Verify property ownership and vacant status
        const { data: property, error: propError } = await supabaseAdmin
            .from("properties")
            .select(
                "id, owner_id, status, address_street, address_number, address_neighborhood, address_city, address_state, iptu_monthly_cents, condo_monthly_cents",
            )
            .eq("id", data.property_id)
            .single();

        if (propError || !property) {
            return new Response(
                JSON.stringify({ error: "Imóvel não encontrado." }),
                {
                    status: 404,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }
        if (property.owner_id !== user.id) {
            return new Response(JSON.stringify({ error: "Acesso negado." }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        if (property.status !== "vacant") {
            return new Response(
                JSON.stringify({
                    error: "Imóvel não está disponível (status não é vago).",
                }),
                {
                    status: 409,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // Step 2: Find or invite the tenant
        let tenantId: string;
        const { data: existingUsers } =
            await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(
            (u) => u.email === data.tenant_email,
        );

        if (existingUser) {
            tenantId = existingUser.id;
        } else {
            // Create tenant account with temporary password
            const { data: newUser, error: createError } =
                await supabaseAdmin.auth.admin.createUser({
                    email: data.tenant_email,
                    email_confirm: true,
                    user_metadata: {
                        full_name: data.tenant_name,
                        cpf: data.tenant_cpf,
                        role: "tenant",
                    },
                });
            if (createError || !newUser.user) {
                return new Response(
                    JSON.stringify({
                        error: `Erro ao criar inquilino: ${createError?.message}`,
                    }),
                    {
                        status: 500,
                        headers: {
                            ...corsHeaders,
                            "Content-Type": "application/json",
                        },
                    },
                );
            }
            tenantId = newUser.user.id;

            // Ensure profile row exists
            await supabaseAdmin.from("profiles").upsert(
                {
                    id: tenantId,
                    role: "tenant",
                    full_name: data.tenant_name,
                    cpf: data.tenant_cpf,
                    email: data.tenant_email,
                    rg: data.tenant_rg ?? null,
                    address: data.tenant_address ?? null,
                },
                { onConflict: "id" },
            );
        }

        // Step 3: Insert contract
        const { data: contract, error: contractError } = await supabaseAdmin
            .from("contracts")
            .insert({
                property_id: data.property_id,
                owner_id: user.id,
                tenant_id: tenantId,
                template_id: data.template_id ?? null,
                rent_amount_cents: data.rent_amount_cents,
                deposit_amount_cents: data.deposit_amount_cents,
                due_day: data.due_day,
                start_date: data.start_date,
                end_date: data.end_date,
                tenant_name: data.tenant_name,
                tenant_cpf: data.tenant_cpf,
                tenant_rg: data.tenant_rg ?? null,
                tenant_address: data.tenant_address ?? null,
            })
            .select()
            .single();

        if (contractError || !contract) {
            return new Response(
                JSON.stringify({
                    error: `Erro ao criar contrato: ${contractError?.message}`,
                }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // Step 4: Generate invoices idempotently using ON CONFLICT DO NOTHING
        const invoices: Array<{
            contract_id: string;
            competencia_month: string;
            invoice_type: string;
            amount_cents: number;
            due_date: string;
        }> = [];

        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        let current = new Date(start.getFullYear(), start.getMonth(), 1);

        while (current <= end) {
            const year = current.getFullYear();
            const month = current.getMonth();
            const competencia = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const dueDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(data.due_day).padStart(2, "0")}`;

            // Rent invoice
            invoices.push({
                contract_id: contract.id,
                competencia_month: competencia,
                invoice_type: "rent",
                amount_cents: data.rent_amount_cents,
                due_date: dueDate,
            });

            // First month: deposit invoice
            if (
                current.getMonth() === start.getMonth() &&
                current.getFullYear() === start.getFullYear() &&
                data.deposit_amount_cents > 0
            ) {
                invoices.push({
                    contract_id: contract.id,
                    competencia_month: competencia,
                    invoice_type: "deposit",
                    amount_cents: data.deposit_amount_cents,
                    due_date: dueDate,
                });
            }

            // IPTU invoice (if any)
            if (property.iptu_monthly_cents > 0) {
                invoices.push({
                    contract_id: contract.id,
                    competencia_month: competencia,
                    invoice_type: "iptu",
                    amount_cents: property.iptu_monthly_cents,
                    due_date: dueDate,
                });
            }

            // Condo invoice (if any)
            if (property.condo_monthly_cents > 0) {
                invoices.push({
                    contract_id: contract.id,
                    competencia_month: competencia,
                    invoice_type: "condo",
                    amount_cents: property.condo_monthly_cents,
                    due_date: dueDate,
                });
            }

            current = new Date(year, month + 1, 1);
        }

        const { error: invoiceError } = await supabaseAdmin
            .from("invoices")
            .upsert(invoices, {
                onConflict: "contract_id,competencia_month,invoice_type",
                ignoreDuplicates: true,
            });

        if (invoiceError) {
            console.error("Invoice generation error:", invoiceError);
            // Non-fatal: contract already created, log and continue
        }

        // Step 5: Update property status to 'rented'
        await supabaseAdmin
            .from("properties")
            .update({ status: "rented" })
            .eq("id", data.property_id);

        // Step 6: Generate PDF using pdf-lib
        const pdfStoragePath = await generateAndStorePdf(
            supabaseAdmin,
            contract.id,
            data,
            property,
            user.id,
        );

        // Step 7: Update contract with PDF path
        if (pdfStoragePath) {
            await supabaseAdmin
                .from("contracts")
                .update({ pdf_storage_path: pdfStoragePath })
                .eq("id", contract.id);
        }

        const response: CreateContractResponse = {
            contract_id: contract.id,
            pdf_storage_path: pdfStoragePath ?? "",
            invoices_created: invoices.length,
        };

        return new Response(JSON.stringify(response), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("generate-contract-pdf error:", err);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor." }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});

async function generateAndStorePdf(
    supabaseAdmin: ReturnType<typeof createClient>,
    contractId: string,
    data: CreateContractRequest,
    property: {
        owner_id: string;
        address_street: string;
        address_number: string;
        address_neighborhood: string;
        address_city: string;
        address_state: string;
        iptu_monthly_cents: number;
        condo_monthly_cents: number;
    },
    ownerId: string,
): Promise<string | null> {
    try {
        // Import pdf-lib dynamically
        const { PDFDocument, StandardFonts, rgb } =
            await import("https://esm.sh/pdf-lib@1.17.1");

        // Fetch template body if provided, otherwise use a minimal default
        let templateBody = getDefaultTemplateBody();
        if (data.template_id) {
            const { data: template } = await supabaseAdmin
                .from("contract_templates")
                .select("body")
                .eq("id", data.template_id)
                .single();
            if (template?.body) templateBody = template.body;
        }

        // Fetch owner profile for name/CPF
        const { data: ownerProfile } = await supabaseAdmin
            .from("profiles")
            .select("full_name, cpf, address")
            .eq("id", ownerId)
            .single();

        // Replace placeholders
        const rentDisplay = `R$ ${(data.rent_amount_cents / 100).toFixed(2).replace(".", ",")}`;
        const depositDisplay = `R$ ${(data.deposit_amount_cents / 100).toFixed(2).replace(".", ",")}`;
        const iptuDisplay = `R$ ${(property.iptu_monthly_cents / 100).toFixed(2).replace(".", ",")}`;
        const condoDisplay = `R$ ${(property.condo_monthly_cents / 100).toFixed(2).replace(".", ",")}`;
        const propertyAddress = `${property.address_street}, ${property.address_number} - ${property.address_neighborhood}, ${property.address_city}/${property.address_state}`;
        const startDateFormatted = new Date(data.start_date).toLocaleDateString(
            "pt-BR",
        );
        const endDateFormatted = new Date(data.end_date).toLocaleDateString(
            "pt-BR",
        );
        const durationMonths = Math.round(
            (new Date(data.end_date).getTime() -
                new Date(data.start_date).getTime()) /
                (1000 * 60 * 60 * 24 * 30),
        );

        const allowedReplacements: Record<string, string> = {
            owner_name: ownerProfile?.full_name ?? "N/A",
            owner_cpf: ownerProfile?.cpf ?? "N/A",
            owner_address: ownerProfile?.address ?? "N/A",
            tenant_name: data.tenant_name,
            tenant_cpf: data.tenant_cpf,
            tenant_rg: data.tenant_rg ?? "N/A",
            tenant_address: data.tenant_address ?? "N/A",
            property_address: propertyAddress,
            property_city: property.address_city,
            contract_duration_months: String(durationMonths),
            start_date: startDateFormatted,
            end_date: endDateFormatted,
            due_day: String(data.due_day),
            rent_amount: rentDisplay,
            deposit_amount: depositDisplay,
            iptu_monthly: iptuDisplay,
            condo_monthly: condoDisplay,
            contract_date: new Date().toLocaleDateString("pt-BR"),
        };

        // Only replace known placeholders (whitelist enforced)
        let filledBody = templateBody;
        for (const [key, value] of Object.entries(allowedReplacements)) {
            if (ALLOWED_PLACEHOLDERS.has(key)) {
                filledBody = filledBody.replaceAll(`{{${key}}}`, value);
            }
        }

        // Sanitize: remove any remaining unknown placeholders
        filledBody = filledBody.replace(
            /\{\{\w+\}\}/g,
            "[campo não preenchido]",
        );

        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([595, 842]); // A4
        const { width, height } = page.getSize();
        const fontSize = 10;
        const lineHeight = fontSize * 1.5;
        const margin = 50;
        const maxWidth = width - margin * 2;

        // Title
        page.drawText("CONTRATO DE LOCAÇÃO", {
            x: margin,
            y: height - margin,
            size: 14,
            font,
            color: rgb(0, 0, 0),
        });

        // Body text (wrap lines)
        const lines = filledBody.split("\n");
        let y = height - margin - 30;

        for (const line of lines) {
            if (y < margin) {
                pdfDoc.addPage([595, 842]);
                y = 842 - margin;
            }

            // Simple word-wrap
            const words = line.split(" ");
            let currentLine = "";
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const textWidth = font.widthOfTextAtSize(testLine, fontSize);
                if (textWidth > maxWidth && currentLine) {
                    page.drawText(currentLine, {
                        x: margin,
                        y,
                        size: fontSize,
                        font,
                        color: rgb(0, 0, 0),
                    });
                    y -= lineHeight;
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                page.drawText(currentLine, {
                    x: margin,
                    y,
                    size: fontSize,
                    font,
                    color: rgb(0, 0, 0),
                });
            }
            y -= lineHeight;
        }

        const pdfBytes = await pdfDoc.save();
        const storagePath = `${ownerId}/${contractId}/contract.pdf`;

        await supabaseAdmin.storage
            .from("contract-pdfs")
            .upload(storagePath, pdfBytes, {
                contentType: "application/pdf",
                upsert: true,
            });

        return storagePath;
    } catch (pdfErr) {
        console.error("PDF generation failed:", pdfErr);
        return null;
    }
}

function getDefaultTemplateBody(): string {
    return [
        "CONTRATO DE LOCAÇÃO",
        "",
        "LOCADOR: {{owner_name}}, CPF {{owner_cpf}}",
        "LOCATÁRIO: {{tenant_name}}, CPF {{tenant_cpf}}",
        "",
        "IMÓVEL: {{property_address}}",
        "",
        "PERÍODO: {{start_date}} a {{end_date}} ({{contract_duration_months}} meses)",
        "ALUGUEL: {{rent_amount}} | VENCIMENTO: Dia {{due_day}}",
        "CAUÇÃO: {{deposit_amount}}",
        "IPTU: {{iptu_monthly}} | CONDOMÍNIO: {{condo_monthly}}",
        "",
        "{{property_city}}, {{contract_date}}",
    ].join("\n");
}
