import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'reba-nextjs-full', version: '0.1.0' });
}
