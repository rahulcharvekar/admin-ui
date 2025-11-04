import { useEffect, useState, useCallback } from 'react';
import { Card, Select, Spin, Alert, Typography, Space, Button, Tag } from 'antd';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../services/api';

const { Title } = Typography;
const { Option } = Select;

interface UserData {
  id: number;
  username: string;
  fullName: string;
}

interface PageData {
  id: number;
  label: string;
  route: string;
  icon?: string;
  displayOrder?: number;
  isMenuItem?: boolean;
  isActive?: boolean;
  parentId?: number | null;
  actionCount?: number;
  createdAt?: string;
  updatedAt?: string | null;
}

interface EndpointData {
  id: number;
  service: string;
  version: string;
  method: string;
  path: string;
  description: string;
  ui_type: string | null;
  is_active: boolean;
}

interface ActionData {
  id: number;
  label: string;
  action: string;
  variant: string;
  icon: string;
  display_order: number;
  is_active: boolean;
  endpoint: EndpointData;
}

interface PageAccessData {
  id: number;
  key: string;
  label: string;
  route: string;
  module: string;
  icon: string;
  parent_id: number | null;
  display_order: number;
  is_menu_item: boolean;
  is_active: boolean;
  actions: ActionData[];
  action_count: number;
}

interface UiAccessMatrixResponse {
  generated_at: string;
  version: number;
  page_id: number;
  counts: {
    pages: number;
    page_actions: number;
    endpoints: number;
  };
  ui: PageAccessData[];
}

interface UserEndpointData {
  id: number;
  service: string;
  version: string;
  method: string;
  path: string;
  description: string;
  ui_type: string | null;
  is_active: boolean;
}

interface UserPolicyData {
  id: number;
  name: string;
  description: string;
  type: string;
  policy_type: string;
  is_active: boolean;
  endpoints: UserEndpointData[];
  endpoint_count: number;
}

interface UserRoleData {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  policies: UserPolicyData[];
  policy_count: number;
  endpoint_count: number;
}

interface UserAccessData {
  id: number;
  username: string;
  email: string;
  full_name: string;
  enabled: boolean;
  account_non_locked: boolean;
  account_non_expired: boolean;
  credentials_non_expired: boolean;
  permission_version: number;
  legacy_role: string;
  roles: UserRoleData[];
  role_count: number;
  policy_count: number;
  endpoint_count: number;
}

interface UserAccessMatrixResponse {
  generated_at: string;
  version: number;
  filters: {
    user_id: number;
  };
  counts: {
    users: number;
    roles: number;
    policies: number;
    endpoints: number;
    active_policies_total: number;
    active_endpoints_total: number;
  };
  rbac: UserAccessData[];
}

