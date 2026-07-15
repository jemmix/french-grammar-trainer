import Link from "next/link";

export function BauhausBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = size === "lg" ? 20 : 14;
  const gap = size === "lg" ? "gap-1.5" : "gap-1";
  return (
    <div className={`flex items-center ${gap} ${className ?? ""}`}>
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle
          cx="10"
          cy="10"
          r="9"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
        <circle cx="10" cy="10" r="3" fill="var(--color-primary)" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="1" y="1" width="18" height="18" fill="var(--color-ink)" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 20 20" fill="none" aria-hidden>
        <polygon
          points="10,1 19,18 1,18"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function BauhausHomeHeader({
  heading,
  subtitle,
  levelLabel,
  authControls,
  brandMark,
}: {
  heading: string;
  subtitle: string;
  levelLabel: string;
  authControls: React.ReactNode;
  brandMark: React.ReactNode;
}) {
  return (
    <header>
      <div className="bg-surface border-b border-chalk">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {brandMark}
            <span
              className="text-[11px] uppercase tracking-[0.18em] text-muted"
              style={{ fontFamily: '"Spline Sans Mono", monospace' }}
            >
              {levelLabel}
            </span>
          </div>
          {authControls}
        </div>
      </div>

      <div className="bg-paper-warm">
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <div className="flex items-start justify-between gap-8 md:gap-12">
            <div className="flex-1 min-w-0">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-3 text-ink"
                style={{
                  fontFamily: '"Jost", sans-serif',
                  fontWeight: 600,
                  letterSpacing: "-0.035em",
                }}
              >
                {heading}
              </h1>
              <p className="text-base text-muted max-w-xl leading-relaxed">
                {subtitle}
              </p>
            </div>
            <div className="hidden md:block shrink-0">
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                aria-hidden
              >
                <circle
                  cx="30"
                  cy="30"
                  r="24"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="30"
                  cy="30"
                  r="5"
                  fill="var(--color-primary)"
                />
                <rect
                  x="62"
                  y="6"
                  width="48"
                  height="48"
                  fill="var(--color-ink)"
                />
                <polygon
                  points="62,114 86,66 110,114"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function BauhausSectionCard({
  available,
  href,
  className,
  children,
}: {
  available: boolean;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const shared = `card group block h-full bg-surface p-6 ${className ?? ""}`;
  if (available && href) {
    return (
      <Link href={href} className={shared}>
        {children}
      </Link>
    );
  }
  return (
    <div className={`${shared} opacity-45 bg-paper-warm`}>{children}</div>
  );
}
