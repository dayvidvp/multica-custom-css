# multica-custom-css

Inject your own CSS into the [Multica](https://multica.ai) desktop app on Windows.

The main use case: Multica caps its chat and issue columns at 896px, which leaves most of a widescreen monitor empty. The included `custom.css` widens them to 1600px.

> Unofficial. Not affiliated with or endorsed by Multica. Tested with Multica Desktop 0.7.1 (Electron 44) on Windows 11.

## How it works

Multica is an Electron app. Its code lives in `resources\app.asar`. Electron 44 no longer loads a loose `resources\app` folder, so the only reliable hook is the asar itself.

`patch-asar.mjs` adds a few lines to the top of `out/main/index.js` inside the asar. On every `dom-ready`, those lines read `~/.multica/custom.css` and call `webContents.insertCSS()` with it. The patcher:

- appends the patched file to the end of the archive and rewrites only the asar header, so every other file stays byte-identical
- keeps `app.asar.unpacked` (the bundled CLI and daemon) untouched
- stores the original as `app.asar.orig` and refreshes that backup on each fresh install
- is idempotent: running it twice does nothing the second time

This works because the app ships with the `EnableEmbeddedAsarIntegrityValidation` fuse disabled. If a future build enables it, the patched app will refuse to start; run `install.ps1 -Uninstall` to restore it.

## Requirements

- Windows, with Multica installed per user (`%LOCALAPPDATA%\Programs\@multicadesktop`)
- [Node.js](https://nodejs.org) 18 or newer

## Install

```powershell
git clone https://github.com/dayvidvp/multica-custom-css.git
cd multica-custom-css
.\install.ps1
```

The script closes the Multica window, patches the app and starts it again. The Multica agent daemon is a separate process and keeps running.

On first install it copies `custom.css` to `%USERPROFILE%\.multica\custom.css`. It never overwrites that file afterwards.

## Customize

Edit `%USERPROFILE%\.multica\custom.css` and press **Ctrl+R** in Multica, or restart it. You don't need to reinstall.

For example, to use the full window width:

```css
[class*="@4xl:px-12"] .mx-auto.w-full.max-w-4xl,
.mx-auto.w-full.max-w-4xl[class*="max-md:pb-chat-launcher"] {
  max-width: none !important;
}
```

To find other selectors, start Multica with `--remote-debugging-port=9222`, open `chrome://inspect` in Chrome or Edge, and inspect the page.

## After a Multica update

An update replaces `app.asar` and removes the patch. Run `.\install.ps1` again. Your `custom.css` is kept.

## Uninstall

```powershell
.\install.ps1 -Uninstall
```

This puts `app.asar.orig` back. After an update you can also just leave it: the update already restored a clean app.

## License

MIT
