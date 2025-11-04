import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  ApiOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  DashboardOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/auth.store';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * Main Admin Layout Component
 */
export const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    await authService.logout();
    clearAuth();
    navigate('/login');
  };

  // User dropdown menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  // Sidebar menu items
  const sidebarMenuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/'),
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: 'Users',
      onClick: () => navigate('/users'),
    },
    {
      key: '/roles',
      icon: <TeamOutlined />,
      label: 'Roles',
      onClick: () => navigate('/roles'),
    },
    {
      key: '/policies',
      icon: <SafetyOutlined />,
      label: 'Policies',
      onClick: () => navigate('/policies'),
    },
    {
      key: '/capabilities',
      icon: <AppstoreOutlined />,
      label: 'Capabilities',
      onClick: () => navigate('/capabilities'),
    },
    {
      key: '/endpoints',
      icon: <ApiOutlined />,
      label: 'Endpoints',
      onClick: () => navigate('/endpoints'),
    },
    {
      key: 'ui-management',
      icon: <AppstoreOutlined />,
      label: 'UI Management',
      children: [
        {
          key: '/ui-pages',
          label: 'UI Pages',
          onClick: () => navigate('/ui-pages'),
        },
        {
          key: '/page-actions',
          label: 'Page Actions',
          onClick: () => navigate('/page-actions'),
        },
      ],
    },
    {
      key: '/audit-logs',
      icon: <FileTextOutlined />,
      label: 'Audit Logs',
      onClick: () => navigate('/audit-logs'),
    },
  ];

  // Get current selected key from pathname
  const selectedKey = location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'LBE' : 'LBE Admin'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={sidebarMenuItems}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          }}
        >
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            style: { fontSize: 18, cursor: 'pointer' },
            onClick: () => setCollapsed(!collapsed),
          })}

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Space direction="vertical" size={0}>
                <Text strong>{user?.fullName || user?.username}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {user?.email}
                </Text>
              </Space>
            </Space>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
