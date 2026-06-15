interface CMetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  up?: boolean | null;
  className?: string;
}

export default function CMetricCard({
  label,
  value,
  icon,
  trend,
  up,
  className = "",
}: CMetricCardProps) {
  const trendColor =
    up === true ? "#16a34a" : up === false ? "#dc2626" : "var(--text)";

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl p-5 transition-shadow hover:shadow-md ${className}`}
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
          {label}
        </span>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: "var(--accent-muted)",
            color: "var(--accent)",
            border: "1px solid var(--accent-ring)",
          }}
        >
          {icon}
        </span>
      </div>

      <p
        className="text-3xl font-extrabold tracking-tight"
        style={{ color: "var(--text-h)" }}
      >
        {value}
      </p>

      {trend && (
        <p
          className="flex items-center gap-1 text-xs"
          style={{ color: trendColor }}
        >
          {up === true && "↑ "}
          {up === false && "↓ "}
          {trend}
        </p>
      )}
    </div>
  );
}
