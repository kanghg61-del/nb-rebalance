import { NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const { rows: skus, source, csvDate } = await loadSkuData();
    // 채널별 WOC < 1 = 결품 임박
    const rows = skus.map(r => {
      const woc: Record<string, number | null> = {};
      let anyShort = false;
      for (const c of CHANNELS) {
        const inv = r.inv[c] ?? 0;
        const ord = r.ord[c] ?? 0;
        const w = ord > 0 ? inv / ord : null;
        woc[c] = w;
        if (w !== null && w < 1) anyShort = true;
      }
      return {
        단품코드: r.단품코드, 단품명: r.단품명, 정상가: r.정상가,
        inv: r.inv, ord: r.ord, woc,
        _short: anyShort,
      };
    }).filter(r => r._short);

    return NextResponse.json({
      status: 'ok', source, csvDate,
      rows,
      count: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
