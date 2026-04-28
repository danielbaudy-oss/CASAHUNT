// Minimal Telegram Bot API client for Deno (Supabase Edge Functions).

const API = (token: string) => `https://api.telegram.org/bot${token}`;

export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  const res = await fetch(`${API(token)}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`telegram sendMessage failed: ${res.status} ${body}`);
  }
  return res.json();
}
