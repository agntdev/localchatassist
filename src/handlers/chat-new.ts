import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard, mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { locale, readData, words, writeData } from "../assistant-data.js";

registerMainMenuItem({ label: "💬 Новый чат", data: "chat:new", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("chat:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Начать новый чат? Предыдущий контекст будет очищен.", { reply_markup: confirmKeyboard("chat:new", { yes: "Начать заново", no: "Оставить историю" }) });
});
composer.callbackQuery("chat:new:yes", async (ctx) => { await ctx.answerCallbackQuery(); const data = await readData(ctx); await writeData(ctx, { ...data, history: [] }); await ctx.reply(words(locale(data)).done, { reply_markup: mainMenuKeyboard() }); });
composer.callbackQuery("chat:new:no", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Хорошо, история осталась на месте.", { reply_markup: mainMenuKeyboard() }); });

export default composer;
