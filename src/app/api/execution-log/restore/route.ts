import { NextRequest, NextResponse } from 'next/server';
import { ghSave, getGhToken } from '@/lib/gh-api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정' }, { status: 202 });
    const { csv } = await req.json();
    if (typeof csv !== 'string' || !csv.trim()) return NextResponse.json({ status: 'error', message: 'CSV 문자열 필요' }, { status: 400 });
    const clean = csv.replace(/^﻿/, '').trim();
    const r = await ghSave('execution_log.csv', clean + '\n', `백업 복원 (${clean.split(/\r?\n/).length - 1}행)`);
    if (!r.ok) return NextResponse.json({ status: 'error', message: r.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', rows: clean.split(/\r?\n/).length - 1 });
  } catch (e) { return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
