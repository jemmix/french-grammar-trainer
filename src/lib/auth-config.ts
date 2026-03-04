import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { mangleUserId } from "./auth";
import { isUserAllowed } from "./allow-list";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account }) {
      if (!account?.providerAccountId) return false;
      const mangledId = await mangleUserId(account.providerAccountId);
      const allowed = await isUserAllowed(mangledId);
      if (!allowed) return `/denied?userId=${mangledId}`;
      return true;
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.mangledUserId = await mangleUserId(account.providerAccountId);
      }
      return token;
    },
    async session({ session, token }) {
      (session as unknown as Record<string, unknown>).mangledUserId =
        token.mangledUserId as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
