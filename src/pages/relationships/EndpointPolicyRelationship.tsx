import { useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Typography,
  Card,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const { Title } = Typography;

interface Policy {
  id: number;
  name: string;
  description?: string;
}

interface Endpoint {
  id: number;
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  isActive: boolean;
  policies?: Policy[];
}

export const EndpointPolicyRelationship = () => {
  const [searchText, setSearchText] = useState('');
  const navigate = useNavigate();

  // Fetch endpoints (with policies included in response)
  const {
    data: endpoints = [],
    isLoading: endpointsLoading,
    refetch: refetchEndpoints,
  } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data as Endpoint[];
    },
  });

  // Filter endpoints based on search
  const filteredEndpoints = endpoints.filter(
    (endpoint) =>
      endpoint.service.toLowerCase().includes(searchText.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchText.toLowerCase()) ||
      endpoint.method.toLowerCase().includes(searchText.toLowerCase()) ||
      endpoint.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleEditEndpoint = (endpointId: number) => {
    // Navigate to endpoints page with edit mode
    navigate('/endpoints', { state: { editEndpointId: endpointId } });
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      PATCH: 'purple',
      DELETE: 'red',
    };
    return colors[method] || 'default';
  };

  const columns: ColumnsType<Endpoint> = [
    {
      title: 'Endpoint ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      width: 150,
      render: (service: string) => <Tag color="cyan">{service}</Tag>,
      sorter: (a, b) => a.service.localeCompare(b.service),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
      filters: [
        { text: 'GET', value: 'GET' },
        { text: 'POST', value: 'POST' },
        { text: 'PUT', value: 'PUT' },
        { text: 'PATCH', value: 'PATCH' },
        { text: 'DELETE', value: 'DELETE' },
      ],
      onFilter: (value, record) => record.method === value,
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      width: 300,
      ellipsis: true,
      render: (path: string) => (
        <code style={{ fontSize: '12px', background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
          {path}
        </code>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
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
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Assigned Policies',
      key: 'policies',
      render: (_, record) => (
        <Space size={[0, 8]} wrap>
          {!record.policies || record.policies.length === 0 ? (
            <Tag color="default">No policies assigned</Tag>
          ) : (
            record.policies.map((policy: Policy) => (
              <Tooltip key={policy.id} title={policy.description}>
                <Tag color="gold">{policy.name}</Tag>
              </Tooltip>
            ))
          )}
        </Space>
      ),
    },
    {
      title: 'Policy Count',
      key: 'policyCount',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Tag color="blue">
          {record.policies?.length || 0} {record.policies?.length === 1 ? 'policy' : 'policies'}
        </Tag>
      ),
      sorter: (a, b) => (a.policies?.length || 0) - (b.policies?.length || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Tooltip title="Edit endpoint to modify policies">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditEndpoint(record.id)}
          >
            Edit
          </Button>
        </Tooltip>
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
              Endpoint-Policy Relationships
            </Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchEndpoints()}
              loading={endpointsLoading}
            >
              Refresh
            </Button>
          </div>

          {/* Description */}
          <div style={{ color: '#666', marginBottom: 8 }}>
            View which policies protect each endpoint. Policies are managed during endpoint
            creation/editing. Click "Edit" to modify an endpoint's policies.
          </div>

          {/* Search */}
          <Input
            placeholder="Search by service, path, method, or description..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 400 }}
            allowClear
          />

          {/* Summary Stats */}
          <Space size="large">
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                {endpoints.length}
              </span>
              <div style={{ color: '#999', fontSize: '12px' }}>Total Endpoints</div>
            </div>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                {endpoints.filter(e => e.isActive).length}
              </span>
              <div style={{ color: '#999', fontSize: '12px' }}>Active Endpoints</div>
            </div>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                {endpoints.filter(e => e.policies && e.policies.length > 0).length}
              </span>
              <div style={{ color: '#999', fontSize: '12px' }}>Protected Endpoints</div>
            </div>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                {endpoints.filter(e => !e.policies || e.policies.length === 0).length}
              </span>
              <div style={{ color: '#999', fontSize: '12px' }}>Unprotected Endpoints</div>
            </div>
          </Space>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredEndpoints}
            rowKey="id"
            loading={endpointsLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} endpoints`,
            }}
            scroll={{ x: 1400 }}
            bordered
          />
        </Space>
      </Card>
    </div>
  );
};

export default EndpointPolicyRelationship;
