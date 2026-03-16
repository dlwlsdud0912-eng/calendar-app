'use client';

import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  const sectionStyle: React.CSSProperties = {
    marginBottom: '28px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: '#37352f',
    marginBottom: '8px',
  };

  const textStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.8,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f7f7f5',
      fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: '48px 40px',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: '#9b9a97',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '0',
            marginBottom: '24px',
          }}
        >
          &larr; 뒤로가기
        </button>

        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#37352f',
          marginBottom: '8px',
        }}>
          이용약관
        </h1>
        <p style={{ color: '#9b9a97', fontSize: '13px', marginBottom: '36px' }}>
          최종 수정일: 2025년 1월 1일
        </p>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제1조 (목적)</h2>
          <p style={textStyle}>
            본 약관은 캘린더끝판왕(이하 &quot;서비스&quot;)이 제공하는 일정 관리 서비스의 이용 조건 및 절차,
            이용자와 서비스 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제2조 (정의)</h2>
          <p style={textStyle}>
            1. &quot;서비스&quot;란 캘린더끝판왕이 제공하는 웹 기반 일정 관리, 고객 관리, 매출 분석 등의 온라인 서비스를 말합니다.<br />
            2. &quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.<br />
            3. &quot;회원&quot;이란 서비스에 개인정보를 제공하여 회원등록을 한 자를 말합니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제3조 (약관의 효력 및 변경)</h2>
          <p style={textStyle}>
            1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.<br />
            2. 서비스는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위에서 약관을 변경할 수 있습니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제4조 (이용계약의 체결)</h2>
          <p style={textStyle}>
            1. 이용계약은 이용자가 약관에 동의하고 회원가입 신청을 하면, 서비스가 이를 승낙함으로써 체결됩니다.<br />
            2. 서비스는 다음 각 호에 해당하는 신청에 대하여 승낙하지 않을 수 있습니다.<br />
            &nbsp;&nbsp;- 실명이 아니거나 타인의 명의를 이용한 경우<br />
            &nbsp;&nbsp;- 허위 정보를 기재하거나 필수 사항을 누락한 경우
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제5조 (개인정보 보호)</h2>
          <p style={textStyle}>
            1. 서비스는 이용자의 개인정보를 관련 법령에 따라 보호하며, 개인정보의 보호 및 사용에 대해서는 별도의 개인정보처리방침에 따릅니다.<br />
            2. 서비스는 이용자의 개인정보를 본인의 동의 없이 제3자에게 제공하지 않습니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제6조 (이용자의 의무)</h2>
          <p style={textStyle}>
            1. 이용자는 서비스 이용 시 관련 법령 및 본 약관의 규정을 준수해야 합니다.<br />
            2. 이용자는 다음 행위를 하여서는 안 됩니다.<br />
            &nbsp;&nbsp;- 타인의 정보 도용<br />
            &nbsp;&nbsp;- 서비스에 게시된 정보의 무단 변경<br />
            &nbsp;&nbsp;- 서비스의 안정적 운영을 방해하는 행위
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제7조 (서비스의 제공 및 변경)</h2>
          <p style={textStyle}>
            1. 서비스는 이용자에게 일정 관리, 고객 관리, 데이터 분석 등의 기능을 제공합니다.<br />
            2. 서비스의 내용은 기술적, 운영적 필요에 따라 변경될 수 있으며, 변경 시 사전에 공지합니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제8조 (서비스의 중단)</h2>
          <p style={textStyle}>
            1. 서비스는 시스템 점검, 장비 교체, 천재지변 등 불가피한 사유 발생 시 서비스 제공을 일시적으로 중단할 수 있습니다.<br />
            2. 서비스 중단 시 사전에 이용자에게 공지합니다. 다만, 불가피한 경우 사후에 공지할 수 있습니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제9조 (면책조항)</h2>
          <p style={textStyle}>
            1. 서비스는 천재지변, 전쟁 등 불가항력으로 인한 서비스 제공 불능에 대해 책임을 지지 않습니다.<br />
            2. 서비스는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.<br />
            3. 서비스는 이용자가 게재한 정보의 신뢰도, 정확성 등에 대해 책임을 지지 않습니다.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={titleStyle}>제10조 (분쟁 해결)</h2>
          <p style={textStyle}>
            1. 서비스와 이용자 간에 발생한 분쟁에 대해 쌍방은 원만한 해결을 위해 노력합니다.<br />
            2. 본 약관에서 정하지 않은 사항은 관련 법령 또는 상관례에 따릅니다.
          </p>
        </div>
      </div>
    </div>
  );
}
