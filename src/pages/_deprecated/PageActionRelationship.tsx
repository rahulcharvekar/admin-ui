import { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Tag,
  Select,
  Typography,
  Card,
  Popconfirm,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

const { Title } = Typography;

interface PageAction {
  id: number;
  pageId: number;
  page?: { id: number; label: string; route: string };
  endpoint?: { id: number; path: string; method: string };
  endpointId?: number;
  label: string;
  action: string;
  icon?: string;
  variant?: string;
  displayOrder?: number;
  isActive: boolean;
}

interface UIPage {
  id: number;
  label: string;
  route: string;
}

interface Capability {
  id: number;
  name: string;
  description?: string;
}

interface Endpoint {
  id: number;
  path: string;
  method: string;
  service: string;
}

interface PageActionForm {
  pageId: number;
  endpointId?: number;
  label: string;
  action: string;
  icon?: string;
  variant?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export const PageActionRelationship = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PageAction | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch page actions
  const {
    data: pageActions = [],
    isLoading: actionsLoading,
    refetch: refetchActions,
  } = useQuery({
    queryKey: ['pageActions'],
    queryFn: async () => {
      const response = await api.pageActions.getAll();
      return response.data as PageAction[];
    },
  });

  // Fetch pages for dropdown
  const { data: pages = [] } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      // Backend returns { pages: [...], tree: [...] }
      return (response.data.pages || []) as UIPage[];
    },
  });

  // Fetch endpoints for dropdown
  const { data: endpoints = [] } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data as Endpoint[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (actionData: PageActionForm) => api.pageActions.create(actionData),
    onSuccess: () => {
      message.success('Page action created successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      setIsCreateModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create page action');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PageActionForm }) =>
      api.pageActions.update(id, data),
    onSuccess: () => {
      message.success('Page action updated successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      setIsEditModalOpen(false);
      setSelectedAction(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update page action');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.pageActions.delete(id),
    onSuccess: () => {
      message.success('Page action deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete page action');
    },
  });

  const handleCreate = () => {
    form.validateFields().then((values) => {
      createMutation.mutate(values);
    });
  };

  const handleEdit = (action: PageAction) => {
    setSelectedAction(action);
    form.setFieldsValue({
      pageId: action.page?.id || action.pageId,
      // capabilityId: action.capability.id, // Deprecated - capabilities removed
      endpointId: action.endpoint?.id || action.endpointId,
      label: action.label,
      action: action.action,
      isActive: action.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedAction) return;
    form.validateFields().then((values) => {
      updateMutation.mutate({ id: selectedAction.id, data: values });
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // Filter actions based on search
  const filteredActions = pageActions.filter(
    (action) =>
      action.page?.label?.toLowerCase().includes(searchText.toLowerCase()) ||
      action.label.toLowerCase().includes(searchText.toLowerCase()) ||
      action.action.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns: ColumnsType<PageAction> = [
    {
      title: 'Action ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: 'Page',
      key: 'page',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.page?.label || 'N/A'}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.page?.route || ''}</div>
        </div>
      ),
      sorter: (a, b) => (a.page?.label || '').localeCompare(b.page?.label || ''),
    },
    {
      title: 'Action Label',
      dataIndex: 'label',
      key: 'label',
      width: 150,
    },
    {
      title: 'Action Type',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => <Tag color="blue">{action}</Tag>,
    },
    // Capability column removed - capabilities feature deprecated
    // {
    //   title: 'Required Capability',
    //   key: 'capability',
    //   width: 180,
    //   render: (_, record) => (
    //     <Tag color="purple">{record.capability.name}</Tag>
    //   ),
    // },
    {
      title: 'Linked Endpoint',
      key: 'endpoint',
      width: 250,
      render: (_, record) =>
        record.endpoint ? (
          <div>
            <Tag color="green">{record.endpoint.method}</Tag>
            <span style={{ fontSize: '12px', marginLeft: 8 }}>{record.endpoint.path}</span>
          </div>
        ) : (
          <span style={{ color: '#999' }}>No endpoint</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete page action?"
            description="Are you sure you want to delete this page action?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Title level={3} style={{ margin: 0 }}>
              Page-Action Relationships
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchActions()}
                loading={actionsLoading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Page Action
              </Button>
            </Space>
          </div>

          {/* Description */}
          <div style={{ color: '#666', marginBottom: 8 }}>
            Manage which actions are available on each page and which capabilities are required to
            perform those actions.
          </div>

          {/* Search */}
          <Input
            placeholder="Search by page, capability, label, or action type..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 400 }}
            allowClear
          />

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredActions}
            rowKey="id"
            loading={actionsLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} page actions`,
            }}
            scroll={{ x: 1400 }}
            bordered
          />
        </Space>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={isCreateModalOpen ? 'Create Page Action' : 'Edit Page Action'}
        open={isCreateModalOpen || isEditModalOpen}
        onOk={isCreateModalOpen ? handleCreate : handleUpdate}
        onCancel={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedAction(null);
          form.resetFields();
        }}
        width={600}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="pageId"
            label="Page"
            rules={[{ required: true, message: 'Please select a page' }]}
          >
            <Select
              placeholder="Select a page"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={pages.map((page) => ({
                value: page.id,
                label: `${page.label} (${page.route})`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="label"
            label="Action Label"
            rules={[{ required: true, message: 'Please enter action label' }]}
          >
            <Input placeholder="e.g., Create User" />
          </Form.Item>

          <Form.Item
            name="action"
            label="Action Type"
            rules={[{ required: true, message: 'Please enter action type' }]}
          >
            <Input placeholder="e.g., create, edit, delete, view" />
          </Form.Item>

          {/* Capability field removed - capabilities feature deprecated */}
          {/* <Form.Item
            name="capabilityId"
            label="Required Capability"
            rules={[{ required: true, message: 'Please select a capability' }]}
          >
            <Select
              placeholder="Select required capability"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[]}
            />
          </Form.Item> */}

          <Form.Item name="endpointId" label="Linked Endpoint (Optional)">
            <Select
              placeholder="Select an endpoint (optional)"
              showSearch
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = option?.label;
                if (typeof label === 'string') {
                  return label.toLowerCase().includes(input.toLowerCase());
                }
                return false;
              }}
              options={endpoints.map((endpoint) => ({
                value: endpoint.id,
                label: `${endpoint.method} ${endpoint.path}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Select
              options={[
                { value: true, label: 'Active' },
                { value: false, label: 'Inactive' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PageActionRelationship;
