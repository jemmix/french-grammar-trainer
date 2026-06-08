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
    <header className="bg-surface border-b-2 border-ink">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {brandMark}
              <div className="h-5 w-px bg-ink" />
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted">
                {levelLabel}
              </p>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-wide uppercase text-ink leading-none">
              {heading}
            </h1>
            <div className="mt-4 h-1 w-16 bg-accent" />
            <p className="mt-4 text-base text-muted max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
          {authControls}
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

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
  const shared = `card group block h-full border-2 border-ink bg-surface p-6 transition-all duration-150 ${className ?? ""}`;
  if (available && href) {
    return <Link href={href} className={shared}>{children}</Link>;
  }
  return <div className={`${shared} opacity-40 bg-paper-warm`}>{children}</div>;
}
