'use client';
import { useEffect, useState } from 'react';
import { CLR, CHANNELS, wocStyle } from '@/lib/theme';
import { downloadCsv, downloadXlsx, downloadXlsxStyled } from '@/lib/downloads';

function gradeStyle(g: string): React.CSSProperties {
  if (g.includes('X')) return { backgroundColor: CLR.red_bg, color: CLR.red_fg, fontWeight: 700 };
  if (g.includes('M')) return { backgroundColor: CLR.yel_bg, color: CLR.yel_fg, fontWeight: 700 };
  if (g.includes('S')) return { backgroundColor: CLR.grn_bg, color: CLR.grn_fg, fontWeight: 700 };
  return {};
}

export function ReorderTab() {
  const [ch, setCh] = useState<string>('전체');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/rebalance/reorder-need-v2?channel=${encodeURIComponent(ch)}`, { cache: 'no-store' });
      setData(await res.json());
      // 우선 검토 10 스타일 기본 전체 선택
      const j = await (await fetch(`/api/rebalance/reorder-need-v2?channel=${encodeURIComponent(ch)}`, { cache: 'no-store' })).json();
      setSelected(new Set((j.top10 ?? []).map((r: any) => r.sty)));
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [ch]);

  const s = data?.summary;
  const top10 = data?.top10 ?? [];
  const rows = data?.rows ?? [];

  function toggle(sty: string) {
    const n = new Set(selected);
    if (n.has(sty)) n.delete(sty); else n.add(sty);
    setSelected(n);
  }
  function toggleAll() {
    if (selected.size === top10.length) setSelected(new Set());
    else setSelected(new Set(top10.map((r: any) => r.sty)));
  }

  async function logSend(picked: any[]) {
    const total_qty = picked.reduce((a: number, r: any) => a + r.reord, 0);
    const total_exp = picked.reduce((a: number, r: any) => a + (r.exp_man * 10000), 0);
    try {
      await fetch('/api/gh/reorder-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: ch, sku_count: picked.length, total_qty, total_exp, memo: 'REBA 리오더 요청서 발송' }),
      });
    } catch {}
  }
  async function downloadReq() {
    const picked = top10.filter((r: any) => selected.has(r.sty));
    if (!picked.length) { alert('선택된 스타일 없음'); return; }
    const sheets = {
      '리오더 요청 · 선택 스타일': { rows: picked, headers: ['grade','sty','name','inv','ord','woc','reord','exp_man','woc_after'], colorMap: { grade: 'grade', woc: 'woc', woc_after: 'woc' } },
      '결품 임박 단품 전체': { rows, headers: ['grade','code','sty_code','sty_name','inv','ord','woc','reord','exp','price'], colorMap: { grade: 'grade', woc: 'woc' } },
    };
    await downloadXlsxStyled(sheets, `리오더요청_${ch}_${new Date().toISOString().slice(0,10)}`);
    void logSend(picked);
  }

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>🚨 리오더 요청</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.yel_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '로딩...' : '🔄 새로고침'}</button>
      </div>
      <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 10 }}>결품 임박(재고주수 &lt; 1주) 단품 자동 추출. 회전(재배치)으로 못 메우는 잠재 결품을 리오더로 연결 — ARS 베스트 + AICA <b>워스트(잠재 결품)</b> 동시 관리.</p>

      <div style={{ fontSize: 13, fontWeight: 700, color: CLR.text, marginBottom: 4 }}>📍 채널 선택</div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 6 }}>스파오 6/19 미팅 합의 — 채널별로 분리 표시. "전체" 선택 시 3채널 합산 기준.</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: CLR.panel, padding: 3, borderRadius: 4, width: 'fit-content' }}>
        {['전체', ...CHANNELS].map(c => (
          <button key={c} onClick={() => setCh(c)} style={{ padding: '7px 14px', background: ch === c ? CLR.yel_fg : 'transparent', color: ch === c ? '#0A141F' : CLR.text, border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
        ))}
      </div>
      {ch !== '전체' && s && <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 10 }}>📍 <b>{ch}</b> 채널의 결품 임박 단품 ({s.count.toLocaleString()}건) — 전체 합산이 아닌 해당 채널의 재고·주판 기준</div>}

      {/* 4 KPI */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <Kpi label="결품 임박 단품" value={`${s.count.toLocaleString()}건`} sub="재고주수 < 1주" />
          <Kpi label="1주 결품 노출액" value={`${(s.tot_amt1w / 1e8).toFixed(2)}억`} sub="1주 주판 × 정상가" />
          <Kpi label="📦 리오더 권장 물량" value={`${(s.tot_exp / 1e8).toFixed(2)}억`} sub={`${s.tot_reord.toLocaleString()}장 · 1주 수요 − 현재고`} />
          <Kpi label="💰 리오더 시 기대매출" value={`${(s.tot_exp / 1e8).toFixed(2)}억`} sub="권장리오더 × 정상가" />
        </div>
      )}

      {/* 우선 검토 10 스타일 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text }}>⭐ 리오더 우선 검토 10 스타일</div>
        <button onClick={downloadReq} style={{ padding: '6px 14px', background: CLR.yel_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇️ 발주 요청서 (선택 스타일)</button>
      </div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 6 }}>단품을 스타일(10자리)로 묶어 <b>1주 주문액 큰 순</b> 정렬. 첨부 스파오 스타일코드 매핑 적용.</div>
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 340, marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#0A1826' }}>
            <tr>
              <th style={th()}><input type="checkbox" checked={selected.size > 0 && selected.size === top10.length} onChange={toggleAll} /></th>
              <th style={th()}>진단</th><th style={th()}>스타일코드</th><th style={th()}>스타일명</th>
              <th style={th('right')}>현재고</th><th style={th('right')}>주판</th><th style={th('right')}>재고주수</th>
              <th style={th('right')}>필업요청(장)</th><th style={th('right')}>필업요청금액(만원)</th>
              <th style={th('right')}>이동 후 재고주수</th><th style={th('right')}>예상 회수매출(만원)</th>
            </tr>
          </thead>
          <tbody>
            {/* Sum row */}
            {top10.length > 0 && (() => {
              const inv = top10.reduce((a: number, r: any) => a + r.inv, 0);
              const ord = top10.reduce((a: number, r: any) => a + r.ord, 0);
              const reo = top10.reduce((a: number, r: any) => a + r.reord, 0);
              const exp = top10.reduce((a: number, r: any) => a + r.exp_man, 0);
              const woc = ord > 0 ? +(inv / ord).toFixed(1) : null;
              const woca = ord > 0 ? +((inv + reo) / ord).toFixed(1) : null;
              return (
                <tr style={{ background: CLR.sum_bg }}>
                  <td style={td()}></td>
                  <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>— 합계 —</td>
                  <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>{top10.length}개</td>
                  <td style={td()}></td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{inv.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{ord.toLocaleString()}</td>
                  <td style={{ ...td('right'), ...wocStyle(woc) }}>{woc !== null ? `${woc}주` : ''}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{reo.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{exp.toLocaleString()}</td>
                  <td style={{ ...td('right'), ...wocStyle(woca) }}>{woca !== null ? `${woca}주` : ''}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{exp.toLocaleString()}</td>
                </tr>
              );
            })()}
            {top10.map((r: any, i: number) => (
              <tr key={i} style={{ borderTop: `1px solid ${CLR.border}`, background: selected.has(r.sty) ? 'rgba(255,192,0,0.05)' : 'transparent' }}>
                <td style={td()}><input type="checkbox" checked={selected.has(r.sty)} onChange={() => toggle(r.sty)} /></td>
                <td style={{ ...td(), ...gradeStyle(r.grade) }}>{r.grade}</td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.sty}</td>
                <td style={{ ...td(), color: CLR.text }}>{(r.name || '').length > 28 ? r.name.slice(0, 28) + '…' : r.name}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.inv.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.ord.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc) }}>{r.woc !== null ? `${r.woc}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.reord.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.exp_man.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc_after) }}>{r.woc_after !== null ? `${r.woc_after}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{r.exp_man.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 결품 임박 단품 전체 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>📋 결품 임박 단품 전체 ({(rows ?? []).length.toLocaleString()}건 · 상위 500 표시)</div>
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 480 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0A1826', zIndex: 1 }}>
            <tr>
              <th style={th()}>진단</th><th style={th()}>단품코드</th><th style={th()}>스타일코드</th><th style={th()}>스타일명</th>
              <th style={th('right')}>현재고</th><th style={th('right')}>주판</th><th style={th('right')}>재고주수</th>
              <th style={th('right')}>필업요청(장)</th><th style={th('right')}>예상 회수매출(만원)</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>로딩 중...</td></tr>}
            {rows.slice(0, 500).map((r: any, i: number) => (
              <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                <td style={{ ...td(), ...gradeStyle(r.grade) }}>{r.grade}</td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.code}</td>
                <td style={{ ...td(), color: CLR.muted }}>{r.sty_code}</td>
                <td style={{ ...td(), color: CLR.text }}>{(r.name || '').length > 24 ? r.name.slice(0, 24) + '…' : r.name}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.inv.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.ord.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc) }}>{r.woc !== null ? `${r.woc}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.reord.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{Math.round(r.exp / 10000).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MappingEditor />
    </div>
  );
}

