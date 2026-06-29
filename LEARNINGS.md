# LEARNINGS — building a VS Code inline-completion extension

This project is a **working prototype kept as a learning artifact**. The goal was
to learn how a Copilot-style VS Code extension is built, packaged, and shipped —
end to end. It works (real ghost-text completions were proven against the live
Gemini API), but it is **not intended for heavy daily use** — see *Cost reality*
below. Nothing here was in vain; the cycle is the lesson.

## The extension creation cycle (what we actually did)

1. **Manifest first (`package.json`)** — `contributes` is the whole surface:
   `commands`, `keybindings`, `configuration` (settings), `themes`, and `icon`.
   `activationEvents` + `main` decide when/what loads.
2. **Activation (`src/extension.ts`)** — `activate(context)` registers providers
   and commands, pushes everything to `context.subscriptions` for cleanup. A
   status-bar item doubles as proof-of-life.
3. **The core API — `InlineCompletionItemProvider`** — `provideInlineCompletionItems`
   returns ghost text. Real lessons: debounce typing, cancel stale requests with
   `AbortController` (VS Code cancels the token on every keystroke), and gate on a
   minimum prefix so it doesn't fire on empty lines.
4. **Secrets** — API keys belong in `context.secrets` (OS keychain via
   `SecretStorage`), never in `settings.json`.
5. **Bundling (`esbuild`)** — bundle `src/` into one `out/extension.js` with
   `vscode` marked external, so `node_modules` doesn't ship in the `.vsix`.
6. **Packaging & install (`@vscode/vsce`)** — `vsce package` → `.vsix`;
   `code --install-extension`. `.vscodeignore` controls what's in the package.
7. **The iterate loop** — edit → `tsc --noEmit` → `npm run build` → headless
   activation smoke test → `vsce package` → `code --install-extension --force` →
   **reload the VS Code window** (a running window keeps the old host until reload).

## Hard-won gotchas (each cost a real debugging round)

- **Audio from the extension host.** The host is plain Node — no audio API. On
  Windows, WPF `System.Windows.Media.MediaPlayer` plays **silence** from a
  detached process (no Dispatcher message pump). The fix was the **MCI API**
  (`winmm.dll mciSendString "play ... wait"`), driven via PowerShell
  `-EncodedCommand`. macOS uses `afplay`; Linux falls back through
  `ffplay`/`mpv`/`paplay`/`mpg123`.
- **Provider model quotas.** `gemini-2.0-flash` returned `429 limit: 0` — the
  model had **no free-tier quota** on the test key. `gemini-2.5-flash` worked.
  `gemini-1.5-flash` is `404` on `v1beta`. Read the 429 body — it tells you which.
- **Thinking models truncate completions.** `gemini-2.5-flash` "thinks" by
  default; with a small `maxOutputTokens`, reasoning ate the budget and the
  visible completion was cut to `onacci(n`. Setting `thinkingConfig.thinkingBudget: 0`
  restored the full `onacci(n-1) + fibonacci(n-2)`.
- **Provider abstraction pays off.** Sharing one prompt (`src/prompt.ts`) across
  an Anthropic backend (`claude.ts`, official SDK) and a Gemini backend
  (`gemini.ts`, raw `fetch`, zero deps) made adding Gemini a small change.
- **Prove what ships.** A bundle that *compiles* is not a feature that *works*.
  We caught the silent-audio bug and the model/thinking bugs only by running the
  actual emitted code path, not a hand-rebuilt approximation.

## Cost reality (why this is a prototype, not a daily driver)

Inline completion sends context to an LLM on a debounce as you type. This
extension **caps context** at `koyuki.maxContextLines` (80 lines each side of the
cursor) — it does **not** read the whole project — but even so:

- Every request bills the prefix+suffix as **input tokens**, repeatedly, whether
  or not you accept the suggestion.
- Larger context = better suggestions = more input tokens = more cost/latency.
- General-purpose chat models (Claude, Gemini) are priced for chat, not for
  thousands of tiny completions a day. Production tools (Copilot, etc.) use
  smaller, purpose-built, latency- and cost-optimized completion models.

**Takeaways:** keep `maxContextLines` small, prefer the cheapest fast model
(Haiku / `gemini-2.5-flash`), lean on the debounce, and treat this as a learning
build — not a cost-free Copilot replacement.

## Status

- ✅ Builds, bundles, packages, installs, activates (headless smoke).
- ✅ Windows feedback sounds verified (`playRC=0`).
- ✅ Gemini completions verified end-to-end on a live key
  (`gemini-2.5-flash`, thinking off): real `onacci(n-1) + fibonacci(n-2)`.
- ⚠️ Anthropic path is wired and unit-smoke-tested but unverified live (no credit).
- ⚠️ macOS/Linux audio coded but unverified (developed on Windows).
