import type { Ctx } from "./bot.js";

export type Language = "russian" | "dagestani" | "azerbaijani";
export type Tone = "formal" | "informal";
export interface HistoryItem { role: "user" | "bot"; text: string; timestamp: number; locale: Language }
export interface Profile {
  telegramUserId: number; language: Language; languageChoice: string; tone: Tone;
  firstSeenTimestamp: number; receiveAdminNotifications: boolean; autoClearOnNewChat: boolean;
}
export interface UserData { profile?: Profile; history: HistoryItem[]; feedback: Feedback[] }
export interface Feedback { message: string; severity: "feedback" | "critical"; timestamp: number; context: HistoryItem[] }

type Statement = { first<T>(): Promise<T | null>; run(): Promise<unknown>; bind(...args: unknown[]): Statement };
type D1 = { prepare(sql: string): Statement };
const userKey = (id: number) => `user:${id}`;
export const now = () => Date.now();

function db(ctx: Ctx): D1 | undefined { return (ctx as Ctx & { env?: { DB?: D1 } }).env?.DB; }
async function ready(database: D1) {
  await database.prepare("CREATE TABLE IF NOT EXISTS caucasus_assistant_data (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
}
export async function readData(ctx: Ctx): Promise<UserData> {
  const id = ctx.from?.id;
  if (!id) return { history: [], feedback: [] };
  const database = db(ctx);
  if (!database) return (ctx.session.local?.[userKey(id)] as UserData | undefined) ?? { history: [], feedback: [] };
  await ready(database);
  const row = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind(userKey(id)).first<{ value: string }>();
  if (!row) return { history: [], feedback: [] };
  try { return JSON.parse(row.value) as UserData; } catch { return { history: [], feedback: [] }; }
}
export async function writeData(ctx: Ctx, value: UserData): Promise<void> {
  const id = ctx.from?.id;
  if (!id) return;
  const database = db(ctx);
  if (!database) { ctx.session.local = { ...(ctx.session.local ?? {}), [userKey(id)]: value }; return; }
  await ready(database);
  await database.prepare("INSERT INTO caucasus_assistant_data (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(userKey(id), JSON.stringify(value)).run();
  const index = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind("users").first<{ value: string }>();
  const ids: number[] = index ? JSON.parse(index.value) : [];
  if (!ids.includes(id)) await database.prepare("INSERT INTO caucasus_assistant_data (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("users", JSON.stringify([...ids, id])).run();
}
export async function eraseData(ctx: Ctx): Promise<void> {
  const id = ctx.from?.id; if (!id) return;
  const database = db(ctx);
  if (!database) { const local = { ...(ctx.session.local ?? {}) }; delete local[userKey(id)]; ctx.session.local = local; return; }
  await ready(database);
  await database.prepare("DELETE FROM caucasus_assistant_data WHERE key = ?").bind(userKey(id)).run();
}
export async function ownerFeedback(ctx: Ctx): Promise<Feedback[]> {
  const database = db(ctx); if (!database) return [];
  await ready(database);
  const row = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind("users").first<{ value: string }>();
  const ids: number[] = row ? JSON.parse(row.value) : [];
  const result: Feedback[] = [];
  for (const id of ids) { const item = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind(userKey(id)).first<{ value: string }>(); if (item) { try { result.push(...(JSON.parse(item.value) as UserData).feedback); } catch { /* Ignore one corrupt user record. */ } } }
  return result;
}
export async function clearFeedback(ctx: Ctx): Promise<void> {
  const database = db(ctx); if (!database) return;
  await ready(database); const row = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind("users").first<{ value: string }>();
  const ids: number[] = row ? JSON.parse(row.value) : [];
  for (const id of ids) { const item = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind(userKey(id)).first<{ value: string }>(); if (item) { try { const data = JSON.parse(item.value) as UserData; await database.prepare("UPDATE caucasus_assistant_data SET value = ? WHERE key = ?").bind(JSON.stringify({ ...data, feedback: [] }), userKey(id)).run(); } catch { /* Ignore one corrupt user record. */ } } }
}
export async function purgeHistories(ctx: Ctx): Promise<void> {
  const database = db(ctx); if (!database) return;
  await ready(database); const row = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind("users").first<{ value: string }>();
  const ids: number[] = row ? JSON.parse(row.value) : [];
  for (const id of ids) { const item = await database.prepare("SELECT value FROM caucasus_assistant_data WHERE key = ?").bind(userKey(id)).first<{ value: string }>(); if (item) { try { const data = JSON.parse(item.value) as UserData; await database.prepare("UPDATE caucasus_assistant_data SET value = ? WHERE key = ?").bind(JSON.stringify({ ...data, history: [] }), userKey(id)).run(); } catch { /* Ignore one corrupt user record. */ } } }
}
export function locale(data: UserData): Language { return data.profile?.language ?? "russian"; }
export function words(language: Language) {
  if (language === "dagestani") return { welcome: "Салам! Я рядом. Выбери действие ниже.", ask: "Напиши вопрос — отвечу коротко и по делу.", done: "Готово — начинаем новый чат.", thanks: "Спасибо, я передал сообщение владельцу.", changed: "Язык сменён. Старые сообщения не переводятся." };
  if (language === "azerbaijani") return { welcome: "Salam! Mən buradayam. Aşağıdan seçim et.", ask: "Sualını yaz, qısa və aydın cavab verim.", done: "Hazırdır — yeni söhbətə başlayırıq.", thanks: "Təşəkkürlər, mesajını sahibinə göndərdim.", changed: "Dil dəyişdi. Köhnə mesajlar tərcümə olunmur." };
  return { welcome: "Привет! Я рядом. Выберите действие ниже.", ask: "Напишите вопрос — отвечу коротко и по делу.", done: "Готово — начинаем новый чат.", thanks: "Спасибо, я передал сообщение владельцу.", changed: "Язык сменён. Старые сообщения не переводятся." };
}
export function answer(question: string, language: Language, tone: Tone, history: HistoryItem[]): string {
  const q = question.toLowerCase();
  if (/\b(диагноз|лечение|лекарств|юрист|суд|иск|договор)\b/.test(q)) return language === "azerbaijani" ? "Bu, peşəkar tibbi və ya hüquqi məsləhəti əvəz etmir. Təhlükəsiz qərar üçün həkimə və ya hüquqşünasa müraciət edin." : "Я не заменяю врача или юриста. Для безопасного решения обратитесь к профильному специалисту.";
  const prefix = language === "dagestani" ? "Салам, " : language === "azerbaijani" ? "Əlbəttə, " : "Конечно, ";
  const style = tone === "formal" ? "отвечу уважительно и по существу" : "разберём по‑простому";
  const context = history.filter((item) => item.role === "user").slice(-2, -1)[0];
  return `${prefix}${style}: ${question.trim()}${context ? "\n\nУчитываю, что вы уже писали выше." : ""}`;
}
export async function append(ctx: Ctx, data: UserData, role: "user" | "bot", text: string): Promise<UserData> {
  const updated = { ...data, history: [...data.history, { role, text, timestamp: now(), locale: locale(data) }].slice(-20) };
  await writeData(ctx, updated); return updated;
}
