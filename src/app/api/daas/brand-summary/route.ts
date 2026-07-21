import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await query<{ brand: string; saleamt: string; ordqty: string }>(
      `SELECT
         COALESCE(m."/bic/zbrand", '(NULL)') AS brand,
         SUM(t.saleamt)::text AS saleamt,
         SUM(t.sale)::text AS ordqty
       FROM fpw.total_mart t
       LEFT JOIN ods.fpw_pmaterial m ON m.material = t.material
       WHERE t.calday BETWEEN $1 AND $2
       GROUP BY m."/bic/zbrand"
       ORDER BY SUM(t.saleamt) DESC NULLS LAST
       LIMIT 20`,
      ['20260616', '20260716'],
    );
    return NextResponse.json({ status: 'ok', count: rows.length, data: rows });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
