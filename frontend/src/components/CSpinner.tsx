interface CSpinnerProps {
  size?: number;
  className?: string;
}

export default function CSpinner({ size = 18, className = "" }: CSpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-label="Loading"
    />
  );
}
