/**
 * Page-Action Relationship Management
 * 
 * This component manages the relationship between UI Pages and Page Actions.
 * Each action belongs to one page (pageId field in PageAction entity).
 * 
 * Architecture: UIPage → PageAction → Endpoint
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card,
  Select,
  Button,
  Space,
  Typography,
  message,
  Transfer,
  Tag,
  Spin,
  Empty,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { UIPage, PageAction } from '../../types';

const { Title, Text } = Typography;

export const PageActionAssignment = () => {
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedActionIds, setSelectedActionIds] = useState<number[]>([]);
  const [originalActionIds, setOriginalActionIds] = useState<number[]>([]);
  const prevPageIdRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch UI pages
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ['uiPages'],
    queryFn: async () => {
      const response = await api.uiPages.getAll();
      return (response.data.pages || []) as UIPage[];
    },
  });

  // Fetch all page actions (for the transfer component)
  const { data: allActions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['pageActions'],
    queryFn: async () => {
      const response = await api.pageActions.getAll();
      return response.data as PageAction[];
    },
  });

  // Fetch actions for the selected page
  const { data: pageActions = [], isLoading: pageActionsLoading } = useQuery({
    queryKey: ['pageActions', selectedPageId],
    queryFn: async () => {
      if (!selectedPageId) return [];
      const response = await api.pageActions.getByPageId(selectedPageId);
      return response.data as PageAction[];
    },
    enabled: !!selectedPageId,
  });

  // Set selected and original action IDs when page actions are loaded
  useEffect(() => {
    // Only update if the page has actually changed or if we're loading data for the first time
    if (selectedPageId !== null && selectedPageId !== prevPageIdRef.current) {
      const actionIds = pageActions.map((a) => a.id);
      setSelectedActionIds(actionIds);
      setOriginalActionIds(actionIds);
      prevPageIdRef.current = selectedPageId;
    }
  }, [selectedPageId, pageActions]);

  const handlePageChange = (pageId: number) => {
    setSelectedPageId(pageId);
    setSelectedActionIds([]);
    setOriginalActionIds([]);
    prevPageIdRef.current = null; // Reset ref when page changes
  };

  const handleTransferChange = (targetKeys: React.Key[]) => {
    setSelectedActionIds(targetKeys.map((key) => parseInt(key.toString())));
  };

  const handleSave = async () => {
    if (!selectedPageId) {
      message.warning('Please select a page');
      return;
    }

    try {
      // Find actions to add (in targetKeys but not in original)
      const actionsToAdd = selectedActionIds.filter((id) => !originalActionIds.includes(id));
      
      // Find actions to remove (in original but not in targetKeys)
      const actionsToRemove = originalActionIds.filter((id) => !selectedActionIds.includes(id));

      // Update actions that need to be added to this page
      for (const actionId of actionsToAdd) {
        const action = allActions.find((a) => a.id === actionId);
        if (action) {
          await api.pageActions.update(actionId, {
            pageId: selectedPageId,
            label: action.label,
            action: action.action,
            icon: action.icon,
            variant: action.variant,
            displayOrder: action.displayOrder,
            isActive: action.isActive,
            endpointId: action.endpointId,
          });
        }
      }

      // Update actions that need to be removed from this page
      // Set pageId to 0 or a default value for unassigned actions
      for (const actionId of actionsToRemove) {
        const action = allActions.find((a) => a.id === actionId);
        if (action) {
          await api.pageActions.update(actionId, {
            pageId: 0, // Unassigned
            label: action.label,
            action: action.action,
            icon: action.icon,
            variant: action.variant,
            displayOrder: action.displayOrder,
            isActive: action.isActive,
            endpointId: action.endpointId,
          });
        }
      }

      message.success('Page actions updated successfully');
      queryClient.invalidateQueries({ queryKey: ['pageActions'] });
      queryClient.invalidateQueries({ queryKey: ['pageActions', selectedPageId] });
      setOriginalActionIds(selectedActionIds);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to update page actions');
    }
  };

  const handleReset = () => {
    setSelectedActionIds(originalActionIds);
    message.info('Changes discarded');
  };

  // Prepare data for Transfer component
  const transferDataSource = useMemo(() => {
    return allActions.map((action) => ({
      key: action.id.toString(),
      title: action.label,
      description: `${action.action}${action.page?.label ? ` (Currently on: ${action.page.label})` : ''}`,
      disabled: false,
    }));
  }, [allActions]);

  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const isLoading = pagesLoading || actionsLoading || pageActionsLoading;
  const hasChanges =
    JSON.stringify([...selectedActionIds].sort()) !==
    JSON.stringify([...originalActionIds].sort());

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
          Page-Action Assignment
        </Title>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Assign page actions to UI pages. Select a page below and use the transfer interface to
        manage which actions belong to that page.
      </Text>

      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Page Selector */}
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Select UI Page:</Text>
              <Select
                style={{ width: '100%', maxWidth: 600 }}
                placeholder="Select a page to manage its actions"
                loading={pagesLoading}
                value={selectedPageId}
                onChange={handlePageChange}
                options={pages.map((page) => ({
                  value: page.id,
                  label: `${page.label} (${page.route})`,
                }))}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            </Space>
          </div>

          {/* Selected Page Info */}
          {selectedPage && (
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <Space direction="vertical">
                <Text strong>Selected Page:</Text>
                <Space>
                  <Tag color="blue">{selectedPage.label}</Tag>
                  <Text type="secondary">{selectedPage.route}</Text>
                  {selectedPage.icon && <Text type="secondary">Icon: {selectedPage.icon}</Text>}
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Currently has {originalActionIds.length} action(s) assigned
                </Text>
              </Space>
            </Card>
          )}

          {/* Transfer Component */}
          {selectedPageId ? (
            <>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Spin size="large" />
                </div>
              ) : (
                <>
                  <Transfer
                    dataSource={transferDataSource}
                    titles={['Available Actions', 'Assigned to This Page']}
                    targetKeys={selectedActionIds.map((id) => id.toString())}
                    onChange={handleTransferChange}
                    render={(item) => (
                      <div>
                        <div>{item.title}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{item.description}</div>
                      </div>
                    )}
                    listStyle={{
                      width: 350,
                      height: 400,
                    }}
                    showSearch
                    filterOption={(inputValue, option) =>
                      option.title.toLowerCase().includes(inputValue.toLowerCase()) ||
                      option.description.toLowerCase().includes(inputValue.toLowerCase())
                    }
                  />

                  {/* Action Buttons */}
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      disabled={!hasChanges}
                    >
                      Save Changes
                    </Button>
                    <Button onClick={handleReset} disabled={!hasChanges}>
                      Reset
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ['uiPages'] });
                        queryClient.invalidateQueries({ queryKey: ['pageActions'] });
                        if (selectedPageId) {
                          queryClient.invalidateQueries({ queryKey: ['pageActions', selectedPageId] });
                        }
                      }}
                    >
                      Refresh
                    </Button>
                  </Space>

                  {hasChanges && (
                    <Text type="warning" style={{ fontSize: '12px' }}>
                      You have unsaved changes. Click "Save Changes" to apply them.
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <Empty description="Please select a page to manage its actions" />
          )}
        </Space>
      </Card>
    </div>
  );
};

export default PageActionAssignment;
