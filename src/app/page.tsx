import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-noto-sans-kr)]">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 pt-32 pb-20 md:pt-40 md:pb-28">
        <h1 className="text-4xl font-bold text-[#37352f] md:text-5xl lg:text-6xl tracking-tight">
          캘린더끝판왕
        </h1>
        <p className="mt-4 text-lg text-[#787774] md:text-xl max-w-md text-center">
          AI가 도와주는 스마트 일정 관리
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center rounded-lg bg-[#2eaadc] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-[#2799c7] focus:outline-none focus:ring-2 focus:ring-[#2eaadc] focus:ring-offset-2"
          >
            시작하기
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-lg border border-[#e3e2e0] bg-white px-8 py-3 text-base font-semibold text-[#37352f] transition-colors hover:bg-[#f7f6f5] focus:outline-none focus:ring-2 focus:ring-[#2eaadc] focus:ring-offset-2"
          >
            로그인
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 pb-24 md:pb-32">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {/* Card 1 */}
          <div className="rounded-xl border border-[#e3e2e0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2eaadc]/10">
              <svg
                className="h-6 w-6 text-[#2eaadc]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#37352f]">AI 일정 관리</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#787774]">
              자연어로 일정을 추가, 수정, 삭제할 수 있습니다. 복잡한 조작 없이 말로 관리하세요.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-xl border border-[#e3e2e0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2eaadc]/10">
              <svg
                className="h-6 w-6 text-[#2eaadc]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#37352f]">컬러 태그</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#787774]">
              직관적인 색상별 일정 분류로 한눈에 일정을 파악할 수 있습니다.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-xl border border-[#e3e2e0] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2eaadc]/10">
              <svg
                className="h-6 w-6 text-[#2eaadc]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#37352f]">멀티데이 일정</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#787774]">
              여러 날에 걸친 일정을 한눈에 확인하고 관리할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e3e2e0] py-8 text-center text-sm text-[#787774]">
        © 2026 캘린더끝판왕. All rights reserved.
      </footer>
    </div>
  );
}
