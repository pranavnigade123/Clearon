/**
 * User Service - Production Ready User Management
 * Handles user operations with the new schema
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface UserWithProviders extends User {
  auth_providers: string[];
}

/**
 * Get current user by auth.uid()
 * Works with any authentication provider
 */
export async function getCurrentUser(): Promise<UserWithProviders | null> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_current_user_info')
      .single();

    if (error) {
      console.error('Error getting current user:', error);
      return null;
    }

    return {
      id: data.user_id,
      email: data.email,
      name: data.name,
      avatar_url: data.avatar_url,
      is_active: true,
      created_at: '',
      updated_at: '',
      auth_providers: data.auth_providers || [],
    };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
}

/**
 * Get user by user ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
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
 * Get user's authentication providers
 */
export async function getUserAuthProviders(userId: string) {
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
 * Get user statistics
 */
export async function getUserStats(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_user_document_stats', { target_user_id: userId })
      .single();

    if (error) {
      console.error('Error getting user stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return null;
  }
}