import { NextRequest, NextResponse } from 'next/server';
import { ghSave, ghLoad, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meta = await ghLoad('reorder_send_log.csv');
    if (!meta) return NextResponse.json({ status: 'ok', rows: [] });
    const lines = meta.content.trim().split(/\r?\n/);
    if (lines.length < 2) return NextResponse.json({ status: 'ok', rows: [] });
    const header = lines[0].split(',');
    const rows = lines.slice(1).map(l => { const c = l.split(','); const o: any = {}; header.forEach((h, i) => o[h] = c[i] ?? ''); return o; });
    return NextResponse.json({ status: 'ok', rows });
  } catch (e) { return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const { channel, sku_count, total_qty, total_exp, memo } = await req.json();
    const meta = await ghLoad('reorder_send_log.csv');
    const header = 'id,발송일시,채널,단품수,총요청량,기대매출_만원,메모';
    const lines = meta ? meta.content.trim().split(/\r?\n/) : [header];
    if (lines[0] !== header && !lines[0].startsWith('id,')) lines.splice(0, 0, header);
    const ids = lines.slice(1).map(l => Number(l.split(',')[0])).filter(n => !isNaN(n));
    const newId = ids.length ? Math.max(...ids) + 1 : 1;
    const now = new Date();
    const ts = `${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,5)}`;
    lines.push([newId, ts, channel ?? '전체', sku_count ?? 0, total_qty ?? 0, Math.round((total_exp ?? 0) / 10000), memo ?? 'Next.js REBA 발송'].join(','));
    const r = await ghSave('reorder_send_log.csv', lines.join('\n') + '\n', `리오더 발송 승인 · id=${newId}`);
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', id: newId });
  } catch (e) { return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
