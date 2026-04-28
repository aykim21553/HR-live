"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DebateRound, PersonaId } from "@/lib/personas/types";
import type { ExpertPanel, PanelMessage, RiskLevel } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Web Speech API 나레이션 훅
// ─────────────────────────────────────────────────────────────────────────────
const personaVoice: Record<string, { rate: number; pitch: number }> = {
  labor_attorney:   { rate: 0.88, pitch: 0.82 },
  labor_consultant: { rate: 0.94, pitch: 1.05 },
  hrbp:             { rate: 1.06, pitch: 1.10 },
  rewards_perf:     { rate: 0.96, pitch: 0.92 },
  org_dev:          { rate: 1.00, pitch: 1.15 },
  finance_exec:     { rate: 1.08, pitch: 0.80 },
  governance_law:   { rate: 0.84, pitch: 0.76 },
};

function useNarration() {
  const [enabled, setEnabled] = useState(false);
  const [narratingSpeaker, setNarratingSpeaker] = useState<string | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    if (typeof window !== "undefined") synthRef.current = window.speechSynthesis;
    return () => { synthRef.current?.cancel(); };
  }, []);

  const speak = useCallback((text: string, panelId: string) => {
    if (!enabledRef.current || !synthRef.current) return;
    const synth = synthRef.current;
    synth.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/\n/g, " ").trim();
    if (!clean) return;
    setNarratingSpeaker(panelId);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ko-KR";
    const params = personaVoice[panelId] ?? { rate: 0.95, pitch: 1.0 };
    utterance.rate = params.rate;
    utterance.pitch = params.pitch;
    utterance.volume = 1;
    utterance.onend = () => setNarratingSpeaker(null);
    utterance.onerror = () => setNarratingSpeaker(null);
    synth.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
    setNarratingSpeaker(null);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      if (prev) { synthRef.current?.cancel(); setNarratingSpeaker(null); }
      return !prev;
    });
  }, []);

  return { enabled, narratingSpeaker, speak, stop, toggle };
}

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────
const riskBadge: Record<RiskLevel, string> = {
  low:      "border-emerald-500/50 bg-emerald-950/80 text-emerald-300",
  medium:   "border-yellow-500/50  bg-yellow-950/80  text-yellow-300",
  high:     "border-orange-500/50  bg-orange-950/80  text-orange-300",
  critical: "border-red-500/50     bg-red-950/80     text-red-300",
};
const riskLabel: Record<RiskLevel, string> = {
  low: "LOW RISK", medium: "MED RISK", high: "HIGH RISK", critical: "CRITICAL",
};

const seatPositions = [
  "left-[50%]  top-[7%]",
  "left-[79%]  top-[26%]",
  "left-[85%]  top-[57%]",
  "left-[65%]  top-[82%]",
  "left-[35%]  top-[82%]",
  "left-[15%]  top-[57%]",
  "left-[21%]  top-[26%]",
];

const tickerItems = [
  "PIP 절차: 명확한 목표 설정 → 중간 점검 → 최종 평가 → 이의신청 순으로 운영해야 합니다",
  "해고예고: 30일 전 통보 또는 30일분 통상임금 지급 의무 (근로기준법 제26조)",
  "직장 내 괴롭힘: 신고 즉시 사용자의 조사의무 발생, 행위자 징계 필수",
  "금융회사 내부통제: 중요 인사 결정은 이사회 또는 감사위원회 보고의무 점검 필요",
  "판례 주의: 절차적 정당성 없는 해고는 실체적 사유가 있어도 무효 가능성 높음",
  "통상임금: 정기성·일률성·고정성 세 가지 기준 모두 충족 여부 함께 검토",
  "상장사 ESG: 인사운영 투명성과 공시 연계 중요성이 지속적으로 증가하는 추세",
];

