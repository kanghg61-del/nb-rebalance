import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import style_map from '@/data/style_map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sel = url.searchParams.get('channel') ?? '전체';
    const { rows: skus, csvDate } = await loadSkuData();
    // imminent_rows_by_channel 이식
    const base: any[] = [];
    for (const d of skus) {
      const ti = sel === '전체' ? CHANNELS.reduce((s, c) => s + (d.inv[c] ?? 0), 0) : (d.inv[sel] ?? 0);
      const to = sel === '전체' ? CHANNELS.reduce((s, c) => s + (d.ord[c] ?? 0), 0) : (d.ord[sel] ?? 0);
      if (to > 0 && ti / to < 1.0) {
        base.push({ code: d.단품코드, name: d.단품명 ?? '', rank: d.온라인랭킹 || 9999,
          inv: ti, ord: to, woc: +(ti / to).toFixed(2), price: d.정상가 });
      }
    }
    base.sort((a, b) => -(Math.max(0, b.ord - b.inv) * b.price) - -(Math.max(0, a.ord - a.inv) * a.price));

    const enriched = base.map(r => {
      const woc = r.woc;
      const grade = woc === null ? '–' : woc < 1 ? '🔴 X' : woc < 4 ? '🟡 M' : '🟢 S';
      const amt1w = r.ord * r.price;
      const reord = Math.max(0, r.ord - r.inv);  // 1주 수요 (스트림릿 매칭)
      const exp = reord * r.price;
      const sty_code = r.code.slice(0, 10); return { ...r, sty_code, sty_name: (style_map as any)[sty_code] ?? r.name, grade, amt1w, reord, exp };
    });

    const tot_reord = enriched.reduce((s, r) => s + r.reord, 0);
    const tot_exp = enriched.reduce((s, r) => s + r.exp, 0);
    const tot_amt1w = enriched.reduce((s, r) => s + r.amt1w, 0);

    // 스타일 aggregate → 우선 검토 10 스타일
    const style_grp: Record<string, any> = {};
    for (const r of enriched) {
      const sty = r.sty_code;
      if (!style_grp[sty]) style_grp[sty] = { name: (style_map as any)[sty] ?? r.sty_name, inv: 0, ord: 0, amt1w: 0, reord: 0, exp: 0 };
      const g = style_grp[sty];
      g.inv += r.inv; g.ord += r.ord;
      g.amt1w += r.amt1w; g.reord += r.reord; g.exp += r.exp;
    }
    const top10 = Object.entries(style_grp).map(([sty, g]: [string, any]) => {
      const woc = g.ord > 0 ? +(g.inv / g.ord).toFixed(1) : null;
      const gr = woc === null ? '–' : woc < 1 ? '🔴 X' : woc < 4 ? '🟡 M' : '🟢 S';
      const woc_after = g.ord > 0 ? +((g.inv + g.reord) / g.ord).toFixed(1) : null;
      return { grade: gr, sty, name: g.name, inv: g.inv, ord: g.ord, woc,
        reord: g.reord, exp_man: Math.round(g.exp / 10000), woc_after,
        amt1w: g.amt1w };
    }).sort((a, b) => b.amt1w - a.amt1w).slice(0, 10);

    return NextResponse.json({
      status: 'ok', csvDate, channel: sel,
      summary: { count: enriched.length, tot_reord, tot_exp, tot_amt1w },
      top10, rows: enriched.slice(0, 500),
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
