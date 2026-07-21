import { NextResponse } from 'next/server';
import { ghFetchCsv } from '@/lib/gh';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANDIDATES = ['execution_log.csv'];

// 뉴발란스는 초기 빈 상태 - 실행 이력 누적 시작
const FALLBACK: any[] = [];

export async function GET() {
  for (const path of CANDIDATES) {
    try {
      const { rows } = await ghFetchCsv(path);
      if (rows.length > 0) return NextResponse.json({ status: 'ok', count: rows.length, source: `github:${path}`, data: rows });
    } catch { /* try next */ }
  }
  return NextResponse.json({
    status: 'fallback',
    message: '실행 이력 없음 (초기 상태)',
    count: 0,
    source: 'empty_init',
    data: FALLBACK,
  });
}
