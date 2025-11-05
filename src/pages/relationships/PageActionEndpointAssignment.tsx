/**
 * PageAction-Endpoint Assignment (Table-based Interface)
 * 
 * This component manages the assignment of endpoints to page actions.
 * Simple workflow: Select page → Assign endpoints to actions in a table → Save all
 * 
 * Architecture: UIPage → PageAction → Endpoint (1:1 mapping)
 */

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Space,
  Typography,
  message,
  Table,
  Tag,
  Spin,
  Empty,
  Alert,
  Tooltip,
} from 'antd';
import { SaveOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../../services/api';
import type { UIPage, PageAction, Endpoint } from '../../types';

const { Title, Text } = Typography;

// Interface for table row data
interface ActionEndpointRow extends PageAction {
  selectedEndpointId?: number | null;
}

export const PageActionEndpointAssignment = () => {
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [actionEndpointMap, setActionEndpointMap] = useState<Map<number, number | null>>(new Map());
  const [originalMap, setOriginalMap] = useState<Map<number, number | null>>(new Map());
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const initializedPageRef = useRef<number | null>(null);

  // Fetch UI pages
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      return (response.data.pages || []) as UIPage[];
    },
  });

  // Fetch actions for the selected page
  const { data: pageActions = [], isLoading: pageActionsLoading } = useQuery({
    queryKey: ['pageActions', 'byPage', selectedPageId],
    queryFn: async () => {
      if (!selectedPageId) return [];
      const response = await api.pageActions.getByPageId(selectedPageId);
      return response.data as PageAction[];
    },
    enabled: !!selectedPageId,
  });

  // Fetch all endpoints
  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery({
    queryKey: ['endpoints'],
    queryFn: async () => {
      const response = await api.endpoints.getAll();
      return response.data as Endpoint[];
    },
  });

  // Initialize map when page actions load
  useEffect(() => {
    // Only initialize if the page has changed or if this is the first load for this page
    if (pageActions.length > 0 && selectedPageId !== initializedPageRef.current) {
      const newMap = new Map<number, number | null>();
      pageActions.forEach((action) => {
        // The endpoint ID can be in endpointId field or nested in endpoint.id
        const endpointId = action.endpointId || action.endpoint?.id || null;
        newMap.set(action.id, endpointId);
      });
      setActionEndpointMap(newMap);
      setOriginalMap(new Map(newMap));
      initializedPageRef.current = selectedPageId;
    } else if (selectedPageId && pageActions.length === 0 && !pageActionsLoading && selectedPageId !== initializedPageRef.current) {
      // Only clear maps if we're done loading and there are genuinely no actions
      setActionEndpointMap(new Map());
      setOriginalMap(new Map());
      initializedPageRef.current = selectedPageId;
    }
  }, [pageActions.length, selectedPageId, pageActionsLoading]);

  const handlePageChange = (pageId: number) => {
    setSelectedPageId(pageId);
    setActionEndpointMap(new Map());
    setOriginalMap(new Map());
    initializedPageRef.current = null; // Reset to allow re-initialization
  };

  const handleEndpointChange = (actionId: number, endpointId: number | null) => {
    setActionEndpointMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(actionId, endpointId);
      return newMap;
    });
  };

  const handleSaveAll = async () => {
    if (!selectedPageId) {
      message.warning('Please select a page');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Find actions that have changed
      const changedActions = pageActions.filter((action) => {
        const currentEndpointId = actionEndpointMap.get(action.id);
        const originalEndpointId = originalMap.get(action.id);
        return currentEndpointId !== originalEndpointId;
      });

      if (changedActions.length === 0) {
        message.info('No changes to save');
        setSaving(false);
        return;
      }

      // Update each changed action
      for (const action of changedActions) {
        try {
          const newEndpointId = actionEndpointMap.get(action.id);
          await api.pageActions.update(action.id, {
            pageId: action.pageId,
            label: action.label,
            action: action.action,
            icon: action.icon,
            variant: action.variant,
            displayOrder: action.displayOrder,
            isActive: action.isActive,
            endpointId: newEndpointId || undefined,
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to update action ${action.id}:`, error);
        }
      }

      // Show results
      if (errorCount === 0) {
        message.success(`Successfully updated ${successCount} action(s)`);
      } else {
        message.warning(
          `Updated ${successCount} action(s), failed ${errorCount} action(s)`
        );
      }

      // Refresh data and update original map
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      queryClient.invalidateQueries({ queryKey: ['pageActions', 'byPage', selectedPageId] });
      setOriginalMap(new Map(actionEndpointMap));
    } catch (error: any) {
      message.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setActionEndpointMap(new Map(originalMap));
    message.info('Changes discarded');
  };

  const handleClearAll = () => {
    const clearedMap = new Map<number, number | null>();
    pageActions.forEach((action) => {
      clearedMap.set(action.id, null);
    });
    setActionEndpointMap(clearedMap);
    message.info('All endpoint assignments cleared');
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['uiPages'] });
    if (selectedPageId) {
      queryClient.invalidateQueries({ queryKey: ['pageActions', 'byPage', selectedPageId] });
    }
    queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    message.info('Data refreshed');
  };

  // Check if there are changes
  const hasChanges = () => {
    if (actionEndpointMap.size !== originalMap.size) return true;
    for (const [actionId, endpointId] of actionEndpointMap) {
      if (originalMap.get(actionId) !== endpointId) return true;
    }
    return false;
  };

  // Prepare table data
  const tableData: ActionEndpointRow[] = pageActions.map((action) => ({
    ...action,
    selectedEndpointId: actionEndpointMap.get(action.id) || null,
  }));

  // Table columns
  const columns: ColumnsType<ActionEndpointRow> = [
    {
      title: 'Action ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      align: 'center',
    },
    {
      title: 'Action Label',
      dataIndex: 'label',
      key: 'label',
      width: 200,
      render: (text: string, record: ActionEndpointRow) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Tag color="blue">{record.action}</Tag>
        </Space>
      ),
    },
    {
      title: 'Current Endpoint',
      key: 'currentEndpoint',
      width: 250,
      render: (_: any, record: ActionEndpointRow) => {
        // Use the endpoint data from the action record (already populated by API)
        const currentEndpoint = record.endpoint;
        if (!currentEndpoint) {
          return <Text type="secondary">Not assigned</Text>;
        }
        return (
          <Tooltip title={`Service: ${currentEndpoint.service || 'N/A'} (v${currentEndpoint.version || 'N/A'})`}>
            <Space direction="vertical" size={0}>
              <Space size="small">
                <Tag color="purple">{currentEndpoint.method}</Tag>
                <Text code style={{ fontSize: '12px' }}>{currentEndpoint.path}</Text>
              </Space>
              {currentEndpoint.service && (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {currentEndpoint.service}
                </Text>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Assign New Endpoint',
      key: 'assignEndpoint',
      width: 350,
      render: (_: any, record: ActionEndpointRow) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Select an endpoint"
          value={record.selectedEndpointId}
          onChange={(value) => handleEndpointChange(record.id, value)}
          allowClear
          showSearch
          optionFilterProp="label"
          filterOption={(input, option) =>
            typeof option?.label === 'string' &&
            option.label.toLowerCase().includes(input.toLowerCase())
          }
          options={[
            ...endpoints.map((endpoint) => ({
              value: endpoint.id,
              label: `${endpoint.method} ${endpoint.path} - ${endpoint.service}`,
              disabled: !endpoint.isActive,
            })),
          ]}
        />
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_: any, record: ActionEndpointRow) => {
        const original = originalMap.get(record.id);
        const current = record.selectedEndpointId;
        if (original !== current) {
          return <Tag color="orange">Modified</Tag>;
        }
        return <Tag color="green">No Change</Tag>;
      },
    },
  ];

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const isLoading = pageActionsLoading || endpointsLoading;
  const changesExist = hasChanges();

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Assign Endpoints to Page Actions
        </Title>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      <Alert
        message="Bulk Endpoint Assignment"
        description="Select a page to view all its actions. Assign endpoints using the dropdowns in the table, then save all changes at once."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Page Selector */}
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Select UI Page:</Text>
              <Select
                style={{ width: '100%', maxWidth: 600 }}
                placeholder="Select a page to manage action-endpoint assignments"
                loading={pagesLoading}
                value={selectedPageId}
                onChange={handlePageChange}
                options={pages.map((page) => ({
                  value: page.id,
                  label: `${page.label} (${page.route})`,
                }))}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  typeof option?.label === 'string' &&
                  option.label.toLowerCase().includes(input.toLowerCase())
                }
                allowClear
                onClear={() => {
                  setSelectedPageId(null);
                  setActionEndpointMap(new Map());
                  setOriginalMap(new Map());
                  initializedPageRef.current = null;
                }}
              />
            </Space>
          </div>

          {/* Selected Page Info */}
          {selectedPage && (
            <Card size="small" style={{ background: '#f0f5ff', borderColor: '#1890ff' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  <Text strong>Selected Page:</Text>
                  <Tag color="blue">{selectedPage.label}</Tag>
                  <Text type="secondary">{selectedPage.route}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {pageActions.length} action(s) found for this page
                </Text>
              </Space>
            </Card>
          )}

          {/* Actions Table */}
          {selectedPageId && (
            <>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" tip="Loading actions and endpoints..." />
                </div>
              ) : pageActions.length === 0 ? (
                <Empty description="No actions found for this page" />
              ) : (
                <>
                  <Table
                    columns={columns}
                    dataSource={tableData}
                    rowKey="id"
                    pagination={false}
                    bordered
                    size="middle"
                    scroll={{ x: 1200 }}
                  />

                  {/* Action Buttons */}
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSaveAll}
                      disabled={!changesExist || saving}
                      loading={saving}
                    >
                      Save All Changes
                    </Button>
                    <Button onClick={handleReset} disabled={!changesExist || saving}>
                      Reset Changes
                    </Button>
                    <Button
                      icon={<ClearOutlined />}
                      onClick={handleClearAll}
                      disabled={saving}
                      danger
                    >
                      Clear All Assignments
                    </Button>
                  </Space>

                  {changesExist && (
                    <Alert
                      message="Unsaved Changes"
                      description="You have unsaved changes. Click 'Save All Changes' to apply them."
                      type="warning"
                      showIcon
                    />
                  )}
                </>
              )}
            </>
          )}

          {!selectedPageId && (
            <Empty description="Please select a page to begin" style={{ padding: 40 }} />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default PageActionEndpointAssignment;