function roundLabel(round: DebateRound | "idle"): string {
  if (round === "round1")   return "1차 입장";
  if (round === "round2")   return "반박과 보완";
  if (round === "round3")   return "실행안 정리";
  if (round === "decision") return "최종 결론";
  return "대기";
}
function roundStep(round: DebateRound | "idle"): number {
  if (round === "round1")   return 1;
  if (round === "round2")   return 2;
  if (round === "round3")   return 3;
  if (round === "decision") return 4;
  return 0;
}
function latestActiveMessage(messages: PanelMessage[], activeSpeaker: PersonaId | null): PanelMessage | null {
  if (!activeSpeaker) return messages.at(-1) ?? null;
  return [...messages].reverse().find((m) => m.panelId === activeSpeaker) ?? messages.at(-1) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7인 개성 SVG 초상화
// ─────────────────────────────────────────────────────────────────────────────

/** 노동법 변호사 — 남성 50대, 네이비 수트, 사각 안경, 단호한 표정 */
function PortraitLaborAttorney({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#0a3a45" : "#c8d8e4"} />
          <stop offset="100%" stopColor={active ? "#041018" : "#8fa4b8"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#162642" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#1a2e4a" />
      <polygon points="56,120 70,150 84,120" fill="#f0f4f8" opacity="0.95" />
      <polygon points="65,120 70,154 75,120" fill="#6b1a2e" />
      <polygon points="65,120 75,120 73,129 70,127 67,129" fill="#8a2a3e" />
      <path d="M56,120 L33,142 L33,164 L14,164 L14,120" fill="#1e3458" opacity="0.6" />
      <path d="M84,120 L107,142 L107,164 L126,164 L126,120" fill="#1e3458" opacity="0.6" />
      <rect x="59" y="100" width="22" height="28" rx="9" fill="#e8c4a0" />
      <ellipse cx="70" cy="82" rx="31" ry="33" fill="#e8c4a0" />
      <ellipse cx="39" cy="84" rx="5" ry="7" fill="#ddb898" />
      <ellipse cx="101" cy="84" rx="5" ry="7" fill="#ddb898" />
      <path d="M39 78 Q40 50 70 47 Q100 50 101 78 Q92 60 70 58 Q48 60 39 78z" fill="#28282e" />
      <path d="M39 78 Q38 70 41 64 Q44 56 50 53 Q42 64 42 78" fill="#888" opacity="0.7" />
      <path d="M101 78 Q102 70 99 64 Q96 56 90 53 Q98 64 98 78" fill="#888" opacity="0.7" />
      <path d="M49 73 Q55 70 62 72" stroke="#3a2818" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M78 72 Q85 70 91 73" stroke="#3a2818" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="57"   cy="81" r="4.5" fill="#172026" />
      <circle cx="83"   cy="81" r="4.5" fill="#172026" />
      <circle cx="58.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="84.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <rect x="47" y="75" width="19" height="12" rx="2" fill="none" stroke="#4a5a70" strokeWidth="1.8" />
      <rect x="74" y="75" width="19" height="12" rx="2" fill="none" stroke="#4a5a70" strokeWidth="1.8" />
      <line x1="66" y1="81" x2="74" y2="81" stroke="#4a5a70" strokeWidth="1.5" />
      <line x1="47" y1="80" x2="43" y2="78" stroke="#4a5a70" strokeWidth="1.5" />
      <line x1="93" y1="80" x2="97" y2="78" stroke="#4a5a70" strokeWidth="1.5" />
      <path d="M67 90 Q70 95 73 90" fill="none" stroke="#c4987e" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M60 102 Q70 105 80 102" fill="none" stroke="#b07060" strokeWidth="2" strokeLinecap="round" />
      <circle cx="116" cy="24" r="18" fill="#1a3060" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#7eb8e0">법</text>
    </svg>
  );
}

/** 공인노무사 — 여성 40대, 포레스트 그린 블레이저, 따뜻한 미소, 단발 */
function PortraitLaborConsultant({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#0a3a28" : "#c4e0d4"} />
          <stop offset="100%" stopColor={active ? "#041210" : "#8ab8a0"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#1e4a38" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#245a42" />
      <polygon points="56,120 70,150 84,120" fill="#f8f0e8" opacity="0.95" />
      <path d="M56,120 L34,138 L34,164 L14,164 L14,120" fill="#2a6248" opacity="0.55" />
      <path d="M84,120 L106,138 L106,164 L126,164 L126,120" fill="#2a6248" opacity="0.55" />
      <rect x="60" y="102" width="20" height="26" rx="9" fill="#f0d0b0" />
      <ellipse cx="70" cy="82" rx="30" ry="32" fill="#f0d0b0" />
      <ellipse cx="40" cy="84" rx="5" ry="6.5" fill="#e4c0a2" />
      <ellipse cx="100" cy="84" rx="5" ry="6.5" fill="#e4c0a2" />
      <path d="M40 78 Q41 50 70 46 Q99 50 100 78 Q94 58 70 56 Q46 58 40 78z" fill="#2a1810" />
      <path d="M40 78 Q35 94 37 116 Q44 128 52 122 Q43 108 42 96 Q40 86 40 78" fill="#2a1810" />
      <path d="M100 78 Q105 94 103 116 Q96 128 88 122 Q97 108 98 96 Q100 86 100 78" fill="#2a1810" />
      <path d="M50 73 Q57 69 63 71" stroke="#2a1810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M77 71 Q83 69 90 73" stroke="#2a1810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="57" cy="81" rx="5"   ry="4"   fill="#172026" />
      <ellipse cx="83" cy="81" rx="5"   ry="4"   fill="#172026" />
      <circle  cx="58.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <circle  cx="84.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <path d="M67 90 Q70 95 73 90" fill="none" stroke="#c49880" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M59 101 Q70 110 81 101" fill="none" stroke="#c07060" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M62 102 Q70 107 78 102" fill="#e88878" opacity="0.3" />
      <circle cx="116" cy="24" r="18" fill="#1a4a30" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#7ed4a8">노</text>
    </svg>
  );
}

/** HRBP — 여성 35대, 바이올렛 블레이저, 웨이브 헤어, 활기찬 표정 */
function PortraitHrbp({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#2a1a40" : "#e4d8f4"} />
          <stop offset="100%" stopColor={active ? "#100820" : "#b8a4d8"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#3a2060" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#4a2878" />
      <polygon points="56,120 70,150 84,120" fill="#fff0f8" opacity="0.95" />
      <path d="M56,120 L34,136 L34,164 L14,164 L14,120" fill="#5a38a8" opacity="0.5" />
      <path d="M84,120 L106,136 L106,164 L126,164 L126,120" fill="#5a38a8" opacity="0.5" />
      <rect x="61" y="102" width="18" height="26" rx="8" fill="#f4c8a0" />
      <ellipse cx="70" cy="82" rx="29" ry="31" fill="#f4c8a0" />
      <ellipse cx="41" cy="83" rx="5" ry="6.5" fill="#eab898" />
      <ellipse cx="99" cy="83" rx="5" ry="6.5" fill="#eab898" />
      <path d="M41 77 Q42 50 70 46 Q98 50 99 77 Q93 57 70 55 Q47 57 41 77z" fill="#1c1018" />
      <path d="M41 77 Q34 92 35 108 Q37 118 44 122 Q50 126 52 120 Q43 110 41 98 Q39 88 41 77" fill="#1c1018" />
      <path d="M35 104 Q32 116 36 124 Q40 130 46 128 Q40 120 38 112" fill="#1c1018" />
      <path d="M99 77 Q106 92 105 108 Q103 118 96 122 Q90 126 88 120 Q97 110 99 98 Q101 88 99 77" fill="#1c1018" />
      <path d="M105 104 Q108 116 104 124 Q100 130 94 128 Q100 120 102 112" fill="#1c1018" />
      <path d="M49 73 Q56 69 63 71" stroke="#1c1018" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M77 71 Q84 69 91 73" stroke="#1c1018" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="57" cy="80" rx="5"   ry="4.2" fill="#172026" />
      <ellipse cx="83" cy="80" rx="5"   ry="4.2" fill="#172026" />
      <circle  cx="58.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <circle  cx="84.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <path d="M67 89 Q70 94 73 89" fill="none" stroke="#c49878" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M58 100 Q70 111 82 100" fill="none" stroke="#c06858" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="116" cy="24" r="18" fill="#3a2068" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#c8a8f8">관</text>
    </svg>
  );
}

/** 보상·평가 전문가 — 남성 42대, 앰버 수트, 골드 타이, 분석적 표정 */
function PortraitRewardsPerf({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#3a2010" : "#f0dcc4"} />
          <stop offset="100%" stopColor={active ? "#100800" : "#c4a880"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#5a3820" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#6a4428" />
      <polygon points="56,120 70,150 84,120" fill="#f8f4ec" opacity="0.95" />
      <polygon points="65,120 70,154 75,120" fill="#c49020" />
      <polygon points="65,120 75,120 73,129 70,127 67,129" fill="#d4a830" />
      <path d="M56,120 L34,140 L34,164 L14,164 L14,120" fill="#7a5032" opacity="0.6" />
      <path d="M84,120 L106,140 L106,164 L126,164 L126,120" fill="#7a5032" opacity="0.6" />
      <rect x="59" y="100" width="22" height="28" rx="9" fill="#e8c080" />
      <ellipse cx="70" cy="83" rx="30" ry="32" fill="#e8c080" />
      <ellipse cx="40" cy="85" rx="5" ry="6.5" fill="#ddb870" />
      <ellipse cx="100" cy="85" rx="5" ry="6.5" fill="#ddb870" />
      <path d="M40 78 Q41 51 70 47 Q99 51 100 78 Q92 58 70 56 Q48 58 40 78z" fill="#1e1408" />
      <path d="M40 78 Q41 67 46 60 Q42 70 42 78" fill="#1e1408" />
      <path d="M62 56 Q63 64 63 75" fill="none" stroke="#3a2810" strokeWidth="1" opacity="0.35" />
      <path d="M49 74 Q55 70 62 72" stroke="#2a1808" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M78 72 Q85 70 91 74" stroke="#2a1808" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M63 72 Q67 70 71 72" stroke="#2a1808" strokeWidth="1.5" fill="none" opacity="0.45" />
      <circle cx="57"   cy="81" r="4.5" fill="#172026" />
      <circle cx="83"   cy="81" r="4.5" fill="#172026" />
      <circle cx="58.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="84.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <path d="M67 91 Q70 96 73 91" fill="none" stroke="#c49858" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M61 102 Q70 105 79 102" fill="none" stroke="#a87040" strokeWidth="2" strokeLinecap="round" />
      <circle cx="116" cy="24" r="18" fill="#5a3818" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#f8c86a">보</text>
    </svg>
  );
}

/** 조직개발 전문가 — 여성 38대, 플럼 재킷, 긴 웨이브 머리, 따뜻하고 열린 표정 */
function PortraitOrgDev({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#280a38" : "#ead8f0"} />
          <stop offset="100%" stopColor={active ? "#100020" : "#c4a8d8"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#501a60" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#5c2270" />
      <polygon points="56,120 70,150 84,120" fill="#fdf0f8" opacity="0.95" />
      <path d="M56,120 L32,136 L32,164 L14,164 L14,120" fill="#6a3280" opacity="0.5" />
      <path d="M84,120 L108,136 L108,164 L126,164 L126,120" fill="#6a3280" opacity="0.5" />
      <rect x="61" y="102" width="18" height="26" rx="8" fill="#f2cca8" />
      <ellipse cx="70" cy="81" rx="29" ry="31" fill="#f2cca8" />
      <ellipse cx="41" cy="83" rx="5" ry="6.5" fill="#e8ba90" />
      <ellipse cx="99" cy="83" rx="5" ry="6.5" fill="#e8ba90" />
      <path d="M41 77 Q43 49 70 45 Q97 49 99 77 Q93 55 70 53 Q47 55 41 77z" fill="#1a0c06" />
      <path d="M41 77 Q34 96 33 116 Q32 130 40 138 Q46 144 50 140 Q40 128 40 114 Q40 96 41 77" fill="#1a0c06" />
      <path d="M33 116 Q31 126 34 136 Q38 142 44 140 Q38 130 36 120" fill="#1a0c06" />
      <path d="M99 77 Q106 96 107 116 Q108 130 100 138 Q94 144 90 140 Q100 128 100 114 Q100 96 99 77" fill="#1a0c06" />
      <path d="M107 116 Q109 126 106 136 Q102 142 96 140 Q102 130 104 120" fill="#1a0c06" />
      <path d="M34 112 Q37 120 35 128" fill="none" stroke="#2a1408" strokeWidth="1.8" opacity="0.5" strokeLinecap="round" />
      <path d="M106 112 Q103 120 105 128" fill="none" stroke="#2a1408" strokeWidth="1.8" opacity="0.5" strokeLinecap="round" />
      <path d="M50 73 Q57 69 63 71" stroke="#1a0c06" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M77 71 Q83 69 90 73" stroke="#1a0c06" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="57" cy="80" rx="5"   ry="4"   fill="#172026" />
      <ellipse cx="83" cy="80" rx="5"   ry="4"   fill="#172026" />
      <circle  cx="58.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <circle  cx="84.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <path d="M67 89 Q70 93 73 89" fill="none" stroke="#c4988a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M58 99 Q70 111 82 99" fill="none" stroke="#c07868" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M63 100 Q70 107 77 100" fill="#e89080" opacity="0.3" />
      <circle cx="116" cy="24" r="18" fill="#481860" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#e8a8f8">조</text>
    </svg>
  );
}

/** CFO 관점 전문가 — 남성 46대, 챠콜 수트, 레드 파워 타이, 자신감 있는 표정 */
function PortraitFinanceExec({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#141e28" : "#c8d4dc"} />
          <stop offset="100%" stopColor={active ? "#040810" : "#8fa4b4"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#282828" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#303030" />
      <polygon points="56,120 70,150 84,120" fill="#f8f8fa" opacity="0.95" />
      <polygon points="65,120 70,154 75,120" fill="#a01828" />
      <polygon points="65,120 75,120 73,129 70,127 67,129" fill="#c42838" />
      <path d="M56,120 L33,142 L33,164 L14,164 L14,120" fill="#3a3a3a" opacity="0.65" />
      <path d="M84,120 L107,142 L107,164 L126,164 L126,120" fill="#3a3a3a" opacity="0.65" />
      <rect x="59" y="100" width="22" height="28" rx="9" fill="#e8be90" />
      <ellipse cx="70" cy="82" rx="31" ry="33" fill="#e8be90" />
      <ellipse cx="39" cy="84" rx="5" ry="6.5" fill="#dcb082" />
      <ellipse cx="101" cy="84" rx="5" ry="6.5" fill="#dcb082" />
      <path d="M39 76 Q41 49 70 46 Q99 49 101 76 Q93 56 70 54 Q47 56 39 76z" fill="#181010" />
      <path d="M39 76 Q40 68 44 62 Q41 70 40 76" fill="#181010" />
      <path d="M48 54 Q55 50 70 49 Q85 50 92 54 Q80 52 70 52 Q60 52 48 54" fill="#282020" opacity="0.4" />
      <path d="M49 73 Q55 70 62 72" stroke="#2a1808" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M78 72 Q85 70 91 73" stroke="#2a1808" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="57"   cy="80" r="4.5" fill="#172026" />
      <circle cx="83"   cy="80" r="4.5" fill="#172026" />
      <circle cx="58.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="84.5" cy="78.5" r="1.5" fill="white" opacity="0.9" />
      <path d="M67 90 Q70 96 73 90" fill="none" stroke="#c49068" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 102 Q70 106 80 102" fill="none" stroke="#a07050" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M71 102 Q77 104 80 102" fill="none" stroke="#c08060" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="116" cy="24" r="18" fill="#1a2030" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#80b8d8">재</text>
    </svg>
  );
}

/** 지배구조법 전문가 — 남성 55대, 블랙 수트, 원형 안경, 소금-후추 백발 */
function PortraitGovernanceLaw({ active, uid }: { active: boolean; uid: string }) {
  return (
    <svg viewBox="0 0 140 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={active ? "#1a1a10" : "#dcdcd0"} />
          <stop offset="100%" stopColor={active ? "#080808" : "#a0a090"} />
        </linearGradient>
      </defs>
      <rect width="140" height="160" rx="18" fill={`url(#bg-${uid})`} />
      <ellipse cx="70" cy="164" rx="60" ry="28" fill="#181818" />
      <rect x="14" y="120" width="112" height="48" rx="5" fill="#202020" />
      <polygon points="56,120 70,150 84,120" fill="#f0f0f4" opacity="0.95" />
      <polygon points="65,120 70,154 75,120" fill="#2a2a38" />
      <polygon points="65,120 75,120 73,129 70,127 67,129" fill="#3a3a4a" />
      <path d="M56,120 L31,143 L31,164 L14,164 L14,120" fill="#282828" opacity="0.7" />
      <path d="M84,120 L109,143 L109,164 L126,164 L126,120" fill="#282828" opacity="0.7" />
      <rect x="59" y="100" width="22" height="28" rx="9" fill="#d8b890" />
      <ellipse cx="70" cy="82" rx="31" ry="33" fill="#d8b890" />
      <ellipse cx="39" cy="84" rx="5" ry="6.5" fill="#ccaa80" />
      <ellipse cx="101" cy="84" rx="5" ry="6.5" fill="#ccaa80" />
      <path d="M39 76 Q41 49 70 46 Q99 49 101 76 Q92 57 70 56 Q48 57 39 76z" fill="#606060" />
      <path d="M42 72 Q48 57 56 55 Q48 63 42 72" fill="#c8c8c8" opacity="0.8" />
      <path d="M98 72 Q92 57 84 55 Q92 63 98 72" fill="#c8c8c8" opacity="0.8" />
      <path d="M56 55 Q63 52 70 52 Q66 54 60 55" fill="#d8d8d8" opacity="0.7" />
      <path d="M47 74 Q54 70 62 72" stroke="#404040" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M78 72 Q86 70 93 74" stroke="#404040" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <circle cx="57"   cy="81" r="4.5" fill="#172026" />
      <circle cx="83"   cy="81" r="4.5" fill="#172026" />
      <circle cx="58.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="84.5" cy="79.5" r="1.5" fill="white" opacity="0.9" />
      <circle cx="57" cy="81" r="9"  fill="none" stroke="#2a2a2a" strokeWidth="2.2" opacity="0.85" />
      <circle cx="83" cy="81" r="9"  fill="none" stroke="#2a2a2a" strokeWidth="2.2" opacity="0.85" />
      <line x1="66"  y1="81" x2="74"  y2="81" stroke="#2a2a2a" strokeWidth="1.8" />
      <line x1="48"  y1="80" x2="44"  y2="78" stroke="#2a2a2a" strokeWidth="1.8" />
      <line x1="92"  y1="80" x2="96"  y2="78" stroke="#2a2a2a" strokeWidth="1.8" />
      <path d="M67 91 Q70 97 73 91" fill="none" stroke="#b09068" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M60 103 Q70 105 80 103" fill="none" stroke="#987850" strokeWidth="2" strokeLinecap="round" />
      <circle cx="116" cy="24" r="18" fill="#202020" />
      <text x="116" y="30" textAnchor="middle" fontSize="14" fontWeight="900" fill="#c0c0a0">지</text>
    </svg>
  );
}

/** 패널 ID → 초상화 컴포넌트 라우터 */
function PersonaPortrait({ panel, active }: { panel: ExpertPanel; active: boolean }) {
  const uid = panel.id;
  switch (panel.id) {
    case "labor_attorney":   return <PortraitLaborAttorney   active={active} uid={uid} />;
    case "labor_consultant": return <PortraitLaborConsultant active={active} uid={uid} />;
    case "hrbp":             return <PortraitHrbp            active={active} uid={uid} />;
    case "rewards_perf":     return <PortraitRewardsPerf     active={active} uid={uid} />;
    case "org_dev":          return <PortraitOrgDev          active={active} uid={uid} />;
    case "finance_exec":     return <PortraitFinanceExec     active={active} uid={uid} />;
    case "governance_law":   return <PortraitGovernanceLaw   active={active} uid={uid} />;
    default:                 return <PortraitLaborConsultant active={active} uid={`${uid}-fb`} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 오디오 바 (발언 시각화)
// ─────────────────────────────────────────────────────────────────────────────
function AudioBars({ active, narrating }: { active: boolean; narrating?: boolean }) {
  const color = narrating ? "bg-violet-400" : active ? "bg-cyan-300" : "bg-slate-600";
  return (
    <div className="flex h-5 items-end justify-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          animate={{ height: active || narrating ? [5, 18 - i * 2, 9 + i * 3, 14, 6] : 5 }}
          transition={{ repeat: active || narrating ? Infinity : 0, duration: 0.7, delay: i * 0.09 }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 좌석 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function PersonaSeat({
  panel, active, narrating, index,
}: {
  panel: ExpertPanel; active: boolean; narrating: boolean; index: number;
}) {
  return (
    <motion.div
      className={`absolute ${seatPositions[index % seatPositions.length]} z-20 w-[126px] -translate-x-1/2 -translate-y-1/2 max-lg:static max-lg:w-full max-lg:translate-x-0 max-lg:translate-y-0`}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: active ? 1 : 0.76, scale: active ? 1.11 : 1, y: active ? -10 : 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: index * 0.04 }}
    >
      {/* 스포트라이트 콘 */}
      {active && (
        <motion.div
          className="pointer-events-none absolute -top-10 left-1/2 h-10 w-20 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2.2 }}
          style={{
            background: "linear-gradient(to bottom, rgba(103,232,249,0.0), rgba(103,232,249,0.28))",
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          }}
        />
      )}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-1.5 text-center transition-all duration-300 ${
          active
            ? "border-cyan-300 bg-gradient-to-b from-cyan-950/90 to-slate-950/95 shadow-[0_0_30px_rgba(103,232,249,0.4)]"
            : "border-white/10 bg-slate-950/80 hover:border-white/20"
        }`}
      >
        {active && (
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
        )}
        {narrating && (
          <div className="absolute right-2 top-2 z-10">
            <motion.div
              className="h-2.5 w-2.5 rounded-full bg-violet-400"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 0.75 }}
            />
          </div>
        )}
        <div className="mx-auto h-20 w-20 overflow-hidden rounded-xl">
          <PersonaPortrait panel={panel} active={active} />
        </div>
        <p className={`mt-1.5 break-keep text-[11px] font-black leading-[14px] ${active ? "text-white" : "text-slate-300"}`}>
          {panel.name}
        </p>
        <p className={`mt-0.5 h-7 overflow-hidden break-keep text-[9px] font-bold leading-[12px] ${active ? "text-cyan-200" : "text-slate-500"}`}>
          {panel.title}
        </p>
        <div className="mt-1">
          <AudioBars active={active} narrating={narrating} />
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TV 하단 자막 (Lower-Third)
// ─────────────────────────────────────────────────────────────────────────────
function LowerThird({ message }: { message: PanelMessage | null }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message.id}
          className="absolute inset-x-0 bottom-0 z-40 overflow-hidden max-lg:relative max-lg:bottom-auto"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
        >
          <div className="bg-gradient-to-r from-slate-950/96 via-cyan-950/96 to-slate-950/96 backdrop-blur-sm">
            <div className="flex items-stretch gap-0 border-t border-cyan-300/30">
              <div className="shrink-0 bg-cyan-400 px-3 py-2 flex items-center justify-center">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-950">발언</p>
              </div>
              <div className="shrink-0 border-r border-white/10 bg-slate-900/80 px-4 py-2 flex flex-col justify-center min-w-[112px]">
                <p className="font-black text-white text-sm leading-tight">{message.speaker}</p>
                <p className="text-[10px] text-cyan-300 font-bold mt-0.5">{message.role}</p>
              </div>
              <div className="flex-1 overflow-hidden px-5 py-2.5 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={message.message.slice(-30)}
                    className="text-sm font-bold text-slate-100 leading-[1.55] break-keep"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {message.message
                      ? message.message.slice(0, 110) + (message.message.length > 110 ? "…" : "")
                      : "발언 준비 중..."}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="shrink-0 flex items-center px-4 py-2">
                <span className="rounded bg-slate-800/80 px-2 py-1 text-[9px] font-black text-slate-400 uppercase">
                  {message.stance}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="waiting"
          className="absolute inset-x-0 bottom-0 z-40 max-lg:relative max-lg:bottom-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-center justify-center border-t border-white/8 bg-slate-950/70 px-6 py-3 backdrop-blur-sm">
            <p className="text-sm font-bold text-slate-400">
              토론 시작을 누르면 패널들이 원탁에서 차례로 발언합니다.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 중앙 원탁
// ─────────────────────────────────────────────────────────────────────────────
function StudioTable({
  currentRound, activeSpeaker,
}: {
  currentRound: DebateRound | "idle"; activeSpeaker: PersonaId | null;
}) {
  const step = roundStep(currentRound);
  return (
    <div className="absolute left-1/2 top-1/2 z-10 h-[280px] w-[450px] -translate-x-1/2 -translate-y-1/2 max-lg:relative max-lg:left-auto max-lg:top-auto max-lg:mx-auto max-lg:h-44 max-lg:w-full max-lg:max-w-[400px] max-lg:translate-x-0 max-lg:translate-y-0">
      {activeSpeaker && (
        <motion.div
          className="absolute inset-[-8px] rounded-[50%]"
          animate={{ opacity: [0.25, 0.65, 0.25] }}
          transition={{ repeat: Infinity, duration: 2.8 }}
          style={{ background: "radial-gradient(ellipse, rgba(103,232,249,0.14) 0%, transparent 70%)" }}
        />
      )}
      <motion.div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: "radial-gradient(ellipse at 50% 36%, #1e4a56 0%, #1a3844 28%, #0f2535 58%, #090f18 100%)",
          boxShadow: activeSpeaker
            ? "0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(103,232,249,0.22), 0 0 40px rgba(103,232,249,0.10)"
            : "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
          border: "1px solid rgba(103,232,249,0.14)",
        }}
        animate={{ scale: activeSpeaker ? 1.025 : 1 }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <div className="absolute inset-[22px] rounded-[50%]" style={{ border: "1px dashed rgba(255,255,255,0.10)" }} />
      <div className="absolute inset-[40px] rounded-[50%]" style={{ background: "radial-gradient(ellipse at 50% 28%, rgba(255,255,255,0.045) 0%, transparent 60%)" }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="grid place-items-center rounded-full border border-cyan-300/22 bg-slate-950/90 px-6 py-4 text-center shadow-panel backdrop-blur"
          animate={{ scale: activeSpeaker ? [1, 1.045, 1] : 1 }}
          transition={{ repeat: activeSpeaker ? Infinity : 0, duration: 2.2 }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">LIVE ROUND</p>
          <p className="mt-1 break-keep text-sm font-black text-white">{roundLabel(currentRound)}</p>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <motion.div
                key={s}
                className={`h-1.5 w-4 rounded-full transition-colors duration-500 ${s <= step ? "bg-cyan-400" : "bg-slate-700"}`}
                animate={s === step ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ repeat: s === step ? Infinity : 0, duration: 1.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HR 지식 티커
// ─────────────────────────────────────────────────────────────────────────────
function StageTicker() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((p) => (p + 1) % tickerItems.length), 5500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-stretch overflow-hidden border-t border-white/10 bg-slate-950/90">
      <div className="shrink-0 bg-cyan-400 px-3 py-1.5 flex items-center">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-950 whitespace-nowrap">HR 노무</span>
      </div>
      <div className="flex-1 overflow-hidden px-4 py-1.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            className="text-xs font-bold text-slate-400"
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -60, opacity: 0 }}
            transition={{ duration: 0.38 }}
          >
            {tickerItems[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 DebateStage
// ─────────────────────────────────────────────────────────────────────────────
export function DebateStage({
  panels,
  messages,
  activeSpeaker,
  currentRound,
  riskLevel,
  filteredMessages,
}: {
  panels: ExpertPanel[];
  messages: PanelMessage[];
  activeSpeaker: PersonaId | null;
  currentRound: DebateRound | "idle";
  riskLevel: RiskLevel;
  filteredMessages: PanelMessage[];
}) {
  const { enabled: narrationEnabled, narratingSpeaker, speak, stop, toggle: toggleNarration } = useNarration();
  const prevSpeakerRef = useRef<PersonaId | null>(null);
  const messagesRef    = useRef(messages);
  const speakRef       = useRef(speak);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  const activeMessage = latestActiveMessage(messages, activeSpeaker);
  void filteredMessages;

  // 이전 발언자 완료 감지 → 나레이션 자동 실행
  useEffect(() => {
    const prevSpeaker = prevSpeakerRef.current;
    prevSpeakerRef.current = activeSpeaker;
    if (!prevSpeaker || prevSpeaker === activeSpeaker) return;
    const timer = setTimeout(() => {
      const completed = [...messagesRef.current].reverse().find((m) => m.panelId === prevSpeaker);
      if (completed?.message) speakRef.current(completed.message, prevSpeaker);
    }, 450);
    return () => clearTimeout(timer);
  }, [activeSpeaker]);

  useEffect(() => { if (!narrationEnabled) stop(); }, [narrationEnabled, stop]);

  return (
    <section className="overflow-hidden rounded-panel border border-slate-800 bg-slate-950 text-white shadow-panel">

      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/60 px-3 py-1.5">
            <motion.span
              className="h-2 w-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
            />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">On Air</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Live Debate Studio</p>
            <h3 className="text-lg font-black leading-tight">HR 노무 100분 토론</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 나레이션 토글 버튼 */}
          <button
            onClick={toggleNarration}
            title={narrationEnabled ? "나레이션 끄기" : "나레이션 켜기 — 발언자가 직접 말합니다 (Web Speech API)"}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition-all ${
              narrationEnabled
                ? "border-violet-400/60 bg-violet-950/80 text-violet-300 shadow-[0_0_14px_rgba(167,139,250,0.3)]"
                : "border-white/15 bg-white/5 text-slate-400 hover:border-white/25 hover:text-white"
            }`}
          >
            <span className="text-sm">{narrationEnabled ? "🔊" : "🔇"}</span>
            <span className="max-sm:hidden">{narrationEnabled ? "나레이션 ON" : "나레이션"}</span>
            {narratingSpeaker && (
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-violet-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.55 }}
              />
            )}
          </button>
          <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black ${riskBadge[riskLevel]}`}>
            {riskLabel[riskLevel]}
          </span>
        </div>
      </div>

      {/* 스튜디오 스테이지 */}
      <div className="p-3 pb-0">
        <div className="relative min-h-[720px] overflow-hidden rounded-t-panel max-lg:min-h-0 max-lg:pb-4">
          {/* 배경 */}
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, #1a3d4a 0%, #0e2535 28%, #071525 58%, #030a12 100%)" }}
          />
          {/* 원근법 바닥 그리드 */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(103,232,249,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(103,232,249,0.06) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              transform: "perspective(500px) rotateX(10deg)",
              transformOrigin: "50% 100%",
            }}
          />
          {/* 상단 주변광 */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-72"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(103,232,249,0.09) 0%, transparent 70%)" }}
          />
          {/* 하단 비네트 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-slate-950/55 to-transparent" />

          {/* 스튜디오 레이블 */}
          <div className="absolute left-4 top-4 z-10 max-lg:hidden">
            <span className="rounded-full border border-cyan-300/22 bg-cyan-950/55 px-3 py-1 text-[10px] font-black tracking-[0.15em] text-cyan-300 backdrop-blur">
              MBC STYLE · PANEL ROOM
            </span>
          </div>
          <div className="absolute right-4 top-4 z-10 max-lg:hidden">
            <span className="rounded-full border border-white/12 bg-slate-950/55 px-3 py-1 text-[10px] font-black text-slate-400 backdrop-blur">
              {panels.length}명 참석
            </span>
          </div>

          {/* 원탁 */}
          <StudioTable currentRound={currentRound} activeSpeaker={activeSpeaker} />

          {/* 패널 좌석 */}
          <div className="max-lg:grid max-lg:grid-cols-2 max-lg:gap-3 max-md:grid-cols-1">
            {panels.map((panel, index) => (
              <PersonaSeat
                key={panel.id}
                panel={panel}
                active={panel.id === activeSpeaker}
                narrating={narratingSpeaker === panel.id}
                index={index}
              />
            ))}
          </div>

          {/* TV 하단 자막 */}
          <LowerThird message={activeMessage} />
        </div>
      </div>

      {/* HR 지식 티커 */}
      <StageTicker />
    </section>
  );
}
