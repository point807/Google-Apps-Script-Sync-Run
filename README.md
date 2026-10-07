# ScriptVault — Google Apps Script Sync & Version Control

**ScriptVault** — веб-приложение для загрузки, редактирования, запуска и резервного копирования проектов **Google Apps Script** с локальной историей версий (IndexedDB), автоматической синхронизацией (polling), Google Drive и GitHub.

Работает как единое рабочее пространство: проект из Google Drive или по Script ID → Monaco Editor → запуск через Apps Script API (или sandboxed Worker-эмуляция) → версии/деплои → бэкапы на Drive → GitHub (прямой пуш или Pull Request) → PWA офлайн.

## Возможности

- **Подключение Google Apps Script**
  - автономные проекты и скрипты, привязанные к Sheets;
  - по URL / Script ID / выбор из Drive;
  - определение типов файлов (.gs/.html/.json).

- **Редактор кода — Monaco Editor 0.52.2**
  - локальный бандл (без CDN), воркеры JS/TS/HTML/JSON/CSS;
  - мини-карта, встроенный поиск/замена, подсветка;
  - автодополнение Apps Script API (20+ сервисов: SpreadsheetApp, DriveApp и т.д.) через extraLib;
  - undo/redo, размер шрифта, перенос строк, полноэкранный режим, копирование;
  - загрузка отдельным чанком, textarea-fallback.

- **Полнотекстовый поиск по всем проектам**
  - `Ctrl+K / Cmd+K` — модалка глобального поиска;
  - case-insensitive, превью строки, до 200 результатов;
  - переход к проекту/файлу в один клик.

- **Запуск функций Apps Script — честный запуск**
  - выбор функции из текущего файла или всех файлов;
  - **облачный запуск** через `scripts.run` — требует API-executable деплоя;
  - UI «Деплой» (кнопка Rocket): список версий (`projects.versions`), список деплоев (`projects.deployments`), создание версии/деплоя, бейдж `API executable`, кнопка добавления `executionApi` в манифест;
  - **локальный runner — песочница**: код исполняется в dedicated Web Worker (без DOM/window), таймаут 15с, моки Logger/SpreadsheetApp/Utilities/Session/MailApp/UrlFetchApp, помечен как «эмуляция (ограниченно)».

- **Версионирование**
  - история в **IndexedDB** (idb), миграция из localStorage;
  - авто-коммиты при обнаружении изменений, ручные снапшоты;
  - diff, откат, авто-черновик перед каждым пушем в Google/GitHub;
  - восстановление из Drive-снапшотов в один клик (с опциональным пушем в Apps Script).

- **Конфликт-детект при синхронизации**
  - 3-way merge: local / remote / baseline (последний git-коммит);
  - односторонние изменения сливаются автоматически;
  - при конфликте — модалка с построчным diff, выбор «Оставить мои» / «Взять из Apps Script».

- **Автоматическая синхронизация (polling)**
  - настраиваемый интервал 5с–24ч, пресеты;
  - выбор отслеживаемых скриптов;
  - ручной запуск, отмена через AbortController, защита от параллельных запусков;
  - toasts об ошибках + счётчики в журнале.

- **Google Drive**
  - выбор/создание папки для бэкапов;
  - JSON-снапшоты с метаданными и commitId;
  - просмотр снимков, восстановление;
  - создание копий Google Sheets.

- **GitHub**
  - PAT в `sessionStorage` по умолчанию, опция «Запомнить» → `localStorage`, маска `ghp_••••1234`, миграция легаси-ключей;
  - выбор owner/repo/branch/path, создание репозитория;
  - **прямой пуш** в ветку (Git Data API);
  - **создание Pull Request**: создание ветки от base → пуш файлов → PR с описанием;
  - ветки: создание, удаление, сравнение (ahead/behind), визуализация BranchTreeMap;
  - удалённая история коммитов.

- **Настройки — импорт/экспорт**
  - экспорт syncSettings + gitHubConfig (без токена) в JSON;
  - импорт JSON для переноса конфигурации на другое устройство.

- **Журнал активности**
  - единый лог Apps Script / Git / GitHub / Drive / realtime;
  - фильтр по категориям, счётчики ошибок/предупреждений, экспорт в txt, очистка.

- **PWA + офлайн**
  - `vite-plugin-pwa`, autoUpdate, Workbox precache (103 ассета, ~14MB включая Monaco воркеры);
  - офлайн-просмотр истории (IndexedDB), иконки 192/512;
  - CSP и security-заголовки в `firebase.json`.

- **Интерфейс**
  - ru/en, тёмная тема, адаптивная верстка;
  - состояние синхронизации, обратный отсчёт, toasts.

## Как устроена синхронизация

