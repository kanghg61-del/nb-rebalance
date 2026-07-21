import { gunzipSync } from 'node:zlib';

// Streamlit REBA 원본 CSV 구조 (51 columns)
// data/test/data_spao_YYMMDD.csv.gz · 26K~36K rows
const GH_REPO = 'kanghg61-del/nb-rebalance';
const GH_BRANCH = 'main';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export type SkuRow = {
  단품코드: string;
  단품명: string;
  매출랭킹: number;
  온라인랭킹: number;
  정상가: number;
  출고율: number;
  누판율: number;
  주판율: number;
  주간외형매출: number;
  in_qty: number;
  wk_qty: number;
  inv_반응과: number;
  // 3채널 재고·주판·외부창고
  inv: Record<string, number>;
  inv_amt: Record<string, number>;
  ord: Record<string, number>;
  daily: Record<string, number>;
  daily_amt: Record<string, number>;
  wh: Record<string, number>;      // 외부창고 수량
  wh_amt: Record<string, number>;  // 외부창고 금액
};

export const CHANNELS = ['공홈', '무신사', '29CM'] as const;
export const EXT_CHANNELS = ['무신사', '29CM'] as const;

type CacheEntry = { data: SkuRow[]; expiresAt: number; csvDate: string };
let _cache: CacheEntry | null = null;

// 최근 CSV 파일 자동 탐색 (7/16 우선 · fallback으로 7/13, 7/10)
const CSV_CANDIDATES = [
  'data/test/data_spao_260716.csv.gz',
  'data/test/data_spao_260713.csv.gz',
  'data/test/data_spao_260710.csv.gz',
  'data/test/data_spao_260709.csv.gz',
];

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

function num(v: string | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadSkuData(): Promise<{ rows: SkuRow[]; source: string; csvDate: string }> {
  if (_cache && _cache.expiresAt > Date.now()) {
    return { rows: _cache.data, source: `cache:${_cache.csvDate}`, csvDate: _cache.csvDate };
  }

  let usedPath = '';
  let buf: ArrayBuffer | null = null;

  for (const path of CSV_CANDIDATES) {
    try {
      const url = `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/${path}?ts=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        buf = await res.arrayBuffer();
        usedPath = path;
        break;
      }
    } catch { /* try next */ }
  }

  if (!buf) throw new Error('CSV fetch 실패 · 모든 후보 경로 접근 불가');

  // gunzip
  const decompressed = gunzipSync(Buffer.from(buf));
  const text = decompressed.toString('utf-8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) throw new Error('CSV 빈 파일');

  const headers = parseCsvLine(lines[0]);
  const rows: SkuRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    const get = (name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? cells[idx] ?? '' : '';
    };

    const inv: Record<string, number> = {};
    const inv_amt: Record<string, number> = {};
    const ord: Record<string, number> = {};
    const daily: Record<string, number> = {};
    const daily_amt: Record<string, number> = {};
    const wh: Record<string, number> = {};
    const wh_amt: Record<string, number> = {};
    for (const ch of CHANNELS) {
      inv[ch] = num(get(`inv_${ch}`));
      inv_amt[ch] = num(get(`inv_amt_${ch}`));
      ord[ch] = num(get(`ord_${ch}`));
      daily[ch] = num(get(`daily_${ch}`));
      daily_amt[ch] = num(get(`daily_amt_${ch}`));
    }
    for (const ch of EXT_CHANNELS) {
      wh[ch] = num(get(`wh_${ch}`));
      wh_amt[ch] = num(get(`wh_amt_${ch}`));
    }

    rows.push({
      단품코드: get('단품코드'),
      단품명: get('단품명'),
      매출랭킹: num(get('매출랭킹')),
      온라인랭킹: num(get('온라인랭킹')),
      정상가: num(get('정상가')),
      출고율: num(get('출고율')),
      누판율: num(get('누판율')),
      주판율: num(get('주판율')),
      주간외형매출: num(get('주간외형매출')),
      in_qty: num(get('in_qty')),
      wk_qty: num(get('wk_qty')),
      inv_반응과: num(get('inv_반응과')),
      inv, inv_amt, ord, daily, daily_amt, wh, wh_amt,
    });
  }

  const csvDate = usedPath.replace(/^.*data_spao_(\d+)\.csv\.gz$/, '$1');
  _cache = { data: rows, expiresAt: Date.now() + CACHE_TTL_MS, csvDate };
  return { rows, source: `github:${usedPath}`, csvDate };
}
