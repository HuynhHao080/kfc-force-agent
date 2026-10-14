# Menu Domain - Phase 3 Implementation

## Overview

This document describes the Menu Domain implementation for Phase 3 of the KFC Force Agent project. The Menu Domain provides a deterministic, mock-based menu data layer that future AI/Bedrock agents can query through the Menu Tool.

## Architecture

```
Customer
   ↓
/menu API
   ↓
MenuService
   ↓
IMenuRepository
   ├── MockMenuRepository (development)
   └── DynamoDBMenuRepository (production)

Future:
Bedrock Agent
   ↓
MenuTool
   ↓
MenuService
   ↓
IMenuRepository
```

## Menu Entities

The Menu Domain implements all six logical entities from the thesis:

### 1. MenuCategory
- **Fields**: id, name, description, displayOrder, isActive, createdAt, updatedAt
- **Purpose**: Organizes menu items into logical groups
- **Vietnamese Names**: "Bữa sáng", "Bữa trưa", "Bữa tối", "Đồ uống", "Món ăn kèm"

### 2. MenuItem
- **Fields**: id, categoryId, name, description, price, currency, imageUrl, isAvailable, isActive, tags, metadata, createdAt, updatedAt
- **Purpose**: Represents individual menu items
- **Money Handling**: Integer VND values only (e.g., 89000, not 89000.50)

### 3. MenuItemOption
- **Fields**: id, menuItemId, name, required, displayOrder, isActive, createdAt, updatedAt
- **Purpose**: Defines options for menu items (e.g., "Cấp độ cay", "Kích thước")

### 4. OptionValue
- **Fields**: id, optionId, name, priceDelta, isDefault, isAvailable, displayOrder, createdAt, updatedAt
- **Purpose**: Provides specific values for options (e.g., "Ít cay", "Cay vừa", "Cay nhiều")

### 5. ProductBundle
- **Fields**: id, name, description, price, currency, isActive, isAvailable, imageUrl, metadata, createdAt, updatedAt
- **Purpose**: Represents pre-defined combinations of items (e.g., "Combo Gia Đình", "Combo Sinh Viên")

### 6. BundleItem
- **Fields**: id, bundleId, menuItemId, quantity, isRequired, createdAt, updatedAt
- **Purpose**: Links menu items to bundles with specific quantities

## Repository Layer

### IMenuRepository Interface
Provides deterministic access to menu data:

- **Categories**: `getCategories()`, `getCategoryById()`
- **Menu Items**: `getMenuItems()`, `getMenuItemById()`, `getItemsByCategory()`, `searchMenuItems()`
- **Options**: `getItemOptions()`, `getItemOptionById()`
- **Option Values**: `getOptionValues()`, `getOptionValueById()`
- **Bundles**: `getProductBundles()`, `getProductBundleById()`
- **Bundle Items**: `getBundleItems()`
- **Utilities**: `getAvailableMenuItems()`, `getActiveCategories()`

### MockMenuRepository
Deterministic in-memory implementation for development:

- **Seed Data**: 5 categories, 8 menu items, 2 item options, 3 option values, 3 product bundles
- **Vietnamese Names**: All customer-facing names in Vietnamese
- **Business Rules**: 
  - Inactive items (`isActive: false`) are excluded from available results
  - Unavailable items (`isAvailable: false`) are excluded from ordering
  - Search supports Vietnamese text normalization

### DynamoDBMenuRepository
Production-ready DynamoDB implementation:

- **Single-Table Design**: Uses existing `KfcForceAgent` table
- **PK/SK Patterns**: 
  - Categories: `PK = "MENU", SK = "CATEGORY#<categoryId>"`
  - Items: `PK = "MENU", SK = "ITEM#<itemId>"`
  - Options: `PK = "MENU_ITEM_OPTION", SK = <optionId>`
  - Option Values: `PK = "OPTION_VALUE", SK = <valueId>`
  - Bundles: `PK = "BUNDLE", SK = <bundleId>`
  - Bundle Items: `PK = "BUNDLE#<bundleId>", SK = "ITEM#<itemId>"`

## MenuService

Provides business logic and deterministic operations:

