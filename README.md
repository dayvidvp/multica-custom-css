# multica-custom-css

Inject your own CSS into the [Multica](https://multica.ai) desktop app on Windows.

The main use case: Multica caps its chat and issue columns at 896px, which leaves most of a widescreen monitor empty. The included `custom.css` widens them to 1600px. It also makes board columns fill the window instead of a fixed 280px, gives card titles room for 3 lines and the full "Waiting for" label, and widens the inbox list.

The included `custom.js` gives issue comments that need you their own background: amber when you're @mentioned, blue when a comment asks you something.

> Unofficial. Not affiliated with or endorsed by Multica. Tested with Multica Desktop 0.7.1 (Electron 44) on Windows 11.

## How it works

Multica is an Electron app. Its code lives in `resources\app.asar`. Electron 44 no longer loads a loose `resources\app` folder, so the only reliable hook is the asar itself.

`patch-asar.mjs` adds a few lines to the top of `out/main/index.js` inside the asar. On every `dom-ready`, those lines read `~/.multica/custom.css` and `~/.multica/custom.js` and pass them to `webContents.insertCSS()` and `webContents.executeJavaScript()`. The patcher:

- appends the patched file to the end of the archive and rewrites only the asar header, so every other file stays byte-identical
- keeps `app.asar.unpacked` (the bundled CLI and daemon) untouched
- stores the original as `app.asar.orig` and refreshes that backup on each fresh install
- is idempotent: running it twice does nothing the second time
- upgrades an app patched by the older CSS-only version in place

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

On first install it copies `custom.css` and `custom.js` to `%USERPROFILE%\.multica\`. It never overwrites those files afterwards.

## Customize

Edit `%USERPROFILE%\.multica\custom.css` or `custom.js` and press **Ctrl+R** in Multica, or restart it. You don't need to reinstall.

For example, to use the full window width:

```css
[class*="@4xl:px-12"] .mx-auto.w-full.max-w-4xl,
.mx-auto.w-full.max-w-4xl[class*="max-md:pb-chat-launcher"] {
  max-width: none !important;
}
```

### Highlight comments that need you

Open `%USERPROFILE%\.multica\custom.js` and put your name, as Multica shows it, in `MY_NAMES`:

```js
const MY_NAMES = ["Dayvid"];
```

With `MY_NAMES` empty the script does nothing. A comment gets `data-for-me="mention"` when it @mentions you, and `data-for-me="question"` when it uses your name or a phrase from `QUESTION_PATTERNS` ("kun je ...?", "please confirm", ...) without @mentioning someone else. Your own comments are skipped. The colours are at the bottom of `custom.css`.

To find other selectors, start Multica with `--remote-debugging-port=9222`, open `chrome://inspect` in Chrome or Edge, and inspect the page.

## After a Multica update

An update replaces `app.asar` and removes the patch. Run `.\install.ps1` again. Your `custom.css` and `custom.js` are kept.

## Uninstall

```powershell
.\install.ps1 -Uninstall
```

This puts `app.asar.orig` back. After an update you can also just leave it: the update already restored a clean app.

## License

MIT
