import { NextRequest, NextResponse } from 'next/server';
import { ghSave, ghLoad, getGhToken } from '@/lib/gh-api';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import { runScenario, SCENARIOS, type ScenarioKey } from '@/lib/rebalance-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });

    const { scenario = '🛡️ 기본', memo = '', overrides = {} } = await req.json().catch(() => ({}));
    const preset = SCENARIOS[scenario as ScenarioKey] ?? SCENARIOS['🛡️ 기본'];
    const { rows } = await loadSkuData();
    const results = runScenario(rows, preset, CHANNELS);

    // 매트릭스 편집 override 반영 (client에서 셀 편집한 값)
    for (const r of results) {
      const ov = overrides[r.code];
      if (ov) {
        for (const [ch, v] of Object.entries(ov)) {
          if (typeof v === 'number') r.moves[ch] = v;
        }
      }
    }

    // 이동 발생 SKU만 승인 대상
    const moved = results.filter(r => Object.values(r.moves).some(v => v > 0));
    let total_move_qty = 0;
    let expected_effect = 0;
    for (const r of moved) {
      total_move_qty += Object.values(r.moves).filter(v => v > 0).reduce((s, v) => s + v, 0);
      expected_effect += r.revenue;
    }

    // 1) execution_log.csv 로드 + 새 id 계산
    const logMeta = await ghLoad('execution_log.csv');
    const logHeader = 'id,실행일시,시나리오,단품수,이동량_장,기대효과_만원,실제효과_만원,추가판매_장,실측일,상태,메모';
    let logLines = logMeta ? logMeta.content.trim().split(/\r?\n/) : [logHeader];
    if (logLines[0] !== logHeader && !logLines[0].startsWith('id,')) logLines = [logHeader];
    const ids = logLines.slice(1).map(l => Number(l.split(',')[0])).filter(n => !isNaN(n));
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const now = new Date();
    const ymd = now.toISOString().slice(0, 10);
    const hm = now.toTimeString().slice(0, 5);
    const executedAt = `${ymd} ${hm}`;

    const newRow = [
      newId, executedAt, scenario,
      moved.length, total_move_qty,
      Math.round(expected_effect / 10000),
      '', '', '', '실측 대기',
      memo || 'Next.js REBA 승인',
    ].join(',');
    logLines.push(newRow);
    const newLog = logLines.join('\n') + '\n';

    // 2) execution_details.csv (기존 append)
    const detHeader = 'exec_id,단품코드,채널,전일재고_장,이동IN_장,정상가,실제판매_장,추가판매_장';
    const detMeta = await ghLoad('execution_details.csv');
    let detLines = detMeta ? detMeta.content.trim().split(/\r?\n/) : [detHeader];
    if (detLines[0] !== detHeader && !detLines[0].startsWith('exec_id,')) detLines = [detHeader];

    for (const r of moved) {
      for (const [ch, mv] of Object.entries(r.moves)) {
        if (mv <= 0) continue;
        detLines.push([newId, r.code, ch, r.data.inv[ch] ?? 0, mv, r.data.정상가, 0, 0].join(','));
      }
    }
    const newDet = detLines.join('\n') + '\n';

    // 3) push
    const r1 = await ghSave('execution_log.csv', newLog, `재배치 승인 · id=${newId} · ${scenario}`);
    if (!r1.ok) return NextResponse.json({ status: 'error', message: 'log save fail: ' + r1.message }, { status: 500 });
    const r2 = await ghSave('execution_details.csv', newDet, `재배치 승인 상세 · id=${newId} · ${moved.length}건`);
    if (!r2.ok) return NextResponse.json({ status: 'error', message: 'details save fail: ' + r2.message }, { status: 500 });

    return NextResponse.json({
      status: 'ok', id: newId,
      sku_count: moved.length,
      move_qty: total_move_qty,
      expected_amt: Math.round(expected_effect / 10000),
    });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
