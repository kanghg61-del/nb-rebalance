import { NextRequest, NextResponse } from 'next/server';
import { ghSave, getGhToken } from '@/lib/gh-api';
import { gzipSync } from 'node:zlib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정 · Secrets 등록 후 활성' }, { status: 202 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const date = String(form.get('date') ?? '');
    if (!file || !date) return NextResponse.json({ status: 'error', message: 'file, date 필수' }, { status: 400 });

    const content = await file.text();
    // 자동 gzip 압축 (Streamlit CSV 포맷 동일)
    const gz = gzipSync(Buffer.from(content, 'utf-8'));
    const b64Content = gz.toString('base64');
    const path = `data/test/data_spao_${date}.csv.gz`;

    // ghSave는 utf-8만 지원 → base64 직접 사용 필요. 여기서는 fetch 직접 호출
    const token = getGhToken();
    const url = `https://api.github.com/repos/kanghg61-del/nb-rebalance/contents/${path}`;
    const existing = await fetch(url + '?ref=main', { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } }).catch(() => null);
    let sha = undefined;
    if (existing && existing.ok) { const m = await existing.json(); sha = m.sha; }

    const body: Record<string, unknown> = {
      message: `CSV 업로드 · data_spao_${date}.csv.gz (${(content.length/1024).toFixed(0)}KB)`,
      content: b64Content,
      branch: 'main',
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ status: 'error', message: `HTTP ${res.status} · ${errText.slice(0, 200)}` }, { status: 500 });
    }
    return NextResponse.json({ status: 'ok', path, size_kb: (gz.length/1024).toFixed(1) });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
