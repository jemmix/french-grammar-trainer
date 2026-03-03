import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "~/styles/globals.css";
import { ProgressProvider } from "~/contexts/progress-context";
import { getSession, getProgressPowers } from "~/lib/server-session";
import { signCookie, COOKIE_MAX_AGE_S } from "~/lib/session-cookie";
import { env } from "~/env";
import { t } from "~/lang";

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
    ? getProgressPowers(session.userId)
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

  return (
    <html lang="fr">
      <body className={geist.className}>
        <ProgressProvider
          initialPowers={initialPowers}
          initialUserId={session.isLoggedIn ? session.userId : null}
          initialIsLoggedIn={session.isLoggedIn}
        >
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
