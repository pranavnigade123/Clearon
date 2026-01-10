/**
 * NextAuth.js Type Extensions
 * Extend default NextAuth types with custom properties
 */

import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
    };
    supabaseAccessToken?: string;
  }

  interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    supabaseAccessToken?: string;
  }
}