import { fetch } from "undici";
import { config } from "./config.js";

const api = (path) =>
  `https://api.telegram.org/bot${config.telegramBotToken}/${path}`;

export async function sendMessage(chatId, text, extra = {}) {
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      ...extra,
    }),
  });
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendPhoto(chatId, photoUrl, caption) {
  const res = await fetch(api("sendPhoto"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
    }),
  });
  if (!res.ok) {
    // Photo can fail (CDN hotlink block). Fall back to text.
    return sendMessage(chatId, caption);
  }
  return res.json();
}
