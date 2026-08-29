import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import JSZip from "jszip";

import { extractDocument } from "../lib/chat-attachments/document-extractor.ts";
import { normalizeExtractedText } from "../lib/chat-attachments/text-normalizer.ts";

function localFile(name, type, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    name,
    type,
    size: data.byteLength,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  };
}

async function makeDocx() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>文档标题</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>小浮</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`);
  return zip.generateAsync({ type: "uint8array" });
}

async function makeEpub() {
  const zip = new JSZip();
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
  zip.file("OEBPS/one.xhtml", `<html><body><h1>第一章</h1><p>先发生的内容。</p></body></html>`);
  zip.file("OEBPS/two.xhtml", `<html><body><h1>第二章</h1><p>后发生的内容。</p></body></html>`);
  return zip.generateAsync({ type: "uint8array" });
}

function makePdf(text) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length + 31} >>\nstream\nBT /F1 18 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

test("normalizes BOM, repeated blank lines, and horizontal whitespace", () => {
  assert.equal(normalizeExtractedText("\uFEFFA  \t B\r\n\r\n\r\nC", 100), "A B\n\nC");
});

test("truncates extracted text at 120,000 characters with a visible marker", () => {
  const text = normalizeExtractedText("x".repeat(120_005), 120_000);
  assert.ok(text.length <= 120_000);
  assert.match(text, /内容已截断]$/);
});

test("extracts a UTF-8 BOM TXT file locally", async () => {
  const fixture = await readFile(new URL("./fixtures/attachments/sample.txt", import.meta.url));
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fixture]);
  const result = await extractDocument(localFile("sample.txt", "text/plain", bytes));
  assert.equal(result.part.type, "text");
  assert.equal(result.part.text, "第一行\n\n 第二行 有空格");
});

test("extracts DOCX paragraph and table text locally", async () => {
  const bytes = await makeDocx();
  const result = await extractDocument(localFile("sample.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes));
  assert.match(result.part.text, /文档标题/);
  assert.match(result.part.text, /姓名/);
  assert.match(result.part.text, /小浮/);
});

test("extracts PDF text with a page label", async () => {
  const result = await extractDocument(localFile("sample.pdf", "application/pdf", makePdf("Hello PDF")));
  assert.equal(result.part.text, "[第 1 页]\nHello PDF");
});

test("extracts EPUB chapters in spine order with chapter labels", async () => {
  const result = await extractDocument(localFile("sample.epub", "application/epub+zip", await makeEpub()));
  assert.ok(result.part.text.indexOf("第一章") < result.part.text.indexOf("第二章"));
  assert.match(result.part.text, /\[章节 1\]/);
  assert.match(result.part.text, /\[章节 2\]/);
});
