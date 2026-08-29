import assert from "node:assert/strict";
import test from "node:test";

import { buildStoredAttachmentMetadata } from "../lib/chat-attachments/message-metadata.ts";

test("old chat messages remain valid without attachment metadata", () => {
  const oldMessage = { id: "1", content: "你好", role: "user" };
  assert.equal(oldMessage.attachments, undefined);
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
