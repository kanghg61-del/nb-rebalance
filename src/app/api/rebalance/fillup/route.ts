import { NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 추가 분배 = min(반응과재고, max(0, 주판-현재고))
 * 반응과 재고 0인 단품 제외 · 결품임박 우선 (WOC < 1)
 */
export async function GET() {
  try {
    const { rows: skus, source, csvDate } = await loadSkuData();
    const rows: Array<{
      rank: number; code: string; name: string; price: number;
      channel: string; fillup: number; inv_react: number;
      inv_current: number; ord: number;
      woc_before: number | null; woc_after: number | null;
      effect: number;
    }> = [];

    for (const r of skus) {
      if (r.inv_반응과 <= 0) continue;
      let react_left = r.inv_반응과;
      for (const c of CHANNELS) {
        if (react_left <= 0) break;
        const inv = r.inv[c] ?? 0;
        const ord = r.ord[c] ?? 0;
        if (ord <= 0) continue;
        const woc = inv / ord;
        if (woc >= 1) continue;
        const need = Math.max(0, ord - inv);
        const qty = Math.min(react_left, need);
        if (qty <= 0) continue;
        react_left -= qty;
        rows.push({
          rank: rows.length + 1,
          code: r.단품코드, name: r.단품명, price: r.정상가,
          channel: c, fillup: qty, inv_react: r.inv_반응과,
          inv_current: inv, ord,
          woc_before: ord > 0 ? inv / ord : null,
          woc_after: ord > 0 ? (inv + qty) / ord : null,
          effect: qty * r.정상가,
        });
      }
    }

    rows.sort((a, b) => b.effect - a.effect);
    rows.forEach((f, i) => f.rank = i + 1);

    const total_qty = rows.reduce((s, f) => s + f.fillup, 0);
    const total_effect = rows.reduce((s, f) => s + f.effect, 0);
    const unique_skus = new Set(rows.map(f => f.code)).size;
    const unique_styles = new Set(rows.map(f => f.code.slice(0, 10))).size;

    return NextResponse.json({
      status: 'ok', source, csvDate,
      summary: { total_qty, total_effect, unique_skus, unique_styles },
      rows: rows.slice(0, 500),
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
