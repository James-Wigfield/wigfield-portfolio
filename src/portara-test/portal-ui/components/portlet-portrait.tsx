import { useId } from "react";

import { BOT, characterConfig } from "./office3d/palette";

/**
 * 2D bust of an agent's portlet robot - the same character the worker
 * appears as on the 3D office floor. Reads `characterConfig`, so the
 * accent shade, headphone band and proportions match the 3D unit
 * exactly. Pass the worker's id to get that unit's exact trims; without
 * it (e.g. the persona picker) the persona id seeds the variation.
 * Size it via className.
 */
export function PortletPortrait({
  sprite,
  workerId,
  animate = false,
  className = "size-10",
}: {
  sprite: string;
  workerId?: string;
  animate?: boolean;
  className?: string;
}) {
  const cfg = characterConfig(sprite, workerId || sprite);
  const glowId = useId();

  // Persona silhouette: pip reads short & round, otto tall & narrow.
  const headScale = cfg.scale.head;
  const bodyWidth = cfg.scale.width;
  // Stagger blink/sway phases so a list of units never animates in sync.
  const delay = { animationDelay: `-${cfg.phase.toFixed(2)}s` };

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`px-portlet ${animate ? "px-portlet--animate " : ""}${className}`}
    >
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* torso: chubby cream shell peeking in from the bottom */}
      <g transform={`translate(32 0) scale(${bodyWidth} 1) translate(-32 0)`}>
        <ellipse cx="32" cy="62" rx="16.5" ry="15" fill={BOT.shell} />
        {/* chest badge */}
        <rect x="27.5" y="55" width="9" height="6" rx="1.5" fill={cfg.accent} />
      </g>

      {/* head group - scaled per persona */}
      <g transform={`translate(32 33) scale(${headScale})`}>
        {/* antenna with glowing bobble (the dome overdraws its base) */}
        <rect x="-1" y="-25" width="2" height="10" fill={BOT.antenna} />
        <g className="px-portlet__bobble" style={delay}>
          <circle cx="0" cy="-25.5" r="3.4" fill={cfg.accent} filter={`url(#${glowId})`} />
        </g>

        {/* ear discs with the darker inner ring */}
        <circle cx="-17" cy="0" r="4.8" fill={cfg.accent} />
        <circle cx="-17" cy="0" r="2.2" fill={cfg.accentDark} />
        <circle cx="17" cy="0" r="4.8" fill={cfg.accent} />
        <circle cx="17" cy="0" r="2.2" fill={cfg.accentDark} />

        {/* dome */}
        <ellipse cx="0" cy="-1" rx="15.5" ry="14.5" fill={BOT.shell} />
        <path
          d="M -15.5 -1 A 15.5 14.5 0 0 0 15.5 -1 A 15.5 10 0 0 1 -15.5 -1 Z"
          fill={BOT.shellShade}
          opacity="0.55"
        />

        {/* headphone band over the dome (per-unit trim) */}
        {cfg.band && (
          <path
            d="M -16.5 -2 A 16.5 16.5 0 0 1 16.5 -2"
            fill="none"
            stroke={cfg.accentDark}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}

        {/* visor */}
        <rect x="-11.5" y="-6.5" width="23" height="13" rx="6.2" fill={BOT.visor} />

        {/* glowing cyan eyes */}
        <g className="px-portlet__eyes" style={delay} filter={`url(#${glowId})`}>
          <rect x="-6.2" y="-3" width="3.4" height="5.6" rx="1.4" fill={BOT.eye} />
          <rect x="2.8" y="-3" width="3.4" height="5.6" rx="1.4" fill={BOT.eye} />
        </g>
      </g>
    </svg>
  );
}
