import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Card, Spin, Alert, Typography, Space, Button, Input, Tree, Select, Tag } from 'antd';
import type { TreeDataNode } from 'antd';
import { api } from '../../services/api';
import { AccessDenied } from '../../components/AccessDenied';
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

const taggedRow = (content: ReactNode, type: string, color: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {content}
    <Tag color={color} style={{ marginInlineStart: 0 }}>
      {type}
    </Tag>
  </div>
);

const buildPageTreeNode = (page: PageNode, searchQuery: string): TreeDataNode => {
  const actionChildren: TreeDataNode[] = [];

  (page.actions || []).forEach((action: PageAction, index) => {
    const actionKey = `page-${page.id}-action-${index}`;
    const endpointLabel = action.endpoint_details
      ? `${action.endpoint_details.method ?? ''} ${action.endpoint_details.path ?? ''}`.trim()
      : action.endpoint ?? '';

    const endpointNode: TreeDataNode | undefined = endpointLabel
      ? {
          key: `${actionKey}-endpoint`,
          title: (
            taggedRow(<span style={{ color: '#8c8c8c' }}>{highlightText(endpointLabel, searchQuery)}</span>, 'Endpoint', 'red')
          ),
        }
      : undefined;

    actionChildren.push({
      key: actionKey,
      title: (
        <div>
          {taggedRow(
            <strong>{highlightText(action.label || action.action || 'Action', searchQuery)}</strong>,
            'Page Action',
            'purple'
          )}
          {endpointNode ? (
            <div style={{ color: '#8c8c8c', fontSize: 12 }}>
              {highlightText(endpointLabel, searchQuery)}
            </div>
          ) : null}
        </div>
      ),
      children: endpointNode ? [endpointNode] : undefined,
    });
  });

  const childPages = (page.children || []).map((child) => buildPageTreeNode(child, searchQuery));

  return {
    key: `page-${page.id}`,
    title: (
      <div>
        {taggedRow(<strong>{highlightText(page.label, searchQuery)}</strong>, 'Page', 'geekblue')}
        {page.route ? (
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{highlightText(page.route, searchQuery)}</div>
        ) : null}
      </div>
    ),
    children: [...childPages, ...actionChildren],
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
      return;
    }

    const found = findPageById(uiPages, pageId);
    if (!found) {
      setError('Page not found in visualization');
      return;
    }

    const expanded = new Set<string>();
    collectPageNodeIds(found, expanded);
    collectEndpointIds(found, expanded);
    const tree = [buildPageTreeNode(found, '')];
    setTreeData(tree);
    setExpandedKeys(Array.from(expanded));
    setAutoExpandParent(true);
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
