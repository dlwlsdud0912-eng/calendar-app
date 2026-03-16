import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt, extractToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = extractToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const payload = await verifyJwt(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: payload.userId,
        email: payload.email,
        displayName: payload.displayName,
      },
    });
  } catch (error) {
    console.error('[Me Error]', error);
    return NextResponse.json(
      { success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
