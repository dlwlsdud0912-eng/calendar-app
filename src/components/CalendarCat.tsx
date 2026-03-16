'use client';

import React from 'react';

type CatState =
  | 'idle_sit' | 'idle_loaf' | 'walk' | 'groom'
  | 'pet_react' | 'startled_run' | 'scruff_drag' | 'drop_land' | 'bubble_show';

interface CalendarCatProps {
  x: number;
  y: number;
  state: CatState;
  direction: 'left' | 'right';
  bubble: string | null;
  onCatClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  reducedMotion: boolean;
}

const KEYFRAMES = `
  @keyframes catBreath {
    0%, 100% { transform: translateY(0) scaleY(1); }
    40% { transform: translateY(-1px) scaleY(1.03); }
    60% { transform: translateY(-1px) scaleY(1.03); }
  }
  @keyframes catWalkBody {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-2px) rotate(-1deg); }
    75% { transform: translateY(-2px) rotate(1deg); }
  }
  @keyframes catWalkLegFL {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-20deg); }
    75% { transform: rotate(20deg); }
  }
  @keyframes catWalkLegBL {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(20deg); }
    75% { transform: rotate(-20deg); }
  }
  @keyframes catGroomPaw {
    0%, 100% { transform: rotate(0deg) translateY(0); }
    40% { transform: rotate(-50deg) translateY(-3px); }
    60% { transform: rotate(-50deg) translateY(-3px); }
  }
  @keyframes catTailWag {
    0%, 100% { transform: rotate(0deg); transform-origin: bottom; }
    33% { transform: rotate(15deg); transform-origin: bottom; }
    66% { transform: rotate(-15deg); transform-origin: bottom; }
  }
  @keyframes catHeartFloat {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-18px) scale(1.4); }
  }
  @keyframes catBubbleIn {
    0% { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.9); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  @keyframes catLandSquish {
    0% { transform: scaleX(1.3) scaleY(0.7); }
    60% { transform: scaleX(0.95) scaleY(1.05); }
    100% { transform: scaleX(1) scaleY(1); }
  }
  @keyframes catBlink {
    0%, 90%, 100% { transform: scaleY(1); }
    95% { transform: scaleY(0.1); }
  }
`;

