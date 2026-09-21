interface CSpinnerProps {
  size?: number;
  className?: string;
}

export default function CSpinner({ size = 16, className = "" }: CSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        opacity: 0.65,
        flexShrink: 0,
      }}
    />
  );
}
