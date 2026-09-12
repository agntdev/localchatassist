import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { locale, now, readData, words, writeData } from "../assistant-data.js";

registerMainMenuItem({ label: "✉️ Обратная связь", data: "feedback:new", order: 60 });
const composer = new Composer<Ctx>();
composer.callbackQuery("feedback:new", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = "awaiting_feedback"; await ctx.reply("Напишите, что можно улучшить.", { reply_markup: { force_reply: true, input_field_placeholder: "Ваше сообщение" } }); });
composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_feedback") return next();
  const message = ctx.message.text.trim();
  if (!message || message.length > 3500) { await ctx.reply("Напишите короткое сообщение до 3500 символов."); return; }
  ctx.session.step = undefined;
  const data = await readData(ctx);
  const feedback = { message, severity: "feedback" as const, timestamp: now(), context: data.history.slice(-5) };
  await writeData(ctx, { ...data, feedback: [...data.feedback, feedback] });
  const admin = adminChatId(ctx as unknown as { env?: Record<string, unknown> });
  if (admin) {
    const context = feedback.context.map((item) => `${item.role}: ${item.text}`).join("\n");
    try { await ctx.api.sendMessage(admin, `Обратная связь\nПользователь: ${ctx.from.id}\nВремя: ${feedback.timestamp}\n${message}\nКонтекст:\n${context || "нет"}`); }
    catch { /* A blocked or unavailable admin must not lose the user's acknowledgement. */ }
    await ctx.reply(words(locale(data)).thanks, { reply_markup: mainMenuKeyboard() });
  } else await ctx.reply("Обратная связь сохранена, но владелец ещё не настроил уведомления.", { reply_markup: mainMenuKeyboard() });
});
export default composer;
