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
  InputNumber,
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
import type { UIPage } from '../types';

const { Title } = Typography;

interface UIPageForm {
  label: string;
  route: string;
  icon?: string;
  parentId?: number;
  displayOrder: number;
}

export const Pages = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<UIPage | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch UI pages
  const {
    data: pages = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      // Backend returns { pages: [...], tree: [...] }
      return (response.data.pages || []) as UIPage[];
    },
  });

  // Create page mutation
  const createPageMutation = useMutation({
    mutationFn: (pageData: UIPageForm) => api.uiPages.create(pageData),
    onSuccess: () => {
      message.success('UI Page created successfully');
      queryClient.invalidateQueries({ queryKey: ['uiPages'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create UI page');
    },
  });

  // Update page mutation
  const updatePageMutation = useMutation({
    mutationFn: ({ pageId, pageData }: { pageId: number; pageData: UIPageForm }) =>
      api.uiPages.update(pageId, pageData),
    onSuccess: () => {
      message.success('UI Page updated successfully');
      queryClient.invalidateQueries({ queryKey: ['uiPages'] });
      setIsEditModalOpen(false);
      setSelectedPage(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update UI page');
    },
  });

  // Delete page mutation
  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => api.uiPages.delete(pageId),
    onSuccess: () => {
      message.success('UI Page deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['uiPages'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete UI page');
    },
  });

  // Filter pages based on search
  const filteredPages = pages.filter(
    (page) =>
      page.label.toLowerCase().includes(searchText.toLowerCase()) ||
      page.route.toLowerCase().includes(searchText.toLowerCase())
  );

  // Handle create page
  const handleCreatePage = async () => {
    try {
      const values = await createForm.validateFields();
      createPageMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit page
  const handleEditPage = (page: UIPage) => {
    setSelectedPage(page);
    editForm.setFieldsValue({
      label: page.label,
      route: page.route,
      icon: page.icon,
      parentId: page.parentId,
      displayOrder: page.displayOrder,
    });
    setIsEditModalOpen(true);
  };

  // Handle update page
  const handleUpdatePage = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedPage) {
        updatePageMutation.mutate({ pageId: selectedPage.id, pageData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete page
  const handleDeletePage = (pageId: number) => {
    deletePageMutation.mutate(pageId);
  };

  // Table columns
  const columns: ColumnsType<UIPage> = [
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
      title: 'Route',
      dataIndex: 'route',
      key: 'route',
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>,
    },
    {
      title: 'Icon',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
    },
    {
      title: 'Parent Page',
      dataIndex: 'parentId',
      key: 'parentId',
      width: 150,
      render: (parentId) => {
        if (!parentId) return '-';
        const parentPage = pages.find(p => p.id === parentId);
        return parentPage ? `${parentPage.label} (ID: ${parentId})` : `ID: ${parentId}`;
      },
    },
    {
      title: 'Display Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 120,
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
            onClick={() => handleEditPage(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this UI page?"
            onConfirm={() => handleDeletePage(record.id)}
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
        <Title level={3} style={{ margin: 0 }}>UI Pages Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create UI Page
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search pages..."
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
        dataSource={filteredPages}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} pages`,
        }}
        size="small"
      />

      {/* Create UI Page Modal */}
      <Modal
        title="Create UI Page"
        open={isCreateModalOpen}
        onOk={handleCreatePage}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createPageMutation.isPending}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Page Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Dashboard" />
          </Form.Item>

          <Form.Item
            name="route"
            label="Route Path"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., /dashboard" />
          </Form.Item>

          <Form.Item name="icon" label="Icon">
            <Input placeholder="e.g., DashboardOutlined (optional)" />
          </Form.Item>

          <Form.Item name="parentId" label="Parent Page">
            <Select
              showSearch
              placeholder="Select parent page (optional)"
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) =>
                typeof option?.children === 'string' &&
                (option.children as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {pages.map((page: UIPage) => (
                <Select.Option key={page.id} value={page.id}>
                  {page.label} ({page.route})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="displayOrder"
            label="Display Order"
            rules={[{ required: true, message: 'Required' }]}
            initialValue={0}
          >
            <InputNumber placeholder="0" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit UI Page Modal */}
      <Modal
        title="Edit UI Page"
        open={isEditModalOpen}
        onOk={handleUpdatePage}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedPage(null);
          editForm.resetFields();
        }}
        confirmLoading={updatePageMutation.isPending}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Page Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., Dashboard" />
          </Form.Item>

          <Form.Item
            name="route"
            label="Route Path"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., /dashboard" />
          </Form.Item>

          <Form.Item name="icon" label="Icon">
            <Input placeholder="e.g., DashboardOutlined (optional)" />
          </Form.Item>

          <Form.Item name="parentId" label="Parent Page">
            <Select
              showSearch
              placeholder="Select parent page (optional)"
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) =>
                typeof option?.children === 'string' &&
                (option.children as string).toLowerCase().includes(input.toLowerCase())
              }
            >
              {pages
                .filter((page: UIPage) => page.id !== selectedPage?.id) // Prevent selecting itself as parent
                .map((page: UIPage) => (
                  <Select.Option key={page.id} value={page.id}>
                    {page.label} ({page.route})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="displayOrder"
            label="Display Order"
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber placeholder="0" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
