import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App as AntApp } from 'antd';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { Policies } from './pages/Policies';
import { Endpoints } from './pages/Endpoints';
import { PageWorkspace } from './pages/PageWorkspace';
import { AuditLogs } from './pages/AuditLogs';
import { AccessVisualization } from './pages/AccessVisualization';
import { PolicyEndpointRelationship } from './pages/relationships/PolicyEndpointRelationship';
import { UserRoleRelationship } from './pages/relationships/UserRoleRelationship';
import { RolePolicyRelationship } from './pages/relationships/RolePolicyRelationship';
import { PageActionAssignment } from './pages/relationships/PageActionAssignment';
import { PageActionEndpointAssignment } from './pages/relationships/PageActionEndpointAssignment';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { setQueryClient } from './services/api';

// Create a query client for React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
  refetchOnWindowFocus: true,
  retry: false,
  staleTime: 0,
    },
  },
});

// Set the queryClient in the api module for access in interceptors
setQueryClient(queryClient);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <AntApp>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="users/roles" element={<UserRoleRelationship />} />
              <Route path="roles" element={<Roles />} />
              <Route path="roles/policies" element={<RolePolicyRelationship />} />
              <Route path="policies" element={<Policies />} />
              <Route path="policies/endpoints" element={<PolicyEndpointRelationship />} />
              <Route path="endpoints" element={<Endpoints />} />
              <Route path="pages" element={<PageWorkspace />} />
              <Route path="pages/actions" element={<PageActionAssignment />} />
              <Route path="page-actions" element={<PageWorkspace />} />
              <Route path="page-actions/endpoints" element={<PageActionEndpointAssignment />} />
              <Route path="access-visualization" element={<AccessVisualization />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
