# Changelog

Все заметные изменения в ScriptVault документируются в этом файле. Формат — по [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/), версионирование — SemVer.

## [Unreleased] — фиксы редактора, темы и запуска русских функций

### Fixed
- **Окно редактора было невидимым.** Область Monaco имела вычисляемую высоту 0 (родитель `flex-1` без заданной высоты внутри карточки с `height: auto`), поэтому редактор монтировался в бокс 0×0 и «появлялся» только после ручного fullscreen-тугла, который давал панели реальные пиксели; возврат на вкладку → ремоунт → снова пусто. Теперь у панели редактора явная высота (`h-[55vh] lg:h-[62vh]`, `min-h-[280px]`), редактор заполняет её и скроллится внутри.
- **Белый фон при первой загрузке.** Тема `scriptvault-dark` регистрировалась в `onMount`, то есть уже после создания инстанса Monaco — первый рендер шёл в светлой `vs`-теме. `installAppsScriptIntelligence()` (вместе с `defineTheme`) теперь выполняется на уровне модуля, гарантированно до монтирования редактора.
- **Fullscreen редактора**: закрытие по `Esc`, блокировка скролла `body` на время разворота, принудительный `layout()` при монтировании и при каждом переключении fullscreen, тулбар переносится на узких экранах вместо распирания панели.
- **Функции с русскими именами не находились** — из-за этого в списке «Функция:» для запуска и деплоя не было `function отправитьОтчёт() {}`: `extractFunctionsFromCode` использовал ASCII-класс `[a-zA-Z0-9_$]`. Теперь применяется Unicode-паттерн идентификатора JS (`\p{ID_Start}`/`\p{ID_Continue}`), поддерживаются кириллица, греческий и др.
- Локальный runner: имя функции проверяется как валидный JS-идентификатор перед интерполяцией в `new Function`, сообщение «Функция не найдена в коде проекта.» больше не содержит имя (убран лишний уровень кавычек).
- Кнопка «Копировать код» в тулбаре редактора копирует актуальное содержимое редактора, а не последний сохранённый проп.
- Тёмный фон отрисован ещё до загрузки бандла: `color-scheme: dark` + фон `#020617` в `<style>` внутри `index.html`, без белой вспышки страницы.

### Added
- `src/services/javascriptIdentifier.ts` — Unicode-паттерн JS-идентификатора + `isJavaScriptIdentifier` (с тестами) для извлечения функций и раннера.
- Тесты на кириллические имена функций (`extractFunctionsFromCode`).

### Changed
- **Шрифт редактора**: подключён self-hosted `@fontsource-variable/jetbrains-mono` (подмножество cyrillic, ~12 КБ woff2), `--font-mono` переопределён в Tailwind `@theme`, Monaco использует тот же стек — кириллица больше не рисуется тофу-боксами.
- `index.html`: `lang="ru"`.
- `bun.lock` перегенерирован: прежний lock не проходил `bun install --frozen-lockfile` (CI падал на шаге установки зависимостей). `monaco-editor` перенесён в `devDependencies` (нужен только на этапе сборки).

## [0.5.0] — 2026-10-07 — Phase D Should + Could (PWA, PR, Search)

### Added
- **Monaco Editor 0.52.2** вместо Prism + react-simple-code-editor: локальный бандл (без CDN), воркеры JS/TS/HTML/JSON/CSS, мини-карта, встроенный поиск/замена, автодополнение Apps Script API (extraLib + 21 сервис), загрузка отдельным чанком с textarea-fallback. `monaco-shim.d.ts` + `paths` в tsconfig для обхода переполнения стека tsc 6.0.3.
- **Честный запуск**: UI «Деплой» (RunToolbar Rocket): `listVersions/createVersion/listDeployments/createDeployment/updateDeploymentVersion/isApiExecutable`, бейдж API executable, кнопка добавления `executionApi` в `appsscript.json`; скоуп `script.deployments`; локальный runner перенесён в **Web Worker** (без DOM/window, таймаут 15с), 6 тестов deployments.
- **Восстановление из Drive**: кнопка «Восстановить» на каждом снимке + модалка (опциональный пуш в Apps Script), `parseSnapshotPayload` с валидацией, git-коммит восстановления.
- **Конфликт-детект**: `syncMerge.ts` 3-way merge (local/remote/baseline), модалка `SyncConflictModal` с построчным diff, 11 тестов.
- **Toasts**: `ToastHost`, auto-hide 6с, max 4, счётчики ошибок/предупреждений в ActivityLog.
- **Глобальный поиск**: `projectSearch.ts` full-text по всем проектам/файлам (case-insensitive, превью, cap 200), `GlobalSearchModal` Ctrl+K/Cmd+K, навигация ↑↓/Enter/Esc, открытие файла через `activeFileName` в store, 5 тестов.
- **Undo/Redo**: кнопки в SyntaxEditor (Monaco trigger undo/redo), `onEditorMount` ref.
- **Авто-черновик**: перед каждым пушем в Google/GitHub — force-коммит `Draft <reason>`.
- **GitHub PR**: `createPullRequest` API, UI в GitHubPanel (модалка base/head/title, создание ветки → пуш → PR), 3 теста.
- **Настройки импорт/экспорт**: `SettingsImportExport` — экспорт syncSettings + gitHubConfig (без токена) в JSON, импорт с мержем.
- **PWA**: `vite-plugin-pwa` v2, autoUpdate, Workbox precache 103 ассета (~14MB), `maximumFileSizeToCacheInBytes` 10MB для Monaco воркеров, иконки 192/512, manifest.
- **Bundle analysis**: `rollup-plugin-visualizer` → `dist/stats.html` с gzip/brotli.
- **История операций**: фильтр по категориям, счётчики, экспорт в txt — уже было, отмечено как done.

