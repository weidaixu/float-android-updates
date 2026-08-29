import JSZip from "jszip";

import type { AnalysisPart } from "./types.ts";
import { normalizeExtractedText } from "./text-normalizer.ts";

interface LocalDocumentFile {
  name: string;
  type?: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface DocumentExtractionResult {
  part: AnalysisPart;
  warnings: string[];
}

function extensionOf(name: string): string {
  return name.toLowerCase().split(".").pop() || "";
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const value = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function markupToText(markup: string): string {
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(markup, "text/html");
    return document.body?.textContent || document.documentElement?.textContent || "";
  }
  return decodeEntities(
    markup
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function attributeMap(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) {
    result[match[1]] = match[2];
  }
  return result;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash + 1);
}

function resolveZipPath(base: string, relative: string): string {
  const segments = `${base}${relative}`.split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") resolved.pop();
    else resolved.push(segment);
  }
  return resolved.join("/");
}

async function extractTxt(buffer: ArrayBuffer): Promise<string> {
  return new TextDecoder("utf-8").decode(buffer);
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    verbosity: 0,
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pages.push(`[第 ${pageNumber} 页]\n${text}`);
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages.join("\n\n");
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const imported = await import("mammoth");
  const mammoth = imported.default ?? imported;
  const options =
    typeof Buffer !== "undefined"
      ? { buffer: Buffer.from(buffer) }
      : { arrayBuffer: buffer };
  const result = await mammoth.extractRawText(options);
  return result.value;
}

async function extractEpub(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("EPUB 缺少 META-INF/container.xml");

  const rootfileTag = container.match(/<rootfile\b[^>]*>/i)?.[0];
  const packagePath = rootfileTag ? attributeMap(rootfileTag)["full-path"] : "";
  if (!packagePath) throw new Error("EPUB 未声明内容清单");

  const packageXml = await zip.file(packagePath)?.async("string");
  if (!packageXml) throw new Error("EPUB 内容清单不存在");

  const manifest = new Map<string, string>();
  for (const item of packageXml.match(/<item\b[^>]*>/gi) || []) {
    const attributes = attributeMap(item);
    if (attributes.id && attributes.href) manifest.set(attributes.id, attributes.href);
  }

  const chapters: string[] = [];
  const base = dirname(packagePath);
  let chapterNumber = 0;
  for (const itemref of packageXml.match(/<itemref\b[^>]*>/gi) || []) {
    const id = attributeMap(itemref).idref;
    const href = id ? manifest.get(id) : undefined;
    if (!href) continue;
    const chapter = await zip.file(resolveZipPath(base, href))?.async("string");
    if (!chapter) continue;
    chapterNumber += 1;
    chapters.push(`[章节 ${chapterNumber}]\n${markupToText(chapter)}`);
  }
  if (!chapters.length) throw new Error("EPUB 没有可读取的正文");
  return chapters.join("\n\n");
}

export async function extractDocument(file: LocalDocumentFile): Promise<DocumentExtractionResult> {
  const extension = extensionOf(file.name);
  const mimeType = String(file.type || "").toLowerCase();
  const buffer = await file.arrayBuffer();
  let text: string;

  if (mimeType === "text/plain" || extension === "txt") text = await extractTxt(buffer);
  else if (mimeType === "application/pdf" || extension === "pdf") text = await extractPdf(buffer);
  else if (mimeType.includes("wordprocessingml") || extension === "docx") text = await extractDocx(buffer);
  else if (mimeType === "application/epub+zip" || extension === "epub") text = await extractEpub(buffer);
  else throw new Error("不支持的文档格式");

  const normalized = normalizeExtractedText(text);
  if (!normalized) throw new Error("文档中没有可读取的文字");

  return {
    part: { type: "text", text: normalized, sourceName: file.name },
    warnings: text.length > normalized.length ? ["文档内容过长，已截断后发送给 AI。"] : [],
  };
}
