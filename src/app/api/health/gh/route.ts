import { NextResponse } from 'next/server';
import { getGhToken } from '@/lib/gh-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasToken = !!getGhToken();
  const hasKey = !!process.env.GEMINI_API_KEY;
  let ghUser: string | null = null;
  let ghError: string | null = null;
  if (hasToken) {
    try {
      const r = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${getGhToken()}`, 'User-Agent': 'reba-next' },
      });
      if (r.ok) { const j: any = await r.json(); ghUser = j.login ?? 'unknown'; }
      else ghError = `GH API ${r.status}`;
    } catch (e) { ghError = String(e); }
  }
  return NextResponse.json({
    status: 'ok',
    env: { GITHUB_TOKEN: hasToken ? '✓' : '✗ (승인 저장 · 실측 산출 · CSV 업로드 비활성)', GEMINI_API_KEY: hasKey ? '✓' : '✗ (AI 채팅 fallback 모드)' },
    github: { user: ghUser, error: ghError },
    ts: new Date().toISOString(),
  });
}
