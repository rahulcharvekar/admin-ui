export interface UserAccessMatrixPage {
  key: string;
  label: string;
  route: string;
}

export interface UserAccessMatrixPageAction {
  action: string;
  label: string;
  page?: UserAccessMatrixPage;
}

export interface UserAccessMatrixEndpoint {
  service: string;
  version: string;
  method: string;
  path: string;
  description?: string;
  page_actions: UserAccessMatrixPageAction[];
}

export interface UserAccessMatrixPolicy {
  name: string;
  description?: string;
  endpoints: UserAccessMatrixEndpoint[];
}

export interface UserAccessMatrixRole {
  name: string;
  description?: string;
  policies: UserAccessMatrixPolicy[];
}

export interface UserAccessMatrixResponse {
  generated_at: string;
  version: number;
  filters: {
    user_id: number;
  };
  roles: UserAccessMatrixRole[];
}

export interface ProcessedUserAccessData {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  roles: UserAccessMatrixRole[];
}

const resolveActionPageKey = (action?: UserAccessMatrixPageAction | null): string | null => {
  if (!action?.page) return null;
  return (
    action.page.key ||
    action.page.route ||
    action.page.label ||
    action.label ||
    action.action ||
    null
  );
};

export const mergePageKeysFromActions = (
  actions: UserAccessMatrixPageAction[] | undefined,
  accumulator: Set<string>
) => {
  if (!actions) return;
  actions.forEach((action) => {
    const key = resolveActionPageKey(action);
    if (key) accumulator.add(key);
  });
};

export interface EndpointHierarchyCounts {
  actionsCount: number;
  pagesCount: number;
  pageKeys: Set<string>;
}

export const calculateEndpointHierarchyCounts = (endpoint: UserAccessMatrixEndpoint): EndpointHierarchyCounts => {
  const actions = endpoint.page_actions || [];
  const pageKeys = new Set<string>();
  mergePageKeysFromActions(actions, pageKeys);
  return {
    actionsCount: actions.length,
    pagesCount: pageKeys.size,
    pageKeys,
  };
};

export interface PolicyHierarchyCounts {
  endpointsCount: number;
  actionsCount: number;
  pagesCount: number;
  pageKeys: Set<string>;
}

export const calculatePolicyHierarchyCounts = (policy: UserAccessMatrixPolicy): PolicyHierarchyCounts => {
  const endpoints = policy.endpoints || [];
  let actionsCount = 0;
  const pageKeys = new Set<string>();

  endpoints.forEach((endpoint) => {
    const endpointCounts = calculateEndpointHierarchyCounts(endpoint);
    actionsCount += endpointCounts.actionsCount;
    endpointCounts.pageKeys.forEach((key) => pageKeys.add(key));
  });

  return {
    endpointsCount: endpoints.length,
    actionsCount,
    pagesCount: pageKeys.size,
    pageKeys,
  };
};

export interface RoleHierarchyCounts {
  policiesCount: number;
  endpointsCount: number;
  actionsCount: number;
  pagesCount: number;
  pageKeys: Set<string>;
}

export const calculateRoleHierarchyCounts = (role: UserAccessMatrixRole): RoleHierarchyCounts => {
  const policies = role.policies || [];
  let endpointsCount = 0;
  let actionsCount = 0;
  const pageKeys = new Set<string>();

  policies.forEach((policy) => {
    const policyCounts = calculatePolicyHierarchyCounts(policy);
    endpointsCount += policyCounts.endpointsCount;
    actionsCount += policyCounts.actionsCount;
    policyCounts.pageKeys.forEach((key) => pageKeys.add(key));
  });

  return {
    policiesCount: policies.length,
    endpointsCount,
    actionsCount,
    pagesCount: pageKeys.size,
    pageKeys,
  };
};

export interface UserHierarchyCounts {
  rolesCount: number;
  policiesCount: number;
  endpointsCount: number;
  actionsCount: number;
  pagesCount: number;
}

export const calculateUserHierarchyCounts = (userData: ProcessedUserAccessData): UserHierarchyCounts => {
  const roles = userData.roles || [];
  let policiesCount = 0;
  let endpointsCount = 0;
  let actionsCount = 0;
  const pageKeys = new Set<string>();

  roles.forEach((role) => {
    const roleCounts = calculateRoleHierarchyCounts(role);
    policiesCount += roleCounts.policiesCount;
    endpointsCount += roleCounts.endpointsCount;
    actionsCount += roleCounts.actionsCount;
    roleCounts.pageKeys.forEach((key) => pageKeys.add(key));
  });

  return {
    rolesCount: roles.length,
    policiesCount,
    endpointsCount,
    actionsCount,
    pagesCount: pageKeys.size,
  };
};
