import { fetch } from "undici";
import { config } from "./config.js";

const api = (path) =>
  `https://api.telegram.org/bot${config.telegramBotToken}/${path}`;

export async function sendMessage(chatId, text, extra = {}) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...extra,
  };
  const res = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const resBody = await res.text();
  if (!res.ok) throw new Error(`sendMessage ${res.status}: ${resBody}`);
  return JSON.parse(resBody);
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
    const errBody = await res.text();
    console.log(`sendPhoto failed (${res.status}), falling back to sendMessage. Error: ${errBody}`);
    return sendMessage(chatId, caption);
  }
  return res.json();
}
