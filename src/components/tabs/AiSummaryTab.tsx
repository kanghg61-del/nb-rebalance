'use client';
import { useEffect, useRef, useState } from 'react';
import { CLR, CHANNELS } from '@/lib/theme';

const HERO_STYLE: React.CSSProperties = { textAlign: 'center', padding: 0 };
const ROBOT_STYLE: React.CSSProperties = { fontSize: 60, lineHeight: 1, filter: 'drop-shadow(0 3px 16px rgba(196,168,255,.35))', animation: 'aicabob 2.4s ease-in-out infinite' };
const BRIEF_STYLE: React.CSSProperties = { background: 'linear-gradient(135deg, #1a0d2e 0%, #0a2138 100%)', border: '1px solid #5a3fb8', borderRadius: 12, padding: '14px 20px', boxShadow: '0 0 24px rgba(90,63,184,.18)' };

export function AiSummaryTab() {
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [llmErr, setLlmErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/briefing', { cache: 'no-store' });
      setBrief(await res.json());
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs]);

  async function send() {
    if (!input.trim() || sending) return;
    const q = input.trim(); setMsgs(p => [...p, { role: 'user', text: q }]); setInput(''); setSending(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      setMsgs(p => [...p, { role: 'ai', text: j.answer || j.message || '(응답 없음)' }]);
      if (j.status !== 'ok') setLlmErr(j.message || 'unknown'); else setLlmErr(null);
    } catch (e) { setMsgs(p => [...p, { role: 'ai', text: `❌ ${e}` }]); }
    finally { setSending(false); }
  }

  const m = brief?.metrics;
  const top10 = brief?.top_10 ?? [];

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes aicabob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>🤖 AI 일일 요약</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '로딩...' : '🔄 새로고침'}</button>
      </div>

      {/* 좌우 분할 hero(1) : brief(5) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 5fr', gap: 14, marginBottom: 20, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 12, padding: '14px 20px' }}>
          <div style={HERO_STYLE}>
            <div style={ROBOT_STYLE}>🤖</div>
            <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '4px 0 0 0', lineHeight: 1.2 }}>AI 일일 요약 보고</h2>
            <p style={{ color: '#9fb3d9', fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>뉴발란스 온라인 재고 AICA<br/>자연어로 자유롭게 질문</p>
          </div>
        </div>
        <div style={BRIEF_STYLE}>
          <div style={{ color: '#c4a8ff', fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }}>📡 AICA · DAILY BRIEFING</div>
          <div
            style={{ color: '#fff', fontSize: 16, lineHeight: 1.75, marginTop: 8 }}
            dangerouslySetInnerHTML={{ __html: brief?.briefing_html ?? '데이터 로딩 중...' }}
          />
        </div>
      </div>

      {/* 채팅 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text, marginBottom: 8 }}>💬 자연어 질의</div>
      <div ref={boxRef} style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 8, padding: 14, minHeight: 200, maxHeight: 320, overflowY: 'auto', marginBottom: 10 }}>
        {msgs.length === 0 && <p style={{ color: CLR.muted, fontSize: 12, lineHeight: 1.6 }}>예시 질문:<br/>· "회전 TOP 5 스타일과 기대매출은?"<br/>· "지그재그 결품 상위 스타일 알려줘"<br/>· "이랜드몰 재배치 이후 재고 어떻게 돼?"</p>}
        {msgs.map((mm, i) => (
          <div key={i} style={{ margin: '8px 0', textAlign: mm.role === 'user' ? 'right' : 'left' }}>
            <div style={{ display: 'inline-block', padding: mm.role === 'user' ? '10px 16px' : '12px 18px', background: mm.role === 'user' ? '#3a4a6b' : '#1f2937', color: mm.role === 'user' ? '#fff' : '#e5e7eb', borderRadius: mm.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 13, maxWidth: '85%', whiteSpace: 'pre-wrap', textAlign: 'left', lineHeight: 1.7 }}>
              {mm.role === 'ai' ? <>🤖 <b style={{ color: '#c4a8ff' }}>AICA</b><br/>{mm.text}</> : mm.text}
            </div>
          </div>
        ))}
        {sending && <div style={{ color: CLR.muted, fontSize: 12 }}>AI 응답 중...</div>}
        {llmErr && <div style={{ padding: 6, marginTop: 8, background: 'rgba(255,192,0,0.1)', color: CLR.yel_fg, fontSize: 11, borderRadius: 3 }}>⚠️ Gemini Flash 응답 실패 → 규칙 기반 fallback 사용 중. 사유: <code>{llmErr}</code></div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void send(); }} placeholder="자유롭게 물어보세요 (예: 회전 TOP 5 스타일과 기대매출은?)" style={{ flex: 1, padding: '10px 14px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13 }} />
        <button onClick={send} disabled={sending || !input.trim()} style={{ padding: '10px 20px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>보내기</button>
      </div>

      {/* TOP 10 스타일 가로 표 (이미지 · 스타일코드 · 판매량 · 매출) */}
      <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text, marginBottom: 8 }}>🏆 최근 일자({brief?.csvDate ?? ''}) TOP 10 스타일</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}>
          <thead>
            <tr>{Array.from({ length: 10 }).map((_, i) => (
              <th key={i} style={{ background: '#0d2540', color: '#9ab', fontSize: 13, fontWeight: 700, padding: 6, border: '1px solid #2e3b50', textAlign: 'center' }}>{i + 1}</th>
            ))}</tr>
          </thead>
          <tbody>
            {/* 이미지 행 */}
            <tr>{top10.concat(Array(10 - top10.length).fill(null)).map((t: any, i: number) => (
              <td key={'img' + i} style={{ background: '#0f1d3a', padding: 4, border: '1px solid #2e3b50', textAlign: 'center' }}>
                {t ? <StyleImg style={t.style} /> : <div style={{ width: 80, height: 100, margin: '0 auto', background: '#1c2836', borderRadius: 4 }} />}
              </td>
            ))}</tr>
            {/* 스타일코드 + 이름 */}
            <tr>{top10.concat(Array(10 - top10.length).fill(null)).map((t: any, i: number) => (
              <td key={'st' + i} style={{ background: '#0f1d3a', color: '#fff', fontSize: 12, padding: 6, border: '1px solid #2e3b50', textAlign: 'center' }}>
                {t ? (<><b style={{ color: '#c4a8ff' }}>{t.style}</b><br/><span style={{ color: '#9ab', fontSize: 10 }}>{(t.name || '').slice(0, 14)}</span></>) : '-'}
              </td>
            ))}</tr>
            {/* 판매량 */}
            <tr>{top10.concat(Array(10 - top10.length).fill(null)).map((t: any, i: number) => (
              <td key={'q' + i} style={{ background: '#0f1d3a', color: '#fff', fontSize: 12, padding: 6, border: '1px solid #2e3b50', textAlign: 'center' }}>
                {t ? (<><b style={{ color: '#ffb84d' }}>{t.daily_qty.toLocaleString()}</b><br/><span style={{ color: '#9ab', fontSize: 10 }}>장/일</span></>) : '-'}
              </td>
            ))}</tr>
            {/* 매출 */}
            <tr>{top10.concat(Array(10 - top10.length).fill(null)).map((t: any, i: number) => (
              <td key={'a' + i} style={{ background: '#0f1d3a', color: '#fff', fontSize: 12, padding: 6, border: '1px solid #2e3b50', textAlign: 'center' }}>
                {t ? (<><b style={{ color: '#7cd99c' }}>{t.daily_amt_man.toLocaleString()}</b><br/><span style={{ color: '#9ab', fontSize: 10 }}>만원/일</span></>) : '-'}
              </td>
            ))}</tr>
          </tbody>
        </table>
      </div>

      {/* 채널별 매출 */}
      {m && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>채널별 일평균 매출</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {CHANNELS.map(c => (
              <div key={c} style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: CLR.muted }}>{c}</div>
                <div style={{ fontSize: 18, color: CLR.grn_fg, fontWeight: 800, marginTop: 3 }}>{Math.round((m.ch_daily_amt?.[c] ?? 0) / 10000).toLocaleString()}만</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StyleImg({ style }: { style: string }) {
  // 스파오 이미지: 사내 CDN 확정 전까지 스타일코드 기반 gradient placeholder
  // (스트림릿 _spao_img_url 매칭 · 색상 유일화)
  const seed = style.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const h1 = seed % 360;
  const h2 = (h1 + 40) % 360;
  const gradient = `linear-gradient(135deg, hsl(${h1}, 55%, 45%) 0%, hsl(${h2}, 55%, 30%) 100%)`;
  const style10 = style.slice(-4);
  return (
    <div style={{ width: 80, height: 100, borderRadius: 4, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.5)', margin: '0 auto' }}>
      {style10}
    </div>
  );
}
