import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, Select, Spin, Alert, Typography, Space, Button, Input, Tree, Tag, Tooltip } from 'antd';
import type { TreeDataNode } from 'antd';
import { api } from '../../services/api';
import { AccessDenied } from '../../components/AccessDenied';
import { summaryCountLabel } from './graphUtils';

const { Title } = Typography;
const { Option } = Select;

interface UserData {
  id: number;
  username: string;
  fullName: string;
  email?: string;
}

interface UserAccessMatrixPageAction {
  action: string;
  label: string;
  page?: {
    key: string;
    label: string;
    route: string;
  };
}

interface UserAccessMatrixEndpoint {
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  page_actions: UserAccessMatrixPageAction[];
}

interface UserAccessMatrixPolicy {
  name: string;
  description?: string;
  endpoints: UserAccessMatrixEndpoint[];
}

interface UserAccessMatrixRole {
  name: string;
  description?: string;
  policies: UserAccessMatrixPolicy[];
}

interface UserAccessMatrixResponse {
  generated_at: string;
  version: number;
  filters: {
    user_id: number;
  };
  roles: UserAccessMatrixRole[];
}

interface ProcessedUserAccessData {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  roles: UserAccessMatrixRole[];
}

const highlightText = (text: string, query: string) => {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'ig');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <span key={`${part}-${index}`} style={{ backgroundColor: '#fff566' }}>
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
};

