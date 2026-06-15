import { useState } from "react";
import { RiLockPasswordFill } from "react-icons/ri";
import { FaEye } from "react-icons/fa";


interface CTextInputProps {
  label?: string;
  type?: "text" | "email" | "password" | "number" | "search";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}

export default function CTextInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  error,
  required = false,
  disabled = false,
  autoComplete,
  className = "",
}: CTextInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
          {label}
          {required && <span className="ml-0.5 text-[var(--accent)]">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Left icon */}
        {icon && (
          <span
            className="pointer-events-none absolute left-3 text-base"
            style={{ color: "var(--text)" }}
          >
            {icon}
          </span>
        )}

        <input
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`
            w-full rounded-xl border bg-[var(--bg)] py-2.5 text-sm
            text-[var(--text-h)] placeholder:text-[var(--text)]
            outline-none transition-all
            focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? "border-red-400 focus:border-red-400 focus:ring-red-200" : "border-[var(--border)]"}
            ${icon ? "pl-9" : "pl-3.5"}
            ${isPassword ? "pr-10" : "pr-3.5"}
          `}
        />

        {/* Password toggle */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 cursor-pointer transition-colors"
            style={{ color: "var(--text)" }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <FaEye size={16} />
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
