import { NextResponse } from 'next/server';
import { checkPassword, AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE } from '@/lib/auth';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (typeof password !== 'string') {
      return NextResponse.json({ ok: false, message: '입력 형식 오류' }, { status: 400 });
    }
    if (!checkPassword(password)) {
      return NextResponse.json({ ok: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE_NAME, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e) }, { status: 500 });
  }
}
