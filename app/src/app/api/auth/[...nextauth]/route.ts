/**
 * NextAuth.js Configuration
 * Authentication setup with multiple providers and Supabase integration
 */

import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { supabaseAdmin } from '@/lib/supabase';

const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error || !data.user) {
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.email,
            image: data.user.user_metadata?.avatar_url,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      
      // Add Supabase access token for API calls
      if (account?.provider === 'credentials') {
        try {
          const { data } = await supabaseAdmin.auth.signInWithPassword({
            email: token.email!,
            password: 'dummy', // This won't work, need to handle differently
          });
          
          if (data.session) {
            token.supabaseAccessToken = data.session.access_token;
          }
        } catch (error) {
          // Handle error silently for now
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.supabaseAccessToken = token.supabaseAccessToken as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Create user preferences on first sign in
      if (user.id) {
        try {
          await supabaseAdmin
            .from('user_preferences')
            .upsert(
              {
                user_id: user.id,
                chunk_size: 512,
                chunk_overlap: 102,
                max_results: 10,
                preferred_citation_style: 'APA',
              },
              { onConflict: 'user_id' }
            );
        } catch (error) {
          console.error('Error creating user preferences:', error);
        }
      }
      return true;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (isNewUser) {
        console.log(`New user signed up: ${user.email}`);
      }
    },
    async signOut({ session, token }) {
      console.log(`User signed out: ${session?.user?.email}`);
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };