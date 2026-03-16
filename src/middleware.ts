import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/auth', '/terms', '/api/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 파일, _next 등은 무시
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 공개 경로는 인증 불필요
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 인증 필요 경로: nepcon-token 쿠키 확인
  const token = request.cookies.get('nepcon-token')?.value;

  if (!token) {
    // API 요청은 401 반환
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    // 페이지 요청은 로그인으로 리다이렉트
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
