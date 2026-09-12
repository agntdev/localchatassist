# Кавказский чат‑ассистент — Bot specification

**Archetype:** support

**Voice:** warm and concise — write every user-facing message, button label, error, and empty state in this voice.

Telegram-ассистент, который при первом запуске спрашивает национальность/язык, предлагает быстрые кнопки выбора (Русский, Дагестанец, Азербайджанец, Другое) и затем ведёт многотуровый диалог, отвечая в выбранном языке/варианте (включая Dagestani). Поддерживает вопросы и ответы, помощь в написании текстов, объяснения и продолжение контекста; сохраняет профиль пользователя и последние 20 сообщений для контекстуальности и предоставляет уведомления владельцу о критических ошибках и обратной связи.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Русскоязычные пользователи из Кавказа
- Люди, желающие общаться с локализованным ассистентом на своей национальной форме языка
- Пользователи, ищущие помощь в написании, объяснениях и многотуровом Q&A

## Success criteria

- При первом /start бот спрашивает национальность и сохраняет выбор в профиле пользователя
- Все ответы поступают в выбранном языке/варианте (Dagestani переключается на Dagestani-формат), либо корректно откатываются на русский с предложением альтернатив
- Последние 20 сообщений диалога сохраняются и используются для контекста в многотуровых беседах
- Главное меню доступно по /start и через persistent keyboard с указанными кнопками
- Админ получает уведомления в ADMIN_CHAT_ID о критических ошибках и отправленной пользователями обратной связи

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Открыть главное меню и запустить onboarding (спрашивает национальность при первом запуске)
  - outputs: onboarding:nationality_prompt, main_menu
- **💬 Новый чат** (button, actor: user, callback: chat:new) — Очистить контекст текущего диалога и начать новый чат
  - outputs: conversation:cleared, main_prompt
- **🧠 Задать вопрос** (button, actor: user, callback: chat:ask) — Открывает подсказку для свободного текстового вопроса (ForceReply/typing expected)
  - inputs: free_text_question
  - outputs: answer_message, conversation:append
- **🌐 Сменить язык** (button, actor: user, callback: settings:change_language) — Показать те же кнопки национальностей для смены языка (Русский/Дагестанец/Азербайджанец/Другое)
  - inputs: language_choice_or_custom
  - outputs: profile:update_language, confirmation_message
- **⚙️ Настройки** (button, actor: user, callback: settings:open) — Открывает настройки: тон общения (формальный/неформальный), конфиденциальность и очистка истории
  - inputs: tone_choice, privacy_actions
  - outputs: profile:update_tone, conversation:cleared_optional, confirmation_message
- **ℹ️ О боте** (button, actor: user, callback: about:show) — Показать краткую информацию о возможностях, ограничениях и отказе от ответственности (мед./юридич. услуги)
  - outputs: about_text

## Flows

### Onboarding: nationality & language selection
_Trigger:_ /start (first run)

1. Bot: prompt 'Кто ты по национальности?' with inline buttons [Русский, Дагестанец, Азербайджанец, Другое]
2. User: taps a button or selects 'Другое' and types a language
3. System: save profile.language and set bot response_locale accordingly (Dagestani maps to Dagestani variant)
4. Bot: send welcome message in chosen locale and show main menu keyboard

_Data touched:_ User profile, Conversation (welcome message)

### New chat (clear context)
_Trigger:_ callback chat:new

1. Bot: confirm intent with quick yes/no buttons
2. If yes -> clear stored recent conversation messages (retain profile), reset session context
3. Bot: send prompt 'Готово — начинаем новый чат' in user's language and show main menu

_Data touched:_ Conversation

### Ask question (free-form)
_Trigger:_ callback chat:ask -> ForceReply or typed input

1. Bot: prompt for question (short hint) in user's language
2. User: types question
3. System: append user message to conversation history (truncate to last 20 messages)
4. Bot: generate reply in selected locale/tone; if locale unsupported use Russian fallback and offer to change language
5. System: append bot reply to conversation history

_Data touched:_ Conversation, User profile

### Change language
_Trigger:_ callback settings:change_language

1. Bot: show language buttons again
2. User: selects or types new language
3. System: update profile.language and optionally migrate conversation locale (no automatic translation of old messages)
4. Bot: confirm change and continue in new language

_Data touched:_ User profile

### Settings: tone and privacy
_Trigger:_ callback settings:open

1. Bot: present tone options (Формальный / Неформальный) and privacy actions (Clear history, Delete profile)
2. User: selects action
3. System: update profile.tone or execute privacy action (clear last 20 messages or delete persistent profile)
4. Bot: confirm action and update main menu

