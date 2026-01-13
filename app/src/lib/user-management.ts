/**
 * Proper User Management System
 * Handles account linking and user profile management
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthProvider {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  auth_user_id: string;
  created_at: string;
}

/**
 * Get user by auth.uid() - works with any auth provider
 */
export async function getCurrentUser(authUserId: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_current_user')
      .single();

    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Create or link user account
 * Handles both new users and account linking
 */
export async function createOrLinkUser(
  email: string,
  name: string,
  provider: string,
  providerUserId: string,
  authUserId: string,
  avatarUrl?: string
): Promise<User | null> {
  try {
    // Check if user with this email already exists
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    let userId: string;

    if (existingUser) {
      // User exists, link this auth method
      userId = existingUser.id;
      
      // Update user info if needed
      await supabaseAdmin
        .from('users')
        .update({
          name: name,
          avatar_url: avatarUrl || existingUser.avatar_url,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          name,
          avatar_url: avatarUrl,
          last_login_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return null;
      }

      userId = newUser.id;

      // Create user preferences
      await supabaseAdmin
        .from('user_preferences')
        .insert({
          user_id: userId,
          chunk_size: 512,
          chunk_overlap: 102,
          max_results: 10,
        });
    }

    // Link auth provider (if not already linked)
    await supabaseAdmin
      .from('user_auth_providers')
      .insert({
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        auth_user_id: authUserId,
      })
      .onConflict('auth_user_id')
      .ignoreDuplicates();

    // Return the user
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return user;

  } catch (error) {
    console.error('Error in createOrLinkUser:', error);
    return null;
  }
}

/**
 * Get user's auth providers
 */
export async function getUserAuthProviders(userId: string): Promise<AuthProvider[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_auth_providers')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting auth providers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserAuthProviders:', error);
    return [];
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<User, 'name' | 'avatar_url'>>
): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return null;
  }
}

/**
 * Delete user and all associated data
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    // Get all auth providers for this user
    const authProviders = await getUserAuthProviders(userId);

    // Delete from auth.users for each provider
    for (const provider of authProviders) {
      await supabaseAdmin.auth.admin.deleteUser(provider.auth_user_id);
    }

    // Delete user (cascades to all related tables)
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('Error deleting user:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return false;
  }
}