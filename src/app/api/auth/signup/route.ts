import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureDb, query } from '@/lib/db';
import { hashPassword, signJwt } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`signup:${ip}`, RATE_LIMITS.SIGNUP);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    await ensureDb();

    const body = await request.json();
    const { email, password, displayName } = body as {
      email?: string;
      password?: string;
      displayName?: string;
    };

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: '이메일, 비밀번호, 이름을 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 중복 이메일 체크
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    // 유저 생성
    await query(
      'INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)',
      [userId, email.toLowerCase(), passwordHash, displayName]
    );

    // "개인 스페이스" 폴더 생성 + user_folders 연결
    const folderId = uuidv4();
    await query(
      `INSERT INTO folders (id, name, color, type) VALUES ($1, $2, $3, $4)`,
      [folderId, '개인 스페이스', '#2eaadc', 'personal']
    );
    await query(
      `INSERT INTO user_folders (user_id, folder_id, role) VALUES ($1, $2, $3)`,
      [userId, folderId, 'owner']
    );

    // JWT 발급
    const token = await signJwt({ userId, email: email.toLowerCase(), displayName });

    const response = NextResponse.json({
      success: true,
      data: { userId, email: email.toLowerCase(), displayName },
    });

    response.cookies.set('nepcon-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Signup Error]', error);
    return NextResponse.json(
      { success: false, error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
