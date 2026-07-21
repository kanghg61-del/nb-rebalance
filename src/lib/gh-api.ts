/**
 * GitHub Contents API - write/read
 * GITHUB_TOKEN 환경변수 필요 (repo:contents 권한)
 * Streamlit REBA와 동일 로직 (app_v20.py _gh_load / _gh_save 이식)
 */

const GH_REPO = 'kanghg61-del/nb-rebalance';
const GH_BRANCH = 'main';

export function getGhToken(): string | null {
  return process.env.GITHUB_TOKEN ?? null;
}

export type GhFileMeta = { sha: string; content: string };

export async function ghLoad(path: string): Promise<GhFileMeta | null> {
  const token = getGhToken();
  if (!token) return null;
  const url = `https://api.github.com/repos/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GH read ${path} → HTTP ${res.status}`);
  const meta = await res.json();
  const content = Buffer.from(meta.content, 'base64').toString('utf-8');
  return { sha: meta.sha, content };
}

export async function ghSave(
  path: string,
  content: string,
  commitMsg?: string,
): Promise<{ ok: boolean; sha?: string; message?: string }> {
  const token = getGhToken();
  if (!token) return { ok: false, message: 'GITHUB_TOKEN 미설정 · Secrets 등록 필요' };
  const existing = await ghLoad(path).catch(() => null);
  const body: Record<string, unknown> = {
    message: commitMsg ?? `update ${path} ${new Date().toISOString()}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: GH_BRANCH,
  };
  if (existing?.sha) body.sha = existing.sha;

  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.message ?? msg; } catch {}
    return { ok: false, message: msg };
  }
  const j = await res.json();
  return { ok: true, sha: j?.content?.sha };
}
