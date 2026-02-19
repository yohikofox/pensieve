import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAdminService {
  private adminClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    // Initialize Supabase client with SERVICE ROLE key (admin privileges)
    this.adminClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_SERVICE_KEY') || '', // ⚠️ Admin key, not anon key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  /**
   * Delete user from Supabase Auth (Admin API)
   *
   * Requires SERVICE_ROLE_KEY (not anon key)
   */
  async deleteUser(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(
        `Failed to delete Supabase user ${userId}: ${error.message}`,
      );
    }

    console.log(`✅ Deleted Supabase auth user: ${userId}`);
  }

  /**
   * Get user profile from Supabase (for export)
   */
  async getUserProfile(userId: string): Promise<any> {
    const { data, error } =
      await this.adminClient.auth.admin.getUserById(userId);

    if (error || !data?.user) {
      throw new Error(
        `Failed to fetch user profile: ${error?.message || 'User not found'}`,
      );
    }

    const user = data.user;

    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      auth_provider: user.app_metadata?.provider || 'email',
    };
  }

  /**
   * Verify user password (for account deletion confirmation)
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const { data, error } = await this.adminClient.auth.signInWithPassword({
      email,
      password,
    });
    return !error && !!data.user;
  }

  /**
   * List all users from Supabase Auth (paginated, returns all pages)
   */
  async listAllUsers(): Promise<
    Array<{ id: string; email: string; created_at: string }>
  > {
    const allUsers: Array<{ id: string; email: string; created_at: string }> =
      [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await this.adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new Error(`Failed to list Supabase users: ${error.message}`);
      }

      const users = data?.users ?? [];
      for (const u of users) {
        if (u.email) {
          allUsers.push({ id: u.id, email: u.email, created_at: u.created_at });
        }
      }

      if (users.length < perPage) break;
      page++;
    }

    return allUsers;
  }

  /**
   * Force reset a user's password via Supabase Admin API
   *
   * Supabase is the source of truth for auth — never modify passwords directly in PostgreSQL.
   * Note: to be migrated to Better Auth admin API when Epic 15 is implemented.
   */
  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new Error(
        `Failed to reset password for user ${userId}: ${error.message}`,
      );
    }
  }
}
