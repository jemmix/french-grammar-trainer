export function BauhausBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = size === "lg" ? 28 : 20;
  const gap = size === "lg" ? "gap-1.5" : "gap-1";
  return (
    <div className={`flex items-center ${gap} ${className ?? ""}`}>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx="14" cy="14" r="11" fill="var(--color-primary)" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect x="3" y="3" width="22" height="22" rx="1" fill="var(--color-accent)" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <polygon points="14,3 25,25 3,25" fill="var(--color-ink)" />
      </svg>
    </div>
  );
}
