import { NextRequest, NextResponse } from 'next/server';
import { ghSave, ghLoad, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const { rows } = await req.json();
    if (!Array.isArray(rows)) return NextResponse.json({ status: 'error', message: 'rows 배열 필요' }, { status: 400 });
    const meta = await ghLoad('execution_log.csv');
    if (!meta) return NextResponse.json({ status: 'error', message: 'execution_log.csv 없음' }, { status: 404 });
    const lines = meta.content.trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const idxId = header.indexOf('id');
    const editable = ['실제효과_만원', '추가판매_장', '실측일', '상태', '메모'];
    const idxMap: Record<string, number> = {};
    editable.forEach(k => { idxMap[k] = header.indexOf(k); });
    const patchById: Record<string, any> = {};
    for (const r of rows) patchById[String(r.id)] = r;
    const newLines = [lines[0]];
    let updated = 0;
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      const patch = patchById[cells[idxId]];
      if (patch) {
        for (const k of editable) {
          if (idxMap[k] >= 0 && patch[k] !== undefined) cells[idxMap[k]] = String(patch[k]);
        }
        if (idxMap['상태'] >= 0 && patch['실제효과_만원'] && !cells[idxMap['상태']].includes('완료')) {
          cells[idxMap['상태']] = '실측 완료(수동)';
        }
        updated++;
      }
      newLines.push(cells.join(','));
    }
    const r = await ghSave('execution_log.csv', newLines.join('\n') + '\n', `실측 수동 편집 · ${updated}건`);
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', updated });
  } catch (e) { return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
