import { NextRequest, NextResponse } from 'next/server';
import { ghSave, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const { rows } = await req.json();
    if (!Array.isArray(rows)) return NextResponse.json({ status: 'error', message: 'rows 배열 필요' }, { status: 400 });
    const header = ['원오더코드','리오더코드','스타일명','상태','메모'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(header.map(k => String(r[k] ?? '').replace(/,/g, ' ')).join(','));
    }
    const g = await ghSave('reorder_mapping.csv', lines.join('\n') + '\n', `리오더 매핑 저장 · ${rows.length}건`);
    if (!g.ok) return NextResponse.json({ status: 'error', message: g.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', count: rows.length });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
