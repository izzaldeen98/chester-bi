type AlertVariant = "error" | "success" | "warning" | "info";

interface CAlertProps {
  variant?: AlertVariant;
  message: string;
  className?: string;
}

const styles: Record<AlertVariant, { wrapper: string; dot: string }> = {
  error: {
    wrapper: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400",
    dot: "bg-red-500",
  },
  success: {
    wrapper: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-400",
    dot: "bg-green-500",
  },
  warning: {
    wrapper: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-800 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
  info: {
    wrapper: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400",
    dot: "bg-blue-500",
  },
};

export default function CAlert({ variant = "error", message, className = "" }: CAlertProps) {
  const s = styles[variant];
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${s.wrapper} ${className}`}
    >
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
