import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout as AntLayout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  Space,
  Button,
  theme,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  SafetyOutlined,
  LockOutlined,
  ApiOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

export const Layout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      logout();
      navigate('/login');
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ fontWeight: 600 }}>{user?.fullName}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {user?.email}
          </Text>
        </div>
      ),
      disabled: true,
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

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'rbac',
      icon: <SafetyOutlined />,
      label: 'RBAC',
      children: [
        {
          key: '/endpoints',
          icon: <ApiOutlined />,
          label: 'Endpoints',
          onClick: () => navigate('/endpoints'),
        },
        {
          key: '/policies',
          icon: <LockOutlined />,
          label: 'Policies',
          onClick: () => navigate('/policies'),
        },
        {
          key: '/roles',
          icon: <SafetyOutlined />,
          label: 'Roles',
          onClick: () => navigate('/roles'),
        },
        {
          key: '/users',
          icon: <UserOutlined />,
          label: 'Users',
          onClick: () => navigate('/users'),
        },
      ],
    },
    {
      key: 'ui',
      icon: <AppstoreOutlined />,
      label: 'UI',
      children: [
        {
          key: '/pages',
          icon: <FileTextOutlined />,
          label: 'Pages & Actions',
          onClick: () => navigate('/pages'),
        },
      ],
    },
    {
      key: 'linkage',
      icon: <ApiOutlined />,
      label: 'Linkage',
      children: [
        {
          key: '/policies/endpoints',
          icon: <LockOutlined />,
          label: 'Policies → Endpoints',
          onClick: () => navigate('/policies/endpoints'),
        },
        {
          key: '/roles/policies',
          icon: <SafetyOutlined />,
          label: 'Roles → Policies',
          onClick: () => navigate('/roles/policies'),
        },
        {
          key: '/users/roles',
          icon: <UserOutlined />,
          label: 'Users → Roles',
          onClick: () => navigate('/users/roles'),
        },
      ],
    },
    {
      key: '/access-visualization',
      icon: <PartitionOutlined />,
      label: 'Access Visualization',
      children: [
        {
          key: '/access-visualization/user',
          label: 'User Access Tree',
          onClick: () => navigate('/access-visualization/user'),
        },
        {
          key: '/access-visualization/ui',
          label: 'UI Access Tree',
          onClick: () => navigate('/access-visualization/ui'),
        },
      ],
    },
    {
      key: '/audit-logs',
      icon: <AuditOutlined />,
      label: 'Audit Logs',
      onClick: () => navigate('/audit-logs'),
    },
  ];

  const getSelectedKeys = () => {
    const path = location.pathname;
    
    // Check if path matches any menu item
    const findKey = (items: MenuProps['items']): string[] => {
      for (const item of items || []) {
        if (item && 'key' in item) {
          if (item.key === path) return [item.key as string];
          if (item && 'children' in item && item.children) {
            const childKey = findKey(item.children);
            if (childKey.length > 0) return childKey;
          }
        }
      }
      return [];
    };

    return findKey(menuItems);
  };

  return (
    <AntLayout style={{ minHeight: '100vh', width: '100%' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={250}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div className="logo">
          {!collapsed ? (
            <Text strong style={{ color: '#fff', fontSize: '18px' }}>
              LBE Admin
            </Text>
          ) : (
            <Text strong style={{ color: '#fff', fontSize: '16px' }}>
              LBE
            </Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
        />
      </Sider>

      <AntLayout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s', minHeight: '100vh' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            width: '100%',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Space>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                {!collapsed && <Text>{user?.fullName}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: 24,
            minHeight: 'calc(100vh - 112px)',
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            width: '100%',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};
