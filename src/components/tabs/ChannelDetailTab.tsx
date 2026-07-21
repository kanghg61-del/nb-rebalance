'use client';
import { useEffect, useState } from 'react';
import { CLR } from '@/lib/theme';

// ── 서브탭별 데이터 타입
type OverviewKpi = { tot_inv: number; tot_amt: number; n_item: number; n_urgent: number; urgent_rate: number };
type GroupRow = { key: string; name?: string; sku_count: number; cum_rate: number; wk_rate: number; wk_sales: number; wk_qty: number; daily: number; daily_amt_man: number; inv: number; inv_amt_man: number; ext: number; ext_amt_man: number; ord: number; woc: number | null; avg_price: number };
type SkuRow = {
  code10: string; code: string; name: string; price: number; bok: string;
  cum_rate: number; wk_rate: number;
  daily: number; daily_amt: number;
  inv: number; inv_amt: number; ext: number;
  woc: number | null; sojin: number | null;
  move: number; ni: number; woc2: number | null; effect: number;
  status: '긴급결품' | '주의' | '정상' | '무판매';
  rank_online: number;
};

const CH_TABS = ['전체', '공홈', '무신사', '29CM'];
const SUB_TABS = [
  { id: 'overview', label: '📋 재고 현황' },
  { id: 'item', label: '🧺 아이템별' },
  { id: 'style', label: '🎨 스타일별' },
  { id: 'sku', label: '🔎 단품 상세' },
] as const;
const BOK_LIST = ['A', 'C', 'G', 'K', 'M', 'U', 'W'];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  '긴급결품': { bg: '#5B1E1E', color: '#FF5A5F' },
  '주의': { bg: '#5A4500', color: '#FFC000' },
  '정상': { bg: '#1B4D3E', color: '#4AE3B5' },
  '무판매': { bg: '#2A2A2A', color: '#888888' },
};
const STATUS_ICON: Record<string, string> = {
  '긴급결품': '🔴', '주의': '🟡', '정상': '🟢', '무판매': '—',
};