// 리오더 매핑 편집기 (원오더 → 리오더 코드 매핑)
function MappingEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [nr, setNr] = useState({ 원오더코드: '', 리오더코드: '', 스타일명: '', 상태: '활성', 메모: '' });
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/gh/reorder-mapping', { cache: 'no-store' });
        const j = await res.json();
        setRows(Array.isArray(j.data) ? j.data : []);
      } finally { setLoading(false); }
    })();
  }, []);
  function edit(i: number, k: string, v: string) { const n = [...rows]; n[i][k] = v; setRows(n); setStatus('✏️ 임시 편집'); }
  function add() {
    if (!nr.원오더코드.trim() || !nr.리오더코드.trim()) { alert('원오더코드/리오더코드 입력 필요'); return; }
    setRows([...rows, { ...nr, 원오더코드: nr.원오더코드.trim().toUpperCase(), 리오더코드: nr.리오더코드.trim().toUpperCase() }]);
    setNr({ 원오더코드: '', 리오더코드: '', 스타일명: '', 상태: '활성', 메모: '' });
    setStatus('✅ 임시 추가');
  }
  function del(i: number) { const n = [...rows]; n.splice(i, 1); setRows(n); setStatus('🗑️ 임시 삭제'); }
  async function save() {
    setSaving(true); setStatus('');
    try {
      const res = await fetch('/api/gh/reorder-mapping/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const j = await res.json();
      setStatus(j.status === 'ok' ? `✅ ${j.count}건 저장 완료` : `⚠️ ${j.message}`);
    } catch (e) { setStatus('❌ ' + e); } finally { setSaving(false); }
  }
  const ip: React.CSSProperties = { padding: '6px 8px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 12 };
  return (
    <div style={{ marginTop: 20, background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text }}>🔁 리오더 매핑 편집 (원오더 → 리오더 코드)</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => downloadCsv(rows, ['원오더코드','리오더코드','스타일명','상태','메모'], 'reorder_mapping')} style={{ padding: '6px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⬇️ CSV</button>
          <button onClick={save} disabled={saving} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? '저장 중...' : '💾 GitHub 저장'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr 2fr auto', gap: 6, marginBottom: 8 }}>
        <input placeholder="원오더코드" value={nr.원오더코드} onChange={e => setNr({ ...nr, 원오더코드: e.target.value })} style={ip} />
        <input placeholder="리오더코드" value={nr.리오더코드} onChange={e => setNr({ ...nr, 리오더코드: e.target.value })} style={ip} />
        <input placeholder="스타일명" value={nr.스타일명} onChange={e => setNr({ ...nr, 스타일명: e.target.value })} style={ip} />
        <select value={nr.상태} onChange={e => setNr({ ...nr, 상태: e.target.value })} style={ip}><option>활성</option><option>비활성</option></select>
        <input placeholder="메모" value={nr.메모} onChange={e => setNr({ ...nr, 메모: e.target.value })} style={ip} />
        <button onClick={add} style={{ padding: '7px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
      </div>
      {status && <div style={{ padding: 6, marginBottom: 8, background: status.startsWith('✅') ? 'rgba(74,227,181,0.1)' : 'rgba(255,192,0,0.1)', color: status.startsWith('✅') ? CLR.grn_fg : CLR.yel_fg, fontSize: 11, borderRadius: 3 }}>{status}</div>}
      <div style={{ overflow: 'auto', maxHeight: 300 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#0A1826', position: 'sticky', top: 0 }}>
            <tr><th style={mth()}>#</th><th style={mth()}>원오더코드</th><th style={mth()}>리오더코드</th><th style={mth()}>스타일명</th><th style={mth()}>상태</th><th style={mth()}>메모</th><th style={mth()}></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: CLR.muted }}>로딩...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: CLR.muted }}>등록된 매핑 없음</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                <td style={mtd()}>{i + 1}</td>
                <td style={mtd()}><input value={r.원오더코드 ?? ''} onChange={e => edit(i, '원오더코드', e.target.value)} style={{ ...ip, width: 120 }} /></td>
                <td style={mtd()}><input value={r.리오더코드 ?? ''} onChange={e => edit(i, '리오더코드', e.target.value)} style={{ ...ip, width: 120 }} /></td>
                <td style={mtd()}><input value={r.스타일명 ?? ''} onChange={e => edit(i, '스타일명', e.target.value)} style={{ ...ip, width: 180 }} /></td>
                <td style={mtd()}><select value={r.상태 ?? '활성'} onChange={e => edit(i, '상태', e.target.value)} style={{ ...ip, width: 80 }}><option>활성</option><option>비활성</option></select></td>
                <td style={mtd()}><input value={r.메모 ?? ''} onChange={e => edit(i, '메모', e.target.value)} style={{ ...ip, width: 160 }} /></td>
                <td style={mtd()}><button onClick={() => del(i)} style={{ padding: '3px 8px', background: 'transparent', color: CLR.red_fg, border: `1px solid ${CLR.red_fg}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function mth(): any { return { padding: '8px 8px', textAlign: 'left', color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `1px solid ${CLR.border}`, background: '#0A1826' }; }
function mtd(): any { return { padding: '4px 6px', fontSize: 11, whiteSpace: 'nowrap' }; }

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ background: CLR.card, border: '1px solid #1F3A55', borderRadius: 6, padding: '12px 12px', textAlign: 'center', minHeight: 96 }}>
      <div style={{ fontSize: 11, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: CLR.yel_fg, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: CLR.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
function th(align: any = 'left'): any { return { padding: '9px 8px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `2px solid ${CLR.border}`, background: '#0A1826' }; }
function td(align: any = 'left'): any { return { padding: '6px 8px', textAlign: align, fontSize: 11, whiteSpace: 'nowrap' }; }
