import { useState } from 'react';
import {
  Tabs,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Typography,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { RolePolicyRelationship } from './relationships/RolePolicyRelationship';

const { Title } = Typography;

export const Relationships = () => {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3}>Relationship Management</Title>
      </div>

      <Tabs
        defaultActiveKey="role-policy"
        items={[
          {
            key: 'role-policy',
            label: 'Role ↔ Policy',
            children: <RolePolicyRelationship />,
          },
          {
            key: 'policy-capability',
            label: 'Policy ↔ Capability',
            children: <PolicyCapabilityTab />,
          },
          {
            key: 'endpoint-policy',
            label: 'Endpoint ↔ Policy',
            children: <EndpointPolicyTab />,
          },
        ]}
      />
    </div>
  );
};

// ========== Policy ↔ Capability Tab ==========
const PolicyCapabilityTab = () => {
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch policy-capability relationships
  const { data: relationships = [], isLoading, refetch } = useQuery({
    queryKey: ['policy-capabilities'],
    queryFn: async () => {
      const response = await api.policies.getCapabilities(0); // Get all
      return response.data;
    },
  });

  // Fetch policies for dropdown
  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data;
    },
  });

  // Fetch capabilities for dropdown
  const { data: capabilities = [] } = useQuery({
    queryKey: ['capabilities'],
    queryFn: async () => {
      const response = await api.capabilities.getAll();
      return response.data;
    },
  });

  // Link policy to capability
  const linkMutation = useMutation({
    mutationFn: ({ policyId, capabilityIds }: { policyId: number; capabilityIds: number[] }) =>
      api.policies.addCapabilities(policyId, capabilityIds),
    onSuccess: () => {
      message.success('Capability linked successfully');
      queryClient.invalidateQueries({ queryKey: ['policy-capabilities'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to link capability');
    },
  });

  // Unlink capability from policy
  const unlinkMutation = useMutation({
    mutationFn: ({ policyId, capabilityId }: { policyId: number; capabilityId: number }) =>
      api.policies.removeCapability(policyId, capabilityId),
    onSuccess: () => {
      message.success('Capability unlinked successfully');
      queryClient.invalidateQueries({ queryKey: ['policy-capabilities'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to unlink capability');
    },
  });

  const handleLink = async () => {
    try {
      const values = await form.validateFields();
      linkMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleUnlink = (policyId: number, capabilityId: number) => {
    unlinkMutation.mutate({ policyId, capabilityId });
  };

  const filteredData = relationships.filter(
    (item: any) =>
      item.policyName?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.capabilityName?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<any> = [
    {
      title: 'Policy',
      dataIndex: 'policyName',
      key: 'policyName',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Capability',
      dataIndex: 'capabilityName',
      key: 'capabilityName',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Unlink this capability?"
          onConfirm={() => handleUnlink(record.policyId, record.capabilityId)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            Unlink
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="Search..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Link Capability
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey={(record) => `${record.policyId}-${record.capabilityId}`}
        loading={isLoading}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
        size="small"
      />

      <Modal
        title="Link Policy to Capability"
        open={isModalOpen}
        onOk={handleLink}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={linkMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="policyId" label="Policy" rules={[{ required: true, message: 'Required' }]}>
            <Select
              placeholder="Select policy"
              options={policies.map((p: any) => ({ label: p.name, value: p.id }))}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="capabilityIds" label="Capabilities" rules={[{ required: true, message: 'Required' }]}>
            <Select
              mode="multiple"
              placeholder="Select capabilities"
              options={capabilities.map((c: any) => ({ label: c.name, value: c.id }))}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ========== Endpoint ↔ Policy Tab ==========
const EndpointPolicyTab = () => {
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch endpoint-policy relationships
  const { data: relationships = [], isLoading, refetch } = useQuery({
    queryKey: ['endpoint-policies'],
    queryFn: async () => {
      const response = await api.endpoints.getPolicies(0); // Get all
      return response.data;
    },
  });

  // Fetch endpoints for dropdown
  const { data: endpoints = [] } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data;
    },
  });

  // Fetch policies for dropdown
  const { data: policies = [] } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data;
    },
  });

  // Link endpoint to policy
  const linkMutation = useMutation({
    mutationFn: ({ endpointId, policyIds }: { endpointId: number; policyIds: number[] }) =>
      api.endpoints.assignPolicies(endpointId, policyIds),
    onSuccess: () => {
      message.success('Policy linked successfully');
      queryClient.invalidateQueries({ queryKey: ['endpoint-policies'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to link policy');
    },
  });

  // Unlink policy from endpoint
  const unlinkMutation = useMutation({
    mutationFn: ({ endpointId, policyId }: { endpointId: number; policyId: number }) =>
      api.endpoints.removePolicy(endpointId, policyId),
    onSuccess: () => {
      message.success('Policy unlinked successfully');
      queryClient.invalidateQueries({ queryKey: ['endpoint-policies'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to unlink policy');
    },
  });

  const handleLink = async () => {
    try {
      const values = await form.validateFields();
      linkMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleUnlink = (endpointId: number, policyId: number) => {
    unlinkMutation.mutate({ endpointId, policyId });
  };

  const filteredData = relationships.filter(
    (item: any) =>
      item.endpointPath?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.policyName?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<any> = [
    {
      title: 'Method',
      dataIndex: 'endpointMethod',
      key: 'endpointMethod',
      width: 100,
    },
    {
      title: 'Endpoint Path',
      dataIndex: 'endpointPath',
      key: 'endpointPath',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Policy',
      dataIndex: 'policyName',
      key: 'policyName',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Unlink this policy?"
          onConfirm={() => handleUnlink(record.endpointId, record.policyId)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
            Unlink
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder="Search..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Link Policy
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey={(record) => `${record.endpointId}-${record.policyId}`}
        loading={isLoading}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
        size="small"
      />

      <Modal
        title="Link Endpoint to Policy"
        open={isModalOpen}
        onOk={handleLink}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={linkMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="endpointId" label="Endpoint" rules={[{ required: true, message: 'Required' }]}>
            <Select
              placeholder="Select endpoint"
              options={endpoints.map((e: any) => ({
                label: `${e.method} ${e.path}`,
                value: e.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item name="policyIds" label="Policies" rules={[{ required: true, message: 'Required' }]}>
            <Select
              mode="multiple"
              placeholder="Select policies"
              options={policies.map((p: any) => ({ label: p.name, value: p.id }))}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
