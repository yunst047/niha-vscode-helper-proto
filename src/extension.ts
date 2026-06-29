import * as vscode from "vscode";
import { KoyukiCompletionProvider } from "./completionProvider";
import { SoundPlayer } from "./sound";
import { promptForApiKey, clearApiKey, readConfig } from "./config";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Koyuki Complete");
  context.subscriptions.push(output);
  output.appendLine("Koyuki Complete activated. Nihahaha~");

  const sound = new SoundPlayer(context.extensionPath);
  const provider = new KoyukiCompletionProvider(context, sound, output);

  const providerReg = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**" },
    provider
  );
  context.subscriptions.push(providerReg);

  context.subscriptions.push(
    vscode.commands.registerCommand("koyuki.setApiKey", async () => {
      const ok = await promptForApiKey(context);
      if (ok) {
        void vscode.window.showInformationMessage(
          "Koyuki: Claude API key saved to your OS keychain."
        );
      }
    }),
    vscode.commands.registerCommand("koyuki.clearApiKey", async () => {
      await clearApiKey(context);
      void vscode.window.showInformationMessage("Koyuki: Claude API key cleared.");
    }),
    vscode.commands.registerCommand("koyuki.toggle", async () => {
      const cfg = vscode.workspace.getConfiguration("koyuki");
      const next = !cfg.get<boolean>("enabled", true);
      await cfg.update("enabled", next, vscode.ConfigurationTarget.Global);
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
      await vscode.commands.executeCommand(
        "editor.action.inlineSuggest.trigger"
      );
    })
  );
}

export function deactivate(): void {
  /* nothing to clean up beyond disposables */
}
