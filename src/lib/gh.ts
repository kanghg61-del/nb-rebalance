/**
 * GitHub raw 파일 fetch 헬퍼
 * - 기존 Streamlit REBA repo (kanghg61-del/nb-rebalance)에서 CSV/JSON 조회
 * - 캐시 30초 (조회 부하 최소화)
 */

const GH_REPO = 'kanghg61-del/nb-rebalance';
const GH_BRANCH = 'main';
const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = { data: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

export async function ghFetchText(path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/${path}?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GH fetch ${path} → HTTP ${res.status}`);
  return res.text();
}

export async function ghFetchJson<T = unknown>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data as T;
  const text = await ghFetchText(path);
  const data = JSON.parse(text) as T;
  cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function ghFetchCsv(path: string): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data as { headers: string[]; rows: Record<string, string>[] };
  const text = await ghFetchText(path);
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
    rows.push(row);
  }
  const data = { headers, rows };
  cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
