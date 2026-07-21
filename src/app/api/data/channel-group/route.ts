import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS, EXT_CHANNELS } from '@/lib/csv-loader';
import style_map from '@/data/style_map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 아이템별/스타일별 그룹 집계 - 스트림릿 render_channel_tab 그룹 aggregate 완전 매칭
// mode=item(3~4자리) 또는 mode=style(10자리)
// 컬럼: 누판율·주판율·주간판매·일평균판매·일평균매출·현재고량·현재고금액·외부창고·주판·WOC
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ch = url.searchParams.get('ch') ?? '전체';
    const mode = url.searchParams.get('mode') ?? 'item';
    const isAll = ch === '전체';
    const { rows, source, csvDate } = await loadSkuData();

    type G = {
      inv: number; ord: number; inv_amt: number;
      ext: number; ext_amt: number;
      wk_sales: number; wk_qty: number;
      cum_rate_sum: number; wk_rate_sum: number;
      sku_count: number; price_sum: number;
      name?: string;
    };
    const groups: Record<string, G> = {};
    for (const r of rows) {
      const key = mode === 'item' ? (r.단품코드.length > 3 ? r.단품코드.slice(2, 4) : '?') : r.단품코드.slice(0, 10);
      if (!groups[key]) groups[key] = { inv: 0, ord: 0, inv_amt: 0, ext: 0, ext_amt: 0, wk_sales: 0, wk_qty: 0, cum_rate_sum: 0, wk_rate_sum: 0, sku_count: 0, price_sum: 0 };
      const g = groups[key];
      const inv = isAll ? CHANNELS.reduce((s, c) => s + (r.inv[c] ?? 0), 0) : (r.inv[ch] ?? 0);
      const ord = isAll ? CHANNELS.reduce((s, c) => s + (r.ord[c] ?? 0), 0) : (r.ord[ch] ?? 0);
      const inv_amt = isAll
        ? CHANNELS.reduce((s, c) => s + (r.inv_amt[c] || (r.inv[c] ?? 0) * r.정상가), 0)
        : (r.inv_amt[ch] || inv * r.정상가);
      const ext = isAll
        ? (EXT_CHANNELS as readonly string[]).reduce((s, c) => s + (r.wh[c] ?? 0), 0)
        : ((EXT_CHANNELS as readonly string[]).includes(ch) ? (r.wh[ch] ?? 0) : 0);
      const ext_amt = isAll
        ? (EXT_CHANNELS as readonly string[]).reduce((s, c) => s + (r.wh_amt[c] ?? 0), 0)
        : ((EXT_CHANNELS as readonly string[]).includes(ch) ? (r.wh_amt[ch] ?? 0) : 0);
      g.inv += inv; g.ord += ord; g.inv_amt += inv_amt;
      g.ext += ext; g.ext_amt += ext_amt;
      g.wk_sales += r.주간외형매출;
      g.wk_qty += r.wk_qty;
      g.cum_rate_sum += r.누판율;
      g.wk_rate_sum += r.주판율;
      g.sku_count += 1;
      g.price_sum += r.정상가;
      if (mode === 'style' && !g.name) g.name = (style_map as any)[key] ?? r.단품명 ?? '';
    }

    const list = Object.entries(groups).map(([k, g]) => {
      const avg_cum = g.sku_count > 0 ? g.cum_rate_sum / g.sku_count : 0;
      const avg_wk = g.sku_count > 0 ? g.wk_rate_sum / g.sku_count : 0;
      const daily = g.ord > 0 ? g.ord / 7 : 0;
      const daily_amt = g.wk_sales / 7;
      return {
        key: k, name: g.name ?? '',
        sku_count: g.sku_count,
        cum_rate: +avg_cum.toFixed(3),
        wk_rate: +avg_wk.toFixed(3),
        wk_sales: g.wk_sales,
        wk_qty: g.wk_qty,
        daily: +daily.toFixed(1),
        daily_amt_man: +(daily_amt / 10000).toFixed(1),
        inv: g.inv,
        inv_amt_man: Math.round(g.inv_amt / 10000),
        ext: g.ext,
        ext_amt_man: Math.round(g.ext_amt / 10000),
        ord: g.ord,
        woc: g.ord > 0 ? Number((g.inv / g.ord).toFixed(1)) : null,
        avg_price: Math.round(g.price_sum / g.sku_count),
      };
    }).filter(r => r.inv > 0 || r.ord > 0).sort((a, b) => b.inv_amt_man - a.inv_amt_man);

    const totals = list.reduce((s, r) => ({
      sku_count: s.sku_count + r.sku_count,
      inv: s.inv + r.inv,
      inv_amt_man: s.inv_amt_man + r.inv_amt_man,
      ext: s.ext + r.ext,
      ext_amt_man: s.ext_amt_man + r.ext_amt_man,
      wk_sales: s.wk_sales + r.wk_sales,
      wk_qty: s.wk_qty + r.wk_qty,
      ord: s.ord + r.ord,
    }), { sku_count: 0, inv: 0, inv_amt_man: 0, ext: 0, ext_amt_man: 0, wk_sales: 0, wk_qty: 0, ord: 0 });
    const total_woc = totals.ord > 0 ? Number((totals.inv / totals.ord).toFixed(1)) : null;

    return NextResponse.json({
      status: 'ok', source, csvDate, channel: ch, mode,
      totals: { ...totals, woc: total_woc, daily: totals.ord > 0 ? +(totals.ord / 7).toFixed(1) : 0, daily_amt_man: +(totals.wk_sales / 7 / 10000).toFixed(1) },
      data: list,
      count: list.length,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
