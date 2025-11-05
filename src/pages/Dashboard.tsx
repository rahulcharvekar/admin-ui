import { Card, Row, Col, Statistic, Typography, Spin, Alert } from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  LockOutlined,
  ApiOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const { Title } = Typography;

interface ServiceCatalogResponse {
  endpoints: Record<string, any[]>;
  pages: any[];
  version: number;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  
  // Fetch service catalog for counts
  const { data: serviceCatalog, isLoading: catalogLoading, error: catalogError } = useQuery<ServiceCatalogResponse>({
    queryKey: ['service-catalog'],
    queryFn: async () => {
      const response = await api.meta.getServiceCatalog();
      return response.data;
    },
  });

  // Fetch users count
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.users.getAll();
      return response.data;
    },
  });

  // Fetch roles count
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.roles.getAll();
      return response.data;
    },
  });

  // Fetch policies count
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data;
    },
  });

  const userCount = Array.isArray(users) ? users.length : 0;
  const roleCount = Array.isArray(roles) ? roles.length : 0;
  const policyCount = Array.isArray(policies) ? policies.length : 0;

  // Calculate counts from service catalog
  const endpointCount = serviceCatalog?.endpoints 
    ? Object.values(serviceCatalog.endpoints).reduce((total, endpoints) => total + endpoints.length, 0)
    : 0;
  const pageCount = serviceCatalog?.pages ? serviceCatalog.pages.length : 0;

  const isLoading = catalogLoading || usersLoading || rolesLoading || policiesLoading;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>Dashboard</Title>

      {catalogError && (
        <Alert
          message="Error Loading Data"
          description="Failed to load service catalog. Some counts may be unavailable."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading dashboard data...</div>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              onClick={() => navigate('/users')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="Total Users"
                value={userCount}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              onClick={() => navigate('/roles')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="Total Roles"
                value={roleCount}
                prefix={<SafetyOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              onClick={() => navigate('/policies')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="Total Policies"
                value={policyCount}
                prefix={<LockOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              onClick={() => navigate('/endpoints')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="Total Endpoints"
                value={endpointCount}
                prefix={<ApiOutlined />}
                valueStyle={{ color: '#eb2f96' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              onClick={() => navigate('/pages')}
              style={{ cursor: 'pointer' }}
            >
              <Statistic
                title="Total UI Pages"
                value={pageCount}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};
