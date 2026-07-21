'use client';

export function AppHeader({ stage, version }: { stage: string; version: string }) {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderLeft: '4px solid var(--accent)', paddingLeft: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
          온라인 재고관리 Agent — 운영 대시보드
        </h1>
        <span style={{
          display: 'inline-block',
          background: 'var(--bg-panel)',
          color: 'var(--info)',
          border: '1px solid var(--info)',
          borderRadius: 12,
          padding: '1px 10px',
          fontSize: 12,
        }}>
          {stage}
        </span>
      </div>
      <button
        onClick={logout}
        style={{ background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 14px', color: 'var(--text-secondary)', fontSize: 12 }}
      >
        로그아웃
      </button>
    </header>
  );
}
