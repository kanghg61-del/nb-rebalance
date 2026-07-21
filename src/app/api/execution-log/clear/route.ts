import { NextResponse } from 'next/server';
import { ghSave, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST() {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const header = 'id,실행일시,시나리오,단품수,이동량_장,기대효과_만원,실제효과_만원,추가판매_장,실측일,상태,메모';
    const r = await ghSave('execution_log.csv', header + '\n', '이력 초기화');
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok' });
  } catch (e) { return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
