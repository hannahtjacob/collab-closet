import type { ReactNode } from "react";

// Reaction values are stored as these emoji strings; only the rendering changes here.
export const reactionLabels: Record<string, string> = {
  "❤️": "Love",
  "🔥": "Fire",
  "👏": "Crown",
  "👎": "Nope",
  "✨": "Sparkle",
};

const SHADOW = "rgba(32, 32, 29, 0.14)";
const CORAL = "var(--coral)";
const CORAL_LIGHT = "#f2bba7";
const OLIVE = "var(--green)";
const SLATE_BLUE = "#5b7a96";
const SLATE = "var(--slate)";
const INK = "var(--ink)";

const heartPath = "M50 86 C30 70 14 56 14 38 a18 18 0 0 1 36 -6 a18 18 0 0 1 36 6 c0 18 -16 32 -36 48Z";
const flamePath = "M52 12c2 14-6 20-10 30-2-6-4-10-8-14-8 12-14 22-14 34a30 30 0 0 0 60 0c0-20-14-30-28-50Z";
const flameInnerPath = "M50 50c-8 8-14 14-14 22a14 14 0 0 0 28 0c0-8-6-14-14-22Z";
const crownPath = "M16 32 36 50 50 26 64 50 84 32 76 74H24Z";
const xPath = "M30 30 70 70 M70 30 30 70";
const starPath = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`;

function withShadow(shape: ReactNode, shadowShape: ReactNode) {
  return (
    <>
      <g transform="translate(4 5)" fill={SHADOW} stroke={SHADOW}>{shadowShape}</g>
      {shape}
    </>
  );
}

const icons: Record<string, ReactNode> = {
  "❤️": withShadow(<path d={heartPath} fill={CORAL} />, <path d={heartPath} />),
  "🔥": withShadow(
    <>
      <path d={flamePath} fill={CORAL} />
      <path d={flameInnerPath} fill={CORAL_LIGHT} />
    </>,
    <path d={flamePath} />,
  ),
  "👏": withShadow(
    <>
      <path d={crownPath} fill={OLIVE} />
      <rect x="24" y="62" width="52" height="12" fill={SLATE} />
      <circle cx="16" cy="32" r="7" fill={CORAL} />
      <circle cx="50" cy="24" r="7" fill={CORAL} />
      <circle cx="84" cy="32" r="7" fill={CORAL} />
      <circle cx="50" cy="48" r="6" fill={SLATE_BLUE} />
    </>,
    <>
      <path d={crownPath} />
      <circle cx="16" cy="32" r="7" />
      <circle cx="50" cy="24" r="7" />
      <circle cx="84" cy="32" r="7" />
    </>,
  ),
  "👎": withShadow(
    <path d={xPath} stroke={SLATE_BLUE} strokeWidth="14" strokeLinecap="round" fill="none" />,
    <path d={xPath} strokeWidth="14" strokeLinecap="round" fill="none" />,
  ),
  "✨": withShadow(
    <>
      <path d={starPath(50, 54, 34)} fill={CORAL} />
      <path d={starPath(22, 24, 14)} fill={OLIVE} />
      <path d={starPath(80, 82, 12)} fill={SLATE_BLUE} />
      <circle cx="80" cy="22" r="5" fill={INK} />
    </>,
    <>
      <path d={starPath(50, 54, 34)} />
      <path d={starPath(22, 24, 14)} />
      <path d={starPath(80, 82, 12)} />
    </>,
  ),
};

type ReactionIconProps = {
  reaction: string;
  size?: number;
  className?: string;
};

export function ReactionIcon({ reaction, size = 22, className }: ReactionIconProps) {
  const icon = icons[reaction];
  if (!icon) return <span className={className}>{reaction}</span>;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {icon}
    </svg>
  );
}
