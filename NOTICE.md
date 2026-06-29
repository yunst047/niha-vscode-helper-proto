# NOTICE — Third-Party Assets & Fair Use

This extension is a **non-commercial, educational fan project**. It ships a small
number of third-party media assets (the "Koyuki" character imagery and short
audio clips). These assets are **not** original to this project and remain the
property of their respective copyright holders.

## Assets in question

| Asset | Location | Type |
| --- | --- | --- |
| Koyuki character art | `media/icon.png` (derived), `public/*.jpg`, `public/*.webp` | Image |
| Koyuki voice / SFX clips | `public/sound/positive/*`, `public/sound/negative/*` | Short audio |

## Fair-use rationale

The inclusion of these clips and images is intended to qualify as **fair use**
under 17 U.S.C. § 107, weighed against the four statutory factors:

1. **Purpose & character** — Use is non-commercial, educational, and
   *transformative*: the clips are repurposed as brief UI feedback cues (a
   success "ping" and an error "alert") inside a developer tool, not as
   entertainment or a substitute for the original work.
2. **Nature of the work** — The originals are published, widely distributed
   media; only incidental UI use is made here.
3. **Amount used** — Only **short fragments** (a few seconds of audio; a single
   low-resolution still) are used — the minimum needed for the UI cue.
4. **Effect on the market** — This tool is not a substitute for, and does not
   compete with, the original work, and is distributed at no charge.

Fair use is a fact-specific legal doctrine and **not a guarantee**. Nothing here
is legal advice.

## If you fork, publish, or distribute this extension

To stay on the right side of copyright when **publishing publicly** (e.g. to the
VS Code Marketplace) you should do **one** of the following:

- **Replace** the bundled clips/images with assets you own or that are licensed
  for redistribution (CC0 / CC-BY UI sound packs, your own recordings, etc.); or
- **Remove** the bundled media and rely on the user supplying their own sounds; or
- **Obtain permission** from the rights holder(s).

The build is already configured so the large raw images are excluded from the
packaged `.vsix` (see `.vscodeignore`). The audio clips and the derived icon are
included for local/personal use — swap them before any public release.

The **code** of this extension (everything under `src/`, the build scripts, and
the color theme) is original work, licensed under the MIT License (see `LICENSE`).
The third-party media is **not** covered by that MIT grant.
