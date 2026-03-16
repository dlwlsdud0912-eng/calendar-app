/**
 * 이메일 발송 유틸리티 (Nodemailer 없이 fetch 기반 SMTP 또는 외부 서비스)
 * 실제 프로덕션에서는 Resend, SendGrid, AWS SES 등 사용 권장
 * 여기서는 간단한 인터페이스만 정의
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  // Resend API 사용 (환경변수 RESEND_API_KEY가 있을 때)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || 'noreply@calendar-king.com',
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Email] Resend 발송 실패:', e);
      return false;
    }
  }

  // 환경변수 미설정 시 콘솔 로깅 (개발용)
  console.log('[Email] 발송 (개발모드):', {
    to: options.to,
    subject: options.subject,
  });
  console.log('[Email] HTML 내용:', options.html);
  return true;
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getPasswordResetEmailHtml(code: string, displayName: string): string {
  return `
    <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px; font-family: 'Noto Sans KR', -apple-system, sans-serif;">
      <h2 style="color: #37352f; margin-bottom: 24px;">비밀번호 재설정</h2>
      <p style="color: #6b7280; line-height: 1.6;">
        안녕하세요, ${displayName}님.<br/>
        비밀번호 재설정을 위한 인증 코드입니다.
      </p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2eaadc;">${code}</span>
      </div>
      <p style="color: #9ca3af; font-size: 13px;">
        이 코드는 10분간 유효합니다.<br/>
        본인이 요청하지 않았다면 이 이메일을 무시해주세요.
      </p>
    </div>
  `;
}
