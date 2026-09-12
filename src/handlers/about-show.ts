import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "ℹ️ О боте", data: "about:show", order: 50 });
const composer = new Composer<Ctx>();

composer.callbackQuery("about:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Я помогаю сформулировать текст, объяснить тему и продолжить разговор. Бережно храню профиль и последние 20 сообщений. Я не заменяю врача, юриста или финансового специалиста.", { reply_markup: mainMenuKeyboard() });
});

export default composer;
