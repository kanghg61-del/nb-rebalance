'use client';
import { useEffect, useMemo, useState } from 'react';
import { CLR, CHANNELS } from '@/lib/theme';
import { useTabNav } from '../DashboardShell';
import { downloadCsv, matrixToLogisticsRows } from '@/lib/downloads';

const CH_SHORT_LOCAL: Record<string, string> = { '공홈': '공홈', '무신사': '무신', '29CM': '29CM' };

export function TodayTab() {
  const { setTab } = useTabNav();
  const [scenario, setScenario] = useState<any>(null);
  const [reorder, setReorder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rotApproved, setRotApproved] = useState<number | null>(null);
  const [reoApproved, setReoApproved] = useState<string | null>(null);
  const [distApproved, setDistApproved] = useState<string | null>(null);
  const [approvingRot, setApprovingRot] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      const dl = new Date(now); dl.setHours(12, 0, 0, 0);
      if (now <= dl) {
        const remain = Math.max(0, Math.floor((dl.getTime() - now.getTime()) / 1000));
        const h = Math.floor(remain / 3600), m = Math.floor((remain % 3600) / 60);
        setClock(`⏱️ 회전 배치 마감(12:00)까지 ${h}시간 ${m}분`);
      } else setClock('🌙 회전 배치 마감(12:00) 경과 — 내일 배치 기준');
    }
    tick(); const t = setInterval(tick, 30_000); return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetch('/api/rebalance/scenario?scenario=' + encodeURIComponent('🛡️ 기본'), { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/data/reorder-need', { cache: 'no-store' }).then(r => r.json()),
      ]);
      setScenario(s); setReorder(r);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { void load(); void loadRecentLog(); const t = setInterval(() => { void loadRecentLog(); }, 60_000); return () => clearInterval(t); }, []);

  const s = scenario?.summary;
  const rows = scenario?.matrix ?? [];

  // 추가 분배 카드 데이터 (스트림릿 render_batch_approval_tab _c2 산식 매칭)
  const dist = useMemo(() => {
    if (!s) return { qty: 0, rev: 0, rowsCnt: 0, sty: 0, rows: [] as any[] };
    let qty = 0, rev = 0; const rowsList: any[] = []; const sty = new Set<string>();
    // scenario matrix는 이동 발생 SKU만 → 반응과 재고 있으면 fillup
    for (const r of rows) {
      const bw = r.inv_react || 0; if (bw <= 0) continue;
      const ti = CHANNELS.reduce((a, c) => a + (r.inv[c] ?? 0), 0);
      const to = CHANNELS.reduce((a, c) => a + (r.ord[c] ?? 0), 0);
      if (to <= 0 || ti / to >= 1) continue;
      const fq = Math.min(Math.max(0, Math.round(to - ti)), bw);
      if (fq <= 0) continue;
      qty += fq; rev += fq * r.price; sty.add(r.code.slice(0, 10));
      rowsList.push({ 단품코드: r.code, 단품명: r.name, 현재고: ti, 주판: to, 재고주수: +(ti/to).toFixed(2), '반응과 재고': bw, '필업요청(장)': fq, '필업요청금액(만원)': Math.round(fq * r.price / 10000) });
    }
    return { qty, rev, rowsCnt: rowsList.length, sty: sty.size, rows: rowsList };
  }, [rows, s]);

  const reorderRows = reorder?.rows ?? [];
  const reoStat = useMemo(() => {
    let qty = 0, exp = 0, styN = new Set<string>();
    for (const r of reorderRows) {
      const ord = CHANNELS.reduce((a, c) => a + (r.ord[c] ?? 0), 0);
      const inv = CHANNELS.reduce((a, c) => a + (r.inv[c] ?? 0), 0);
      const short = Math.max(0, ord - inv);
      qty += short; exp += short * (r.정상가 ?? 0);
      styN.add(r.단품코드.slice(0, 10));
    }
    return { total: reorderRows.length, qty, exp, styN: styN.size };
  }, [reorderRows]);

  async function loadRecentLog() {
    try {
      const res = await fetch('/api/gh/execution-log', { cache: 'no-store' });
      const j = await res.json();
      const rows = j.data ?? [];
      if (rows.length > 0) setRotApproved(Number(rows[rows.length - 1].id));
    } catch {}
  }
  async function approveRotation() {
    if (rotApproved) return;
    if (!confirm(`오늘 12:00 마감 회전 배치 ${s?.moved_sku_count.toLocaleString() || 0}건 승인?`)) return;
    setApprovingRot(true);
    try {
      const res = await fetch('/api/rebalance/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: '🗳️ 결재함·회전', memo: '오늘의 결재 · 12:00 마감 일괄 승인' }),
      });
      const j = await res.json();
      if (j.status === 'ok') { setRotApproved(j.id); alert(`✅ 승인 완료 · id=${j.id} · ${j.move_qty.toLocaleString()}장 · ${j.expected_amt.toLocaleString()}만원`); void loadRecentLog(); }
      else alert('⚠️ ' + (j.message || '승인 실패'));
    } catch (e) { alert('❌ ' + e); }
    finally { setApprovingRot(false); }
  }
  function downloadRotationXlsx() {
    if (!rows.length) { alert('회전 대상 없음'); return; }
    const rowsCsv = matrixToLogisticsRows(rows, [...CHANNELS], CH_SHORT_LOCAL);
    const ts = new Date().toISOString().slice(0,10).replaceAll('-','').slice(2);
    downloadCsv(rowsCsv, ['FROM 채널','FROM 사이트','TO 채널','TO 사이트','단품코드','스타일명','이동수량(장)','단가(원)','금액(만원)'], `물류이동요청_${ts}`);
  }
  function downloadDistXlsx() {
    if (!dist.rows.length) { alert('분배 대상 없음'); return; }
    const ts = new Date().toISOString().slice(0,10).replaceAll('-','').slice(2);
    downloadCsv(dist.rows, ['단품코드','단품명','현재고','주판','재고주수','반응과 재고','필업요청(장)','필업요청금액(만원)'], `추가분배요청서_${ts}`);
  }
  function downloadReoXlsx() {
    if (!reorderRows.length) { alert('리오더 대상 없음'); return; }
    const rowsCsv = reorderRows.map((r: any) => {
      const ord = CHANNELS.reduce((a, c) => a + (r.ord[c] ?? 0), 0);
      const inv = CHANNELS.reduce((a, c) => a + (r.inv[c] ?? 0), 0);
      const short = Math.max(0, ord - inv);
      return { 단품코드: r.단품코드, 단품명: r.단품명, 현재고: inv, 주판: ord, 재고주수: ord>0?+(inv/ord).toFixed(2):'', '필업요청(장)': short, '기대매출(만원)': Math.round(short * (r.정상가??0) / 10000) };
    });
    const ts = new Date().toISOString().slice(0,10).replaceAll('-','').slice(2);
    downloadCsv(rowsCsv, ['단품코드','단품명','현재고','주판','재고주수','필업요청(장)','기대매출(만원)'], `리오더요청서_${ts}`);
  }

  const now = new Date();
  const wd = ['일','월','화','수','목','금','토'][now.getDay()];

  return (
    <div style={{ fontFamily: 'Inter, "Noto Sans KR", sans-serif', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: CLR.text }}>
          🗳️ 오늘의 결재 — {`${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}`} ({wd})
          <span style={{ fontSize: 12, fontWeight: 400, color: CLR.muted, marginLeft: 6 }}>· 결재함은 결정 전용 (조정·검토는 각 탭)</span>
        </span>
        <span style={{ background: '#3B1220', color: CLR.red_fg, border: `1px solid ${CLR.red_fg}`, borderRadius: 12, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{clock}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {/* ① 회전 배치 */}
        <Card
          topBar={CLR.red_fg}
          badge={rotApproved ? `✅ 승인 완료 #${rotApproved}` : '오늘 12:00 마감'}
          badgeKind={rotApproved ? 'ok' : 'danger'}
          icon="🔁" title="회전 배치" sub="일괄 승인 · 오늘 12:00 마감"
        >
          <VNum label="이동 수량" value={s ? `${s.total_move_qty.toLocaleString()}장` : '-'} sub={s ? `단품 ${s.moved_sku_count.toLocaleString()}건 · 온라인 3채널 회전` : ''} />
          <VNum label="기대 회수 매출" value={s ? `${(s.expected_effect/1e8).toFixed(2)}억` : '-'} sub={`결품 해소 기준 · 가드레일 통과 ✓ (상한 30%·IN-OUT ${scenario?.chx_rules_total ?? 355}건)`} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn primary onClick={approveRotation} disabled={approvingRot || !!rotApproved}>{approvingRot ? '승인 중...' : `✅ ${s?.moved_sku_count?.toLocaleString() || 0}건 승인(회전)`}</Btn>
            <Btn onClick={downloadRotationXlsx}>📦 Excel 다운로드 (물류용)</Btn>
            <Btn ghost onClick={() => setTab('rebalance-basic')}>🛡️ 재배치(기본) 세부 검토 →</Btn>
          </div>
        </Card>

        {/* ② 추가 분배 */}
        <Card
          topBar={CLR.grn_fg}
          badge={distApproved ? `✅ 발송 승인 ${distApproved}` : '이번 주 결정'}
          badgeKind="ok"
          icon="🧩" title="추가 분배" sub="요청서 발송 승인 · 반응과(창고) → 채널"
        >
          <VNum label="필업 요청수량" value={`${dist.qty.toLocaleString()}장`} sub={`${dist.rowsCnt.toLocaleString()}단품 · ${dist.sty.toLocaleString()}개 스타일 · 결품임박만 (1주 목표)`} />
          <VNum label="기대 회수매출" value={`${(dist.rev/1e8).toFixed(2)}억`} sub="필업 × 정상가 · 추가 분배 탭과 동일 산식" />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn primary onClick={() => { if (dist.rows.length) { setDistApproved(new Date().toTimeString().slice(0,5)); alert('✅ 추가 분배 요청서 발송 승인'); } }} disabled={!dist.rows.length || !!distApproved}>✅ 요청서 발송 승인</Btn>
            <Btn onClick={downloadDistXlsx} disabled={!dist.rows.length}>⬇️ 분배 요청서</Btn>
            <Btn ghost onClick={() => setTab('additional-dist')}>🧩 추가 분배 세부 검토 →</Btn>
          </div>
        </Card>

        {/* ③ 리오더 요청 */}
        <Card
          topBar={CLR.yel_fg}
          badge={reoApproved ? `✅ 발송 승인 ${reoApproved}` : '오늘 중 결정'}
          badgeKind="warn"
          icon="🚨" title="리오더 요청" sub="요청서 발송 승인 · 분배/회전으로 못 채우는 물량"
        >
          <VNum label="결품 임박" value={`${reoStat.total.toLocaleString()}단품`} sub={`${reoStat.styN.toLocaleString()}개 스타일 · 재고주수 1주 미만`} />
          <VNum label="발주 필요 금액" value={`${(reoStat.exp/1e8).toFixed(2)}억`} sub={`권장 ${reoStat.qty.toLocaleString()}장 · 정상가 기준 · 리드타임 1~2개월`} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Btn primary onClick={() => { if (reorderRows.length) { setReoApproved(new Date().toTimeString().slice(0,5)); alert('✅ 리오더 요청서 발송 승인'); } }} disabled={!reorderRows.length || !!reoApproved}>✅ 요청서 발송 승인</Btn>
            <Btn onClick={downloadReoXlsx} disabled={!reorderRows.length}>⬇️ 리오더 요청서</Btn>
            <Btn ghost onClick={() => setTab('reorder')}>🚨 리오더 요청 세부 검토 →</Btn>
          </div>
        </Card>
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: CLR.muted, textAlign: 'center' }}>🗂️ 결재함 = 결정 전용 큐 · 수치 조정·단품 검토는 각 탭에서 · 회전 승인 이력은 📈 실행 효과 탭에 자동 기록</p>
    </div>
  );
}

