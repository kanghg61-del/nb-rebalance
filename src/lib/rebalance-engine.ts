/**
 * 재배치 엔진 v2.9 (Streamlit rebalance_engine.py 정밀 이식)
 *
 * 핵심 로직 (원본과 완전 동일):
 *   · calcRebalanceGroup: 컬러(단품코드 12자리) 단위 그룹 재배치
 *   · CHANNEL_PRIORITY: IN 저수수료 우선, OUT 역순
 *   · viable: 마이너 채널 제외 (수요 사이즈 수 < 최대의 50%)
 *   · 단품당 1채널만 IN — 1순위 기대효과, 2순위 저수수료
 *   · EHUB 내부재고만 OUT (외부창고 wh_* 제외)
 *   · ch_excl (채널 IN-OUT 제외 규칙)
 *   · 신상(G코드) IN 자동 차단
 */
import type { SkuRow } from './csv-loader';

export const CHANNEL_PRIORITY: Record<string, number> = {
  '공홈': 0, '무신사': 1, '29CM': 2,
};
const RESOLVE_WOC = 1.0;

export type Params = {
  shortage_threshold: number;
  target_woc: number;
  ship_th: number;
  min_move_qty: number;
  min_recv_order: number;
  move_cap_pct: number;
  ch_excl?: Record<string, { in?: string[]; out?: string[] }>;
};

function prio(c: string): number { return CHANNEL_PRIORITY[c] ?? 99; }
export function styleColor(code: string): string { return (code || '').slice(0, 12); }

/**
 * 컬러(12자리) 단위 그룹 재배치 — 스트림릿 calc_rebalance_group 정밀 이식
 * @returns 단품코드 → 채널별 이동량 (+IN / -OUT / 합계 0)
 */
export function calcRebalanceGroup(
  group: SkuRow[], params: Params, channels: readonly string[]
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of group) out[r.단품코드] = Object.fromEntries(channels.map(c => [c, 0]));

  const shortTh = params.shortage_threshold;
  const target = params.target_woc;
  const capPct = params.move_cap_pct ?? 0.5;
  const chExcl = params.ch_excl ?? {};

  // 이랜드몰 신상(G코드) IN 차단 + ch_excl 부분 일치
  function isExcluded(code: string, c: string, dir: 'in' | 'out'): boolean {
    // 이랜드몰 G코드 차단 로직 제거 (뉴발란스는 이랜드몰 없음)
    const pats = chExcl[c]?.[dir];
    return !!pats && pats.some(p => p && code.includes(p));
  }
  const cap = (i: number) => (i > 0 ? Math.floor(capPct * i) : 0);

  // ── 사이즈(SKU)별 결품/잉여 산출 ──
  const shortage: Record<string, Record<string, number>> = {};
  const surplusLeft: Record<string, Record<string, number>> = {};

  for (const d of group) {
    const code = d.단품코드;
    shortage[code] = {}; surplusLeft[code] = {};

    const sh: Record<string, number> = {};
    const su: Record<string, number> = {};
    for (const c of channels) {
      const i = d.inv[c] ?? 0;
      const o = d.ord[c] ?? 0;
      if (o <= 0 && i <= 0) continue;

      const ext = (d.wh[c] ?? 0);
      const iInternal = Math.max(0, i - ext);

      if (o <= 0) {
        const m = Math.min(iInternal, cap(iInternal));
        if (m > 0 && !isExcluded(code, c, 'out')) su[c] = m;
        continue;
      }
      const woc = i / o;
      if (woc <= shortTh) {
        if (o < (params.min_recv_order ?? 4)) continue;
        const needFull = Math.max(0, Math.ceil(target * o - i));
        if (needFull > 0 && !isExcluded(code, c, 'in')) sh[c] = needFull;
      } else if (woc > target) {
        const avail = Math.min(Math.floor((woc - target) * o), iInternal, cap(iInternal));
        if (avail > 0 && !isExcluded(code, c, 'out')) su[c] = avail;
      }
    }
    shortage[code] = sh; surplusLeft[code] = su;
  }

  // ── 마이너 채널 제외 (수요 사이즈 수 < 최대의 50%) ──
  const demandCnt: Record<string, number> = {};
  for (const c of channels) {
    demandCnt[c] = group.filter(g => (g.ord[c] ?? 0) > 0).length;
  }
  const maxDc = Math.max(0, ...Object.values(demandCnt));
  const viable = new Set(channels.filter(c => maxDc > 0 && demandCnt[c] >= 0.5 * maxDc));

  // ── 단품당 1채널만 IN (1순위 기대효과, 2순위 저수수료) ──
  for (const d of group) {
    const code = d.단품코드;
    const sh = shortage[code];
    if (!sh || Object.keys(sh).length === 0) continue;

    const totalAvail = Object.values(surplusLeft[code]).reduce((s, v) => s + v, 0);
    if (totalAvail <= 0) continue;

    type Cand = [string, number, number];
    const candidates: Cand[] = [];
    for (const [ch, needFull] of Object.entries(sh)) {
      if (!viable.has(ch)) continue;
      const g = Math.min(needFull, totalAvail);
      if (g <= 0) continue;
      const i = d.inv[ch] ?? 0;
      const o = d.ord[ch] ?? 0;
      const oldShort = Math.max(0, o - i);
      const newShort = Math.max(0, o - i - g);
      candidates.push([ch, g, oldShort - newShort]);
    }
    if (candidates.length === 0) continue;
    // 1순위: 기대효과 ↓ / 2순위: 저수수료 ↑
    candidates.sort((a, b) => (b[2] - a[2]) || (prio(a[0]) - prio(b[0])));
    const [bestCh, bestG] = candidates[0];

    // OUT 회수: 고수수료(역순)부터 bestCh로 충전
    let need = bestG;
    const sources = Object.keys(surplusLeft[code]).sort((a, b) => prio(b) - prio(a));
    for (const src of sources) {
      if (need <= 0) break;
      const tk = Math.min(surplusLeft[code][src], need);
      if (tk > 0) {
        out[code][src] -= tk;
        out[code][bestCh] += tk;
        surplusLeft[code][src] -= tk;
        need -= tk;
      }
    }
  }

  // ── 비부가 필터 (사이즈별) ──
  for (const d of group) {
    const code = d.단품코드;
    const pos = Object.values(out[code]).filter(v => v > 0).reduce((s, v) => s + v, 0);
    if (pos < (params.min_move_qty ?? 0)) {
      out[code] = Object.fromEntries(channels.map(c => [c, 0]));
    }
  }

  return out;
}

