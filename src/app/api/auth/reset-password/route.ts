import { NextResponse } from 'next/server';
import { ensureDb, query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    await ensureDb();

    const ip = getClientIp(request);
    const rl = checkRateLimit(`reset_password:${ip}`, RATE_LIMITS.PASSWORD_RESET);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
    }

    const body = await request.json();
    const { email, code, newPassword } = body as {
      email?: string;
      code?: string;
      newPassword?: string;
    };

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { success: false, error: '이메일, 인증 코드, 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 인증 코드 확인
    const verResult = await query(
      `SELECT id, expires_at FROM email_verifications
       WHERE email = $1 AND code = $2 AND type = 'password_reset' AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), code]
    );

    if (verResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 인증 코드입니다.' },
        { status: 400 }
      );
    }

    const verification = verResult.rows[0];
    if (new Date(verification.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '인증 코드가 만료되었습니다. 다시 요청해주세요.' },
        { status: 400 }
      );
    }

    // 비밀번호 변경
    const passwordHash = await hashPassword(newPassword);
    const updateResult = await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email.toLowerCase()]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '해당 이메일의 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 인증 코드 사용 처리
    await query(
      'UPDATE email_verifications SET used = TRUE WHERE id = $1',
      [verification.id]
    );

    return NextResponse.json({
      success: true,
      data: { message: '비밀번호가 성공적으로 변경되었습니다.' },
    });
  } catch (error) {
    console.error('[ResetPassword Error]', error);
    return NextResponse.json(
      { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
