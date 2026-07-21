'use client';
import { useRef, useState } from 'react';

export function DataSourceCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  async function handleFile(f: File) {
    // 파일명에서 날짜 추출 (data_spao_YYMMDD.csv 형식 예상)
    const m = f.name.match(/(\d{6})/);
    const date = m ? m[1] : new Date().toISOString().slice(2, 10).replace(/-/g, '').slice(0, 6);
    setUploading(true); setStatus('');
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('date', date);
      const res = await fetch('/api/data/csv-upload', { method: 'POST', body: form });
      const j = await res.json();
      if (j.status === 'ok') setStatus(`✓ 업로드 완료 · ${j.path} (${j.size_kb}KB)`);
      else setStatus(`⚠️ ${j.message}`);
    } catch (e) { setStatus('❌ ' + String(e)); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🌱 TEST 데이터 소스 — ③ Agent와 동일 (신규 없음)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            <span>경로 <code style={{ color: 'var(--accent)', background: 'var(--bg-panel)', padding: '2px 6px', borderRadius: 4 }}>github.com/kanghg61-del/nb-rebalance/data/test/data_spao_*.csv.gz</code></span>
          </div>
          <div style={{ marginTop: 8, color: 'var(--accent)', fontSize: 13 }}>✨ 전체 상품 재배치 대상 — 신상+이월 (7/13 필터 해제)</div>
        </div>
        <button style={{ background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>🗑 TEST 캐시 비우기</button>
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>신규 CSV 업로드 (github data/test/에 저장 · 업로드 즉시 반영 · GITHUB_TOKEN 필요)</div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-panel)', border: '1px dashed var(--border-strong)', borderRadius: 6, cursor: uploading ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
          <span>{uploading ? '⬆️ 업로드 중...' : '⬆️ Upload'}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>200MB per file · CSV or CSV.GZ</span>
          <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".csv,.gz" disabled={uploading}
                 onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        </label>
        {status && (
          <div style={{ marginTop: 8, padding: 8, background: status.startsWith('✓') ? 'rgba(74,227,181,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${status.startsWith('✓') ? 'var(--accent)' : 'var(--warning)'}`, borderRadius: 4, color: status.startsWith('✓') ? 'var(--accent)' : 'var(--warning)', fontSize: 12 }}>
            {status}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>마지막 데이터 갱신: 자동 감지 (GitHub raw · 5분 캐시)</div>
        <button onClick={() => window.location.reload()} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>🔄 새로고침</button>
      </div>
    </div>
  );
}
