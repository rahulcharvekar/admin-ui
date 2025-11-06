import { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Popconfirm,
  Typography,
  Select,
  Switch,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Policy } from '../types';
import { useQueryError } from '../hooks/useQueryError';
import { AccessDenied } from '../components/AccessDenied';

const { Title } = Typography;
const { TextArea } = Input;

interface PolicyForm {
  name: string;
  description: string;
  type: string;
  policyType?: string;
  conditions?: string;
  isActive?: boolean;
}

export const Policies = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch policies
  const {
    data: policies = [],
    isLoading,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['policies'],
    queryFn: async () => {
      const response = await api.policies.getAll();
      return response.data as Policy[];
    },
  });

  const { isAccessDenied } = useQueryError({ isError, error });

  // Create policy mutation
  const createPolicyMutation = useMutation({
    mutationFn: (policyData: PolicyForm) => api.policies.create(policyData),
    onSuccess: () => {
      message.success('Policy created successfully');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create policy');
    },
  });

  // Update policy mutation
  const updatePolicyMutation = useMutation({
    mutationFn: ({ policyId, policyData }: { policyId: number; policyData: PolicyForm }) =>
      api.policies.update(policyId, policyData),
    onSuccess: () => {
      message.success('Policy updated successfully');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setIsEditModalOpen(false);
      setSelectedPolicy(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      console.error('Update policy error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to update policy';
      message.error(errorMessage);
    },
  });

  // Delete policy mutation
  const deletePolicyMutation = useMutation({
    mutationFn: (policyId: number) => api.policies.delete(policyId),
    onSuccess: () => {
      message.success('Policy deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete policy');
    },
  });

  // Filter policies based on search
  const filteredPolicies = policies.filter(
    (policy) =>
      policy.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (policy.description && policy.description.toLowerCase().includes(searchText.toLowerCase())) ||
      (policy.type && policy.type.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Handle create policy
  const handleCreatePolicy = async () => {
    try {
      const values = await createForm.validateFields();
      // Validate JSON conditions if provided
      if (values.conditions) {
        try {
          JSON.parse(values.conditions);
        } catch {
          message.error('Conditions must be valid JSON');
          return;
        }
      }
        // Transform payload to match API expectation
        const payload = {
          name: values.name,
          description: values.description,
          type: values.type,
          expression: values.conditions || '',
          isActive: values.isActive ?? true
        };
        console.log('[Create Policy] Payload:', payload);
        createPolicyMutation.mutate(payload, {
          onSettled: (data, error, variables, context) => {
            console.log('[Create Policy] Request:', {
              payload: variables,
              response: data,
              error,
              context
            });
          }
        });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit policy
  const handleEditPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    editForm.setFieldsValue({
      name: policy.name,
      description: policy.description,
      type: policy.type,
      policyType: policy.policyType,
      conditions: policy.conditions ? JSON.stringify(policy.conditions, null, 2) : undefined,
      isActive: policy.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Handle update policy
  const handleUpdatePolicy = async () => {
    try {
      const values = await editForm.validateFields();
      console.log('Updating policy with values:', values);
      console.log('Selected policy:', selectedPolicy);
      
      // Validate JSON conditions if provided
      if (values.conditions) {
        try {
          JSON.parse(values.conditions);
        } catch {
          message.error('Conditions must be valid JSON');
          return;
        }
      }
      if (selectedPolicy) {
        updatePolicyMutation.mutate({ policyId: selectedPolicy.id, policyData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete policy
  const handleDeletePolicy = (policyId: number) => {
    deletePolicyMutation.mutate(policyId);
  };

  // Table columns
  const columns: ColumnsType<Policy> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'RBAC' ? 'blue' : type === 'ABAC' ? 'green' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditPolicy(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this policy?"
            onConfirm={() => handleDeletePolicy(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isAccessDenied) {
    return <AccessDenied />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Policies Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create Policy
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search policies..."
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
      </div>

      <Table
        columns={columns}
        dataSource={filteredPolicies}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} policies`,
        }}
        size="small"
      />

      {/* Create Policy Modal */}
      <Modal
        title="Create Policy"
        open={isCreateModalOpen}
        onOk={handleCreatePolicy}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createPolicyMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Policy Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., ViewDashboardPolicy" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Allows viewing dashboard data" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Policy Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select policy type">
              <Select.Option value="RBAC">RBAC (Role-Based)</Select.Option>
              <Select.Option value="ABAC">ABAC (Attribute-Based)</Select.Option>
              <Select.Option value="CUSTOM">CUSTOM</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="policyType"
            label="Policy Category"
            extra="Fine-grained categorization for the policy"
          >
            <Select placeholder="Select policy category (optional)">
              <Select.Option value="PERMISSION">PERMISSION</Select.Option>
              <Select.Option value="CONDITIONAL">CONDITIONAL</Select.Option>
              <Select.Option value="ROW_LEVEL">ROW_LEVEL</Select.Option>
              <Select.Option value="TIME_BASED">TIME_BASED</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="conditions"
            label="Conditions (JSON)"
            extra="Optional JSONB conditions for ABAC scenarios. e.g., {&quot;tenant_id&quot;: 123}"
          >
            <TextArea
              rows={4}
              placeholder='{"tenant_id": 123, "department": "finance"}'
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Policy Modal */}
      <Modal
        title="Edit Policy"
        open={isEditModalOpen}
        onOk={handleUpdatePolicy}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedPolicy(null);
          editForm.resetFields();
        }}
        confirmLoading={updatePolicyMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Policy Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., ViewDashboardPolicy" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Allows viewing dashboard data" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Policy Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select policy type">
              <Select.Option value="RBAC">RBAC (Role-Based)</Select.Option>
              <Select.Option value="ABAC">ABAC (Attribute-Based)</Select.Option>
              <Select.Option value="CUSTOM">CUSTOM</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="policyType"
            label="Policy Category"
            extra="Fine-grained categorization for the policy"
          >
            <Select placeholder="Select policy category (optional)">
              <Select.Option value="PERMISSION">PERMISSION</Select.Option>
              <Select.Option value="CONDITIONAL">CONDITIONAL</Select.Option>
              <Select.Option value="ROW_LEVEL">ROW_LEVEL</Select.Option>
              <Select.Option value="TIME_BASED">TIME_BASED</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="conditions"
            label="Conditions (JSON)"
            extra="Optional JSONB conditions for ABAC scenarios. e.g., {&quot;tenant_id&quot;: 123}"
          >
            <TextArea
              rows={4}
              placeholder='{"tenant_id": 123, "department": "finance"}'
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
