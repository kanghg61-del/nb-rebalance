import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await query<{ plant: string; saleamt: string }>(
      `SELECT plant, SUM(saleamt)::text AS saleamt
       FROM fpw.total_mart
       WHERE calday BETWEEN $1 AND $2
       GROUP BY plant
       ORDER BY SUM(saleamt) DESC
       LIMIT 10`,
      ['20260616', '20260716'],
    );
    return NextResponse.json({ status: 'ok', count: rows.length, data: rows });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
