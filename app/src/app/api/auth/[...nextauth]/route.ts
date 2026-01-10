/**
 * NextAuth.js Configuration
 * Authentication setup with multiple providers and Supabase integration
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };