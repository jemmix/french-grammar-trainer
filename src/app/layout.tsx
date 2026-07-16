import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "~/next/styles/globals.css";
import { ProgressProvider } from "~/next/contexts/progress-context";
import { getSession, getProgressPowers } from "~/next/lib/server-session";
import { signCookie, COOKIE_MAX_AGE_S } from "~/auth/session-cookie";
import { env } from "~/next/env";
import { t } from "~/lang";
import { resolveTheme } from "~/config/theme";
import { ThemeProvider } from "~/next/themes";

const geist = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: t.meta.appTitle,
  description: t.meta.description,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const initialPowers = session.isLoggedIn
    ? await getProgressPowers(session.userId)
    : undefined;

  if (session.isLoggedIn && session.shouldRenew) {
    const newCookie = signCookie(session.userId, env.COOKIE_SECRET);
    (await cookies()).set("fgt-session", newCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_S,
      secure: process.env.NODE_ENV === "production",
    });
  }

  const theme = resolveTheme(env.NEXT_PUBLIC_THEME, env.NEXT_PUBLIC_LANG);

  return (
    <html lang={t.meta.langCode} data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bree+Serif&family=Jost:wght@300;400;500;600;700&family=Patua+One&family=Source+Code+Pro:wght@400;700&family=Spline+Sans:wght@400;500;600&family=Spline+Sans+Mono:wght@400;500&family=UnifrakturCook:wght@700&family=UnifrakturMaguntia&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={geist.className}>
        <ThemeProvider theme={theme}>
          <ProgressProvider
          initialPowers={initialPowers}
          initialUserId={session.isLoggedIn ? session.userId : null}
          initialIsLoggedIn={session.isLoggedIn}
          authEngine={env.AUTH_ENGINE}
        >
          {children}
        </ProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
