'use client';
import { useEffect, useMemo, useState } from 'react';
import { CLR, CHANNELS, CH_SHORT, wocStyle } from '@/lib/theme';
import { downloadCsv, downloadXlsx, downloadXlsxStyled, matrixToRotationRows, matrixToLogisticsRows, rotationSheets, logisticsSheets } from '@/lib/downloads';

type MatrixRow = {
  code: string; name: string; price: number;
  wk_sales: number; cum_rate: number; wk_rate: number; ship_rate: number;
  inv_react: number;
  inv: Record<string, number>; ord: Record<string, number>;
  woc_before: Record<string, number | null>; moves: Record<string, number>;
  woc_after: Record<string, number | null>; inv_after: Record<string, number>;
  effect: number; total_move: number; rank_online: number;
};
type Summary = {
  total_move_qty: number; total_sku_count: number; moved_sku_count: number;
  total_units: number; total_units_amt: number;
  total_amt: number; expected_effect: number;
  by_channel: Record<string, { in_qty: number; out_qty: number; effect: number }>;
};
type Response = { status: 'ok' | 'error'; summary?: Summary; matrix?: MatrixRow[]; matrix_total?: number; csvDate?: string; source?: string; chx_use?: boolean; chx_rules_total?: number; message?: string };

function mvStyle(v: number): React.CSSProperties {
  if (v === 0) return { color: CLR.muted, textAlign: 'center' };
  if (v > 0) return { backgroundColor: CLR.grn_bg, color: CLR.grn_fg, fontWeight: 700, textAlign: 'center' };
  return { backgroundColor: CLR.red_bg, color: CLR.red_fg, fontWeight: 700, textAlign: 'center' };
}
function qtyStyle(v: number): React.CSSProperties {
  if (v > 0) return { backgroundColor: CLR.grn_bg, color: '#FFFFFF', fontWeight: 700, textAlign: 'right' };
  if (v < 0) return { backgroundColor: CLR.red_bg, color: '#FFFFFF', fontWeight: 700, textAlign: 'right' };
  return { color: '#FFFFFF', textAlign: 'right' };
}

export function RebalanceBasicTab() {
  return <ScenarioMatrix scenarioKey="🛡️ 기본" allowSlider={false} descBorderColor={CLR.grn_fg} />;
}

