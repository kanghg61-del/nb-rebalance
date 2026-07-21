'use client';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
      } else {
        const j = await res.json();
        setError(j.message ?? '비밀번호가 올바르지 않습니다.');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type={showPw ? 'text' : 'password'}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호 입력"
          autoFocus
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShowPw(!showPw)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 18,
            padding: 6,
          }}
          aria-label="비밀번호 보기"
        >
          👁
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 6, color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>
          ⚠️ {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !pw}
        style={{
          width: '100%',
          padding: '14px',
          background: 'var(--accent)',
          color: '#0A141F',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 700,
          marginTop: 4,
          transition: 'background 0.15s',
        }}
      >
        {loading ? '확인 중...' : '🔓 입장'}
      </button>
    </form>
  );
}
