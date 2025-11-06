/**
 * Role-Policy Relationship Management
 * 
 * This component manages the many-to-many relationship between Roles and Policies
 * through the role_policies junction table.
 * 
 * Architecture: Role → RolePolicy → Policy → EndpointPolicy → Endpoint
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
import type { Role, Policy } from '../../types';
import { useQueryError } from '../../hooks/useQueryError';
import { AccessDenied } from '../../components/AccessDenied';

const { Title, Text } = Typography;

export const RolePolicyRelationship = () => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<number[]>([]);
  const [originalPolicyIds, setOriginalPolicyIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all roles
  const { data: roles = [], isLoading: rolesLoading, isError: rolesError, error: rolesErrorObj } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.roles.getAll();
      return response.data as Role[];
    },
  });

  // Fetch all policies
  const { data: policies = [], isLoading: policiesLoading, isError: policiesError, error: policiesErrorObj } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data as Policy[];
    },
  });

  // Fetch policies for selected role (assigned policies)
  const { data: roleDetails, isError: roleDetailsError, error: roleDetailsErrorObj } = useQuery({
    queryKey: ['role-policies', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      console.log('Fetching policies for role ID:', selectedRoleId);
      const response = await api.roles.getPolicies(selectedRoleId);
      console.log('API Response:', response);
      console.log('Policies from API:', response.data);
      return response.data;
    },
    enabled: !!selectedRoleId,
  });

  const rolePolicies = roleDetails?.policies || [];

  // Set selected and original policy IDs when role details are loaded
  useEffect(() => {
    if (selectedRoleId !== null && roleDetails) {
      // When role is selected, set the assigned policies
      const policyIds = roleDetails.policies ? roleDetails.policies.map((p: any) => p.id) : [];
      console.log('===== DEBUG INFO =====');
      console.log('Selected Role ID:', selectedRoleId);
      console.log('Role Policies Data:', roleDetails.policies);
      console.log('Assigned policy IDs:', policyIds);
      console.log('Total policies available:', policies.length);
      console.log('======================');
      setSelectedPolicyIds(policyIds);
      setOriginalPolicyIds(policyIds); // Track original assignments
    }
  }, [roleDetails, selectedRoleId]);

  // Update role policies mutation
  const updatePoliciesMutation = useMutation({
    mutationFn: ({ roleId, policyIds }: { roleId: number; policyIds: number[] }) =>
      api.roles.replacePolicies(roleId, policyIds),
    onSuccess: () => {
      message.success('Role policies updated successfully');
      queryClient.invalidateQueries({ queryKey: ['role-policies', selectedRoleId] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update policies');
    },
  });

  // Check for access denied errors
  const rolesAccessCheck = useQueryError({ isError: rolesError, error: rolesErrorObj });
  const policiesAccessCheck = useQueryError({ isError: policiesError, error: policiesErrorObj });
  const roleDetailsAccessCheck = useQueryError({ isError: roleDetailsError, error: roleDetailsErrorObj });

  const handleRoleChange = (roleId: number) => {
    setSelectedRoleId(roleId);
    setSelectedPolicyIds([]);
    setOriginalPolicyIds([]); // Reset original IDs when changing role
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    // Convert keys to numbers
    setSelectedPolicyIds(targetKeys.map(key => parseInt(key.toString())));
  };

  const handleSave = () => {
    if (!selectedRoleId) {
      message.warning('Please select a role');
      return;
    }
    updatePoliciesMutation.mutate({
      roleId: selectedRoleId,
      policyIds: selectedPolicyIds,
    });
  };

  const handleReset = () => {
    if (rolePolicies) {
      setSelectedPolicyIds(rolePolicies.map((p: any) => p.id));
      message.info('Changes discarded');
    }
  };

  // Prepare data for Transfer component
  const transferDataSource = useMemo(() => {
    // Always include ALL policies in the data source
    return policies.map((policy) => ({
      key: policy.id.toString(),
      title: policy.name,
      description: policy.description || '',
      type: policy.type,
      isActive: policy.isActive,
      disabled: !policy.isActive, // Disable inactive policies
    }));
  }, [policies]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isLoading = rolesLoading || policiesLoading;
  const roleDetailsLoading = roleDetails === undefined && selectedRoleId !== null;
  const hasChanges = JSON.stringify([...selectedPolicyIds].sort()) !== 
                     JSON.stringify((rolePolicies?.map((p: any) => p.id) || []).sort());

  if (rolesAccessCheck.isAccessDenied || policiesAccessCheck.isAccessDenied || roleDetailsAccessCheck.isAccessDenied) {
    return <AccessDenied />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Role-Policy Assignment</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Select Role:</Text>
          </div>
          <Select
            showSearch
            placeholder="Select a role"
            style={{ width: '100%' }}
            value={selectedRoleId}
            onChange={handleRoleChange}
            loading={rolesLoading}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={roles.map((role) => ({
              value: role.id,
              label: role.name,
            }))}
          />
          {selectedRole && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary">
                <strong>Description:</strong> {selectedRole.description || 'No description'}
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {selectedRoleId && (
        <>
          <Card
            title={
              <Space>
                <span>Assign Policies</span>
                <Tag color="blue">{policies.length} total available</Tag>
                <Tag color="cyan">{selectedPolicyIds.length} selected</Tag>
                <Tag color="green">{originalPolicyIds.length} originally assigned</Tag>
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
                  loading={updatePoliciesMutation.isPending}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
              </Space>
            }
          >
            {isLoading || roleDetailsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
              </div>
            ) : transferDataSource.length === 0 ? (
              <Empty description="No policies available" />
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">
                    Select policies to assign to this role. Roles can have multiple policies to define their permissions.
                  </Text>
                </div>
                <Transfer
                  dataSource={transferDataSource}
                  targetKeys={selectedPolicyIds.map(id => id.toString())}
                  onChange={handleTransferChange}
                  render={(item) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {item.title}
                        {!item.isActive && (
                          <Tag color="red" style={{ marginLeft: 8, fontSize: '10px' }}>
                            INACTIVE
                          </Tag>
                        )}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {item.description}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#666', marginTop: 2 }}>
                        Type: {item.type}
                      </div>
                    </div>
                  )}
                  titles={['Available Policies', 'Assigned to Role']}
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
                      (item.type && item.type.toLowerCase().includes(searchLower)) ||
                      false
                    );
                  }}
                  locale={{
                    itemUnit: 'policy',
                    itemsUnit: 'policies',
                    searchPlaceholder: 'Search policies',
                  }}
                />
              </>
            )}
          </Card>
        </>
      )}

      {!selectedRoleId && !isLoading && (
        <Empty
          description="Please select a role to manage policy assignments"
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};
