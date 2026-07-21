import { NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import style_map from '@/data/style_map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const WH: Record<string, string> = { '공홈': 'NBGH', '무신사': 'NBMS', '29CM': 'NB29' };
const CH_SHORT: Record<string, string> = { '공홈': '공홈', '무신사': '무신', '29CM': '29CM' };

export async function GET() {
  try {
    const { rows: skus, csvDate } = await loadSkuData();
    const rows: any[] = [];
    let nX = 0, nM = 0, nS = 0, fill_q = 0, fill_amt = 0, bw_total_qty = 0, bw_total_amt = 0;
    for (const d of skus) {
      const bw_q_pre = d.inv_반응과;
      if (bw_q_pre <= 0) continue;  // 반응과 재고 0 제외
      const ti = CHANNELS.reduce((s, c) => s + (d.inv[c] ?? 0), 0);
      const to = CHANNELS.reduce((s, c) => s + (d.ord[c] ?? 0), 0);
      if (to <= 0 && ti <= 0) continue;
      const woc = to > 0 ? ti / to : null;
      let grade: string;
      if (woc === null) grade = '– 무판매';
      else if (woc < 1) { grade = '🔴 X 결품임박'; nX++; }
      else if (woc < 4) { grade = '🟡 M 주의'; nM++; }
      else { grade = '🟢 S 정상'; nS++; }
      const bw_q = d.inv_반응과;
      let fillq = 0;
      if (woc !== null && woc < 1) {
        fillq = Math.max(0, Math.round(to - ti));
        fillq = Math.min(fillq, bw_q);  // 반응과 상한
      }
      const price = d.정상가;
      fill_q += fillq; fill_amt += fillq * price;
      const bw_amt = bw_q * price;
      bw_total_qty += bw_q; bw_total_amt += bw_amt;
      const topch = to > 0 ? CHANNELS.reduce((a, c) => (d.ord[c] ?? 0) > (d.ord[a] ?? 0) ? c : a, CHANNELS[0]) : '-';
      const sty_code = d.단품코드.slice(0, 10);
      const woc_after = to > 0 ? (ti + fillq) / to : null;
      rows.push({
        grade, sty_code, code: d.단품코드, name: (style_map as any)[sty_code] ?? d.단품명 ?? sty_code,
        topch: CH_SHORT[topch] ?? topch,
        wh_code: WH[topch] ?? '-',
        inv: ti, bw_qty: bw_q, bw_amt: Math.round(bw_amt / 10000),
        ord: to, woc: woc !== null ? +woc.toFixed(1) : null,
        fillq, fill_amt_man: Math.round(fillq * price / 10000),
        woc_after: woc_after !== null ? +woc_after.toFixed(1) : null,
        price,
      });
    }
    // 스타일 aggregate
    const style_grp: Record<string, any> = {};
    for (const r of rows) {
      const sty = r.sty_code;
      if (!style_grp[sty]) style_grp[sty] = { name: (style_map as any)[sty] ?? r.name, topch: r.topch, wh_code: r.wh_code, inv: 0, ord: 0, qty: 0, amt: 0, bw_q: 0, bw_amt: 0 };
      const g = style_grp[sty];
      g.inv += r.inv; g.ord += r.ord;
      g.qty += r.fillq; g.amt += r.fillq * r.price;
      g.bw_q += r.bw_qty; g.bw_amt += r.bw_amt;
    }
    const top10 = Object.entries(style_grp).map(([sty, g]: [string, any]) => {
      const woc = g.ord > 0 ? g.inv / g.ord : null;
      const gr = woc === null ? '–' : woc < 1 ? '🔴 X' : woc < 4 ? '🟡 M' : '🟢 S';
      const woc_after = g.ord > 0 ? (g.inv + g.qty) / g.ord : null;
      return { grade: gr, sty, name: g.name, topch: g.topch, wh_code: g.wh_code,
        inv: g.inv, bw_q: g.bw_q, bw_amt_man: g.bw_amt,
        ord: g.ord, woc: woc !== null ? +woc.toFixed(1) : null,
        qty: g.qty, amt_man: Math.round(g.amt / 10000),
        woc_after: woc_after !== null ? +woc_after.toFixed(1) : null };
    }).sort((a, b) => b.amt_man - a.amt_man).slice(0, 10);
    const top10_amt_sum = top10.reduce((s, g) => s + g.amt_man, 0) * 10000;
    const top10_share = fill_amt > 0 ? (top10_amt_sum / fill_amt * 100) : 0;

    return NextResponse.json({
      status: 'ok', csvDate,
      summary: { nX, nM, nS, fill_q, fill_amt, bw_total_qty, bw_total_amt,
        top10_amt_sum, top10_share, total: rows.length },
      top10, rows,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
