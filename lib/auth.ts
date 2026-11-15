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
