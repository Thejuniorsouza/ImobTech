// Shared CORS headers for all Supabase Edge Functions.
// Usage: import { corsHeaders, handleCors } from '../_shared/cors.ts'

export const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Returns a 200 response for preflight OPTIONS requests. */
export function handleCors(req: Request): Response | null {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    return null;
}