function CatSVG({ state, reducedMotion }: { state: CatState; reducedMotion: boolean }) {
  const anim = (name: string, dur: string, extra = '') =>
    reducedMotion ? 'none' : `${name} ${dur} ease-in-out infinite ${extra}`.trim();

  // Ghibli-style palette (Chihiro-inspired white cat)
  const body = '#f5f0e8';
  const shadow = '#e8e0d0';
  const ear = '#ffb8b8';
  const nose = '#ff9eb3';
  const eyeOuter = '#2d5a3e';
  const eyeInner = '#1a3d28';
  const whisker = '#d4c8b8';
  const mouth = '#d4a0a0';

  // Helper: whiskers (6 lines)
  const Whiskers = () => (
    <>
      <line x1="8" y1="18" x2="15" y2="19" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      <line x1="7" y1="19.5" x2="15" y2="20" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      <line x1="8" y1="21" x2="15" y2="20.8" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      <line x1="32" y1="18" x2="25" y2="19" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      <line x1="33" y1="19.5" x2="25" y2="20" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      <line x1="32" y1="21" x2="25" y2="20.8" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
    </>
  );

  const svgStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: 'block',
    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
    ...extra,
  });

  // --- idle_sit / bubble_show ---
  if (state === 'idle_sit' || state === 'bubble_show') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle({ animation: anim('catBreath', '3.5s') })}>
        {/* 꼬리 */}
        <path d="M28 28 Q34 24 33 18 Q32 14 30 16" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 */}
        <ellipse cx="20" cy="27" rx="9" ry="7" fill={body}/>
        <ellipse cx="20" cy="29" rx="7" ry="4" fill={shadow} opacity="0.5"/>
        {/* 앞발 */}
        <path d="M15 30 Q14 34 15 35 Q16 35.5 17 35 Q17 33 16.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M22 30 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 왼 */}
        <ellipse cx="17" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
        <ellipse cx="17" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
        <circle cx="17.6" cy="16.2" r="0.6" fill="white"/>
        <circle cx="16.2" cy="17.8" r="0.3" fill="white" opacity="0.6"/>
        {/* 눈 오른 */}
        <ellipse cx="23" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
        <ellipse cx="23" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
        <circle cx="23.6" cy="16.2" r="0.6" fill="white"/>
        <circle cx="22.2" cy="17.8" r="0.3" fill="white" opacity="0.6"/>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // --- idle_loaf ---
  if (state === 'idle_loaf') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle({ animation: anim('catBreath', '4s') })}>
        {/* 꼬리 (몸통 옆으로 감싸듯) */}
        <path d="M28 30 Q35 28 34 24 Q33 20 30 22" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 (더 둥글게, 발 안 보임) */}
        <ellipse cx="20" cy="28" rx="10" ry="6" fill={body}/>
        <ellipse cx="20" cy="30" rx="8" ry="3.5" fill={shadow} opacity="0.5"/>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 - 반쯤 감김 */}
        <path d="M15.5 17 Q17 18.5 18.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
        <path d="M21.5 17 Q23 18.5 24.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // --- walk ---
  if (state === 'walk') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle({ animation: anim('catWalkBody', '0.5s') })}>
        {/* 꼬리 위로 올라감 */}
        <path d="M28 26 Q35 20 33 14 Q32 10 30 13" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 (살짝 기울어짐) */}
        <g transform="rotate(-5 20 24)">
          <ellipse cx="20" cy="27" rx="9" ry="6" fill={body}/>
          <ellipse cx="20" cy="29" rx="7" ry="3.5" fill={shadow} opacity="0.5"/>
        </g>
        {/* 뒷발 */}
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegBL 0.5s ease-in-out infinite', transformOrigin: '13px 30px' }}>
          <path d="M13 30 Q12 34 13 35 Q14 35.5 15 35 Q15 33 14.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegFL 0.5s ease-in-out infinite', transformOrigin: '25px 30px' }}>
          <path d="M25 30 Q24 34 25 35 Q26 35.5 27 35 Q27 33 26.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        {/* 앞발 */}
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegFL 0.5s ease-in-out infinite', transformOrigin: '16px 30px' }}>
          <path d="M16 30 Q15 34 16 35 Q17 35.5 18 35 Q18 33 17.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegBL 0.5s ease-in-out infinite', transformOrigin: '22px 30px' }}>
          <path d="M22 30 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 왼 */}
        <ellipse cx="17" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
        <ellipse cx="17" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
        <circle cx="17.6" cy="16.2" r="0.6" fill="white"/>
        <circle cx="16.2" cy="17.8" r="0.3" fill="white" opacity="0.6"/>
        {/* 눈 오른 */}
        <ellipse cx="23" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
        <ellipse cx="23" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
        <circle cx="23.6" cy="16.2" r="0.6" fill="white"/>
        <circle cx="22.2" cy="17.8" r="0.3" fill="white" opacity="0.6"/>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // --- groom ---
  if (state === 'groom') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle()}>
        {/* 꼬리 */}
        <path d="M28 28 Q34 24 33 18 Q32 14 30 16" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 */}
        <ellipse cx="20" cy="27" rx="9" ry="7" fill={body}/>
        <ellipse cx="20" cy="29" rx="7" ry="4" fill={shadow} opacity="0.5"/>
        {/* 오른발 */}
        <path d="M22 30 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        {/* 머리 (살짝 기울어짐) */}
        <g transform="rotate(10 18 17)">
          <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
          {/* 왼귀 */}
          <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
          <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
          {/* 오른귀 */}
          <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
          <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
          {/* 눈 감김 */}
          <path d="M15.5 17 Q17 18.5 18.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
          <path d="M21.5 17 Q23 18.5 24.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
          {/* 코 */}
          <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
          {/* 혀 */}
          <ellipse cx="20" cy="21" rx="0.6" ry="0.4" fill="#ffb0b0"/>
          {/* 입 */}
          <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
          {/* 수염 */}
          <Whiskers/>
        </g>
        {/* 그루밍 왼발 (얼굴에) */}
        <g style={{ animation: reducedMotion ? 'none' : 'catGroomPaw 2s ease-in-out infinite', transformOrigin: '15px 30px' }}>
          <path d="M15 30 Q13 24 16 20 Q17 19 18 20" fill={body} stroke={shadow} strokeWidth="0.4" strokeLinecap="round"/>
        </g>
      </svg>
    );
  }

  // --- pet_react ---
  if (state === 'pet_react') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle()}>
        {/* 꼬리 (흔들기) */}
        <g style={{ animation: reducedMotion ? 'none' : 'catTailWag 0.6s ease-in-out infinite', transformOrigin: '28px 28px' }}>
          <path d="M28 28 Q34 24 33 18 Q32 14 30 16" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </g>
        {/* 몸통 */}
        <ellipse cx="20" cy="27" rx="9" ry="7" fill={body}/>
        <ellipse cx="20" cy="29" rx="7" ry="4" fill={shadow} opacity="0.5"/>
        {/* 앞발 */}
        <path d="M15 30 Q14 34 15 35 Q16 35.5 17 35 Q17 33 16.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M22 30 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 ^^ (행복) */}
        <path d="M15.5 17 Q17 15.5 18.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
        <path d="M21.5 17 Q23 15.5 24.5 17" stroke={eyeOuter} strokeWidth="0.6" fill="none" strokeLinecap="round"/>
        {/* 볼터치 */}
        <circle cx="14" cy="20" r="1.5" fill="#ffcccc" opacity="0.5"/>
        <circle cx="26" cy="20" r="1.5" fill="#ffcccc" opacity="0.5"/>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // --- startled_run ---
  if (state === 'startled_run') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle({ animation: anim('catWalkBody', '0.25s') })}>
        {/* 꼬리 곤두섬 (수직으로) */}
        <path d="M28 26 Q32 16 30 10 Q29 7 28 9" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 (약간 납작) */}
        <ellipse cx="20" cy="27" rx="10" ry="6" fill={body}/>
        <ellipse cx="20" cy="29" rx="8" ry="3.5" fill={shadow} opacity="0.5"/>
        {/* 다리 빠르게 (더 벌어짐) */}
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegFL 0.25s ease-in-out infinite', transformOrigin: '12px 30px' }}>
          <path d="M12 30 Q10 34 11 35 Q12 35.5 13 35 Q13 33 12.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegBL 0.25s ease-in-out infinite', transformOrigin: '17px 30px' }}>
          <path d="M17 30 Q16 34 17 35 Q18 35.5 19 35 Q19 33 18.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegBL 0.25s ease-in-out infinite', transformOrigin: '22px 30px' }}>
          <path d="M22 30 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catWalkLegFL 0.25s ease-in-out infinite', transformOrigin: '27px 30px' }}>
          <path d="M27 30 Q26 34 27 35 Q28 35.5 29 35 Q29 33 28.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        </g>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 동그랗게 커짐 */}
        <ellipse cx="17" cy="17" rx="2.5" ry="2.8" fill={eyeOuter}/>
        <ellipse cx="17" cy="17" rx="1.5" ry="1.8" fill={eyeInner}/>
        <circle cx="17.8" cy="15.8" r="0.8" fill="white"/>
        <circle cx="16" cy="18" r="0.4" fill="white" opacity="0.6"/>
        <ellipse cx="23" cy="17" rx="2.5" ry="2.8" fill={eyeOuter}/>
        <ellipse cx="23" cy="17" rx="1.5" ry="1.8" fill={eyeInner}/>
        <circle cx="23.8" cy="15.8" r="0.8" fill="white"/>
        <circle cx="22" cy="18" r="0.4" fill="white" opacity="0.6"/>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // --- scruff_drag ---
  if (state === 'scruff_drag') {
    return (
      <svg width="28" height="30" viewBox="0 0 40 44" style={svgStyle()}>
        {/* 꼬리 축 처짐 */}
        <path d="M14 34 Q10 38 12 42" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 (세로로 늘어짐) */}
        <ellipse cx="20" cy="30" rx="6" ry="9" fill={body}/>
        <ellipse cx="20" cy="32" rx="5" ry="6" fill={shadow} opacity="0.4"/>
        {/* 다리 축 처짐 */}
        <path d="M16 37 Q15 40 16 42 Q17 42.5 18 42 Q18 40 17 37" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M22 37 Q21 40 22 42 Q23 42.5 24 42 Q24 40 23 37" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M25 36 Q26 39 25 41 Q24 41.5 23.5 41" fill={body} stroke={shadow} strokeWidth="0.3"/>
        {/* 머리 (위쪽) */}
        <ellipse cx="20" cy="14" rx="8" ry="7" fill={body}/>
        {/* 왼귀 (축 처짐, 옆으로) */}
        <path d="M13 11 Q10 8 13 8" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13 10.5 Q11 8.5 13 8.5" fill={ear}/>
        {/* 오른귀 (축 처짐, 옆으로) */}
        <path d="M27 11 Q30 8 27 8" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M27 10.5 Q29 8.5 27 8.5" fill={ear}/>
        {/* 눈 >< 찡그림 */}
        <path d="M15 13 L17 14.5 L15 16" fill="none" stroke={eyeOuter} strokeWidth="0.6" strokeLinejoin="round"/>
        <path d="M25 13 L23 14.5 L25 16" fill="none" stroke={eyeOuter} strokeWidth="0.6" strokeLinejoin="round"/>
        {/* 코 */}
        <ellipse cx="20" cy="17" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 (불만) */}
        <path d="M18.5 18 Q20 17.5 21.5 18" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 (위치 조정) */}
        <line x1="8" y1="15" x2="15" y2="16" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
        <line x1="7" y1="16.5" x2="15" y2="17" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="15" y2="17.8" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
        <line x1="32" y1="15" x2="25" y2="16" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
        <line x1="33" y1="16.5" x2="25" y2="17" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
        <line x1="32" y1="18" x2="25" y2="17.8" stroke={whisker} strokeWidth="0.3" strokeLinecap="round"/>
      </svg>
    );
  }

  // --- drop_land ---
  if (state === 'drop_land') {
    return (
      <svg width="28" height="24" viewBox="0 0 40 36" style={svgStyle({ animation: reducedMotion ? 'none' : 'catLandSquish 0.4s ease-out forwards' })}>
        {/* 꼬리 */}
        <path d="M28 28 Q34 24 33 18 Q32 14 30 16" stroke={shadow} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        {/* 몸통 (납작) */}
        <ellipse cx="20" cy="28" rx="10" ry="6" fill={body}/>
        <ellipse cx="20" cy="30" rx="8" ry="3.5" fill={shadow} opacity="0.5"/>
        {/* 다리 넓게 벌어짐 */}
        <path d="M11 30 Q9 34 10 35 Q11 35.5 12 35 Q12 33 11.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M16 31 Q15 34 16 35 Q17 35.5 18 35 Q18 33 17 31" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M22 31 Q21 34 22 35 Q23 35.5 24 35 Q24 33 23 31" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M27 30 Q26 34 27 35 Q28 35.5 29 35 Q29 33 28.5 30" fill={body} stroke={shadow} strokeWidth="0.3"/>
        {/* 머리 */}
        <ellipse cx="20" cy="17" rx="8" ry="7" fill={body}/>
        {/* 왼귀 */}
        <path d="M13 13 Q12 7 15 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M13.5 12 Q13 8.5 15 10.5" fill={ear}/>
        {/* 오른귀 */}
        <path d="M27 13 Q28 7 25 10" fill={body} stroke={shadow} strokeWidth="0.3"/>
        <path d="M26.5 12 Q27 8.5 25 10.5" fill={ear}/>
        {/* 눈 깜빡 */}
        <g style={{ animation: reducedMotion ? 'none' : 'catBlink 0.4s ease-out forwards', transformOrigin: '17px 17px' }}>
          <ellipse cx="17" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
          <ellipse cx="17" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
          <circle cx="17.6" cy="16.2" r="0.6" fill="white"/>
        </g>
        <g style={{ animation: reducedMotion ? 'none' : 'catBlink 0.4s ease-out forwards', transformOrigin: '23px 17px' }}>
          <ellipse cx="23" cy="17" rx="2" ry="2.2" fill={eyeOuter}/>
          <ellipse cx="23" cy="17" rx="1.2" ry="1.4" fill={eyeInner}/>
          <circle cx="23.6" cy="16.2" r="0.6" fill="white"/>
        </g>
        {/* 코 */}
        <ellipse cx="20" cy="19.8" rx="0.8" ry="0.5" fill={nose}/>
        {/* 입 */}
        <path d="M18.5 20.8 Q20 21.5 21.5 20.8" stroke={mouth} strokeWidth="0.3" fill="none" strokeLinecap="round"/>
        {/* 수염 */}
        <Whiskers/>
      </svg>
    );
  }

  // fallback
  return null;
}

