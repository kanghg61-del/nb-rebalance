import { NextRequest, NextResponse } from 'next/server';
import { ghLoad, ghSave, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';

// 매출 자료 CSV 업로드 → 실측 대기 이력에 자동 채우기
// 매출 CSV 컬럼: 단품코드, 채널(선택), 판매수량, [정상가]
export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const { csv } = await req.json();
    if (typeof csv !== 'string') return NextResponse.json({ status: 'error', message: 'CSV 필요' }, { status: 400 });
    const lines = csv.replace(/^﻿/, '').trim().split(/\r?\n/);
    if (lines.length < 2) return NextResponse.json({ status: 'error', message: '데이터 없음' }, { status: 400 });
    const header = lines[0].split(',');
    const iCode = header.findIndex(h => /단품코드|sku|code/i.test(h));
    const iQty = header.findIndex(h => /판매수량|qty|판매|수량/i.test(h));
    if (iCode < 0 || iQty < 0) return NextResponse.json({ status: 'error', message: '단품코드/판매수량 컬럼 필요' }, { status: 400 });
    const salesByCode: Record<string, number> = {};
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      const code = c[iCode]?.trim(); const q = Number(c[iQty] ?? 0);
      if (code && q > 0) salesByCode[code] = (salesByCode[code] ?? 0) + q;
    }
    // execution_details.csv 로드 - 각 exec_id의 SKU 이동IN vs sales
    const detMeta = await ghLoad('execution_details.csv');
    const logMeta = await ghLoad('execution_log.csv');
    if (!detMeta || !logMeta) return NextResponse.json({ status: 'error', message: 'log/details 없음' }, { status: 404 });
    const detLines = detMeta.content.trim().split(/\r?\n/);
    const detHeader = detLines[0].split(',');
    const idxDId = detHeader.indexOf('exec_id');
    const idxDSku = detHeader.indexOf('단품코드');
    const idxDIn = detHeader.indexOf('이동IN_장');
    const idxDPrice = detHeader.indexOf('정상가');
    const idxDPre = detHeader.indexOf('전일재고_장');
    const acc: Record<string, { qty: number; amt: number; count: number }> = {};
    for (let i = 1; i < detLines.length; i++) {
      const c = detLines[i].split(',');
      const eid = c[idxDId]; const sku = c[idxDSku]; const inQ = Number(c[idxDIn] ?? 0); const price = Number(c[idxDPrice] ?? 0);
      const soldTotal = salesByCode[sku] ?? 0;
      const preInv = idxDPre >= 0 ? Number(c[idxDPre] ?? 0) : 0;
      const bonus = Math.min(inQ, Math.max(0, soldTotal - preInv));  // 전일재고 대비 초과분만
      if (bonus > 0) {
        if (!acc[eid]) acc[eid] = { qty: 0, amt: 0, count: 0 };
        acc[eid].qty += bonus; acc[eid].amt += bonus * price; acc[eid].count++;
      }
    }
    // execution_log.csv 실측 반영
    const logLines = logMeta.content.trim().split(/\r?\n/);
    const logHeader = logLines[0].split(',');
    const idxId = logHeader.indexOf('id');
    const idxAct = logHeader.indexOf('실제효과_만원');
    const idxAdd = logHeader.indexOf('추가판매_장');
    const idxDate = logHeader.indexOf('실측일');
    const idxStatus = logHeader.indexOf('상태');
    const today = new Date().toISOString().slice(0, 10);
    let updated = 0;
    const newLines = [logLines[0]];
    for (let i = 1; i < logLines.length; i++) {
      const c = logLines[i].split(',');
      const eid = c[idxId];
      if (acc[eid] && (!c[idxStatus] || !c[idxStatus].includes('완료'))) {
        c[idxAct] = String(Math.round(acc[eid].amt / 10000));
        c[idxAdd] = String(acc[eid].qty);
        c[idxDate] = today;
        c[idxStatus] = '실측 완료(매출자료)';
        updated++;
      }
      newLines.push(c.join(','));
    }
    const r = await ghSave('execution_log.csv', newLines.join('\n') + '\n', `매출 자료 반영 · ${updated}건 실측 갱신`);
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', updated, matched: Object.keys(salesByCode).length });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
