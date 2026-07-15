import Link from "next/link";

export function KitschBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? 32 : 22;
  const w = size === "lg" ? 40 : 28;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 56 56"
      className={className}
      aria-hidden
    >
      <rect x="0" y="0" width="56" height="18.67" fill="#0A0A0A" />
      <rect x="0" y="18.67" width="56" height="18.67" fill="#DD0000" />
      <rect x="0" y="37.34" width="56" height="18.66" fill="#FFCC00" />
    </svg>
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
    <header>
      <div
        className="h-3 w-full"
        style={{
          background:
            "linear-gradient(to bottom, #0A0A0A 0%, #0A0A0A 33.33%, #DD0000 33.33%, #DD0000 66.66%, #FFCC00 66.66%, #FFCC00 100%)",
          backgroundSize: "100% 200%",
          animation: "flagWave 3s ease-in-out infinite alternate",
        }}
      />

      <div className="bg-paper-warm border-b-[3px] border-ink">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {brandMark}
            <span
              className="text-xs font-bold tracking-[0.1em] uppercase text-ink"
              style={{ fontFamily: '"Source Code Pro", monospace' }}
            >
              {levelLabel}
            </span>
          </div>
          {authControls}
        </div>
      </div>

      <div
        className="relative overflow-hidden bg-ink text-accent"
        style={{ borderBottom: "6px double var(--color-accent)" }}
      >
        <div
          className="absolute top-2 left-0 right-0 text-center tracking-[0.3em] opacity-30 pointer-events-none text-accent text-sm"
          aria-hidden
        >
          ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦ ✦
        </div>
        <div
          className="absolute bottom-0 left-0 right-0 h-3"
          style={{
            background:
              "linear-gradient(to right, #0A0A0A 0%, #0A0A0A 33.33%, #DD0000 33.33%, #DD0000 66.66%, #FFCC00 66.66%, #FFCC00 100%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-14 relative z-10">
          <div>
            <h1
              className="text-3xl md:text-5xl lg:text-6xl leading-[0.95] mb-3"
              style={{
                fontFamily: '"UnifrakturCook", serif',
                textShadow: "3px 3px 0 #DD0000, 6px 6px 0 rgba(0,0,0,0.3)",
              }}
            >
              {heading}
            </h1>
            <p
              className="text-base md:text-lg italic max-w-xl"
              style={{ fontFamily: '"Bree Serif", serif' }}
            >
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 justify-center py-5 flex-wrap bg-surface">
        <span
          className="inline-block border-4 border-ink px-4 py-1.5 text-sm uppercase tracking-widest -rotate-2"
          style={{
            fontFamily: '"Patua One", serif',
            background: "#FFCC00",
            color: "#0A0A0A",
            boxShadow: "4px 4px 0 #0A0A0A",
          }}
        >
          ★ Made in Germany ★
        </span>
        <span
          className="inline-block border-4 px-4 py-1.5 text-sm uppercase tracking-widest rotate-2"
          style={{
            fontFamily: '"Patua One", serif',
            borderColor: "#FFCC00",
            background: "#DD0000",
            color: "#FFCC00",
            boxShadow: "4px 4px 0 #0A0A0A",
          }}
        >
          Qualität Seit 1919
        </span>
        <span
          className="hidden sm:inline-block border-4 px-4 py-1.5 text-sm uppercase tracking-widest -rotate-1"
          style={{
            fontFamily: '"Patua One", serif',
            borderColor: "#FFCC00",
            background: "#0A0A0A",
            color: "#FFCC00",
            boxShadow: "4px 4px 0 #0A0A0A",
          }}
        >
          100% Duden-Konform
        </span>
      </div>
    </header>
  );
}

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