### Changed
- `tsconfig.json`: `strict:true`, явный `include`, `paths` для monaco shim.
- `firebaseAuth.ts`: добавлен скоуп `script.deployments`, документация скоупов.
- `appsScriptService.ts`: `runAppsScriptFunction` теперь через `localRunnerWorker?worker` (async, sandboxed).
- `appStore.ts`: `activeFileName`, `isSearchOpen`, `setSearchOpen`, `setActiveFileName`.
- `vite.config.ts`: PWA + visualizer, `chunkSizeWarningLimit` 1024, `allowedHosts:true`.
- `package.json`: `scriptvault`, `monaco-editor`, `@monaco-editor/react`, `idb`, `zustand`, убраны `prismjs/react-simple-code-editor`.

### Fixed
- tsc переполнение стека от `monaco.d.ts` (45k строк) — shim + paths.
- tsc крэш на default include без явного списка — добавлен явный `include`.
- `react-simple-code-editor` отсутствовал после удаления — переход на Monaco.
- Lint: `no-useless-escape` от экранированных кавычек в template literals и regex.

### Security
- GitHub PAT: по умолчанию `sessionStorage`, opt-in «Запомнить» → `localStorage`, маска `••••`, миграция легаси-ключей `scriptvault_gh_config.token` и `scriptvault_saved_github_tokens`.
- CSP и security-заголовки в `firebase.json`.
- Локальный runner в Worker без доступа к DOM/window.

## [0.4.0] — 2026-10-06 — Phase C Architecture

### Added
- Zustand стор `useAppStore` — auth, ui, projects, settings, logs, sync status.
- IndexedDB (`idb`) для истории коммитов, миграция из localStorage.
- `http.ts` `apiFetch` с retry 429, 5xx только для идемпотентных, Retry-After, jitter.
- Разбор гигантских компонентов: `CodeWorkspace` → `ProjectToolbar/FileTabs/RunToolbar/ExecutionConsole/SyntaxEditor`, `GitHubPanel` → `BranchManager/RemoteCommitsFeed`, `BackupDrivePanel` → `FolderPickerModal/SnapshotList`.
- i18n: центральные словари ru/en + хук `t()`.
- Sync cancel via `AbortController`, защита от параллельных запусков.

### Changed
- `App.tsx` — тонкая оболочка, вся логика в store.
- `gitService` — diff, коммиты, откат, тесты.

## [0.3.0] — 2026-10-05 — Phase B Security + Phase A Foundation

### Added
- ESLint 9 flat config (typescript-eslint, react-hooks, unused-imports) + Prettier.
- GitHub Actions CI: typecheck + lint + test + build.
- ErrorBoundary.
- Vitest + happy-dom + fake-indexeddb, 31 тест на `gitService` и `appsScriptService`.
- `tokenStore`: политика хранения, маскирование, миграция легаси.
- `LICENSE` Apache 2.0, `.nvmrc`, `engines`.

### Fixed
- TypeScript закреплён на 6.0.3 (typescript-eslint не поддерживает TS 7).

## [0.2.0] — 2026-10-04 — Cleanup P0

### Removed
- `metadata.json`, `firebase-applet-config.json`.
- Неиспользуемые зависимости: `@google/genai`, `express`, `@types/express`, `dotenv`, `esbuild`, `tsx`, `motion`, `autoprefixer`.
- Демо-проекты по умолчанию — теперь кнопка «Загрузить демо».

### Changed
- `.env.example` под `VITE_*`, `firebaseAuth.ts` читает `import.meta.env`.
- `vite.config.ts` почищен от `DISABLE_HMR`, `package.json` clean.
- README — честные формулировки про polling, актуальная структура.

## [0.1.0] — Initial — Google AI Studio template

- Базовый функционал: загрузка Apps Script по ID, редактор Prism, запуск через `scripts.run` с fallback `new Function`, локальная история в localStorage, Drive бэкапы, GitHub пуш, автосинхронизация polling.
