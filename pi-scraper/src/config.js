import "dotenv/config";

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
  userAgent:
    process.env.USER_AGENT ||
    "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  useHeadless: process.env.USE_HEADLESS === "1",
  dryRun: process.env.DRY_RUN === "1",
};
