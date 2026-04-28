// casahunt-auth-verify-code
// Body: { chat_id: number, code: string }
// Validates the code, marks it consumed, creates a session, returns the token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const { chat_id, code } = await req.json();
    if (!chat_id || !code) {
      return json({ error: "chat_id and code required" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      db: { schema: "casahunt" },
    });

    const { data: rows, error } = await db
      .from("auth_codes")
      .select("*")
      .eq("chat_id", chat_id)
      .eq("code", code)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return json({ error: "invalid or expired code" }, 401);
    }

    await db
      .from("auth_codes")
      .update({ consumed: true })
      .eq("chat_id", chat_id)
      .eq("code", code);

    const { data: session, error: sErr } = await db
      .from("sessions")
      .insert({ chat_id })
      .select("token, expires_at")
      .single();
    if (sErr) throw sErr;

    return json(session);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
