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
import type { Policy, Capability } from '../../types';

const { Title, Text } = Typography;

export const PolicyCapabilityRelationship = () => {
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<number[]>([]);
  const [originalCapabilityIds, setOriginalCapabilityIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all policies
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data as Policy[];
    },
  });

  // Fetch all capabilities
  const { data: capabilities = [], isLoading: capabilitiesLoading } = useQuery({
    queryKey: ['capabilities'],
    queryFn: async () => {
      const response = await api.capabilities.getAll();
      return response.data as Capability[];
    },
  });

  // Fetch capabilities for selected policy (assigned capabilities)
  const { data: policyCapabilities, isLoading: policyCapabilitiesLoading } = useQuery({
    queryKey: ['policy-capabilities', selectedPolicyId],
    queryFn: async () => {
      if (!selectedPolicyId) return [];
      console.log('Fetching capabilities for policy ID:', selectedPolicyId);
      const response = await api.policies.getCapabilities(selectedPolicyId);
      console.log('API Response:', response);
      console.log('Capabilities from API:', response.data);
      return response.data.capabilities || response.data || [];
    },
    enabled: !!selectedPolicyId,
  });

  // Set selected and original capability IDs when policy capabilities are loaded
  useEffect(() => {
    if (selectedPolicyId !== null) {
      // When policy is selected, set the assigned capabilities
      const capIds = policyCapabilities ? policyCapabilities.map((c: any) => c.id) : [];
      console.log('===== DEBUG INFO =====');
      console.log('Selected Policy ID:', selectedPolicyId);
      console.log('Policy Capabilities Data:', policyCapabilities);
      console.log('Assigned capability IDs:', capIds);
      console.log('Total capabilities available:', capabilities.length);
      console.log('======================');
      setSelectedCapabilityIds(capIds);
      setOriginalCapabilityIds(capIds); // Track original assignments
    }
  }, [policyCapabilities, selectedPolicyId, capabilities.length]);

  // Update policy capabilities mutation
  const updateCapabilitiesMutation = useMutation({
    mutationFn: ({ policyId, capabilityIds }: { policyId: number; capabilityIds: number[] }) =>
      api.policies.addCapabilities(policyId, capabilityIds),
    onSuccess: () => {
      message.success('Policy capabilities updated successfully');
      queryClient.invalidateQueries({ queryKey: ['policy-capabilities', selectedPolicyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update capabilities');
    },
  });

  const handlePolicyChange = (policyId: number) => {
    setSelectedPolicyId(policyId);
    setSelectedCapabilityIds([]);
    setOriginalCapabilityIds([]); // Reset original IDs when changing policy
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    // Convert keys to numbers
    setSelectedCapabilityIds(targetKeys.map(key => parseInt(key.toString())));
  };

  const handleSave = () => {
    if (!selectedPolicyId) {
      message.warning('Please select a policy');
      return;
    }
    updateCapabilitiesMutation.mutate({
      policyId: selectedPolicyId,
      capabilityIds: selectedCapabilityIds,
    });
  };

  const handleReset = () => {
    if (policyCapabilities) {
      setSelectedCapabilityIds(policyCapabilities.map((c: any) => c.id));
      message.info('Changes discarded');
    }
  };

  // Prepare data for Transfer component
  const transferDataSource = useMemo(() => {
    // Always include ALL capabilities in the data source
    return capabilities.map((cap) => ({
      key: cap.id.toString(),
      title: cap.name,
      description: cap.description || '',
      module: cap.module || 'UNCATEGORIZED',
      action: cap.action,
      resource: cap.resource,
      disabled: false,
    }));
  }, [capabilities]);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const isLoading = policiesLoading || capabilitiesLoading;
  const hasChanges = JSON.stringify([...selectedCapabilityIds].sort()) !== 
                     JSON.stringify((policyCapabilities?.map((c: any) => c.id) || []).sort());

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Policy-Capability Assignment</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>Select Policy:</Text>
            <Select
              showSearch
              placeholder="Select a policy to assign capabilities"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedPolicyId}
              onChange={handlePolicyChange}
              loading={policiesLoading}
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              options={policies.map((policy) => ({
                label: `${policy.name} (${policy.type})`,
                value: policy.id,
              }))}
            />
          </div>

          {selectedPolicy && (
            <div>
              <Text type="secondary">
                <strong>Description:</strong> {selectedPolicy.description || 'No description'}
              </Text>
              <br />
              <Text type="secondary">
                <strong>Type:</strong> <Tag color="blue">{selectedPolicy.type}</Tag>
              </Text>
              <Text type="secondary">
                <strong>Status:</strong>{' '}
                <Tag color={selectedPolicy.isActive ? 'green' : 'red'}>
                  {selectedPolicy.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {selectedPolicyId && (
        <>
          <Card
            title={
              <Space>
                <span>Assign Capabilities</span>
                <Tag color="blue">{capabilities.length} total available</Tag>
                <Tag color="cyan">{selectedCapabilityIds.length} selected</Tag>
                <Tag color="green">{originalCapabilityIds.length} originally assigned</Tag>
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
                  loading={updateCapabilitiesMutation.isPending}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
              </Space>
            }
          >
            {capabilitiesLoading || policyCapabilitiesLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" tip="Loading capabilities..." />
              </div>
            ) : capabilities.length === 0 ? (
              <Empty description="No capabilities available" />
            ) : (
              <Transfer
                dataSource={transferDataSource}
                targetKeys={selectedCapabilityIds.map(id => id.toString())}
                onChange={handleTransferChange}
                render={(item) => (
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Text strong>{item.title}</Text>
                    {item.description && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {item.description}
                      </Text>
                    )}
                    <Space size={4} style={{ marginTop: 4 }}>
                      {item.module && (
                        <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                          {item.module}
                        </Tag>
                      )}
                      {item.action && (
                        <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>
                          {item.action}
                        </Tag>
                      )}
                      {item.resource && (
                        <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>
                          {item.resource}
                        </Tag>
                      )}
                      {originalCapabilityIds.includes(parseInt(item.key)) && (
                        <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>
                          ⭐ ORIGINAL
                        </Tag>
                      )}
                    </Space>
                  </Space>
                )}
                listStyle={{
                  width: '45%',
                  height: 500,
                }}
                titles={['Available Capabilities', 'Assigned to Policy']}
                showSearch
                filterOption={(inputValue, item) => {
                  // Search text filtering only
                  if (!inputValue) return true;
                  
                  const searchLower = inputValue.toLowerCase();
                  return (
                    item.title.toLowerCase().includes(searchLower) ||
                    item.description?.toLowerCase().includes(searchLower) ||
                    item.module?.toLowerCase().includes(searchLower) ||
                    false
                  );
                }}
                locale={{
                  itemUnit: 'capability',
                  itemsUnit: 'capabilities',
                  searchPlaceholder: 'Search capabilities...',
                }}
              />
            )}
          </Card>
        </>
      )}

      {!selectedPolicyId && !isLoading && (
        <Empty
          description="Please select a policy to manage capability assignments"
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};