### Core Operations
- **Category Management**: Get all categories, get category by ID
- **Item Management**: Get all items, get item by ID, get items by category, search items
- **Option Management**: Get item options, get option by ID
- **Bundle Management**: Get all bundles, get bundle by ID
- **Utility Methods**: Get available items, get active categories

### Business Rules
1. **Inactive Item Filtering**: Items with `isActive: false` are never returned
2. **Availability Filtering**: Items with `isAvailable: false` are excluded from customer-facing results
3. **Deterministic Search**: Case-insensitive, partial matching with Vietnamese text normalization
4. **Price Integrity**: All prices come from trusted repository data, never invented
5. **Vietnamese Support**: Customer-facing names are normalized for search

### Vietnamese Customer-Facing Methods
- `getVietnameseCategories()`: Returns categories with normalized names
- `getAvailableMenuItemsForCustomer()`: Returns available items with normalized names
- `normalizeVietnameseName()`: Converts Vietnamese characters to ASCII for search

## MenuTool

Deterministic tool abstraction for future AgentCore integration:

### Input Types
```typescript
type MenuToolInput = {
  operation: "list_categories" | "list_items" | "search" | "get_item" | 
             "get_options" | "list_bundles" | "get_bundle" | "get_item_with_options" | 
             "get_bundle_with_items";
  query?: string;
  categoryId?: string;
  itemId?: string;
  bundleId?: string;
  optionId?: string;
  valueId?: string;
};
```

### Output Types
```typescript
type MenuToolOutput = {
  success: boolean;
  operation?: string;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
};
```

### Operations
- **List Categories**: Returns all active categories
- **List Items**: Returns items by category or all items
- **Search**: Searches items by name/description with Vietnamese support
- **Get Item**: Retrieves specific item by ID
- **Get Options**: Retrieves options for a specific item
- **List Bundles**: Returns all available bundles
- **Get Bundle**: Retrieves specific bundle by ID
- **Get Item with Options**: Retrieves item and its options together
- **Get Bundle with Items**: Retrieves bundle and its component items

### Error Handling
- **INVALID_INPUT**: Missing required parameters
- **INVALID_OPERATION**: Unsupported operation
- **MENU_ITEM_NOT_FOUND**: Item doesn't exist or is unavailable
- **MENU_CATEGORY_NOT_FOUND**: Category doesn't exist or is inactive
- **BUNDLE_NOT_FOUND**: Bundle doesn't exist or is unavailable

## API Layer

### GET /api/menu
Enhanced menu API supporting multiple query patterns:

#### Query Parameters
- `categoryId`: Filter items by category
- `q`: Search items by name/description
- `itemId`: Get specific item
- `bundleId`: Get specific bundle

#### Response Format
```json
{
  "categories": [...],
  "items": [...],
  "count": 8,
  "query": "ga ran",
  "message": "Không tìm thấy món phù hợp."
}
```

#### Error Handling
- **400**: Invalid query parameters
- **404**: Resource not found
- **500**: Internal server error

## Data Provenance

### Mock Data
- **Source**: Development/demo data (not official KFC data)
- **Purpose**: Testing and development
- **Characteristics**: Realistic Vietnamese menu items, but clearly marked as demo

### Future Data Ingestion
Planned architecture for Phase 4+:

```
External Menu Source
        ↓
Scheduled Ingestion (S3/EventBridge)
        ↓
Raw Data
        ↓
Validation/Normalization
        ↓
DynamoDB Menu
        ↓
Menu Tool
```

## Testing

### Test Coverage
1. **Category Operations**: List categories, get category by ID
2. **Item Operations**: List items, get item by ID, search items
3. **Option Operations**: Get item options
4. **Bundle Operations**: List bundles, get bundle by ID
5. **Filtering Tests**: Inactive item filtering, unavailable item filtering
6. **Search Tests**: Vietnamese text search, partial matching
7. **Error Handling**: Invalid input, missing resources
8. **MenuTool Tests**: All tool operations and error cases

### Test Framework
- Uses existing project testing setup
- Focused on deterministic behavior
- Validates Vietnamese text normalization
- Ensures business rule compliance

## Security & Quality

### Security
- **No Hardcoded Credentials**: AWS credentials managed through environment variables
- **Input Validation**: Zod validation at API boundaries
- **Error Handling**: Generic error messages, no internal details exposed
- **Access Control**: Repository layer prevents direct database access

