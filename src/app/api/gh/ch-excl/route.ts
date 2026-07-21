import { NextResponse } from 'next/server';
import embed from '@/data/ch_excl_embed.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // GH 파일 우선 시도
    const url = `https://raw.githubusercontent.com/kanghg61-del/nb-rebalance/main/data/ch_excl.json?ts=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
    if (res.ok) {
      const j = await res.json();
      const rows = Array.isArray(j) ? j : (Array.isArray(j.ch_excl_rows) ? j.ch_excl_rows : []);
      if (rows.length > 0) {
        return NextResponse.json({ status: 'ok', source: 'github', data: rows.map(normalize) });
      }
    }
  } catch {}
  // Fallback: embed (스트림릿 _EMBEDDED_CH_EXCL_ROWS 355건)
  return NextResponse.json({
    status: 'fallback',
    source: `embed (스트림릿 원본 ${embed.total}건)`,
    data: embed.rows.map(normalize),
    by_channel: embed.by_channel,
  });
}

function normalize(r: any) {
  return {
    style: r['스타일'] ?? r.style ?? '',
    channel: r['채널'] ?? r.channel ?? '',
    direction: (r['방향'] ?? r.direction ?? '').toUpperCase(),
    from: r['시작일'] ?? r.from ?? '',
    to: r['종료일'] ?? r.to ?? '',
    note: r['메모'] ?? r.note ?? '',
  };
}
