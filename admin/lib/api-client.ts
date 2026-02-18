const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class ApiClient {
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    // Automatically read token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // ========================================
  // Users Management
  // ========================================

  async getUsers(params: PaginationParams) {
    const query = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
      ...(params.search && { search: params.search }),
    });
    return this.fetch<PaginatedResponse<User>>(`/api/admin/users?${query}`);
  }

  async getUserDetails(userId: string) {
    return this.fetch<UserDetails>(`/api/admin/users/${userId}`);
  }

  async assignRole(userId: string, data: AssignRoleDto) {
    return this.fetch(`/api/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeRole(userId: string, roleId: string) {
    return this.fetch(`/api/admin/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  async grantPermission(userId: string, data: GrantPermissionDto) {
    return this.fetch(`/api/admin/users/${userId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokePermission(userId: string, permissionId: string) {
    return this.fetch(`/api/admin/users/${userId}/permissions/${permissionId}`, {
      method: 'DELETE',
    });
  }

  async resetUserPassword(userId: string, newPassword: string) {
    return this.fetch<{ message: string }>(
      `/api/admin/users/${userId}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }
    );
  }

  async syncUsersFromSupabase() {
    return this.fetch<{ message: string; created: number; updated: number; unchanged: number }>(
      `/api/admin/users/sync-from-supabase`,
      { method: 'POST' }
    );
  }

  // ========================================
  // Roles Management
  // ========================================

  async getRoles() {
    return this.fetch<Role[]>(`/api/admin/roles`);
  }

  async createRole(data: CreateRoleDto) {
    return this.fetch<{ message: string; role: Role }>(`/api/admin/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRole(roleId: string, data: UpdateRoleDto) {
    return this.fetch<{ message: string; role: Role }>(
      `/api/admin/roles/${roleId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteRole(roleId: string) {
    return this.fetch<{ message: string }>(`/api/admin/roles/${roleId}`, {
      method: 'DELETE',
    });
  }

  async assignRolePermissions(roleId: string, data: AssignPermissionsDto) {
    return this.fetch<{ message: string }>(
      `/api/admin/roles/${roleId}/permissions`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // ========================================
  // Permissions Management
  // ========================================

  async getPermissions() {
    return this.fetch<Permission[]>(`/api/admin/permissions`);
  }

  async getPermissionsByResource() {
    return this.fetch<Record<string, Permission[]>>(
      `/api/admin/permissions/by-resource`
    );
  }

  // ========================================
  // Subscription Tiers Management
  // ========================================

  async getTiers() {
    return this.fetch<Tier[]>(`/api/admin/tiers`);
  }

  async createTier(data: CreateTierDto) {
    return this.fetch<{ message: string; tier: Tier }>(`/api/admin/tiers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTier(tierId: string, data: UpdateTierDto) {
    return this.fetch<{ message: string; tier: Tier }>(
      `/api/admin/tiers/${tierId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteTier(tierId: string) {
    return this.fetch<{ message: string }>(`/api/admin/tiers/${tierId}`, {
      method: 'DELETE',
    });
  }

  async assignTierPermissions(tierId: string, data: AssignPermissionsDto) {
    return this.fetch<{ message: string }>(
      `/api/admin/tiers/${tierId}/permissions`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getTierUsers(tierId: string) {
    return this.fetch<User[]>(`/api/admin/tiers/${tierId}/users`);
  }

  // ========================================
  // Stats & Monitoring
  // ========================================

  async getUserStats() {
    return this.fetch<UserStats>(`/api/admin/stats/users`);
  }

  async getSubscriptionStats() {
    return this.fetch<SubscriptionStats>(`/api/admin/stats/subscriptions`);
  }

  async getContentStats() {
    return this.fetch<ContentStats>(`/api/admin/stats/content`);
  }

  async getSystemStats() {
    return this.fetch<SystemStats>(`/api/admin/stats/system`);
  }
}

export const apiClient = new ApiClient();

// ========================================
// Types
// ========================================

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserDetails {
  user: User;
  roles: Array<{
    id: string;
    name: string;
    displayName: string;
    expiresAt?: string;
  }>;
  permissions: Array<{
    id: string;
    name: string;
    displayName: string;
    granted: boolean;
    expiresAt?: string;
  }>;
  subscription: {
    id: string;
    tier: string;
    status: string;
    expiresAt?: string;
  } | null;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissionsCount?: number;
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  resourceType: string;
  action: string;
  isPaidFeature: boolean;
}

export interface Tier {
  id: string;
  name: string;
  priceMonthly: number;
  isActive: boolean;
  permissionsCount?: number;
}

export interface AssignRoleDto {
  roleId: string;
  expiresAt?: string;
}

export interface GrantPermissionDto {
  permissionId: string;
  granted: boolean;
  expiresAt?: string;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  isSystemRole: boolean;
  permissionIds: string[];
}

export interface UpdateRoleDto {
  name?: string;
  displayName?: string;
  permissionIds?: string[];
}

export interface CreateTierDto {
  name: string;
  priceMonthly: number;
  isActive: boolean;
  permissionIds: string[];
}

export interface UpdateTierDto {
  name?: string;
  priceMonthly?: number;
  isActive?: boolean;
  permissionIds?: string[];
}

export interface AssignPermissionsDto {
  permissionIds: string[];
}

export interface UserStats {
  total: number;
  active: number;
  deleted: number;
  recentUsers: number;
  growthRate: number;
}

export interface SubscriptionStats {
  tierStats: Array<{
    tierName: string;
    subscribers: number;
    revenue: number;
  }>;
  totalRevenue: number;
}

export interface ContentStats {
  thoughts: { total: number; recent: number };
  ideas: { total: number; recent: number };
  todos: { total: number; recent: number };
}

export interface SystemStats {
  database: string;
  timestamp: string;
}
