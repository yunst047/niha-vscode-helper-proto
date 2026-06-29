# Publishing Koyuki Complete (manual)

This is a manual, step-by-step guide for releasing the extension. Nothing here
runs automatically — do each step when you're ready.

> ⚠️ **Before publishing publicly:** the bundled Koyuki art and audio are
> third-party fan assets included under a fair-use rationale (see `NOTICE.md`).
> For a public Marketplace listing you should **replace them with assets you own
> or that are licensed for redistribution**, or remove them. Publishing
> copyrighted media to the Marketplace can get the listing taken down.

---

## 0. Prerequisites

```bash
npm install
npm run build      # bundle src/ -> out/extension.js
npm run package    # produces koyuki-complete-<version>.vsix
```

`vsce` is invoked via `npx @vscode/vsce` — no global install needed.

---

## 1. Install locally (no Marketplace account required)

The simplest distribution: hand people the `.vsix`.

```bash
code --install-extension koyuki-complete-0.1.0.vsix
```

Or in VS Code: **Extensions** panel → `…` menu → **Install from VSIX…**.
To share, attach the `.vsix` to a GitHub Release (see step 4).

---

## 2. Publish to the VS Code Marketplace

1. **Create a publisher.** Go to <https://marketplace.visualstudio.com/manage>
   and create a publisher ID (e.g. `your-publisher`). Then set it in
   `package.json` → `"publisher"` (currently `"niha"`).

2. **Get a Personal Access Token (PAT).**
   - Go to <https://dev.azure.com/> → User settings → **Personal access tokens**.
   - **New Token** → Organization: **All accessible organizations** →
     Scopes: **Custom defined** → **Marketplace: Manage**.
   - Copy the token (shown once).

3. **Log in and publish:**
   ```bash
   npx @vscode/vsce login your-publisher     # paste the PAT when prompted
   npx @vscode/vsce publish                  # or: publish minor / patch / 1.2.3
   ```
   `publish` rebuilds via `vscode:prepublish` and uploads. To upload an
   already-built file instead:
   ```bash
   npx @vscode/vsce publish --packagePath koyuki-complete-0.1.0.vsix
   ```

4. Verify at `https://marketplace.visualstudio.com/items?itemName=your-publisher.koyuki-complete`.

### Marketplace gotchas
- A **128×128 PNG icon** is recommended (`media/icon.png` is already that size).
- `repository` must be a valid public URL (it is).
- Bump `version` in `package.json` for every publish (or use
  `vsce publish patch|minor|major`).
- A `LICENSE` file is required for public listings (present).

---

## 3. Publish to Open VSX (for VSCodium / Cursor / Gitpod users)

```bash
npm install -g ovsx
npx ovsx create-namespace your-publisher -p <openvsx-token>   # first time only
npx ovsx publish koyuki-complete-0.1.0.vsix -p <openvsx-token>
```

Get a token at <https://open-vsx.org/user-settings/tokens>.

---

## 4. Distribute via a GitHub Release (no Marketplace needed)

```bash
gh release create v0.1.0 koyuki-complete-0.1.0.vsix \
  --title "Koyuki Complete v0.1.0" \
  --notes "Claude-powered inline autocomplete. Install: code --install-extension koyuki-complete-0.1.0.vsix"
```

Users then download the `.vsix` and run the `code --install-extension` command.

---

## Release checklist

- [ ] `npm run build` succeeds
- [ ] Tested in an Extension Development Host (`F5`)
- [ ] `version` bumped in `package.json`
- [ ] `publisher` set to your real publisher ID
- [ ] Third-party media replaced or removed (if publishing publicly)
- [ ] `npm run package` produces a clean `.vsix` (check the file list)
- [ ] Published / release created
