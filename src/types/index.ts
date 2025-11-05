// User types
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissionVersion: number;
  boardId?: string;
  employerId?: string;
  roles?: Role[];
}

// Role types
export interface Role {
  id: number;
  name: string;
  description?: string;
  policies?: Policy[];
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

// Policy types
export interface Policy {
  id: number;
  name: string;
  description?: string;
  type: string; // RBAC, ABAC, CUSTOM
  policyType?: string; // PERMISSION, CONDITIONAL, ROW_LEVEL, TIME_BASED
  conditions?: any; // JSONB conditions for ABAC scenarios
  /** @deprecated Use RolePolicy relationship instead */
  expression?: string; // JSON expression (deprecated)
  isActive: boolean;
  roles?: Role[];
  endpoints?: Endpoint[];
  createdAt?: string;
  updatedAt?: string;
}

// RolePolicy junction entity types
export interface RolePolicy {
  id: number;
  roleId: number;
  policyId: number;
  roleName?: string;
  policyName?: string;
  assignedAt: string;
  assignedBy?: number;
  isActive: boolean;
  conditions?: any; // Optional JSONB conditions
  priority?: number; // Policy precedence
}

// Endpoint types
export interface Endpoint {
  id: number;
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  isActive: boolean;
  policies?: Policy[];
  createdAt?: string;
  updatedAt?: string;
}

// UI Page types
export interface UIPage {
  id: number;
  label: string;
  route: string;
  icon?: string;
  parentId?: number;
  displayOrder: number;
}

// Page Action types
export interface PageAction {
  id: number;
  pageId: number;
  label: string;
  action: string;
  icon?: string;
  variant?: string;
  displayOrder?: number;
  isActive?: boolean;
  endpointId?: number;
  endpoint?: Endpoint;
  page?: UIPage;
  createdAt?: string;
  updatedAt?: string;
}

// Audit Log types
export interface AuditLog {
  id: number;
  userId: number;
  username: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  requestData?: any;
  responseStatus?: number;
  createdAt: string;
}

// Form types for User operations
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  roleIds?: number[];
  boardId?: string;
  employerId?: string;
  isActive?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  fullName?: string;
  boardId?: string;
  employerId?: string;
  isActive?: boolean;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
