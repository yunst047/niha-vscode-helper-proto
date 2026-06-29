import * as vscode from "vscode";
import { readConfig, getApiKey, promptForApiKey } from "./config";
import { fetchCompletion } from "./claude";
import { SoundPlayer } from "./sound";

export class KoyukiCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  private soundIndex = 0;
  private warnedNoKey = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly sound: SoundPlayer,
    private readonly output: vscode.OutputChannel
  ) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const cfg = readConfig();
    if (!cfg.enabled) {
      return undefined;
    }

    // Skip non-file schemes (output panels, scm input, etc.).
    if (document.uri.scheme === "output") {
      return undefined;
    }

    const prefixText = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    const recentPrefix = prefixText.slice(-200).replace(/\s/g, "");
    if (recentPrefix.length < cfg.minimumPrefixLength) {
      return undefined;
    }

    const apiKey = await getApiKey(this.context);
    if (!apiKey) {
      if (!this.warnedNoKey) {
        this.warnedNoKey = true;
        void vscode.window
          .showWarningMessage(
            "Koyuki needs your Claude API key to generate completions.",
            "Set API Key"
          )
          .then((choice) => {
            if (choice === "Set API Key") {
              void promptForApiKey(this.context);
            }
          });
      }
      return undefined;
    }
    this.warnedNoKey = false;

    // Debounce: wait out the idle window, abort if the user keeps typing
    // (VS Code cancels the token) or moves on.
    const debounced = await this.debounce(cfg.debounceMs, token);
    if (!debounced || token.isCancellationRequested) {
      return undefined;
    }

    const { prefix, suffix } = sliceContext(document, position, cfg.maxContextLines);

    const abort = new AbortController();
    const cancelSub = token.onCancellationRequested(() => abort.abort());

    try {
      const completion = await fetchCompletion({
        apiKey,
        model: cfg.model,
        maxTokens: cfg.maxTokens,
        languageId: document.languageId,
        prefix,
        suffix,
        fileName: document.fileName,
        signal: abort.signal,
      });

      if (token.isCancellationRequested || !completion.trim()) {
        return undefined;
      }

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
        return undefined; // user moved on; not an error
      }
      this.reportError(err, cfg.soundsEnabled, cfg.soundsVolume);
      return undefined;
    } finally {
      cancelSub.dispose();
    }
  }

  private reportError(err: unknown, soundsEnabled: boolean, volume: number): void {
    const message = err instanceof Error ? err.message : String(err);
    this.output.appendLine(`[${new Date().toISOString()}] completion error: ${message}`);

    if (soundsEnabled) {
      this.sound.play("negative", volume, this.soundIndex++);
    }

    // Surface auth/quota problems to the user; stay quiet on transient blips.
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      void vscode.window
        .showErrorMessage(
          "Koyuki: your Claude API key was rejected (401/403). Update it?",
          "Set API Key"
        )
        .then((choice) => {
          if (choice === "Set API Key") {
            void promptForApiKey(this.context);
          }
        });
    } else if (status === 429) {
      void vscode.window.setStatusBarMessage(
        "$(warning) Koyuki: rate limited by Anthropic — slowing down.",
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
    new vscode.Range(
      position,
      document.lineAt(endLine).range.end
    )
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
