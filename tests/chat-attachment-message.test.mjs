import assert from "node:assert/strict";
import test from "node:test";

import { appendAttachmentPromptText, buildStoredAttachmentMetadata, isAnalysisOnlyMedia } from "../lib/chat-attachments/message-metadata.ts";

test("old chat messages remain valid without attachment metadata", () => {
  const oldMessage = { id: "1", content: "你好", role: "user" };
  assert.equal(oldMessage.attachments, undefined);
});

test("appends extracted attachment text to every prompt history path", () => {
  assert.equal(
    appendAttachmentPromptText("请总结", [{ kind: "document", name: "a.txt", mimeType: "text/plain", size: 3, extractedText: "正文" }]),
    "请总结\n\n[附件：a.txt]\n正文",
  );
});

test("recognizes internal video analysis media without hiding the user's summary", () => {
  assert.equal(isAnalysisOnlyMedia({ mediaType: "media_file", mediaData: { analysisHidden: true } }), true);
  assert.equal(isAnalysisOnlyMedia({ content: "发送了文件：视频.mp4" }), false);
});

test("stores bounded attachment metadata without File, Blob, or data URL payloads", () => {
  const metadata = buildStoredAttachmentMetadata([
    {
      id: "a1",
      kind: "document",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 1024,
      status: "ready",
      file: { secretBinary: true },
      parts: [{ type: "text", text: "正文", sourceName: "report.pdf" }],
    },
    {
      id: "a2",
      kind: "image",
      name: "cat.png",
      mimeType: "image/png",
      size: 2048,
      status: "ready",
      file: { secretBinary: true },
      parts: [{ type: "image", dataUrl: "data:image/png;base64,SECRET", mimeType: "image/png" }],
    },
  ]);
  assert.deepEqual(metadata, [
    { kind: "document", name: "report.pdf", mimeType: "application/pdf", size: 1024, extractedText: "正文" },
    { kind: "image", name: "cat.png", mimeType: "image/png", size: 2048 },
  ]);
  assert.doesNotMatch(JSON.stringify(metadata), /SECRET|secretBinary|data:image/);
});
