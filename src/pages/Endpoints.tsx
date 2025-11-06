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
import type { Endpoint } from '../types';
import { useQueryError } from '../hooks/useQueryError';
import { AccessDenied } from '../components/AccessDenied';

const { Title } = Typography;

interface EndpointForm {
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  isActive?: boolean;
}

export const Endpoints = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch endpoints
  const {
    data: endpoints = [],
    isLoading,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data as Endpoint[];
    },
  });

  const { isAccessDenied } = useQueryError({ isError, error });

  // Create endpoint mutation
  const createEndpointMutation = useMutation({
    mutationFn: (endpointData: EndpointForm) => api.endpoints.create(endpointData),
    onSuccess: () => {
      message.success('Endpoint created successfully');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create endpoint');
    },
  });

  // Update endpoint mutation
  const updateEndpointMutation = useMutation({
    mutationFn: ({ endpointId, endpointData }: { endpointId: number; endpointData: EndpointForm }) =>
      api.endpoints.update(endpointId, endpointData),
    onSuccess: () => {
      message.success('Endpoint updated successfully');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
      setIsEditModalOpen(false);
      setSelectedEndpoint(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update endpoint');
    },
  });

  // Delete endpoint mutation
  const deleteEndpointMutation = useMutation({
    mutationFn: (endpointId: number) => api.endpoints.delete(endpointId),
    onSuccess: () => {
      message.success('Endpoint deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete endpoint');
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ endpointId, isActive }: { endpointId: number; isActive: boolean }) =>
      api.endpoints.update(endpointId, { isActive }),
    onSuccess: () => {
      message.success('Endpoint status updated');
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update status');
    },
  });

  // Filter endpoints based on search
  const filteredEndpoints = endpoints.filter(
    (endpoint) =>
      endpoint.service.toLowerCase().includes(searchText.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchText.toLowerCase()) ||
      endpoint.method.toLowerCase().includes(searchText.toLowerCase()) ||
      (endpoint.description && endpoint.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Handle create endpoint
  const handleCreateEndpoint = async () => {
    try {
      const values = await createForm.validateFields();
      createEndpointMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit endpoint
  const handleEditEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    editForm.setFieldsValue({
      service: endpoint.service,
      version: endpoint.version,
      method: endpoint.method,
      path: endpoint.path,
      description: endpoint.description,
      isActive: endpoint.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Handle update endpoint
  const handleUpdateEndpoint = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedEndpoint) {
        updateEndpointMutation.mutate({ endpointId: selectedEndpoint.id, endpointData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete endpoint
  const handleDeleteEndpoint = (endpointId: number) => {
    deleteEndpointMutation.mutate(endpointId);
  };

  // Handle toggle status
  const handleToggleStatus = (endpoint: Endpoint) => {
    toggleStatusMutation.mutate({ endpointId: endpoint.id, isActive: !endpoint.isActive });
  };

  // Method color mapping
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
    };
    return colors[method] || 'default';
  };

  // Table columns
  const columns: ColumnsType<Endpoint> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      width: 120,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method) => <Tag color={getMethodColor(method)}>{method}</Tag>,
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>,
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
          size="small"
        />
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
            onClick={() => handleEditEndpoint(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this endpoint?"
            onConfirm={() => handleDeleteEndpoint(record.id)}
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
        <Title level={3} style={{ margin: 0 }}>Endpoints Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create Endpoint
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search endpoints..."
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
        dataSource={filteredEndpoints}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} endpoints`,
        }}
        size="small"
      />

      {/* Create Endpoint Modal */}
      <Modal
        title="Create Endpoint"
        open={isCreateModalOpen}
        onOk={handleCreateEndpoint}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createEndpointMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="service"
            label="Service Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., auth-service, payment-service" />
          </Form.Item>

          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., v1, v2" />
          </Form.Item>

          <Form.Item
            name="method"
            label="HTTP Method"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select method">
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
              <Select.Option value="PATCH">PATCH</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="path"
            label="API Path"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., /api/users/{id}" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Endpoint Modal */}
      <Modal
        title="Edit Endpoint"
        open={isEditModalOpen}
        onOk={handleUpdateEndpoint}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedEndpoint(null);
          editForm.resetFields();
        }}
        confirmLoading={updateEndpointMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="service"
            label="Service Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., auth-service, payment-service" />
          </Form.Item>

          <Form.Item
            name="version"
            label="Version"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., v1, v2" />
          </Form.Item>

          <Form.Item
            name="method"
            label="HTTP Method"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select method">
              <Select.Option value="GET">GET</Select.Option>
              <Select.Option value="POST">POST</Select.Option>
              <Select.Option value="PUT">PUT</Select.Option>
              <Select.Option value="DELETE">DELETE</Select.Option>
              <Select.Option value="PATCH">PATCH</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="path"
            label="API Path"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., /api/users/{id}" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
