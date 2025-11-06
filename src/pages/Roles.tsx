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
import type { Role } from '../types';
import { useQueryError } from '../hooks/useQueryError';
import { AccessDenied } from '../components/AccessDenied';

const { Title } = Typography;

interface RoleForm {
  name: string;
  description?: string;
}

export const Roles = () => {
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch roles
  const {
    data: roles = [],
    isLoading,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await api.roles.getAll();
      return response.data as Role[];
    },
  });

  const { isAccessDenied } = useQueryError({ isError, error });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (roleData: RoleForm) => api.roles.create(roleData),
    onSuccess: () => {
      message.success('Role created successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create role');
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, roleData }: { roleId: number; roleData: RoleForm }) =>
      api.roles.update(roleId, roleData),
    onSuccess: () => {
      message.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsEditModalOpen(false);
      setSelectedRole(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update role');
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: number) => api.roles.delete(roleId),
    onSuccess: () => {
      message.success('Role deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to delete role');
    },
  });

  // Filter roles based on search
  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (role.description && role.description.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Handle create role
  const handleCreateRole = async () => {
    try {
      const values = await createForm.validateFields();
      createRoleMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit role
  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    editForm.setFieldsValue({
      name: role.name,
      description: role.description,
    });
    setIsEditModalOpen(true);
  };

  // Handle update role
  const handleUpdateRole = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedRole) {
        // Update role details
        updateRoleMutation.mutate({ roleId: selectedRole.id, roleData: values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle delete role
  const handleDeleteRole = (roleId: number) => {
    deleteRoleMutation.mutate(roleId);
  };

  // Table columns
  const columns: ColumnsType<Role> = [
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
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this role?"
            onConfirm={() => handleDeleteRole(record.id)}
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
        <Title level={3} style={{ margin: 0 }}>Roles Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
          Create Role
        </Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="Search roles..."
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
        dataSource={filteredRoles}
        rowKey="id"
        loading={isLoading}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total) => `Total: ${total} roles`,
        }}
        size="small"
      />

      {/* Create Role Modal */}
      <Modal
        title="Create Role"
        open={isCreateModalOpen}
        onOk={handleCreateRole}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        confirmLoading={createRoleMutation.isPending}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        title="Edit Role"
        open={isEditModalOpen}
        onOk={handleUpdateRole}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedRole(null);
          editForm.resetFields();
        }}
        confirmLoading={updateRoleMutation.isPending}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Role Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
