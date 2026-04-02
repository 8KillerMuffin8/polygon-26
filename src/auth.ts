import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ profile }) {
      const allowed = process.env.ALLOWED_EMAILS;
      if (allowed) {
        const emails = allowed.split(",").map((e) => e.trim());
        return emails.includes(profile?.email ?? "");
      }
      return true;
    },
  },
});