_Data touched:_ User profile, Conversation

### Unsupported language fallback
_Trigger:_ User requests a language not supported

1. System: detect unsupported locale
2. Bot: reply in Russian (fallback) explaining the limitation and offer alternate options via buttons
3. If user chooses a supported language, update profile and resume

_Data touched:_ User profile, Conversation

### User feedback / error reporting to admin
_Trigger:_ User submits feedback or a critical error occurs (internal)

1. System: format feedback/error with user id, timestamp, short context (last 5 messages) and severity
2. System: send a notification to ADMIN_CHAT_ID
3. Bot: acknowledge receipt to user in their language

_Data touched:_ Feedback record, Conversation

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Куда отправлять уведомления об ошибках и входящую обратную связь владельцу
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User profile** _(retention: persistent)_ — Per-user persistent profile storing chosen nationality/language, preferred tone and minimal metadata
  - fields: telegram_user_id, language_choice, language_variant (e.g., 'dagestani'), tone_preference (formal/informal), first_seen_timestamp
- **Conversation** _(retention: persistent)_ — Per-user recent message history used for context. Truncate to the last 20 messages for storage and context building.
  - fields: message_id, role (user|bot), text, timestamp, locale_used
- **Settings** _(retention: persistent)_ — User-configurable options (privacy choices, whether to receive confirmations, etc.)
  - fields: receive_admin_notifications (bool), auto_clear_on_new_chat (bool)
- **Feedback record** _(retention: persistent)_ — User-submitted feedback and internal error reports forwarded to owner
  - fields: user_id, message, severity, attached_context (last 5 messages), timestamp

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, callbacks, ForceReply
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure ADMIN_CHAT_ID to receive feedback and critical error notifications
- View and clear stored feedback records
- Trigger global purge of conversation histories (all users) via admin command
- Update the set of nationality/language buttons (owner-provided list) — currently defaults to four
- Set the default tone (formal/informal) and dialog retention limit if desired

## Notifications

- Admin: critical error alerts with last 5 messages and user id -> ADMIN_CHAT_ID
- Admin: user feedback submissions (feedback text + context) -> ADMIN_CHAT_ID
- User: confirmation messages after settings changes, language changes, history cleared

## Permissions & privacy

- Store profile (language, tone) and up to last 20 messages per user to maintain conversation context
- Provide users explicit options in Settings to clear history or delete their profile (data erasure)
- Do not forward full conversation history to admin — only short context (last 5 messages) with feedback or error reports, unless user explicitly consents
- Show a visible disclaimer in 'О боте' that the assistant is not a substitute for professional medical, legal or financial advice

## Edge cases

- User picks 'Другое' and types an unsupported language -> bot replies in Russian and offers supported alternatives
- User shifts language mid-conversation -> profile.language is updated; no automatic translation of prior messages; bot warns about context mismatch
- User asks for professional legal/medical advice -> bot returns a refusal/disclaimer and suggests professional help
- Telegram message size or rate limits -> bot returns a short error and requests user to shorten the message or try later
- User deletes chat or blocks the bot -> bot cannot deliver messages; admin notified only if critical errors are logged
- Multiple accounts on same device -> profiles keyed by telegram_user_id to avoid cross-account leakage

## Required tests

- Onboarding acceptance test: /start triggers nationality prompt; choosing each button sets profile.language and subsequent bot replies reflect chosen locale
- Dagestani flow test: when 'Дагестанец' selected, bot responds using Dagestani variant in follow-up messages
- Ask question flow: typed question via '🧠 Задать вопрос' is answered and both user and bot messages are appended to history (bounded at 20)
- Change language test: using '🌐 Сменить язык' updates profile and bot immediately replies in new language
- Clear context test: '💬 Новый чат' confirmation clears conversation while retaining profile
- Fallback test: user requests unsupported language -> bot replies in Russian and offers alternatives
- Admin notification test: user feedback is forwarded to ADMIN_CHAT_ID with context and bot acknowledges receipt
- Privacy actions test: user clears history and deletes profile; data is removed and confirmations are shown

## Assumptions

- Dagestani is treated as a single locale variant and the owner will accept a single 'Dagestani' response style
- Default nationality buttons are the four provided (Русский, Дагестанец, Азербайджанец, Другое) unless owner customizes
- Bot can serve all reply text without external AI APIs (responses produced by in-bot logic/templates or owner-provided generation); no external translation service is assumed
- Conversation persistence limit is 20 messages per user as specified in the brief
- Only one admin notification target is required (ADMIN_CHAT_ID)
