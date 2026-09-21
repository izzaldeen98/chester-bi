import type { ReactNode } from "react";

interface CTextInputProps {
  label?: string;
  type?: "text" | "email" | "password" | "number" | "search";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
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
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--text)" }}>
          {label}
          {required && <span style={{ color: "var(--text-3)" }}> *</span>}
        </span>
      )}
      <span className="relative flex items-center">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 flex items-center" style={{ color: "var(--text-3)" }}>
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full px-2.5 py-1.5 text-[13.5px] outline-none transition-colors
            placeholder:text-[var(--text-3)] focus:border-[var(--accent)] disabled:opacity-50
            ${icon ? "pl-8" : ""}`}
          style={{
            background: "var(--surface)",
            border: `1px solid ${error ? "var(--danger)" : "var(--border-strong)"}`,
            borderRadius: "var(--r-sm)",
            color: "var(--text)",
          }}
        />
      </span>
      {error && (
        <span className="mt-1 block text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </label>
  );
}