### Quality
- **TypeScript Strict Mode**: Full type safety
- **Deterministic Behavior**: Same input always produces same output
- **Money Integrity**: All prices from trusted repository data
- **Vietnamese Support**: Customer-facing interface in Vietnamese
- **Backward Compatibility**: Existing APIs unchanged

## Database Design

### Single-Table Design
All menu entities stored in the existing `KfcForceAgent` table:

#### PK/SK Patterns
- **Categories**: `PK = "MENU", SK = "CATEGORY#<categoryId>"`
- **Items**: `PK = "MENU", SK = "ITEM#<itemId>"`
- **Item Options**: `PK = "MENU_ITEM_OPTION", SK = <optionId>`
- **Option Values**: `PK = "OPTION_VALUE", SK = <valueId>`
- **Bundles**: `PK = "BUNDLE", SK = <bundleId>`
- **Bundle Items**: `PK = "BUNDLE#<bundleId>", SK = "ITEM#<itemId>"`

#### Access Patterns
- **Category Lookup**: Direct Get by PK/SK
- **Item Lookup**: Direct Get by PK/SK
- **Category Items**: Query by PK with SK prefix
- **Item Options**: Query by parent item ID
- **Bundle Items**: Query by parent bundle ID

## Search Implementation

### Vietnamese Text Normalization
```javascript
function normalizeVietnameseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗ]/g, "o")
    .replace(/[ùúụủũưừừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "");
}
```

### Search Examples
- "ga ran" matches "Gà Rán"
- "burger" matches "Burger Gà Rán"
- "pepsi" matches "Pepsi 1.5L"

## Relationship to Future Phases

### Phase 4: Amazon Bedrock Integration
- MenuTool becomes the interface for Bedrock agent menu operations
- AgentCore uses MenuTool instead of direct service calls
- Deterministic menu access ensures consistent agent behavior

### Phase 5: Tools Layer
- MenuTool is the first in a family of deterministic tools
- Pattern established for CartTool, OrderTool, PromotionTool, etc.
- Tool registry enables pluggable architecture

### Phase 6: Policy Engine
- MenuTool respects policy constraints (e.g., item availability)
- Policies can block or modify menu operations
- MenuTool provides structured data for policy evaluation

### Phase 7: State Machine
- MenuTool operations are stateless
- State management handled by higher layers
- Menu data remains consistent across state transitions

## Conclusion

Phase 3 establishes a robust, deterministic menu data layer that:

1. **Provides Reliable Data**: Consistent, validated menu information
2. **Supports Vietnamese Customers**: Customer-facing interface in Vietnamese
3. **Enables Future AI**: Clean interface for Bedrock agent integration
4. **Maintains Architecture**: Follows established patterns for scalability
5. **Ensures Quality**: Type-safe, tested, and well-documented

The Menu Domain serves as the foundation for the conversational ordering system, ensuring that all future AI interactions have reliable, consistent access to menu data.

---

**Files Created/Modified**:
- `src/lib/types/menu.ts` - Menu entity type definitions
- `src/lib/db/repositories/interfaces/menu-repository.interface.ts` - Repository interface
- `src/lib/db/repositories/menu-repository.ts` - DynamoDB repository implementation
- `src/lib/db/repositories/implementations/mock-repository.ts` - Mock repository with seed data
- `src/lib/services/menu-service.ts` - Menu service with business logic
- `src/lib/agent/tools/menu-tool.ts` - Deterministic menu tool
- `src/lib/validation/menu.ts` - Zod validation schema
- `src/app/api/menu/route.ts` - Enhanced menu API
- `src/lib/agent/agent-core.ts` - Updated service container with MenuTool
- `docs/menu-domain.md` - Comprehensive documentation

**Architecture Decisions**:
- Single-table DynamoDB design for all menu entities
- Repository pattern with dependency injection
- Deterministic mock data for development
- Vietnamese customer-facing interface
- Clean separation between data access, business logic, and API layers
- Foundation for future Bedrock integration

**Validation**:
- TypeScript strict mode passing
- ESLint warnings addressed
- Next.js build successful
- Menu API endpoints functional
- Menu search and filtering working correctly
