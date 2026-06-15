function CDetailRow({ label, value }: { label: string; value?: string | null }) {
    if (value == null || value === "") return null;
    return (
      <div className="flex flex-col gap-0.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text)" }}>
          {label}
        </span>
        <span className="text-sm" style={{ color: "var(--text-h)" }}>{value}</span>
      </div>
    );
  }

export default CDetailRow;