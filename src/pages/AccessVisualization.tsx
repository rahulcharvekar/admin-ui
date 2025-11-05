import { useEffect, useState, useCallback, useMemo } from 'react';
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

const formatCountLabel = (count: number, singular: string, plural?: string) => {
  if (count === 0) return '';
  const label = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${label}`;
};

const summaryCountLabel = (count: number, singular: string, plural?: string) => {
  const formatted = formatCountLabel(count, singular, plural);
  if (formatted) return formatted;
  if (plural) return `0 ${plural}`;
  if (singular.endsWith('y')) return `0 ${singular.slice(0, -1)}ies`;
  if (/[sxz]$/.test(singular) || /(?:sh|ch)$/.test(singular)) return `0 ${singular}es`;
  return `0 ${singular}s`;
};

interface UserData {
  id: number;
  username: string;
  fullName: string;
  email?: string;
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

interface UiAccessMatrixResponse {
  generated_at: string;
  version: number;
  page_id: number;
  page: {
    key: string;
    label: string;
    route: string;
  };
  actions: {
    label: string;
    action: string;
    endpoint?: {
      service: string;
      version: string;
      method: string;
      path: string;
      description?: string;
    };
  }[];
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

interface ProcessedPageAccessData {
  pageId: number;
  page: {
    key: string;
    label: string;
    route: string;
  };
  actions: UiAccessMatrixResponse['actions'];
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
  const [userAccessData, setUserAccessData] = useState<ProcessedUserAccessData | null>(null);
  const [pageAccessData, setPageAccessData] = useState<ProcessedPageAccessData | null>(null);

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
              const pageKey =
                action.page.key ||
                action.page.route ||
                action.page.label ||
                action.label ||
                action.action ||
                '';
              if (pageKey) pageKeys.add(pageKey);
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

  const pageSummary = useMemo(() => {
    if (!pageAccessData) return null;

    const actions = pageAccessData.actions || [];
    const endpointsCount = actions.reduce(
      (sum, action) => sum + (action.endpoint ? 1 : 0),
      0
    );

    const pageLabel = pageAccessData.page.route
      ? `${pageAccessData.page.label} (${pageAccessData.page.route})`
      : pageAccessData.page.label;

    return {
      pageLabel,
      actionsLabel: summaryCountLabel(actions.length, 'action'),
      endpointsLabel: summaryCountLabel(endpointsCount, 'endpoint'),
    };
  }, [pageAccessData]);

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
  const buildUserAccessVisualization = useCallback((userData: ProcessedUserAccessData, expanded: Set<string>) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const userId = userData.id;

    // User node (root) - at the top center
    const userNodeId = `user-${userId}`;
    const roles = userData.roles || [];
    const userDisplayName = userData.fullName
      ? `${userData.fullName}\n(${userData.username})`
      : userData.username;

    newNodes.push(
      createExpandableNode(
        userNodeId,
        userDisplayName,
        { x: 400, y: 50 },
        {
          background: '#e6f7ff',
          color: '#003a8c',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
        },
        roles.length > 0,
        true,
        undefined
      )
    );

    // Roles nodes - horizontal row below user
    const rolesCount = roles.length;
    const roleSpacing = 250;
    const roleStartX = 400 - ((rolesCount - 1) * roleSpacing) / 2;
    
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const policies = role.policies || [];
      const roleX = roleStartX + (i * roleSpacing);
      const roleY = 200;
      const roleNodeId = `role-${userId}-${i}`;
      const isRoleExpanded = expanded.has(roleNodeId);
      let roleEndpointTotal = 0;
      let roleActionTotal = 0;
      const rolePageKeys = new Set<string>();

      policies.forEach((policy) => {
        const endpoints = policy.endpoints || [];
        roleEndpointTotal += endpoints.length;
        endpoints.forEach((endpoint) => {
          const actions = endpoint.page_actions || [];
          roleActionTotal += actions.length;
          actions.forEach((actionItem) => {
            if (actionItem.page) {
              const pageKey =
                actionItem.page.key ||
                actionItem.page.route ||
                actionItem.page.label ||
                actionItem.label ||
                actionItem.action ||
                '';
              if (pageKey) rolePageKeys.add(pageKey);
            }
          });
        });
      });
      const roleLabelParts: string[] = [];
      const policyCountLabel = formatCountLabel(policies.length, 'policy');
      if (policyCountLabel) roleLabelParts.push(policyCountLabel);
      const endpointCountLabel = formatCountLabel(roleEndpointTotal, 'endpoint');
      if (endpointCountLabel) roleLabelParts.push(endpointCountLabel);
      const actionCountLabel = formatCountLabel(roleActionTotal, 'action');
      if (actionCountLabel) roleLabelParts.push(actionCountLabel);
      const pageCountLabel = formatCountLabel(rolePageKeys.size, 'page');
      if (pageCountLabel) roleLabelParts.push(pageCountLabel);
      const roleLabelDetails = roleLabelParts.length ? `\n(${roleLabelParts.join(', ')})` : '';

      newNodes.push(
        createExpandableNode(
          roleNodeId,
          `${role.name}${roleLabelDetails}`,
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
          policies.length > 0,
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
        const policiesCount = policies.length;
        const policySpacing = 200;
        const policyStartX = roleX - ((policiesCount - 1) * policySpacing) / 2;
        
        for (let j = 0; j < policies.length; j++) {
          const policy = policies[j];
          const endpoints = policy.endpoints || [];
          const policyX = policyStartX + (j * policySpacing);
          const policyY = 380;
          const policyNodeId = `policy-${userId}-${i}-${j}`;
          const isPolicyExpanded = expanded.has(policyNodeId);
          
          // Calculate total actions and unique pages across all endpoints in this policy
          let totalActions = 0;
          const uniquePolicyPages = new Set<string>();
          endpoints.forEach((endpoint) => {
            const actions = endpoint.page_actions || [];
            totalActions += actions.length;
            actions.forEach((actionItem) => {
              if (actionItem.page) {
                const pageKey =
                  actionItem.page.key || actionItem.page.route || actionItem.page.label || actionItem.action;
                uniquePolicyPages.add(pageKey);
              }
            });
          });
          
          const policyLabelParts: string[] = [];
          const endpointCountLabel = formatCountLabel(endpoints.length, 'endpoint');
          if (endpointCountLabel) policyLabelParts.push(endpointCountLabel);
          const actionsCountLabel = formatCountLabel(totalActions, 'action');
          if (actionsCountLabel) policyLabelParts.push(actionsCountLabel);
          const pagesCountLabel = formatCountLabel(uniquePolicyPages.size, 'page');
          if (pagesCountLabel) policyLabelParts.push(pagesCountLabel);
          const policyLabelDetails = policyLabelParts.length ? `\n(${policyLabelParts.join(', ')})` : '';

          newNodes.push(
            createExpandableNode(
              policyNodeId,
              `${policy.name}${policyLabelDetails}`,
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
              endpoints.length > 0,
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
            const endpointsCount = endpoints.length;
            const endpointSpacing = 180;
            const endpointStartX = policyX - ((endpointsCount - 1) * endpointSpacing) / 2;
            
            for (let k = 0; k < endpoints.length; k++) {
              const endpoint = endpoints[k];
              const actions = endpoint.page_actions || [];
              const endpointX = endpointStartX + (k * endpointSpacing);
              const endpointY = 560;
              const endpointNodeId = `endpoint-${userId}-${i}-${j}-${k}`;
              const isEndpointExpanded = expanded.has(endpointNodeId);
              const endpointLabelParts: string[] = [];
              const actionsCountLabel = formatCountLabel(actions.length, 'action');
              if (actionsCountLabel) endpointLabelParts.push(actionsCountLabel);
              const uniquePageKeys = new Set<string>();
              actions.forEach((actionItem) => {
                if (actionItem.page) {
                  const pageKey =
                    actionItem.page.key || actionItem.page.route || actionItem.page.label || actionItem.action;
                  uniquePageKeys.add(pageKey);
                }
              });
              const pageCountLabel = formatCountLabel(uniquePageKeys.size, 'page');
              if (pageCountLabel) endpointLabelParts.push(pageCountLabel);
              const endpointLabelSuffix = endpointLabelParts.length ? `\n(${endpointLabelParts.join(', ')})` : '';
              const endpointLabel = `${endpoint.method}\n${endpoint.path}${endpointLabelSuffix}`;

              newNodes.push(
                createExpandableNode(
                  endpointNodeId,
                  endpointLabel,
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
                  actions.length > 0,
                  isEndpointExpanded,
                  actions.length > 0 ? () => toggleNodeExpansion(endpointNodeId) : undefined
                )
              );

              newEdges.push({
                id: `${policyNodeId}-${endpointNodeId}`,
                source: policyNodeId,
                target: endpointNodeId,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#ff4d4f', strokeWidth: 1 },
              });

              // Only show page actions if endpoint is expanded
              if (isEndpointExpanded && actions.length > 0) {
                const actionsCount = actions.length;
                const actionSpacing = 160;
                const actionStartX = endpointX - ((actionsCount - 1) * actionSpacing) / 2;

                for (let m = 0; m < actions.length; m++) {
                  const action = actions[m];
                  const actionX = actionStartX + (m * actionSpacing);
                  const actionY = 740;
                  const actionNodeId = `page-action-${userId}-${i}-${j}-${k}-${m}`;
                  const actionLabelBase = action.label || action.action || 'Action';
                  const actionPages = action.page ? [action.page] : [];
                  const actionPageCountLabel = formatCountLabel(actionPages.length, 'page');
                  const actionLabelSuffix = actionPageCountLabel ? `\n(${actionPageCountLabel})` : '';
                  const actionLabel = `${actionLabelBase}${actionLabelSuffix}`;
                  const actionHasChildren = actionPages.length > 0;
                  const isActionExpanded = expanded.has(actionNodeId);

                  newNodes.push(
                    createExpandableNode(
                      actionNodeId,
                      actionLabel,
                      { x: actionX, y: actionY },
                      {
                        background: '#e6fffb',
                        color: '#006d75',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        textAlign: 'center',
                        maxWidth: '160px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        minWidth: '140px',
                      },
                      actionHasChildren,
                      isActionExpanded,
                      actionHasChildren ? () => toggleNodeExpansion(actionNodeId) : undefined
                    )
                  );

                  newEdges.push({
                    id: `${endpointNodeId}-${actionNodeId}`,
                    source: endpointNodeId,
                    target: actionNodeId,
                    markerEnd: { type: MarkerType.ArrowClosed },
                    style: { stroke: '#597ef7', strokeWidth: 1 },
                  });

                  if (isActionExpanded && actionPages.length > 0) {
                    const pageSpacing = 140;
                    const pageStartX = actionX - ((actionPages.length - 1) * pageSpacing) / 2;

                    for (let n = 0; n < actionPages.length; n++) {
                      const page = actionPages[n];
                      const pageX = pageStartX + (n * pageSpacing);
                      const pageY = 920;
                      const pageNodeId = `user-page-${userId}-${i}-${j}-${k}-${m}-${n}`;
                      const pageLabelBase = page.label || page.key || page.route || 'Page';
                      const pageRoute = page.route ? `\n${page.route}` : '';
                      const pageLabel = `${pageLabelBase}${pageRoute}`;

                      newNodes.push(
                        createExpandableNode(
                          pageNodeId,
                          pageLabel,
                          { x: pageX, y: pageY },
                          {
                            background: '#f9f0ff',
                            color: '#531dab',
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
                        id: `${actionNodeId}-${pageNodeId}`,
                        source: actionNodeId,
                        target: pageNodeId,
                        markerEnd: { type: MarkerType.ArrowClosed },
                        style: { stroke: '#722ed1', strokeWidth: 1 },
                      });
                    }
                  }
                }
              }
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

      // Check if we have role data
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
        roles: matrixData.roles,
      };

      setUserAccessData(processedData);
      
      // Initially all nodes are collapsed (empty set)
      const initialExpanded = new Set<string>();
      setExpandedNodes(initialExpanded);
      
      buildUserAccessVisualization(processedData, initialExpanded);
    } catch (err: any) {
      console.error('Failed to build user access map:', err);
      setError(err.response?.data?.message || 'Failed to build access map');
      setUserAccessData(null);
    } finally {
      setLoading(false);
    }
  }, [buildUserAccessVisualization, setNodes, setEdges, setUserAccessData, setExpandedNodes, users]);

  // Build page access visualization with expand/collapse
  const buildPageAccessVisualization = useCallback((pageData: ProcessedPageAccessData, expanded: Set<string>) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const pageId = pageData.pageId;
    const actions = pageData.actions || [];
    const pageLabel = pageData.page.route
      ? `${pageData.page.label}\n${pageData.page.route}`
      : pageData.page.label;

    // Page node (root) - at the top center
    const pageNodeId = `page-${pageId}`;
    newNodes.push(
      createExpandableNode(
        pageNodeId,
        pageLabel,
        { x: 400, y: 50 },
        {
          background: '#f9f0ff',
          color: '#531dab',
          padding: '12px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '14px',
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
        },
        actions.length > 0,
        true,
        undefined
      )
    );

    // Actions nodes - horizontal row below page
    const actionsCount = actions.length;
    const actionSpacing = 220;
    const actionStartX = 400 - ((actionsCount - 1) * actionSpacing) / 2;
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const actionX = actionStartX + (i * actionSpacing);
      const actionY = 200;
      const actionNodeId = `action-${pageId}-${i}`;
      const isActionExpanded = expanded.has(actionNodeId);
      const actionLabelBase = action.label || action.action || 'Action';
      const actionDetail = action.action ? `\n(${action.action})` : '';
      const actionHasEndpoint = !!action.endpoint;
      const endpointCountLabel = actionHasEndpoint ? '\n(1 endpoint)' : '';
      const actionLabel = `${actionLabelBase}${actionDetail}${endpointCountLabel}`;

      newNodes.push(
        createExpandableNode(
          actionNodeId,
          actionLabel,
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
        const endpointNodeId = `endpoint-${pageId}-${i}`;
        const endpointLabel = `${endpoint.method}\n${endpoint.path}\n(1 action)`;

        newNodes.push(
          createExpandableNode(
            endpointNodeId,
            endpointLabel,
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

      // Check if we have page data
      if (!matrixData.page) {
        setError('No access data found for this page');
        setNodes([]);
        setEdges([]);
        setPageAccessData(null);
        setLoading(false);
        return;
      }

      const processedPageData: ProcessedPageAccessData = {
        pageId: matrixData.page_id,
        page: matrixData.page,
        actions: matrixData.actions || [],
      };

      setPageAccessData(processedPageData);
      
      // Initially all nodes are collapsed (empty set)
      const initialExpanded = new Set<string>();
      setExpandedNodes(initialExpanded);
      
      buildPageAccessVisualization(processedPageData, initialExpanded);
    } catch (err: any) {
      console.error('Failed to build page access map:', err);
      setError(err.response?.data?.message || 'Failed to build page access map');
      setPageAccessData(null);
    } finally {
      setLoading(false);
    }
  }, [buildPageAccessVisualization, setNodes, setEdges, setPageAccessData, setExpandedNodes]);

  // Rebuild visualization when expanded nodes or data change
  useEffect(() => {
    if (viewType === 'user' && userAccessData && selectedUser) {
      buildUserAccessVisualization(userAccessData, expandedNodes);
    } else if (viewType === 'page' && pageAccessData && selectedPage) {
      buildPageAccessVisualization(pageAccessData, expandedNodes);
    }
  }, [
    expandedNodes,
    viewType,
    userAccessData,
    selectedUser,
    buildUserAccessVisualization,
    pageAccessData,
    selectedPage,
    buildPageAccessVisualization,
  ]);

  // Handle user selection
  const handleUserChange = (userId: number) => {
    setSelectedUser(userId);
    setSelectedPage(null);
    setPageAccessData(null);
    buildUserAccessMap(userId);
  };

  // Handle page selection
  const handlePageChange = (pageId: number) => {
    setSelectedPage(pageId);
    setSelectedUser(null);
    setUserAccessData(null);
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

          {viewType === 'user' && userAccessData && userSummary && (
            <Space wrap>
              <Tag color="blue">{userSummary.userLabel}</Tag>
              <Tag color="green">{userSummary.rolesLabel}</Tag>
              <Tag color="orange">{userSummary.policiesLabel}</Tag>
              <Tag color="red">{userSummary.endpointsLabel}</Tag>
              <Tag color="cyan">{userSummary.actionsLabel}</Tag>
              <Tag color="purple">{userSummary.pagesLabel}</Tag>
            </Space>
          )}

          {viewType === 'page' && pageAccessData && pageSummary && (
            <Space wrap>
              <Tag color="purple">{pageSummary.pageLabel}</Tag>
              <Tag color="cyan">{pageSummary.actionsLabel}</Tag>
              <Tag color="red">{pageSummary.endpointsLabel}</Tag>
            </Space>
          )}

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
