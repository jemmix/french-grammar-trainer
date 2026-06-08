export function LemondeBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? "h-8" : "h-6";
  const w = size === "lg" ? "w-1.5" : "w-1";
  return (
    <div className={`flex gap-0.5 ${className ?? ""}`}>
      <div className={`${w} ${h} rounded-full bg-primary`} />
      <div className={`${w} ${h} rounded-full bg-chalk`} />
      <div className={`${w} ${h} rounded-full bg-accent`} />
    </div>
  );
}

export function LemondeHomeHeader({
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
    <header className="border-b border-chalk bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              {brandMark}
              <p className="text-sm font-medium tracking-widest uppercase text-muted">
                {levelLabel}
              </p>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink">
              {heading}
            </h1>
            <p className="mt-3 text-lg text-muted max-w-2xl">
              {subtitle}
            </p>
          </div>
          {authControls}
        </div>
      </div>
    </header>
  );
}

export function LemondeSectionCard({
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
  const shared = `card group block h-full border border-chalk bg-surface p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${className ?? ""}`;
  if (available && href) {
    return <Link href={href} className={shared}>{children}</Link>;
  }
  return <div className={`${shared} opacity-55 bg-paper-warm border-chalk/60`}>{children}</div>;
}

import Link from "next/link";
