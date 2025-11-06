import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  Select,
  Spin,
  Alert,
  Typography,
  Space,
  Button,
  Tag,
  Tooltip,
  Input,
} from 'antd';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  EdgeLabelRenderer,
  BaseEdge,
  getSmoothStepPath,
  Handle,
} from 'reactflow';
import type { Node, Edge, NodeProps, EdgeProps, ReactFlowInstance } from 'reactflow';
import dagre from 'dagre';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import 'reactflow/dist/style.css';
import { api } from '../services/api';
import { AccessDenied } from '../components/AccessDenied';

const { Title } = Typography;
const { Option } = Select;

const clampStyle = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

type NodeCategory = 'user' | 'role' | 'policy' | 'endpoint' | 'action' | 'page';

interface NodeBadge {
  text: string;
  color?: string;
}

interface Dimensions {
  width: number;
  height: number;
}

interface AccessNodeData {
  category: NodeCategory;
  title: string;
  subtitle?: string;
  description?: string;
  badges?: NodeBadge[];
  highlight?: boolean;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  tooltip?: string;
  dimensions?: Dimensions;
}

interface AccessEdgeData {
  label?: string;
  highlight?: boolean;
}

const DEFAULT_NODE_DIMENSIONS: Record<NodeCategory, Dimensions> = {
  user: { width: 300, height: 150 },
  role: { width: 260, height: 136 },
  policy: { width: 260, height: 136 },
  endpoint: { width: 300, height: 156 },
  action: { width: 240, height: 124 },
  page: { width: 240, height: 120 },
};

const CATEGORY_STYLES: Record<NodeCategory, { background: string; border: string; accent: string }> = {
  user: { background: '#f0f9ff', border: '#91d5ff', accent: '#096dd9' },
  role: { background: '#f6ffed', border: '#b7eb8f', accent: '#237804' },
  policy: { background: '#fff7e6', border: '#ffd591', accent: '#d46b08' },
  endpoint: { background: '#fff1f0', border: '#ffa39e', accent: '#a8071a' },
  action: { background: '#e6fffb', border: '#87e8de', accent: '#006d75' },
  page: { background: '#f9f0ff', border: '#d3adf7', accent: '#531dab' },
};

const layoutNodes = (
  nodes: Node<AccessNodeData>[],
  edges: Edge<AccessEdgeData>[],
  direction: 'TB' | 'LR' = 'TB'
): Node<AccessNodeData>[] => {
  if (!nodes.length) return nodes;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 130,
    ranksep: 170,
    marginx: 40,
    marginy: 40,
  });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const dims = node.data.dimensions ?? DEFAULT_NODE_DIMENSIONS[node.data.category];
    dagreGraph.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const layoutInfo = dagreGraph.node(node.id);
    const dims = node.data.dimensions ?? DEFAULT_NODE_DIMENSIONS[node.data.category];
    if (layoutInfo) {
      return {
        ...node,
        position: {
          x: layoutInfo.x - dims.width / 2,
          y: layoutInfo.y - dims.height / 2,
        },
        data: { ...node.data, dimensions: dims },
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        draggable: false,
      };
    }
    return node;
  });
};

const createAccessNode = (
  id: string,
  category: NodeCategory,
  data: Omit<AccessNodeData, 'category'>
): Node<AccessNodeData> => {
  const dims = data.dimensions ?? DEFAULT_NODE_DIMENSIONS[category];
  return {
    id,
    type: 'accessNode',
    position: { x: 0, y: 0 },
    data: {
      ...data,
      category,
      dimensions: dims,
    },
    draggable: false,
    selectable: true,
  };
};

const createAccessEdge = (
  id: string,
  source: string,
  target: string,
  options?: { label?: string; highlight?: boolean; color?: string; animated?: boolean }
): Edge<AccessEdgeData> => {
  const color = options?.color ?? '#bfbfbf';
  const highlight = options?.highlight ?? false;
  return {
    id,
    source,
    target,
    type: 'accessEdge',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: options?.animated ?? false,
    data: options?.label ? { label: options.label, highlight } : { highlight },
    style: {
      stroke: highlight ? '#faad14' : color,
      strokeWidth: highlight ? 2 : 1.4,
    },
  };
};