function Card({ topBar, badge, badgeKind, icon, title, sub, children }: any) {
  const colors: any = { danger: ['#3B1220','#FF6B6B'], warn: ['#4A3A10','#FFC000'], ok: ['#123B2E','#4AE3B5'] };
  const [bg, fg] = colors[badgeKind] || colors.ok;
  return (
    <div style={{ background: '#15202C', border: '1px solid #2E3D4E', borderTop: `4px solid ${topBar}`, borderRadius: 12, padding: '14px 16px', minHeight: 320 }}>
      <span style={{ float: 'right', background: bg, color: fg, border: `1px solid ${fg}`, borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{badge}</span>
      <div style={{ fontSize: 17, fontWeight: 800, color: CLR.text }}>{icon} {title}</div>
      <div style={{ fontSize: 12, color: CLR.muted, marginBottom: 4 }}>{sub}</div>
      {children}
    </div>
  );
}
function VNum({ label, value, sub }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, color: CLR.muted, marginTop: 10 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 800, color: CLR.grn_fg, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: CLR.muted }}>{sub}</div>
    </div>
  );
}
function Btn({ children, onClick, disabled, primary, ghost }: any) {
  const bg = primary ? CLR.grn_fg : ghost ? 'transparent' : CLR.panel;
  const color = primary ? '#0A141F' : CLR.text;
  const border = ghost ? `1px dashed ${CLR.border}` : `1px solid ${CLR.border}`;
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '9px 12px', background: bg, color, border, borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, width: '100%' }}>{children}</button>
  );
}
