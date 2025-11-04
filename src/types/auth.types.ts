/**
 * Type definitions for authentication and authorization
 */

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  roles?: UserRole[];
}

export interface UserRole {
  id: number;
  name: string;
  description?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  message?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  roleIds?: number[];
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  fullName?: string;
}

export interface UpdateUserRolesRequest {
  roleIds: number[];
}

export interface Policy {
  id: number;
  name: string;
  description?: string;
  endpoints?: Endpoint[];
}

export interface Endpoint {
  id: number;
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UIPage {
  id: number;
  path: string;
  name: string;
  icon?: string;
  parentPageId?: number;
  orderIndex?: number;
  description?: string;
}

export interface PageAction {
  id: number;
  pageId: number;
  label: string;
  action: string;
  endpointId?: number;
  displayOrder?: number;
  icon?: string;
  variant?: string;
  isActive?: boolean;
  description?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: number;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  requestData?: string;
  responseData?: string;
  timestamp: string;
  success: boolean;
}

export interface PermissionResponse {
  user: User;
  roles: UserRole[];
  policies: Policy[];
  endpoints: Endpoint[];
  pages: UIPage[];
  actions: PageAction[];
}

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}
