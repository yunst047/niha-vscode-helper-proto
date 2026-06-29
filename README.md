# Koyuki Complete — Inline AI (Claude / Gemini)

A Copilot-*style* **inline autocomplete** prototype for VS Code, powered by **your
own API key** — Anthropic Claude *or* Google Gemini (free tier). It puts ghost
text after your cursor; accept with `Tab`. Ships with the **Koyuki Dark** color
theme and playful audio feedback (a positive ping on a suggestion, an alert on
errors).

> Nihahaha~ 🩷

> **Status: a working *learning prototype* — not a product.** It was built
> end-to-end to learn the VS Code extension lifecycle, and the Gemini path is
> proven on a live key. It is **far from GitHub Copilot** and **not architected
> for real daily use** — read the honest [Conclusion](#point-of-interest--honest-conclusion)
> and [`LEARNINGS.md`](./LEARNINGS.md) before you expect Copilot from it.

## Features

- **Ghost-text completions** as you type, via VS Code's native inline completion
  API — accept with `Tab`.
- **Two providers:** Anthropic Claude or Google Gemini. Switch with
  **`Koyuki: Select Provider`**. Each keeps its **own** key.
- **Bring your own key**, stored in the **OS keychain** (`SecretStorage`) — never
  in settings, never synced.
- **Cost controls:** debounce, a context-line cap, a max-tokens cap, and a
  minimum-prefix gate so it doesn't fire on an empty line.
- **Audio feedback** (toggleable, with volume), a **status bar** state, and a
  **decision log** (`Koyuki: Show Logs`) so you can see exactly what it's doing.
- **Koyuki Dark** color theme.

## Providers — Claude or Gemini

| Provider | Setting `koyuki.provider` | Default model | Cost |
| --- | --- | --- | --- |
| Anthropic Claude | `anthropic` | `claude-haiku-4-5` | needs API credit |
| Google Gemini | `gemini` | `gemini-2.5-flash` | **has a free tier** (verified) |

Each provider keeps its **own** key in the OS keychain. Get keys at
<https://console.anthropic.com/> (Claude) or
<https://aistudio.google.com/apikey> (Gemini — free).

> **Gemini notes (learned the hard way):**
> - `gemini-2.5-flash` is the verified-working free-tier default. `gemini-2.0-flash`
>   returned `429 limit: 0` (no free-tier quota) on a test key; `gemini-1.5-flash`
>   is `404` on `v1beta`. If you hit `429 limit: 0`, that *model* has no free quota
>   on your key — switch `koyuki.geminiModel` to another `*-flash` model.
> - 2.5 models "think" by default, which eats the output budget and truncates
>   completions — Koyuki disables thinking (`thinkingBudget: 0`) automatically.

## Quick start

1. Install the extension (see *Build & install locally* below).
2. Run **`Koyuki: Select Provider`** → choose **Gemini** (free) or **Claude**,
   then paste the key when prompted.
3. Start typing in a file. Ghost text appears after a short pause — press `Tab`
   to accept.
4. Optional: select **Koyuki Dark** via *Preferences: Color Theme*.

Manual trigger: `Ctrl+Alt+\` (`Cmd+Alt+\` on macOS). After installing a new
version, **reload the window** (`Developer: Reload Window`) — a running window
keeps the old extension host until reload.

## Commands

| Command | What it does |
| --- | --- |
| `Koyuki: Select Provider (Claude / Gemini)` | Switch provider and set its key |
| `Koyuki: Set API Key (current provider)` | Store the active provider's key in the OS keychain |
| `Koyuki: Clear API Key (current provider)` | Remove the active provider's key |
| `Koyuki: Toggle Inline Completions` | Turn completions on/off |
| `Koyuki: Trigger Inline Completion Now` | Force a suggestion at the cursor |
| `Koyuki: Show Logs` | Open the decision log (also opens by clicking the status bar) |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `koyuki.enabled` | `true` | Master on/off switch |
| `koyuki.provider` | `anthropic` | `anthropic` or `gemini` |
| `koyuki.model` | `claude-haiku-4-5` | Claude model id (when provider is `anthropic`) |
| `koyuki.geminiModel` | `gemini-2.5-flash` | Gemini model id (when provider is `gemini`) |
| `koyuki.maxTokens` | `256` | Max tokens per completion |
| `koyuki.debounceMs` | `450` | Idle delay before requesting |
| `koyuki.maxContextLines` | `80` | Lines of context sent each side of the cursor |
| `koyuki.minimumPrefixLength` | `2` | Min non-whitespace chars before firing |
| `koyuki.sounds.enabled` | `true` | Play feedback sounds |
| `koyuki.sounds.volume` | `0.4` | Sound volume (0.0–1.0) |

Keys may also be supplied via env vars: `ANTHROPIC_API_KEY` (Claude) or
`GEMINI_API_KEY` / `GOOGLE_API_KEY` (Gemini).

## Cost

You are billed by the provider for your own usage. Gemini has a **free tier**
(`gemini-2.5-flash`); Claude's `claude-haiku-4-5` is ~$1 / $5 per million
input/output tokens. The debounce, the `koyuki.maxContextLines` cap (80 lines
each side — **it does not read the whole project**), and `maxTokens` keep each
request small. Even so, every request bills its context as input tokens — see the
[Conclusion](#point-of-interest--honest-conclusion).

## How it works

The extension implements `vscode.InlineCompletionItemProvider`. On each trigger
(after the debounce) it slices the code before/after the cursor (capped by
`maxContextLines`) and sends it with a fill-in-the-middle prompt — to the
Anthropic SDK (`messages.create`) or Gemini's REST API (`generateContent` via
`fetch`). Stale requests are cancelled with `AbortController`, so you don't pay
for completions you typed past. Bundled with esbuild into one file — no
`node_modules` ship in the `.vsix`.

## Build & install locally

```bash
npm install
npm run build           # bundles src/ -> out/extension.js
npm run package         # produces koyuki-complete-<version>.vsix
code --install-extension koyuki-complete-0.2.1.vsix --force
```

Or press `F5` in VS Code to launch an Extension Development Host.

## Audio playback

VS Code's extension host has no audio API, so sounds are played by shelling out
to the platform player. **On Windows, Koyuki uses the MCI API**
(`winmm.dll mciSendString "play ... wait"`) via PowerShell `-EncodedCommand` —
WPF's `MediaPlayer` was tried first and played *silence* (a detached process has
no Dispatcher message pump). macOS uses `afplay`; Linux falls back through
`ffplay` / `mpv` / `paplay` / `mpg123` (first found wins).

## Fair use / third-party assets

The Koyuki imagery and sound clips are third-party assets included under a
non-commercial fair-use rationale. **Read [`NOTICE.md`](./NOTICE.md) before
distributing.** Replace them with your own/licensed assets before any public
release. The code and theme are MIT-licensed (see [`LICENSE`](./LICENSE)).

## Publishing

See [`PUBLISHING.md`](./PUBLISHING.md) for the manual Marketplace / Open VSX steps.

---

## Point of interest — honest conclusion

**This is a learning prototype. It is meaningfully *lesser* than GitHub Copilot,
and it is the wrong architecture for serious use.** That's stated plainly on
purpose:

- **Far from Copilot.** Copilot (and similar) run small, purpose-built,
  latency-and-cost-optimized *completion* models with real fill-in-the-middle
  training, server-side caching, multi-line streaming, and tight editor
  integration. Koyuki calls a **general-purpose chat model over a network round
  trip per debounced request** — higher latency, weaker at raw completion, and no
  partial/streaming acceptance.
- **Wrongly architected for the job, insufficient for daily use.** Sending
  prefix+suffix context to a chat API on a debounce is fine for a *demo*, not for
  thousands of completions a day. It re-sends context as **input tokens every
  request** (whether or not you accept), there's no caching of the working set,
  and a chat model's pricing/latency is simply not designed for this workload.
  The context cap helps cost but caps quality; you can't win both with this
  design.
- **Measured reality, not theory.** On the Gemini free tier this **rate-limited
  after roughly 5–10 completions** — unusable for an actual coding session. And
  that's the *free* failure mode: with billing enabled it would not stop, it
  would **bill every keystroke-batch's full context as input tokens**, so normal
  typing racks up serious cost fast. Free = dies in minutes; paid = a meter
  running on every pause you take while typing. Neither is a Copilot.
- **The real lesson — AI is not a lazy-mind wish machine.** You cannot just *say*
  "make me a Copilot" and have a finished product appear. Building even this
  prototype took real architecture choices and **several genuine debugging
  rounds** that no amount of wishing skipped: WPF audio playing silence (→ MCI),
  a model with `429 limit: 0` (→ swap models), a thinking model truncating output
  (→ disable thinking), and the stale-extension-host reload trap. Each was found
  by *running the actual code and reading the error*, not by assuming it worked.
  AI accelerates the typing and the research; it does **not** replace
  understanding, verification, and the willingness to debug. A lazy mind ships
  the version that plays silence and calls it done.

If you want a production inline assistant, use a purpose-built one. If you want to
*understand how one is wired* — and why it costs what it costs — this repo and
[`LEARNINGS.md`](./LEARNINGS.md) are the honest map.
