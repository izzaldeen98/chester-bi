import type { CSSProperties } from "react";

interface CLogoProps {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Chester BI mark — a C drawn as a radial bar chart: three concentric bands
 * of decreasing length (see assets/brand). Below 24px it switches to the
 * two-band small-size cut so the gaps stay open. */
export default function CLogo({ size = 24, color = "var(--brand-mark)", className, style }: CLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path fill={color} d={size < 24 ? SMALL : FULL} />
    </svg>
  );
}

const FULL =
  "M217.07 50.93A109 109 0 1 0 217.07 205.07A11 11 0 0 0 201.52 189.52A87 87 0 1 1 201.52 66.48A11 11 0 0 0 217.07 50.93Z" +
  "M191.62 76.38A73 73 0 1 0 115.03 196.6A11 11 0 0 0 122.56 175.92A51 51 0 1 1 176.06 91.94A11 11 0 0 0 191.62 76.38Z" +
  "M166.16 101.84A37 37 0 0 0 105.23 140.65A11 11 0 0 0 125.9 133.13A15 15 0 0 1 150.61 117.39A11 11 0 0 0 166.16 101.84Z";

const SMALL = "M216.37 51.63 A108.0 108.0 0 1 0 216.37 204.37 A16.0 16.0 0 0 0 193.74 181.74 A76.0 76.0 0 1 1 193.74 74.26 A16.0 16.0 0 0 0 216.37 51.63 Z M178.18 89.82 A54.0 54.0 0 0 0 101.82 166.18 A16.0 16.0 0 0 0 124.44 143.56 A22.0 22.0 0 0 1 155.56 112.44 A16.0 16.0 0 0 0 178.18 89.82 Z";
