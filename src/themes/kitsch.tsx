export function KitschBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = size === "lg" ? 26 : 18;
  const gap = size === "lg" ? "gap-2" : "gap-1.5";
  return (
    <div className={`flex items-center ${gap} ${className ?? ""}`}>
      <svg width={s} height={s} viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="13" cy="13" r="10" fill="var(--color-primary)" opacity="0.85" />
        <circle cx="13" cy="13" r="6" fill="white" opacity="0.3" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 26 26" fill="none" aria-hidden>
        <polygon
          points="13,1 16.5,9.5 25.5,10 18.5,16 20.5,25 13,20.5 5.5,25 7.5,16 0.5,10 9.5,9.5"
          fill="var(--color-accent)"
          opacity="0.9"
        />
      </svg>
      <svg width={s} height={s} viewBox="0 0 26 26" fill="none" aria-hidden>
        <rect
          x="4" y="4" width="18" height="18" rx="5"
          fill="#EC4899"
          opacity="0.85"
        />
        <rect
          x="8" y="8" width="10" height="10" rx="3"
          fill="white" opacity="0.25"
        />
      </svg>
    </div>
  );
}
