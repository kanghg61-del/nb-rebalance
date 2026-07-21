import { NextRequest, NextResponse } from 'next/server';
import { ghSave, getGhToken } from '@/lib/gh-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 채널 IN-OUT 저장 (영구 · 누적 · GitHub commit)
 * 클라이언트에서 { data: ExclRow[] } 또는 [ExclRow, ...] 둘 다 수용
 * 저장 스키마 (스트림릿 embed 형태 매칭): { 채널, 방향(in/out), 스타일, 시작일, 종료일, 메모 }
 */
export async function POST(req: NextRequest) {
  try {
    if (!getGhToken()) return NextResponse.json({ status: 'fallback', message: 'GITHUB_TOKEN 미설정 · Secrets 등록 시 자동 활성' }, { status: 202 });
    const body = await req.json();
    const rows: any[] = Array.isArray(body) ? body : (Array.isArray(body?.data) ? body.data : []);
    if (rows.length === 0) return NextResponse.json({ status: 'error', message: 'data 배열 필요' }, { status: 400 });

    // Streamlit embed 스키마 (한글 키) 로 변환 · 저장
    const normalized = rows.map((r: any) => ({
      '채널': r['채널'] ?? r.channel ?? '',
      '방향': (r['방향'] ?? r.direction ?? '').toString().toLowerCase(),
      '스타일': (r['스타일'] ?? r.style ?? '').toString().toUpperCase(),
      '시작일': r['시작일'] ?? r.from ?? null,
      '종료일': r['종료일'] ?? r.to ?? null,
      '메모': r['메모'] ?? r.note ?? '',
    })).filter(r => r['채널'] && r['스타일'] && (r['방향'] === 'in' || r['방향'] === 'out'));

    // JSON 형태로 저장 (기존 data/ch_excl.json 위치)
    const content = JSON.stringify(normalized, null, 2);
    const result = await ghSave('data/ch_excl.json', content, `채널 IN-OUT 규칙 갱신 · ${normalized.length}건 (Next.js REBA)`);
    if (!result.ok) return NextResponse.json({ status: 'error', message: result.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', sha: result.sha, count: normalized.length, saved_to: 'data/ch_excl.json (GitHub · 영구 저장 · 웹 재시작 후에도 유지)' });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
