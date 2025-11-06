// @ts-nocheck
import axios from 'axios';

// Import queryClient to clear cache on 403
let queryClient: any = null;
export const setQueryClient = (client: any) => {
  queryClient = client;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) window.location.href = '/login';
    }
    // Handle 403 Forbidden - Access Denied
    if (error.response?.status === 403) {
      console.error('Access Denied (403):', error.response?.data);
      // Clear all query cache to prevent showing stale data
      if (queryClient) {
        queryClient.clear();
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    login: (username, password) => apiClient.post('/api/auth/login', { username, password }),
    logout: () => apiClient.post('/api/auth/logout'),
    getUIConfig: () => apiClient.get('/api/auth/ui-config'),
  },
  users: {
    getAll: () => apiClient.get('/api/auth/users'),
    getById: (userId) => apiClient.get('/api/auth/users/' + userId),
    getRoles: (userId) => apiClient.get('/api/auth/users/' + userId + '/roles'),
    create: (userData) => apiClient.post('/api/auth/users', userData),
    update: (userId, userData) => apiClient.put('/api/auth/users/' + userId, userData),
    delete: (userId) => apiClient.delete('/api/auth/users/' + userId),
    updateStatus: (userId, enabled) => apiClient.put('/api/auth/users/' + userId + '/status?enabled=' + enabled),
    updateRoles: (userId, roleIds) => apiClient.put('/api/auth/users/' + userId + '/roles', roleIds),
  },
  roles: {
    getAll: () => apiClient.get('/api/admin/roles'),
    create: (roleData) => apiClient.post('/api/admin/roles', roleData),
    update: (roleId, roleData) => apiClient.put('/api/admin/roles/' + roleId, roleData),
    delete: (roleId) => apiClient.delete('/api/admin/roles/' + roleId),
    getPolicies: (roleId) => apiClient.get('/api/role-policies/role/' + roleId + '/policies'),
    assignPolicies: (roleId, policyIds) => apiClient.post('/api/role-policies/assign-multiple', { roleId, policyIds }),
    removePolicy: (roleId, policyId) => apiClient.delete('/api/role-policies/remove?roleId=' + roleId + '&policyId=' + policyId),
    replacePolicies: (roleId, policyIds) => apiClient.put('/api/role-policies/replace', { roleId, policyIds }),
  },
  rolePolicies: {
    getAll: () => apiClient.get('/api/role-policies'),
    assignPolicy: (roleId, policyId) => apiClient.post('/api/role-policies/assign', { roleId, policyId }),
    assignMultiple: (roleId, policyIds) => apiClient.post('/api/role-policies/assign-multiple', { roleId, policyIds }),
    remove: (roleId, policyId) => apiClient.delete('/api/role-policies/remove?roleId=' + roleId + '&policyId=' + policyId),
    replacePolicies: (roleId, policyIds) => apiClient.put('/api/role-policies/replace', { roleId, policyIds }),
    getPoliciesForRole: (roleId) => apiClient.get('/api/role-policies/role/' + roleId + '/policies'),
    getRolesForPolicy: (policyId) => apiClient.get('/api/role-policies/policy/' + policyId + '/roles'),
  },
  policies: {
    getAll: () => apiClient.get('/api/admin/policies'),
    getById: (policyId) => apiClient.get('/api/admin/policies/' + policyId),
    create: (policyData) => apiClient.post('/api/admin/policies', policyData),
    update: (policyId, policyData) => apiClient.put('/api/admin/policies/' + policyId, policyData),
    delete: (policyId) => apiClient.delete('/api/admin/policies/' + policyId),
    getEndpoints: (policyId) => apiClient.get('/api/admin/policies/' + policyId + '/endpoints'),
    updateEndpoints: (policyId, endpointIds) => apiClient.put('/api/admin/policies/' + policyId + '/endpoints', { endpointIds }),
    addEndpoints: (policyId, endpointIds) => apiClient.post('/api/admin/policies/' + policyId + '/endpoints', endpointIds),
    removeEndpoint: (policyId, endpointId) => apiClient.delete('/api/admin/policies/' + policyId + '/endpoints/' + endpointId),
  },
  endpoints: {
    getAll: () => apiClient.get('/api/admin/endpoints'),
    create: (endpointData) => apiClient.post('/api/admin/endpoints', endpointData),
    update: (endpointId, endpointData) => apiClient.put('/api/admin/endpoints/' + endpointId, endpointData),
    delete: (endpointId) => apiClient.delete('/api/admin/endpoints/' + endpointId),
    getPolicies: (endpointId) => apiClient.get('/api/admin/endpoints/' + endpointId + '/policies'),
    assignPolicies: (endpointId, policyIds) => apiClient.post('/api/admin/endpoints/' + endpointId + '/policies', policyIds),
    removePolicy: (endpointId, policyId) => apiClient.delete('/api/admin/endpoints/' + endpointId + '/policies/' + policyId),
  },
  uiPages: {
    getAll: () => apiClient.get('/api/admin/ui-pages'),
    create: (pageData) => apiClient.post('/api/admin/ui-pages', pageData),
    update: (pageId, pageData) => apiClient.put('/api/admin/ui-pages/' + pageId, pageData),
    delete: (pageId) => apiClient.delete('/api/admin/ui-pages/' + pageId),
  },
  pageActions: {
    getAll: () => apiClient.get('/api/admin/page-actions'),
    getById: (actionId) => apiClient.get('/api/admin/page-actions/' + actionId),
    getByPageId: (pageId) => apiClient.get('/api/admin/page-actions/page/' + pageId),
    create: (actionData) => apiClient.post('/api/admin/page-actions', actionData),
    update: (actionId, actionData) => apiClient.put('/api/admin/page-actions/' + actionId, actionData),
    delete: (actionId) => apiClient.delete('/api/admin/page-actions/' + actionId),
  },
  meta: {
    getUiAccessMatrix: (pageId) => apiClient.get('/api/meta/ui-access-matrix/' + pageId),
    getAllUiAccessMatrix: () => apiClient.get('/api/meta/ui-access-matrix'),
    getUserAccessMatrix: (userId) => apiClient.get('/api/meta/user-access-matrix/' + userId),
    getServiceCatalog: () => apiClient.get('/api/meta/service-catalog'),
  },
};

export default apiClient;
