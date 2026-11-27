// Reads CSV and Excel (.xlsx) files in the browser for "Import past messages". Restored from Likha Pulse.
// The rows are then sent to the API (care.importRows on both the demo and the server).
// ---------- import: reading CSV and Excel files ----------
export const IMPORT_FIELDS = ["date", "client", "message", "channel"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type Mapping = Record<ImportField, number | null>;
export const MAX_IMPORT_ROWS = 5000;
const HINTS: Record<ImportField, string[]> = {
  date: ["date", "petsa", "time", "created", "submitted", "timestamp", "when"],
  client: ["client", "customer", "name", "pangalan", "traveler", "guest", "author", "sender"],
  message: ["message", "feedback", "comment", "review", "remarks", "text", "mensahe", "content", "answer"],
  channel: ["channel", "source", "platform", "via", "where"],
};

export function guessMapping(columns: string[]): Mapping {
  const out: Mapping = { date: null, client: null, message: null, channel: null }; const used = new Set<number>();
  for (const f of ["message", "date", "client", "channel"] as ImportField[]) {
    const i = columns.findIndex((c, k) => !used.has(k) && HINTS[f].some((h) => c.toLowerCase().includes(h)));
    if (i >= 0) { out[f] = i; used.add(i); }
  }
  return out;
}

/** CSV with quotes, commas inside quotes and line breaks inside quotes. Detects ; or tab separators. */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const first = text.split("\n", 1)[0];
  const delim = [",", ";", "\t"].reduce((a, b) => (first.split(b).length > first.split(a).length ? b : a));
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

/** First sheet of an .xlsx file, read in the browser (an .xlsx file is a zip of XML files). */
export async function parseXLSX(buf: ArrayBuffer): Promise<string[][]> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot read Excel files. Save the file as CSV and try again.");
  const files = await unzip(buf, (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n) || n === "xl/styles.xml");
  const xml = (s?: string) => (s ? new DOMParser().parseFromString(s, "application/xml") : null);
  const shared = Array.from(xml(files["xl/sharedStrings.xml"])?.getElementsByTagName("si") ?? []).map((si) => Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  // first sheet in the workbook order
  const wb = xml(files["xl/workbook.xml"]); const rels = xml(files["xl/_rels/workbook.xml.rels"]);
  const firstSheet = wb?.getElementsByTagName("sheet")[0];
  const rid = firstSheet?.getAttribute("r:id") ?? firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const target = Array.from(rels?.getElementsByTagName("Relationship") ?? []).find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
  const path = target ? "xl/" + target.replace(/^\/?xl\//, "").replace(/^\//, "") : Object.keys(files).filter((n) => n.startsWith("xl/worksheets/")).sort()[0];
  const sheet = xml(files[path]);
  if (!sheet) throw new Error("No sheet found in this Excel file.");
  // which number formats are dates
  const styles = xml(files["xl/styles.xml"]);
  const customDate = new Set(Array.from(styles?.getElementsByTagName("numFmt") ?? []).filter((n) => /[dmy]/i.test((n.getAttribute("formatCode") ?? "").replace(/\[[^\]]*\]|"[^"]*"/g, ""))).map((n) => n.getAttribute("numFmtId")));
  const xfs = Array.from(styles?.getElementsByTagName("cellXfs")[0]?.getElementsByTagName("xf") ?? []).map((x) => { const id = x.getAttribute("numFmtId") ?? "0"; const n = Number(id); return (n >= 14 && n <= 22) || (n >= 45 && n <= 47) || customDate.has(id); });
  const rows: string[][] = [];
  for (const r of Array.from(sheet.getElementsByTagName("row"))) {
    const out: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") ?? ""; const col = colIndex(ref.replace(/\d+/g, "")); const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let val = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? Array.from(c.getElementsByTagName("t")).map((x) => x.textContent).join("") : t === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
      if (!t && v && xfs[Number(c.getAttribute("s") ?? 0)]) val = excelDate(Number(v));
      else if (!t && /^-?\d+\.\d+$/.test(val)) val = String(Math.round(Number(val) * 1e6) / 1e6);
      out[col >= 0 ? col : out.length] = val.trim();
    }
    rows.push(Array.from(out, (x) => x ?? ""));
  }
  return rows;
}
const colIndex = (letters: string) => letters.split("").reduce((n, ch) => n * 26 + ch.toUpperCase().charCodeAt(0) - 64, 0) - 1;
function excelDate(serial: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Record<string, string>> {
  const v = new DataView(buf); const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This does not look like an Excel (.xlsx) file.");
  const count = v.getUint16(eocd + 10, true); let p = v.getUint32(eocd + 16, true); const out: Record<string, string> = {};
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + el + cl;
    if (!want(name)) continue;
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true);
    const data = u8.subarray(start, start + size);
    const bytes = method === 0 ? data : new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    out[name] = new TextDecoder().decode(bytes);
  }
  return out;
}

/** Reads a file the team picked: header row + data rows (as text). */
export async function readTable(file: File): Promise<{ columns: string[]; rows: string[][]; total: number; mapping: Mapping }> {
  const name = file.name.toLowerCase();
  let table: string[][];
  if (name.endsWith(".xlsx")) table = await parseXLSX(await file.arrayBuffer());
  else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const buf = await file.arrayBuffer();
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { text = new TextDecoder("windows-1252").decode(buf); }
    table = parseCSV(text);
  } else if (name.endsWith(".xls")) throw new Error("Old Excel files (.xls) are not supported. In Excel, choose Save As → .xlsx or .csv.");
  else throw new Error("Please upload an Excel (.xlsx) or CSV file.");
  table = table.filter((r) => r.some((c) => c));
  if (table.length < 2) throw new Error("The file has no rows to import (the first row must be the column names).");
  const width = Math.max(...table.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => table[0][i] || `Column ${i + 1}`);
  const rows = table.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`The file has ${rows.length} rows. Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  return { columns, rows, total: rows.length, mapping: guessMapping(columns) };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Accepts 2025-11-03, 2025-11-03 14:20, 11/03/2025 (month first unless the first number is above 12),
 *  3 Nov 2025, Nov 3, 2025 and Excel date numbers. Read as Philippine time. Returns an ISO string or null. */
