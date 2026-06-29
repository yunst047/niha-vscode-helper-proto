// Headless proof of the SUGGESTION CONTENT, using the real provider code path
// (same prompt, stop sequences, sanitizer the extension uses). The ghost-text
// *rendering* needs the VS Code GUI; this proves the model output.
//
// Anthropic (needs credit):
//   PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."; node examples/go-smoke/headless_suggest.js
//   bash:        ANTHROPIC_API_KEY=sk-ant-... node examples/go-smoke/headless_suggest.js
//
// Gemini (free tier — get a key at https://aistudio.google.com/apikey):
//   PowerShell:  $env:KOYUKI_PROVIDER="gemini"; $env:GEMINI_API_KEY="AIza..."; node examples/go-smoke/headless_suggest.js
//   bash:        KOYUKI_PROVIDER=gemini GEMINI_API_KEY=AIza... node examples/go-smoke/headless_suggest.js
//
// Your key stays in your shell — never written to disk or committed.

const path = require("path");
const fs = require("fs");

const REPO = path.resolve(__dirname, "..", "..");
const provider = (process.env.KOYUKI_PROVIDER || "anthropic").toLowerCase();
const isGemini = provider === "gemini";

const key = isGemini
  ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  : process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error(
    `Set ${isGemini ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"} first (see this file's header).`
  );
  process.exit(1);
}
const model = isGemini
  ? process.env.KOYUKI_MODEL || "gemini-2.5-flash"
  : "claude-haiku-4-5";
const srcFile = isGemini ? "gemini.ts" : "claude.ts";
const fnName = isGemini ? "fetchGeminiCompletion" : "fetchClaudeCompletion";

// Bundle the actual provider module so we exercise shipping code, not a copy.
const esbuild = require(path.join(REPO, "node_modules", "esbuild"));
const out = path.join(__dirname, ".claude_bundle.cjs");
esbuild.buildSync({
  entryPoints: [path.join(REPO, "src", srcFile)],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  logLevel: "silent",
});
const fetchFn = require(out)[fnName];

// Split the demo file at GHOST SPOT 1 (cursor right after "return fib").
const file = path.join(__dirname, "ghost_demo.go");
const src = fs.readFileSync(file, "utf8");
const cut = src.indexOf("return fib") + "return fib".length;
const prefix = src.slice(0, cut);
const suffix = src.slice(cut);

(async () => {
  console.log(`provider: ${provider}  model: ${model}`);
  console.log('prefix ends with "...return fib"  (expecting the fibonacci recursion)\n');
  const t0 = Date.now();
  const suggestion = await fetchFn({
    apiKey: key,
    model,
    maxTokens: 128,
    languageId: "go",
    prefix,
    suffix,
    fileName: "ghost_demo.go",
    signal: new AbortController().signal,
  });
  console.log("=== GHOST SUGGESTION (would render after the cursor) ===");
  console.log(JSON.stringify(suggestion));
  console.log("=======================================================");
  console.log(`(${Date.now() - t0}ms)`);
  fs.rmSync(out, { force: true });
})().catch((e) => {
  console.error("completion failed:", e.status || "", e.message || e);
  process.exit(1);
});
