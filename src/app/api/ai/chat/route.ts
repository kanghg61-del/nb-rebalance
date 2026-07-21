import { NextRequest, NextResponse } from 'next/server';
import { loadSkuData, CHANNELS } from '@/lib/csv-loader';
import { runScenario, SCENARIOS } from '@/lib/rebalance-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Gemini Flash 챗봇 - 사내 재고 데이터 컨텍스트 (동적 필터링) 로 답변
 * 스트림릿 _aica_answer 매칭 — 채널별 결품 TOP5 + 회전 기대매출 TOP5
 */
export async function POST(req: NextRequest) {
  try {
    const key = process.env.GEMINI_API_KEY;
    const body = await req.json();
    const question = (body.question ?? body.message ?? '').trim();
    if (!question) return NextResponse.json({ status: 'error', message: '질문이 없습니다.' }, { status: 400 });

    // 컨텍스트 자동 조립 (질문 키워드 기반 필터)
    let ctx = '';
    try {
      const { rows: skus } = await loadSkuData();
      const preset = SCENARIOS['🛡️ 기본'];
      const results = runScenario(skus, { ...preset, ch_excl: {} }, CHANNELS);

      // 채널별 결품 TOP5
      const shortByCh: Record<string, any[]> = {};
      for (const c of CHANNELS) shortByCh[c] = [];
      for (const r of skus) {
        for (const c of CHANNELS) {
          const o = r.ord[c] ?? 0, i = r.inv[c] ?? 0;
          if (o <= 0) continue;
          const w = i / o;
          if (w < 1) shortByCh[c].push({ code: r.단품코드, name: r.단품명, woc: w, need: Math.max(0, o - i), price: r.정상가 });
        }
      }
      for (const c of CHANNELS) {
        shortByCh[c] = shortByCh[c].sort((a, b) => (b.need * b.price) - (a.need * a.price)).slice(0, 5);
      }

      // 채널별 회전 기대매출 TOP5
      const revByCh: Record<string, any[]> = {};
      for (const c of CHANNELS) revByCh[c] = [];
      for (const r of results) {
        for (const c of CHANNELS) {
          const mv = r.moves[c] ?? 0;
          if (mv <= 0) continue;
          const bef = Math.max(0, (r.data.ord[c] ?? 0) - (r.data.inv[c] ?? 0));
          const aft = Math.max(0, (r.data.ord[c] ?? 0) - ((r.data.inv[c] ?? 0) + mv));
          const rev = (bef - aft) * r.data.정상가;
          if (rev > 0) revByCh[c].push({ code: r.code, name: r.data.단품명, ch: c, in_qty: mv, rev });
        }
      }
      for (const c of CHANNELS) revByCh[c] = revByCh[c].sort((a, b) => b.rev - a.rev).slice(0, 5);

      // 채널 이름 매칭
      const q = question.toLowerCase();
      const focusCh = CHANNELS.filter(c => q.includes(c.toLowerCase()) || q.includes(c));
      const showChs = focusCh.length > 0 ? focusCh : CHANNELS;

      let totalUnits = 0, totalMove = 0, totalRev = 0;
      for (const r of results) {
        for (const c of CHANNELS) {
          totalUnits += r.data.inv[c] ?? 0;
          const mv = r.moves[c] ?? 0;
          if (mv > 0) totalMove += mv;
        }
        totalRev += r.revenue;
      }

      ctx = `[전체 요약]\n총 SKU: ${results.length.toLocaleString()}건 · 총 재고: ${totalUnits.toLocaleString()}장 · 이동 발생: ${results.filter(r => Object.values(r.moves).some((v: any) => v > 0)).length.toLocaleString()}건 · 총 이동량: ${totalMove.toLocaleString()}장 · 기대 회수매출: ${(totalRev/1e8).toFixed(2)}억\n\n`;
      for (const c of showChs) {
        ctx += `\n[${c} 채널]\n`;
        ctx += `- 결품 TOP5:\n`;
        for (const s of shortByCh[c].slice(0, 5)) {
          ctx += `  · ${s.code} ${s.name.slice(0, 20)} — WOC ${s.woc.toFixed(1)}주 · 필요 ${s.need}장 · 손실 ${Math.round(s.need * s.price / 10000)}만원\n`;
        }
        ctx += `- 회전 기대매출 TOP5:\n`;
        for (const s of revByCh[c].slice(0, 5)) {
          ctx += `  · ${s.code} ${s.name.slice(0, 20)} — IN +${s.in_qty} · 기대 ${Math.round(s.rev / 10000)}만원\n`;
        }
      }
    } catch (e) {
      ctx = `[컨텍스트 로드 실패: ${String(e).slice(0, 100)}]`;
    }

    if (!key) {
      return NextResponse.json({
        status: 'fallback', message: 'GEMINI_API_KEY 미설정',
        answer: `⚠️ Gemini API 키가 등록되지 않아 컨텍스트만 반환합니다.\n\n${ctx.slice(0, 2000)}`,
      });
    }

    const MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
    for (const model of MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const bodyOut = {
          contents: [{
            parts: [{
              text: `당신은 뉴발란스 온라인 재고관리 담당 AI입니다. 아래 실시간 컨텍스트를 기반으로 질문에 간결하고 정확하게 답하세요. 숫자는 반드시 컨텍스트 기준 사용.\n\n[실시간 컨텍스트]\n${ctx}\n\n[질문]\n${question}`,
            }],
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        };
        const res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyOut), signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) {
          const j: any = await res.json();
          const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(응답 파싱 실패)';
          return NextResponse.json({ status: 'ok', model, answer });
        }
      } catch { /* try next */ }
    }
    return NextResponse.json({ status: 'error', message: '모든 Gemini 모델 호출 실패', answer: ctx.slice(0, 2000) });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
