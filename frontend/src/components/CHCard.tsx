interface CHCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  initials: string;
  avatarBg?: string;
  badge?: {
    label: string;
    variant: "green" | "red" | "yellow" | "gray" | "blue";
  };
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

const badgeStyles: Record<string, string> = {
  green:  "bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-400",
  red:    "bg-red-100    text-red-700    dark:bg-red-900/40    dark:text-red-400",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  gray:   "bg-stone-100  text-stone-600  dark:bg-stone-800     dark:text-stone-400",
  blue:   "bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-400",
};

export default function CHCard({
  title,
  subtitle,
  meta,
  initials,
  avatarBg = "var(--accent-muted)",
  badge,
  isSelected = false,
  onClick,
  className = "",
}: CHCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      style={{
        background: isSelected ? "var(--accent-muted)" : "var(--bg-subtle)",
        border: isSelected
          ? "1px solid var(--accent-ring)"
          : "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--accent-ring)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        }
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
        style={{
          background: avatarBg,
          color: "var(--accent)",
          border: "1px solid var(--accent-ring)",
        }}
      >
        {initials}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: "var(--text-h)" }}
        >
          {title}
        </p>
        {subtitle && (
          <p className="truncate text-xs" style={{ color: "var(--text)" }}>
            {subtitle}
          </p>
        )}
        {meta && (
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text)" }}>
            {meta}
          </p>
        )}
      </div>

      {/* Badge */}
      {badge && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            badgeStyles[badge.variant]
          }`}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