export const AccessVisualization = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'user' | 'page'>('user');
  
  // State to track expanded nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Store full data for rebuild on expand/collapse
  const [userAccessData, setUserAccessData] = useState<UserAccessData | null>(null);
  const [pageAccessData, setPageAccessData] = useState<PageAccessData | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Rebuild visualization when expanded nodes change
  useEffect(() => {
    if (viewType === 'user' && userAccessData && selectedUser) {
      buildUserAccessVisualization(userAccessData, expandedNodes);
    } else if (viewType === 'page' && pageAccessData && selectedPage) {
      buildPageAccessVisualization(pageAccessData, expandedNodes);
    }
  }, [expandedNodes]);

  // Fetch users and pages on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, pagesRes] = await Promise.all([
          api.users.getAll(),
          api.uiPages.getAll(),
        ]);
        
        console.log('Users response:', usersRes.data);
        console.log('Pages response:', pagesRes.data);
        
        // Handle users response (assuming it's an array directly)
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        
        // Handle pages response (it's wrapped in a 'pages' property)
        const pagesData = pagesRes.data?.pages || pagesRes.data;
        setPages(Array.isArray(pagesData) ? pagesData : []);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        setError(err.response?.data?.message || 'Failed to load data');
        setUsers([]);
        setPages([]);
      }
    };
    fetchData();
  }, []);

  // Helper function to create clickable node with expand indicator
  const createExpandableNode = useCallback((
    id: string,
    label: string,
    position: { x: number; y: number },
    style: any,
    hasChildren: boolean,
    isExpanded: boolean,
    onNodeClick?: () => void
  ): Node => {
    const expandIndicator = hasChildren ? (isExpanded ? ' ▼' : ' ▶') : '';
    return {
      id,
      data: { 
        label: `${label}${expandIndicator}`,
        onClick: onNodeClick 
      },
      position,
      style: {
        ...style,
        cursor: hasChildren ? 'pointer' : 'default',
        border: hasChildren ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  }, []);

  // Build user access visualization with expand/collapse
  const buildUserAccessVisualization = useCallback((userData: UserAccessData, expanded: Set<string>) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const userId = userData.id;

    // User node (root) - at the top center
    const userNodeId = `user-${userId}`;
    newNodes.push(
      createExpandableNode(
        userNodeId,
        userData.full_name || userData.username,
        { x: 400, y: 50 },
        {
          background: '#e6f7ff',
          color: '#003a8c',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px',
        },
        userData.roles.length > 0,
        true,
        undefined
      )
    );

    // Roles nodes - horizontal row below user
    const rolesCount = userData.roles.length;
    const roleSpacing = 250;
    const roleStartX = 400 - ((rolesCount - 1) * roleSpacing) / 2;
    
    for (let i = 0; i < userData.roles.length; i++) {
      const role = userData.roles[i];
      const roleX = roleStartX + (i * roleSpacing);
      const roleY = 200;
      const roleNodeId = `role-${role.id}`;
      const isRoleExpanded = expanded.has(roleNodeId);

      newNodes.push(
        createExpandableNode(
          roleNodeId,
          `${role.name}\n(${role.policy_count} policies)`,
          { x: roleX, y: roleY },
          {
            background: '#f6ffed',
            color: '#135200',
            padding: '10px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            textAlign: 'center',
            minWidth: '180px',
          },
          role.policies.length > 0,
          isRoleExpanded,
          () => toggleNodeExpansion(roleNodeId)
        )
      );

      newEdges.push({
        id: `${userNodeId}-${roleNodeId}`,
        source: userNodeId,
        target: roleNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#52c41a', strokeWidth: 2 },
      });

      // Only show policies if role is expanded
      if (isRoleExpanded) {
        const policiesCount = role.policies.length;
        const policySpacing = 200;
        const policyStartX = roleX - ((policiesCount - 1) * policySpacing) / 2;
        
        for (let j = 0; j < role.policies.length; j++) {
          const policy = role.policies[j];
          const policyX = policyStartX + (j * policySpacing);
          const policyY = 380;
          const policyNodeId = `policy-${policy.id}-role-${role.id}`;
          const isPolicyExpanded = expanded.has(policyNodeId);

          newNodes.push(
            createExpandableNode(
              policyNodeId,
              `${policy.name}\n(${policy.endpoint_count} endpoints)`,
              { x: policyX, y: policyY },
              {
                background: '#fff7e6',
                color: '#ad6800',
                padding: '8px 14px',
                borderRadius: '5px',
                fontSize: '12px',
                textAlign: 'center',
                minWidth: '160px',
              },
              policy.endpoints.length > 0,
              isPolicyExpanded,
              () => toggleNodeExpansion(policyNodeId)
            )
          );

          newEdges.push({
            id: `${roleNodeId}-${policyNodeId}`,
            source: roleNodeId,
            target: policyNodeId,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#faad14', strokeWidth: 2 },
          });

          // Only show endpoints if policy is expanded
          if (isPolicyExpanded) {
            const endpointsCount = policy.endpoints.length;
            const endpointSpacing = 180;
            const endpointStartX = policyX - ((endpointsCount - 1) * endpointSpacing) / 2;
            
            for (let k = 0; k < policy.endpoints.length; k++) {
              const endpoint = policy.endpoints[k];
              const endpointX = endpointStartX + (k * endpointSpacing);
              const endpointY = 560;
              const endpointNodeId = `endpoint-${endpoint.id}-policy-${policy.id}-role-${role.id}`;

              newNodes.push(
                createExpandableNode(
                  endpointNodeId,
                  `${endpoint.method}\n${endpoint.path}`,
                  { x: endpointX, y: endpointY },
                  {
                    background: '#fff1f0',
                    color: '#a8071a',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    textAlign: 'center',
                    maxWidth: '160px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    minWidth: '140px',
                  },
                  false,
                  false,
                  undefined
                )
              );

              newEdges.push({
                id: `${policyNodeId}-${endpointNodeId}`,
                source: policyNodeId,
                target: endpointNodeId,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#ff4d4f', strokeWidth: 1 },
              });
            }
          }
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [createExpandableNode, toggleNodeExpansion, setNodes, setEdges]);

  // Build user access map (main entry point)
  const buildUserAccessMap = useCallback(async (userId: number) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user access matrix
      const matrixRes = await api.meta.getUserAccessMatrix(userId);
      const matrixData: UserAccessMatrixResponse = matrixRes.data;

      // Check if we have RBAC data
      if (!matrixData.rbac || matrixData.rbac.length === 0) {
        setError('No access data found for this user');
        setNodes([]);
        setEdges([]);
        setUserAccessData(null);
        setLoading(false);
        return;
      }

      const userData = matrixData.rbac[0]; // Should only be one user
      setUserAccessData(userData);
      
      // Initially all nodes are collapsed (empty set)
      const initialExpanded = new Set<string>();
      setExpandedNodes(initialExpanded);
      
      buildUserAccessVisualization(userData, initialExpanded);
    } catch (err: any) {
      console.error('Failed to build user access map:', err);
      setError(err.response?.data?.message || 'Failed to build access map');
      setUserAccessData(null);
    } finally {
      setLoading(false);
    }
  }, [buildUserAccessVisualization, setNodes, setEdges, setUserAccessData, setExpandedNodes]);

  // Build page access visualization with expand/collapse
  const buildPageAccessVisualization = useCallback((pageData: PageAccessData, expanded: Set<string>) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const pageId = pageData.id;

    // Page node (root) - at the top center
    const pageNodeId = `page-${pageId}`;
    newNodes.push(
      createExpandableNode(
        pageNodeId,
        pageData.label,
        { x: 400, y: 50 },
        {
          background: '#f9f0ff',
          color: '#531dab',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px',
        },
        pageData.actions.length > 0,
        true,
        undefined
      )
    );

    // Actions nodes - horizontal row below page
    const actionsCount = pageData.actions.length;
    const actionSpacing = 220;
    const actionStartX = 400 - ((actionsCount - 1) * actionSpacing) / 2;
    
    for (let i = 0; i < pageData.actions.length; i++) {
      const action = pageData.actions[i];
      const actionX = actionStartX + (i * actionSpacing);
      const actionY = 200;
      const actionNodeId = `action-${action.id}`;
      const isActionExpanded = expanded.has(actionNodeId);

      newNodes.push(
        createExpandableNode(
          actionNodeId,
          action.label,
          { x: actionX, y: actionY },
          {
            background: '#e6fffb',
            color: '#006d75',
            padding: '10px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            textAlign: 'center',
            minWidth: '160px',
          },
          !!action.endpoint,
          isActionExpanded,
          () => toggleNodeExpansion(actionNodeId)
        )
      );

      newEdges.push({
        id: `${pageNodeId}-${actionNodeId}`,
        source: pageNodeId,
        target: actionNodeId,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#13c2c2', strokeWidth: 2 },
      });

      // Only show endpoint if action is expanded
      if (isActionExpanded && action.endpoint) {
        const endpoint = action.endpoint;
        const endpointNodeId = `endpoint-${endpoint.id}-${actionNodeId}`;

        newNodes.push(
          createExpandableNode(
            endpointNodeId,
            `${endpoint.method}\n${endpoint.path}`,
            { x: actionX, y: 380 },
            {
              background: '#fff1f0',
              color: '#a8071a',
              padding: '8px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '200px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              minWidth: '140px',
            },
            false,
            false,
            undefined
          )
        );

        newEdges.push({
          id: `${actionNodeId}-${endpointNodeId}`,
          source: actionNodeId,
          target: endpointNodeId,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#ff4d4f', strokeWidth: 1 },
        });
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [createExpandableNode, toggleNodeExpansion, setNodes, setEdges]);

  // Build page access map (main entry point)
  const buildPageAccessMap = useCallback(async (pageId: number) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch UI access matrix for the page
      const matrixRes = await api.meta.getUiAccessMatrix(pageId);
      const matrixData: UiAccessMatrixResponse = matrixRes.data;

      // Check if we have UI data
      if (!matrixData.ui || matrixData.ui.length === 0) {
        setError('No access data found for this page');
        setNodes([]);
        setEdges([]);
        setPageAccessData(null);
        setLoading(false);
        return;
      }

      const pageData = matrixData.ui[0]; // Should only be one page
      setPageAccessData(pageData);
      
      // Initially all nodes are collapsed (empty set)
      const initialExpanded = new Set<string>();
      setExpandedNodes(initialExpanded);
      
      buildPageAccessVisualization(pageData, initialExpanded);
    } catch (err: any) {
      console.error('Failed to build page access map:', err);
      setError(err.response?.data?.message || 'Failed to build page access map');
      setPageAccessData(null);
    } finally {
      setLoading(false);
    }
  }, [buildPageAccessVisualization, setNodes, setEdges, setPageAccessData, setExpandedNodes]);

  // Handle user selection
  const handleUserChange = (userId: number) => {
    setSelectedUser(userId);
    setSelectedPage(null);
    buildUserAccessMap(userId);
  };

  // Handle page selection
  const handlePageChange = (pageId: number) => {
    setSelectedPage(pageId);
    setSelectedUser(null);
    buildPageAccessMap(pageId);
  };

  // Clear visualization
  const handleClear = () => {
    setSelectedUser(null);
    setSelectedPage(null);
    setNodes([]);
    setEdges([]);
    setExpandedNodes(new Set());
    setUserAccessData(null);
    setPageAccessData(null);
  };

  // Handle node click for expand/collapse
  const handleNodeClick = useCallback((_event: any, node: Node) => {
    if (node.data.onClick) {
      node.data.onClick();
    }
  }, []);

  return (
    <div>
      <Title level={2}>Access Visualization</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Select
              style={{ width: 200 }}
              placeholder="Select View Type"
              value={viewType}
              onChange={setViewType}
            >
              <Option value="user">User Access Flow</Option>
              <Option value="page">UI Page Flow</Option>
            </Select>

            {viewType === 'user' && (
              <Select
                showSearch
                style={{ width: 300 }}
                placeholder="Select a user"
                value={selectedUser}
                onChange={handleUserChange}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                optionFilterProp="children"
              >
                {users && Array.isArray(users) && users.map(user => (
                  <Option key={user.id} value={user.id}>
                    {user.fullName} ({user.username})
                  </Option>
                ))}
              </Select>
            )}

            {viewType === 'page' && (
              <Select
                showSearch
                style={{ width: 300 }}
                placeholder="Select a page"
                value={selectedPage}
                onChange={handlePageChange}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                optionFilterProp="children"
              >
                {pages && Array.isArray(pages) && pages.map(page => (
                  <Option key={page.id} value={page.id}>
                    {page.label}
                  </Option>
                ))}
              </Select>
            )}

            <Button onClick={handleClear}>Clear</Button>
          </Space>

          <Space>
            <Tag color="blue">User/Page</Tag>
            <Tag color="green">Role</Tag>
            <Tag color="orange">Policy</Tag>
            <Tag color="cyan">Action</Tag>
            <Tag color="red">Endpoint</Tag>
          </Space>

          <Alert
            message="Interactive Top-Down Visualization"
            description="All nodes start collapsed. Click on nodes with arrows (▶/▼) to expand and see their children in a vertical tree structure."
            type="info"
            showIcon
            closable
          />

          {error && <Alert message={error} type="error" />}
        </Space>
      </Card>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Building visualization...</div>
          </div>
        ) : (
          <div style={{ height: '70vh', width: '100%' }}>
            {nodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px 0', color: '#999' }}>
                Select a {viewType === 'user' ? 'user' : 'page'} to visualize access flow
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                fitView
                attributionPosition="bottom-left"
              >
                <Controls />
                <Background />
              </ReactFlow>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
