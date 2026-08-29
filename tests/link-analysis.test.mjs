import assert from "node:assert/strict";
import test from "node:test";

import { classifyPublicUrl, extractPublicUrls } from "../lib/link-analysis/url-detection.ts";
import { resolvePublicLink } from "../lib/link-analysis/link-resolver.ts";

test("extracts unique URLs and trims Chinese and ASCII punctuation", () => {
  assert.deepEqual(
    extractPublicUrls("看 https://example.com/a，重复 https://example.com/a。还有(https://www.douyin.com/video/1)."),
    ["https://example.com/a", "https://www.douyin.com/video/1"],
  );
});

test("classifies Douyin, Xiaohongshu, and ordinary public pages", () => {
  assert.equal(classifyPublicUrl("https://v.douyin.com/abc").platform, "douyin");
  assert.equal(classifyPublicUrl("https://www.xiaohongshu.com/explore/abc").platform, "xiaohongshu");
  assert.equal(classifyPublicUrl("https://example.com/article").platform, "web");
});

test("rejects credentials, localhost, private IPv4, and private IPv6", () => {
  for (const url of [
    "https://user:pass@example.com/",
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.8/",
    "http://192.168.1.2/",
    "http://[::1]/",
    "file:///etc/passwd",
  ]) assert.equal(classifyPublicUrl(url).allowed, false, url);
});

test("extracts readable title and text without scripts", async () => {
  const fetchImpl = async () => new Response("<html><head><title>示例页</title><script>secret()</script></head><body><h1>标题</h1><p>正文内容</p></body></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  const part = await resolvePublicLink("https://example.com/a", { fetchImpl });
  assert.equal(part.type, "text");
  assert.match(part.text, /示例页/);
  assert.match(part.text, /正文内容/);
  assert.doesNotMatch(part.text, /secret/);
});

test("stops after five redirects", async () => {
  let count = 0;
  const fetchImpl = async () => {
    count += 1;
    return new Response(null, { status: 302, headers: { location: `https://example.com/${count}` } });
  };
  await assert.rejects(() => resolvePublicLink("https://example.com/start", { fetchImpl }), /重定向次数过多/);
  assert.equal(count, 6);
});