export function ScenarioMatrix({ scenarioKey, allowSlider, descBorderColor }: { scenarioKey: string; allowSlider: boolean; descBorderColor: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [chxUse, setChxUse] = useState<'적용' | '미적용'>('적용');
  const [onlyMoved, setOnlyMoved] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('effect');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 셀 편집 override — Map<code, Map<channel, movesValue>>
  const [moveOverride, setMoveOverride] = useState<Record<string, Record<string, number>>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState('');

  const [shortage, setShortage] = useState(1);
  const [target, setTarget] = useState(2);
  const [minMove, setMinMove] = useState(0);
  const [minRecv, setMinRecv] = useState(4);
  const [cap, setCap] = useState(30);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scenario: scenarioKey, chx_use: chxUse === '적용' ? 'on' : 'off', include_all: onlyMoved ? 'off' : 'on' });
      if (allowSlider) {
        qs.set('shortage', String(shortage));
        qs.set('target', String(target));
        qs.set('min_move', String(minMove));
        qs.set('min_recv', String(minRecv));
        qs.set('cap', String(cap / 100));
      }
      const res = await fetch(`/api/rebalance/scenario?${qs.toString()}`, { cache: 'no-store' });
      setData(await res.json());
      setSelected(new Set());
    } catch (e) { setData({ status: 'error', message: String(e) }); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [chxUse, onlyMoved]);
  // 임의 시나리오 슬라이더 debounce 자동 재계산
  useEffect(() => { if (!allowSlider) return; const t = setTimeout(() => { void load(); }, 700); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [shortage, target, minMove, minRecv, cap]);
  // 임의 시나리오 슬라이더 debounce 자동 재계산
  useEffect(() => { if (!allowSlider) return; const t = setTimeout(() => { void load(); }, 700); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [shortage, target, minMove, minRecv, cap]);

  const s = data?.summary;
  const rows = data?.matrix ?? [];

  const filtered = useMemo(() => {
    let f = [...rows];
    if (search.trim()) f = f.filter(r => r.code.toUpperCase().startsWith(search.trim().toUpperCase()));
    if (sort === 'effect') f.sort((a, b) => b.effect - a.effect);
    else if (sort === 'rank') f.sort((a, b) => a.rank_online - b.rank_online);
    else if (sort === 'move') f.sort((a, b) => b.total_move - a.total_move);
    else if (sort === 'code') f.sort((a, b) => a.code.localeCompare(b.code));
    return f;
  }, [rows, search, sort]);
  const displayRows = filtered.slice(0, 1000);

  const kpi = useMemo(() => {
    if (selected.size === 0 && s) {
      return { units: s.total_units, units_amt: s.total_units_amt, move: s.total_move_qty, amt: s.total_amt, rev: s.expected_effect, sub: `전체 기준 · ${s.moved_sku_count.toLocaleString()}건 회전` };
    }
    const sel = filtered.filter(r => selected.has(r.code));
    const units = sel.reduce((acc, r) => acc + CHANNELS.reduce((s, c) => s + (r.inv[c] ?? 0), 0), 0);
    const units_amt = sel.reduce((acc, r) => acc + CHANNELS.reduce((s, c) => s + (r.inv[c] ?? 0) * r.price, 0), 0);
    const move = sel.reduce((acc, r) => acc + r.total_move, 0);
    const amt = sel.reduce((acc, r) => acc + r.total_move * r.price, 0);
    const rev = sel.reduce((acc, r) => acc + r.effect, 0) * 10000;
    return { units, units_amt, move, amt, rev, sub: `☑ 선택 ${sel.length.toLocaleString()}건 기준` };
  }, [selected, filtered, s]);

  async function approve() {
    const selCount = selected.size > 0 ? selected.size : (s?.moved_sku_count ?? 0);
    setApproving(true); setApproveResult(null);
    try {
      const res = await fetch('/api/rebalance/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioKey, memo: `Next.js REBA 승인 (${selCount}건)`, overrides: moveOverride }),
      });
      const j = await res.json();
      setApproveResult(j);
      setShowDialog(true);
    } catch (e) { setApproveResult({ status: 'error', message: String(e) }); setShowDialog(true); }
    finally { setApproving(false); }
  }

  function toggleRow(code: string) {
    const n = new Set(selected);
    if (n.has(code)) n.delete(code); else n.add(code);
    setSelected(n);
  }
  function toggleAll() {
    if (selected.size === displayRows.length) setSelected(new Set());
    else setSelected(new Set(displayRows.map(r => r.code)));
  }

  function getDownloadItems(): MatrixRow[] {
    if (selected.size > 0) return filtered.filter(r => selected.has(r.code));
    return rows;
  }
  async function downloadRotation() {
    const items = getDownloadItems();
    if (items.length === 0) { alert('다운로드할 항목이 없습니다.'); return; }
    const sheets = rotationSheets(items, [...CHANNELS], CH_SHORT);
    const ts = new Date().toISOString().slice(0,10).replaceAll('-','').slice(2);
    const totalQty = (sheets['전체 회전 매트릭스']?.rows ?? []).reduce((s: number, r: any) => s + Number(r['OUT 수량(장)'] || 0), 0);
    const styledSheets: any = {}; for (const [k, v] of Object.entries(sheets)) { styledSheets[k] = { ...(v as any), colorMap: { 'OUT 수량(장)': 'move', 'IN 수량(장)': 'move', '현 재고주수': 'woc', '이동 후 재고주수': 'woc' } }; }
    await downloadXlsxStyled(styledSheets, `회전결과_${scenarioKey.replace(/\s/g,'')}_${ts}_${totalQty}장`);
  }
  async function downloadLogistics() {
    const items = getDownloadItems();
    if (items.length === 0) { alert('다운로드할 항목이 없습니다.'); return; }
    const sheets = logisticsSheets(items, [...CHANNELS], CH_SHORT);
    const ts = new Date().toISOString().slice(0,10).replaceAll('-','').slice(2);
    const styledLog: any = {}; for (const [k, v] of Object.entries(sheets)) { styledLog[k] = { ...(v as any), colorMap: { '이동수량(장)': 'move' } }; }
    await downloadXlsxStyled(styledLog, `물류이동요청_${ts}`);
  }

  const scenarioDesc = allowSlider
    ? '상단 슬라이더로 직접 조정 (이동 상한 % 포함). 기본값 30%.'
    : '결품 기준 1주 미만 → 목표 2주 확보. 회전(온라인 3채널 잉여→결품)으로 보충. 이동 상한: 각 채널 현재고의 30% (스파오 6/19 미팅 합의 — 보수 운영)';

  // 단품코드 후보 (이동 발생 SKU)
  const pickerCandidates = useMemo(() => {
    const q = pickerQ.trim().toUpperCase();
    return rows.filter(r => !q || r.code.toUpperCase().startsWith(q)).slice(0, 200);
  }, [rows, pickerQ]);

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>{scenarioKey === '🛡️ 기본' ? '🛡️ 재배치(기본)' : '🎛️ 재배치(임의)'}</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: descBorderColor, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '계산 중...' : '🔄 재계산'}</button>
      </div>

      {allowSlider && (
        <>
          <div style={{ color: CLR.text, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>🎛️ 사용자 정의 기준</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
            <Slider label="재배치 대상 (재고주수 0주 이하)" min={0.5} max={4} step={0.5} value={shortage} onChange={setShortage} />
            <Slider label="목표 재고주수 (주)" min={1} max={6} step={0.5} value={target} onChange={setTarget} />
            <Slider label="이동 ≥ N장만 (비부가 제거)" min={0} max={50} step={1} value={minMove} onChange={setMinMove} />
            <Slider label="소액 채널 제외 (주간주문 N장 미만)" min={0} max={20} step={1} value={minRecv} onChange={setMinRecv} />
            <Slider label="채널별 이동 상한 (현재고 %)" min={0} max={100} step={5} value={cap} onChange={setCap} unit="%" />
          </div>
        </>
      )}

      <div style={{ background: '#0A1826', borderLeft: `4px solid ${descBorderColor}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>{scenarioDesc}</div>

      {data?.status === 'error' && <div style={{ padding: 12, background: 'rgba(255,90,95,0.1)', border: `1px solid ${CLR.red_fg}`, borderRadius: 6, marginBottom: 12, color: CLR.red_fg, fontSize: 12 }}>⚠️ {data.message}</div>}

      {s && (
        <div style={{ padding: '6px 10px', background: 'rgba(74,227,181,0.08)', borderRadius: 4, marginBottom: 10, fontSize: 11, color: CLR.grn_fg }}>
          📡 실 재배치 엔진 · {data?.csvDate} CSV · 데이터 상태: 정적 데이터 · {kpi.sub} · 🚫 채널 IN-OUT {chxUse} ({data?.chx_rules_total ?? 0}건) · ✏️ 수정 {Object.keys(moveOverride).length}건
        </div>
      )}

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
          <Kpi label="총 단품량" value={`${kpi.units.toLocaleString()}장`} sub={`3채널 재고 합계 · ${kpi.sub}`} />
          <Kpi label="총 이동량(회전)" value={`${kpi.move.toLocaleString()}장`} sub={`주간 IN · ${kpi.sub}`} />
          <Kpi label="총 재고금액" value={`${(kpi.units_amt/1e8).toFixed(1)}억`} sub="매장재고 정상가" />
          <Kpi label="총 이동 금액" value={`${(kpi.amt/1e8).toFixed(2)}억`} sub="이동수량 × 정상가" />
          <Kpi label="회수 매출 · 채널 구성" value={`${(kpi.rev/1e8).toFixed(2)}억`} sub={<ChanRecovery s={s} />} />
          <Kpi label="연 환산" value={`${Math.round(kpi.rev*52/1e8)}억`} sub="× 52주" />
        </div>
      )}

      {/* 필터 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 2.6fr 2.6fr 1.8fr', gap: 10, marginBottom: 10, alignItems: 'end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, cursor: 'pointer', color: CLR.text, fontSize: 13, height: 38 }}>
          <input type="checkbox" checked={onlyMoved} onChange={e => setOnlyMoved(e.target.checked)} style={{ width: 14, height: 14 }} />
          이동 발생만
        </label>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>단품코드 검색</div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="앞 10자리 입력 (예: SPPPG25U05)" style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13, width: '100%', height: 38 }} />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>단품코드 선택 (복수 가능)</div>
          <button onClick={() => setPickerOpen(!pickerOpen)} style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${pickerOpen ? CLR.grn_fg : CLR.border}`, borderRadius: 4, color: selected.size > 0 ? CLR.grn_fg : CLR.muted, fontSize: 12, height: 38, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
            {selected.size > 0 ? `☑ ${selected.size}개 선택됨 (클릭하여 편집)` : '드롭다운에서 단품 다중 선택'}
          </button>
          {pickerOpen && (
            <div style={{ position: 'absolute', top: 62, left: 0, right: 0, background: CLR.card, border: `1px solid ${CLR.grn_fg}`, borderRadius: 4, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: 8, maxHeight: 320, overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={pickerQ} onChange={e => setPickerQ(e.target.value)} placeholder="검색..." style={{ flex: 1, padding: '6px 8px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 3, color: CLR.text, fontSize: 12 }} />
                <button onClick={() => setSelected(new Set())} style={{ padding: '5px 10px', background: 'transparent', color: CLR.red_fg, border: `1px solid ${CLR.red_fg}`, borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>초기화</button>
                <button onClick={() => setPickerOpen(false)} style={{ padding: '5px 10px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>완료</button>
              </div>
              {pickerCandidates.map(r => (
                <label key={r.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer', fontSize: 12, color: CLR.text, borderBottom: `1px solid ${CLR.border}` }}>
                  <input type="checkbox" checked={selected.has(r.code)} onChange={() => toggleRow(r.code)} />
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>{r.code}</span>
                  <span style={{ color: CLR.muted, marginLeft: 6, flex: 1 }}>{r.name.slice(0, 20)}</span>
                  <span style={{ color: CLR.yel_fg }}>{r.effect.toLocaleString()}만</span>
                </label>
              ))}
              {pickerCandidates.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: CLR.muted, fontSize: 11 }}>검색 결과 없음</div>}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>정렬</div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13, width: '100%', height: 38 }}>
            <option value="effect">기대효과 ↓</option>
            <option value="rank">온라인 매출 순위 ↑</option>
            <option value="move">이동수량 ↓</option>
            <option value="code">단품코드</option>
          </select>
        </div>
      </div>

      {/* 액션 바 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 2fr 2fr 2fr', gap: 10, marginBottom: 10, alignItems: 'end' }}>
        <div style={{ color: CLR.text, fontSize: 13, fontWeight: 700, paddingTop: 8 }}>단품 × 채널 매트릭스 — {filtered.length.toLocaleString()}건</div>
        <div>
          <div style={{ display: 'flex', gap: 0, background: CLR.panel, padding: 3, borderRadius: 4 }}>
            {(['적용', '미적용'] as const).map(v => (
              <button key={v} onClick={() => setChxUse(v)}
                style={{ flex: 1, padding: '7px 8px', background: chxUse === v ? descBorderColor : 'transparent', color: chxUse === v ? '#0A141F' : CLR.text, border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{v}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: CLR.muted, marginTop: 4 }}>🚫 IN-OUT 규칙 {chxUse}</div>
        </div>
        <button onClick={approve} disabled={approving} style={{ padding: '10px 12px', background: descBorderColor, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: approving ? 'not-allowed' : 'pointer', height: 38 }}>
          {approving ? '승인 중...' : `✅ 선택 ${(selected.size > 0 ? selected.size : s?.moved_sku_count ?? 0).toLocaleString()}건 승인(회전)`}
        </button>
        <button onClick={downloadRotation} style={{ padding: '10px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', height: 38 }}>⬇️ Excel (회전 수기 실행용)</button>
        <button onClick={downloadLogistics} style={{ padding: '10px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', height: 38 }}>⬇️ Excel (물류용)</button>
      </div>

      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 6 }}>💡 좌측 ☑ 박스(행) 클릭 → 단품 선택 · 헤더 클릭으로 전체 선택 · 이동수량 셀 클릭 → 직접 편집 (Enter 저장 · Esc 취소)</div>

      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 640, width: '100%' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', minWidth: 1600, fontFamily: 'Inter, "Noto Sans KR", sans-serif' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0A1826', zIndex: 3 }}>
            <tr>
              <th rowSpan={2} style={{ ...th(28), position: 'sticky', left: 0, zIndex: 4 }}><input type="checkbox" checked={selected.size > 0 && selected.size === displayRows.length} onChange={toggleAll} /></th>
              <th rowSpan={2} style={{ ...th(94), position: 'sticky', left: 28, zIndex: 4 }}>단품코드</th>
              <th rowSpan={2} style={{ ...th(200), position: 'sticky', left: 122, zIndex: 4 }}>단품명</th>
              <th rowSpan={2} style={th(78, 'right')}>주간외형매출</th>
              <th rowSpan={2} style={th(46, 'right')}>누판</th>
              <th rowSpan={2} style={th(46, 'right')}>주판</th>
              <th rowSpan={2} style={th(46, 'right')}>출고</th>
              <th rowSpan={2} style={th(68, 'right')}>반응과 재고</th>
              <th colSpan={CHANNELS.length} style={thG(CLR.blue)}>현 재고보유주수</th>
              <th colSpan={CHANNELS.length} style={thG(CLR.green)}>이동수량 (장)</th>
              <th colSpan={CHANNELS.length} style={thG(CLR.orange)}>이동 후 재고보유주수</th>
              <th colSpan={CHANNELS.length} style={thG(CLR.purple)}>이동 후 재고량 (장,±)</th>
              <th rowSpan={2} style={th(76, 'right')}>효과 (만원)</th>
            </tr>
            <tr>
              {CHANNELS.map(c => <th key={'w1'+c} style={thS(CLR.blue)}>{CH_SHORT[c]}</th>)}
              {CHANNELS.map(c => <th key={'m'+c} style={thS(CLR.green)}>{CH_SHORT[c]}</th>)}
              {CHANNELS.map(c => <th key={'w2'+c} style={thS(CLR.orange)}>{CH_SHORT[c]}</th>)}
              {CHANNELS.map(c => <th key={'q'+c} style={thS(CLR.purple)}>{CH_SHORT[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayRows.length > 0 && (
              <tr style={{ background: CLR.sum_bg }}>
                <td style={{ ...td(), position: 'sticky', left: 0, background: CLR.sum_bg, zIndex: 2 }}></td>
                <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700, position: 'sticky', left: 28, background: CLR.sum_bg, zIndex: 2 }}>Σ 합계</td>
                <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700, position: 'sticky', left: 122, background: CLR.sum_bg, zIndex: 2 }}>{filtered.length.toLocaleString()}건</td>
                <td colSpan={CHANNELS.length} style={td()}></td>
                {CHANNELS.map(c => <td key={'wa'+c} style={td('right')}></td>)}
                {CHANNELS.map(c => {
                  const sum = displayRows.reduce((s, r) => s + (r.moves[c] ?? 0), 0);
                  return <td key={'ms'+c} style={{ ...td('right'), color: sum > 0 ? CLR.grn_fg : sum < 0 ? CLR.red_fg : CLR.muted, fontWeight: 700 }}>{sum === 0 ? '0' : (sum > 0 ? '+' : '') + sum.toLocaleString()}</td>;
                })}
                {CHANNELS.map(c => <td key={'wb'+c} style={td('right')}></td>)}
                {CHANNELS.map(c => <td key={'qs'+c} style={td('right')}></td>)}
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{displayRows.reduce((s, r) => s + r.effect, 0).toLocaleString()}</td>
              </tr>
            )}
            {loading && displayRows.length === 0 && <tr><td colSpan={28} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>재배치 엔진 계산 중 (컬러(12자리) 단위 그룹 처리 · 10~30초)...</td></tr>}
            {!loading && displayRows.length === 0 && <tr><td colSpan={28} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>필터 조건에 맞는 단품이 없습니다.</td></tr>}
            {displayRows.map(r => (
              <tr key={r.code} style={{ borderTop: `1px solid ${CLR.border}`, background: selected.has(r.code) ? 'rgba(74,227,181,0.05)' : 'transparent' }}>
                <td style={{ ...td(), position: 'sticky', left: 0, background: selected.has(r.code) ? '#0F2233' : CLR.card, zIndex: 2 }}><input type="checkbox" checked={selected.has(r.code)} onChange={() => toggleRow(r.code)} /></td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text, position: 'sticky', left: 28, background: selected.has(r.code) ? '#0F2233' : CLR.card, zIndex: 2 }}>{r.code}</td>
                <td style={{ ...td(), color: CLR.text, position: 'sticky', left: 122, background: selected.has(r.code) ? '#0F2233' : CLR.card, zIndex: 2 }} title={r.name}>{r.name.length > 24 ? r.name.slice(0, 24) + '…' : r.name}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.wk_sales > 0 ? `${Math.round(r.wk_sales/10000).toLocaleString()}만` : '-'}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(r.cum_rate * 100)}%</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(r.wk_rate * 100)}%</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(r.ship_rate * 100)}%</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.inv_react.toLocaleString()}</td>
                {CHANNELS.map(c => { const w = r.woc_before[c]; return <td key={'wa'+c} style={{ ...td(), ...wocStyle(w) }}>{w === null ? '' : `${Math.round(w)}주`}</td>; })}
                {CHANNELS.map(c => { const ov = moveOverride[r.code]?.[c]; const v = ov !== undefined ? ov : (r.moves[c] ?? 0); const cellKey = `${r.code}|${c}`; const isEdit = editingCell === cellKey; return <td key={'m'+c} style={{ ...td(), ...mvStyle(v), cursor: 'pointer', ...(ov !== undefined ? { outline: `1px dashed ${CLR.grn_fg}` } : {}) }} onClick={() => setEditingCell(cellKey)}>{isEdit ? <input autoFocus type="number" defaultValue={v} onBlur={e => { const nv = Number(e.target.value); setMoveOverride(prev => ({ ...prev, [r.code]: { ...(prev[r.code] ?? {}), [c]: nv } })); setEditingCell(null); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingCell(null); }} style={{ width: 50, padding: 2, background: CLR.panel, border: `1px solid ${CLR.grn_fg}`, color: CLR.text, fontSize: 11, textAlign: 'center' }} /> : (v === 0 ? '0' : (v > 0 ? '+' : '') + v)}</td>; })}
                {CHANNELS.map(c => { const ov = moveOverride[r.code]?.[c]; const v = ov !== undefined ? ov : (r.moves[c] ?? 0); const o = r.ord[c] ?? 0; const w = o > 0 ? ((r.inv[c] ?? 0) + v) / o : null; return <td key={'wb'+c} style={{ ...td(), ...wocStyle(w) }}>{w === null ? '' : `${Math.round(w)}주`}</td>; })}
                {CHANNELS.map(c => { const ov = moveOverride[r.code]?.[c]; const v = ov !== undefined ? ov : (r.moves[c] ?? 0); const ni = (r.inv[c] ?? 0) + v; const s = v === 0 ? ni.toLocaleString() : `${ni.toLocaleString()} (${v > 0 ? '+' : ''}${v})`; return <td key={'q'+c} style={{ ...td(), ...qtyStyle(v) }}>{s}</td>; })}
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.effect.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: CLR.muted }}>{selected.size > 0 ? `✅ 선택: ${selected.size.toLocaleString()}건 / 전체 ${filtered.length.toLocaleString()}건 · 선택분만 승인·다운로드 대상` : `✅ 미선택 시 전체 ${(s?.moved_sku_count ?? 0).toLocaleString()}건 실행·다운로드 대상`}</p>
      <p style={{ marginTop: 4, fontSize: 11, color: CLR.muted }}>🎨 재고보유주수: 🔴 &lt; 1주 · 🟡 1~4주 · 🟢 ≥ 4주 | 🔁 회전 = 온라인 3채널 이동(합계 0) | 효과 = 결품해소 회수매출(만원) | ※ 외부창고(AENS·ADU3·ADQS) 제외</p>

      {/* #5 승인 다이얼로그 (정식 모달) */}
      {showDialog && approveResult && s && (
        <ApproveDialog result={approveResult} summary={s} scenarioKey={scenarioKey} onClose={() => setShowDialog(false)} />
      )}
    </div>
  );
}

function ApproveDialog({ result, summary, scenarioKey, onClose }: any) {
  const ok = result.status === 'ok';
  const skuCount = result.sku_count ?? 0;
  const moveQty = result.move_qty ?? 0;
  const expAmt = result.expected_amt ?? 0;

  function sendMail() {
    const subject = encodeURIComponent(`[뉴발란스 REBA] ${scenarioKey} 회전 승인 · id=${result.id} · ${skuCount}건 · ${moveQty}장`);
    const body = encodeURIComponent(
`안녕하세요, 뉴발란스 온라인 재고관리 Agent 회전 실행 결과 공유드립니다.

■ 승인 ID: #${result.id}
■ 시나리오: ${scenarioKey}
■ 승인 단품: ${skuCount.toLocaleString()}건
■ 총 이동량: ${moveQty.toLocaleString()}장
■ 기대 회수 매출: ${expAmt.toLocaleString()}만원

채널별 IN/OUT:
${Object.entries(summary.by_channel ?? {}).map(([ch, v]: any) => `- ${ch}: IN +${v.in_qty.toLocaleString()} / OUT -${v.out_qty.toLocaleString()} (순증감 ${v.in_qty - v.out_qty >= 0 ? '+' : ''}${(v.in_qty - v.out_qty).toLocaleString()})`).join('\n')}

* 회수 매출은 결품 해소 기준 보수 추정치 · 실제효과는 D+7 실측 반영
* 실행 이력은 대시보드 '📈 실행 효과' 탭에서 확인 가능`);
    window.location.href = `mailto:kang_hoonkoo@eland.co.kr?subject=${subject}&body=${body}`;
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: CLR.card, border: `2px solid ${ok ? CLR.grn_fg : CLR.red_fg}`, borderRadius: 12, padding: 24, minWidth: 640, maxWidth: 800, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: ok ? CLR.grn_fg : CLR.red_fg }}>{ok ? '✅ 재고 이동 전송 완료' : '⚠️ 승인 실패'}</div>
          <button onClick={onClose} style={{ padding: '4px 10px', background: 'transparent', color: CLR.muted, border: `1px solid ${CLR.border}`, borderRadius: 3, cursor: 'pointer' }}>✕</button>
        </div>

        {ok ? (
          <>
            <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.grn_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              <b>SAP BAPI 전송 완료 (mock)</b> — 실행 ID <b>#{result.id}</b> · 📈 실행 효과 탭에 이력 기록됨<br/>
              실 배포 시: BAPI_GOODS_MVT_CREATE 호출 → 전표 생성 → audit log
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              <MetricSm label="승인 단품" value={`${skuCount.toLocaleString()}건`} />
              <MetricSm label="총 이동량" value={`${moveQty.toLocaleString()}장`} />
              <MetricSm label="총 이동 금액" value={`${(((summary?.total_amt ?? 0) / 1e8)).toFixed(2)}억`} note="정상가 합계" />
              <MetricSm label="기대 회수 매출" value={`${(expAmt / 10000).toFixed(2)}억`} highlight />
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>채널별 IN / OUT / 순증감</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
              <thead style={{ background: '#0A1826' }}><tr>
                <th style={dlgTh()}>채널</th>
                <th style={dlgTh('right')}>IN (장)</th>
                <th style={dlgTh('right')}>OUT (장)</th>
                <th style={dlgTh('right')}>순증감</th>
              </tr></thead>
              <tbody>
                {Object.entries(summary.by_channel ?? {}).map(([ch, v]: any) => {
                  const net = v.in_qty - v.out_qty;
                  return (
                    <tr key={ch} style={{ borderTop: `1px solid ${CLR.border}` }}>
                      <td style={{ ...dlgTd(), color: CLR.text, fontWeight: 600 }}>{ch}</td>
                      <td style={{ ...dlgTd('right'), color: v.in_qty > 0 ? CLR.grn_fg : CLR.muted }}>{v.in_qty > 0 ? '+' : ''}{v.in_qty.toLocaleString()}</td>
                      <td style={{ ...dlgTd('right'), color: v.out_qty > 0 ? CLR.red_fg : CLR.muted }}>{v.out_qty > 0 ? '-' : ''}{v.out_qty.toLocaleString()}</td>
                      <td style={{ ...dlgTd('right'), color: net > 0 ? CLR.grn_fg : net < 0 ? CLR.red_fg : CLR.muted, fontWeight: 700 }}>{net > 0 ? '+' : ''}{net.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={sendMail} style={{ flex: 1, padding: '10px 18px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📧 회전 결과 메일 발송</button>
              <button onClick={onClose} style={{ padding: '10px 18px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>닫기</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: 14, background: 'rgba(255,90,95,0.1)', border: `1px solid ${CLR.red_fg}`, borderRadius: 4, marginBottom: 14, color: CLR.red_fg, fontSize: 13 }}>❌ {result.message ?? '알 수 없는 오류'}</div>
            <button onClick={onClose} style={{ padding: '10px 18px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>닫기</button>
          </>
        )}
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, unit = '' }: any) {
  return (
    <div style={{ background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 6, padding: 10 }}>
      <div style={{ fontSize: 11, color: CLR.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.3, minHeight: 30 }}>{label}</div>
      <div style={{ fontSize: 20, color: CLR.yel_fg, fontWeight: 800, marginBottom: 2 }}>{value}{unit}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}
function Kpi({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div style={{ background: '#101E2E', border: '1px solid #1F3A55', borderRadius: 6, padding: '12px 10px', textAlign: 'center', minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 11, color: '#FFFFFF', opacity: 0.85 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#4AE3B5', margin: '4px 0', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#FFFFFF', opacity: 0.7 }}>{sub}</div>
    </div>
  );
}
function MetricSm({ label, value, note, highlight }: any) {
  return (
    <div style={{ background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? CLR.grn_fg : CLR.text, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 9, color: CLR.muted, marginTop: 2 }}>{note}</div>}
    </div>
  );
}
const CHAN_COLOR: Record<string, string> = { '공홈': '#4AE3B5', '무신사': '#3B82F6', '29CM': '#FB923C' };
function ChanRecovery({ s }: { s: Summary }) {
  const items = CHANNELS.map(c => ({ ch: c, rev: s.by_channel[c]?.effect ?? 0 })).filter(x => x.rev > 0).sort((a, b) => b.rev - a.rev);
  if (items.length === 0) return <span>-</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 1, height: 6, borderRadius: 3, overflow: 'hidden' }}>
        {items.map(x => <div key={x.ch} title={`${CH_SHORT[x.ch]} ${(x.rev/1e8).toFixed(2)}억`} style={{ flex: x.rev, background: CHAN_COLOR[x.ch] ?? CLR.grn_fg }} />)}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 9, color: '#FFFFFF', opacity: 0.9 }}>
        {items.map(x => (
          <span key={x.ch} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: CHAN_COLOR[x.ch] ?? CLR.grn_fg }} />
            {CH_SHORT[x.ch]} {(x.rev/1e8).toFixed(2)}억
          </span>
        ))}
      </div>
    </div>
  );
}
function th(minW: number, align: 'left' | 'right' = 'left'): React.CSSProperties { return { padding: '8px 6px', textAlign: align, color: '#FFFFFF', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', minWidth: minW, borderBottom: '2px solid #1F2E42', verticalAlign: 'middle', background: '#0A1826' }; }
function thG(bg: string): React.CSSProperties { return { padding: '6px', textAlign: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: 11, background: bg }; }
function thS(bg: string): React.CSSProperties { return { padding: '4px 6px', textAlign: 'right', color: '#FFFFFF', fontWeight: 600, fontSize: 10, background: bg, opacity: 0.85, minWidth: 42 }; }
function td(align: 'left' | 'right' | 'center' = 'left'): React.CSSProperties { return { padding: '5px 6px', textAlign: align, fontSize: 11, whiteSpace: 'nowrap' }; }
function dlgTh(align: any = 'left'): any { return { padding: '9px 10px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${CLR.border}` }; }
function dlgTd(align: any = 'left'): any { return { padding: '7px 10px', textAlign: align, fontSize: 12 }; }
