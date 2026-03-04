"use client";

import Link from "next/link";

/**
 * Google's branded "Sign in with Google" button.
 * Follows Google Identity branding guidelines:
 * - White background, #1f1f1f text
 * - Google "G" multicolor logo
 * - Roboto Medium 14px
 * - 40px height, 4px border-radius
 * - Specific padding ratios
 *
 * Supports both `onClick` (button) and `href` (Next.js Link) modes.
 */

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

const standardClass =
  "inline-flex items-center justify-center gap-3 h-10 pl-3 pr-4 rounded bg-white border border-[#dadce0] shadow-[0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] hover:shadow-[0_1px_3px_0_rgba(60,64,67,.3),0_4px_8px_3px_rgba(60,64,67,.15)] hover:bg-[#f8f9fa] active:bg-[#e8eaed] transition-all duration-150";

function StandardContent({ label }: { label: string }) {
  return (
    <>
      <GoogleLogo size={18} />
      <span
        className="text-sm font-medium text-[#1f1f1f] tracking-[0.25px] whitespace-nowrap"
        style={{ fontFamily: "'Roboto', 'Arial', sans-serif" }}
      >
        {label}
      </span>
    </>
  );
}

type GoogleSignInButtonProps = {
  label?: string;
  disabled?: boolean;
} & ({ onClick: () => void; href?: never } | { href: string; onClick?: never });

export function GoogleSignInButton({
  label = "Sign in with Google",
  disabled = false,
  ...rest
}: GoogleSignInButtonProps) {
  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} className={standardClass}>
        <StandardContent label={label} />
      </Link>
    );
  }

  return (
    <button
      onClick={"onClick" in rest ? rest.onClick : undefined}
      disabled={disabled}
      className={`${standardClass} cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:shadow-none`}
    >
      <StandardContent label={label} />
    </button>
  );
}
