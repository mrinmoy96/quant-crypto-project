import "dotenv/config";

import { env } from "../config/env.js";

export async function sendTelegramMessage(text) {
  const token = env.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = env.telegramChatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set.');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      console.error('[telegram] failed to send message:', data?.description || response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[telegram] send error:', error.message);
    return false;
  }
}
