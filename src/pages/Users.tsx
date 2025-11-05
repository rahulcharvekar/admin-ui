import { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Typography,
  App,
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
import type { User, CreateUserRequest, UpdateUserRequest } from '../types';

const { Title } = Typography;

export const Users = () => {
  const { modal } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch users
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.users.getAll();
      return response.data as User[];
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserRequest) => api.users.create(userData),
    onSuccess: () => {
      message.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to create user');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: number; userData: UpdateUserRequest }) =>
      api.users.update(userId, userData),
    onSuccess: () => {
      message.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update user');
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, enabled }: { userId: number; enabled: boolean }) => 
      api.users.updateStatus(userId, enabled),
    onSuccess: () => {
      message.success('User status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.error || 'Failed to update user status');
    },
  });

  // Filter users based on search and sort by ID
  const filteredUsers = users
    .filter(
      (user) =>
        user.username.toLowerCase().includes(searchText.toLowerCase()) ||
        user.email.toLowerCase().includes(searchText.toLowerCase()) ||
        user.fullName.toLowerCase().includes(searchText.toLowerCase())
    )
    .sort((a, b) => a.id - b.id); // Sort by ID in ascending order

  // Handle create user
  const handleCreateUser = async () => {
    try {
      const values = await createForm.validateFields();
      const userData: CreateUserRequest = {
        ...values,
        isActive: true, // New users are enabled by default
      };
      createUserMutation.mutate(userData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle edit user
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      boardId: user.boardId,
      employerId: user.employerId,
    });
    setIsEditModalOpen(true);
  };

  // Handle update user
  const handleUpdateUser = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedUser) {
        // Only send fields that have changed
        const updates: UpdateUserRequest = {};
        if (values.username !== selectedUser.username) updates.username = values.username;
        if (values.email !== selectedUser.email) updates.email = values.email;
        if (values.fullName !== selectedUser.fullName) updates.fullName = values.fullName;
        if (values.password) updates.password = values.password;
        if (values.boardId !== selectedUser.boardId) updates.boardId = values.boardId;
        if (values.employerId !== selectedUser.employerId) updates.employerId = values.employerId;
        // Status is managed via the toggle switch in the table, not in the edit form

        // Update user details
        updateUserMutation.mutate({ userId: selectedUser.id, userData: updates });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // Handle toggle user status
  const handleToggleStatus = (userId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'enable' : 'disable';
    
    modal.confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      content: `Are you sure you want to ${action} this user?`,
      okText: 'Yes',
      cancelText: 'No',
      onOk: () => {
        toggleStatusMutation.mutate({ userId, enabled: newStatus });
      },
    });
  };

  // Table columns
  const columns: ColumnsType<User> = [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 70,
        sorter: (a: User, b: User) => a.id - b.id,
        defaultSortOrder: 'ascend',
      },
      {
        title: 'Username',
        dataIndex: 'username',
        key: 'username',
        render: (text: string) => <strong>{text}</strong>,
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
      },
      {
        title: 'Status',
        dataIndex: 'isActive',
        key: 'status',
        width: 130,
        render: (isActive: boolean, record: User) => (
          <Switch
            checked={isActive}
            onChange={() => handleToggleStatus(record.id, isActive)}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            style={{
              borderRadius: '4px',
              width: '95px',
            }}
            className="square-switch"
          />
        ),
      },
      {
        title: 'Board ID',
        dataIndex: 'boardId',
        key: 'boardId',
        width: 100,
        render: (boardId: string | null) => boardId || '-',
      },
      {
        title: 'Employer ID',
        dataIndex: 'employerId',
        key: 'employerId',
        width: 120,
        render: (employerId: string | null) => employerId || '-',
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 100,
        render: (_: any, record: User) => (
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
            size="small"
          >
            Edit
          </Button>
        ),
      },
    ];

  return (
    <div>
      <Title level={3}>Users</Title>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by username, email, or full name"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          Add User
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredUsers}
        loading={isLoading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: true }}
      />

      {/* Create User Modal */}
      <Modal
        title="Add User"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateUser}
        okText="Create"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Required' },
              { type: 'email', message: 'Invalid email' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item name="boardId" label="Board ID">
            <Input placeholder="Optional" />
          </Form.Item>

          <Form.Item name="employerId" label="Employer ID">
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleUpdateUser}
        okText="Update"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Required' },
              { type: 'email', message: 'Invalid email' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="password" label="New Password (optional)">
            <Input.Password placeholder="Leave empty to keep current" />
          </Form.Item>

          <Form.Item name="boardId" label="Board ID">
            <Input placeholder="Optional" />
          </Form.Item>

          <Form.Item name="employerId" label="Employer ID">
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
