import type { ReactNode } from "react";
import { Readout } from "./Board";

interface CMetricCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  trend?: string;
  up?: boolean;
  className?: string;
}

/* The old stat card is gone. What survives is the figure itself, printed
   on the board — no tile, no icon chip, no "all good" trend line. The
   `icon`, `trend` and `up` props are accepted and ignored so existing
   callers keep working while pages are converted. */
export default function CMetricCard({ label, value, className = "" }: CMetricCardProps) {
  return (
    <div className={className}>
      <Readout value={value} label={label} />
    </div>
  );
}
