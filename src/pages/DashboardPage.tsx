import React from 'react';
import { Card, Row, Col, Statistic, Typography, Space } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

/**
 * Dashboard Page Component
 */
export const DashboardPage: React.FC = () => {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={2}>Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Roles"
              value={0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Policies"
              value={0}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Endpoints"
              value={0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Welcome to LBE Admin Portal">
        <Space direction="vertical" size="middle">
          <p>
            This is your central hub for managing the LBE platform's authentication
            and authorization system.
          </p>
          <p>From here you can:</p>
          <ul>
            <li>Manage users, roles, and permissions</li>
            <li>Configure policies and capabilities</li>
            <li>Register and manage API endpoints</li>
            <li>Configure UI pages and actions</li>
            <li>View audit logs and system activity</li>
          </ul>
          <p>
            Use the sidebar navigation to explore different sections of the admin portal.
          </p>
        </Space>
      </Card>
    </Space>
  );
};
