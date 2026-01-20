/**
 * Shared Authentication Configuration
 * NextAuth options that can be imported by API routes
 */

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabaseAdmin } from '@/lib/supabase';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials');
          return null;
        }

        try {
          // List all users and find by email
          const { data, error } = await supabaseAdmin.auth.admin.listUsers();

          if (error) {
            console.error('Error listing users:', error.message);
            return null;
          }

          // Find user by email
          const user = data.users.find(u => u.email === credentials.email);

          if (!user) {
            console.log('User not found:', credentials.email);
            return null;
          }

          console.log('User found:', user.email);

          // Return user data for NextAuth
          return {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email,
            image: user.user_metadata?.avatar_url,
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
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // If this is the first sign in, user object will be available
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        
        // Create/update user in our database via API call
        try {
          console.log(`🔄 Syncing user: ${user.email}`);
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              avatar_url: user.image,
              provider: account?.provider || 'credentials'
            })
          });
          
          if (response.ok) {
            const userData = await response.json();
            token.userId = userData.id;
            console.log(`✅ User synced: ${userData.id}`);
          } else {
            console.error(`❌ Sync failed: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error('❌ User sync failed:', error?.message || error);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // Use the database user ID if available, otherwise fall back to token ID
        session.user.id = (token.userId as string) || (token.id as string);
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      try {
        console.log(`✅ Sign-in: ${user.email} (${account?.provider || 'credentials'})`);
        return true;
      } catch (error) {
        console.error('❌ Sign-in error:', error);
        return false;
      }
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
  debug: false, // Disable verbose NextAuth logs
  logger: {
    error(code, metadata) {
      console.error(`[AUTH ERROR] ${code}:`, metadata?.message || metadata);
    },
    warn(code) {
      // Suppress warnings
    },
    debug(code, metadata) {
      // Suppress debug logs
    }
  },
};