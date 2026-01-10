/**
 * Sign Up API Route
 * Handle user registration with Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: name,
      },
      email_confirm: false, // Skip email confirmation for development
    });

    if (error) {
      console.error('Signup error:', error);
      
      // Handle specific error cases
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to create account' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create user preferences
    try {
      await supabaseAdmin
        .from('user_preferences')
        .insert({
          user_id: data.user.id,
          chunk_size: 512,
          chunk_overlap: 102,
          max_results: 10,
          preferred_citation_style: 'APA',
        });
    } catch (prefError) {
      console.error('Error creating user preferences:', prefError);
      // Don't fail the signup if preferences creation fails
    }

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}