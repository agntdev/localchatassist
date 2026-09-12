import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { eraseData, locale, readData, words, writeData } from "../assistant-data.js";

registerMainMenuItem({ label: "⚙️ Настройки", data: "settings:open", order: 40 });
const composer = new Composer<Ctx>();

composer.callbackQuery("settings:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Настройте общение и данные.", { reply_markup: inlineKeyboard([[inlineButton("Формальный тон", "settings:tone:formal"), inlineButton("Неформальный тон", "settings:tone:informal")], [inlineButton("Очистить историю", "settings:clear")], [inlineButton("Удалить профиль", "settings:delete")], [inlineButton("Сменить язык", "settings:change_language")]]) });
});
composer.callbackQuery(/^settings:tone:(formal|informal)$/, async (ctx) => { await ctx.answerCallbackQuery(); const data = await readData(ctx); if (!data.profile) { await ctx.reply("Сначала выберите язык через /start."); return; } const tone = ctx.match[1] as "formal" | "informal"; await writeData(ctx, { ...data, profile: { ...data.profile, tone } }); await ctx.reply(tone === "formal" ? "Тон изменён на формальный." : "Тон изменён на неформальный.", { reply_markup: mainMenuKeyboard() }); });
composer.callbackQuery("settings:clear", async (ctx) => { await ctx.answerCallbackQuery(); const data = await readData(ctx); await writeData(ctx, { ...data, history: [] }); await ctx.reply("История очищена. Профиль остался на месте.", { reply_markup: mainMenuKeyboard() }); });
composer.callbackQuery("settings:delete", async (ctx) => { await ctx.answerCallbackQuery(); await eraseData(ctx); ctx.session.step = undefined; await ctx.reply("Профиль и история удалены. В любой момент начните заново через /start."); });

export default composer;
