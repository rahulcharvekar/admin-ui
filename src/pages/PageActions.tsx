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
import type { PageAction } from '../types';

const { Title } = Typography;

interface PageActionForm {
  pageId: number;
  label: string;
  action: string;
  icon?: string;
  variant?: string;
  displayOrder?: number;
  endpointId?: number;
  isActive?: boolean;
}

export const PageActions = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<PageAction | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch page actions
  const {
    data: pageActions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['pageActions'],
    queryFn: async () => {
      const response = await api.pageActions.getAll();
      return response.data as PageAction[];
    },
  });

  // Fetch UI pages for dropdown
  const { data: uiPages = [] } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      // Backend returns { pages: [...], tree: [...] }
      return response.data.pages || [];
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

  // Create page action mutation
  const createActionMutation = useMutation({
    mutationFn: (actionData: PageActionForm) => api.pageActions.create(actionData),
    onSuccess: () => {
      message.success('Page action created successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create page action');
    },
  });

  // Update page action mutation
  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, actionData }: { actionId: number; actionData: PageActionForm }) =>
      api.pageActions.update(actionId, actionData),
    onSuccess: () => {
      message.success('Page action updated successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      setIsEditModalOpen(false);
      setSelectedAction(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update page action');
    },
  });

  // Delete page action mutation
  const deleteActionMutation = useMutation({
    mutationFn: (actionId: number) => api.pageActions.delete(actionId),
    onSuccess: () => {
      message.success('Page action deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete page action');
    },
  });

  // Filter actions based on search
  const filteredActions = pageActions.filter(
    (action) =>
      action.label?.toLowerCase().includes(searchText.toLowerCase()) ||
      action.action?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle create action
  const handleCreateAction = async () => {
    try {
      const values = await createForm.validateFields();
      createActionMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit action
  const handleEditAction = (action: PageAction) => {
    setSelectedAction(action);
    editForm.setFieldsValue({
      pageId: action.pageId,
      label: action.label,
      action: action.action,
      icon: action.icon,
      variant: action.variant,
      displayOrder: action.displayOrder,
      endpointId: action.endpointId,
      isActive: action.isActive !== false, // Default to true
    });
    setIsEditModalOpen(true);
  };

  // Handle update action
  const handleUpdateAction = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedAction) {
        updateActionMutation.mutate({ actionId: selectedAction.id, actionData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete action
  const handleDeleteAction = (actionId: number) => {
    deleteActionMutation.mutate(actionId);
  };

  // Table columns
  const columns: ColumnsType<PageAction> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 70,
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: 'Action Type',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: 'Page ID',
      dataIndex: 'pageId',
      key: 'pageId',
      width: 100,
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpointId',
      key: 'endpointId',
      width: 150,
      render: (id, record: any) => {
        if (!id) return '-';
        const endpoint = record.endpoint;
        return endpoint ? `${endpoint.method} ${endpoint.path}` : `ID: ${id}`;
      },
    },
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      render: (order) => order || 0,
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
            onClick={() => handleEditAction(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this page action?"
            onConfirm={() => handleDeleteAction(record.id)}
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
        <Title level={3} style={{ margin: 0 }}>Page Actions Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create Page Action
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search actions..."
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
        dataSource={filteredActions}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} actions`,
        }}
        size="small"
      />

      {/* Create Page Action Modal */}
      <Modal
        title="Create Page Action"
        open={isCreateModalOpen}
        onOk={handleCreateAction}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createActionMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Action Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Create User, Edit Report" />
          </Form.Item>

          <Form.Item
            name="action"
            label="Action Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select action type">
              <Select.Option value="CREATE">Create</Select.Option>
              <Select.Option value="EDIT">Edit</Select.Option>
              <Select.Option value="DELETE">Delete</Select.Option>
              <Select.Option value="VIEW">View</Select.Option>
              <Select.Option value="DOWNLOAD">Download</Select.Option>
              <Select.Option value="UPLOAD">Upload</Select.Option>
              <Select.Option value="APPROVE">Approve</Select.Option>
              <Select.Option value="REJECT">Reject</Select.Option>
              <Select.Option value="CUSTOM">Custom</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="pageId"
            label="UI Page"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select
              showSearch
              placeholder="Select page"
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {uiPages.map((page: any) => (
                <Select.Option key={page.id} value={page.id}>
                  {page.label} ({page.route})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="endpointId" label="Associated Endpoint">
            <Select
              showSearch
              placeholder="Select endpoint"
              allowClear
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {endpoints.map((endpoint: any) => (
                <Select.Option key={endpoint.id} value={endpoint.id}>
                  {endpoint.method} {endpoint.path}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="icon" label="Icon">
            <Input placeholder="e.g., PlusOutlined, EditOutlined" />
          </Form.Item>

          <Form.Item name="variant" label="Button Variant">
            <Select placeholder="Select variant" defaultValue="default">
              <Select.Option value="default">Default</Select.Option>
              <Select.Option value="primary">Primary</Select.Option>
              <Select.Option value="secondary">Secondary</Select.Option>
              <Select.Option value="danger">Danger</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="displayOrder" label="Display Order">
            <Input type="number" placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Page Action Modal */}
      <Modal
        title="Edit Page Action"
        open={isEditModalOpen}
        onOk={handleUpdateAction}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedAction(null);
          editForm.resetFields();
        }}
        confirmLoading={updateActionMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Action Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Create User, Edit Report" />
          </Form.Item>

          <Form.Item
            name="action"
            label="Action Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select placeholder="Select action type">
              <Select.Option value="CREATE">Create</Select.Option>
              <Select.Option value="EDIT">Edit</Select.Option>
              <Select.Option value="DELETE">Delete</Select.Option>
              <Select.Option value="VIEW">View</Select.Option>
              <Select.Option value="DOWNLOAD">Download</Select.Option>
              <Select.Option value="UPLOAD">Upload</Select.Option>
              <Select.Option value="APPROVE">Approve</Select.Option>
              <Select.Option value="REJECT">Reject</Select.Option>
              <Select.Option value="CUSTOM">Custom</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="pageId"
            label="UI Page"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Select
              showSearch
              placeholder="Select page"
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {uiPages.map((page: any) => (
                <Select.Option key={page.id} value={page.id}>
                  {page.label} ({page.route})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="endpointId" label="Associated Endpoint">
            <Select
              showSearch
              placeholder="Select endpoint"
              allowClear
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {endpoints.map((endpoint: any) => (
                <Select.Option key={endpoint.id} value={endpoint.id}>
                  {endpoint.method} {endpoint.path}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="icon" label="Icon">
            <Input placeholder="e.g., PlusOutlined, EditOutlined" />
          </Form.Item>

          <Form.Item name="variant" label="Button Variant">
            <Select placeholder="Select variant" defaultValue="default">
              <Select.Option value="default">Default</Select.Option>
              <Select.Option value="primary">Primary</Select.Option>
              <Select.Option value="secondary">Secondary</Select.Option>
              <Select.Option value="danger">Danger</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="displayOrder" label="Display Order">
            <Input type="number" placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