export function ChannelDetailTab() {
  const [ch, setCh] = useState('전체');
  const [subTab, setSubTab] = useState<'overview' | 'item' | 'style' | 'sku'>('overview');
  return (
    <div>
      {/* 채널 라디오 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CH_TABS.map(c => (
          <button key={c} onClick={() => setCh(c)}
            style={{ padding: '8px 20px', background: ch === c ? '#FFC000' : 'transparent',
              color: ch === c ? '#0A141F' : CLR.muted,
              border: `1px solid ${ch === c ? '#FFC000' : CLR.border}`,
              borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {c === '전체' ? '⚪ 전체' : `⚪ ${c}`}
          </button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {SUB_TABS.map(s => (
          <button key={s.id} onClick={() => setSubTab(s.id)}
            style={{ padding: '8px 16px', background: subTab === s.id ? CLR.grn_fg : CLR.panel,
              color: subTab === s.id ? '#0A141F' : CLR.muted,
              border: `1px solid ${subTab === s.id ? CLR.grn_fg : CLR.border}`,
              borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {s.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && <OverviewView ch={ch} />}
      {subTab === 'item' && <GroupView ch={ch} mode="item" title="🧺 아이템별 (상품코드 3~4번째 자리)" hint="아이템 = 상품코드 3~4번째 자리(예: SPPPG23U07 → PG). 선택 채널 기준 집계 · 맨 위 합계." />}
      {subTab === 'style' && <GroupView ch={ch} mode="style" title="🎨 스타일별 (상품코드 10자리)" hint="스타일 = 상품코드 10자리 기준. 선택 채널 기준 집계 · 맨 위 합계." />}
      {subTab === 'sku' && <SkuDetailView ch={ch} />}
    </div>
  );
}

// ── 재고 현황 서브탭
function OverviewView({ ch }: { ch: string }) {
  const [kpi, setKpi] = useState<OverviewKpi | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/data/channel-overview?ch=${encodeURIComponent(ch)}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j.status === 'ok') setKpi(j.kpi); })
      .finally(() => setLoading(false));
  }, [ch]);
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>📋 재고 현황 ({ch})</h3>
      {loading && <div style={{ padding: 20, textAlign: 'center', color: CLR.muted }}>조회 중...</div>}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatCard label="총 재고량" value={`${kpi.tot_inv.toLocaleString()}장`} accent="var(--info)" />
          <StatCard label="총 재고금액" value={`${(kpi.tot_amt/1e8).toFixed(2)}억`} sub={`${Math.round(kpi.tot_amt/10000).toLocaleString()}만원`} accent="var(--accent)" />
          <StatCard label="판매 단품" value={`${kpi.n_item.toLocaleString()}건`} sub="주판 > 0" accent="var(--text-primary)" />
          <StatCard label="🚨 결품 임박" value={`${kpi.n_urgent.toLocaleString()}건`} sub={`${kpi.urgent_rate}%`} accent="var(--danger)" />
        </div>
      )}
    </div>
  );
}

// ── 아이템별/스타일별 서브탭
function GroupView({ ch, mode, title, hint }: { ch: string; mode: 'item' | 'style'; title: string; hint: string }) {
  const [data, setData] = useState<{ totals: { sku_count: number; inv: number; inv_amt: number; ord: number; woc: number | null }; data: GroupRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/data/channel-group?ch=${encodeURIComponent(ch)}&mode=${mode}`, { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j.status === 'ok') setData({ totals: j.totals, data: j.data }); })
      .finally(() => setLoading(false));
  }, [ch, mode]);
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 11, color: CLR.muted, marginBottom: 12 }}>{hint}</p>
      <div style={{ background: CLR.card, border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: CLR.panel }}>
            <tr>{['#', mode === 'item' ? '아이템 코드' : '스타일 코드', mode === 'style' ? '스타일명' : null, 'SKU 수', '평균가', '누판율(%)', '주판율(%)', '주간판매(장)', '주간매출(만원)', '일평균 판매(장)', '일평균 매출(만원)', '현 재고량', '현 재고금액(만원)', '외부창고(장)', '외부창고(만원)', '주판', 'WOC'].filter(Boolean).map((h: any) => (
              <th key={h} style={{ padding: 10, textAlign: 'left', color: CLR.muted, fontWeight: 700, borderBottom: '1px solid var(--border-strong)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={17} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>조회 중...</td></tr>}
            {data && (
              <tr style={{ background: 'rgba(74,227,181,0.1)', fontWeight: 700 }}>
                <td style={{ padding: 10, color: CLR.grn_fg }}></td>
                <td style={{ padding: 10, color: CLR.grn_fg }}>— 합계 —</td>
                <td style={{ padding: 10, textAlign: 'right' }}>{data.totals.sku_count.toLocaleString()}</td>
                <td style={{ padding: 10 }}></td>
                <td style={{ padding: 10, textAlign: 'right', color: '#fff' }}>{data.totals.inv.toLocaleString()}</td>
                <td style={{ padding: 10, textAlign: 'right', color: '#fff' }}>{Math.round(data.totals.inv_amt/10000).toLocaleString()}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>{data.totals.ord.toLocaleString()}</td>
                <td style={{ padding: 10, textAlign: 'right', color: CLR.grn_fg }}>{data.totals.woc ?? '-'}</td>
              </tr>
            )}
            {data?.data.map((r, i) => (
              <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: 8, color: CLR.muted }}>{i + 1}</td>
                <td style={{ padding: 8, color: '#fff', fontFamily: 'monospace' }}>{r.key}</td>
                {mode === 'style' && <td style={{ padding: 8, color: '#fff' }}>{(r.name ?? '').length > 22 ? (r.name ?? '').slice(0, 22) + '…' : (r.name ?? '')}</td>}
                <td style={{ padding: 8, textAlign: 'right', color: CLR.muted }}>{r.sku_count}</td>
                <td style={{ padding: 8, textAlign: 'right', color: CLR.yel_fg }}>{r.avg_price.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{Math.round((r as any).cum_rate * 100) || 0}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{Math.round((r as any).wk_rate * 100) || 0}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{((r as any).wk_qty ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{Math.round(((r as any).wk_sales ?? 0) / 10000).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{((r as any).daily ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: '#fff' }}>{((r as any).daily_amt_man ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right' }}>{r.inv.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: CLR.grn_fg }}>{((r as any).inv_amt_man ?? Math.round((r as any).inv_amt/10000)).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: CLR.yel_fg }}>{((r as any).ext ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: CLR.yel_fg }}>{((r as any).ext_amt_man ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: CLR.muted }}>{r.ord.toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: r.woc === null ? CLR.muted : r.woc < 1 ? CLR.red_fg : r.woc < 2 ? CLR.yel_fg : CLR.grn_fg, fontWeight: 700 }}>{r.woc ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 단품 상세 서브탭 (기존 유지 · 22 컬럼)
function SkuDetailView({ ch }: { ch: string }) {
  const [bok, setBok] = useState('전체');
  const [search, setSearch] = useState('');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [sort, setSort] = useState('rank');
  const [data, setData] = useState<{ total: number; count: number; sum: { daily: number; daily_amt: number; inv: number; inv_amt: number; ext: number; move: number; ni: number; effect: number }; data: SkuRow[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ch, bok, search: search.trim(), sort, urgent: onlyUrgent ? '1' : '0', moved: onlyMoved ? '1' : '0', limit: '500' });
      const res = await fetch(`/api/data/channel-detail?${params}`, { cache: 'no-store' });
      const j = await res.json();
      if (j.status === 'ok') setData({ total: j.total, count: j.count, sum: j.sum, data: j.data });
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [ch, bok, onlyUrgent, onlyMoved, sort]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 1.5fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>스타일 선택 (복수 가능)</div>
          <div style={{ padding: 8, background: CLR.panel, border: '1px solid var(--border-strong)', borderRadius: 6, color: CLR.muted, fontSize: 12 }}>스타일 단위 다중 선택</div>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: CLR.muted }}>&nbsp;</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: CLR.panel, border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 13 }}>
            <input type="checkbox" checked={onlyUrgent} onChange={e => setOnlyUrgent(e.target.checked)} style={{ width: 'auto' }} />
            🔴 결품(주의)만
          </label>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: CLR.muted }}>&nbsp;</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, background: CLR.panel, border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: '#fff', fontSize: 13 }}>
            <input type="checkbox" checked={onlyMoved} onChange={e => setOnlyMoved(e.target.checked)} style={{ width: 'auto' }} />
            이동 발생만
          </label>
        </label>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>복종</div>
          <select value={bok} onChange={e => setBok(e.target.value)} style={{ width: '100%', padding: 8, background: CLR.panel, border: '1px solid var(--border-strong)', borderRadius: 6, color: '#fff', fontSize: 13 }}>
            <option value="전체">전체</option>
            {BOK_LIST.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>검색 (상품코드/SKU)</div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} onBlur={load} placeholder="앞 10자리만 입력해도 OK" />
        </div>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>정렬</div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ width: '100%', padding: 8, background: CLR.panel, border: '1px solid var(--border-strong)', borderRadius: 6, color: '#fff', fontSize: 13 }}>
            <option value="rank">온라인 매출 순위 ↑</option>
            <option value="effect">기대효과 ↓</option>
            <option value="move">이동수량 ↓</option>
            <option value="code">단품코드</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: CLR.muted }}>총 {data?.total?.toLocaleString() ?? '-'}건 · 상위 500건 표시 · 맨 위 합계</div>
        <button onClick={load} disabled={loading} style={{ padding: '6px 14px', background: CLR.grn_fg, color: '#0A141F', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
          {loading ? '조회 중...' : '🔄 새로고침'}
        </button>
      </div>

      <div style={{ background: CLR.card, border: '1px solid var(--border)', borderRadius: 8, overflow: 'auto', maxHeight: 520 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead style={{ position: 'sticky', top: 0, background: CLR.panel, zIndex: 2 }}>
            <tr>{['이미지', '상태', '복종', '상품코드', '단품코드(SKU)', '상품명', '누판율(%)', '주판율(%)', '일평균 판매량', '일평균 매출(만원)', '현 재고량', '현 재고금액(만원)', '내부창고', '🔌항만', '🔌부평', '외부창고', '현 재고주수', '소진예상(일)', '추천이동', '이동후재고', '이동 후 재고주수', '효과(만원)'].map(h => (
              <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: CLR.muted, fontWeight: 700, borderBottom: '1px solid var(--border-strong)', whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {data?.sum && (
              <tr style={{ background: 'rgba(74,227,181,0.1)', fontWeight: 700, borderBottom: '1px solid var(--border-strong)' }}>
                <td></td><td style={{ padding: '8px 6px', color: CLR.grn_fg }}>— 합계 —</td><td></td><td></td>
                <td style={{ padding: '8px 6px', color: CLR.grn_fg }}>{data.total?.toLocaleString()}건</td>
                <td></td><td></td><td></td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{data.sum.daily.toFixed(1)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{data.sum.daily_amt.toFixed(1)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#fff' }}>{data.sum.inv.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: '#fff' }}>{data.sum.inv_amt.toLocaleString()}</td>
                <td></td><td></td><td></td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: CLR.yel_fg }}>{data.sum.ext.toLocaleString()}</td>
                <td></td><td></td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: CLR.grn_fg }}>{data.sum.move.toLocaleString()}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{data.sum.ni.toLocaleString()}</td>
                <td></td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: CLR.grn_fg }}>{data.sum.effect.toLocaleString()}</td>
              </tr>
            )}
            {loading && !data && <tr><td colSpan={22} style={{ padding: 32, textAlign: 'center', color: CLR.muted }}>CSV 로딩 중...</td></tr>}
            {data?.data?.map(r => {
              const st = STATUS_STYLE[r.status];
              const wocColor = r.woc === null ? CLR.muted : r.woc < 1 ? CLR.red_fg : r.woc < 2 ? CLR.yel_fg : CLR.grn_fg;
              const woc2Color = r.woc2 === null ? CLR.muted : r.woc2 < 1 ? CLR.red_fg : r.woc2 < 2 ? CLR.yel_fg : CLR.grn_fg;
              return (
                <tr key={r.code} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 6px' }}>
                    <StyleImg style={r.code10} size={40} />
                  </td>
                  <td style={{ padding: '6px 6px' }}>
                    <span style={{ padding: '2px 8px', background: st.bg, color: st.color, border: `1px solid ${st.color}`, borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {STATUS_ICON[r.status]} {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '6px 6px', color: CLR.muted }}>{r.bok}</td>
                  <td style={{ padding: '6px 6px', color: '#fff', fontFamily: 'monospace' }}>{r.code10}</td>
                  <td style={{ padding: '6px 6px', color: '#fff', fontFamily: 'monospace' }}>{r.code}</td>
                  <td style={{ padding: '6px 6px', color: '#fff' }} title={r.name}>{r.name.length > 22 ? r.name.slice(0, 22) + '…' : r.name}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>{(r.cum_rate * 100).toFixed(1)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>{(r.wk_rate * 100).toFixed(1)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right' }}>{r.daily.toFixed(1)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right' }}>{r.daily_amt.toFixed(1)}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: '#fff' }}>{r.inv.toLocaleString()}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: '#fff' }}>{r.inv_amt.toLocaleString()}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>—</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>—</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>—</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.yel_fg }}>{r.ext.toLocaleString()}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: wocColor, fontWeight: 700 }}>{r.woc === null ? '-' : `${Math.round(r.woc)}주`}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.muted }}>{r.sojin ?? '-'}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: r.move > 0 ? CLR.grn_fg : r.move < 0 ? CLR.red_fg : CLR.muted }}>{r.move.toLocaleString()}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right' }}>{r.ni.toLocaleString()}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: woc2Color }}>{r.woc2 === null ? '-' : `${Math.round(r.woc2)}주`}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', color: CLR.grn_fg }}>{r.effect.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: CLR.muted }}>
        🎨 상태: 🔴 긴급결품(&lt;1주) · 🟡 주의(1~2주) · 🟢 정상(≥2주) | 외부창고=AENS·ADU3·ADQS 실데이터 | 🔌 내부창고·항만·부평=물류 API 연동(9/1) 후 표시
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ padding: 16, background: CLR.card, borderTop: `3px solid ${accent}`, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: CLR.muted }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: CLR.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function StyleImg({ style, size = 36 }: { style: string; size?: number }) {
  // gradient placeholder (사내 CDN 확정 시 URL로 대체)
  const seed = style.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const h1 = seed % 360; const h2 = (h1 + 40) % 360;
  const gradient = `linear-gradient(135deg, hsl(${h1}, 55%, 45%) 0%, hsl(${h2}, 55%, 30%) 100%)`;
  return (
    <div style={{ width: size, height: size * 1.25, borderRadius: 3, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700 }}>
      {style.slice(-4)}
    </div>
  );
}
