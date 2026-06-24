import type { IconType } from "react-icons";

type ToggleButtonItem = {
  label: string;
  value: string;
  disabled?: boolean;
  icon?: React.ReactNode | IconType;
};

type CToggleButtonsProps = {
  buttons: ToggleButtonItem[];
  selected: string;
  onChange: (value: string) => void;
  label?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
};

function renderIcon(icon: React.ReactNode | IconType, size: number) {
  if (!icon) return null;
  if (typeof icon === "function") {
    const Icon = icon;
    return <Icon size={size} />;
  }
  return icon;
}

const sizeStyles = {
  sm: {
    track: "gap-0.5 rounded-xl p-0.5",
    button: "gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
    icon: 11,
  },
  md: {
    track: "gap-1 rounded-xl p-1",
    button: "gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold",
    icon: 13,
  },
} as const;

export default function CToggleButtons({
  buttons,
  selected,
  onChange,
  label,
  size = "sm",
  fullWidth = false,
  className = "",
}: CToggleButtonsProps) {
  const styles = sizeStyles[size];

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : "w-auto"} ${className}`}>
      {label && (
        <span className="text-sm font-medium text-[var(--text-h)]">{label}</span>
      )}

      <div
        className={`
          inline-flex items-center border border-[var(--border)] bg-[var(--bg-subtle)]
          ${fullWidth ? "flex w-full" : "w-auto"}
          ${styles.track}
        `}
        role="group"
        aria-label={label}
      >
        {buttons.map((button) => {
          const isSelected = selected === button.value;

          return (
            <button
              key={button.value}
              type="button"
              disabled={button.disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(button.value)}
              className={`
                inline-flex flex-1 items-center justify-center
                outline-none transition-all duration-150
                focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]
                disabled:cursor-not-allowed disabled:opacity-50
                ${styles.button}
                ${
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-sm active:scale-95"
                    : "bg-transparent text-[var(--text)] hover:bg-[var(--bg)] hover:text-[var(--text-h)] active:scale-[0.98]"
                }
              `}
            >
              {button.icon != null && (
                <span className="inline-flex shrink-0 items-center">
                  {renderIcon(button.icon, styles.icon)}
                </span>
              )}
              {button.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
