import * as vscode from "vscode";
import { readConfig, getApiKey, promptForApiKey } from "./config";
import { fetchClaudeCompletion } from "./claude";
import { fetchGeminiCompletion } from "./gemini";
import { Provider } from "./prompt";
import { SoundPlayer } from "./sound";

export class KoyukiCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private soundIndex = 0;
  private warnedNoKey = false;
  private seq = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly sound: SoundPlayer,
    private readonly output: vscode.OutputChannel,
    private readonly status: vscode.StatusBarItem
  ) {}

  private log(msg: string): void {
    this.output.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  private setState(icon: string, text: string, tip?: string): void {
    this.status.text = `${icon} Koyuki`;
    this.status.tooltip = tip ?? text;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const id = ++this.seq;
    const cfg = readConfig();

    if (!cfg.enabled) {
      this.log(`#${id} skip: koyuki.enabled is false`);
      this.setState("$(circle-slash)", "disabled");
      return undefined;
    }
    if (document.uri.scheme === "output") {
      return undefined;
    }

    const prefixText = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    const recentPrefix = prefixText.slice(-200).replace(/\s/g, "");
    if (recentPrefix.length < cfg.minimumPrefixLength) {
      this.log(
        `#${id} skip: prefix too short (${recentPrefix.length} < ${cfg.minimumPrefixLength}) — type a bit more`
      );
      return undefined;
    }

    const apiKey = await getApiKey(this.context, cfg.provider);
    if (!apiKey) {
      this.log(`#${id} skip: NO API KEY for ${cfg.provider} (run "Koyuki: Set API Key")`);
      this.setState("$(key)", "no key", `Koyuki: set your ${cfg.provider} API key`);
      if (!this.warnedNoKey) {
        this.warnedNoKey = true;
        void vscode.window
          .showWarningMessage(
            `Koyuki needs your ${cfg.provider} API key to generate completions.`,
            "Set API Key"
          )
          .then((choice) => {
            if (choice === "Set API Key") {
              void promptForApiKey(this.context, cfg.provider);
            }
          });
      }
      return undefined;
    }
    this.warnedNoKey = false;

    this.log(
      `#${id} trigger: ${document.languageId} @ ${position.line + 1}:${
        position.character + 1
      } (${cfg.provider}/${cfg.model}, debounce ${cfg.debounceMs}ms)`
    );

    const debounced = await this.debounce(cfg.debounceMs, token);
    if (!debounced || token.isCancellationRequested) {
      this.log(`#${id} cancelled during debounce (you kept typing — normal)`);
      return undefined;
    }

    const { prefix, suffix } = sliceContext(document, position, cfg.maxContextLines);

    const abort = new AbortController();
    const cancelSub = token.onCancellationRequested(() => abort.abort());

    this.setState("$(sync~spin)", "thinking…", `Koyuki is asking ${cfg.provider}…`);
    const t0 = Date.now();
    try {
      const fetchFn =
        cfg.provider === "gemini" ? fetchGeminiCompletion : fetchClaudeCompletion;
      const completion = await fetchFn({
        apiKey,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        languageId: document.languageId,
        prefix,
        suffix,
        fileName: document.fileName,
        signal: abort.signal,
      });

      const ms = Date.now() - t0;
      if (token.isCancellationRequested) {
        this.log(`#${id} cancelled after fetch (${ms}ms)`);
        this.setState("$(sparkle)", "idle");
        return undefined;
      }
      if (!completion.trim()) {
        this.log(`#${id} empty completion (${ms}ms) — model had nothing to add`);
        this.setState("$(sparkle)", "idle");
        return undefined;
      }

      const preview = completion.replace(/\n/g, "\\n").slice(0, 60);
      this.log(`#${id} SUGGESTED (${ms}ms, ${completion.length} chars): "${preview}"`);
      this.setState("$(check)", "suggested", "Koyuki suggested — press Tab");

      if (cfg.soundsEnabled) {
        this.sound.play("positive", cfg.soundsVolume, this.soundIndex++);
      }

      const item = new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position)
      );
      return [item];
    } catch (err: unknown) {
      if (isAbort(err)) {
        this.log(`#${id} aborted (you moved on)`);
        this.setState("$(sparkle)", "idle");
        return undefined;
      }
      this.reportError(id, err, cfg.provider, cfg.soundsEnabled, cfg.soundsVolume);
      return undefined;
    } finally {
      cancelSub.dispose();
    }
  }

  private reportError(
    id: number,
    err: unknown,
    provider: Provider,
    soundsEnabled: boolean,
    volume: number
  ): void {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);
    this.log(`#${id} ERROR${status ? ` (HTTP ${status})` : ""}: ${message}`);
    this.setState("$(error)", "error", `Koyuki error: ${message}`);

    if (soundsEnabled) {
      this.sound.play("negative", volume, this.soundIndex++);
    }

    if (status === 401 || status === 403) {
      void vscode.window
        .showErrorMessage(
          `Koyuki: your ${provider} API key was rejected (${status}). Update it?`,
          "Set API Key"
        )
        .then((choice) => {
          if (choice === "Set API Key") {
            void promptForApiKey(this.context, provider);
          }
        });
    } else if (status === 429) {
      void vscode.window.setStatusBarMessage(
        `$(warning) Koyuki: rate limited by ${provider} — slowing down.`,
        4000
      );
    }
  }

  private debounce(
    ms: number,
    token: vscode.CancellationToken
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        sub.dispose();
        resolve(true);
      }, ms);
      const sub = token.onCancellationRequested(() => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }
}

/** Grab up to `maxLines` of context on each side of the cursor. */
function sliceContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxLines: number
): { prefix: string; suffix: string } {
  const startLine = Math.max(0, position.line - maxLines);
  const endLine = Math.min(document.lineCount - 1, position.line + maxLines);

  const prefix = document.getText(
    new vscode.Range(new vscode.Position(startLine, 0), position)
  );
  const suffix = document.getText(
    new vscode.Range(position, document.lineAt(endLine).range.end)
  );
  return { prefix, suffix };
}

function isAbort(err: unknown): boolean {
  if (!err) {
    return false;
  }
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "APIUserAbortError";
}