const buildTreeData = (userData: ProcessedUserAccessData, searchQuery: string): TreeDataNode[] => {
  const roles = userData.roles || [];
  const userLabel = userData.fullName
    ? `${userData.fullName} (${userData.username})`
    : userData.username;

  const TAG_COLORS = {
    user: 'blue',
    role: 'green',
    policy: 'orange',
    endpoint: 'red',
    action: 'purple',
  };

  const METHOD_COLORS: Record<string, string> = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    PATCH: 'purple',
    DELETE: 'red',
  };

  const getMethodColor = (method?: string) => {
    if (!method) return 'geekblue';
    const key = method.toUpperCase();
    return METHOD_COLORS[key] ?? 'geekblue';
  };

  const createTitleRow = (
    content: ReactNode,
    typeLabel: string,
    tagColor: string,
    childCountLabel?: string
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {content}
      <Tag color={tagColor} style={{ marginInlineStart: 0 }}>
        {typeLabel}
      </Tag>
      {childCountLabel ? <span style={{ color: '#8c8c8c', fontSize: 12 }}>[{childCountLabel}]</span> : null}
    </div>
  );

  const renderDescriptionLine = (displayText?: string, tooltipText?: string) => {
    if (!displayText) return null;
    const content = (
      <span
        style={{
          color: '#595959',
          fontSize: 12,
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {highlightText(displayText, searchQuery)}
      </span>
    );
    return <Tooltip title={tooltipText ?? displayText}>{content}</Tooltip>;
  };

  const userNode: TreeDataNode = {
    key: `user-${userData.id}`,
    title: (
      <div>
        {createTitleRow(
          <strong>{highlightText(userLabel, searchQuery)}</strong>,
          'User',
          TAG_COLORS.user,
          summaryCountLabel(roles.length, 'role')
        )}
        {renderDescriptionLine(userData.email)}
      </div>
    ),
    children: roles.map((role, roleIndex) => {
      const roleNodeKey = `role-${userData.id}-${roleIndex}`;
      const policies = role.policies || [];
      return {
        key: roleNodeKey,
        title: (
          <div>
            {createTitleRow(
              <strong>{highlightText(role.name, searchQuery)}</strong>,
              'Role',
              TAG_COLORS.role,
              summaryCountLabel(policies.length, 'policy', 'policies')
            )}
            {renderDescriptionLine(role.description)}
          </div>
        ),
        children: policies.map((policy, policyIndex) => {
          const policyNodeKey = `${roleNodeKey}-policy-${policyIndex}`;
          const endpoints = policy.endpoints || [];
          return {
            key: policyNodeKey,
            title: (
              <div>
                {createTitleRow(
                  <strong>{highlightText(policy.name, searchQuery)}</strong>,
                  'Policy',
                  TAG_COLORS.policy,
                  summaryCountLabel(endpoints.length, 'endpoint')
                )}
                {renderDescriptionLine(policy.description)}
              </div>
            ),
            children: endpoints.map((endpoint, endpointIndex) => {
              const endpointNodeKey = `${policyNodeKey}-endpoint-${endpointIndex}`;
              const actions = endpoint.page_actions || [];
              const endpointTitle = `${endpoint.method} ${endpoint.path}`;
              const serviceInfo = [endpoint.service, endpoint.version].filter(Boolean).join(' • ');
              const methodTag = endpoint.method ? (
                <Tag color={getMethodColor(endpoint.method)} style={{ marginInlineEnd: 0 }}>
                  {endpoint.method}
                </Tag>
              ) : null;
              const endpointPath = endpoint.path || endpointTitle.trim();
              const endpointDescription = endpoint.description || serviceInfo || '';
              const endpointTooltipText = [endpoint.description, serviceInfo].filter(Boolean).join(' • ') || undefined;
              const endpointContent = (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {methodTag}
                  <strong>{highlightText(endpointPath, searchQuery)}</strong>
                </span>
              );
              return {
                key: endpointNodeKey,
                title: (
                  <div>
                    {createTitleRow(
                      endpointContent,
                      'Endpoint',
                      TAG_COLORS.endpoint,
                      summaryCountLabel(actions.length, 'action')
                    )}
                    {renderDescriptionLine(endpointDescription, endpointTooltipText)}
                  </div>
                ),
                children: actions.map((action, actionIndex) => {
                  const actionNodeKey = `${endpointNodeKey}-action-${actionIndex}`;
                  const actionLabel = action.label || action.action || 'Action';
                  const page = action.page
                    ? `${action.page.label ?? action.page.key} ${action.page.route ?? ''}`.trim()
                    : '';
                  return {
                    key: actionNodeKey,
                    title: (
                      <div>
                        {createTitleRow(
                          <strong>{highlightText(actionLabel, searchQuery)}</strong>,
                          'Page Action',
                          TAG_COLORS.action,
                          undefined
                        )}
                        {renderDescriptionLine(page)}
                      </div>
                    ),
                  };
                }),
              };
            }),
          };
        }),
      };
    }),
  };

  return [userNode];
};

const flattenTree = (nodes: TreeDataNode[]): React.Key[] => {
  const keys: React.Key[] = [];
  const traverse = (items: TreeDataNode[]) => {
    items.forEach((item) => {
      keys.push(item.key);
      if (item.children) {
        traverse(item.children as TreeDataNode[]);
      }
    });
  };
  traverse(nodes);
  return keys;
};

export const UserAccessTreeView: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [userAccessData, setUserAccessData] = useState<ProcessedUserAccessData | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRes = await api.users.getAll();
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        setForbidden(false);
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError(err.response?.data?.message || 'Failed to load users');
        if (err.response?.status === 403) setForbidden(true);
        setUsers([]);
      }
    };
    fetchUsers();
  }, []);

  const userSummary = useMemo(() => {
    if (!userAccessData) return null;

    const roles = userAccessData.roles || [];
    let policiesCount = 0;
    let endpointsCount = 0;
    let actionsCount = 0;
    const pageKeys = new Set<string>();

    roles.forEach((role) => {
      const policies = role.policies || [];
      policiesCount += policies.length;
      policies.forEach((policy) => {
        const endpoints = policy.endpoints || [];
        endpointsCount += endpoints.length;
        endpoints.forEach((endpoint) => {
          const actions = endpoint.page_actions || [];
          actionsCount += actions.length;
          actions.forEach((action) => {
            if (action.page) {
              const key =
                action.page.key ||
                action.page.route ||
                action.page.label ||
                action.label ||
                action.action ||
                '';
              if (key) pageKeys.add(key);
            }
          });
        });
      });
    });

    const userLabel = userAccessData.fullName
      ? `${userAccessData.fullName} (${userAccessData.username})`
      : userAccessData.username;

    return {
      userLabel,
      rolesLabel: summaryCountLabel(roles.length, 'role'),
      policiesLabel: summaryCountLabel(policiesCount, 'policy', 'policies'),
      endpointsLabel: summaryCountLabel(endpointsCount, 'endpoint'),
      actionsLabel: summaryCountLabel(actionsCount, 'action'),
      pagesLabel: summaryCountLabel(pageKeys.size, 'page'),
    };
  }, [userAccessData]);

  const buildTree = useCallback(
    (data: ProcessedUserAccessData, query: string) => {
      const tree = buildTreeData(data, query);
      setTreeData(tree);
      if (tree.length) {
        setExpandedKeys(flattenTree(tree));
        setAutoExpandParent(true);
      } else {
        setExpandedKeys([]);
      }
    },
    []
  );

  const handleUserChange = async (userId: number) => {
    setSelectedUser(userId);
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const matrixRes = await api.meta.getUserAccessMatrix(userId);
      const matrixData: UserAccessMatrixResponse = matrixRes.data;
      if (!matrixData.roles || matrixData.roles.length === 0) {
        setError('No access data found for this user');
        setTreeData([]);
        setExpandedKeys([]);
        setUserAccessData(null);
      } else {
        const selectedUserMeta = users.find((user) => user.id === userId);
        const processedData: ProcessedUserAccessData = {
          id: userId,
          username: selectedUserMeta?.username || `User ${userId}`,
          fullName: selectedUserMeta?.fullName,
          email: selectedUserMeta?.email,
          roles: matrixData.roles,
        };
        setUserAccessData(processedData);
        buildTree(processedData, searchQuery);
      }
    } catch (err: any) {
      console.error('Failed to build user access tree:', err);
      setError(err.response?.data?.message || 'Failed to build access tree');
      if (err.response?.status === 403) setForbidden(true);
      setTreeData([]);
      setExpandedKeys([]);
      setUserAccessData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (userAccessData) {
      buildTree(userAccessData, value);
    }
  };

  const handleClear = () => {
    setSelectedUser(null);
    setTreeData([]);
    setExpandedKeys([]);
    setUserAccessData(null);
    setSearchQuery('');
  };

  return (
    <div>
      <Title level={2}>User Access Explorer</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap align="center">
            <Select
              showSearch
              style={{ width: 320 }}
              placeholder="Select a user"
              value={selectedUser}
              onChange={handleUserChange}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              optionFilterProp="children"
              allowClear
              onClear={handleClear}
            >
              {users &&
                Array.isArray(users) &&
                users.map((user) => (
                  <Option key={user.id} value={user.id}>
                    {user.fullName} ({user.username})
                  </Option>
                ))}
            </Select>

            {treeData.length > 0 && (
              <Input
                allowClear
                style={{ width: 320 }}
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            )}

            <Button onClick={handleClear}>Clear</Button>
          </Space>

          {userAccessData && userSummary && (
            <Space wrap>
              <Tag color="blue">{userSummary.userLabel}</Tag>
              <Tag color="green">{userSummary.rolesLabel}</Tag>
              <Tag color="orange">{userSummary.policiesLabel}</Tag>
              <Tag color="red">{userSummary.endpointsLabel}</Tag>
              <Tag color="cyan">{userSummary.actionsLabel}</Tag>
              <Tag color="purple">{userSummary.pagesLabel}</Tag>
            </Space>
          )}
        </Space>
      </Card>

      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Card style={{ minHeight: '60vh' }}>
        {loading ? (
          <Spin tip="Loading access tree..." />
        ) : forbidden ? (
          <AccessDenied
            message="Access Denied"
            description={error || 'You do not have permission to view this data.'}
          />
        ) : (
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={(keys) => {
              setExpandedKeys(keys);
              setAutoExpandParent(false);
            }}
            autoExpandParent={autoExpandParent}
            selectable={false}
            showLine={{ showLeafIcon: false }}
            style={{ background: 'transparent' }}
          />
        )}
      </Card>
    </div>
  );
};
