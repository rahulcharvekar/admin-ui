import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Select, Spin, Alert, Typography, Space, Button, Tag, Input } from 'antd';
import ReactFlow, { Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import type { Node, Edge, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import type { AccessEdgeData, AccessNodeData } from './graphUtils';
import {
  accessEdgeTypes,
  accessNodeTypes,
  createAccessEdge,
  createAccessNode,
  formatCountLabel,
  layoutNodes,
  summaryCountLabel,
} from './graphUtils';
import { api } from '../../services/api';
import { AccessDenied } from '../../components/AccessDenied';
import type {
  ProcessedUserAccessData,
  UserAccessMatrixEndpoint,
  UserAccessMatrixPageAction,
  UserAccessMatrixPolicy,
  UserAccessMatrixResponse,
  UserAccessMatrixRole,
} from './userAccessUtils';
import { calculateUserHierarchyCounts, mergePageKeysFromActions } from './userAccessUtils';

const { Title } = Typography;
const { Option } = Select;

interface UserData {
  id: number;
  username: string;
  fullName: string;
  email?: string;
}

export const UserAccessVisualization: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userAccessData, setUserAccessData] = useState<ProcessedUserAccessData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AccessNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdgeData>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [forbidden, setForbidden] = useState(false);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const pendingFitViewRef = useRef(false);

  const applyGraph = useCallback(
    (nextNodes: Node<AccessNodeData>[], nextEdges: Edge<AccessEdgeData>[]) => {
      const layoutedNodes = layoutNodes(nextNodes, nextEdges);
      setNodes(layoutedNodes);
      setEdges(nextEdges);
      pendingFitViewRef.current = true;
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    if (!pendingFitViewRef.current || nodes.length === 0) return;
    const handle = window.setTimeout(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
      pendingFitViewRef.current = false;
    }, 50);
    return () => window.clearTimeout(handle);
  }, [nodes, edges]);

  const nodeMatchesSearch = useCallback((label: string, query: string) => {
    if (!query) return false;
    return label.toLowerCase().includes(query.toLowerCase());
  }, []);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const userSummary = useMemo(() => {
    if (!userAccessData) return null;

    const counts = calculateUserHierarchyCounts(userAccessData);

    const userLabel = userAccessData.fullName
      ? `${userAccessData.fullName} (${userAccessData.username})`
      : userAccessData.username;

    return {
      userLabel,
      rolesLabel: summaryCountLabel(counts.rolesCount, 'role'),
      policiesLabel: summaryCountLabel(counts.policiesCount, 'policy', 'policies'),
      endpointsLabel: summaryCountLabel(counts.endpointsCount, 'endpoint'),
      actionsLabel: summaryCountLabel(counts.actionsCount, 'action'),
      pagesLabel: summaryCountLabel(counts.pagesCount, 'page'),
    };
  }, [userAccessData]);

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

  const buildUserAccessVisualization = useCallback(
    (userData: ProcessedUserAccessData, expanded: Set<string>) => {
      const nextNodes: Node<AccessNodeData>[] = [];
      const nextEdges: Edge<AccessEdgeData>[] = [];
      const userId = userData.id;
      const roles = userData.roles || [];
      const userCounts = calculateUserHierarchyCounts(userData);
      const userSummaryItems = [
        summaryCountLabel(userCounts.rolesCount, 'role'),
        summaryCountLabel(userCounts.policiesCount, 'policy', 'policies'),
        summaryCountLabel(userCounts.endpointsCount, 'endpoint'),
        summaryCountLabel(userCounts.pagesCount, 'page'),
        summaryCountLabel(userCounts.actionsCount, 'action'),
      ];
      const hasUserHierarchy =
        userCounts.rolesCount +
          userCounts.policiesCount +
          userCounts.endpointsCount +
          userCounts.pagesCount +
          userCounts.actionsCount >
        0;

      const hasSearch = !!searchQuery;
      const matchesString = (value: string | undefined | null): boolean => {
        if (!hasSearch || !value) return false;
        return nodeMatchesSearch(value, searchQuery);
      };
      const matchesStrings = (...values: Array<string | undefined | null>) =>
        values.some((value) => matchesString(value));
      const matchesPage = (page?: { key?: string; label?: string; route?: string } | null): boolean =>
        !!page && matchesStrings(page.label, page.route, page.key);
      const matchesPageAction = (action?: UserAccessMatrixPageAction | null): boolean => {
        if (!action) return false;
        if (matchesStrings(action.label, action.action)) return true;
        if (action.page && matchesPage(action.page)) return true;
        return false;
      };
      const matchesEndpoint = (endpoint?: UserAccessMatrixEndpoint | null): boolean => {
        if (!endpoint) return false;
        if (matchesStrings(endpoint.service, endpoint.version, endpoint.method, endpoint.path, endpoint.description)) {
          return true;
        }
        return (endpoint.page_actions || []).some((action) => matchesPageAction(action));
      };
      const matchesPolicy = (policy?: UserAccessMatrixPolicy | null): boolean => {
        if (!policy) return false;
        if (matchesStrings(policy.name, policy.description)) return true;
        return (policy.endpoints || []).some((endpoint) => matchesEndpoint(endpoint));
      };
      const matchesRole = (role?: UserAccessMatrixRole | null): boolean => {
        if (!role) return false;
        if (matchesStrings(role.name, role.description)) return true;
        return (role.policies || []).some((policy) => matchesPolicy(policy));
      };
      const matchesUser = (user?: ProcessedUserAccessData | null): boolean => {
        if (!user) return false;
        if (matchesStrings(user.username, user.fullName, user.email)) return true;
        return (user.roles || []).some((role) => matchesRole(role));
      };

      const userDisplayName = userData.fullName
        ? `${userData.fullName} (${userData.username})`
        : userData.username;

      nextNodes.push(
        createAccessNode(`user-${userId}`, 'user', {
          title: userDisplayName,
          subtitle: userData.email,
          badges: [{ text: summaryCountLabel(roles.length, 'role') }],
          summaryItems: hasUserHierarchy ? userSummaryItems : undefined,
          highlight: matchesUser(userData),
        })
      );

      roles.forEach((role, roleIndex) => {
        const policies = role.policies || [];
        const roleNodeId = `role-${userId}-${roleIndex}`;
        const isRoleExpanded = expanded.has(roleNodeId);
        let endpointCount = 0;
        let actionCount = 0;
        const uniquePages = new Set<string>();
        policies.forEach((policy) => {
          (policy.endpoints || []).forEach((endpoint) => {
            endpointCount += 1;
            const endpointActions = endpoint.page_actions || [];
            actionCount += endpointActions.length;
            mergePageKeysFromActions(endpointActions, uniquePages);
          });
        });
        const roleSummaryItems = [
          summaryCountLabel(policies.length, 'policy', 'policies'),
          summaryCountLabel(endpointCount, 'endpoint'),
          summaryCountLabel(uniquePages.size, 'page'),
          summaryCountLabel(actionCount, 'action'),
        ];
        const hasRoleHierarchy =
          policies.length > 0 || endpointCount > 0 || uniquePages.size > 0 || actionCount > 0;

        nextNodes.push(
          createAccessNode(roleNodeId, 'role', {
            title: role.name,
            description: role.description,
            badges: [
              { text: formatCountLabel(policies.length, 'policy') },
              { text: formatCountLabel(endpointCount, 'endpoint') },
              { text: formatCountLabel(actionCount, 'action') },
              { text: formatCountLabel(uniquePages.size, 'page') },
            ].filter((badge) => badge.text),
            highlight: matchesRole(role),
            collapsible: policies.length > 0,
            isExpanded: isRoleExpanded,
            onToggle: () => toggleNodeExpansion(roleNodeId),
            summaryItems: hasRoleHierarchy ? roleSummaryItems : undefined,
          })
        );

        nextEdges.push(
          createAccessEdge(`edge-user-role-${userId}-${roleIndex}`, `user-${userId}`, roleNodeId, {
            label: 'Assigned Role',
            color: '#52c41a',
            animated: true,
            highlight: matchesUser(userData) && matchesRole(role),
          })
        );

        if (isRoleExpanded) {
          policies.forEach((policy, policyIndex) => {
            const policyNodeId = `policy-${userId}-${roleIndex}-${policyIndex}`;
            const endpoints = policy.endpoints || [];
            const isPolicyExpanded = expanded.has(policyNodeId);
            let totalActions = 0;
            const uniquePolicyPages = new Set<string>();
            endpoints.forEach((endpoint) => {
              const actions = endpoint.page_actions || [];
              totalActions += actions.length;
              mergePageKeysFromActions(actions, uniquePolicyPages);
            });
            const policySummaryItems = [
              summaryCountLabel(endpoints.length, 'endpoint'),
              summaryCountLabel(uniquePolicyPages.size, 'page'),
              summaryCountLabel(totalActions, 'action'),
            ];
            const hasPolicyHierarchy =
              endpoints.length > 0 || uniquePolicyPages.size > 0 || totalActions > 0;

            nextNodes.push(
              createAccessNode(policyNodeId, 'policy', {
                title: policy.name,
                description: policy.description,
                badges: [
                  { text: formatCountLabel(endpoints.length, 'endpoint') },
                  { text: formatCountLabel(totalActions, 'action') },
                  { text: formatCountLabel(uniquePolicyPages.size, 'page') },
                ].filter((badge) => badge.text),
                highlight: matchesPolicy(policy),
                collapsible: endpoints.length > 0,
                isExpanded: isPolicyExpanded,
                onToggle: () => toggleNodeExpansion(policyNodeId),
                summaryItems: hasPolicyHierarchy ? policySummaryItems : undefined,
              })
            );

            nextEdges.push(
              createAccessEdge(
                `edge-role-policy-${userId}-${roleIndex}-${policyIndex}`,
                roleNodeId,
                policyNodeId,
                {
                  label: 'Includes Policy',
                  color: '#faad14',
                  animated: true,
                  highlight: matchesRole(role) && matchesPolicy(policy),
                }
              )
            );

            if (isPolicyExpanded) {
              endpoints.forEach((endpoint, endpointIndex) => {
                const endpointNodeId = `endpoint-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}`;
                const actions = endpoint.page_actions || [];
                const isEndpointExpanded = expanded.has(endpointNodeId);
                const endpointHighlight = matchesEndpoint(endpoint);
                const endpointPages = new Set<string>();
                mergePageKeysFromActions(actions, endpointPages);
                const endpointSummaryItems = [
                  summaryCountLabel(endpointPages.size, 'page'),
                  summaryCountLabel(actions.length, 'action'),
                ];
                const hasEndpointHierarchy = endpointPages.size > 0 || actions.length > 0;

                const endpointBadges = [
                  { text: formatCountLabel(actions.length, 'action') },
                  endpoint.service ? { text: endpoint.service, color: '#a8071a' } : undefined,
                ].filter((badge): badge is { text: string; color?: string } => Boolean(badge && badge.text));

                nextNodes.push(
                  createAccessNode(endpointNodeId, 'endpoint', {
                    title: endpoint.method,
                    subtitle: endpoint.path,
                    description: endpoint.description,
                    badges: endpointBadges,
                    highlight: endpointHighlight,
                    collapsible: actions.length > 0,
                    isExpanded: isEndpointExpanded,
                    onToggle: actions.length > 0 ? () => toggleNodeExpansion(endpointNodeId) : undefined,
                    summaryItems: hasEndpointHierarchy ? endpointSummaryItems : undefined,
                  })
                );

                nextEdges.push(
                  createAccessEdge(
                    `edge-policy-endpoint-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}`,
                    policyNodeId,
                    endpointNodeId,
                    {
                      label: 'Grants Endpoint',
                      color: '#ff7875',
                      highlight: matchesPolicy(policy) && endpointHighlight,
                    }
                  )
                );

                if (isEndpointExpanded && actions.length > 0) {
                  actions.forEach((action, actionIndex) => {
                    const actionNodeId = `page-action-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}-${actionIndex}`;
                    const actionPages = action.page ? [action.page] : [];
                    const isActionExpanded = expanded.has(actionNodeId);
                    const actionHighlight = matchesPageAction(action);
                    const actionSummaryItems =
                      actionPages.length > 0 ? [summaryCountLabel(actionPages.length, 'page')] : undefined;

                    nextNodes.push(
                      createAccessNode(actionNodeId, 'action', {
                        title: action.label || action.action || 'Action',
                        subtitle: action.action,
                        badges: [{ text: formatCountLabel(actionPages.length, 'page') }].filter(
                          (badge) => badge.text
                        ),
                        highlight: actionHighlight,
                        collapsible: actionPages.length > 0,
                        isExpanded: isActionExpanded,
                        onToggle: actionPages.length > 0 ? () => toggleNodeExpansion(actionNodeId) : undefined,
                        summaryItems: actionSummaryItems,
                      })
                    );

                    nextEdges.push(
                      createAccessEdge(
                        `edge-endpoint-action-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}-${actionIndex}`,
                        endpointNodeId,
                        actionNodeId,
                        {
                          label: 'Enables Action',
                          color: '#597ef7',
                          highlight: endpointHighlight && actionHighlight,
                        }
                      )
                    );

                    if (isActionExpanded && actionPages.length > 0) {
                      actionPages.forEach((page, pageIndex) => {
                        const pageNodeId = `user-page-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}-${actionIndex}-${pageIndex}`;
                        const pageLabelBase = page.label || page.key || page.route || 'Page';
                        const pageRoute = page.route ? page.route : undefined;
                        const pageHighlight = matchesPage(page);

                        nextNodes.push(
                          createAccessNode(pageNodeId, 'page', {
                            title: pageLabelBase,
                            subtitle: pageRoute,
                            highlight: pageHighlight,
                          })
                        );

                        nextEdges.push(
                          createAccessEdge(
                            `edge-action-page-${userId}-${roleIndex}-${policyIndex}-${endpointIndex}-${actionIndex}-${pageIndex}`,
                            actionNodeId,
                            pageNodeId,
                            {
                              label: 'References Page',
                              color: '#9254de',
                              highlight: actionHighlight && pageHighlight,
                            }
                          )
                        );
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });

      applyGraph(nextNodes, nextEdges);
    },
    [applyGraph, nodeMatchesSearch, searchQuery, toggleNodeExpansion]
  );

  const buildUserAccessMap = useCallback(
    async (userId: number) => {
      setLoading(true);
      setError(null);

      try {
        const matrixRes = await api.meta.getUserAccessMatrix(userId);
        const matrixData: UserAccessMatrixResponse = matrixRes.data;

        if (!matrixData.roles || matrixData.roles.length === 0) {
          setError('No access data found for this user');
          setNodes([]);
          setEdges([]);
          setUserAccessData(null);
          setLoading(false);
          return;
        }

        const selectedUserMeta = users.find((user) => user.id === userId);
        const processedData: ProcessedUserAccessData = {
          id: userId,
          username: selectedUserMeta?.username || `User ${userId}`,
          fullName: selectedUserMeta?.fullName,
          email: selectedUserMeta?.email,
          roles: matrixData.roles,
        };

        setUserAccessData(processedData);
        const initialExpanded = new Set<string>([`user-${userId}`]);
        setExpandedNodes(initialExpanded);
        buildUserAccessVisualization(processedData, initialExpanded);
        setForbidden(false);
      } catch (err: any) {
        console.error('Failed to build user access map:', err);
        setError(err.response?.data?.message || 'Failed to build access map');
        if (err.response?.status === 403) setForbidden(true);
        setUserAccessData(null);
        setNodes([]);
        setEdges([]);
      } finally {
        setLoading(false);
      }
    },
    [buildUserAccessVisualization, setEdges, setNodes, users]
  );

  const handleUserChange = (userId: number) => {
    setSelectedUser(userId);
    setSearchQuery('');
    setForbidden(false);
    buildUserAccessMap(userId);
  };

  const handleClear = () => {
    setSelectedUser(null);
    setNodes([]);
    setEdges([]);
    setExpandedNodes(new Set());
    setUserAccessData(null);
    setSearchQuery('');
    setForbidden(false);
  };

  const handleNodeDoubleClick = useCallback((_event: any, node: Node<AccessNodeData>) => {
    node.data.onToggle?.();
  }, []);

  useEffect(() => {
    if (userAccessData && selectedUser) {
      buildUserAccessVisualization(userAccessData, expandedNodes);
    }
  }, [expandedNodes, userAccessData, selectedUser, buildUserAccessVisualization]);

  return (
    <div>
      <Title level={2}>User Access Visualization</Title>
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

            {nodes.length > 0 && (
              <Input
                allowClear
                style={{ width: 320 }}
                placeholder="Search roles, policies, endpoints..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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

      <Card style={{ height: '75vh' }} bodyStyle={{ padding: 0, height: '100%' }}>
        {loading ? (
          <Spin tip="Loading visualization..." style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '100%', height: '100%' }} />
          </Spin>
        ) : forbidden ? (
          <AccessDenied
            message="Access Denied"
            description={error || 'You do not have permission to view this visualization.'}
          />
        ) : (
          <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={accessNodeTypes}
              edgeTypes={accessEdgeTypes}
              onlyRenderVisibleElements
              panOnScroll
              minZoom={0.2}
              maxZoom={2}
              style={{ width: '100%', height: '100%' }}
              onInit={(instance: ReactFlowInstance) => {
                reactFlowInstanceRef.current = instance;
              }}
              onNodeDoubleClick={handleNodeDoubleClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <Background gap={30} color="#f0f0f0" />
              <Controls />
            </ReactFlow>
          </div>
        )}
      </Card>
    </div>
  );
};
