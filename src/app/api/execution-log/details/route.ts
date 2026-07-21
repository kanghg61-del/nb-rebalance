import { NextRequest, NextResponse } from 'next/server';
import { ghLoad } from '@/lib/gh-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const execId = url.searchParams.get('id');
    const meta = await ghLoad('execution_details.csv');
    if (!meta) return NextResponse.json({ status: 'ok', rows: [] });
    const lines = meta.content.trim().split(/\r?\n/);
    if (lines.length < 2) return NextResponse.json({ status: 'ok', rows: [] });
    const header = lines[0].split(',');
    const idxId = header.indexOf('exec_id');
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      if (execId && cells[idxId] !== String(execId)) continue;
      const obj: any = {};
      header.forEach((h, j) => obj[h] = cells[j] ?? '');
      rows.push(obj);
    }
    return NextResponse.json({ status: 'ok', rows });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
