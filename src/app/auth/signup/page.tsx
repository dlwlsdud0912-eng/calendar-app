'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreed) {
      setError('이용약관에 동의해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || '회원가입에 실패했습니다.');
        return;
      }

      router.push('/calendar');
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#37352f',
    marginBottom: '6px',
  };

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
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#37352f',
            margin: '0 0 8px 0',
          }}>
            회원가입
          </h1>
          <p style={{ color: '#9b9a97', fontSize: '14px', margin: 0 }}>
            캘린더끝판왕 계정을 만드세요
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>이름</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="홍길동"
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
              onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>이메일</label>
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

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4자 이상"
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
              onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>비밀번호 확인</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 재입력"
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = '#2eaadc'}
              onBlur={(e) => e.target.style.borderColor = '#e3e2e0'}
            />
          </div>

          <div style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#2eaadc' }}
            />
            <label htmlFor="agree" style={{ fontSize: '13px', color: '#6b7280' }}>
              <Link href="/terms" target="_blank" style={{ color: '#2eaadc', textDecoration: 'underline' }}>
                이용약관
              </Link>
              에 동의합니다
            </label>
          </div>

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
              transition: 'background 0.2s',
            }}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
        }}>
          <Link href="/auth/login" style={{ color: '#2eaadc', textDecoration: 'none' }}>
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
