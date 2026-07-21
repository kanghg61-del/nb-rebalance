'use client';
import { useEffect, useState } from 'react';
import { CLR, wocStyle } from '@/lib/theme';

type Summary = { channel: string; inv_qty: number; inv_amt: number; int_amt: number; ext_amt: number; ord_amt: number; ord_qty: number; woc: number | null };
type Totals = { inv_qty: number; inv_amt: number; int_amt: number; ext_amt: number; ord_amt: number; ord_qty: number; woc: number | null };
type ExtRow = { channel: string; wh_name: string; wh_code: string; ext_qty: number; ext_amt: number };
type Response = { status: 'ok' | 'error'; source?: string; csvDate?: string; sku_count?: number; summary?: Summary[]; totals?: Totals; ext_detail?: ExtRow[]; message?: string };

export function StockViewTab() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/data/stock-summary', { cache: 'no-store' });
      const j: Response = await res.json();
      setData(j);
    } catch (e) { setData({ status: 'error', message: String(e) }); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const t = data?.totals;

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: CLR.text }}>🏬 통합 재고뷰</h2>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{loading ? '로딩...' : '🔄 새로고침'}</button>
      </div>

      <div style={{ background: '#0A1826', borderLeft: `4px solid ${CLR.grn_fg}`, padding: '10px 14px', borderRadius: 4, color: CLR.text, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
        온라인 3채널 통합 재고를 한 화면에서 — <b>내부창고 vs 외부창고(FASS·이플렉스·CJ·풀필먼트) 분리</b>. 6/12 스파오 미팅 ①② 요청 반영 — "단순 회전 도구 → 온라인 통합 재고 + 의사결정 허브" 확장 방향.
      </div>

      {data?.status === 'error' && <div style={{ padding: 12, background: 'rgba(255,90,95,0.1)', border: `1px solid ${CLR.red_fg}`, borderRadius: 4, marginBottom: 12, color: CLR.red_fg, fontSize: 12 }}>⚠️ {data.message}</div>}

      {/* 3 KPI */}
      {t && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          <Kpi label="🌐 온라인 총 재고" value={`${(t.inv_amt/1e8).toFixed(2)}억`} sub={`${t.inv_qty.toLocaleString()}장`} />
          <Kpi label="🏬 내부창고" value={`${(t.int_amt/1e8).toFixed(2)}억`} sub={`${(t.inv_qty - Math.round((t.ext_amt / (t.inv_amt / t.inv_qty || 1)))).toLocaleString()}장 · 반응과·천안·인천 등`} />
          <Kpi label="🏭 외부창고" value={`${(t.ext_amt/1e8).toFixed(2)}억`} sub={`FASS·이플렉스·CJ·풀필먼트`} />
        </div>
      )}

      {/* 채널별 표 */}
      <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#0A1826' }}>
            <tr>
              <th style={th()}>채널</th>
              <th style={th('right')}>총 재고금액(만원)</th>
              <th style={th('right')}>내부창고 금액(만원)</th>
              <th style={th('right')}>외부창고 금액(만원)</th>
              <th style={th('right')}>주간 주문액(만원)</th>
              <th style={th('right')}>재고보유주수</th>
            </tr>
          </thead>
          <tbody>
            {t && (
              <tr style={{ background: CLR.sum_bg }}>
                <td style={{ ...td(), color: CLR.sum_fg, fontWeight: 700 }}>— 합계 —</td>
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{Math.round(t.inv_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{Math.round(t.int_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{Math.round(t.ext_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{Math.round(t.ord_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.sum_fg, fontWeight: 700 }}>{t.woc !== null ? `${t.woc.toFixed(1)}주` : '-'}</td>
              </tr>
            )}
            {loading && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>로딩 중...</td></tr>}
            {(data?.summary ?? []).map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                <td style={{ ...td(), color: CLR.text, fontWeight: 600 }}>{row.channel}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(row.inv_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(row.int_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.muted }}>{Math.round(row.ext_amt/10000).toLocaleString()}</td>
                <td style={{ ...td('right'), color: CLR.text }}>{Math.round(row.ord_amt/10000).toLocaleString()}</td>
                <td style={{ ...td(), ...wocStyle(row.woc) }}>{row.woc !== null ? `${row.woc.toFixed(1)}주` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: CLR.muted }}>📡 {data?.source} · CSV: {data?.csvDate} · SKU {(data?.sku_count ?? 0).toLocaleString()}건</p>

      {/* 외부창고 세부 */}
      {(data?.ext_detail?.length ?? 0) > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: CLR.text, marginBottom: 6 }}>🏭 외부창고 세부 (FASS · 이플렉스 · CJ 풀필먼트)</div>
          <div style={{ background: CLR.card, border: `1px solid ${CLR.border}`, borderRadius: 4, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#0A1826' }}>
                <tr>
                  <th style={th()}>채널</th><th style={th()}>창고명</th><th style={th()}>창고코드</th>
                  <th style={th('right')}>재고수량(장)</th><th style={th('right')}>재고금액(만원)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.ext_detail ?? []).map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${CLR.border}` }}>
                    <td style={{ ...td(), color: CLR.text, fontWeight: 600 }}>{r.channel}</td>
                    <td style={{ ...td(), color: CLR.text }}>{r.wh_name}</td>
                    <td style={{ ...td(), color: CLR.muted, fontFamily: 'ui-monospace, monospace' }}>{r.wh_code}</td>
                    <td style={{ ...td('right'), color: CLR.text }}>{r.ext_qty.toLocaleString()}</td>
                    <td style={{ ...td('right'), color: CLR.text }}>{Math.round(r.ext_amt / 10000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: any) {
  return (
    <div style={{ background: CLR.card, border: '1px solid #1F3A55', borderRadius: 6, padding: '14px 14px' }}>
      <div style={{ fontSize: 12, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: CLR.grn_fg, margin: '4px 0' }}>{value}</div>
      <div style={{ fontSize: 11, color: CLR.text, opacity: 0.7 }}>{sub}</div>
    </div>
  );
}
function th(align: any = 'left'): any { return { padding: '10px 12px', textAlign: align, color: CLR.text, fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', borderBottom: `2px solid ${CLR.border}`, background: '#0A1826' }; }
function td(align: any = 'left'): any { return { padding: '8px 12px', textAlign: align, fontSize: 12, whiteSpace: 'nowrap' }; }
