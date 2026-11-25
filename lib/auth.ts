import { NextAuthOptions, getServerSession } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      id: "guest-login",
      name: "Guest Login",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@flowmeet.ai" },
        name: { label: "Name", type: "text", placeholder: "Demo User" },
      },
      async authorize(credentials) {
        const email = credentials?.email || "demo@flowmeet.ai";
        const name = credentials?.name || "Demo User";

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // JWT sessions outlive the database rows they point at: after a reset or a
    // restore the cookie stays valid while the user is gone, so session.user.id
    // no longer matches any User row and every insert fails with P2003
    // (foreign key violation). Re-attach the token to a real row on each read.
    jwt: async ({ token, user }) => {
      if (user?.id) token.sub = user.id

      if (!token.sub) return token

      const email = token.email
      const existing = email
        ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
        : await prisma.user.findUnique({ where: { id: token.sub }, select: { id: true } })

      if (existing) {
        token.sub = existing.id
        return token
      }

      if (!email) {
        // Cannot recreate an account without an email; drop the stale identity
        // so the request is treated as signed out.
        token.sub = undefined
        return token
      }

      const created = await prisma.user
        .create({
          data: {
            id: token.sub,
            email,
            name: typeof token.name === "string" ? token.name : null,
            image: typeof token.picture === "string" ? token.picture : null,
          },
          select: { id: true },
        })
        .catch(async () =>
          // Another request may have created the same email first.
          prisma.user.findUnique({ where: { email }, select: { id: true } })
        )

      token.sub = created?.id
      return token
    },
    session: ({ session, token }) => {
      if (token && session.user) {
        (session.user as any).id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
}

export const getAuthSession = () => getServerSession(authOptions)
