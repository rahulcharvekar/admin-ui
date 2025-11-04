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
import type { Policy, Endpoint } from '../../types';

const { Title, Text } = Typography;

export const PolicyEndpointRelationship = () => {
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<number[]>([]);
  const [originalEndpointIds, setOriginalEndpointIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  // Fetch all policies
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data as Policy[];
    },
  });

  // Fetch all endpoints
  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data as Endpoint[];
    },
  });

  // Fetch policy details with endpoints for selected policy
  const { data: policyData, isLoading: policyDataLoading } = useQuery({
    queryKey: ['policy', selectedPolicyId],
    queryFn: async () => {
      if (!selectedPolicyId) return null;
      console.log('Fetching policy details for policy ID:', selectedPolicyId);
      const response = await api.policies.getById(selectedPolicyId);
      console.log('API Response:', response);
      console.log('Policy data from API:', response.data);
      return response.data;
    },
    enabled: !!selectedPolicyId,
  });

  // Extract endpoints from policy data
  const policyEndpoints = policyData?.endpoints || [];

  // Set selected and original endpoint IDs when policy data is loaded
  useEffect(() => {
    if (selectedPolicyId !== null && policyData) {
      // When policy is selected, set the assigned endpoints
      const endpointIds = policyData.endpoints ? policyData.endpoints.map((e: any) => e.id) : [];
      console.log('===== DEBUG INFO =====');
      console.log('Selected Policy ID:', selectedPolicyId);
      console.log('Policy Endpoints Data:', policyData.endpoints);
      console.log('Assigned endpoint IDs:', endpointIds);
      console.log('Total endpoints available:', endpoints.length);
      console.log('======================');
      setSelectedEndpointIds(endpointIds);
      setOriginalEndpointIds(endpointIds); // Track original assignments
    }
  }, [policyData, selectedPolicyId]);

  // Update policy endpoints mutation (bulk replace)
  const updateEndpointsMutation = useMutation({
    mutationFn: ({ policyId, endpointIds }: { policyId: number; endpointIds: number[] }) =>
      api.policies.updateEndpoints(policyId, endpointIds),
    onSuccess: () => {
      message.success('Policy endpoints updated successfully');
      queryClient.invalidateQueries({ queryKey: ['policy', selectedPolicyId] });
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update endpoints');
    },
  });

  const handlePolicyChange = (policyId: number) => {
    setSelectedPolicyId(policyId);
    setSelectedEndpointIds([]);
    setOriginalEndpointIds([]); // Reset original IDs when changing policy
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    // Convert keys to numbers
    setSelectedEndpointIds(targetKeys.map(key => parseInt(key.toString())));
  };

  const handleSave = () => {
    if (!selectedPolicyId) {
      message.warning('Please select a policy');
      return;
    }
    updateEndpointsMutation.mutate({
      policyId: selectedPolicyId,
      endpointIds: selectedEndpointIds,
    });
  };

  const handleReset = () => {
    if (policyEndpoints) {
      setSelectedEndpointIds(policyEndpoints.map((e: any) => e.id));
      message.info('Changes discarded');
    }
  };

  // Prepare data for Transfer component
  const transferDataSource = useMemo(() => {
    // Always include ALL endpoints in the data source
    return endpoints.map((endpoint) => ({
      key: endpoint.id.toString(),
      title: `${endpoint.method} ${endpoint.path}`,
      description: endpoint.description || '',
      method: endpoint.method,
      path: endpoint.path,
      disabled: false,
    }));
  }, [endpoints]);

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
  const isLoading = policiesLoading || endpointsLoading;
  const hasChanges = JSON.stringify([...selectedEndpointIds].sort()) !== 
                     JSON.stringify((policyEndpoints?.map((e: any) => e.id) || []).sort());

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Policy-Endpoint Assignment</Title>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Select Policy:</Text>
          </div>
          <Select
            showSearch
            placeholder="Select a policy"
            style={{ width: '100%' }}
            value={selectedPolicyId}
            onChange={handlePolicyChange}
            loading={policiesLoading}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={policies.map((policy) => ({
              value: policy.id,
              label: policy.name,
            }))}
          />
          {selectedPolicy && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Text type="secondary">
                <strong>Description:</strong> {selectedPolicy.description || 'No description'}
              </Text>
              <br />
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
                <span>Assign Endpoints</span>
                <Tag color="blue">{endpoints.length} total available</Tag>
                <Tag color="cyan">{selectedEndpointIds.length} selected</Tag>
                <Tag color="green">{originalEndpointIds.length} originally assigned</Tag>
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
                  loading={updateEndpointsMutation.isPending}
                  disabled={!hasChanges}
                >
                  Save Changes
                </Button>
              </Space>
            }
          >
            {endpointsLoading || policyDataLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" tip="Loading endpoints..." />
              </div>
            ) : endpoints.length === 0 ? (
              <Empty description="No endpoints available" />
            ) : (
              <Transfer
                dataSource={transferDataSource}
                targetKeys={selectedEndpointIds.map(id => id.toString())}
                onChange={handleTransferChange}
                render={(item) => (
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space>
                      <Tag color={
                        item.method === 'GET' ? 'blue' :
                        item.method === 'POST' ? 'green' :
                        item.method === 'PUT' ? 'orange' :
                        item.method === 'DELETE' ? 'red' : 'default'
                      } style={{ minWidth: '60px', textAlign: 'center' }}>
                        {item.method}
                      </Tag>
                      <Text strong>{item.path}</Text>
                    </Space>
                    {item.description && (
                      <Text type="secondary" style={{ fontSize: '12px', marginLeft: 76 }}>
                        {item.description}
                      </Text>
                    )}
                    <Space size={4} style={{ marginTop: 4, marginLeft: 76 }}>
                      {originalEndpointIds.includes(parseInt(item.key)) && (
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
                titles={['Available Endpoints', 'Assigned to Policy']}
                showSearch
                filterOption={(inputValue, item) => {
                  // Search text filtering only
                  if (!inputValue) return true;
                  
                  const searchLower = inputValue.toLowerCase();
                  return (
                    item.title.toLowerCase().includes(searchLower) ||
                    item.description?.toLowerCase().includes(searchLower) ||
                    item.method?.toLowerCase().includes(searchLower) ||
                    item.path?.toLowerCase().includes(searchLower) ||
                    false
                  );
                }}
                locale={{
                  itemUnit: 'endpoint',
                  itemsUnit: 'endpoints',
                  searchPlaceholder: 'Search endpoints...',
                }}
              />
            )}
          </Card>
        </>
      )}

      {!selectedPolicyId && !isLoading && (
        <Empty
          description="Please select a policy to manage endpoint assignments"
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};
