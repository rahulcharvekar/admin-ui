import { Tooltip } from 'antd';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import dagre from 'dagre';
import type { Edge, EdgeProps, Node, NodeProps } from 'reactflow';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MarkerType,
  Position,
} from 'reactflow';

const clampStyle = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export type NodeCategory = 'user' | 'role' | 'policy' | 'endpoint' | 'action' | 'page';

export interface NodeBadge {
  text: string;
  color?: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface AccessNodeData {
  category: NodeCategory;
  title: string;
  subtitle?: string;
  description?: string;
  badges?: NodeBadge[];
  summaryItems?: string[];
  highlight?: boolean;
  collapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  tooltip?: string;
  dimensions?: Dimensions;
}

export interface AccessEdgeData {
  label?: string;
  highlight?: boolean;
}

export const DEFAULT_NODE_DIMENSIONS: Record<NodeCategory, Dimensions> = {
  user: { width: 300, height: 150 },
  role: { width: 260, height: 136 },
  policy: { width: 260, height: 136 },
  endpoint: { width: 300, height: 156 },
  action: { width: 240, height: 124 },
  page: { width: 240, height: 120 },
};

export const CATEGORY_STYLES: Record<NodeCategory, { background: string; border: string; accent: string }> = {
  user: { background: '#f0f9ff', border: '#91d5ff', accent: '#096dd9' },
  role: { background: '#f6ffed', border: '#b7eb8f', accent: '#237804' },
  policy: { background: '#fff7e6', border: '#ffd591', accent: '#d46b08' },
  endpoint: { background: '#fff1f0', border: '#ffa39e', accent: '#a8071a' },
  action: { background: '#e6fffb', border: '#87e8de', accent: '#006d75' },
  page: { background: '#f9f0ff', border: '#d3adf7', accent: '#531dab' },
};

const AccessNode = ({ data }: NodeProps<AccessNodeData>) => {
  const palette = CATEGORY_STYLES[data.category];
  const width = data.dimensions?.width ?? DEFAULT_NODE_DIMENSIONS[data.category].width;
  const height = data.dimensions?.height ?? DEFAULT_NODE_DIMENSIONS[data.category].height;
  const hiddenHandleStyle = { opacity: 0, width: 0, height: 0, border: 'none' };

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data.onToggle?.();
  };

  const summaryItems = data.summaryItems?.map((item) => item?.trim()).filter((item): item is string => !!item);
  const summaryText = summaryItems && summaryItems.length ? summaryItems.join(', ') : null;

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          alignItems: summaryText ? 'flex-start' : 'center',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: summaryText ? 4 : 0 }}>
          <Tooltip title={data.title}>
            <div
              style={{
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
          {summaryText ? (
            <div
              style={{
                fontSize: 12,
                color: '#8c8c8c',
                lineHeight: 1.3,
              }}
            >
              [{summaryText}]
            </div>
          ) : null}
        </div>
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

export const accessNodeTypes = { accessNode: AccessNode };
export const accessEdgeTypes = { accessEdge: AccessEdge };

export const layoutNodes = (
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

export const createAccessNode = (
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

export const createAccessEdge = (
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

export const formatCountLabel = (count: number, singular: string, plural?: string) => {
  if (count === 0) return '';
  const label = count === 1 ? singular : plural ?? `${singular}s`;
  return `${count} ${label}`;
};

export const summaryCountLabel = (count: number, singular: string, plural?: string) => {
  const formatted = formatCountLabel(count, singular, plural);
  if (formatted) return formatted;
  if (plural) return `0 ${plural}`;
  if (singular.endsWith('y')) return `0 ${singular.slice(0, -1)}ies`;
  if (/[sxz]$/.test(singular) || /(?:sh|ch)$/.test(singular)) return `0 ${singular}es`;
  return `0 ${singular}s`;
};