1. Проверяет выбранные проекты;
2. Получает актуальное содержимое через Apps Script API;
3. Сравнивает с последним локальным снимком (baseline);
4. 3-way merge, при конфликте — модалка;
5. Создаёт новую версию в IndexedDB;
6. При включённом Drive — JSON-снапшот;
7. При настроенном GitHub — пуш в ветку (или PR).

Важно: синхронизация — **polling**, а не push-события. «Real-time» означает частую проверку с заданным интервалом.

## Требования

- Node.js 18+ или Bun;
- Google-аккаунт с доступом к Apps Script / Drive;
- GitHub-аккаунт — для GitHub-интеграции.

Стек:

- React 19 + TypeScript 6.0.3 (strict) + Vite 8 + Tailwind 4;
- Monaco Editor 0.52.2 + @monaco-editor/react 4.7.0;
- Firebase Auth (Google OAuth), Zustand;
- Google Apps Script REST API v1, Drive API v3, GitHub REST + Git Data API;
- IndexedDB (idb), JSZip, lucide-react;
- ESLint 9 + Prettier + Vitest + happy-dom + fake-indexeddb;
- PWA (vite-plugin-pwa) + Workbox, rollup-plugin-visualizer.

## Установка

```bash
git clone https://github.com/point807/Google-Apps-Script-Sync-Run.git
cd Google-Apps-Script-Sync-Run
bun install # или npm install
cp .env.example .env # заполнить VITE_FIREBASE_* из Firebase Console
bun run dev # Vite на :3000
```

Production:

```bash
npm run build # → dist/ + dist/stats.html (bundle analysis) + sw.js
npm run preview
npm run typecheck
npm run lint
npm run format
npm run test
```

CI (GitHub Actions) — typecheck, lint, test, build на каждый push/PR.

## Настройка окружения

`.env.example`:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_OAUTH_CLIENT_ID=
```

Без них — понятная ошибка при запуске.

## Настройка Google

OAuth scopes (см. `src/services/firebaseAuth.ts`):

- `drive` — список/поиск скриптов и таблиц, создание папок бэкапов и снимков, копирование таблиц;
- `drive.scripts` — управление файлами standalone Apps Script на Drive;
- `spreadsheets` — чтение метаданных таблиц при биндинге;
- `script.projects` — чтение/запись контента Apps Script и `scripts.run`;
- `script.deployments` — создание версий и деплоев (для `scripts.run` нужен API-executable деплой).

Если Apps Script API 403: включите Apps Script API в Cloud Project, разрешите использование API для аккаунта, перелогиньтесь, проверьте блокировщики `*.googleapis.com`.

ID таблицы и Script ID — разные. Script ID: Sheets → Расширения → Apps Script → Настройки проекта → Идентификатор скрипта.

## Подключение GitHub

Вкладка GitHub:

- PAT (classic, с `repo` scope);
- owner/repo/branch/path;
- проверка токена через `/user`, список репозиториев.

Хранение токена:

- по умолчанию `sessionStorage` (стирается при закрытии вкладки);
- «Запомнить на этом устройстве» → `localStorage` (не используйте на общих ПК);
- маска `ghp_••••••••1234`, кнопка «Отключить» удаляет из обоих хранилищ;
- миграция легаси-ключей из `scriptvault_gh_config.token` и `scriptvault_saved_github_tokens`.

## Google Drive Backup

Вкладка «Настройки и Диск»:

- выбор/создание папки (по умолчанию `ScriptVault_Backups`);
- интервал автосинхронизации, выбор отслеживаемых скриптов;
- ручной бэкап, просмотр снимков, восстановление (с опциональным пушем в Apps Script);
- экспорт/импорт настроек JSON (без токена).

Снимок — JSON: `{scriptId, title, parentTitle, commitId, timestamp, files}`.

## Запуск функций

Для проекта извлекаются функции (`function name(...)`) и показывается селектор.

При наличии Google OAuth:

`POST https://script.googleapis.com/v1/scripts/{SCRIPT_ID}:run` с `devMode:true` (если владелец — выполняется последняя сохранённая версия, иначе — деплой).

Требования для облачного запуска:

1. В `appsscript.json` должен быть `"executionApi": {"access": "MYSELF"}` — кнопка «Добавить executionApi» в модалке Деплоя добавляет его и сохраняет проект.
2. Должен существовать деплой типа `EXECUTION_API` — создаётся в той же модалке (версия → деплой).

Если удалённый запуск недоступен — fallback в sandboxed Worker (см. «Ограничения локального runner»).

### Ограничения локального runner

Эмуляция, не полноценная среда Apps Script. Моки:

- `Logger.log`, `SpreadsheetApp` (getActiveSpreadsheet, getValues, appendRow, getRange, UI), `Utilities` (formatDate, base64), `Session` (getActiveUser), `MailApp.sendEmail`, `UrlFetchApp.fetch`.

