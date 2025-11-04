import { api, apiClient } from './api.client';
import { API_ENDPOINTS } from '../config/api.config';
import type {
  LoginRequest,
  LoginResponse,
  User,
  UpdateUserRequest,
  RegisterRequest,
} from '../types/auth.types';

/**
 * Authentication Service
 * Handles all auth-related API calls
 */
export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(
      API_ENDPOINTS.auth.login,
      credentials
    );
    
    // Store token and user info
    if (response.data.token) {
      apiClient.setToken(response.data.token);
      apiClient.setUser(response.data.user);
    }
    
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.auth.logout);
    } finally {
      // Clear auth data regardless of API response
      apiClient.clearAuth();
    }
  },

  /**
   * Get UI configuration for current user
   */
  async getUIConfig() {
    const response = await api.get(API_ENDPOINTS.auth.uiConfig);
    return response.data;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return apiClient.isAuthenticated();
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    return apiClient.getUser() as User | null;
  },
};

/**
 * User Management Service
 * Handles user CRUD operations
 */
export const userService = {
  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    const response = await api.get<User[]>(API_ENDPOINTS.users.list);
    return response.data;
  },

  /**
   * Get users by role
   */
  async getUsersByRole(role: string): Promise<User[]> {
    const response = await api.get<User[]>(API_ENDPOINTS.users.byRole(role));
    return response.data;
  },

  /**
   * Create new user
   */
  async createUser(userData: RegisterRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(
      API_ENDPOINTS.users.create,
      userData
    );
    return response.data;
  },

  /**
   * Update user
   */
  async updateUser(userId: number, userData: UpdateUserRequest): Promise<User> {
    const response = await api.put<{ userId: number; username: string; email: string; fullName: string }>(
      API_ENDPOINTS.users.update(userId),
      userData
    );
    return response.data as unknown as User;
  },

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: number): Promise<void> {
    await api.delete(API_ENDPOINTS.users.delete(userId));
  },

  /**
   * Update user status (enable/disable)
   */
  async updateUserStatus(userId: number, enabled: boolean): Promise<void> {
    await api.put(API_ENDPOINTS.users.updateStatus(userId), null, {
      params: { enabled },
    });
  },

  /**
   * Update user roles
   */
  async updateUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await api.put(API_ENDPOINTS.users.updateRoles(userId), roleIds);
  },

  /**
   * Invalidate user tokens
   */
  async invalidateUserTokens(userId: number): Promise<void> {
    await api.post(API_ENDPOINTS.users.invalidateTokens(userId));
  },
};

/**
 * Role Service
 * Handles role-related operations
 */
export const roleService = {
  /**
   * Get all roles
   */
  async getAllRoles(): Promise<string[]> {
    const response = await api.get<string[]>(API_ENDPOINTS.roles.list);
    return response.data;
  },
};
