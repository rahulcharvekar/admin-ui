import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, Spin, Alert, Typography, Space, Button, Input, Tree, Select, Tag, Tooltip } from 'antd';
import type { TreeDataNode } from 'antd';
import { api } from '../../services/api';
import { AccessDenied } from '../../components/AccessDenied';
import { formatCountLabel } from './graphUtils';
import type { PageNode, RawPageNode, PageAction } from './pageDataUtils';
import {
  buildHierarchy,
  normalizePageNodes,
  collectPageNodeIds,
  collectEndpointIds,
  findPageById,
} from './pageDataUtils';

const { Title } = Typography;
const { Option } = Select;

interface UiAccessMatrixResponse {
  generated_at: string;
  version: number;
  pages: RawPageNode[] | null | undefined;
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

const TAG_COLORS = {
  page: 'geekblue',
  action: 'purple',
  endpoint: 'red',
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

const renderDescriptionLine = (displayText?: string, tooltipText?: string, highlight?: (value: string) => ReactNode) => {
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
      {highlight ? highlight(displayText) : displayText}
    </span>
  );
  return <Tooltip title={tooltipText ?? displayText}>{content}</Tooltip>;
};

const buildPageTreeNode = (page: PageNode, searchQuery: string): TreeDataNode => {
  const highlight = (value: string) => highlightText(value, searchQuery);

  const childPageNodes = (page.children || []).map((child) => buildPageTreeNode(child, searchQuery));

  const actionChildren: TreeDataNode[] = (page.actions || []).map((action: PageAction, index) => {
    const actionKey = `page-${page.id}-action-${index}`;
    const endpointDetails = action.endpoint_details;
    const method = endpointDetails?.method;
    const path = endpointDetails?.path ?? action.endpoint ?? '';
    const endpointLabel = [endpointDetails?.method, endpointDetails?.path].filter(Boolean).join(' ');
    const serviceInfo = [endpointDetails?.service, endpointDetails?.version].filter(Boolean).join(' • ');
    const methodTag = method ? (
      <Tag color={getMethodColor(method)} style={{ marginInlineEnd: 0 }}>
        {method}
      </Tag>
    ) : null;

    const endpointNode: TreeDataNode | undefined = endpointLabel
      ? {
          key: `${actionKey}-endpoint`,
          title: (
            <div>
              {createTitleRow(
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {methodTag}
                  <strong>{highlight(path || endpointLabel)}</strong>
                </span>,
                'Endpoint',
                TAG_COLORS.endpoint
              )}
              {renderDescriptionLine(serviceInfo, serviceInfo, highlight)}
            </div>
          ),
        }
      : undefined;

    return {
      key: actionKey,
      title: (
        <div>
          {createTitleRow(
            <strong>{highlight(action.label || action.action || 'Action')}</strong>,
            'Page Action',
            TAG_COLORS.action,
            endpointNode ? formatCountLabel(1, 'endpoint') : undefined
          )}
          {renderDescriptionLine(action.action && action.action !== action.label ? action.action : undefined, undefined, highlight)}
        </div>
      ),
      children: endpointNode ? [endpointNode] : undefined,
    };
  });

  const childCountLabels = [
    formatCountLabel(childPageNodes.length, 'child page'),
    formatCountLabel(actionChildren.length, 'action'),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    key: `page-${page.id}`,
    title: (
      <div>
        {createTitleRow(
          <strong>{highlight(page.label)}</strong>,
          'Page',
          TAG_COLORS.page,
          childCountLabels || undefined
        )}
        {renderDescriptionLine(page.route, page.route, highlight)}
      </div>
    ),
    children: [...childPageNodes, ...actionChildren],
  };
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

export const UiAccessTreeView: React.FC = () => {
  const [uiPages, setUiPages] = useState<PageNode[]>([]);
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [pageSummary, setPageSummary] = useState<{
    pageLabel: string;
    routeLabel: string;
    childPagesLabel: string;
    actionsLabel: string;
    endpointsLabel: string;
  } | null>(null);

  const getSelectedPages = useCallback((): PageNode[] => {
    if (!selectedPage) return uiPages;
    const found = findPageById(uiPages, selectedPage);
    if (!found) return uiPages;
    return [found];
  }, [selectedPage, uiPages]);

  const buildTree = useCallback(
    (pages: PageNode[], query: string, expandAll = false) => {
      const tree = pages.map((page) => buildPageTreeNode(page, query));
      setTreeData(tree);
      if (tree.length) {
        setExpandedKeys(expandAll ? flattenTree(tree) : tree.map((node) => node.key));
        setAutoExpandParent(expandAll);
      } else {
        setExpandedKeys([]);
      }
    },
    []
  );

  useEffect(() => {
    const fetchUiPages = async () => {
      try {
        setLoading(true);
        setError(null);
        const matrixRes = await api.meta.getAllUiAccessMatrix();
        const matrixData: UiAccessMatrixResponse = matrixRes.data;
        const normalizedPages = normalizePageNodes(matrixData.pages);
        const hierarchicalPages = buildHierarchy(normalizedPages);
        setUiPages(hierarchicalPages);
        buildTree(hierarchicalPages, searchQuery);
        setPageSummary(null);
        setForbidden(false);
      } catch (err: any) {
        console.error('Failed to fetch UI pages:', err);
        setError(err.response?.data?.message || 'Failed to load UI pages');
        if (err.response?.status === 403) setForbidden(true);
        setUiPages([]);
        setTreeData([]);
        setExpandedKeys([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUiPages();
  }, [buildTree]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const pages = getSelectedPages();
    buildTree(pages, value, !!selectedPage);
  };

  const handlePageSelect = (pageId: number | null) => {
    setSelectedPage(pageId);
    setSearchQuery('');

    if (pageId === null) {
      buildTree(uiPages, '', false);
      setPageSummary(null);
      return;
    }

    const found = findPageById(uiPages, pageId);
    if (!found) {
      setError('Page not found in visualization');
      setPageSummary(null);
      return;
    }

    const expanded = new Set<string>();
    collectPageNodeIds(found, expanded);
    collectEndpointIds(found, expanded);
    const tree = [buildPageTreeNode(found, '')];
    setTreeData(tree);
    setExpandedKeys(Array.from(expanded));
    setAutoExpandParent(true);

    const gatherSummary = (pageNode: PageNode) => {
      const childPages = pageNode.children || [];
      let actionCount = 0;
      let endpointCount = 0;

      const traverse = (node: PageNode) => {
        (node.actions || []).forEach((action) => {
          actionCount += 1;
          if (action.endpoint || action.endpoint_details?.path) {
            endpointCount += 1;
          }
        });
        (node.children || []).forEach(traverse);
      };

      traverse(pageNode);

      setPageSummary({
        pageLabel: pageNode.label,
        routeLabel: pageNode.route,
        childPagesLabel: formatCountLabel(childPages.length, 'child page'),
        actionsLabel: formatCountLabel(actionCount, 'action'),
        endpointsLabel: formatCountLabel(endpointCount, 'endpoint'),
      });
    };

    gatherSummary(found);
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
    setAutoExpandParent(false);
  };

  const pageOptions = useMemo(() => {
    const options: { id: number; label: string }[] = [];
    const traverse = (pages: PageNode[]) => {
      pages.forEach((page) => {
        options.push({
          id: page.id,
          label: `${page.label} (${page.route})`,
        });
        if (page.children) traverse(page.children);
      });
    };
    traverse(uiPages);
    return options;
  }, [uiPages]);

  return (
    <div>
      <Title level={2}>UI Access Explorer</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap align="center">
            <Select
              showSearch
              style={{ width: 320 }}
              placeholder="Select a page (optional)"
              value={selectedPage}
              allowClear
              onClear={() => handlePageSelect(null)}
              onChange={handlePageSelect}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {pageOptions.map((page) => (
                <Option key={page.id} value={page.id}>
                  {page.label}
                </Option>
              ))}
            </Select>

            {treeData.length > 0 && (
              <Input
                allowClear
                style={{ width: 320 }}
                placeholder="Search pages, actions, endpoints..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            )}

            <Button
              onClick={() => {
                setSelectedPage(null);
                setSearchQuery('');
                buildTree(uiPages, '', false);
              }}
            >
              Reset
            </Button>
          </Space>

          {pageSummary ? (
            <Space wrap>
              <Tag color="geekblue">{pageSummary.pageLabel}</Tag>
              {pageSummary.routeLabel ? <Tag color="blue">{pageSummary.routeLabel}</Tag> : null}
              {pageSummary.childPagesLabel ? <Tag color="cyan">{pageSummary.childPagesLabel}</Tag> : null}
              {pageSummary.actionsLabel ? <Tag color="purple">{pageSummary.actionsLabel}</Tag> : null}
              {pageSummary.endpointsLabel ? <Tag color="red">{pageSummary.endpointsLabel}</Tag> : null}
            </Space>
          ) : null}
        </Space>
      </Card>

      {error ? <Alert type="error" message={error} style={{ marginBottom: 16 }} /> : null}

      <Card style={{ minHeight: '60vh' }}>
        {loading ? (
          <Spin tip="Loading page tree..." />
        ) : forbidden ? (
          <AccessDenied
            message="Access Denied"
            description={error || 'You do not have permission to view this data.'}
          />
        ) : (
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={handleExpand}
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
