import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner, type OwnerAwareCtx } from "../toolkit/index.js";
import { clearFeedback, ownerFeedback, purgeHistories } from "../assistant-data.js";

registerMainMenuItem({ label: "🔒 Управление", data: "owner:open", order: 70 });
const composer = new Composer<Ctx>();
const ownerCtx = (ctx: Ctx) => ctx as unknown as OwnerAwareCtx;
composer.callbackQuery("owner:open", async (ctx) => { if (!(await requireOwner(ownerCtx(ctx)))) return; await ctx.answerCallbackQuery(); await ctx.reply("Управление данными.", { reply_markup: inlineKeyboard([[inlineButton("Показать отзывы", "owner:feedback")], [inlineButton("Очистить отзывы", "owner:clear_feedback")], [inlineButton("Очистить все истории", "owner:purge")]]) }); });
composer.callbackQuery("owner:feedback", async (ctx) => { if (!(await requireOwner(ownerCtx(ctx)))) return; await ctx.answerCallbackQuery(); const records = await ownerFeedback(ctx); await ctx.reply(records.length ? `Последние отзывы: ${records.slice(-10).map((r) => r.message).join("\n")}` : "Отзывов пока нет."); });
composer.callbackQuery("owner:clear_feedback", async (ctx) => { if (!(await requireOwner(ownerCtx(ctx)))) return; await ctx.answerCallbackQuery(); await clearFeedback(ctx); await ctx.reply("Отзывы очищены."); });
composer.callbackQuery("owner:purge", async (ctx) => { if (!(await requireOwner(ownerCtx(ctx)))) return; await ctx.answerCallbackQuery(); await purgeHistories(ctx); await ctx.reply("Все истории очищены. Профили сохранены."); });
export default composer;
