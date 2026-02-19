import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

/**
 * BetterAuthAdminService — ADR-029
 *
 * Uses direct PostgreSQL queries on Better Auth tables + better-auth/crypto utilities.
 *
 * Better Auth tables: "user", "session", "account", "verification"
 * Password hashing: scrypt via better-auth/crypto (same algorithm as Better Auth login)
 */
@Injectable()
export class BetterAuthAdminService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Get user profile from Better Auth's user table
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    createdAt: Date;
    role: string;
  }> {
    const result = await this.dataSource.query(
      `SELECT id, email, "createdAt", role FROM "user" WHERE id = $1`,
      [userId],
    );

    if (!result[0]) {
      throw new Error(`User not found: ${userId}`);
    }

    return result[0] as { id: string; email: string; createdAt: Date; role: string };
  }

  /**
   * Delete user from Better Auth (CASCADE removes sessions, accounts, verifications)
   */
  async deleteUser(userId: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  }

  /**
   * Verify user password by checking against the hashed password in the account table.
   * Uses better-auth/crypto verifyPassword (scrypt) — same algorithm as Better Auth login.
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT a.password
       FROM "account" a
       JOIN "user" u ON a."userId" = u.id
       WHERE u.email = $1 AND a."providerId" = 'credential'`,
      [email],
    );

    if (!result[0]?.password) return false;

    return verifyPassword({
      hash: result[0].password as string,
      password,
    });
  }

  /**
   * List all users from Better Auth's user table
   */
  async listAllUsers(): Promise<
    Array<{ id: string; email: string; created_at: string }>
  > {
    const users = await this.dataSource.query(
      `SELECT id, email, "createdAt" as created_at FROM "user" ORDER BY "createdAt" ASC`,
    );
    return users as Array<{ id: string; email: string; created_at: string }>;
  }

  /**
   * Reset a user's password via direct database update.
   * Uses better-auth/crypto hashPassword (scrypt) — compatible with Better Auth login.
   */
  async resetUserPassword(
    userId: string,
    newPassword: string,
  ): Promise<void> {
    const hashed = await hashPassword(newPassword);

    await this.dataSource.query(
      `UPDATE "account" SET password = $1
       WHERE "userId" = $2 AND "providerId" = 'credential'`,
      [hashed, userId],
    );
  }
}
