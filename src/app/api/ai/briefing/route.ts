import { NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import { runScenario, SCENARIOS } from '@/lib/rebalance-engine';
import style_map from '@/data/style_map.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const { rows: skus, csvDate } = await loadSkuData();
    const preset = SCENARIOS['🛡️ 기본'];
    const results = runScenario(skus, { ...preset, ch_excl: {} }, CHANNELS);

    // 전일 매출 (일평균 · daily_amt/7)
    let daily_amt_total = 0;
    const ch_daily_amt: Record<string, number> = {};
    for (const c of CHANNELS) ch_daily_amt[c] = 0;
    let total_inv_qty = 0, total_inv_amt = 0, total_orders_qty = 0, short_cnt = 0;
    const style_qty: Record<string, number> = {};
    const style_name: Record<string, string> = {};
    const style_price: Record<string, number> = {};

    for (const d of skus) {
      const price = d.정상가;
      const sty = d.단품코드.slice(0, 10);
      let short = false;
      for (const c of CHANNELS) {
        const o = d.ord[c] ?? 0, i = d.inv[c] ?? 0;
        const amt_ch = (d.daily_amt?.[c] || (o * price / 7));
        ch_daily_amt[c] += amt_ch; daily_amt_total += amt_ch;
        total_inv_qty += i;
        total_inv_amt += (d.inv_amt[c] || i * price);
        total_orders_qty += o;
        if (o > 0 && i / o < 1) short = true;
      }
      if (short) short_cnt++;
      const tot_o = CHANNELS.reduce((s, c) => s + (d.ord[c] ?? 0), 0);
      if (tot_o > 0) {
        style_qty[sty] = (style_qty[sty] ?? 0) + tot_o;
        style_price[sty] = price;
        style_name[sty] = (style_map as any)[sty] ?? (d.단품명 || sty);
      }
    }

    // 회전
    let rotation_qty = 0, rotation_revenue = 0, actual_move_amt = 0;
    for (const r of results) {
      const pos = Object.values(r.moves).filter((v: number) => v > 0).reduce((s: number, v: number) => s + v, 0);
      rotation_qty += pos; rotation_revenue += r.revenue;
      actual_move_amt += pos * r.data.정상가;
    }
    // 분배 (반응과 fillup)
    let dist_qty = 0, dist_revenue = 0, dist_actual_amt = 0;
    for (const r of results) {
      const d = r.data;
      let bw = d.inv_반응과;
      if (bw <= 0) continue;
      for (const c of CHANNELS) {
        const o = d.ord[c] ?? 0;
        if (o <= 0 || bw <= 0) continue;
        const after_i = (d.inv[c] ?? 0) + (r.moves[c] ?? 0);
        const need = Math.max(0, Math.ceil(preset.target_woc * o - after_i));
        if (need <= 0) continue;
        const q = Math.min(bw, need);
        bw -= q;
        dist_qty += q;
        dist_actual_amt += q * d.정상가;
        const short_before = Math.max(0, o - after_i);
        dist_revenue += Math.min(q, short_before) * d.정상가;
      }
    }
    const moved_cnt = results.filter(r => Object.values(r.moves).some((v: number) => v > 0)).length;
    const not_covered = Math.max(0, short_cnt - moved_cnt);

    // TOP 10 스타일 (매출 순)
    const style_amt: [string, number][] = Object.entries(style_qty).map(([s, q]) => [s, q * (style_price[s] ?? 0)]);
    style_amt.sort((a, b) => b[1] - a[1]);
    const top_10 = style_amt.slice(0, 10).map(([sty, amt]) => ({
      style: sty,
      name: style_name[sty] ?? sty,
      daily_qty: Math.floor((style_qty[sty] ?? 0) / 7),
      daily_amt_man: Math.round((amt / 7) / 10000),
    }));

    // 브리핑 스크립트 (스트림릿 body 매칭)
    const daily_eok = Math.floor(daily_amt_total / 1e8);
    const daily_man = Math.floor((daily_amt_total % 1e8) / 10000);
    const total_inv_eok = total_inv_amt / 1e8;
    const daily_qty_avg = total_orders_qty > 0 ? total_orders_qty / 7 : 0;
    const woc_days = daily_qty_avg > 0 ? Math.floor(total_inv_qty / daily_qty_avg) : 0;
    const actual_eok = actual_move_amt / 1e8;
    const rev_eok = rotation_revenue / 1e8 / 7;
    const dist_actual_eok = dist_actual_amt / 1e8;
    const dist_rev_eok = dist_revenue / 1e8 / 7;
    const ch_strs = CHANNELS.map(c => `${c} ${Math.round(ch_daily_amt[c] / 10000).toLocaleString()}만원`).join(' / ');

    const briefing_html = `
      <b>[최근 일자(${csvDate ?? ''}) 온라인 주문 매출 보고]</b><br>
      주문 매출은 <b>${daily_eok}억 ${daily_man.toLocaleString()}만원</b>입니다.<br>
      채널별: ${ch_strs}<br>
      온라인 현 재고액은 <b>${total_inv_eok.toFixed(0)}억</b>이며, 재고보유일수는 <b>${woc_days}일</b>입니다.<br><br>
      <b>[회전·분배 추천]</b><br>
      현재 3채널 결품 <b>${short_cnt.toLocaleString()}건</b> 발생하여 총 회전량 <b>${rotation_qty.toLocaleString()}장</b> 재배치 필요 —
      실제 이동금액 <b>${actual_eok.toFixed(2)}억</b> / 기대매출 <b>${rev_eok.toFixed(2)}억</b>.<br>
      회전으로 채우지 못하는 <b>${not_covered.toLocaleString()}건</b>에 대해서는 반응과에서 <b>${dist_qty.toLocaleString()}장</b> 필업 필요 —
      실제 이동금액 <b>${dist_actual_eok.toFixed(2)}억</b> / 기대매출 <b>${dist_rev_eok.toFixed(2)}억</b>.
    `.trim();

    return NextResponse.json({
      status: 'ok', csvDate,
      briefing_html,
      metrics: {
        daily_amt_total, ch_daily_amt,
        total_inv_qty, total_inv_amt, woc_days,
        short_cnt, rotation_qty, rotation_revenue, actual_move_amt,
        dist_qty, dist_revenue, dist_actual_amt, not_covered,
      },
      top_10,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
