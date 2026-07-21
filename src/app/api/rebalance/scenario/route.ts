import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import { runScenario, SCENARIOS, type ScenarioKey, type Params } from '@/lib/rebalance-engine';
import embed from '@/data/ch_excl_embed.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// embed 355건 → params.ch_excl { ch: { in: [style, ...], out: [...] } }
function buildChExclFromEmbed(): Record<string, { in?: string[]; out?: string[] }> {
  const out: Record<string, { in?: string[]; out?: string[] }> = {};
  for (const r of embed.rows as any[]) {
    const ch = r['채널']; const dir = String(r['방향'] || '').toLowerCase();
    const sty = r['스타일']; if (!ch || !sty) continue;
    if (!out[ch]) out[ch] = {};
    if (dir === 'in') { (out[ch].in ??= []).push(sty); }
    else if (dir === 'out') { (out[ch].out ??= []).push(sty); }
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const key = (url.searchParams.get('scenario') as ScenarioKey) ?? '🛡️ 기본';
    const preset = SCENARIOS[key] ?? SCENARIOS['🛡️ 기본'];
    const useChExcl = url.searchParams.get('chx_use') !== 'off';
    const params: Params = {
      shortage_threshold: Number(url.searchParams.get('shortage') ?? preset.shortage_threshold),
      target_woc: Number(url.searchParams.get('target') ?? preset.target_woc),
      ship_th: preset.ship_th,
      min_move_qty: Number(url.searchParams.get('min_move') ?? preset.min_move_qty),
      min_recv_order: Number(url.searchParams.get('min_recv') ?? preset.min_recv_order),
      move_cap_pct: Number(url.searchParams.get('cap') ?? preset.move_cap_pct),
      ch_excl: useChExcl ? buildChExclFromEmbed() : {},
    };

    const { rows: skus, source, csvDate } = await loadSkuData();
    const results = runScenario(skus, params, CHANNELS);

    let total_units = 0, total_units_amt = 0, total_in = 0, total_amt = 0, total_rev = 0;
    const by_channel: Record<string, { in_qty: number; out_qty: number; effect: number }> = {};
    for (const c of CHANNELS) by_channel[c] = { in_qty: 0, out_qty: 0, effect: 0 };

    for (const r of results) {
      const d = r.data;
      for (const c of CHANNELS) {
        const iv = d.inv[c] ?? 0; total_units += iv;
        total_units_amt += (d.inv_amt[c] || iv * d.정상가);
      }
      let pos = 0;
      for (const c of CHANNELS) {
        const mv = r.moves[c] ?? 0;
        if (mv > 0) { pos += mv; by_channel[c].in_qty += mv; }
        else if (mv < 0) by_channel[c].out_qty += -mv;
      }
      total_in += pos; total_amt += pos * d.정상가; total_rev += r.revenue;
      for (const c of CHANNELS) {
        const mv = r.moves[c] ?? 0;
        if (mv > 0) {
          const bef = Math.max(0, (d.ord[c] ?? 0) - (d.inv[c] ?? 0));
          const aft = Math.max(0, (d.ord[c] ?? 0) - ((d.inv[c] ?? 0) + mv));
          by_channel[c].effect += (bef - aft) * d.정상가;
        }
      }
    }

    const includeAll = url.searchParams.get('include_all') === 'on';
    const moved = results.filter(r => Object.values(r.moves).some(v => v !== 0)).sort((a, b) => b.revenue - a.revenue);
    const moved_sku_count = moved.length;
    // include_all: 이동 발생 SKU 우선 + 나머지 SKU를 매출 순 뒤에 붙임
    const matrixSource = includeAll ? [...moved, ...results.filter(r => Object.values(r.moves).every(v => v === 0)).sort((a, b) => b.data.주간외형매출 - a.data.주간외형매출).slice(0, 500)] : moved;
    const matrix = matrixSource.slice(0, 2000).map(r => {
      const d = r.data;
      const woc_before: Record<string, number | null> = {};
      const woc_after: Record<string, number | null> = {};
      const inv_after: Record<string, number> = {};
      let total_move = 0;
      for (const c of CHANNELS) {
        const iv = d.inv[c] ?? 0, o = d.ord[c] ?? 0, mv = r.moves[c] ?? 0;
        woc_before[c] = o > 0 ? iv / o : null;
        inv_after[c] = iv + mv;
        woc_after[c] = o > 0 ? inv_after[c] / o : null;
        if (mv > 0) total_move += mv;
      }
      return {
        code: d.단품코드, name: d.단품명, price: d.정상가,
        wk_sales: d.주간외형매출,
        cum_rate: d.누판율, wk_rate: d.주판율, ship_rate: d.출고율,
        inv_react: d.inv_반응과,
        inv: { ...d.inv }, ord: { ...d.ord },
        woc_before, moves: { ...r.moves }, woc_after, inv_after,
        effect: Math.round(r.revenue / 10000),
        total_move, rank_online: d.온라인랭킹 || 9999,
      };
    });

    return NextResponse.json({
      status: 'ok', source, csvDate, scenario: key, params,
      chx_use: useChExcl, chx_rules_total: embed.total,
      summary: {
        total_move_qty: total_in, total_sku_count: results.length, moved_sku_count,
        total_units, total_units_amt, total_amt,
        expected_effect: total_rev, by_channel,
      },
      matrix, matrix_total: moved.length,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
