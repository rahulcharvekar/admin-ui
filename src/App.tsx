import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { Policies } from './pages/Policies';
import { Endpoints } from './pages/Endpoints';
import { Pages } from './pages/Pages';
import { PageActions } from './pages/PageActions';
import { AuditLogs } from './pages/AuditLogs';
import { AccessVisualization } from './pages/AccessVisualization';
import { PolicyEndpointRelationship } from './pages/relationships/PolicyEndpointRelationship';
import { UserRoleRelationship } from './pages/relationships/UserRoleRelationship';
import { RolePolicyRelationship } from './pages/relationships/RolePolicyRelationship';
import { PageActionAssignment } from './pages/relationships/PageActionAssignment';
import { PageActionEndpointAssignment } from './pages/relationships/PageActionEndpointAssignment';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

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
              <Route path="pages" element={<Pages />} />
              <Route path="pages/actions" element={<PageActionAssignment />} />
              <Route path="page-actions" element={<PageActions />} />
              <Route path="page-actions/endpoints" element={<PageActionEndpointAssignment />} />
              <Route path="access-visualization" element={<AccessVisualization />} />
              <Route path="audit-logs" element={<AuditLogs />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
