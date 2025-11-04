import { useState, useMemo } from 'react';
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
  Tag,
  Select,
  Switch,
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
import type { Capability } from '../types';

const { Title } = Typography;

interface CapabilityForm {
  name: string;
  description?: string;
  module?: string;
  action?: string;
  resource?: string;
  isActive?: boolean;
}

export const Capabilities = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch capabilities
  const {
    data: capabilities = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['capabilities'],
    queryFn: async () => {
      const response = await api.capabilities.getAll();
      return response.data as Capability[];
    },
  });

  // Create capability mutation
  const createCapabilityMutation = useMutation({
    mutationFn: (capabilityData: CapabilityForm) => api.capabilities.create(capabilityData),
    onSuccess: () => {
      message.success('Capability created successfully');
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create capability');
    },
  });

  // Update capability mutation
  const updateCapabilityMutation = useMutation({
    mutationFn: ({ capabilityId, capabilityData }: { capabilityId: number; capabilityData: CapabilityForm }) =>
      api.capabilities.update(capabilityId, capabilityData),
    onSuccess: () => {
      message.success('Capability updated successfully');
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      setIsEditModalOpen(false);
      setSelectedCapability(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update capability');
    },
  });

  // Delete capability mutation
  const deleteCapabilityMutation = useMutation({
    mutationFn: (capabilityId: number) => api.capabilities.delete(capabilityId),
    onSuccess: () => {
      message.success('Capability deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete capability');
    },
  });

  // Filter capabilities based on search
  const filteredCapabilities = capabilities.filter(
    (capability) =>
      capability.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (capability.description && capability.description.toLowerCase().includes(searchText.toLowerCase())) ||
      (capability.module && capability.module.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Get unique modules
  const modules = useMemo(() => {
    const uniqueModules = Array.from(new Set(capabilities.map(cap => cap.module || 'UNCATEGORIZED')));
    return uniqueModules.sort();
  }, [capabilities]);

  // Filter by selected module
  const displayedCapabilities = useMemo(() => {
    if (selectedModule === 'ALL') {
      return filteredCapabilities;
    }
    return filteredCapabilities.filter(cap => 
      (cap.module || 'UNCATEGORIZED') === selectedModule
    );
  }, [filteredCapabilities, selectedModule]);

  // Handle create capability
  const handleCreateCapability = async () => {
    try {
      const values = await createForm.validateFields();
      createCapabilityMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit capability
  const handleEditCapability = (capability: Capability) => {
    setSelectedCapability(capability);
    editForm.setFieldsValue({
      name: capability.name,
      description: capability.description,
      module: capability.module,
      action: capability.action,
      resource: capability.resource,
      isActive: capability.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Handle update capability
  const handleUpdateCapability = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedCapability) {
        updateCapabilityMutation.mutate({ capabilityId: selectedCapability.id, capabilityData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete capability
  const handleDeleteCapability = (capabilityId: number) => {
    deleteCapabilityMutation.mutate(capabilityId);
  };

  // Table columns
  const columns: ColumnsType<Capability> = [
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
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      width: 180,
      render: (text) => (
        <Tag color="blue">{text || 'N/A'}</Tag>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: 'Resource',
      dataIndex: 'resource',
      key: 'resource',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
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
            onClick={() => handleEditCapability(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this capability?"
            onConfirm={() => handleDeleteCapability(record.id)}
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

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Capabilities Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create Capability
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search capabilities..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="Filter by Module"
            style={{ width: 200 }}
            value={selectedModule}
            onChange={setSelectedModule}
            options={[
              { label: 'All Modules', value: 'ALL' },
              ...modules.map(module => ({
                label: module,
                value: module,
              })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={displayedCapabilities}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} capabilities`,
        }}
        size="small"
      />

      {/* Create Capability Modal */}
      <Modal
        title="Create Capability"
        open={isCreateModalOpen}
        onOk={handleCreateCapability}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createCapabilityMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Capability Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., user.account.create" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>

          <Form.Item
            name="module"
            label="Module"
          >
            <Input placeholder="e.g., USER_MANAGEMENT" />
          </Form.Item>

          <Form.Item
            name="action"
            label="Action"
          >
            <Input placeholder="e.g., CREATE, READ, UPDATE, DELETE" />
          </Form.Item>

          <Form.Item
            name="resource"
            label="Resource"
          >
            <Input placeholder="e.g., USER, ACCOUNT" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Capability Modal */}
      <Modal
        title="Edit Capability"
        open={isEditModalOpen}
        onOk={handleUpdateCapability}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedCapability(null);
          editForm.resetFields();
        }}
        confirmLoading={updateCapabilityMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Capability Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., user.account.create" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>

          <Form.Item
            name="module"
            label="Module"
          >
            <Input placeholder="e.g., USER_MANAGEMENT" />
          </Form.Item>

          <Form.Item
            name="action"
            label="Action"
          >
            <Input placeholder="e.g., CREATE, READ, UPDATE, DELETE" />
          </Form.Item>

          <Form.Item
            name="resource"
            label="Resource"
          >
            <Input placeholder="e.g., USER, ACCOUNT" />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
