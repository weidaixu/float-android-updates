import type {
  AttachmentFileLike,
  AttachmentKind,
  AttachmentValidationResult,
} from "./types.ts";

const MIB = 1024 * 1024;

export const ATTACHMENT_LIMITS = Object.freeze({
  image: 20 * MIB,
  document: 30 * MIB,
  video: 200 * MIB,
});

const MIME_TYPES = new Map<string, { kind: AttachmentKind; mimeType: string }>([
  ["image/jpeg", { kind: "image", mimeType: "image/jpeg" }],
  ["image/png", { kind: "image", mimeType: "image/png" }],
  ["image/webp", { kind: "image", mimeType: "image/webp" }],
  ["image/gif", { kind: "image", mimeType: "image/gif" }],
  ["video/mp4", { kind: "video", mimeType: "video/mp4" }],
  ["video/webm", { kind: "video", mimeType: "video/webm" }],
  ["video/quicktime", { kind: "video", mimeType: "video/quicktime" }],
  ["text/plain", { kind: "document", mimeType: "text/plain" }],
  ["application/pdf", { kind: "document", mimeType: "application/pdf" }],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    {
      kind: "document",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ],
  ["application/epub+zip", { kind: "document", mimeType: "application/epub+zip" }],
]);

const EXTENSIONS = new Map<string, { kind: AttachmentKind; mimeType: string }>([
  ["jpg", { kind: "image", mimeType: "image/jpeg" }],
  ["jpeg", { kind: "image", mimeType: "image/jpeg" }],
  ["png", { kind: "image", mimeType: "image/png" }],
  ["webp", { kind: "image", mimeType: "image/webp" }],
  ["gif", { kind: "image", mimeType: "image/gif" }],
  ["mp4", { kind: "video", mimeType: "video/mp4" }],
  ["webm", { kind: "video", mimeType: "video/webm" }],
  ["mov", { kind: "video", mimeType: "video/quicktime" }],
  ["txt", { kind: "document", mimeType: "text/plain" }],
  ["pdf", { kind: "document", mimeType: "application/pdf" }],
  [
    "docx",
    {
      kind: "document",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  ],
  ["epub", { kind: "document", mimeType: "application/epub+zip" }],
]);

export function sanitizeAttachmentName(input: string): string {
  const leaf = String(input || "file").split(/[\\/]/).pop() || "file";
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "file";
  if (clean.length <= 120) return clean;

  const dot = clean.lastIndexOf(".");
  const extension = dot > 0 ? clean.slice(dot).slice(0, 16) : "";
  return `${clean.slice(0, 120 - extension.length)}${extension}`;
}

function resolveType(file: AttachmentFileLike) {
  const mime = String(file.type || "").toLowerCase().split(";", 1)[0].trim();
  if (MIME_TYPES.has(mime)) return MIME_TYPES.get(mime);
  const extension = file.name.toLowerCase().split(".").pop() || "";
  return EXTENSIONS.get(extension);
}

export function validateAttachment(file: AttachmentFileLike): AttachmentValidationResult {
  const resolved = resolveType(file);
  if (!resolved) {
    return {
      ok: false,
      code: "unsupported_type",
      message: "仅支持图片、视频、PDF、Word、TXT 或 EPUB 文件。",
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, code: "empty_file", message: "文件为空或无法读取。" };
  }

  const limit = ATTACHMENT_LIMITS[resolved.kind];
  if (file.size > limit) {
    return {
      ok: false,
      code: "file_too_large",
      message: `${resolved.kind === "image" ? "图片" : resolved.kind === "video" ? "视频" : "文档"}不能超过 ${limit / MIB} MB。`,
      limit,
    };
  }

  return {
    ok: true,
    kind: resolved.kind,
    name: sanitizeAttachmentName(file.name),
    mimeType: resolved.mimeType,
    size: file.size,
  };
}

export function formatAttachmentError(error: AttachmentValidationResult): string {
  return error.ok ? "" : error.message;
}
