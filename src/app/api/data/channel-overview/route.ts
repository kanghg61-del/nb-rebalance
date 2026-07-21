import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 재고 현황 서브탭 - KPI 요약 (선택 채널 기준)
export async function GET(req: NextRequest) {
  try {
    const ch = new URL(req.url).searchParams.get('ch') ?? '전체';
    const { rows, source, csvDate } = await loadSkuData();
    const isAll = ch === '전체';

    let tot_inv = 0, tot_amt = 0, n_item = 0, n_urgent = 0, tot_in = 0, tot_out = 0;
    for (const r of rows) {
      const inv = isAll ? CHANNELS.reduce((s, c) => s + (r.inv[c] ?? 0), 0) : (r.inv[ch] ?? 0);
      const ord = isAll ? CHANNELS.reduce((s, c) => s + (r.ord[c] ?? 0), 0) : (r.ord[ch] ?? 0);
      const inv_amt = isAll
        ? CHANNELS.reduce((s, c) => s + (r.inv_amt[c] || (r.inv[c] ?? 0) * r.정상가), 0)
        : (r.inv_amt[ch] || inv * r.정상가);
      tot_inv += inv;
      tot_amt += inv_amt;
      if (ord > 0) {
        n_item += 1;
        if (inv / ord < 1) n_urgent += 1;
      }
    }
    const rate = n_item > 0 ? (n_urgent / n_item * 100) : 0;

    return NextResponse.json({
      status: 'ok', source, csvDate, channel: ch,
      kpi: {
        tot_inv, tot_amt: Math.round(tot_amt),
        n_item, n_urgent, urgent_rate: Number(rate.toFixed(1)),
      },
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