export function calcAfterWoc(sku: SkuRow, moves: Record<string, number>, channels: readonly string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const c of channels) {
    const newInv = (sku.inv[c] ?? 0) + (moves[c] ?? 0);
    const o = sku.ord[c] ?? 0;
    out[c] = o > 0 ? Math.round((newInv / o) * 10) / 10 : null;
  }
  return out;
}

export function calcExpectedRevenue(sku: SkuRow, moves: Record<string, number>, channels: readonly string[]): number {
  let rev = 0;
  const price = sku.정상가;
  for (const c of channels) {
    const inv = sku.inv[c] ?? 0;
    const o = sku.ord[c] ?? 0;
    const newInv = inv + (moves[c] ?? 0);
    const oldShort = Math.max(0, o - inv);
    const newShort = Math.max(0, o - newInv);
    rev += (oldShort - newShort) * price;
  }
  return Math.round(rev);
}

// ── 시나리오 프리셋 (Streamlit SCENARIOS 매칭) ──
export const SCENARIOS: Record<string, Params & { desc: string }> = {
  '🛡️ 기본': {
    desc: '결품 기준 1주 미만 → 목표 2주 확보. 회전(온라인 3채널 잉여→결품)으로 보충. 이동 상한: 각 채널 현재고의 30% (스파오 6/19 미팅 합의 — 보수 운영)',
    shortage_threshold: 1.0, target_woc: 2.0, ship_th: 0.90,
    min_move_qty: 0, min_recv_order: 4, move_cap_pct: 0.30,
  },
  '🎛️ 임의': {
    desc: '상단 슬라이더로 직접 조정 (이동 상한 % 포함). 기본값 30%',
    shortage_threshold: 1.0, target_woc: 2.0, ship_th: 0.90,
    min_move_qty: 0, min_recv_order: 4, move_cap_pct: 0.30,
  },
};

export type ScenarioKey = keyof typeof SCENARIOS;

/**
 * 전체 시나리오 실행 — 컬러(12자리) 단위 그룹핑 후 calcRebalanceGroup 호출
 */
export type Result = {
  code: string;
  data: SkuRow;
  moves: Record<string, number>;
  after: Record<string, number | null>;
  revenue: number;
};

export function runScenario(
  rows: SkuRow[], params: Params, channels: readonly string[]
): Result[] {
  // 12자리 컬러로 그룹핑
  const groups: Record<string, SkuRow[]> = {};
  for (const r of rows) {
    const k = styleColor(r.단품코드);
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const results: Result[] = [];
  for (const g of Object.values(groups)) {
    const moveMap = calcRebalanceGroup(g, params, channels);
    for (const r of g) {
      const moves = moveMap[r.단품코드] ?? Object.fromEntries(channels.map(c => [c, 0]));
      results.push({
        code: r.단품코드, data: r, moves,
        after: calcAfterWoc(r, moves, channels),
        revenue: calcExpectedRevenue(r, moves, channels),
      });
    }
  }

  return results;
}
