# Koyuki Complete — Claude Inline AI

Copilot-style **inline autocomplete** for VS Code, powered by the **Claude API**
with **your own API key**. Defaults to the low-cost `claude-haiku-4-5` model so
casual use stays cheap. Ships with the **Koyuki Dark** color theme and playful
audio feedback (a positive ping on a suggestion, an alert on errors).

> Nihahaha~ 🩷

## Features

- **Ghost-text completions** as you type, via VS Code's native inline completion
  API — accept with `Tab`, like Copilot.
- **Bring your own key.** Your Anthropic key is stored in the **OS keychain**
  (VS Code `SecretStorage`), never in settings or synced anywhere.
- **Low cost by default.** Uses `claude-haiku-4-5`; switch models in settings.
- **Cost controls:** debounce, context-window limit, max-tokens cap, and a
  minimum-prefix gate to avoid firing on an empty line.
- **Audio feedback:** positive cue on suggestion, alert cue on error
  (toggleable, with volume control).
- **Koyuki Dark** color theme included.

## Quick start

1. Install the extension (see *Build & install locally* below, or *Publishing*).
2. Run **`Koyuki: Set Claude API Key`** from the Command Palette and paste your
   key (`sk-ant-...`). Get one at <https://console.anthropic.com/>.
3. Start typing in any file. Ghost text appears after a short pause — press
   `Tab` to accept.
4. Select **Koyuki Dark** via *Preferences: Color Theme* if you want the theme.

Manual trigger: `Ctrl+Alt+\` (`Cmd+Alt+\` on macOS).

## Commands

| Command | What it does |
| --- | --- |
| `Koyuki: Set Claude API Key` | Store your Anthropic key in the OS keychain |
| `Koyuki: Clear Claude API Key` | Remove the stored key |
| `Koyuki: Toggle Inline Completions` | Turn completions on/off |
| `Koyuki: Trigger Inline Completion Now` | Force a suggestion at the cursor |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `koyuki.enabled` | `true` | Master on/off switch |
| `koyuki.model` | `claude-haiku-4-5` | Claude model id |
| `koyuki.maxTokens` | `256` | Max tokens per completion |
| `koyuki.debounceMs` | `450` | Idle delay before requesting |
| `koyuki.maxContextLines` | `80` | Lines of context sent each side of the cursor |
| `koyuki.minimumPrefixLength` | `2` | Min non-whitespace chars before firing |
| `koyuki.sounds.enabled` | `true` | Play feedback sounds |
| `koyuki.sounds.volume` | `0.4` | Sound volume (0.0–1.0) |

The key can also be supplied via the `ANTHROPIC_API_KEY` environment variable.

## Cost

You are billed by Anthropic for your own usage. `claude-haiku-4-5` is the
cheapest current model (~$1 / $5 per million input/output tokens). The debounce,
context cap, and `maxTokens` settings keep request size small. Watch your usage
in the Anthropic Console.

## How it works

The extension implements `vscode.InlineCompletionItemProvider`. On each trigger
(after the debounce) it sends the code before and after the cursor to
`messages.create` with a fill-in-the-middle system prompt and inserts the
returned text as ghost text. Requests are cancelled (via `AbortController`) when
you keep typing, so you never pay for stale completions. The extension is
bundled with esbuild into a single file — no `node_modules` ship in the `.vsix`.

## Build & install locally

```bash
npm install
npm run build           # bundles src/ -> out/extension.js
npm run package         # produces koyuki-complete-0.1.0.vsix
code --install-extension koyuki-complete-0.1.0.vsix
```

Or press `F5` in VS Code to launch an Extension Development Host.

## Audio playback

VS Code's extension host has no audio API, so sounds are played by shelling out
to the platform player: PowerShell `MediaPlayer` on Windows, `afplay` on macOS,
and `ffplay`/`mpv`/`paplay`/`mpg123` on Linux (best-effort; first found wins).

## Fair use / third-party assets

The Koyuki imagery and sound clips are third-party assets included under a
non-commercial fair-use rationale. **Read [`NOTICE.md`](./NOTICE.md) before
distributing.** Replace them with your own/licensed assets before any public
release. The code and theme are MIT-licensed (see [`LICENSE`](./LICENSE)).

## Publishing

See [`PUBLISHING.md`](./PUBLISHING.md) for the manual Marketplace / OpenVSX steps.
