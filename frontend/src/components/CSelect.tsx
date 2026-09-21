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
    <label className={`block ${className}`}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium" style={{ color: "var(--text)" }}>
          {label}
          {required && <span style={{ color: "var(--text-3)" }}> *</span>}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none py-1.5 pl-2.5 pr-8 text-[13.5px] outline-none transition-colors
          focus:border-[var(--accent)] disabled:opacity-50"
        style={{
          background: "var(--surface)",
          border: `1px solid ${error ? "var(--danger)" : "var(--border-strong)"}`,
          borderRadius: "var(--r-sm)",
          color: value ? "var(--text)" : "var(--text-3)",
          backgroundImage:
            "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
          backgroundPosition: "calc(100% - 14px) center, calc(100% - 9px) center",
          backgroundSize: "5px 5px, 5px 5px",
          backgroundRepeat: "no-repeat",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="mt-1 block text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </label>
  );
}
