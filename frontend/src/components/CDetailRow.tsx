import type { ReactNode } from "react";

interface CDetailRowProps {
  label: string;
  value?: ReactNode;
  className?: string;
}

/* A line in a service record: painted label, value on the right. */
export default function CDetailRow({ label, value, className = "" }: CDetailRowProps) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${className}`}
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="label shrink-0">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px]" style={{ color: "var(--text)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}
