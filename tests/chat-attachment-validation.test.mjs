import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTACHMENT_LIMITS,
  formatAttachmentError,
  sanitizeAttachmentName,
  validateAttachment,
} from "../lib/chat-attachments/validation.ts";

const mib = 1024 * 1024;

function fileLike(name, type, size) {
  return { name, type, size };
}

test("accepts a known image MIME type within the 20 MiB limit", () => {
  assert.deepEqual(
    validateAttachment(fileLike("photo.png", "image/png", 20 * mib)),
    { ok: true, kind: "image", name: "photo.png", mimeType: "image/png", size: 20 * mib },
  );
});

test("rejects an image larger than 20 MiB", () => {
  const result = validateAttachment(fileLike("photo.jpg", "image/jpeg", 20 * mib + 1));
  assert.equal(result.ok, false);
  assert.equal(result.code, "file_too_large");
  assert.match(formatAttachmentError(result), /20 MB/);
});

test("accepts document extensions when the browser omits MIME type", () => {
  for (const [name, mimeType] of [
    ["notes.txt", "text/plain"],
    ["report.pdf", "application/pdf"],
    ["brief.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["book.epub", "application/epub+zip"],
  ]) {
    const result = validateAttachment(fileLike(name, "", ATTACHMENT_LIMITS.document));
    assert.equal(result.ok, true);
    assert.equal(result.kind, "document");
    assert.equal(result.mimeType, mimeType);
  }
});

test("rejects a document larger than 30 MiB", () => {
  const result = validateAttachment(fileLike("book.epub", "application/epub+zip", 30 * mib + 1));
  assert.equal(result.ok, false);
  assert.equal(result.code, "file_too_large");
});

test("accepts a supported video at 200 MiB and rejects larger videos", () => {
  assert.equal(validateAttachment(fileLike("clip.mp4", "video/mp4", 200 * mib)).ok, true);
  const tooLarge = validateAttachment(fileLike("clip.mp4", "video/mp4", 200 * mib + 1));
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.code, "file_too_large");
});

test("rejects unsupported file types with a user-facing message", () => {
  const result = validateAttachment(fileLike("archive.exe", "application/octet-stream", 100));
  assert.equal(result.ok, false);
  assert.equal(result.code, "unsupported_type");
  assert.match(formatAttachmentError(result), /图片、视频、PDF、Word、TXT 或 EPUB/);
});

test("sanitizes path separators, control characters, and overlong names", () => {
  const safe = sanitizeAttachmentName("../folder\\bad\u0000name.pdf");
  assert.equal(safe, "badname.pdf");
  assert.ok(sanitizeAttachmentName(`${"a".repeat(300)}.txt`).length <= 120);
});
