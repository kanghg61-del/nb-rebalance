import { NextResponse } from 'next/server';
import { ghFetchCsv } from '@/lib/gh';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANDIDATES = ['reorder_mapping.csv', '3. 대시보드/rebal_web_v2.0_deploy/reorder_mapping.csv'];

export async function GET() {
  for (const path of CANDIDATES) {
    try {
      const { rows } = await ghFetchCsv(path);
      if (rows.length > 0) return NextResponse.json({ status: 'ok', count: rows.length, source: `github:${path}`, data: rows });
    } catch { /* try next */ }
  }
  return NextResponse.json({
    status: 'fallback',
    message: 'reorder_mapping.csv를 GitHub raw에서 찾을 수 없음. CAIO 폴더에는 존재 → GitHub push 후 자동 반영됨.',
    count: 0,
    source: 'not_found',
    data: [],
  });
}
