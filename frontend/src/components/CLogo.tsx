import type { CSSProperties } from "react";

interface CLogoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Chester BI mark — three rounded bars of ascending height resting on a base
 * band (a jester's cap read as a bar chart, see assets/logo.svg). */
export default function CLogo({ size = 24, color = "#eab308", className, style }: CLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <g fill={color}>
        <rect x="62" y="100" width="24" height="88" rx="12" />
        <rect x="108" y="55" width="24" height="133" rx="12" />
        <rect x="154" y="85" width="24" height="103" rx="12" />
        <rect x="48" y="165" width="144" height="23" rx="11.5" />
      </g>
    </svg>
  );
}
