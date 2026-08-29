import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeHostname, assertSafeResolvedAddresses, sanitizeHtmlText } from "../src/security.ts";

test("blocks local and credential-bearing targets", () => {
  for (const value of ["http://localhost/", "http://127.0.0.1/", "http://10.0.0.1/", "http://[::1]/", "https://a:b@example.com/"]) {
    assert.throws(() => assertSafeHostname(new URL(value)));
  }
});

test("blocks DNS results when any answer is private", () => {
  assert.throws(() => assertSafeResolvedAddresses(["203.0.113.10", "10.0.0.9"]));
  assert.doesNotThrow(() => assertSafeResolvedAddresses(["1.1.1.1", "2606:4700:4700::1111"]));
});

test("removes executable markup and keeps readable text", () => {
  const result = sanitizeHtmlText("<title>T</title><script>bad()</script><h1>Hello</h1><p>World</p>");
  assert.deepEqual(result, { title: "T", text: "T Hello World" });
});
