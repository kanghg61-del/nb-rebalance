'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { CLR } from '@/lib/theme';
import { downloadCsv } from '@/lib/downloads';

type Row = Record<string, string>;

export function ExecutionLogTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [mockLoading, setMockLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [saving, setSaving] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/gh/execution-log', { cache: 'no-store' });
      const j = await res.json();
      if (j.status === 'ok' || j.status === 'fallback') {
        setRows(j.data ?? []); setSource(j.source ?? ''); setEdits({});
      } else setError(j.message ?? '조회 실패');
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function mockFill() {
    if (!confirm('mock 실측 자동 산출 (실측 대기 이력에 50~90% 실제효과 적용)?')) return;
    setMockLoading(true);
    try {
      const res = await fetch('/api/execution-log/mock-fill', { method: 'POST' });
      const j = await res.json();
      alert(j.status === 'ok' ? `✅ ${j.filled}건 실측 채움` : `⚠️ ${j.message}`);
      await load();
    } catch (e) { alert('❌ ' + e); }
    finally { setMockLoading(false); }
  }
  async function loadDetails(id: string) {
    setDetailId(id);
    try {
      const res = await fetch(`/api/execution-log/details?id=${id}`, { cache: 'no-store' });
      const j = await res.json();
      setDetails(j.rows ?? []);
    } catch {}
  }
  function editField(id: string, key: string, value: string) {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: value } }));
  }
  async function saveEdits() {
    const changed = Object.entries(edits).filter(([, v]) => Object.keys(v).length > 0).map(([id, v]) => ({ id, ...v }));
    if (changed.length === 0) { alert('변경사항 없음'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/execution-log/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: changed }),
      });
      const j = await res.json();
      alert(j.status === 'ok' ? `✅ ${j.updated}건 저장 완료` : `⚠️ ${j.message}`);
      if (j.status === 'ok') await load();
    } catch (e) { alert('❌ ' + e); }
    finally { setSaving(false); }
  }
  async function clearLog() {
    if (!clearConfirm) { alert('먼저 "초기화 확인" 체크박스를 켜세요'); return; }
    if (!confirm('정말 전체 이력을 초기화 하시겠습니까? (되돌릴 수 없음 · 백업 CSV 필수)')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/execution-log/clear', { method: 'POST' });
      const j = await res.json();
      alert(j.status === 'ok' ? '✅ 이력 초기화 완료' : `⚠️ ${j.message}`);
      setClearConfirm(false);
      await load();
    } catch (e) { alert('❌ ' + e); }
    finally { setClearing(false); }
  }
  async function applySales(f: File) {
    if (!confirm(`${f.name} 매출 자료로 실측 자동 반영?`)) return;
    try {
      const csv = await f.text();
      const res = await fetch('/api/execution-log/apply-sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
      const j = await res.json();
      alert(j.status === 'ok' ? `✅ ${j.updated}개 실행 실측 완료 (매칭 SKU ${j.matched}건)` : `⚠️ ${j.message}`);
      if (j.status === 'ok') await load();
    } catch (e) { alert('❌ ' + e); }
  }
  async function restoreBackup(f: File) {
    if (!confirm(`${f.name}(${(f.size/1024).toFixed(1)}KB)을 이력에 덮어씁니까? (기존 이력 완전 대체)`)) return;
    setRestoring(true);
    try {
      const csv = await f.text();
      const res = await fetch('/api/execution-log/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const j = await res.json();
      alert(j.status === 'ok' ? `✅ ${j.rows}행 복원 완료` : `⚠️ ${j.message}`);
      if (restoreRef.current) restoreRef.current.value = '';
      await load();
    } catch (e) { alert('❌ ' + e); }
    finally { setRestoring(false); }
  }

  const n = rows.length;
  const cumQty = rows.reduce((s, r) => s + Number(r['이동량_장'] ?? 0), 0);
  const cumExp = rows.reduce((s, r) => s + Number(r['기대효과_만원'] ?? 0), 0);
  const measured = rows.filter(r => String(r['실제효과_만원'] ?? '').trim());
  const cumAct = rows.reduce((s, r) => s + Number(r['실제효과_만원'] ?? 0), 0);
  const cumExpM = measured.reduce((s, r) => s + Number(r['기대효과_만원'] ?? 0), 0);
  const rate = cumExpM > 0 ? (cumAct / cumExpM * 100) : null;
  const cumExtra = rows.reduce((s, r) => s + Number(r['추가판매_장'] ?? 0), 0);

  const chartData = useMemo(() => {
    let ce = 0, ca = 0;
    return rows.map(r => {
      ce += Number(r['기대효과_만원'] ?? 0); ca += Number(r['실제효과_만원'] ?? 0);
      return { date: (r['실행일시'] ?? '').slice(0, 10), exp: ce / 10000, act: ca / 10000 };
    });
  }, [rows]);

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>📈 실행 효과 누적 관리</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '로딩...' : '🔄 새로고침'}</button>
      </div>
      <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 8 }}>재배치 <b>승인 실행 시 자동 기록</b> → 기대효과 대비 <b>실제 효과(실측)</b> 누적 추적.</p>
      <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.grn_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>📍 <b>추적 범위 — 온라인 3채널 내 회전(이동)만</b> · 외부창고·옴니재고 제외.</div>
      <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.yel_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>📐 <b>실제효과 산식 (보수 집계)</b> — 추가판매 = min(이동IN, max(0, 실제판매 − 전일재고)) → 실제효과 = Σ 추가판매 × 정상가.</div>

      {error && <div style={{ padding: 12, background: 'rgba(255,90,95,0.1)', border: `1px solid ${CLR.red_fg}`, borderRadius: 4, marginBottom: 12, color: CLR.red_fg, fontSize: 12 }}>⚠️ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <Metric label="누적 실행" value={`${n.toLocaleString()}회`} sub={`실측 완료 ${measured.length.toLocaleString()}건`} />
        <Metric label="누적 이동량" value={`${cumQty.toLocaleString()}장`} />
        <Metric label="누적 기대효과" value={`${(cumExp/10000).toFixed(2)}억`} />
        <Metric label="누적 실제효과" value={`${(cumAct/10000).toFixed(2)}억`} sub={`추가판매 ${cumExtra.toLocaleString()}장`} />
        <Metric label="달성률 (실제/기대)" value={rate !== null ? `${rate.toFixed(1)}%` : '-'} sub="실측분 기준" />
      </div>

      {chartData.length > 0 && (
        <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: CLR.text, fontWeight: 700, marginBottom: 8 }}>📊 누적 기대 vs 실제 효과 (억)</div>
          <LineChart data={chartData} />
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
            <span style={{ color: '#8AB4F8' }}>◆ 누적 기대효과</span>
            <span style={{ color: CLR.grn_fg }}>◆ 누적 실제효과</span>
          </div>
        </div>
      )}

      {/* 부가 기능 버튼 5종 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <button onClick={saveEdits} disabled={saving || Object.keys(edits).length === 0} style={{ padding: '9px 12px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: Object.keys(edits).length === 0 ? 0.5 : 1 }}>💾 {saving ? '저장 중...' : `실측 입력 저장 (${Object.keys(edits).length}건)`}</button>
        <button onClick={mockFill} disabled={mockLoading} style={{ padding: '9px 12px', background: CLR.yel_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🤖 {mockLoading ? '산출 중...' : '실측 자동 산출 (mock)'}</button>
        <button onClick={() => downloadCsv(rows, ['id','실행일시','시나리오','단품수','이동량_장','기대효과_만원','실제효과_만원','추가판매_장','실측일','상태','메모'], 'execution_log')} style={{ padding: '9px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ 이력 백업 (CSV)</button>
        <label style={{ padding: '9px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
          {restoring ? '복원 중...' : '📂 백업 복원'}
          <input ref={restoreRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void restoreBackup(f); }} />
        </label>
        <button onClick={clearLog} disabled={clearing || !clearConfirm} style={{ padding: '9px 12px', background: CLR.panel, color: clearConfirm ? CLR.red_fg : CLR.muted, border: `1px solid ${clearConfirm ? CLR.red_fg : CLR.border}`, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: clearConfirm ? 'pointer' : 'not-allowed' }}>🗑️ {clearing ? '초기화 중...' : '이력 초기화'}</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: CLR.text, fontSize: 11, cursor: 'pointer' }}>
          <input type="checkbox" checked={clearConfirm} onChange={e => setClearConfirm(e.target.checked)} /> 초기화 확인
        </label>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>실행 이력 · 실측 입력 <span style={{ fontSize: 10, color: CLR.muted, fontWeight: 400 }}>💡 실제효과·추가판매·메모 셀 직접 편집 후 저장</span></div>
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 400 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0A1826', zIndex: 1 }}>
            <tr>
              <th style={th()}>id</th><th style={th()}>실행일시</th><th style={th()}>시나리오</th>
              <th style={th('right')}>단품수</th><th style={th('right')}>이동량_장</th>
              <th style={th('right')}>기대효과_만원</th><th style={th('right')}>실제효과_만원 ✏️</th>
              <th style={th('right')}>추가판매_장 ✏️</th><th style={th()}>실측일 ✏️</th>
              <th style={th()}>상태</th><th style={th()}>메모 ✏️</th><th style={th()}></th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: CLR.sum_bg }}>
              <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>Σ</td>
              <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>— 합계 —</td>
              <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>{n}회</td>
              <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{rows.reduce((s, r) => s + Number(r['단품수'] ?? 0), 0).toLocaleString()}</td>
              <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{cumQty.toLocaleString()}</td>
              <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{cumExp.toLocaleString()}</td>
              <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{cumAct.toLocaleString()}</td>
              <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{cumExtra.toLocaleString()}</td>
              <td colSpan={2} style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>실측 {measured.length}/{n}</td>
              <td colSpan={2} style={td()}></td>
            </tr>
            {loading && <tr><td colSpan={12} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>로딩 중...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={12} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>이력 없음</td></tr>}
            {rows.map((r, i) => {
              const eid = r['id']; const patch = edits[eid] ?? {};
              const changed = Object.keys(patch).length > 0;
              return (
                <tr key={i} style={{ borderTop: `1px solid ${CLR.border}`, background: changed ? 'rgba(74,227,181,0.05)' : (detailId === eid ? 'rgba(138,180,248,0.05)' : 'transparent') }}>
                  <td style={{ ...td(), color: CLR.text }}>{eid}</td>
                  <td style={{ ...td(), color: CLR.text }}>{r['실행일시']}</td>
                  <td style={{ ...td(), color: CLR.text }}>{r['시나리오']}</td>
                  <td style={{ ...td('right'), color: CLR.text }}>{Number(r['단품수'] ?? 0).toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.text }}>{Number(r['이동량_장'] ?? 0).toLocaleString()}</td>
                  <td style={{ ...td('right'), color: '#8AB4F8' }}>{Number(r['기대효과_만원'] ?? 0).toLocaleString()}</td>
                  <td style={td('right')}><input type="number" value={patch['실제효과_만원'] ?? r['실제효과_만원'] ?? ''} onChange={e => editField(eid, '실제효과_만원', e.target.value)} style={{ width: 80, padding: '3px 6px', background: CLR.panel, border: `1px solid ${changed ? CLR.grn_fg : CLR.border}`, borderRadius: 3, color: CLR.grn_fg, fontSize: 11, textAlign: 'right', fontWeight: 700 }} /></td>
                  <td style={td('right')}><input type="number" value={patch['추가판매_장'] ?? r['추가판매_장'] ?? ''} onChange={e => editField(eid, '추가판매_장', e.target.value)} style={{ width: 70, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11, textAlign: 'right' }} /></td>
                  <td style={td()}><input type="date" value={patch['실측일'] ?? r['실측일'] ?? ''} onChange={e => editField(eid, '실측일', e.target.value)} style={{ width: 120, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11 }} /></td>
                  <td style={{ ...td(), color: r['상태']?.includes('완료') ? CLR.grn_fg : CLR.yel_fg }}>{r['상태']}</td>
                  <td style={td()}><input type="text" value={patch['메모'] ?? r['메모'] ?? ''} onChange={e => editField(eid, '메모', e.target.value)} style={{ width: 140, padding: '3px 6px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 11 }} /></td>
                  <td style={td()}><button onClick={() => loadDetails(eid)} style={{ padding: '3px 8px', background: 'transparent', color: CLR.grn_fg, border: `1px solid ${CLR.grn_fg}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>상세</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailId && details.length > 0 && (
        <div style={{ marginTop: 12, background: CLR.card, border: `1px solid ${CLR.grn_fg}`, borderRadius: 4, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: CLR.grn_fg, fontWeight: 700 }}>🔍 실행 #{detailId} 상세 내역 ({details.length}건)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => downloadCsv(details, Object.keys(details[0] ?? {}), `execution_details_${detailId}`)} style={{ padding: '4px 10px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>⬇️ CSV</button>
              <button onClick={() => setDetailId(null)} style={{ padding: '4px 10px', background: 'transparent', color: CLR.muted, border: `1px solid ${CLR.border}`, borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>닫기</button>
            </div>
          </div>
          <div style={{ overflow: 'auto', maxHeight: 300 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ background: '#0A1826' }}><tr>{Object.keys(details[0]).map(k => <th key={k} style={th('right')}>{k}</th>)}</tr></thead>
              <tbody>
                {details.slice(0, 500).map((d, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                    {Object.entries(d).map(([k, v]: any) => <td key={k} style={{ ...td('right'), color: CLR.text }}>{String(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ marginTop: 10, fontSize: 11, color: CLR.muted }}>💡 {source} · ⚠️ 이력은 GH 저장소에 영구 보관 · 백업 CSV 정기 보관 권장</p>
    </div>
  );
}

function Metric({ label, value, sub }: any) {
  return (
    <div style={{ background: CLR.card, border: '1px solid #1F3A55', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: CLR.grn_fg, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: CLR.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function LineChart({ data }: { data: { date: string; exp: number; act: number }[] }) {
  if (data.length === 0) return null;
  const W = 900, H = 240, P = { l: 50, r: 20, t: 20, b: 30 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxY = Math.max(...data.map(d => Math.max(d.exp, d.act)), 0.1);
  const x = (i: number) => P.l + (i / Math.max(1, data.length - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / maxY) * ih;
  const pathExp = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.exp)}`).join(' ');
  const pathAct = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.act)}`).join(' ');
  const yTicks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 240 }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => { const v = (maxY * i) / yTicks; const yy = y(v);
        return <g key={i}><line x1={P.l} x2={W - P.r} y1={yy} y2={yy} stroke="#1F2E42" strokeWidth={1} /><text x={P.l - 6} y={yy + 3} fontSize={10} fill={CLR.muted} textAnchor="end">{v.toFixed(1)}억</text></g>;
      })}
      {data.map((d, i) => { if (data.length > 12 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
        return <text key={i} x={x(i)} y={H - 8} fontSize={9} fill={CLR.muted} textAnchor="middle">{d.date.slice(5)}</text>;
      })}
      <path d={pathExp} stroke="#8AB4F8" strokeWidth={2} fill="none" />
      <path d={pathAct} stroke={CLR.grn_fg} strokeWidth={2} fill="none" />
      {data.map((d, i) => <g key={'p'+i}><circle cx={x(i)} cy={y(d.exp)} r={3} fill="#8AB4F8" /><circle cx={x(i)} cy={y(d.act)} r={3} fill={CLR.grn_fg} /></g>)}
    </svg>
  );
}
function th(align: any = 'left'): any { return { padding: '10px 8px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `2px solid ${CLR.border}`, background: '#0A1826' }; }
function td(align: any = 'left'): any { return { padding: '5px 6px', textAlign: align, fontSize: 11, whiteSpace: 'nowrap' }; }
