import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { answer, append, locale, now, readData, words, writeData, type Language } from "../assistant-data.js";

registerMainMenuItem({ label: "🧠 Задать вопрос", data: "chat:ask", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("chat:ask", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_question";
  const data = await readData(ctx);
  await ctx.reply(words(locale(data)).ask, { reply_markup: { force_reply: true, input_field_placeholder: "Напишите вопрос" } });
});

composer.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next();
  const data = await readData(ctx);
  if (ctx.session.step === "awaiting_language") {
    const normalized = text.toLowerCase();
    const requested: Language | undefined = ["русский", "russian"].includes(normalized) ? "russian" : ["дагестанец", "dagestani"].includes(normalized) ? "dagestani" : ["азербайджанец", "azerbaijani", "азербайджанский"].includes(normalized) ? "azerbaijani" : undefined;
    if (!requested) {
      await ctx.reply("Пока я уверенно говорю по-русски, в дагестанском формате и по-азербайджански. Выберите один из вариантов.", { reply_markup: { inline_keyboard: [[{ text: "Русский", callback_data: "lang:russian" }, { text: "Дагестанец", callback_data: "lang:dagestani" }], [{ text: "Азербайджанец", callback_data: "lang:azerbaijani" }]] } });
      return;
    }
    await writeData(ctx, { ...data, profile: { telegramUserId: ctx.from.id, language: requested, languageChoice: text, tone: data.profile?.tone ?? "informal", firstSeenTimestamp: data.profile?.firstSeenTimestamp ?? now(), receiveAdminNotifications: data.profile?.receiveAdminNotifications ?? true, autoClearOnNewChat: data.profile?.autoClearOnNewChat ?? false } });
    ctx.session.step = undefined;
    await ctx.reply(words(requested).welcome, { reply_markup: mainMenuKeyboard() });
    return;
  }
  if (ctx.session.step !== "awaiting_question") return next();
  if (text.length > 3500) { await ctx.reply("Сообщение получилось длинным. Сократите его и отправьте снова."); return; }
  ctx.session.step = undefined;
  const withQuestion = await append(ctx, data, "user", text);
  const response = answer(text, locale(withQuestion), withQuestion.profile?.tone ?? "informal", withQuestion.history);
  await append(ctx, withQuestion, "bot", response);
  await ctx.reply(response, { reply_markup: mainMenuKeyboard() });
});

export default composer;
