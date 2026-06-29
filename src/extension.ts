import * as vscode from "vscode";
import { KoyukiCompletionProvider } from "./completionProvider";
import { SoundPlayer } from "./sound";
import {
  promptForApiKey,
  clearApiKey,
  readConfig,
  getApiKey,
  selectProvider,
} from "./config";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Koyuki Complete");
  context.subscriptions.push(output);
  const log = (m: string) =>
    output.appendLine(`[${new Date().toLocaleTimeString()}] ${m}`);
  log("Koyuki Complete activated. Nihahaha~");

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  status.text = "$(sparkle) Koyuki";
  status.tooltip = "Koyuki Complete — click to show logs";
  status.command = "koyuki.showLogs";
  status.show();
  context.subscriptions.push(status);

  // Report active provider + whether its key is set (never print the key).
  void (async () => {
    const cfg = readConfig();
    const key = await getApiKey(context, cfg.provider);
    log(`provider: ${cfg.provider} (model ${cfg.model})`);
    log(
      `API key: ${
        key ? "present" : `MISSING — run 'Koyuki: Set API Key' for ${cfg.provider}`
      }`
    );
    if (!key) {
      status.text = "$(key) Koyuki";
      status.tooltip = `Koyuki: set your ${cfg.provider} API key`;
    }
  })();

  const sound = new SoundPlayer(context.extensionPath);
  const provider = new KoyukiCompletionProvider(context, sound, output, status);

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("koyuki.showLogs", () => output.show(true)),
    vscode.commands.registerCommand("koyuki.setApiKey", async () => {
      const { provider: p } = readConfig();
      const ok = await promptForApiKey(context, p);
      if (ok) {
        status.text = "$(sparkle) Koyuki";
        status.tooltip = "Koyuki Complete — click to show logs";
        log(`API key saved for ${p}.`);
        void vscode.window.showInformationMessage(
          `Koyuki: ${p} API key saved to your OS keychain.`
        );
      }
    }),
    vscode.commands.registerCommand("koyuki.clearApiKey", async () => {
      const { provider: p } = readConfig();
      await clearApiKey(context, p);
      void vscode.window.showInformationMessage(`Koyuki: ${p} API key cleared.`);
    }),
    vscode.commands.registerCommand("koyuki.selectProvider", async () => {
      const chosen = await selectProvider(context);
      if (!chosen) {
        return;
      }
      log(`provider switched to ${chosen}.`);
      const key = await getApiKey(context, chosen);
      if (!key) {
        const ok = await promptForApiKey(context, chosen);
        if (ok) {
          status.text = "$(sparkle) Koyuki";
          log(`API key saved for ${chosen}.`);
        }
      }
      void vscode.window.showInformationMessage(
        `Koyuki: now using ${chosen}.`
      );
    }),
    vscode.commands.registerCommand("koyuki.toggle", async () => {
      const c = vscode.workspace.getConfiguration("koyuki");
      const next = !c.get<boolean>("enabled", true);
      await c.update("enabled", next, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        `Koyuki inline completions ${next ? "enabled" : "disabled"}.`
      );
    }),
    vscode.commands.registerCommand("koyuki.triggerCompletion", async () => {
      if (!readConfig().enabled) {
        await vscode.workspace
          .getConfiguration("koyuki")
          .update("enabled", true, vscode.ConfigurationTarget.Global);
      }
      await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
    })
  );
}

export function deactivate(): void {
  /* disposables handle cleanup */
}
