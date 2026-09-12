import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, mainMenuKeyboard } from "../toolkit/index.js";
import { now, readData, words, writeData, type Language } from "../assistant-data.js";

registerMainMenuItem({ label: "🌐 Сменить язык", data: "settings:change_language", order: 30 });
const composer = new Composer<Ctx>();
const keyboard = inlineKeyboard([[inlineButton("Русский", "lang:russian"), inlineButton("Дагестанец", "lang:dagestani")], [inlineButton("Азербайджанец", "lang:azerbaijani"), inlineButton("Другое", "lang:other")]]);

composer.callbackQuery("settings:change_language", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_language";
  await ctx.reply("Выберите язык общения.", { reply_markup: keyboard });
});

composer.callbackQuery(/^lang:(russian|dagestani|azerbaijani)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const language = ctx.match[1] as Language;
  const data = await readData(ctx);
  const firstSeen = data.profile?.firstSeenTimestamp ?? now();
  await writeData(ctx, { ...data, profile: { telegramUserId: ctx.from.id, language, languageChoice: language, tone: data.profile?.tone ?? "informal", firstSeenTimestamp: firstSeen, receiveAdminNotifications: data.profile?.receiveAdminNotifications ?? true, autoClearOnNewChat: data.profile?.autoClearOnNewChat ?? false } });
  ctx.session.step = undefined;
  const copy = words(language);
  await ctx.reply(data.profile ? copy.changed : copy.welcome, { reply_markup: mainMenuKeyboard() });
});
composer.callbackQuery("lang:other", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = "awaiting_language"; await ctx.reply("Напишите язык, на котором вам удобно общаться.", { reply_markup: { force_reply: true, input_field_placeholder: "Например, чеченский" } }); });

export default composer;
