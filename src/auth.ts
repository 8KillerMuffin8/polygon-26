import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      authorize: async () => ({
        id: "guest",
        name: "Guest",
        email: "guest@local",
        role: "guest" as const,
      }),
    }),
  ],
  callbacks: {
    signIn({ profile, account }) {
      if (account?.provider === "guest") {
        return true;
      }
      const allowed = process.env.ALLOWED_EMAILS;
      if (allowed) {
        const emails = allowed.split(",").map((e) => e.trim());
        return emails.includes(profile?.email ?? "");
      }
      return true;
    },
    jwt({ token, user, account }) {
      if (user) {
        token.role =
          user.role ?? (account?.provider === "guest" ? "guest" : "user");
      }
      return token;
    },
    session({ session, token }) {
      const role = token.role;
      session.user.role = role === "guest" || role === "user" ? role : "user";
      return session;
    },
  },
});
