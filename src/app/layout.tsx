import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "~/styles/globals.css";
import { ProgressProvider } from "~/contexts/progress-context";
import { getSession, getProgressPowers } from "~/lib/server-session";
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