const AccessNode = ({ data }: NodeProps<AccessNodeData>) => {
  const palette = CATEGORY_STYLES[data.category];
  const width = data.dimensions?.width ?? DEFAULT_NODE_DIMENSIONS[data.category].width;
  const height = data.dimensions?.height ?? DEFAULT_NODE_DIMENSIONS[data.category].height;

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data.onToggle?.();
  };

  const hiddenHandleStyle = { opacity: 0, width: 0, height: 0, border: 'none' };

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 12,
        border: `2px solid ${data.highlight ? '#d32029' : palette.border}`,
        background: palette.background,
        boxShadow: data.highlight ? '0 0 18px rgba(211,32,41,0.55)' : '0 6px 18px rgba(0,0,0,0.08)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'all',
        boxSizing: 'border-box',
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandleStyle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandleStyle} isConnectable={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Tooltip title={data.title}>
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: palette.accent,
              lineHeight: 1.35,
              ...clampStyle(2),
            }}
          >
            {data.title}
          </div>
        </Tooltip>
        {data.collapsible ? (
          <button
            onClick={handleToggle}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              border: 'none',
              background: '#ffffff',
              borderRadius: 6,
              width: 28,
              height: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.accent,
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
            aria-label={data.isExpanded ? 'Collapse node' : 'Expand node'}
          >
            {data.isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </button>
        ) : null}
      </div>
      {data.subtitle ? (
        <Tooltip title={data.subtitle}>
          <div
            style={{
              fontSize: 12,
              color: '#434343',
              lineHeight: 1.4,
              ...clampStyle(2),
            }}
          >
            {data.subtitle}
          </div>
        </Tooltip>
      ) : null}
      {data.description ? (
        <Tooltip title={data.description}>
          <div
            style={{
              fontSize: 12,
              color: '#595959',
              ...clampStyle(3),
            }}
          >
            {data.description}
          </div>
        </Tooltip>
      ) : null}
      {data.badges && data.badges.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.badges.map((badge, index) => (
            <span
              key={`${badge.text}-${index}`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 8,
                background: '#ffffff',
                border: `1px solid ${badge.color ?? palette.accent}`,
                color: badge.color ?? palette.accent,
              }}
            >
              {badge.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const AccessEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<AccessEdgeData>) => {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const stroke = data?.highlight ? '#fa8c16' : style?.stroke ?? '#bfbfbf';
  const strokeWidth = data?.highlight ? 2 : style?.strokeWidth ?? 1.4;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ ...style, stroke, strokeWidth }} />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: '#ffffff',
              borderRadius: 6,
              border: '1px solid #d9d9d9',
              padding: '2px 8px',
              fontSize: 11,
              color: '#595959',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              pointerEvents: 'all',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};

const nodeTypes = { accessNode: AccessNode };
const edgeTypes = { accessEdge: AccessEdge };

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

interface PageActionEndpoint {
  service?: string;
  version?: string;
  method?: string;
  path?: string;
}

interface PageAction {
  label: string;
  action: string;
  endpoint?: string;
  endpoint_details?: PageActionEndpoint;
}

interface PageNode {
  id: number;
  key: string;
  label: string;
  route: string;
  is_requested?: boolean;
  actions?: PageAction[];
  children?: PageNode[];
}

interface UiAccessMatrixResponse {
  generated_at: string;
  version: number;
  pages: RawPageNode[];
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
  pageNode: PageNode;
  allPages: PageNode[];
}

const findPageById = (pages: PageNode[], pageId: number): PageNode | null => {
  for (const page of pages) {
    if (page.id === pageId) return page;
    if (page.children) {
      const found = findPageById(page.children, pageId);
      if (found) return found;
    }
  }
  return null;
};

interface RawPageSummary {
  id?: number;
  key?: string;
  label?: string;
  route?: string;
}

interface RawEndpointInfo {
  service?: string;
  version?: string;
  method?: string;
  path?: string;
}

interface RawPageAction {
  label?: string;
  action?: string;
  endpoint?: string | RawEndpointInfo | null;
  endpoint_details?: RawEndpointInfo | null;
}

interface RawPageNode {
  id?: number;
  page_id?: number;
  generated_at?: string;
  version?: number;
  key?: string;
  label?: string;
  route?: string;
  page?: RawPageSummary | null;
  is_requested?: boolean;
  actions?: RawPageAction[] | null;
  children?: RawPageNode[] | null;
  page_children?: RawPageNode[] | null;
}

const mergeEndpointInfo = (
  primary?: RawEndpointInfo | null,
  secondary?: RawEndpointInfo | null
): PageActionEndpoint | undefined => {
  const combined = {
    service: primary?.service ?? secondary?.service,
    version: primary?.version ?? secondary?.version,
    method: primary?.method ?? secondary?.method,
    path: primary?.path ?? secondary?.path,
  };

  const hasValue = Object.values(combined).some((value) => typeof value === 'string' && value.length > 0);
  return hasValue ? combined : undefined;
};

const normalizePageAction = (rawAction: RawPageAction): PageAction => {
  const endpointDetails = mergeEndpointInfo(
    typeof rawAction.endpoint === 'object' && rawAction.endpoint !== null && !Array.isArray(rawAction.endpoint)
      ? rawAction.endpoint
      : null,
    rawAction.endpoint_details
  );

  const endpointString =
    typeof rawAction.endpoint === 'string'
      ? rawAction.endpoint
      : endpointDetails
        ? [endpointDetails.method, endpointDetails.path].filter(Boolean).join(' ')
        : undefined;

  return {
    label: rawAction.label ?? '',
    action: rawAction.action ?? '',
    endpoint: endpointString,
    endpoint_details: endpointDetails,
  };
};

const normalizePageNode = (rawNode: RawPageNode): PageNode => {
  const pageInfo = rawNode.page ?? null;
  const nodeId = pageInfo?.id ?? rawNode.id ?? rawNode.page_id ?? 0;
  const nodeKey = pageInfo?.key ?? rawNode.key ?? `${nodeId}`;
  const nodeLabel = pageInfo?.label ?? rawNode.label ?? nodeKey;
  const nodeRoute = pageInfo?.route ?? rawNode.route ?? '';

  const rawChildren = rawNode.children ?? rawNode.page_children ?? [];
  const normalizedChildren = Array.isArray(rawChildren) ? rawChildren.map(normalizePageNode) : [];

  const rawActions = rawNode.actions ?? [];
  const normalizedActions = Array.isArray(rawActions) ? rawActions.map(normalizePageAction) : [];

  return {
    id: nodeId,
    key: nodeKey,
    label: nodeLabel,
    route: nodeRoute,
    is_requested: rawNode.is_requested,
    actions: normalizedActions,
    children: normalizedChildren,
  };
};

const normalizePageNodes = (pages: RawPageNode[] | null | undefined): PageNode[] => {
  if (!Array.isArray(pages)) return [];
  return pages.map(normalizePageNode);
};

const formatEndpointNodeLabel = (
  endpointDetails?: PageActionEndpoint,
  endpointString?: string
): { title: string; subtitle?: string } => {
  if (endpointDetails) {
    const { method, path, service } = endpointDetails;
    if (method && path) return { title: method, subtitle: path };
    if (path) return { title: path, subtitle: method ?? service };
    if (method) return { title: method, subtitle: service };
    if (service) return { title: service };
  }

  if (endpointString) {
    const [method, ...rest] = endpointString.split(' ');
    if (rest.length) {
      return { title: method, subtitle: rest.join(' ') };
    }
    return { title: endpointString };
  }

  return { title: 'Endpoint' };
};

export const AccessVisualization: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [uiPages, setUiPages] = useState<PageNode[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'user' | 'page'>('user');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [userAccessData, setUserAccessData] = useState<ProcessedUserAccessData | null>(null);
  const [pageAccessData, setPageAccessData] = useState<ProcessedPageAccessData | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<AccessNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdgeData>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const applyGraph = useCallback(
    (nextNodes: Node<AccessNodeData>[], nextEdges: Edge<AccessEdgeData>[]) => {
      const layoutedNodes = layoutNodes(nextNodes, nextEdges);
      setNodes(layoutedNodes);
      setEdges(nextEdges);
    },
    [setNodes, setEdges]
  );

  useEffect(() => {
    if (nodes.length === 0) return;
    const handle = window.setTimeout(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 400 });
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

    const countActions = (node: PageNode): number => {
      let count = 0;
      if (node.actions) count += node.actions.length;
      if (node.children) {
        node.children.forEach((child) => {
          count += countActions(child);
        });
      }
      return count;
    };

    const countEndpoints = (node: PageNode): number => {
      let count = 0;
      if (node.actions) {
        count += node.actions.filter((action) => action.endpoint || action.endpoint_details).length;
      }
      if (node.children) {
        node.children.forEach((child) => {
          count += countEndpoints(child);
        });
      }
      return count;
    };

    const countPages = (node: PageNode): number => {
      let count = 1;
      if (node.children) {
        node.children.forEach((child) => {
          count += countPages(child);
        });
      }
      return count;
    };

    const actionsCount = countActions(pageAccessData.pageNode);
    const endpointsCount = countEndpoints(pageAccessData.pageNode);
    const pagesCount = countPages(pageAccessData.pageNode);

    const pageLabel = pageAccessData.pageNode.route
      ? `${pageAccessData.pageNode.label} (${pageAccessData.pageNode.route})`
      : pageAccessData.pageNode.label;

    return {
      pageLabel,
      actionsLabel: summaryCountLabel(actionsCount, 'action'),
      endpointsLabel: summaryCountLabel(endpointsCount, 'endpoint'),
      pagesLabel: summaryCountLabel(pagesCount, 'page'),
    };
  }, [pageAccessData]);

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
          badges: [
            { text: summaryCountLabel(roles.length, 'role') },
          ],
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
            (endpoint.page_actions || []).forEach((action) => {
              actionCount += 1;
              if (action.page) {
                const key =
                  action.page.key || action.page.route || action.page.label || action.label || action.action || '';
                if (key) uniquePages.add(key);
              }
            });
          });
        });

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
              actions.forEach((actionItem) => {
                if (actionItem.page) {
                  const pageKey =
                    actionItem.page.key || actionItem.page.route || actionItem.page.label || actionItem.action;
                  if (pageKey) uniquePolicyPages.add(pageKey);
                }
              });
            });

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

                const endpointBadges: NodeBadge[] = [];
                const actionCountLabel = formatCountLabel(actions.length, 'action');
                if (actionCountLabel) endpointBadges.push({ text: actionCountLabel });
                if (endpoint.service) endpointBadges.push({ text: endpoint.service, color: '#a8071a' });

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

  const buildPageAccessVisualization = useCallback(
    (pageData: ProcessedPageAccessData, expanded: Set<string>) => {
      const nextNodes: Node<AccessNodeData>[] = [];
      const nextEdges: Edge<AccessEdgeData>[] = [];

      const matchesSearchValue = (value?: string) => !!searchQuery && !!value && nodeMatchesSearch(value, searchQuery);

      const buildNode = (node: PageNode, parentId: string | null) => {
        const nodeId = `page-${node.id}`;
        const isExpanded = expanded.has(nodeId);
        const hasChildren = !!(node.children && node.children.length > 0);
        const hasActions = !!(node.actions && node.actions.length > 0);
        const highlight =
          matchesSearchValue(node.label) ||
          matchesSearchValue(node.route) ||
          (node.actions || []).some(
            (action) =>
              matchesSearchValue(action.label) ||
              matchesSearchValue(action.action) ||
              matchesSearchValue(action.endpoint)
          );

        nextNodes.push(
          createAccessNode(nodeId, 'page', {
            title: node.label,
            subtitle: node.route,
            badges: [
              { text: formatCountLabel(node.actions?.length ?? 0, 'action') },
              { text: formatCountLabel(node.children?.length ?? 0, 'child') },
            ].filter((badge) => badge.text),
            highlight,
            collapsible: hasChildren || hasActions,
            isExpanded,
            onToggle: hasChildren || hasActions ? () => toggleNodeExpansion(nodeId) : undefined,
          })
        );

        if (parentId) {
          nextEdges.push(
            createAccessEdge(`edge-${parentId}-${nodeId}`, parentId, nodeId, {
              label: 'Child Page',
              color: '#b37feb',
              highlight,
            })
          );
        }

        if (isExpanded && node.actions) {
          node.actions.forEach((action, actionIndex) => {
            const actionNodeId = `page-action-${node.id}-${actionIndex}`;
            const hasEndpoint = !!(action.endpoint || action.endpoint_details);
            const actionHighlight =
              matchesSearchValue(action.label) ||
              matchesSearchValue(action.action) ||
              matchesSearchValue(action.endpoint);

            nextNodes.push(
              createAccessNode(actionNodeId, 'action', {
                title: action.label || action.action || 'Action',
                subtitle: action.action,
                badges: hasEndpoint ? [{ text: 'Endpoint' }] : undefined,
                highlight: actionHighlight,
                collapsible: hasEndpoint,
                isExpanded: expanded.has(actionNodeId),
                onToggle: hasEndpoint ? () => toggleNodeExpansion(actionNodeId) : undefined,
              })
            );

            nextEdges.push(
              createAccessEdge(`edge-${nodeId}-${actionNodeId}`, nodeId, actionNodeId, {
                label: 'Has Action',
                color: '#13c2c2',
                highlight: highlight && actionHighlight,
              })
            );

            if (hasEndpoint && expanded.has(actionNodeId)) {
              const endpointNodeId = `endpoint-${node.id}-${actionIndex}`;
              const formatted = formatEndpointNodeLabel(action.endpoint_details, action.endpoint);
              const endpointHighlight = matchesSearchValue(formatted.title) || matchesSearchValue(formatted.subtitle);

              nextNodes.push(
                createAccessNode(endpointNodeId, 'endpoint', {
                  title: formatted.title,
                  subtitle: formatted.subtitle,
                  highlight: endpointHighlight,
                })
              );

              nextEdges.push(
                createAccessEdge(`edge-${actionNodeId}-${endpointNodeId}`, actionNodeId, endpointNodeId, {
                  label: 'Calls Endpoint',
                  color: '#ff7875',
                  highlight: actionHighlight && endpointHighlight,
                })
              );
            }
          });
        }

        if (isExpanded && node.children) {
          node.children.forEach((child) => buildNode(child, nodeId));
        }
      };

      buildNode(pageData.pageNode, null);
      applyGraph(nextNodes, nextEdges);
    },
    [applyGraph, nodeMatchesSearch, searchQuery, toggleNodeExpansion]
  );

  const buildAllPagesVisualization = useCallback(
    (allPages: PageNode[], expanded: Set<string>) => {
      const nextNodes: Node<AccessNodeData>[] = [];
      const nextEdges: Edge<AccessEdgeData>[] = [];

      const matchesSearchValue = (value?: string) => !!searchQuery && !!value && nodeMatchesSearch(value, searchQuery);

      const subtreeMatchesSearch = (node: PageNode): boolean => {
        if (matchesSearchValue(node.label) || matchesSearchValue(node.route)) return true;
        if (
          node.actions &&
          node.actions.some(
            (action) =>
              matchesSearchValue(action.label) ||
              matchesSearchValue(action.action) ||
              matchesSearchValue(action.endpoint)
          )
        ) {
          return true;
        }
        if (node.children && node.children.some((child) => subtreeMatchesSearch(child))) return true;
        return false;
      };

      const buildNode = (node: PageNode, parentId: string | null) => {
        const nodeId = `page-${node.id}`;
        const isExpanded = expanded.has(nodeId);
        const hasChildren = !!(node.children && node.children.length > 0);
        const hasActions = !!(node.actions && node.actions.length > 0);
        const highlight = subtreeMatchesSearch(node);

        nextNodes.push(
          createAccessNode(nodeId, 'page', {
            title: node.label,
            subtitle: node.route,
            badges: [
              { text: formatCountLabel(node.actions?.length ?? 0, 'action') },
              { text: formatCountLabel(node.children?.length ?? 0, 'child') },
            ].filter((badge) => badge.text),
            highlight,
            collapsible: hasChildren || hasActions,
            isExpanded,
            onToggle: hasChildren || hasActions ? () => toggleNodeExpansion(nodeId) : undefined,
          })
        );

        if (parentId) {
          nextEdges.push(
            createAccessEdge(`edge-${parentId}-${nodeId}`, parentId, nodeId, {
              label: 'Child Page',
              color: '#b37feb',
              highlight,
            })
          );
        }

        if (isExpanded && node.actions) {
          node.actions.forEach((action, actionIndex) => {
            const actionNodeId = `page-action-${node.id}-${actionIndex}`;
            const hasEndpoint = !!(action.endpoint || action.endpoint_details);
            const actionHighlight =
              matchesSearchValue(action.label) ||
              matchesSearchValue(action.action) ||
              matchesSearchValue(action.endpoint);

            nextNodes.push(
              createAccessNode(actionNodeId, 'action', {
                title: action.label || action.action || 'Action',
                subtitle: action.action,
                badges: hasEndpoint ? [{ text: 'Endpoint' }] : undefined,
                highlight: actionHighlight,
                collapsible: hasEndpoint,
                isExpanded: expanded.has(actionNodeId),
                onToggle: hasEndpoint ? () => toggleNodeExpansion(actionNodeId) : undefined,
              })
            );

            nextEdges.push(
              createAccessEdge(`edge-${nodeId}-${actionNodeId}`, nodeId, actionNodeId, {
                label: 'Has Action',
                color: '#13c2c2',
                highlight: highlight && actionHighlight,
              })
            );

            if (hasEndpoint && expanded.has(actionNodeId)) {
              const endpointNodeId = `endpoint-${node.id}-${actionIndex}`;
              const formatted = formatEndpointNodeLabel(action.endpoint_details, action.endpoint);
              const endpointHighlight = matchesSearchValue(formatted.title) || matchesSearchValue(formatted.subtitle);

              nextNodes.push(
                createAccessNode(endpointNodeId, 'endpoint', {
                  title: formatted.title,
                  subtitle: formatted.subtitle,
                  highlight: endpointHighlight,
                })
              );

              nextEdges.push(
                createAccessEdge(`edge-${actionNodeId}-${endpointNodeId}`, actionNodeId, endpointNodeId, {
                  label: 'Calls Endpoint',
                  color: '#ff7875',
                  highlight: actionHighlight && endpointHighlight,
                })
              );
            }
          });
        }

        if (isExpanded && node.children) {
          node.children.forEach((child) => buildNode(child, nodeId));
        }
      };

      allPages.forEach((page) => buildNode(page, null));
      applyGraph(nextNodes, nextEdges);
    },
    [applyGraph, nodeMatchesSearch, searchQuery, toggleNodeExpansion]
  );

  useEffect(() => {
    if (viewType !== 'page') return;

    const fetchUiPages = async () => {
      try {
        setLoading(true);
        setError(null);
        const matrixRes = await api.meta.getAllUiAccessMatrix();
        const matrixData: UiAccessMatrixResponse = matrixRes.data;
        const normalizedPages = normalizePageNodes(matrixData.pages);

        if (normalizedPages.length > 0) {
          const initialExpanded = new Set<string>();
          setUiPages(normalizedPages);
          setExpandedNodes(initialExpanded);
          buildAllPagesVisualization(normalizedPages, initialExpanded);
          setForbidden(false);
        } else {
          setUiPages([]);
          setNodes([]);
          setEdges([]);
        }
      } catch (err: any) {
        console.error('Failed to fetch UI pages:', err);
        setError(err.response?.data?.message || 'Failed to load UI pages');
        if (err.response?.status === 403) setForbidden(true);
        setUiPages([]);
        setNodes([]);
        setEdges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUiPages();
  }, [viewType, buildAllPagesVisualization, setEdges, setNodes, setExpandedNodes]);

  useEffect(() => {
    if (viewType === 'user' && userAccessData && selectedUser !== null) {
      buildUserAccessVisualization(userAccessData, expandedNodes);
    } else if (viewType === 'page' && !selectedPage && uiPages.length > 0) {
      buildAllPagesVisualization(uiPages, expandedNodes);
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
    uiPages,
    buildAllPagesVisualization,
  ]);

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

  const buildPageAccessMap = useCallback(
    (pageId: number, pages: PageNode[]) => {
      setLoading(true);
      setError(null);

      const selectedPageNode = findPageById(pages, pageId);

      if (!selectedPageNode) {
        setError('Page not found in visualization');
        setLoading(false);
        return;
      }

      const processedData: ProcessedPageAccessData = {
        pageId,
        pageNode: selectedPageNode,
        allPages: pages,
      };

      setPageAccessData(processedData);
      const initialExpanded = new Set<string>([`page-${pageId}`]);
      setExpandedNodes(initialExpanded);
      buildPageAccessVisualization(processedData, initialExpanded);
      setForbidden(false);
      setLoading(false);
    },
    [buildPageAccessVisualization]
  );

  const handleUserChange = (userId: number) => {
    setSelectedUser(userId);
    setSelectedPage(null);
    setPageAccessData(null);
    setUiPages([]);
    setSearchQuery('');
    setForbidden(false);
    buildUserAccessMap(userId);
  };

  const handleClear = () => {
    setSelectedUser(null);
    setSelectedPage(null);
    setNodes([]);
    setEdges([]);
    setExpandedNodes(new Set());
    setUserAccessData(null);
    setPageAccessData(null);
    setUiPages([]);
    setSearchQuery('');
    setForbidden(false);
  };

  const handleNodeDoubleClick = useCallback((_event: any, node: Node<AccessNodeData>) => {
    node.data.onToggle?.();
  }, []);

  return (
    <div>
      <Title level={2}>Access Visualization</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap align="center">
            <Select
              style={{ width: 200 }}
              placeholder="Select View Type"
              value={viewType}
              onChange={(value) => {
                setViewType(value);
                setNodes([]);
                setEdges([]);
                setExpandedNodes(new Set());
                setSearchQuery('');
                setForbidden(false);
                if (value === 'user') {
                  setSelectedPage(null);
                  setUiPages([]);
                } else {
                  setSelectedUser(null);
                  setUserAccessData(null);
                }
              }}
            >
              <Option value="user">User Access Flow</Option>
              <Option value="page">UI Page Flow</Option>
            </Select>

            {viewType === 'user' && (
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
            )}

            {viewType === 'page' && uiPages.length > 0 && (
              <Select
                style={{ width: 320 }}
                placeholder="Select a page (optional)"
                value={selectedPage}
                allowClear
                onClear={() => {
                  setSelectedPage(null);
                  setPageAccessData(null);
                  if (uiPages.length) {
                    buildAllPagesVisualization(uiPages, expandedNodes);
                  }
                }}
                onChange={(pageId) => {
                  setSelectedPage(pageId);
                  if (pageId !== null) {
                    buildPageAccessMap(pageId, uiPages);
                  }
                }}
              >
                {uiPages.map((page) => (
                  <Option key={page.id} value={page.id}>
                    {page.label} ({page.route})
                  </Option>
                ))}
              </Select>
            )}

            {nodes.length > 0 && (
              <Input
                allowClear
                style={{ width: 320 }}
                placeholder="Search nodes, actions, endpoints..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
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
              <Tag color="blue">{pageSummary.pagesLabel}</Tag>
            </Space>
          )}
        </Space>
      </Card>

      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Card style={{ height: '75vh' }} bodyStyle={{ padding: 0, height: '100%' }}>
        {loading ? (
          <Spin
            tip="Loading visualization..."
            style={{ width: '100%', height: '100%' }}
          >
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
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
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
