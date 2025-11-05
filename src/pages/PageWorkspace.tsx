import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Typography,
  Popconfirm,
  Switch,
  InputNumber,
  Empty,
  Table,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { UIPage, PageAction, Endpoint } from '../types';

const { Title, Text } = Typography;

interface UIPageForm {
  label: string;
  route: string;
  icon?: string;
  parentId?: number;
  displayOrder: number;
}

interface PageActionForm {
  pageId: number;
  label: string;
  action: string;
  icon?: string;
  variant?: string;
  displayOrder?: number;
  isActive?: boolean;
  endpointId?: number | null;
}

export const PageWorkspace = () => {
  const queryClient = useQueryClient();

  const [actionSearch, setActionSearch] = useState('');
  const [selectedParentPageId, setSelectedParentPageId] = useState<number | null>(null);
  const [selectedChildPageId, setSelectedChildPageId] = useState<number | null>(null);

  const [isCreatePageModalOpen, setIsCreatePageModalOpen] = useState(false);
  const [isEditPageModalOpen, setIsEditPageModalOpen] = useState(false);
  const [isCreateActionModalOpen, setIsCreateActionModalOpen] = useState(false);
  const [isEditActionModalOpen, setIsEditActionModalOpen] = useState(false);

  const [selectedPage, setSelectedPage] = useState<UIPage | null>(null);
  const [selectedAction, setSelectedAction] = useState<PageAction | null>(null);

  const [createPageForm] = Form.useForm<UIPageForm>();
  const [editPageForm] = Form.useForm<UIPageForm>();
  const [createActionForm] = Form.useForm<PageActionForm>();
  const [editActionForm] = Form.useForm<PageActionForm>();

  const {
    data: pagesData = [],
    isLoading: pagesLoading,
    refetch: refetchPages,
  } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      // Normalize the data to handle both camelCase and snake_case
      const pages = (response.data.pages || []).map((page: any) => ({
        ...page,
        parentId: page.parentId ?? page.parent_id ?? null,
      })) as UIPage[];
      return pages;
    },
  });

  const {
    data: actionsRaw = [],
    refetch: refetchActions,
  } = useQuery({
    queryKey: ['pageActions'],
    queryFn: async () => {
      const response = await api.pageActions.getAll();
      return (response.data || []) as PageAction[];
    },
  });

  // Fetch all endpoints for action-endpoint assignment
  const { data: endpoints = [] } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return (response.data || []) as Endpoint[];
    },
  });

  const actionsData = useMemo<PageAction[]>(() => {
    return actionsRaw.map((action: any) => {
      const derivedPageId =
        action.pageId ??
        action.page_id ??
        action.page?.id ??
        0;
      return {
        ...action,
        pageId: derivedPageId,
        isActive: action.isActive ?? action.active ?? true,
      } as PageAction;
    });
  }, [actionsRaw]);

  // Separate parent and child pages
  const parentPages = useMemo(() => {
    const parents = pagesData.filter(page => page.parentId === null || page.parentId === undefined);
    console.log('Parent pages:', parents);
    return parents;
  }, [pagesData]);

  const childPages = useMemo(() => {
    if (selectedParentPageId === null) return [];
    const children = pagesData.filter(page => {
      // Handle both number and string comparison
      return page.parentId != null && Number(page.parentId) === Number(selectedParentPageId);
    });
    console.log('Selected parent ID:', selectedParentPageId);
    console.log('Child pages for parent:', children);
    console.log('All pages:', pagesData.map(p => ({ id: p.id, label: p.label, parentId: p.parentId, parentIdType: typeof p.parentId })));
    return children;
  }, [pagesData, selectedParentPageId]);

  // Initialize with first parent page
  useEffect(() => {
    if (parentPages.length > 0 && selectedParentPageId === null) {
      setSelectedParentPageId(parentPages[0].id);
    }
  }, [parentPages, selectedParentPageId]);

  // Update selected page based on selected child
  useEffect(() => {
    if (selectedChildPageId !== null) {
      const page = pagesData.find((p) => p.id === selectedChildPageId) || null;
      setSelectedPage(page);
    } else {
      setSelectedPage(null);
    }
  }, [selectedChildPageId, pagesData]);

  useEffect(() => {
    setActionSearch('');
  }, [selectedChildPageId]);

  const pageActionCountMap = useMemo(() => {
    const map = new Map<number, { total: number; active: number }>();
    actionsData.forEach((action) => {
      const pageId = action.pageId;
      if (!pageId) return;
      if (!map.has(pageId)) {
        map.set(pageId, { total: 0, active: 0 });
      }
      const entry = map.get(pageId)!;
      entry.total += 1;
      if (action.isActive !== false) {
        entry.active += 1;
      }
    });
    return map;
  }, [actionsData]);

  const filteredActions = useMemo(() => {
    if (selectedChildPageId === null) return [];
    return actionsData
      .filter((action) => action.pageId === selectedChildPageId)
      .filter(
        (action) =>
          (action.label || '').toLowerCase().includes(actionSearch.toLowerCase()) ||
          (action.action || '').toLowerCase().includes(actionSearch.toLowerCase())
      );
  }, [actionsData, selectedChildPageId, actionSearch]);

  const actionSummary = useMemo(() => {
    if (!selectedChildPageId) return { total: 0, active: 0, inactive: 0 };
    const entry = pageActionCountMap.get(selectedChildPageId) || { total: 0, active: 0 };
    return {
      total: entry.total,
      active: entry.active,
      inactive: entry.total - entry.active,
    };
  }, [pageActionCountMap, selectedChildPageId]);

  const createPageMutation = useMutation({
    mutationFn: (pageData: UIPageForm) => api.uiPages.create(pageData),
    onSuccess: async () => {
      message.success('Page created successfully');
      setIsCreatePageModalOpen(false);
      createPageForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['uiPages'] });
      refetchPages();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create page');
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ pageId, pageData }: { pageId: number; pageData: UIPageForm }) =>
      api.uiPages.update(pageId, pageData),
    onSuccess: async () => {
      message.success('Page updated successfully');
      setIsEditPageModalOpen(false);
      setSelectedPage(null);
      editPageForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['uiPages'] });
      refetchPages();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update page');
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => api.uiPages.delete(pageId),
    onSuccess: async (_data, deletedPageId) => {
      message.success('Page deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['uiPages'] });
      await queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      refetchPages();
      refetchActions();
      // If deleted page was selected, clear selection
      if (selectedChildPageId === deletedPageId) {
        setSelectedChildPageId(null);
      }
      if (selectedParentPageId === deletedPageId) {
        setSelectedParentPageId(null);
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete page');
    },
  });

  const createActionMutation = useMutation({
    mutationFn: (actionData: PageActionForm) => api.pageActions.create(actionData),
    onSuccess: async () => {
      message.success('Action created successfully');
      setIsCreateActionModalOpen(false);
      createActionForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      refetchActions();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create action');
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, actionData }: { actionId: number; actionData: PageActionForm }) =>
      api.pageActions.update(actionId, actionData),
    onSuccess: async () => {
      message.success('Action updated successfully');
      setIsEditActionModalOpen(false);
      setSelectedAction(null);
      editActionForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      refetchActions();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update action');
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: number) => api.pageActions.delete(actionId),
    onSuccess: async () => {
      message.success('Action deleted successfully');
      await queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      refetchActions();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete action');
    },
  });

  const handleCreatePage = async () => {
    try {
      const values = await createPageForm.validateFields();
      createPageMutation.mutate(values);
    } catch (error) {
      console.error('Page validation failed', error);
    }
  };

  const handleEditPage = (page: UIPage) => {
    setSelectedPage(page);
    editPageForm.setFieldsValue({
      label: page.label,
      route: page.route,
      icon: page.icon,
      parentId: page.parentId,
      displayOrder: page.displayOrder,
    });
    setIsEditPageModalOpen(true);
  };

  const handleUpdatePage = async () => {
    try {
      const values = await editPageForm.validateFields();
      if (selectedPage) {
        updatePageMutation.mutate({ pageId: selectedPage.id, pageData: values });
      }
    } catch (error) {
      console.error('Page validation failed', error);
    }
  };

  const handleCreateAction = async () => {
    if (!selectedChildPageId) {
      message.warning('Select a child page first');
      return;
    }
    try {
      const values = await createActionForm.validateFields();
      createActionMutation.mutate({ ...values, pageId: selectedChildPageId });
    } catch (error) {
      console.error('Action validation failed', error);
    }
  };

  const handleEditAction = (action: PageAction) => {
    setSelectedAction(action);
    editActionForm.setFieldsValue({
      pageId: action.pageId,
      label: action.label,
      action: action.action,
      icon: action.icon,
      variant: action.variant,
      displayOrder: action.displayOrder,
      isActive: action.isActive !== false,
      endpointId: action.endpointId || action.endpoint?.id || null,
    });
    setIsEditActionModalOpen(true);
  };

  const handleUpdateAction = async () => {
    try {
      const values = await editActionForm.validateFields();
      if (selectedAction) {
        updateActionMutation.mutate({
          actionId: selectedAction.id,
          actionData: {
            ...values,
            pageId: selectedAction.pageId,
          },
        });
      }
    } catch (error) {
      console.error('Action validation failed', error);
    }
  };

  const actionColumns: ColumnsType<PageAction> = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      width: 150,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 80,
      render: (value: boolean | undefined) =>
        value === false ? 'Disabled' : 'Active',
    },
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      render: (order?: number) => (order ?? 0),
    },
    {
      title: 'Icon',
      dataIndex: 'icon',
      key: 'icon',
      width: 100,
      render: (icon?: string) => icon || '-',
    },
    {
      title: 'Variant',
      dataIndex: 'variant',
      key: 'variant',
      width: 100,
      render: (variant?: string) => variant || '-',
    },
    {
      title: 'Endpoint',
      key: 'endpoint',
      width: 200,
      render: (_, record) =>
        record.endpoint ? (
          <Space size={4} direction="vertical">
            <Text style={{ fontSize: 12 }}>{record.endpoint.method}</Text>
            <code style={{ fontSize: 11, color: '#666' }}>{record.endpoint.path}</code>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => handleEditAction(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this action?"
            onConfirm={() => handleDeleteAction(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleDeletePage = (pageId: number) => {
    deletePageMutation.mutate(pageId);
  };

  const handleDeleteAction = (actionId: number) => {
    deleteActionMutation.mutate(actionId);
  };

  const resetActionForms = () => {
    createActionForm.resetFields();
    editActionForm.resetFields();
    setSelectedAction(null);
  };

  return (
    <div>
      <Title level={2}>Pages & Actions Workspace</Title>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* Parent Page Selection */}
        <Card
          title="Parent Pages"
          extra={
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchPages();
                  refetchActions();
                }}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsCreatePageModalOpen(true)}
              >
                New Page
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Select a parent page to view its child pages:</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Select a parent page"
              value={selectedParentPageId}
              onChange={(value) => {
                setSelectedParentPageId(value);
                setSelectedChildPageId(null);
              }}
              options={parentPages.map(page => ({
                label: `${page.label} (${page.route})`,
                value: page.id,
              }))}
              loading={pagesLoading}
            />
          </Space>
        </Card>

        {/* Child Pages Table */}
        {selectedParentPageId && (
          <Card
            title={`Child Pages of ${parentPages.find(p => p.id === selectedParentPageId)?.label || ''}`}
          >
            <Table
              dataSource={childPages}
              rowKey="id"
              size="small"
              pagination={false}
              loading={pagesLoading}
              onRow={(record) => ({
                onClick: () => setSelectedChildPageId(record.id),
                style: {
                  cursor: 'pointer',
                  background: selectedChildPageId === record.id ? '#e6f7ff' : undefined,
                },
              })}
              locale={{
                emptyText: (
                  <Empty
                    description="No child pages found."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            >
              <Table.Column 
                title="Label" 
                dataIndex="label" 
                key="label"
                width={200}
              />
              <Table.Column 
                title="Route" 
                dataIndex="route" 
                key="route"
                width={250}
              />
              <Table.Column 
                title="Icon" 
                dataIndex="icon" 
                key="icon"
                width={100}
                render={(icon?: string) => icon || '-'}
              />
              <Table.Column 
                title="Display Order" 
                dataIndex="displayOrder" 
                key="displayOrder"
                width={120}
              />
              <Table.Column 
                title="Actions" 
                key="actions"
                width={200}
                fixed="right"
                render={(_, record: UIPage) => {
                  const counts = pageActionCountMap.get(record.id);
                  return (
                    <Space size="small">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {counts ? `${counts.active}/${counts.total}` : '0/0'}
                      </Text>
                      <Button 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPage(record);
                        }}
                      >
                        Edit
                      </Button>
                      <Popconfirm
                        title="Delete this page?"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleDeletePage(record.id);
                        }}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button 
                          size="small" 
                          danger
                          onClick={(e) => e.stopPropagation()}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  );
                }}
              />
            </Table>
          </Card>
        )}

        {/* Actions Table */}
        {selectedChildPageId && (
          <Card
            title={`Actions for ${selectedPage?.label || ''}`}
            extra={
              <Space>
                <Input
                  allowClear
                  placeholder="Search actions"
                  prefix={<SearchOutlined />}
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  style={{ width: 220 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    createActionForm.setFieldsValue({
                      pageId: selectedChildPageId,
                      isActive: true,
                      displayOrder: actionSummary.total + 1,
                    });
                    setIsCreateActionModalOpen(true);
                  }}
                >
                  New Action
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" size={8} style={{ marginBottom: 16 }}>
              <Text type="secondary">
                Total: {actionSummary.total} | Active: {actionSummary.active} | Inactive: {actionSummary.inactive}
              </Text>
            </Space>
            <Table
              dataSource={filteredActions}
              columns={actionColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: (
                  <Empty
                    description="No actions for this page yet."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ),
              }}
            />
          </Card>
        )}
      </Space>

      <Modal
        title="Create Page"
        open={isCreatePageModalOpen}
        onOk={handleCreatePage}
        onCancel={() => {
          setIsCreatePageModalOpen(false);
          createPageForm.resetFields();
        }}
        confirmLoading={createPageMutation.isPending}
        width={520}
      >
        <Form form={createPageForm} layout="vertical">
          <Form.Item
            name="label"
            label="Page Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Page name" />
          </Form.Item>
          <Form.Item
            name="route"
            label="Route"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="/reports" />
          </Form.Item>
          <Form.Item name="icon" label="Icon">
            <Input placeholder="Optional icon name" />
          </Form.Item>
          <Form.Item 
            name="parentId" 
            label="Parent Page"
            help="Leave empty to create a parent page"
          >
            <Select
              placeholder="Select parent page (optional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={parentPages.map((page) => ({
                label: `${page.label} (${page.route})`,
                value: page.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="displayOrder"
            label="Display Order"
            initialValue={0}
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

  <Modal
        title="Edit Page"
        open={isEditPageModalOpen}
        onOk={handleUpdatePage}
        onCancel={() => {
          setIsEditPageModalOpen(false);
          editPageForm.resetFields();
          setSelectedPage(null);
        }}
        confirmLoading={updatePageMutation.isPending}
        width={520}
      >
        <Form form={editPageForm} layout="vertical">
          <Form.Item
            name="label"
            label="Page Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Page name" />
          </Form.Item>
          <Form.Item
            name="route"
            label="Route"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="/reports" />
          </Form.Item>
          <Form.Item name="icon" label="Icon">
            <Input placeholder="Optional icon name" />
          </Form.Item>
          <Form.Item 
            name="parentId" 
            label="Parent Page"
            help="Leave empty if this is a parent page"
          >
            <Select
              placeholder="Select parent page (optional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={parentPages.map((page) => ({
                label: `${page.label} (${page.route})`,
                value: page.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="displayOrder"
            label="Display Order"
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Create Action"
        open={isCreateActionModalOpen}
        onOk={handleCreateAction}
        onCancel={() => {
          setIsCreateActionModalOpen(false);
          resetActionForms();
        }}
        confirmLoading={createActionMutation.isPending}
        width={600}
      >
        <Form form={createActionForm} layout="vertical">
          <Form.Item
            name="label"
            label="Action Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Button label visible to users" />
          </Form.Item>
          <Form.Item
            name="action"
            label="Action Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., VIEW, CREATE, EDIT" />
          </Form.Item>
          <Form.Item name="icon" label="Icon">
            <Input placeholder="Optional icon" />
          </Form.Item>
          <Form.Item name="variant" label="Variant">
            <Input placeholder="Optional variant or style" />
          </Form.Item>
          <Form.Item name="endpointId" label="Linked Endpoint">
            <Select
              placeholder="Select endpoint to link (optional)"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={endpoints.map((endpoint) => ({
                label: `${endpoint.method} ${endpoint.path} (${endpoint.service || 'N/A'})`,
                value: endpoint.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="displayOrder" label="Display Order">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked" initialValue>
            <Switch checkedChildren="Active" unCheckedChildren="Disabled" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit Action"
        open={isEditActionModalOpen}
        onOk={handleUpdateAction}
        onCancel={() => {
          setIsEditActionModalOpen(false);
          resetActionForms();
        }}
        confirmLoading={updateActionMutation.isPending}
        width={600}
      >
        <Form form={editActionForm} layout="vertical">
          <Form.Item
            name="label"
            label="Action Label"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Button label visible to users" />
          </Form.Item>
          <Form.Item
            name="action"
            label="Action Type"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="e.g., VIEW, CREATE, EDIT" />
          </Form.Item>
          <Form.Item name="icon" label="Icon">
            <Input placeholder="Optional icon" />
          </Form.Item>
          <Form.Item name="variant" label="Variant">
            <Input placeholder="Optional variant or style" />
          </Form.Item>
          <Form.Item name="endpointId" label="Linked Endpoint">
            <Select
              placeholder="Select endpoint to link"
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={endpoints.map((endpoint) => ({
                label: `${endpoint.method} ${endpoint.path} (${endpoint.service || 'N/A'})`,
                value: endpoint.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="displayOrder" label="Display Order">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Disabled" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
