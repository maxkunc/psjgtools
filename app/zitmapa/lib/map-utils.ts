import * as XLSX from "xlsx";
import LZString from "lz-string";
import mammoth from "mammoth/mammoth.browser";

export interface LocationRow {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  description?: string;
  category?: string;
  extra: Record<string, unknown>;
}

const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const KNOWN_KEYS = ["name", "title", "label", "address", "location", "city", "place", "latitude", "lat", "longitude", "lng", "lon", "long", "description", "notes", "details", "category", "type", "group"];

export function parseExcel(buf: ArrayBuffer): LocationRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // First attempt: assume first row is header
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  // Detect headerless / unrecognized-column files: no row contains any known key
  const headerKeys = rows.length ? Object.keys(rows[0]).map((k) => k.toLowerCase().trim()) : [];
  const hasKnown = headerKeys.some((k) => KNOWN_KEYS.includes(k));

  if (!hasKnown) {
    // Treat as headerless list — each row's first non-empty cell is the name
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    return raw
      .map((r, i) => {
        const first = (r as unknown[]).find((v) => v !== "" && v != null);
        if (!first) return null;
        return {
          id: `${i}-${Math.random().toString(36).slice(2, 8)}`,
          name: String(first).trim(),
          address: String(first).trim(),
          lat: undefined,
          lng: undefined,
          description: undefined,
          category: undefined,
          extra: { value: first },
        } as LocationRow;
      })
      .filter((x): x is LocationRow => x !== null);
  }

  return rows.map((row, i) => {
    const name = String(pick(row, ["name", "title", "label"]) ?? `Location ${i + 1}`);
    const address = pick(row, ["address", "location", "city", "place"]);
    const latRaw = pick(row, ["latitude", "lat"]);
    const lngRaw = pick(row, ["longitude", "lng", "lon", "long"]);
    const lat = latRaw !== undefined ? Number(latRaw) : undefined;
    const lng = lngRaw !== undefined ? Number(lngRaw) : undefined;
    return {
      id: `${i}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      address: address ? String(address) : undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      description: pick(row, ["description", "notes", "details"]) as string | undefined,
      category: pick(row, ["category", "type", "group"]) as string | undefined,
      extra: row,
    };
  });
}

function linesToRows(lines: string[], prefix: string): LocationRow[] {
  return lines.map((line, i) => {
    const name = line.replace(/^\s*(?:\d+[.)]\s*|[-–—•·*]\s*)/, "").trim();
    if (!name) return null;
    return {
      id: `${prefix}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      address: name,
      lat: undefined,
      lng: undefined,
      description: undefined,
      category: undefined,
      extra: { source: prefix },
    } as LocationRow;
  }).filter((x): x is LocationRow => x !== null);
}

export async function parsePdf(buf: ArrayBuffer): Promise<LocationRow[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => {
        const item = it as { str?: string; hasEOL?: boolean };
        return (item.str ?? "") + (item.hasEOL ? "\n" : " ");
      })
      .join("");
    text += pageText + "\n";
  }
  const rawLines = text.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.length > 1
    ? rawLines
    : (rawLines[0] ?? "").split(/[;,\u2022\u00b7]+/).map((l) => l.trim()).filter(Boolean);
  return linesToRows(lines, "pdf");
}

