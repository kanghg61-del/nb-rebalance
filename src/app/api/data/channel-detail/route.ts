import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS, EXT_CHANNELS } from '@/lib/csv-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ChSkuRow = {
  code10: string; code: string; name: string; price: number;
  bok: string; item: string;
  cum_rate: number; wk_rate: number;
  daily: number; daily_amt: number;
  inv: number; inv_amt: number;
  ext: number;
  woc: number | null; sojin: number | null;
  move: number; ni: number; woc2: number | null; effect: number;
  status: '긴급결품' | '주의' | '정상' | '무판매';
  rank_online: number;
};

function status(woc: number | null): ChSkuRow['status'] {
  if (woc === null) return '무판매';
  if (woc < 1) return '긴급결품';
  if (woc < 2) return '주의';
  return '정상';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ch = url.searchParams.get('ch') ?? '전체';
    const bok = url.searchParams.get('bok') ?? '전체';
    const search = (url.searchParams.get('search') ?? '').toUpperCase();
    const onlyUrgent = url.searchParams.get('urgent') === '1';
    const onlyMoved = url.searchParams.get('moved') === '1';
    const sort = url.searchParams.get('sort') ?? 'rank';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 1000);

    const { rows, source, csvDate } = await loadSkuData();
    const isAll = ch === '전체';
    const isExt = !isAll && (EXT_CHANNELS as readonly string[]).includes(ch);

    const list: ChSkuRow[] = [];
    let sumDaily = 0, sumDamt = 0, sumInv = 0, sumIamt = 0, sumExt = 0, sumMv = 0, sumNi = 0, sumEff = 0;

    for (const r of rows) {
      const code10 = r.단품코드.slice(0, 10);
      const code = r.단품코드;
      const codeBok = code.length > 7 ? code[7] : '?';
      const codeItem = code.length > 3 ? code.slice(2, 4) : '?';
      const price = r.정상가;

      const inv = isAll
        ? CHANNELS.reduce((s, c) => s + (r.inv[c] ?? 0), 0)
        : (r.inv[ch] ?? 0);
      const ord = isAll
        ? CHANNELS.reduce((s, c) => s + (r.ord[c] ?? 0), 0)
        : (r.ord[ch] ?? 0);
      const inv_amt = isAll
        ? CHANNELS.reduce((s, c) => s + (r.inv_amt[c] || (r.inv[c] ?? 0) * price), 0)
        : (r.inv_amt[ch] || inv * price);
      const ext = isAll
        ? EXT_CHANNELS.reduce((s, c) => s + (r.wh[c] ?? 0), 0)
        : (isExt ? (r.wh[ch] ?? 0) : 0);
      const move = 0;  // Phase 3.3 재배치 엔진 이식 후 실 값
      const effect = 0;

      const woc = ord > 0 ? inv / ord : null;
      const daily = ord > 0 ? ord / 7 : 0;
      const sojin = daily > 0 ? Math.round(inv / daily) : null;
      const ni = inv + (isAll ? 0 : move);
      const woc2 = ord > 0 ? ni / ord : null;
      const stat = status(woc);

      if (onlyMoved && move === 0) continue;
      if (onlyUrgent && !(woc !== null && woc < 2)) continue;
      if (bok !== '전체' && codeBok !== bok) continue;
      if (search && !code.toUpperCase().startsWith(search)) continue;
      if (inv === 0 && ord === 0) continue;

      list.push({
        code10, code, name: r.단품명, price,
        bok: codeBok, item: codeItem,
        cum_rate: r.누판율, wk_rate: r.주판율,
        daily: Number(daily.toFixed(1)), daily_amt: Number((daily * price / 10000).toFixed(1)),
        inv, inv_amt: Math.round(inv_amt / 10000),
        ext,
        woc: woc !== null ? Number(woc.toFixed(1)) : null,
        sojin,
        move, ni, woc2: woc2 !== null ? Number(woc2.toFixed(1)) : null,
        effect: Math.round(effect / 10000),
        status: stat,
        rank_online: r.온라인랭킹 || 9999,
      });

      sumDaily += daily;
      sumDamt += daily * price / 10000;
      sumInv += inv;
      sumIamt += inv_amt / 10000;
      sumExt += ext;
      sumMv += move;
      sumNi += ni;
      sumEff += effect / 10000;
    }

    // 정렬
    if (sort === 'rank') list.sort((a, b) => a.rank_online - b.rank_online);
    else if (sort === 'effect') list.sort((a, b) => b.effect - a.effect);
    else if (sort === 'move') list.sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
    else if (sort === 'code') list.sort((a, b) => a.code.localeCompare(b.code));

    const total = list.length;
    const top = list.slice(0, limit);

    return NextResponse.json({
      status: 'ok', source, csvDate, channel: ch, total, count: top.length,
      sum: {
        daily: Number(sumDaily.toFixed(1)),
        daily_amt: Number(sumDamt.toFixed(1)),
        inv: sumInv,
        inv_amt: Math.round(sumIamt),
        ext: sumExt,
        move: sumMv,
        ni: sumNi,
        effect: Math.round(sumEff),
      },
      data: top,
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
