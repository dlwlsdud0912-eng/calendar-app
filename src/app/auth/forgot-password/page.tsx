'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e3e2e0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || '인증 코드 발송에 실패했습니다.');
        return;
      }

      setStep(2);
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('인증 코드 6자리를 입력해주세요.');
      return;
    }

    setStep(3);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
        return;
      }

      setSuccessMsg('비밀번호가 변경되었습니다. 로그인해주세요.');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['이메일 입력', '인증 코드', '새 비밀번호'];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f7f5',
      fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: '40px 32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#37352f',
            margin: '0 0 8px 0',
          }}>
            비밀번호 찾기
          </h1>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '28px',
        }}>
          {stepLabels.map((label, i) => {
            const stepNum = (i + 1) as Step;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isActive ? '#2eaadc' : isDone ? '#0f7b6c' : '#e3e2e0',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  {isDone ? '\u2713' : stepNum}
                </div>
                <span style={{
                  fontSize: '12px',
                  color: isActive ? '#37352f' : '#9b9a97',
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {label}
                </span>
                {i < 2 && (
                  <div style={{
                    width: '20px',
                    height: '1px',
                    background: isDone ? '#0f7b6c' : '#e3e2e0',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {successMsg && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#16a34a',
            textAlign: 'center',
          }}>
            {successMsg}
          </div>
        )}

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Email input */}
        {step === 1 && (
          <form onSubmit={handleRequestCode}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#37352f',
                marginBottom: '6px',
              }}>
                가입한 이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
                onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#93d5ed' : '#2eaadc',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '발송 중...' : '인증 코드 받기'}
            </button>
          </form>
        )}

        {/* Step 2: Code input */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', textAlign: 'center' }}>
              <strong>{email}</strong>으로 발송된 6자리 코드를 입력하세요.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: '24px',
                  letterSpacing: '8px',
                  fontWeight: 600,
                }}
                onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
                onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                background: '#2eaadc',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              확인
            </button>
          </form>
        )}

        {/* Step 3: New password */}
        {step === 3 && !successMsg && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#37352f',
                marginBottom: '6px',
              }}>
                새 비밀번호
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="4자 이상"
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
                onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#37352f',
                marginBottom: '6px',
              }}>
                새 비밀번호 확인
              </label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                required
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
                onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#93d5ed' : '#2eaadc',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
        }}>
          <Link href="/auth/login" style={{ color: '#9b9a97', textDecoration: 'none', fontSize: '13px' }}>
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
