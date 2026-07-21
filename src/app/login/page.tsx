import { LoginForm } from '@/components/LoginForm';
import { env } from '@/lib/env';

export default function LoginPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          background: 'var(--bg-card)',
          border: '1px solid var(--accent)',
          borderRadius: 12,
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        <div style={{ color: 'var(--accent)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          🔒 {env.appName}
        </div>
        <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>
          운영 대시보드 · 비밀번호를 입력하세요
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 560 }}>
        <LoginForm />
      </div>

      <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 12 }}>
        © 2026 Fashion BG · CAIO실 AX 혁신팀
      </p>
    </main>
  );
}
