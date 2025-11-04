# Admin UI Architecture Update - November 4, 2025

## Overview
The admin-ui has been updated to align with the new simplified authorization architecture that removes the Capability layer.

## Changes Made

### New Architecture Flow
```
User → Role → Policy → Endpoint
                ↑
Page → PageAction ──┘ (via endpoint_id)
```

### Removed Components
1. **Capabilities Page** (`src/pages/Capabilities.tsx`) - Moved to `_deprecated` folder
2. **PolicyCapabilityRelationship** (`src/pages/relationships/PolicyCapabilityRelationship.tsx`) - Moved to `_deprecated` folder
3. **Capability API endpoints** - Removed from `services/api.ts`

### Updated Components

#### 1. Navigation (Layout.tsx)
- Removed "Capabilities" menu item from UI Management section
- Removed "Assign Capabilities" menu item

#### 2. Types (types/index.ts, types/auth.types.ts)
- Removed `Capability` interface
- Updated `Policy` interface to remove `capabilities` field
- Updated `PageAction` interface:
  - Removed `capabilityId` field
  - Changed `actionLabel` to `label`
  - Added `action`, `icon`, `variant`, `displayOrder`, `isActive` fields
  - Made `endpointId` the primary foreign key

#### 3. API Service (services/api.ts)
- Removed `api.capabilities.*` methods
- Removed `api.policies.getCapabilities()`, `addCapabilities()`, `removeCapability()`
- Kept `api.policies.getEndpoints()`, `addEndpoints()`, `removeEndpoint()`

#### 4. PageActions Component (pages/PageActions.tsx)
- Removed capability selection from forms
- Updated to use endpoint selection directly
- Added fields: `action type`, `icon`, `variant`, `displayOrder`
- Updated table columns to display endpoint information
- Updated form validation to require action type

#### 5. Routes (App.tsx)
- Removed PolicyCapabilityRelationship route
- Removed Capabilities route

### Active Relationship Pages
1. **PolicyEndpointRelationship** - Assign endpoints to policies
2. **RolePolicyRelationship** - Assign policies to roles
3. **PageActionRelationship** - Manage page actions
4. **EndpointPolicyRelationship** - View endpoint-policy mappings

## Migration Notes

### For Frontend Developers
- When creating page actions, select the endpoint directly (no capability needed)
- Action authorization is now determined by:
  1. User's roles
  2. Policies assigned to those roles
  3. Endpoints protected by those policies
  4. Page actions linked to those endpoints

### API Changes
The following API endpoints are no longer available:
- `GET /api/admin/capabilities`
- `POST /api/admin/capabilities`
- `PUT /api/admin/capabilities/:id`
- `DELETE /api/admin/capabilities/:id`
- `GET /api/admin/policies/:id/capabilities`
- `POST /api/admin/policies/:id/capabilities`
- `DELETE /api/admin/policies/:id/capabilities/:capId`

### Data Model
PageAction now requires:
- `label` (string) - Display text for the action
- `action` (string) - Type of action (CREATE, EDIT, DELETE, etc.)
- `pageId` (number) - Reference to UI page
- `endpointId` (number, optional) - Direct reference to endpoint
- `icon` (string, optional) - Icon name
- `variant` (string, optional) - Button variant
- `displayOrder` (number, optional) - Sort order

## Testing Checklist
- [x] Application builds without errors
- [x] Development server starts successfully
- [x] Navigation menu displays correctly
- [ ] All relationship pages load without errors
- [ ] Page actions can be created/edited with endpoint selection
- [ ] Policy-endpoint assignment works correctly
- [ ] No console errors related to capabilities

## Rollback Plan
If needed to rollback:
1. Restore files from `_deprecated` folder
2. Revert changes to `App.tsx`, `Layout.tsx`, `types/*`, `services/api.ts`
3. Restore capability-related API endpoints on backend

## References
- Backend changes documented in: `auth-service/CAPABILITY_REMOVAL_CONTEXT.md`
- Architecture documentation: `docs/architecture/overview.md`
