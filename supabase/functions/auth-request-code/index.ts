// auth-request-code
// Body: { chat_id: number }
// 1. Generate 6-digit code, store in casahunt.auth_codes (10 min TTL)
// 2. Ensure a casahunt.users row exists
// 3. DM the code to the user via Telegram
// Returns: { ok: true }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMessage } from "../_shared/telegram.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const { chat_id } = await req.json();
    if (!chat_id || typeof chat_id !== "number") {
      return json({ error: "chat_id (number) required" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      db: { schema: "casahunt" },
    });

    // Ensure user exists
    await db.from("users").upsert({ chat_id }, { onConflict: "chat_id" });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await db
      .from("auth_codes")
      .insert({ chat_id, code, expires_at });
    if (error) throw error;

    await sendMessage(
      TG_TOKEN,
      chat_id,
      `casahunt login code: <b>${code}</b>\nExpires in 10 minutes.`,
    );

    return json({ ok: true });
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
