import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { readData } from "../assistant-data.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const languageKeyboard = inlineKeyboard([
  [inlineButton("Русский", "lang:russian"), inlineButton("Дагестанец", "lang:dagestani")],
  [inlineButton("Азербайджанец", "lang:azerbaijani"), inlineButton("Другое", "lang:other")],
]);

composer.command("start", async (ctx) => {
  const data = await readData(ctx);
  if (!data.profile) {
    ctx.session.step = "awaiting_language";
    await ctx.reply("Кто ты по национальности?", { reply_markup: languageKeyboard });
    return;
  }
  await ctx.reply("Главное меню — выберите, что сделать.", { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Главное меню — выберите, что сделать.", { reply_markup: mainMenuKeyboard() });
});

export default composer;
