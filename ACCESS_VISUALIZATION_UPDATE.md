# Access Visualization Update - UI Page Flow

## Summary of Changes

### 1. **Updated API Response Handling**
The component now handles the new API response format from `GET /api/meta/ui-access-matrix`:

```json
{
  "generated_at": "2025-11-05T13:13:16.575742Z",
  "version": 1762348396575,
  "pages": [
    {
      "id": 1,
      "key": "dashboard",
      "label": "Admin Dashboard",
      "route": "/dashboard",
      "actions": [...],
      "children": [...]
    }
  ]
}
```

### 2. **New Features**

#### a. Automatic Full Hierarchy Display
- When user selects "UI Page Flow" from dropdown, the system automatically:
  1. Fetches all pages via `GET /api/meta/ui-access-matrix`
  2. Displays the complete page hierarchy immediately
  3. No page selection dropdown needed - shows everything at once

#### b. Interactive Hierarchy Visualization
- All pages are rendered in a tree structure
- Each node can be expanded/collapsed to show:
  - Child pages
  - Actions
  - Endpoints
- Start with all nodes collapsed for cleaner view

### 3. **Helper Functions**

#### `findPageById()` (kept for potential future use)
Recursively searches the page hierarchy to find a specific page by ID

#### `buildAllPagesVisualization()`
New function that renders the complete page hierarchy:
- Processes all root pages
- Recursively renders children
- Maintains proper spacing and layout

### 4. **Updated Interfaces**

```typescript
interface PageNode {
  id: number;
  key: string;
  label: string;
  route: string;
  actions?: Action[];
  children?: PageNode[];
}

interface UiAccessMatrixResponse {
  generated_at: string;
  version: number;
  pages: PageNode[];
}

interface ProcessedPageAccessData {
  pageId: number;
  pageNode: PageNode;        // The selected page node
  allPages: PageNode[];      // All pages for reference
}
```

### 5. **Workflow**

1. **User selects "UI Page Flow"** → Automatically triggers API call to fetch all pages
2. **Full hierarchy displays immediately** → No dropdown selection needed
3. **User expands nodes** → Click on nodes with ▶ to expand and see:
   - Child pages
   - Actions
   - Endpoints
4. **Interactive navigation** → Expand/collapse any node to explore the hierarchy

### 6. **Visual Improvements**

- **Vertical layout** prevents node overlapping
- **Hierarchical structure** shows complete system architecture
- **Proper spacing**: 200px vertical, 250px horizontal
- **Color coding**:
  - Purple: Pages
  - Cyan: Actions
  - Red: Endpoints
- **Clean start**: All nodes begin collapsed for better overview

### 7. **API Endpoint Used**

```
GET /api/meta/ui-access-matrix
```
- Returns all pages in the system (no trailing slash, no page ID)
- Called once when "UI Page Flow" view is selected
- Data cached in component state (`uiPages`)
- Displays complete hierarchy automatically

### 8. **Summary Display**

When UI Page Flow is active, shows:
- "Full UI Page Hierarchy" label
- Total number of root pages
- All data visible through node expansion

## Testing

To test the new functionality:

1. Select "UI Page Flow" from the dropdown
2. Wait for pages to load (shows loading indicator)
3. Full hierarchy displays automatically with all root pages
4. Click nodes with ▶ to expand and see:
   - Child pages
   - Actions for each page
   - Endpoints for each action
5. Click nodes with ▼ to collapse sections
6. Navigate through the entire system's page structure

## Example Display

When "UI Page Flow" is selected, you'll see all root pages:
```
▶ Dashboard
▶ Worker
▶ RBAC
```

Expanding RBAC shows:
```
▼ RBAC
  ▶ Endpoints
  ▶ Policies
  ▶ Roles
  ▶ Users
```

Expanding Policies shows its actions:
```
▼ Policies
  ▶ View Policies → GET /api/admin/policies
  ▶ Create Policies → POST /api/admin/policies
```
