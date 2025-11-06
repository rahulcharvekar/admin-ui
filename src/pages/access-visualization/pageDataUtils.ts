export interface PageActionEndpoint {
  service?: string;
  version?: string;
  method?: string;
  path?: string;
}

export interface PageAction {
  label: string;
  action: string;
  endpoint?: string;
  endpoint_details?: PageActionEndpoint;
}

export interface PageNode {
  id: number;
  key: string;
  label: string;
  route: string;
  is_requested?: boolean;
  actions?: PageAction[];
  children?: PageNode[];
}

export interface RawPageSummary {
  id?: number;
  key?: string;
  label?: string;
  route?: string;
}

export interface RawEndpointInfo {
  service?: string;
  version?: string;
  method?: string;
  path?: string;
}

export interface RawPageAction {
  label?: string;
  action?: string;
  endpoint?: string | RawEndpointInfo | null;
  endpoint_details?: RawEndpointInfo | null;
}

export interface RawPageNode {
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

export const normalizePageNodes = (pages: RawPageNode[] | null | undefined): PageNode[] => {
  if (!Array.isArray(pages)) return [];
  return pages.map(normalizePageNode);
};

export const normalizeRouteValue = (route?: string): string => {
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

export const buildHierarchy = (nodes: PageNode[]): PageNode[] => {
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

export const collectPageNodeIds = (node: PageNode, set: Set<string>) => {
  set.add(`page-${node.id}`);
  if (node.children) {
    node.children.forEach((child) => collectPageNodeIds(child, set));
  }
};

export const collectEndpointIds = (node: PageNode, set: Set<string>) => {
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

export const findPageById = (pages: PageNode[], pageId: number): PageNode | null => {
  for (const page of pages) {
    if (page.id === pageId) return page;
    if (page.children) {
      const found = findPageById(page.children, pageId);
      if (found) return found;
    }
  }
  return null;
};
