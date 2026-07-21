'use client';

export function PlaceholderTab({ title, icon, description, notes }: {
  title: string; icon: string; description: string; notes?: string[];
}) {
  return (
    <div style={{ padding: 40, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{description}</p>
      <div style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--bg-panel)', border: '1px dashed var(--warning)', borderRadius: 8, color: 'var(--warning)', fontSize: 13 }}>
        🚧 Phase 3에서 이식 예정 (기존 Streamlit REBA 완전 이식)
      </div>
      {notes && notes.length > 0 && (
        <ul style={{ maxWidth: 520, margin: '20px auto 0', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 2, listStyle: 'none' }}>
          {notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  );
}
