import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 인증 없이 접근 가능한 경로
  const publicPaths = ['/login', '/api/auth/login', '/api/health'];
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // /dashboard 및 그 하위 API는 인증 필요
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) {
    const auth = req.cookies.get(AUTH_COOKIE_NAME);
    if (auth?.value !== '1') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, message: '인증 필요' }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
