export const MAX_EXTRACTED_TEXT_CHARS = 120_000;

const TRUNCATION_MARKER = "\n\n[内容已截断]";

export function normalizeExtractedText(
  input: string,
  maxChars = MAX_EXTRACTED_TEXT_CHARS,
): string {
  let text = String(input || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").replace(/ +$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > maxChars) {
    const bodyLength = Math.max(0, maxChars - TRUNCATION_MARKER.length);
    text = `${text.slice(0, bodyLength).trimEnd()}${TRUNCATION_MARKER}`;
  }

  return text;
}
