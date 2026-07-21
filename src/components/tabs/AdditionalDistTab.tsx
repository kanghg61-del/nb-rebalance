'use client';
import { useEffect, useMemo, useState } from 'react';
import { CLR, wocStyle } from '@/lib/theme';
import { downloadCsv, downloadXlsx, downloadXlsxStyled } from '@/lib/downloads';

function gradeStyle(g: string): React.CSSProperties {
  if (g.includes('X')) return { backgroundColor: CLR.red_bg, color: CLR.red_fg, fontWeight: 700 };
  if (g.includes('M')) return { backgroundColor: CLR.yel_bg, color: CLR.yel_fg, fontWeight: 700 };
  if (g.includes('S')) return { backgroundColor: CLR.grn_bg, color: CLR.grn_fg, fontWeight: 700 };
  return {};
}

export function AdditionalDistTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [q, setQ] = useState('');
  const [srt, setSrt] = useState('필업');
  const [expandStyle, setExpandStyle] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/rebalance/onepan', { cache: 'no-store' });
      setData(await res.json());
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const s = data?.summary;
  const rows = data?.rows ?? [];
  const top10 = data?.top10 ?? [];

  const filtered = useMemo(() => {
    let f = [...rows];
    if (gradeFilter !== '전체') f = f.filter((r: any) => r.grade === gradeFilter);
    if (q.trim()) f = f.filter((r: any) => r.sty_code.startsWith(q.trim().toUpperCase()) || r.code.startsWith(q.trim().toUpperCase()));
    if (srt === '필업') f.sort((a, b) => b.fillq - a.fillq);
    else if (srt === '주판') f.sort((a, b) => b.ord - a.ord);
    else f.sort((a, b) => (a.woc ?? 999) - (b.woc ?? 999));
    return f;
  }, [rows, gradeFilter, q, srt]);

  async function downloadTop10() {
    if (!top10.length) return;
    await downloadXlsxStyled({ '핵심 10 스타일': { rows: top10, headers: ['grade','sty','name','topch','wh_code','inv','bw_q','bw_amt_man','ord','woc','qty','amt_man','woc_after'], colorMap: { grade: 'grade', woc: 'woc', woc_after: 'woc' } } },
      `추가분배_핵심10_${new Date().toISOString().slice(0,10)}`);
  }
  async function downloadAll() {
    if (!rows.length) return;
    const headers = ['grade','sty_code','code','name','topch','wh_code','inv','bw_qty','bw_amt','ord','woc','fillq','fill_amt_man','woc_after','price'];
    await downloadXlsxStyled({ '전체 단품 리스트': { rows: filtered, headers, colorMap: { grade: 'grade', woc: 'woc', woc_after: 'woc' } }, '핵심 10 스타일': { rows: top10, headers: ['grade','sty','name','topch','wh_code','inv','bw_q','bw_amt_man','ord','woc','qty','amt_man','woc_after'], colorMap: { grade: 'grade', woc: 'woc', woc_after: 'woc' } } },
      `추가분배_전체_${new Date().toISOString().slice(0,10)}`);
  }

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>🧩 추가 분배</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '로딩...' : '🔄 새로고침'}</button>
      </div>
      <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.grn_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
        스파오 6개 엑셀(공홈 결품체크·계산기, 네이버/지그재그/키즈 한판, 지그재그 마케팅)을 한 화면으로 흡수하는 통합 단품판. <b>진단(S/M/X)·현재고·주판·재고주수·필업 요청수량·반응과 보유·주력채널은 실데이터</b>. 진단: 🔴 X 결품임박(&lt;1주) · 🟡 M 주의(1~4주) · 🟢 S 정상(≥4주). <b>필업 요청수량 = 재고주수 1주 미만 단품에 한해 1주 목표재고 − 현재고</b>.
      </div>

      {/* 6 KPI */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
          <Kpi label="🔴 결품임박(X)" value={`${s.nX.toLocaleString()}건`} sub="재고주수 < 1주" />
          <Kpi label="🟡 주의(M)" value={`${s.nM.toLocaleString()}건`} sub="1~4주" />
          <Kpi label="🟢 정상(S)" value={`${s.nS.toLocaleString()}건`} sub="≥ 4주" />
          <Kpi label="📦 필업 요청수량" value={`${s.fill_q.toLocaleString()}장`} sub="결품임박만 · 1주 목표" />
          <Kpi label="💰 필업 요청금액" value={`${(s.fill_amt / 1e8).toFixed(2)}억`} sub="필업 × 정상가" />
          <Kpi label="🏬 반응과 보유" value={`${(s.bw_total_amt / 1e8).toFixed(2)}억`} sub={`${s.bw_total_qty.toLocaleString()}장`} />
        </div>
      )}

      {/* 핵심 10 스타일 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, marginTop: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text }}>⭐ 추가 분배 핵심 10 스타일</div>
        <button onClick={downloadTop10} style={{ padding: '6px 12px', background: CLR.panel, color: CLR.text, border: `1px solid ${CLR.border}`, borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel</button>
      </div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 6 }}>단품을 스타일(10자리)로 묶어 <b>필업 요청금액 큰 순</b>. 첨부 스파오 스타일코드 매핑 적용.</div>
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 380, marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#0A1826' }}>
            <tr>
              <th style={th()}>진단</th><th style={th()}>스타일코드</th><th style={th()}>스타일명</th>
              <th style={th()}>주력채널</th><th style={th()}>출고매장코드</th>
              <th style={th('right')}>현재고</th><th style={th('right')}>반응과 전체수량</th><th style={th('right')}>반응과 전체금액(만원)</th>
              <th style={th('right')}>주판</th><th style={th('right')}>재고주수</th>
              <th style={th('right')}>필업요청(장)</th><th style={th('right')}>필업요청금액(만원)</th>
              <th style={th('right')}>이동 후 재고주수</th><th style={th('right')}>예상 회수매출(만원)</th>
            </tr>
          </thead>
          <tbody>
            {/* 합계 행 */}
            {top10.length > 0 && s && (() => {
              const sum_inv = top10.reduce((a: number, r: any) => a + r.inv, 0);
              const sum_bw_q = top10.reduce((a: number, r: any) => a + r.bw_q, 0);
              const sum_bw_amt = top10.reduce((a: number, r: any) => a + r.bw_amt_man, 0);
              const sum_ord = top10.reduce((a: number, r: any) => a + r.ord, 0);
              const sum_qty = top10.reduce((a: number, r: any) => a + r.qty, 0);
              const sum_amt = top10.reduce((a: number, r: any) => a + r.amt_man, 0);
              const wsum = sum_ord > 0 ? +(sum_inv / sum_ord).toFixed(1) : null;
              const wsuma = sum_ord > 0 ? +((sum_inv + sum_qty) / sum_ord).toFixed(1) : null;
              return (
                <tr style={{ background: CLR.sum_bg }}>
                  <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>— 합계 —</td>
                  <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>{top10.length}개</td>
                  <td colSpan={3} style={td()}></td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_inv.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_bw_q.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_bw_amt.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_ord.toLocaleString()}</td>
                  <td style={{ ...td('right'), ...wocStyle(wsum) }}>{wsum !== null ? `${wsum}주` : ''}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_qty.toLocaleString()}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_amt.toLocaleString()}</td>
                  <td style={{ ...td('right'), ...wocStyle(wsuma) }}>{wsuma !== null ? `${wsuma}주` : ''}</td>
                  <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{sum_amt.toLocaleString()}</td>
                </tr>
              );
            })()}
            {top10.map((r: any, i: number) => (
              <>
              <tr key={i} onClick={() => setExpandStyle(expandStyle === r.sty ? null : r.sty)} style={{ borderTop: `1px solid ${CLR.border}`, cursor: 'pointer', background: expandStyle === r.sty ? 'rgba(74,227,181,0.05)' : 'transparent' }}>
                <td style={{ ...td(), ...gradeStyle(r.grade) }}>{r.grade}</td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.sty}</td>
                <td style={{ ...td(), color: CLR.text }}>{(r.name || '').length > 28 ? r.name.slice(0, 28) + '…' : r.name}</td>
                <td style={{ ...td(), color: CLR.text }}>{r.topch}</td>
                <td style={{ ...td(), color: CLR.muted }}>{r.wh_code}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.inv.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.bw_q.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.bw_amt_man.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.ord.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc) }}>{r.woc !== null ? `${r.woc}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{r.qty.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{r.amt_man.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc_after) }}>{r.woc_after !== null ? `${r.woc_after}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.amt_man.toLocaleString()}</td>
              </tr>
              {expandStyle === r.sty && (
                <tr><td colSpan={14} style={{ padding: 8, background: '#0A1826' }}>
                  <div style={{ fontSize: 11, color: CLR.grn_fg, fontWeight: 700, marginBottom: 4 }}>▼ {r.sty} 하위 사이즈 ({rows.filter((x: any) => x.sty_code === r.sty).length}개)</div>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={{ textAlign: 'left', padding: 4, color: CLR.muted }}>단품코드</th><th style={{ textAlign: 'left', padding: 4, color: CLR.muted }}>단품명</th><th style={{ textAlign: 'right', padding: 4, color: CLR.muted }}>현재고</th><th style={{ textAlign: 'right', padding: 4, color: CLR.muted }}>주판</th><th style={{ textAlign: 'right', padding: 4, color: CLR.muted }}>WOC</th><th style={{ textAlign: 'right', padding: 4, color: CLR.muted }}>필업(장)</th><th style={{ textAlign: 'right', padding: 4, color: CLR.muted }}>금액(만원)</th></tr></thead>
                    <tbody>
                      {rows.filter((x: any) => x.sty_code === r.sty).map((x: any, j: number) => (
                        <tr key={j} style={{ borderTop: `1px solid ${CLR.border}` }}>
                          <td style={{ padding: 4, fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{x.code}</td>
                          <td style={{ padding: 4, color: CLR.text }}>{x.name}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: CLR.text }}>{x.inv.toLocaleString()}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: CLR.text }}>{x.ord.toLocaleString()}</td>
                          <td style={{ padding: 4, ...wocStyle(x.woc) }}>{x.woc !== null ? `${x.woc}주` : ''}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: CLR.grn_fg, fontWeight: 700 }}>{x.fillq.toLocaleString()}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: CLR.yel_fg }}>{x.fill_amt_man.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td></tr>
              )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {s && s.top10_amt_sum > 0 && (
        <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.yel_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 14 }}>
          ⭐ <b>상위 10 스타일 합산 기대매출: {(s.top10_amt_sum / 1e8).toFixed(2)}억</b> ({s.top10_share.toFixed(0)}% / 전체 필업 요청금액 {(s.fill_amt / 1e8).toFixed(2)}억).
        </div>
      )}

      {/* 전체 단품 리스트 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text }}>📋 전체 단품 리스트</div>
        <button onClick={downloadAll} style={{ padding: '6px 12px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⬇️ Excel (전체 + 핵심10)</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr 2fr', gap: 8, marginBottom: 8 }}>
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13 }}>
          <option>전체</option><option>🔴 X 결품임박</option><option>🟡 M 주의</option><option>🟢 S 정상</option>
        </select>
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="검색 (스타일/단품코드 앞 10자리)" style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13 }} />
        <select value={srt} onChange={e => setSrt(e.target.value)} style={{ padding: '8px 10px', background: CLR.panel, border: `1px solid ${CLR.border}`, borderRadius: 4, color: CLR.text, fontSize: 13 }}>
          <option value="필업">필업요청 ↓</option><option value="주판">주판 ↓</option><option value="woc">재고주수 ↑</option>
        </select>
      </div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 6 }}>총 {filtered.length.toLocaleString()}건{filtered.length > 500 ? ' · 상위 500건 표시' : ''}</div>
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#0A1826', zIndex: 1 }}>
            <tr>
              <th style={th()}>진단</th><th style={th()}>스타일코드</th><th style={th()}>단품코드</th><th style={th()}>스타일명</th>
              <th style={th()}>주력채널</th><th style={th()}>출고매장코드</th>
              <th style={th('right')}>현재고</th><th style={th('right')}>반응과 전체수량</th><th style={th('right')}>반응과 전체금액(만원)</th>
              <th style={th('right')}>주판</th><th style={th('right')}>재고주수</th>
              <th style={th('right')}>필업요청(장)</th><th style={th('right')}>필업요청금액(만원)</th>
              <th style={th('right')}>이동 후 재고주수</th><th style={th('right')}>예상 회수매출(만원)</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>로딩 중...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={15} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>대상 단품 없음</td></tr>}
            {filtered.slice(0, 500).map((r: any, i: number) => (
              <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                <td style={{ ...td(), ...gradeStyle(r.grade) }}>{r.grade}</td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.sty_code}</td>
                <td style={{ ...td(), fontFamily: 'ui-monospace, monospace', color: CLR.text }}>{r.code}</td>
                <td style={{ ...td(), color: CLR.text }}>{(r.name || '').length > 24 ? r.name.slice(0, 24) + '…' : r.name}</td>
                <td style={{ ...td(), color: CLR.text }}>{r.topch}</td>
                <td style={{ ...td(), color: CLR.muted }}>{r.wh_code}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.inv.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.bw_qty.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.bw_amt.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{r.ord.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc) }}>{r.woc !== null ? `${r.woc}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{r.fillq.toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.grn_fg, fontWeight: 700 }}>{r.fill_amt_man.toLocaleString()}</td>
                <td style={{ ...td('right'), ...wocStyle(r.woc_after) }}>{r.woc_after !== null ? `${r.woc_after}주` : ''}</td>
                <td style={{ ...td('right'), color: CLR.yel_fg, fontWeight: 700 }}>{r.fill_amt_man.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ background: CLR.card, border: '1px solid #1F3A55', borderRadius: 6, padding: '12px 12px', textAlign: 'center', minHeight: 96 }}>
      <div style={{ fontSize: 11, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: CLR.grn_fg, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: CLR.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
function th(align: any = 'left'): any { return { padding: '9px 8px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `2px solid ${CLR.border}`, background: '#0A1826' }; }
function td(align: any = 'left'): any { return { padding: '6px 8px', textAlign: align, fontSize: 11, whiteSpace: 'nowrap' }; }
