/**
 * Next.js Middleware
 * Authentication and route protection
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add custom logic here if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect dashboard and API routes
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token;
        }
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          // Allow public API routes
          const publicRoutes = ['/api/auth', '/api/health'];
          const isPublicRoute = publicRoutes.some(route => 
            req.nextUrl.pathname.startsWith(route)
          );
          
          if (isPublicRoute) {
            return true;
          }
          
          // Require authentication for other API routes
          return !!token;
        }
        
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/documents/:path*',
    '/api/query/:path*',
    '/api/user/:path*',
  ],
};