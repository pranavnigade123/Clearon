import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, name, avatar_url, provider } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Check if user already exists in our users table
    const { data: existingUsers, error: queryError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (queryError) {
      console.error('❌ DB Query Error:', queryError.message);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    let user;

    if (existingUsers && existingUsers.length > 0) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          name,
          avatar_url,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single();

      if (updateError) {
        console.error('❌ User Update Error:', updateError.message);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
      }

      console.log(`✅ User updated: ${email}`);
      user = updatedUser;
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          name,
          avatar_url,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ User Creation Error:', insertError.message);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      console.log(`✅ New user created: ${email}`);
      user = newUser;

      // Create default preferences for new user
      await supabaseAdmin
        .from('user_preferences')
        .insert({ user_id: user.id });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('❌ User Sync Error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}