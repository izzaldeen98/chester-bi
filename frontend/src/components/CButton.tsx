import CSpinner from "./CSpinner";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

interface CButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-105 active:scale-95 shadow-sm",
  outline:
    "bg-transparent border border-[var(--border)] text-[var(--text-h)] hover:bg-[var(--bg-subtle)] active:scale-95",
  ghost:
    "bg-transparent text-[var(--text)] hover:bg-[var(--bg-subtle)] active:scale-95",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-sm dark:bg-red-700 dark:hover:bg-red-600",
};

export default function CButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = "primary",
  type = "button",
  fullWidth = false,
  className = "",
}: CButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex cursor-pointer items-center justify-center gap-2
        rounded-xl px-5 py-2.5 text-sm font-semibold
        transition-all duration-150
        disabled:cursor-not-allowed disabled:opacity-50
        ${variantStyles[variant]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {loading && <CSpinner size={15} />}
      {children}
    </button>
  );
}
