import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPartsSupported,
  resolveModelCapabilities,
} from "../lib/chat-attachments/model-capabilities.ts";
import { analysisPartsToRequestContent } from "../lib/chat-attachments/request-parts.ts";

function config(overrides = {}) {
  return {
    provider: "Custom",
    baseUrl: "https://example.com/v1",
    defaultModel: "unknown-model",
    enableImageRecognition: true,
    ...overrides,
  };
}

test("explicit capability overrides take precedence over model inference", () => {
  assert.deepEqual(
    resolveModelCapabilities(config({
      capabilities: { image: true, audioInput: true, documentNative: true },
    })),
    { text: true, image: true, audioInput: true, documentNative: true },
  );
});

test("an unknown OpenAI-compatible model defaults conservatively", () => {
  assert.deepEqual(resolveModelCapabilities(config()), {
    text: true,
    image: false,
    audioInput: false,
    documentNative: false,
  });
});

test("known multimodal model families enable image input", () => {
  for (const [provider, model] of [
    ["OpenAI", "gpt-4o-mini"],
    ["Anthropic", "claude-3-5-sonnet"],
    ["Google", "gemini-2.5-flash"],
    ["OpenRouter", "google/gemini-2.0-flash"],
  ]) {
    assert.equal(resolveModelCapabilities(config({ provider, defaultModel: model })).image, true);
  }
});

test("rejects audio with a clear message when the model has no audio input", () => {
  assert.throws(
    () => assertPartsSupported([{ type: "audio", dataUrl: "data:audio/mp4;base64,AA==", mimeType: "audio/mp4" }], resolveModelCapabilities(config())),
    /不支持音频输入.*模型能力/,
  );
});

test("maps document text to a bounded text block without native document support", () => {
  const content = analysisPartsToRequestContent(
    [{ type: "text", sourceName: "report.pdf", text: "报告正文" }],
    resolveModelCapabilities(config()),
  );
  assert.deepEqual(content, [{ type: "text", text: "[文件：report.pdf]\n报告正文" }]);
});

test("maps images to the existing image_url request shape", () => {
  const content = analysisPartsToRequestContent(
    [{ type: "image", sourceName: "cat.png", mimeType: "image/png", dataUrl: "data:image/png;base64,AA==" }],
    resolveModelCapabilities(config({ defaultModel: "gpt-4o-mini" })),
  );
  assert.deepEqual(content, [{ type: "image_url", image_url: { url: "data:image/png;base64,AA==", detail: "auto" } }]);
});
