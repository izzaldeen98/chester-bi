interface CSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export default function CSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  required = false,
  disabled = false,
  error,
  className = "",
}: CSelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium" style={{ color: "var(--text-h)" }}>
          {label}
          {required && <span className="ml-0.5 text-[var(--accent)]">*</span>}
        </label>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className={`
          w-full rounded-xl border bg-[var(--bg)] px-3.5 py-2.5 text-sm
          outline-none transition-all appearance-none cursor-pointer
          focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]
          disabled:cursor-not-allowed disabled:opacity-50
          ${error ? "border-red-400 focus:border-red-400 focus:ring-red-200" : "border-[var(--border)]"}
          ${value ? "text-[var(--text-h)]" : "text-[var(--text)]"}
        `}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23a8a29e' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.875rem center",
          paddingRight: "2.5rem",
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
