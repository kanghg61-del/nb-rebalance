import { NextResponse } from 'next/server';
import { ghFetchCsv } from '@/lib/gh';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANDIDATES = ['execution_log.csv', '3. 대시보드/rebal_web_v2.0_deploy/execution_log.csv'];

// Fallback: 알려진 8일 baseline (task #176 기록치)
const FALLBACK = [{
  id: '1', '실행일시': '2026-07-09 17:19', '시나리오': '🛡️ 기본',
  '단품수': '3261', '이동량_장': '11001', '기대효과_만원': '14661',
  '실제효과_만원': '8128', '추가판매_장': '2462', '실측일': '2026-07-16',
  '상태': '실측 완료', '메모': '8일 누적 실측(7/9~16, strict CAP)',
}];

export async function GET() {
  for (const path of CANDIDATES) {
    try {
      const { rows } = await ghFetchCsv(path);
      if (rows.length > 0) return NextResponse.json({ status: 'ok', count: rows.length, source: `github:${path}`, data: rows });
    } catch { /* try next */ }
  }
  return NextResponse.json({
    status: 'fallback',
    message: 'execution_log.csv를 GitHub raw에서 찾을 수 없음. 알려진 최신 실측치(8일 baseline · task #176)로 대체.',
    count: FALLBACK.length,
    source: 'embedded_fallback',
    data: FALLBACK,
  });
}
