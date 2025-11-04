/**
 * API Configuration
 * Central configuration for API endpoints and settings
 */

export const API_CONFIG = {
  // Base URL for the auth service
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  
  // Timeout for API requests (30 seconds)
  timeout: 30000,
  
  // JWT token key in localStorage
  tokenKey: 'lbe_admin_token',
  
  // User info key in localStorage
  userKey: 'lbe_admin_user',
} as const;

export const API_ENDPOINTS = {
  // Auth endpoints
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    uiConfig: '/api/auth/ui-config',
  },
  
  // User management endpoints
  users: {
    list: '/api/auth/users',
    create: '/api/auth/users',
    update: (userId: number) => `/api/auth/users/${userId}`,
    delete: (userId: number) => `/api/auth/users/${userId}`,
    updateStatus: (userId: number) => `/api/auth/users/${userId}/status`,
    updateRoles: (userId: number) => `/api/auth/users/${userId}/roles`,
    invalidateTokens: (userId: number) => `/api/auth/users/${userId}/invalidate-tokens`,
    byRole: (role: string) => `/api/auth/users/role/${role}`,
  },
  
  // Roles endpoint (currently available)
  roles: {
    list: '/api/auth/roles',
  },
  
  // Future endpoints (to be implemented in backend)
  admin: {
    roles: {
      list: '/api/auth/admin/roles',
      create: '/api/auth/admin/roles',
      update: (roleId: number) => `/api/auth/admin/roles/${roleId}`,
      delete: (roleId: number) => `/api/auth/admin/roles/${roleId}`,
      users: (roleId: number) => `/api/auth/admin/roles/${roleId}/users`,
      policies: (roleId: number) => `/api/auth/admin/roles/${roleId}/policies`,
      assignPolicies: (roleId: number) => `/api/auth/admin/roles/${roleId}/policies`,
      removePolicy: (roleId: number, policyId: number) => 
        `/api/auth/admin/roles/${roleId}/policies/${policyId}`,
    },
    policies: {
      list: '/api/auth/admin/policies',
      create: '/api/auth/admin/policies',
      update: (policyId: number) => `/api/auth/admin/policies/${policyId}`,
      delete: (policyId: number) => `/api/auth/admin/policies/${policyId}`,
      capabilities: (policyId: number) => `/api/auth/admin/policies/${policyId}/capabilities`,
      addCapabilities: (policyId: number) => `/api/auth/admin/policies/${policyId}/capabilities`,
      removeCapability: (policyId: number, capId: number) => 
        `/api/auth/admin/policies/${policyId}/capabilities/${capId}`,
      endpoints: (policyId: number) => `/api/auth/admin/policies/${policyId}/endpoints`,
      addEndpoints: (policyId: number) => `/api/auth/admin/policies/${policyId}/endpoints`,
      removeEndpoint: (policyId: number, endpointId: number) => 
        `/api/auth/admin/policies/${policyId}/endpoints/${endpointId}`,
      roles: (policyId: number) => `/api/auth/admin/policies/${policyId}/roles`,
    },
    capabilities: {
      list: '/api/auth/admin/capabilities',
      create: '/api/auth/admin/capabilities',
      update: (capId: number) => `/api/auth/admin/capabilities/${capId}`,
      delete: (capId: number) => `/api/auth/admin/capabilities/${capId}`,
      policies: (capId: number) => `/api/auth/admin/capabilities/${capId}/policies`,
    },
    endpoints: {
      list: '/api/auth/admin/endpoints',
      create: '/api/auth/admin/endpoints',
      update: (endpointId: number) => `/api/auth/admin/endpoints/${endpointId}`,
      delete: (endpointId: number) => `/api/auth/admin/endpoints/${endpointId}`,
      policies: (endpointId: number) => `/api/auth/admin/endpoints/${endpointId}/policies`,
      addPolicies: (endpointId: number) => `/api/auth/admin/endpoints/${endpointId}/policies`,
      removePolicy: (endpointId: number, policyId: number) => 
        `/api/auth/admin/endpoints/${endpointId}/policies/${policyId}`,
    },
    uiPages: {
      list: '/api/auth/admin/ui-pages',
      create: '/api/auth/admin/ui-pages',
      update: (pageId: number) => `/api/auth/admin/ui-pages/${pageId}`,
      delete: (pageId: number) => `/api/auth/admin/ui-pages/${pageId}`,
      actions: (pageId: number) => `/api/auth/admin/ui-pages/${pageId}/actions`,
    },
    pageActions: {
      list: '/api/auth/admin/page-actions',
      create: '/api/auth/admin/page-actions',
      update: (actionId: number) => `/api/auth/admin/page-actions/${actionId}`,
      delete: (actionId: number) => `/api/auth/admin/page-actions/${actionId}`,
    },
    audit: {
      list: '/api/auth/admin/audit-logs',
      detail: (logId: number) => `/api/auth/admin/audit-logs/${logId}`,
      export: '/api/auth/admin/audit-logs/export',
    },
  },
} as const;
