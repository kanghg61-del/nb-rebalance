import { NextResponse } from 'next/server';
import { loadSkuData, CHANNELS, EXT_CHANNELS } from '@/lib/csv-loader';

const EXT_NAMES: Record<string, { name: string; code: string }> = {
  '무신사': { name: '무신사 풀필먼트', code: 'NBMSFF' },
  '29CM': { name: '29CM 물류', code: 'NB29FF' },
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Agg = { inv: number; ext: number; inv_amt: number; ext_amt: number; ord_qty: number; ord_amt: number };

export async function GET() {
  try {
    const { rows, source, csvDate } = await loadSkuData();
    const agg: Record<string, Agg> = {};
    for (const ch of CHANNELS) agg[ch] = { inv: 0, ext: 0, inv_amt: 0, ext_amt: 0, ord_qty: 0, ord_amt: 0 };

    for (const r of rows) {
      const price = r.정상가;
      for (const ch of CHANNELS) {
        const iv = r.inv[ch] ?? 0;
        const ext = (EXT_CHANNELS as readonly string[]).includes(ch) ? (r.wh[ch] ?? 0) : 0;
        const od = r.ord[ch] ?? 0;
        agg[ch].inv += iv;
        agg[ch].ext += ext;
        agg[ch].inv_amt += (r.inv_amt[ch] || (iv * price));
        agg[ch].ext_amt += ((EXT_CHANNELS as readonly string[]).includes(ch) ? (r.wh_amt[ch] || (ext * price)) : 0);
        agg[ch].ord_qty += od;
        agg[ch].ord_amt += od * price;
      }
    }

    const summary = CHANNELS.map(ch => {
      const a = agg[ch];
      const woc = a.ord_qty > 0 ? (a.inv / a.ord_qty) : null;
      return {
        channel: ch,
        inv_qty: a.inv,
        inv_amt: Math.round(a.inv_amt),
        int_amt: Math.round(a.inv_amt - a.ext_amt),
        ext_amt: Math.round(a.ext_amt),
        ord_amt: Math.round(a.ord_amt),
        ord_qty: a.ord_qty,
        woc: woc !== null ? Number(woc.toFixed(1)) : null,
      };
    });

    const totals = summary.reduce((acc, s) => ({
      inv_qty: acc.inv_qty + s.inv_qty,
      inv_amt: acc.inv_amt + s.inv_amt,
      int_amt: acc.int_amt + s.int_amt,
      ext_amt: acc.ext_amt + s.ext_amt,
      ord_amt: acc.ord_amt + s.ord_amt,
      ord_qty: acc.ord_qty + s.ord_qty,
    }), { inv_qty: 0, inv_amt: 0, int_amt: 0, ext_amt: 0, ord_amt: 0, ord_qty: 0 });
    const total_woc = totals.ord_qty > 0 ? Number((totals.inv_qty / totals.ord_qty).toFixed(1)) : null;

    const ext_detail = EXT_CHANNELS.map(ch => {
      const info = EXT_NAMES[ch];
      const a = agg[ch];
      return { channel: ch, wh_name: info?.name ?? '', wh_code: info?.code ?? '', ext_qty: a.ext, ext_amt: Math.round(a.ext_amt) };
    });
    return NextResponse.json({
      status: 'ok', source, csvDate,
      sku_count: rows.length, summary,
      totals: { ...totals, woc: total_woc },
      ext_detail,
    });
  } catch (e) {
    return NextResponse.json({
      status: 'error',
      message: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
