// Patches out/main/index.js inside Multica's app.asar so ~/.multica/custom.css is injected into every window.
// Only the header and the patched file (appended at the end) change; all other data stays byte-identical.
// Usage: node patch-asar.mjs <path to app.asar> [--restore]
import fs from "node:fs";
import crypto from "node:crypto";

const MARKER = "/* css-inject v2 */";
const SNIPPET = `${MARKER}
require("electron").app.on("web-contents-created", (_e, wc) => wc.on("dom-ready", () => {
  const read = (f) => { try { return require("fs").readFileSync(require("path").join(require("os").homedir(), ".multica", f), "utf8"); } catch { return null; } };
  const css = read("custom.css"), js = read("custom.js");
  if (css) wc.insertCSS(css).catch((err) => console.warn("[css-inject]", err.message));
  if (js) wc.executeJavaScript(js).catch((err) => console.warn("[css-inject]", err.message));
}));
`;

// The first version only injected custom.css; an asar patched with it is upgraded in place
const OLD_SNIPPET = `/* css-inject */
require("electron").app.on("web-contents-created", (_e, wc) => wc.on("dom-ready", () => {
  try { wc.insertCSS(require("fs").readFileSync(require("path").join(require("os").homedir(), ".multica", "custom.css"), "utf8")); }
  catch (err) { console.warn("[css-inject]", err.message); }
}));
`;

const [asarPath, flag] = process.argv.slice(2);
if (!asarPath) throw new Error("Usage: node patch-asar.mjs <path to app.asar> [--restore]");
const backup = asarPath + ".orig";

if (flag === "--restore") {
  if (!fs.existsSync(backup)) throw new Error("No backup found: " + backup);
  fs.copyFileSync(backup, asarPath);
  console.log("Original app.asar restored.");
  process.exit(0);
}

const buf = fs.readFileSync(asarPath);
const headerSize = buf.readUInt32LE(4);
const jsonLen = buf.readInt32LE(12);
const header = JSON.parse(buf.toString("utf8", 16, 16 + jsonLen));
const data = buf.subarray(8 + headerSize);

const entry = header.files.out.files.main.files["index.js"];
const original = data.subarray(Number(entry.offset), Number(entry.offset) + entry.size);
const source = original.toString("utf8");
if (source.includes(MARKER)) {
  console.log("Already patched, nothing to do.");
  process.exit(0);
}

const upgrading = source.startsWith(OLD_SNIPPET);
const patched = Buffer.from(SNIPPET + (upgrading ? source.slice(OLD_SNIPPET.length) : source), "utf8");
const BLOCK = 4 * 1024 * 1024;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const blocks = [];
for (let i = 0; i < patched.length; i += BLOCK) blocks.push(sha(patched.subarray(i, i + BLOCK)));
entry.offset = String(data.length);
entry.size = patched.length;
entry.integrity = { algorithm: "SHA256", hash: sha(patched), blockSize: BLOCK, blocks };

// Re-serialize the header as a Chromium pickle: [4][headerSize] + [payloadSize][strLen][json][padding]
const json = Buffer.from(JSON.stringify(header), "utf8");
const payload = 4 + Math.ceil(json.length / 4) * 4;
const headerPickle = Buffer.alloc(4 + payload);
headerPickle.writeUInt32LE(payload, 0);
headerPickle.writeInt32LE(json.length, 4);
json.copy(headerPickle, 8);
const sizePickle = Buffer.alloc(8);
sizePickle.writeUInt32LE(4, 0);
sizePickle.writeUInt32LE(headerPickle.length, 4);

// An unpatched asar is the current original (also right after an update), so refresh the backup;
// when upgrading an older patch, the backup made back then is still the original
if (!upgrading) fs.copyFileSync(asarPath, backup);
const tmp = asarPath + ".new";
fs.writeFileSync(tmp, Buffer.concat([sizePickle, headerPickle, data, patched]));
// A Multica window that is (re)opened meanwhile, or a virus scanner, can hold the file for a while
for (let attempt = 1; ; attempt++) {
  try {
    fs.renameSync(tmp, asarPath);
    break;
  } catch (err) {
    if (err.code !== "EPERM" && err.code !== "EBUSY") throw err;
    if (attempt === 15) {
      fs.rmSync(tmp, { force: true });
      throw new Error("app.asar is in use; close Multica and run install.ps1 again (" + err.message + ")");
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
}
console.log("app.asar patched (backup: " + backup + ").");
