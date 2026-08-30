import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat input actions use a narrow-screen-safe responsive gap", async () => {
  const css = await readFile(new URL("../styles/chat.css", import.meta.url), "utf8");
  const rule = css.match(/\.chat-input-bar \.chat-input-actions\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(rule, /gap:\s*clamp\(/);
  assert.match(rule, /justify-content:\s*space-between/);
});
