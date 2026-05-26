import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(digits);
}

/**
 * Resolve a public asset path against Vite's base URL so it works both at the domain
 * root (dev) and under a GitHub Pages project subpath (e.g. /NIRSer/). BASE_URL always
 * ends in "/", so we strip any leading slash from the path before joining.
 */
export function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\/+/, "")}`;
}

export function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseCsvNumbers(text: string) {
  return text
    .replace(/\r?\n/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}
