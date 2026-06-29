import * as vscode from "vscode";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type SoundKind = "positive" | "negative";

/**
 * Plays the bundled Koyuki feedback sounds. VS Code's extension host is plain
 * Node with no audio API, so we shell out to the platform's audio player.
 * Playback is fire-and-forget; failures are swallowed (sound is non-essential).
 */
export class SoundPlayer {
  private readonly roots: Record<SoundKind, string>;
  private lastPlayed = 0;

  constructor(private readonly extensionPath: string) {
    const base = path.join(extensionPath, "public", "sound");
    this.roots = {
      positive: path.join(base, "positive"),
      negative: path.join(base, "negative"),
    };
  }

  play(kind: SoundKind, volume: number, index: number): void {
    // Throttle so a burst of completions doesn't stack overlapping audio.
    const now = Date.now();
    if (now - this.lastPlayed < 300) {
      return;
    }
    this.lastPlayed = now;

    const file = this.pickFile(kind, index);
    if (!file) {
      return;
    }
    try {
      this.spawnPlayer(file, volume);
    } catch {
      /* audio is best-effort */
    }
  }

  private pickFile(kind: SoundKind, index: number): string | undefined {
    const dir = this.roots[kind];
    let files: string[];
    try {
      files = fs
        .readdirSync(dir)
        .filter((f) => /\.(mp3|ogg|wav|m4a)$/i.test(f))
        .sort();
    } catch {
      return undefined;
    }
    if (files.length === 0) {
      return undefined;
    }
    // Deterministic-but-varied selection driven by a caller-supplied counter.
    const chosen = files[((index % files.length) + files.length) % files.length];
    return path.join(dir, chosen);
  }

  private spawnPlayer(file: string, volume: number): void {
    const vol = Math.max(0, Math.min(1, volume));
    if (process.platform === "win32") {
      // Use the MCI API (winmm.dll). WPF's MediaPlayer needs a Dispatcher
      // message pump that a detached console process doesn't have, so it plays
      // silence; `mciSendString("play ... wait")` decodes mp3 and blocks
      // synchronously with no pump or STA required. Volume is 0..1000.
      const psFile = file.replace(/'/g, "''");
      const mciVol = Math.round(vol * 1000);
      const script = [
        "$ErrorActionPreference='SilentlyContinue';",
        "$s = Add-Type -Name WinMM -Namespace Koyuki -PassThru -MemberDefinition '[DllImport(\"winmm.dll\", CharSet=CharSet.Auto)] public static extern int mciSendString(string c, System.Text.StringBuilder b, int n, System.IntPtr h);';",
        `$f = '${psFile}';`,
        "$null = $s::mciSendString('open \"' + $f + '\" type mpegvideo alias koyukisnd', $null, 0, [System.IntPtr]::Zero);",
        `$null = $s::mciSendString('setaudio koyukisnd volume to ${mciVol}', $null, 0, [System.IntPtr]::Zero);`,
        "$null = $s::mciSendString('play koyukisnd wait', $null, 0, [System.IntPtr]::Zero);",
        "$null = $s::mciSendString('close koyukisnd', $null, 0, [System.IntPtr]::Zero);",
      ].join(" ");
      // -EncodedCommand (UTF-16LE base64) avoids all shell quoting issues.
      const encoded = Buffer.from(script, "utf16le").toString("base64");
      const child = spawn(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
        { detached: true, stdio: "ignore", windowsHide: true }
      );
      child.unref();
      return;
    }

    if (process.platform === "darwin") {
      // afplay -v takes 0..1 (and beyond); mp3/m4a supported natively.
      const child = spawn("afplay", ["-v", vol.toFixed(2), file], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return;
    }

    // Linux / other: try common players in order; first that exists wins.
    const candidates: Array<[string, string[]]> = [
      ["ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", String(Math.round(vol * 100)), file]],
      ["mpv", [`--volume=${Math.round(vol * 100)}`, "--no-video", "--really-quiet", file]],
      ["paplay", [file]],
      ["mpg123", ["-q", file]],
    ];
    for (const [cmd, args] of candidates) {
      try {
        const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
        child.on("error", () => undefined);
        child.unref();
        return;
      } catch {
        /* try next */
      }
    }
  }
}

export function isSoundsEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("koyuki")
    .get<boolean>("sounds.enabled", true);
}
