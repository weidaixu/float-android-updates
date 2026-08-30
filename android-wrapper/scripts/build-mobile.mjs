import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const wrapperRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(wrapperRoot, "..");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "float-mobile-build-"));
const excluded = new Set([".git", ".next", ".npm-cache", "android-wrapper", "node_modules"]);

fs.cpSync(sourceRoot, work, {
  recursive: true,
  filter(source) {
    if (source === sourceRoot) return true;
    const relative = path.relative(sourceRoot, source);
    return !relative.split(path.sep).some((part) => excluded.has(part));
  },
});

for (const relative of [
  'app/api',
  'app/manifest.webmanifest',
  'app/personal-shortcut-run',
  'app/shortcut-run',
  'middleware.ts',
]) {
  const target = path.join(work, relative);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

const config = path.join(work, "next.config.mjs");
fs.appendFileSync(config, "\nnextConfig.output = 'export';\n");
const npmOptions = {
  cwd: work,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SELF_HOSTED_MODE: "1",
    NEXT_PUBLIC_FLOAT_WEB_BASE_URL: process.env.NEXT_PUBLIC_FLOAT_WEB_BASE_URL || "https://6a9034bac432403b2e57b58d--glowing-zabaione-a6d318.netlify.app",
  },
};
function runNpm(args) {
  if (process.platform === "win32") {
    execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "npm", ...args], npmOptions);
    return;
  }
  execFileSync("npm", args, npmOptions);
}
runNpm(["ci", "--ignore-scripts", "--include=dev"]);
runNpm(["run", "build"]);

const out = path.join(work, 'out');
const www = path.join(wrapperRoot, "www");
if (!fs.existsSync(out)) throw new Error('Next.js mobile export did not produce out/');
if (fs.existsSync(www)) fs.rmSync(www, { recursive: true, force: true });
fs.cpSync(out, www, { recursive: true });
console.log(`Mobile web assets copied to ${www}`);
