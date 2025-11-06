/**
 * User-Role Relationship Management
 * 
 * This component manages the many-to-many relationship between Users and Roles
 * through the user_roles junction table.
 * 
 * Architecture: User → UserRole → Role → RolePolicy → Policy
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Space,
  Typography,
  message,
  Transfer,
  Tag,
  Spin,
  Empty,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { User, Role } from '../../types';
import { useQueryError } from '../../hooks/useQueryError';
import { AccessDenied } from '../../components/AccessDenied';

const { Title, Text } = Typography;

export const UserRoleRelationship = () => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [originalRoleIds, setOriginalRoleIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users = [], isLoading: usersLoading, isError: usersError, error: usersErrorObj } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.users.getAll();
      return response.data as User[];
    },
  });

  // Fetch all roles
  const { data: roles = [], isLoading: rolesLoading, isError: rolesError, error: rolesErrorObj } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.roles.getAll();
      return response.data as Role[];
    },
  });

  // Fetch roles for selected user (assigned roles)
  const { data: userRolesData, isError: userRolesError, error: userRolesErrorObj } = useQuery({
    queryKey: ['user-roles', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      console.log('Fetching roles for user ID:', selectedUserId);
      const response = await api.users.getRoles(selectedUserId);
      console.log('API Response:', response);
      console.log('Roles from API:', response.data);
      return response.data;
    },
    enabled: !!selectedUserId,
  });

  // Check for access denied errors
  const usersAccessCheck = useQueryError({ isError: usersError, error: usersErrorObj });
  const rolesAccessCheck = useQueryError({ isError: rolesError, error: rolesErrorObj });
  const userRolesAccessCheck = useQueryError({ isError: userRolesError, error: userRolesErrorObj });

  // If any query returns 403, show access denied
  if (usersAccessCheck.isAccessDenied || rolesAccessCheck.isAccessDenied || userRolesAccessCheck.isAccessDenied) {
    return <AccessDenied />;
  }

  const userRoles = userRolesData || [];

  // Set selected and original role IDs when user roles data is loaded
  useEffect(() => {
    if (selectedUserId !== null && userRolesData) {
      // When user is selected, set the assigned roles
      const roleIds = userRolesData ? userRolesData.map((r: any) => r.id) : [];
      console.log('===== DEBUG INFO =====');
      console.log('Selected User ID:', selectedUserId);
      console.log('User Roles Data:', userRolesData);
      console.log('Assigned role IDs:', roleIds);
      console.log('Total roles available:', roles.length);
      console.log('======================');
      setSelectedRoleIds(roleIds);
      setOriginalRoleIds(roleIds); // Track original assignments
    }
  }, [userRolesData, selectedUserId]);

  // Update user roles mutation
  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      api.users.updateRoles(userId, roleIds),
    onSuccess: () => {
      message.success('User roles updated successfully');
      queryClient.invalidateQueries({ queryKey: ['user-roles', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update roles');
    },
  });

  const handleUserChange = (userId: number) => {
    setSelectedUserId(userId);
    setSelectedRoleIds([]);
    setOriginalRoleIds([]); // Reset original IDs when changing user
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    // Convert keys to numbers
    setSelectedRoleIds(targetKeys.map(key => parseInt(key.toString())));
  };

  const handleSave = () => {
    if (!selectedUserId) {
      message.warning('Please select a user');
      return;
    }
    updateRolesMutation.mutate({
      userId: selectedUserId,
      roleIds: selectedRoleIds,
    });
  };

  const handleReset = () => {
    if (userRoles) {
      setSelectedRoleIds(userRoles.map((r: any) => r.id));
      message.info('Changes discarded');
    }
  };

  // Prepare data for Transfer component
  const transferDataSource = useMemo(() => {
    // Always include ALL roles in the data source
    return roles.map((role) => ({
      key: role.id.toString(),
      title: role.name,
      description: role.description || '',
      disabled: false,
    }));
  }, [roles]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const isLoading = usersLoading || rolesLoading;
  const userRolesLoading = userRolesData === undefined && selectedUserId !== null;
  const hasChanges = JSON.stringify([...selectedRoleIds].sort()) !== 
                     JSON.stringify((userRoles?.map((r: any) => r.id) || []).sort());

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>User-Role Assignment</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Select User:</Text>
          </div>
          <Select
            showSearch
            placeholder="Select a user"
            style={{ width: '100%' }}
            value={selectedUserId}
            onChange={handleUserChange}
            loading={usersLoading}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={users.map((user) => ({
              value: user.id,
              label: `${user.fullName} (${user.username})`,
            }))}
          />
          {selectedUser && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary">
                <strong>Full Name:</strong> {selectedUser.fullName}
              </Text>
              <br />
              <Text type="secondary">
                <strong>Email:</strong> {selectedUser.email}
              </Text>
              <br />
              <Text type="secondary">
                <strong>Username:</strong> {selectedUser.username}
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {selectedUserId && (
        <>
          <Card
            title={
              <Space>
                <span>Assign Roles</span>
                <Tag color="blue">{roles.length} total available</Tag>
                <Tag color="cyan">{selectedRoleIds.length} selected</Tag>
                <Tag color="green">{originalRoleIds.length} originally assigned</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={!hasChanges}>
                  Reset
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={updateRolesMutation.isPending}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
              </Space>
            }
          >
            {isLoading || userRolesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ) : transferDataSource.length === 0 ? (
              <Empty description="No roles available" />
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">
                    Select roles to assign to this user. Users inherit permissions from all their assigned roles.
                  </Text>
                </div>
                <Transfer
                  dataSource={transferDataSource}
                  targetKeys={selectedRoleIds.map(id => id.toString())}
                  onChange={handleTransferChange}
                  render={(item) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.title}</div>
                      {item.description && (
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {item.description}
                        </div>
                      )}
                    </div>
                  )}
                  titles={['Available Roles', 'Assigned Roles']}
                  listStyle={{
                    width: 350,
                    height: 500,
                  }}
                  showSearch
                  filterOption={(inputValue, item) => {
                    if (!inputValue) return true;
                    const searchLower = inputValue.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(searchLower) ||
                      (item.description && item.description.toLowerCase().includes(searchLower)) ||
                      false
                    );
                  }}
                  locale={{
                    itemUnit: 'role',
                    itemsUnit: 'roles',
                    searchPlaceholder: 'Search roles',
                  }}
                />
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
