import * as vscode from "vscode";
import { Provider } from "./prompt";

export interface KoyukiConfig {
  enabled: boolean;
  provider: Provider;
  model: string; // resolved model for the active provider
  maxTokens: number;
  debounceMs: number;
  maxContextLines: number;
  minimumPrefixLength: number;
  soundsEnabled: boolean;
  soundsVolume: number;
}

export function readConfig(): KoyukiConfig {
  const c = vscode.workspace.getConfiguration("koyuki");
  const provider = normalizeProvider(c.get<string>("provider", "anthropic"));
  const model =
    provider === "gemini"
      ? c.get<string>("geminiModel", "gemini-2.0-flash")
      : c.get<string>("model", "claude-haiku-4-5");
  return {
    enabled: c.get<boolean>("enabled", true),
    provider,
    model,
    maxTokens: c.get<number>("maxTokens", 256),
    debounceMs: c.get<number>("debounceMs", 450),
    maxContextLines: c.get<number>("maxContextLines", 80),
    minimumPrefixLength: c.get<number>("minimumPrefixLength", 2),
    soundsEnabled: c.get<boolean>("sounds.enabled", true),
    soundsVolume: clamp(c.get<number>("sounds.volume", 0.4), 0, 1),
  };
}

function normalizeProvider(v: string): Provider {
  return v === "gemini" ? "gemini" : "anthropic";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---- API keys (per provider) -------------------------------------------------
// Keys live in VS Code SecretStorage (OS keychain), one per provider, so they
// are never written to settings.json or synced.

function secretKey(provider: Provider): string {
  return `koyuki.apiKey.${provider}`;
}

function envKey(provider: Provider): string | undefined {
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
  }
  return process.env.ANTHROPIC_API_KEY || undefined;
}

export async function getApiKey(
  context: vscode.ExtensionContext,
  provider: Provider
): Promise<string | undefined> {
  const stored = await context.secrets.get(secretKey(provider));
  return stored || envKey(provider) || undefined;
}

export async function setApiKey(
  context: vscode.ExtensionContext,
  provider: Provider,
  key: string
): Promise<void> {
  await context.secrets.store(secretKey(provider), key.trim());
}

export async function clearApiKey(
  context: vscode.ExtensionContext,
  provider: Provider
): Promise<void> {
  await context.secrets.delete(secretKey(provider));
}

interface ProviderMeta {
  label: string;
  placeholder: string;
  hint: string;
  validate: (v: string) => string | undefined;
}

const PROVIDER_META: Record<Provider, ProviderMeta> = {
  anthropic: {
    label: "Anthropic Claude",
    placeholder: "sk-ant-...",
    hint: "Paste your Anthropic API key (console.anthropic.com).",
    validate: (v) =>
      v.trim().startsWith("sk-ant-")
        ? undefined
        : "Anthropic keys start with 'sk-ant-'.",
  },
  gemini: {
    label: "Google Gemini",
    placeholder: "AIza...",
    hint: "Paste your Gemini API key (aistudio.google.com/apikey) — free tier available.",
    validate: (v) =>
      v.trim().length > 10 ? undefined : "That key looks too short.",
  },
};

export async function promptForApiKey(
  context: vscode.ExtensionContext,
  provider: Provider
): Promise<boolean> {
  const meta = PROVIDER_META[provider];
  const key = await vscode.window.showInputBox({
    title: `Koyuki — ${meta.label} API Key`,
    prompt: `${meta.hint} Stored securely in your OS keychain; never leaves this machine.`,
    password: true,
    ignoreFocusOut: true,
    placeHolder: meta.placeholder,
    validateInput: meta.validate,
  });
  if (!key) {
    return false;
  }
  await setApiKey(context, provider, key);
  return true;
}

export async function selectProvider(
  context: vscode.ExtensionContext
): Promise<Provider | undefined> {
  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "$(sparkle) Google Gemini",
        description: "free tier — gemini-2.0-flash",
        value: "gemini" as Provider,
      },
      {
        label: "$(sparkle) Anthropic Claude",
        description: "claude-haiku-4-5 (needs credit)",
        value: "anthropic" as Provider,
      },
    ],
    { title: "Koyuki — choose completion provider", ignoreFocusOut: true }
  );
  if (!pick) {
    return undefined;
  }
  await vscode.workspace
    .getConfiguration("koyuki")
    .update("provider", pick.value, vscode.ConfigurationTarget.Global);
  return pick.value;
}
