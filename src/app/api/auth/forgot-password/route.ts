import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureDb, query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { sendEmail, generateVerificationCode, getPasswordResetEmailHtml } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`password_reset:${ip}`, RATE_LIMITS.PASSWORD_RESET);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    await ensureDb();

    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { success: false, error: '이메일을 입력해주세요.' },
        { status: 400 }
      );
    }

    const userResult = await query(
      'SELECT id, display_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // 보안상 이메일 존재 여부와 관계없이 같은 응답
    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { message: '해당 이메일로 인증 코드를 발송했습니다.' },
      });
    }

    const user = userResult.rows[0];
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 기존 미사용 코드 무효화
    await query(
      `UPDATE email_verifications SET used = TRUE WHERE email = $1 AND type = 'password_reset' AND used = FALSE`,
      [email.toLowerCase()]
    );

    // 새 인증 코드 저장
    await query(
      `INSERT INTO email_verifications (id, email, code, type, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), email.toLowerCase(), code, 'password_reset', expiresAt]
    );

    // 이메일 발송
    const html = getPasswordResetEmailHtml(code, user.display_name);
    await sendEmail({
      to: email.toLowerCase(),
      subject: '[캘린더끝판왕] 비밀번호 재설정 인증 코드',
      html,
    });

    return NextResponse.json({
      success: true,
      data: { message: '해당 이메일로 인증 코드를 발송했습니다.' },
    });
  } catch (error) {
    console.error('[ForgotPassword Error]', error);
    return NextResponse.json(
      { success: false, error: '인증 코드 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