Другие сервисы Apps Script работают только при облачном запуске.

## Локальная история версий

Хранится в IndexedDB (`idb`), квота localStorage больше не теряет историю. Каждая версия:

- id, message, author, timestamp, parent, branch, files, diff-статистика, статусы sync с Drive/GitHub.

Git-история в приложении — локальный механизм версионирования, не Git-репозиторий на диске. GitHub-коммиты — отдельно через GitHub API.

Авто-черновик: перед каждым пушем в Google/GitHub создаётся force-коммит `Draft <reason>`.

## Структура проекта

```
.
├── public/icons/          # PWA иконки 192/512
├── src/
│   ├── components/
│   │   ├── ActivityLog.tsx
│   │   ├── BackupDrivePanel.tsx
│   │   ├── BranchManager.tsx
│   │   ├── BranchTreeMap.tsx
│   │   ├── CodeWorkspace.tsx
│   │   ├── DeploymentManager.tsx      # версии/деплои Apps Script
│   │   ├── FileTabs.tsx
│   │   ├── GlobalSearchModal.tsx      # Ctrl+K поиск по всем проектам
│   │   ├── MonacoEditor.tsx           # локальный бандл Monaco
│   │   ├── ProjectToolbar.tsx
│   │   ├── RunToolbar.tsx             # Деплой + Запустить
│   │   ├── SettingsImportExport.tsx   # экспорт/импорт настроек
│   │   ├── SyntaxEditor.tsx           # undo/redo + Monaco
│   │   ├── ToastHost.tsx
│   │   └── ...
│   ├── services/
│   │   ├── appsScriptService.ts       # versions/deployments/scripts.run
│   │   ├── localRunnerWorker.ts       # sandboxed Worker runner
│   │   ├── projectSearch.ts           # full-text search
│   │   ├── syncMerge.ts               # 3-way merge
│   │   ├── tokenStore.ts              # session/local storage policy
│   │   ├── githubService.ts           # PR creation
│   │   ├── http.ts                    # apiFetch retry/backoff
│   │   ├── storage.ts                 # IndexedDB
│   │   └── ...
│   ├── store/appStore.ts              # Zustand + activeFileName/search
│   ├── types/
│   │   └── monaco-shim.d.ts           # обход переполнения стека tsc
│   ├── App.tsx
│   └── main.tsx
├── vite.config.ts                     # PWA + visualizer
├── firebase.json                      # CSP + hosting
├── PLAN.md
├── CHANGELOG.md
└── package.json
```

## Безопасность

- Не коммитьте реальные ключи/токены.
- `.env` только локально (в .gitignore).
- GitHub PAT — sessionStorage по умолчанию, localStorage только по согласию, маска, кнопка «Отключить».
- OAuth скоупы задокументированы с обоснованием.
- CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy в `firebase.json`.
- Локальный runner — в Worker без DOM/window, таймаут 15с.

## Скрипты

```
npm run dev          # dev на :3000, allowedHosts:true для превью
npm run build        # production + stats.html + PWA sw.js
npm run preview
npm run typecheck    # tsc strict
npm run lint
npm run format
npm run test         # 88 тестов
npm run clean
```

## Технологическая схема

```
                   ┌─────────────────────┐
                   │     ScriptVault     │
                   │ React + Vite + PWA  │
                   │ Monaco + Zustand    │
                   └──────────┬──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Google Apps     │  │   Google Drive  │  │     GitHub      │
│ Script API      │  │     API v3      │  │ REST + Git Data │
│ versions/deploys│  │  snapshots      │  │ + PR API        │
│ scripts.run     │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ IndexedDB (idb)  │
                    │ history/settings │
                    │ localStorage     │
                    │ current project  │
                    └──────────────────┘
```

## Текущий статус и честные ограничения

- Синхронизация — polling, не push. «Real-time» = частый опрос.
- Локальный runner — эмуляция, ограниченно (см. выше). Реальный запуск — через Apps Script API с деплоем.
- `scripts.run` требует executable deployment и `executionApi` в манифесте.
- История — в IndexedDB браузера, не на диске. При очистке браузера теряется (экспортируйте настройки и делайте Drive-бэкапы).
- GitHub PAT хранится в браузере — не используйте на чужих компьютерах с «Запомнить».
- PWA precache ~14MB из-за Monaco воркеров (ts.worker 5.9MB) — первая загрузка тяжёлая, но офлайн работает.
- План развития — в PLAN.md. Фаза D (Must+Should) завершена, Could частично (PWA, импорт/экспорт), Фаза E — релиз.

## Лицензия

Apache 2.0 — см. LICENSE.
