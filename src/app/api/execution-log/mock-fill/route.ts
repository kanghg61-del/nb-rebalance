import { NextResponse } from 'next/server';
import { ghLoad, ghSave, getGhToken } from '@/lib/gh-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const meta = await ghLoad('execution_log.csv');
    if (!meta) return NextResponse.json({ status: 'error', message: 'execution_log.csv 없음' }, { status: 404 });
    const lines = meta.content.trim().split(/\r?\n/);
    if (lines.length < 2) return NextResponse.json({ status: 'ok', filled: 0 });
    const header = lines[0].split(',');
    const idxExp = header.indexOf('기대효과_만원'), idxAct = header.indexOf('실제효과_만원');
    const idxAdd = header.indexOf('추가판매_장'), idxDate = header.indexOf('실측일'), idxStatus = header.indexOf('상태');
    let filled = 0;
    const today = new Date().toISOString().slice(0, 10);
    const newLines = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      if (cells[idxStatus] && String(cells[idxStatus]).includes('완료')) { newLines.push(lines[i]); continue; }
      const exp = Number(cells[idxExp] ?? 0);
      if (exp > 0 && idxAct >= 0) {
        const act = Math.round(exp * (0.5 + Math.random() * 0.4));
        cells[idxAct] = String(act);
        cells[idxAdd] = String(Math.round(act * 10 / 3));
        cells[idxDate] = today;
        cells[idxStatus] = '실측 완료(mock)';
        filled++;
      }
      newLines.push(cells.join(','));
    }
    const newLog = newLines.join('\n') + '\n';
    const r = await ghSave('execution_log.csv', newLog, `실측 mock fill · ${filled}건`);
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', filled });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
