import * as vscode from "vscode";

const SECRET_KEY = "koyuki.claudeApiKey";

export interface KoyukiConfig {
  enabled: boolean;
  model: string;
  maxTokens: number;
  debounceMs: number;
  maxContextLines: number;
  minimumPrefixLength: number;
  soundsEnabled: boolean;
  soundsVolume: number;
}

export function readConfig(): KoyukiConfig {
  const c = vscode.workspace.getConfiguration("koyuki");
  return {
    enabled: c.get<boolean>("enabled", true),
    model: c.get<string>("model", "claude-haiku-4-5"),
    maxTokens: c.get<number>("maxTokens", 256),
    debounceMs: c.get<number>("debounceMs", 450),
    maxContextLines: c.get<number>("maxContextLines", 80),
    minimumPrefixLength: c.get<number>("minimumPrefixLength", 2),
    soundsEnabled: c.get<boolean>("sounds.enabled", true),
    soundsVolume: clamp(c.get<number>("sounds.volume", 0.4), 0, 1),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * The Claude API key is stored in VS Code SecretStorage (OS keychain), never in
 * settings.json, so it is not synced or committed. Each user supplies their own.
 */
export async function getApiKey(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  // Allow an environment variable as a fallback for power users / CI.
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  const stored = await context.secrets.get(SECRET_KEY);
  return stored || fromEnv || undefined;
}

export async function setApiKey(
  context: vscode.ExtensionContext,
  key: string
): Promise<void> {
  await context.secrets.store(SECRET_KEY, key.trim());
}

export async function clearApiKey(
  context: vscode.ExtensionContext
): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}

export async function promptForApiKey(
  context: vscode.ExtensionContext
): Promise<boolean> {
  const key = await vscode.window.showInputBox({
    title: "Koyuki — Claude API Key",
    prompt:
      "Paste your Anthropic API key (sk-ant-...). It is stored securely in your OS keychain and never leaves this machine.",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "sk-ant-...",
    validateInput: (v) =>
      v.trim().startsWith("sk-ant-")
        ? undefined
        : "That doesn't look like an Anthropic key (expected to start with 'sk-ant-').",
  });
  if (!key) {
    return false;
  }
  await setApiKey(context, key);
  return true;
}
