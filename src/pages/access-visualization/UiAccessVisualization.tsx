import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Select, Spin, Alert, Typography, Space, Button, Tag, Input } from 'antd';
import ReactFlow, { Background, Controls, useEdgesState, useNodesState } from 'reactflow';
import type { Node, Edge, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import type { AccessEdgeData, AccessNodeData } from './graphUtils';
import {
  accessEdgeTypes,
  accessNodeTypes,
  createAccessEdge,
  createAccessNode,
  layoutNodes,
  summaryCountLabel,
  formatCountLabel,
} from './graphUtils';
import { api } from '../../services/api';
import { AccessDenied } from '../../components/AccessDenied';

const { Title } = Typography;
const { Option } = Select;

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

const normalizeRouteValue = (route?: string): string => {
  if (!route) return '';
  const trimmed = route.endsWith('/') && route !== '/' ? route.slice(0, -1) : route;
  return trimmed;
};

const getParentRoute = (route: string): string | null => {
  if (!route || route === '/') return null;
  const normalized = normalizeRouteValue(route);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return null;
  return normalized.slice(0, lastSlash);
};

const clonePageNode = (
  node: PageNode,
  parent: PageNode | null,
  roots: PageNode[],
  routeMap: Map<string, PageNode>,
  allNodes: PageNode[]
): PageNode => {
  const cloned: PageNode = {
    ...node,
    actions: node.actions
      ? node.actions.map((action) => ({
          ...action,
          endpoint_details: action.endpoint_details ? { ...action.endpoint_details } : undefined,
        }))
      : undefined,
    children: [],
  };

  const routeKey = normalizeRouteValue(cloned.route);
  if (routeKey) routeMap.set(routeKey, cloned);
  allNodes.push(cloned);

  if (!parent) {
    roots.push(cloned);
  }

  if (node.children && node.children.length > 0) {
    cloned.children = node.children.map((child) => clonePageNode(child, cloned, roots, routeMap, allNodes));
  }

  return cloned;
};

const buildHierarchy = (nodes: PageNode[]): PageNode[] => {
  const roots: PageNode[] = [];
  const routeMap = new Map<string, PageNode>();
  const allNodes: PageNode[] = [];

  nodes.forEach((node) => {
    clonePageNode(node, null, roots, routeMap, allNodes);
  });

  allNodes.forEach((node) => {
    const routeKey = normalizeRouteValue(node.route);
    if (!routeKey) return;

    const parentRoute = getParentRoute(routeKey);
    if (!parentRoute) return;

    const parent = routeMap.get(parentRoute);
    if (!parent || parent === node) return;

    if (!parent.children) parent.children = [];
    if (!parent.children.some((child) => child.id === node.id)) {
      parent.children.push(node);
    }

    const rootIndex = roots.findIndex((root) => root.id === node.id);
    if (rootIndex !== -1) {
      roots.splice(rootIndex, 1);
    }
  });

  return roots;
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

const collectPageNodeIds = (node: PageNode, set: Set<string>) => {
  set.add(`page-${node.id}`);
  if (node.children) {
    node.children.forEach((child) => collectPageNodeIds(child, set));
  }
};

const collectEndpointIds = (node: PageNode, set: Set<string>) => {
  if (node.actions) {
    node.actions.forEach((_action, index) => {
      set.add(`page-action-${node.id}-${index}`);
      set.add(`endpoint-${node.id}-${index}`);
    });
  }
  if (node.children) {
    node.children.forEach((child) => collectEndpointIds(child, set));
  }
};

export const UiAccessVisualization: React.FC = () => {
  const [uiPages, setUiPages] = useState<PageNode[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [pageAccessNode, setPageAccessNode] = useState<PageNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<AccessNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AccessEdgeData>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [autoExpandSelection, setAutoExpandSelection] = useState(false);

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

  const pageSummary = useMemo(() => {
    if (!pageAccessNode) return null;

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

    const actionsCount = countActions(pageAccessNode);
    const endpointsCount = countEndpoints(pageAccessNode);
    const pagesCount = countPages(pageAccessNode);

    const pageLabel = pageAccessNode.route
      ? `${pageAccessNode.label} (${pageAccessNode.route})`
      : pageAccessNode.label;

    return {
      pageLabel,
      actionsLabel: summaryCountLabel(actionsCount, 'action'),
      endpointsLabel: summaryCountLabel(endpointsCount, 'endpoint'),
      pagesLabel: summaryCountLabel(pagesCount, 'page'),
    };
  }, [pageAccessNode]);

  useEffect(() => {
    const fetchUiPages = async () => {
      try {
        setLoading(true);
        setError(null);
        const matrixRes = await api.meta.getAllUiAccessMatrix();
        const matrixData: UiAccessMatrixResponse = matrixRes.data;
        const normalizedPages = normalizePageNodes(matrixData.pages);
        const hierarchicalPages = buildHierarchy(normalizedPages);

        if (hierarchicalPages.length > 0) {
          setUiPages(hierarchicalPages);
          setExpandedNodes(new Set());
          setSelectedPage(null);
          buildAllPagesVisualization(hierarchicalPages, new Set());
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
  }, [applyGraph]);

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

  const buildSelectedPageVisualization = useCallback(
    (pageNode: PageNode, expanded: Set<string>, options: { forceExpand?: boolean; selectedId?: number } = {}) => {
      const nextNodes: Node<AccessNodeData>[] = [];
      const nextEdges: Edge<AccessEdgeData>[] = [];
      const { forceExpand = false, selectedId } = options;

      const matchesSearchValue = (value?: string) => !!searchQuery && !!value && nodeMatchesSearch(value, searchQuery);

      const buildNode = (node: PageNode, parentId: string | null, parentForceExpand: boolean) => {
        const nodeId = `page-${node.id}`;
        const shouldForceExpand = parentForceExpand || forceExpand;
        const isExpanded = shouldForceExpand || expanded.has(nodeId);
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
            highlight: highlight || node.id === selectedId,
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

            if (hasEndpoint && (shouldForceExpand || expanded.has(actionNodeId))) {
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
          node.children.forEach((child) => buildNode(child, nodeId, shouldForceExpand));
        }
      };

      buildNode(pageNode, null, forceExpand);
      applyGraph(nextNodes, nextEdges);
    },
    [applyGraph, nodeMatchesSearch, searchQuery, toggleNodeExpansion]
  );

  useEffect(() => {
    if (selectedPage && pageAccessNode) {
      buildSelectedPageVisualization(pageAccessNode, expandedNodes, {
        forceExpand: autoExpandSelection,
        selectedId: selectedPage,
      });
      if (autoExpandSelection) {
        setAutoExpandSelection(false);
      }
    } else if (!selectedPage && uiPages.length > 0) {
      buildAllPagesVisualization(uiPages, expandedNodes);
    }
  }, [
    selectedPage,
    pageAccessNode,
    uiPages,
    expandedNodes,
    buildSelectedPageVisualization,
    buildAllPagesVisualization,
    autoExpandSelection,
  ]);

  const handlePageSelect = (pageId: number | null) => {
    setSelectedPage(pageId);
    setSearchQuery('');
    if (pageId === null) {
      setPageAccessNode(null);
      setExpandedNodes(new Set());
      setAutoExpandSelection(false);
      if (uiPages.length) {
        buildAllPagesVisualization(uiPages, new Set());
      }
      return;
    }

    const found = findPageById(uiPages, pageId);
    if (!found) {
      setError('Page not found in visualization');
      return;
    }

    const initialExpanded = new Set<string>();
    collectPageNodeIds(found, initialExpanded);
    collectEndpointIds(found, initialExpanded);

    setPageAccessNode(found);
    setExpandedNodes(initialExpanded);
    setAutoExpandSelection(true);
  };

  const handleClear = () => {
    setSelectedPage(null);
    setPageAccessNode(null);
    setSearchQuery('');
    setExpandedNodes(new Set());
    if (uiPages.length) {
      buildAllPagesVisualization(uiPages, new Set());
    } else {
      setNodes([]);
      setEdges([]);
    }
  };

  const handleNodeDoubleClick = useCallback((_event: any, node: Node<AccessNodeData>) => {
    node.data.onToggle?.();
  }, []);

  return (
    <div>
      <Title level={2}>UI Access Visualization</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap align="center">
            <Select
              style={{ width: 320 }}
              placeholder="Select a page (optional)"
              value={selectedPage}
              allowClear
              onClear={() => handlePageSelect(null)}
              onChange={handlePageSelect}
            >
              {uiPages.map((page) => (
                <Option key={page.id} value={page.id}>
                  {page.label} ({page.route})
                </Option>
              ))}
            </Select>

            {nodes.length > 0 && (
              <Input
                allowClear
                style={{ width: 320 }}
                placeholder="Search pages, actions, endpoints..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            )}

            <Button onClick={handleClear}>Clear</Button>
          </Space>

          {pageAccessNode && pageSummary && (
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