export async function parseDocx(buf: ArrayBuffer): Promise<LocationRow[]> {
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
  // Split on newlines, bullets, semicolons, commas only if no newlines present
  const rawLines = text.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines.length > 1
    ? rawLines
    : (rawLines[0] ?? "").split(/[;,\u2022\u00b7]+/).map((l) => l.trim()).filter(Boolean);

  return lines.map((line, i) => {
    // Strip leading list markers like "1.", "1)", "-", "•"
    const name = line.replace(/^\s*(?:\d+[.)]\s*|[-–—•·*]\s*)/, "").trim();
    if (!name) return null;
    return {
      id: `d-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      address: name,
      lat: undefined,
      lng: undefined,
      description: undefined,
      category: undefined,
      extra: { source: "docx" },
    } as LocationRow;
  }).filter((x): x is LocationRow => x !== null);
}

const CZ_PREFIXES = [
  /^ostr?\.\s*/i,
  /^ostrovy?\s+/i,
  /^poloostr?\.\s*/i,
  /^poloostrov\s+/i,
  /^mys\s+/i,
  /^pouš[tť]\s+/i,
  /^moře\s+/i,
  /^záliv\s+/i,
  /^průliv\s+/i,
  /^průplav\s+/i,
  /^jezero\s+/i,
  /^řeka\s+/i,
  /^pohoří\s+/i,
  /^hory\s+/i,
  /^hora\s+/i,
  /^sopka\s+/i,
  /^nížina\s+/i,
  /^plošina\s+/i,
];

const CZ_TO_EN: Array<[RegExp, string]> = [
  [/\bostrovy\b/i, "islands"],
  [/\bostrov\b/i, "island"],
  [/\bostr?\./i, "island"],
  [/\bpoloostrov\b/i, "peninsula"],
  [/\bpoloostr?\./i, "peninsula"],
  [/\bmys\b/i, "cape"],
  [/\bpouš[tť]\b/i, "desert"],
  [/\bmoře\b/i, "sea"],
  [/\bzáliv\b/i, "gulf"],
  [/\bprůliv\b/i, "strait"],
  [/\bjezero\b/i, "lake"],
  [/\břeka\b/i, "river"],
  [/\bpohoří\b/i, "mountains"],
  [/\bhory\b/i, "mountains"],
  [/\bhora\b/i, "mountain"],
  [/\bsopka\b/i, "volcano"],
  [/\bnížina\b/i, "lowland"],
  [/\bplošina\b/i, "plateau"],
];

function stripPrefixes(s: string): string {
  let out = s.trim();
  for (const re of CZ_PREFIXES) out = out.replace(re, "");
  return out.trim();
}

function toEnglishHint(s: string): string {
  let out = s;
  for (const [re, en] of CZ_TO_EN) out = out.replace(re, en);
  return out.trim();
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeOnce(query: string, lang = "cs,en"): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${lang}&q=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query)!;

  const variants: Array<{ q: string; lang: string }> = [{ q: query, lang: "cs,en" }];
  const stripped = stripPrefixes(query);
  if (stripped && stripped !== query) variants.push({ q: stripped, lang: "cs,en" });
  const en = toEnglishHint(query);
  if (en && en !== query) variants.push({ q: en, lang: "en" });
  const strippedEn = toEnglishHint(stripped);
  if (strippedEn && strippedEn !== stripped && strippedEn !== en) {
    variants.push({ q: strippedEn, lang: "en" });
  }

  let result: { lat: number; lng: number } | null = null;
  for (let i = 0; i < variants.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    result = await geocodeOnce(variants[i].q, variants[i].lang);
    if (result) break;
  }

  geocodeCache.set(query, result);
  return result;
}


export async function geocodeAll(
  rows: LocationRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<LocationRow[]> {
  const needs = rows.filter((r) => (r.lat === undefined || r.lng === undefined) && r.address);
  let done = 0;
  for (const row of needs) {
    const coords = await geocode(row.address!);
    if (coords) {
      row.lat = coords.lat;
      row.lng = coords.lng;
    }
    done++;
    onProgress?.(done, needs.length);
    await new Promise((r) => setTimeout(r, 1100));
  }
  return rows;
}

export function encodeShareData(rows: LocationRow[]): string {
  const minimal = rows
    .filter((r) => r.lat !== undefined && r.lng !== undefined)
    .map((r) => ({
      n: r.name,
      a: r.address,
      la: r.lat,
      lo: r.lng,
      d: r.description,
      c: r.category,
    }));
  return LZString.compressToEncodedURIComponent(JSON.stringify(minimal));
}

export function decodeShareData(s: string): LocationRow[] | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(s);
    if (!json) return null;
    const arr = JSON.parse(json) as Array<Record<string, unknown>>;
    return arr.map((r, i) => ({
      id: `s-${i}`,
      name: String(r.n ?? `Location ${i + 1}`),
      address: r.a as string | undefined,
      lat: r.la as number,
      lng: r.lo as number,
      description: r.d as string | undefined,
      category: r.c as string | undefined,
      extra: {},
    }));
  } catch {
    return null;
  }
}

export function downloadSampleTemplate() {
  const data = [
    { Name: "Eiffel Tower", Address: "Paris, France", Category: "Landmark", Description: "Iron lattice tower built 1889." },
    { Name: "Statue of Liberty", Address: "New York, NY", Category: "Landmark", Description: "Gift from France, 1886." },
    { Name: "Sydney Opera House", Latitude: -33.8568, Longitude: 151.2153, Category: "Landmark", Description: "Multi-venue performing arts centre." },
    { Name: "Tokyo Tower", Address: "Tokyo, Japan", Category: "Landmark", Description: "Communications tower in Shiba-koen." },
  ];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Locations");
  XLSX.writeFile(wb, "locations-template.xlsx");
}

const categoryColors = [
  "oklch(0.62 0.19 256)",
  "oklch(0.65 0.2 25)",
  "oklch(0.7 0.18 145)",
  "oklch(0.72 0.18 65)",
  "oklch(0.6 0.22 320)",
  "oklch(0.65 0.2 195)",
];

export function colorForCategory(cat: string | undefined, allCats: string[]): string {
  if (!cat) return "oklch(0.4 0.02 260)";
  const i = allCats.indexOf(cat);
  return categoryColors[i % categoryColors.length];
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
