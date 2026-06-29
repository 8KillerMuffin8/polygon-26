import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: "guest" | "user";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "guest" | "user";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "guest" | "user";
  }
}
