// Edge Function: generate-ad
// Generates property listing copy for OLX, ZAP Imóveis, and Viva Real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import type {
    GenerateAdRequest,
    GenerateAdResponse,
} from "../_shared/types.ts";

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

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } },
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

        const { property_id } = (await req.json()) as GenerateAdRequest;

        if (!property_id) {
            return new Response(
                JSON.stringify({ error: "property_id is required." }),
                {
                    status: 422,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        // Fetch property (RLS enforces ownership)
        const { data: property, error: propError } = await supabaseClient
            .from("properties")
            .select("*")
            .eq("id", property_id)
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

        if (property.status !== "vacant") {
            return new Response(
                JSON.stringify({
                    error: "Anúncios só podem ser gerados para imóveis vagos.",
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

        const typeLabel: Record<string, string> = {
            house: "Casa",
            apartment: "Apartamento",
            commercial: "Imóvel Comercial",
        };

        const rentDisplay = `R$ ${(property.rent_cents / 100).toFixed(2).replace(".", ",")}`;
        const address = `${property.address_neighborhood}, ${property.address_city}/${property.address_state}`;
        const areaText = property.area_sqm ? ` | ${property.area_sqm}m²` : "";
        const bedroomsText =
            property.bedrooms > 0 ? ` | ${property.bedrooms} quarto(s)` : "";
        const bathroomsText =
            property.bathrooms > 0
                ? ` | ${property.bathrooms} banheiro(s)`
                : "";
        const parkingText =
            property.parking_spaces > 0
                ? ` | ${property.parking_spaces} vaga(s)`
                : "";
        const condoText =
            property.condo_monthly_cents > 0
                ? ` | Condomínio: R$ ${(property.condo_monthly_cents / 100).toFixed(2).replace(".", ",")}`
                : "";
        const iptuText =
            property.iptu_monthly_cents > 0
                ? ` | IPTU: R$ ${(property.iptu_monthly_cents / 100).toFixed(2).replace(".", ",")}`
                : "";

        const specs =
            `${areaText}${bedroomsText}${bathroomsText}${parkingText}`.replace(
                /^\s*\|\s*/,
                "",
            );
        const charges = `${condoText}${iptuText}`.replace(/^\s*\|\s*/, "");

        const typeStr = typeLabel[property.property_type] ?? "Imóvel";

        const baseDescription = [
            property.description ?? "",
            "",
            `📍 Localização: ${address}`,
            `🏠 Tipo: ${typeStr}`,
            specs ? `📐 Características: ${specs}` : "",
            "",
            `💰 Aluguel: ${rentDisplay}${charges ? ` | ${charges}` : ""}`,
            "",
            "Para agendar uma visita, entre em contato!",
        ]
            .filter(Boolean)
            .join("\n");

        const response: GenerateAdResponse = {
            olx: {
                title: `${typeStr} para alugar - ${property.address_neighborhood}/${property.address_state}`,
                description: `${baseDescription}\n\nAnúncio gerado via ImobTech`,
            },
            zap: {
                title: `${typeStr} - ${property.address_neighborhood}, ${property.address_city}`,
                description: `${baseDescription}\n\n📱 Proprietário direto`,
            },
            vivareal: {
                title: `${typeStr} para Locação em ${property.address_neighborhood}`,
                description: `${baseDescription}\n\n✅ Sem taxa de corretagem`,
            },
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("generate-ad error:", err);
        return new Response(
            JSON.stringify({ error: "Erro interno do servidor." }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
});
