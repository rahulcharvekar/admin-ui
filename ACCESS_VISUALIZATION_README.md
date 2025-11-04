# Access Visualization Feature

## Overview
A new **Access Visualization** page has been added to provide a bird's-eye view of access control flows in your application. This interactive mind map helps administrators visualize how users, roles, policies, and endpoints are connected.

## Features

### Two Visualization Modes:

1. **User Access Flow** (user → roles → policies → endpoints)
   - Select a user to see their complete access chain
   - Top-down vertical tree structure
   - Shows all roles assigned to the user
   - Displays policies attached to each role
   - Reveals all endpoints accessible through those policies
   - **Expandable/Collapsible**: Click on roles to expand/collapse policies, click on policies to expand/collapse endpoints

2. **UI Page Flow** (page → actions → endpoints)
   - Select a UI page to see its action mappings
   - Top-down vertical tree structure
   - Shows all page actions on that page
   - Displays endpoints linked to each action
   - **Expandable/Collapsible**: Click on actions to expand/collapse their associated endpoints

### Interactive Node Expansion:

- **Top-Down Orientation**: Visualization flows from top to bottom, making it more natural to read
- **All Collapsed Initially**: All nodes start collapsed for a clean view; expand only what you need
- **Click to Expand/Collapse**: Nodes with children show an arrow indicator (▶ collapsed, ▼ expanded)
- **Light Color Scheme**: Uses soft, light pastel colors for better readability
  - User/Page: Light blue (#e6f7ff)
  - Role: Light green (#f6ffed)
  - Policy: Light orange (#fff7e6)
  - Action: Light cyan (#e6fffb)
  - Endpoint: Light red (#fff1f0)
- **Visual Indicators**: 
  - Nodes with children have a border to indicate they're clickable
  - Count badges show how many children each node has (e.g., "BUSINESS_ADMIN (3 policies)")
- **Better Spacing**: Nodes spread horizontally at each level, with clear vertical connections
- **Independent Control**: Expand/collapse each node independently to inspect specific paths

## Technology Stack

- **React Flow** - Interactive node-based visualization library
- **Ant Design** - UI components for filters and controls
- **React Query** - Data fetching and caching

## How to Use

1. Navigate to **Access Visualization** from the sidebar menu (uses PartitionOutlined icon)

2. **Select View Type:**
   - Choose between "User Access Flow" or "UI Page Flow"

3. **Select Entity:**
   - For User Flow: Select a user from the dropdown
   - For Page Flow: Select a UI page from the dropdown

4. **Interact with the Visualization:**
   - **Expand/Collapse Nodes**: Click on any node with children (indicated by ▶ or ▼) to expand or collapse its children
   - **Start Collapsed**: All nodes begin in collapsed state for a clean overview
   - **Pan**: Click and drag on the background
   - **Zoom**: Use mouse wheel or zoom controls
   - **Move nodes**: Click and drag individual nodes
   - **Reset view**: Use the "Fit View" button in controls
   - **Progressive Exploration**: Expand nodes level by level to explore the access hierarchy

5. **Color Legend:**
   - 🔵 **Light Blue** - User/Page (root node)
   - 🟢 **Light Green** - Role
   - 🟠 **Light Orange** - Policy
   - 🔵 **Light Cyan** - Action
   - 🔴 **Light Red** - Endpoint

## API Requirements

The visualization uses the following API endpoints:

### For User Access Flow:
- `GET /api/auth/users` - Get all users
- `GET /api/meta/user-access-matrix/{user_id}` - Get user's roles, policies, and endpoints

### For UI Page Flow:
- `GET /api/admin/ui-pages` - Get all UI pages
- `GET /api/meta/ui-access-matrix/{page_id}` - Get page's actions and endpoints

## Known Limitations

1. **Performance**: For users with many roles or pages with many actions, the visualization may become complex. Consider adding pagination or filtering options.

2. **Static Layout**: The node positions are calculated automatically. You may want to add custom layout algorithms for better visualization.

## Future Enhancements

1. **Search and Filter**: Add ability to search for specific nodes
2. **Export**: Allow exporting the visualization as PNG/SVG
3. **Interactive Editing**: Click on nodes to edit relationships (beyond expand/collapse)
4. **Diff View**: Compare access between two users
5. **Audit Integration**: Show audit trail when clicking on connections
6. **Custom Layouts**: Add different layout algorithms (tree, radial, force-directed)
7. **Hover Details**: Show more details on hover (descriptions, metadata)
8. **Real-time Updates**: WebSocket integration for live updates
9. **Bulk Operations**: Expand/collapse all nodes at once
10. **Node Details Panel**: Side panel showing detailed information when a node is selected

## Code Structure

```
admin-ui/src/pages/AccessVisualization.tsx
```

The component is organized as:
- State management for users, pages, selections
- Two main builder functions:
  - `buildUserAccessMap()` - Constructs user access flow
  - `buildPageAccessMap()` - Constructs UI page flow
- React Flow integration with custom node styling
- Ant Design UI for controls

## Styling

Nodes are styled with:
- Different background colors for different entity types
- Animated edges to show flow direction
- Arrow markers on edges
- Responsive sizing based on content

## Menu Integration

The page is added to the sidebar navigation between "Linkage" and "Audit Logs" sections.

Access: Dashboard → Access Visualization (PartitionOutlined icon)
