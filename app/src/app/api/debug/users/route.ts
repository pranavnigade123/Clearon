/**
 * Debug API - Check users in Supabase
 * Temporary endpoint to debug authentication issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // List all users (admin only)
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return user info (without sensitive data)
    const users = data.users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: user.user_metadata,
    }));

    return NextResponse.json({
      total_users: users.length,
      users: users,
    });

  } catch (error) {
    console.error('Debug users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}