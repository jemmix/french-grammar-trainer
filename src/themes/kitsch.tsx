export function KitschBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const s = size === "lg" ? 28 : 20;
  const gap = size === "lg" ? "gap-2" : "gap-1.5";
  return (
    <div className={`flex items-center ${gap} ${className ?? ""}`}>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <defs>
          <linearGradient id="kg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <path d="M14 2C14 2 20 6 24 10C28 14 24 22 14 26C4 22 0 14 4 10C8 6 14 2 14 2Z" fill="url(#kg1)" />
        <path d="M14 6C14 6 18 9 20 12C22 15 20 20 14 22C8 20 6 15 8 12C10 9 14 6 14 6Z" fill="white" opacity="0.2" />
      </svg>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <defs>
          <linearGradient id="kg2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
        </defs>
        <polygon
          points="14,0.5 17.2,9.8 27,10.5 19.6,16.8 21.8,26.5 14,21.5 6.2,26.5 8.4,16.8 1,10.5 10.8,9.8"
          fill="url(#kg2)"
        />
        <polygon
          points="14,5 16.2,11.5 23,12 17.8,16 19.3,23 14,19.5 8.7,23 10.2,16 5,12 11.8,11.5"
          fill="white" opacity="0.15"
        />
      </svg>
      <svg width={s} height={s} viewBox="0 0 28 28" fill="none" aria-hidden>
        <defs>
          <linearGradient id="kg3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        <path d="M14 5C15.5 2 20 2 21 5C23 2 27 4 25 8C28 8 27 13 24 13C27 15 24 20 21 18C22 22 17 24 14 21C11 24 6 22 7 18C4 20 1 15 4 13C1 13 0 8 3 8C1 4 5 2 7 5C8 2 12.5 2 14 5Z" fill="url(#kg3)" />
        <circle cx="14" cy="13" r="4" fill="white" opacity="0.25" />
      </svg>
    </div>
  );
}

export function KitschHomeHeader({
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
    <header className="bg-surface relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#EC4899]/3 blur-3xl" />
        <svg className="absolute top-4 right-20 w-6 h-6 text-accent/20 animate-spin" style={{ animationDuration: "20s" }} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,0.5 15.2,9.8 25,10.5 17.6,16.8 19.8,26.5 12,21.5 4.2,26.5 6.4,16.8 -1,10.5 8.8,9.8" />
        </svg>
        <svg className="absolute bottom-8 left-32 w-5 h-5 text-primary/15 animate-spin" style={{ animationDuration: "15s", animationDirection: "reverse" }} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,0.5 15.2,9.8 25,10.5 17.6,16.8 19.8,26.5 12,21.5 4.2,26.5 6.4,16.8 -1,10.5 8.8,9.8" />
        </svg>
        <svg className="absolute top-12 left-1/3 w-4 h-4 text-[#EC4899]/15 animate-spin" style={{ animationDuration: "25s" }} viewBox="0 0 24 24" fill="currentColor">
          <polygon points="12,0.5 15.2,9.8 25,10.5 17.6,16.8 19.8,26.5 12,21.5 4.2,26.5 6.4,16.8 -1,10.5 8.8,9.8" />
        </svg>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 md:py-14 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-5">
              {brandMark}
              <span className="text-xs font-extrabold tracking-[0.15em] uppercase bg-gradient-to-r from-primary via-[#A855F7] to-accent bg-clip-text text-transparent">
                {levelLabel}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight bg-gradient-to-br from-ink via-primary to-[#EC4899] bg-clip-text text-transparent leading-tight">
              {heading}
            </h1>
            <p className="mt-4 text-lg text-muted max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
          {authControls}
        </div>
      </div>

      <div className="h-2 bg-gradient-to-r from-primary via-accent to-[#EC4899]" />
    </header>
  );
}

import Link from "next/link";

export function KitschSectionCard({
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
    return <Link href={href} className={shared}>{children}</Link>;
  }
  return <div className={`${shared} opacity-45 bg-paper-warm`}>{children}</div>;
}