const CalendarCat = React.memo(function CalendarCat({
  x,
  y,
  state,
  direction,
  bubble,
  onCatClick,
  onDragStart,
  reducedMotion,
}: CalendarCatProps) {
  const isPetReact = state === 'pet_react';

  // Don't render if position not initialized yet
  if (x === 0 && y === 0) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      {/* 고양이 본체 */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: 'translate(-50%, -100%)',
          zIndex: 5,
          cursor: state === 'scruff_drag' ? 'grabbing' : 'pointer',
          pointerEvents: 'auto',
          userSelect: 'none',
          transition: reducedMotion ? 'none' : undefined,
          lineHeight: 1,
        }}
        onClick={onCatClick}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        {/* 크기 조절 래퍼 */}
        <div style={{ transform: 'scale(1.95)', transformOrigin: 'bottom center' }}>
          {/* 방향 반전 래퍼 */}
          <div style={{ transform: direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)', transition: reducedMotion ? 'none' : 'transform 0.3s ease' }}>
            <CatSVG state={state} reducedMotion={reducedMotion} />
          </div>
        </div>

        {/* pet_react 하트 float */}
        {isPetReact && (
          <span
            style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              animation: reducedMotion ? 'none' : 'catHeartFloat 1s ease-out forwards',
              fontSize: '10px',
              pointerEvents: 'none',
            }}
          >
            ❤️
          </span>
        )}

        {/* 말풍선 */}
        {bubble && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '6px',
              background: 'white',
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '9px',
              fontWeight: 500,
              color: '#37352f',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 1000,
              animation: reducedMotion ? 'none' : 'catBubbleIn 0.3s ease-out',
              pointerEvents: 'none',
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bubble}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid white',
              }}
            />
          </div>
        )}

      </div>
    </>
  );
});

export default CalendarCat;
export type { CatState, CalendarCatProps };
