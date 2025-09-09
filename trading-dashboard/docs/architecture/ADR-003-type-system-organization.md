# ADR-003: Type System Organization and Domain-Specific Modules

## Status

Accepted

## Context

The original type system had all TypeScript interfaces and types in a single `types/index.ts` file, which became unwieldy as the application grew. This monolithic approach led to:

- Difficulty finding specific types
- Circular dependency issues
- Poor IDE performance due to large type files
- Lack of clear domain boundaries
- Inconsistent type naming and organization

## Decision

We restructured the type system into domain-specific modules with clear boundaries and consistent patterns:

### 1. Domain-Based Organization

```
types/
├── api/             # API request/response types
│   ├── requests.ts      # Request payload types
│   ├── responses.ts     # API response types
│   └── websocket.ts     # WebSocket message types
├── common/          # Shared utility types
│   └── base.ts          # Base component props and utilities
├── trading/         # Trading domain types
│   ├── common.ts        # Shared trading types
│   ├── portfolio.ts     # Portfolio and position types
│   ├── positions.ts     # Position-specific types
│   ├── signals.ts       # Trading signal types
│   └── trades.ts        # Trade execution types
├── ui/              # UI component types
│   └── components.ts    # Generic UI component types
└── index.ts         # Re-exports for backward compatibility
```

### 2. Type Naming Conventions

- **Interfaces**: PascalCase with descriptive names (e.g., `TradingPosition`, `PortfolioMetrics`)
- **Enums**: PascalCase with domain prefix (e.g., `TradingStatus`, `OrderType`)
- **Union Types**: Descriptive names ending in `Type` (e.g., `OrderSideType`, `PositionStatusType`)
- **Generic Types**: Single letter with descriptive constraint (e.g., `T extends BaseEntity`)

### 3. Base Component Props Pattern

```typescript
// Base props that all components extend
export interface BaseComponentProps {
  className?: string;
  testId?: string;
}

// Domain-specific base props
export interface TradingComponentProps extends BaseComponentProps {
  symbol?: string;
  timeframe?: TimeframeType;
}
```

## Implementation Details

### Type Module Structure

Each domain module follows a consistent pattern:

```typescript
// trading/portfolio.ts
export interface Portfolio {
  id: string;
  totalValue: number;
  totalCost: number;
  availableCash: number;
  positions: Position[];
  dayChange?: number;
  dayChangePercent?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  entryDate: string;
}

// Utility types for the domain
export type PositionSide = Position["side"];
export type PortfolioMetrics = Pick<
  Portfolio,
  "totalValue" | "totalCost" | "dayChange"
>;
```

### API Type Organization

```typescript
// api/responses.ts
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// api/requests.ts
export interface CreatePositionRequest {
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: number;
  orderType: "MARKET" | "LIMIT";
  price?: number;
}
```

### Re-export Strategy

The main `index.ts` file provides backward compatibility and convenient imports:

```typescript
// types/index.ts
// Re-export all types for backward compatibility
export * from "./api";
export * from "./common";
export * from "./trading";
export * from "./ui";

// Convenient grouped exports
export type { Portfolio, Position, Trade } from "./trading";

export type { ApiResponse, PaginatedResponse } from "./api";
```

## Benefits Achieved

### 1. Improved Developer Experience

- **Faster IDE performance**: Smaller type files load faster
- **Better IntelliSense**: More relevant type suggestions
- **Easier navigation**: Clear domain boundaries help locate types
- **Reduced cognitive load**: Developers only need to understand relevant domain types

### 2. Better Maintainability

- **Clear ownership**: Each domain team can manage their types
- **Reduced conflicts**: Fewer merge conflicts in type files
- **Easier refactoring**: Changes isolated to specific domains
- **Consistent patterns**: Standardized type naming and structure

### 3. Enhanced Type Safety

- **Stricter boundaries**: Domain-specific types prevent cross-domain errors
- **Better validation**: More specific types catch errors at compile time
- **Clearer contracts**: API types clearly define expected data shapes
- **Generic utilities**: Reusable type utilities reduce duplication

## Migration Strategy

### Phase 1: Create New Structure

1. Create domain-specific type modules
2. Move types from monolithic file to appropriate domains
3. Update imports in a few key files to test the structure

### Phase 2: Gradual Migration

1. Update imports file by file
2. Use TypeScript compiler to catch missing imports
3. Update build process to handle new structure

### Phase 3: Cleanup and Optimization

1. Remove old monolithic type file
2. Optimize re-exports for tree shaking
3. Add type documentation and examples

## Consequences

### Positive

- **Better organization**: Types are easier to find and understand
- **Improved performance**: Faster TypeScript compilation and IDE performance
- **Reduced coupling**: Clear domain boundaries prevent inappropriate dependencies
- **Easier onboarding**: New developers can focus on relevant domain types
- **Better testing**: Domain-specific types make testing more focused

### Negative

- **More files**: Increased number of files to manage
- **Import complexity**: May need more import statements
- **Migration effort**: Significant effort to migrate existing codebase
- **Learning curve**: Developers need to understand new organization

## Alternatives Considered

### 1. Keep Monolithic Types File

- **Pros**: Simple structure, everything in one place
- **Cons**: Poor scalability, performance issues, difficult maintenance
- **Rejected**: Doesn't scale with application growth

### 2. Feature-Based Type Organization

- **Pros**: Types grouped with related features
- **Cons**: Harder to find shared types, potential duplication
- **Rejected**: Conflicts with component reusability goals

### 3. Flat Structure with Prefixes

- **Pros**: Simple imports, no nested directories
- **Cons**: Still becomes unwieldy with many types, poor organization
- **Rejected**: Doesn't solve the core organization problem

## Future Considerations

### Type Generation

- Consider generating types from API schemas
- Implement runtime type validation with libraries like Zod
- Explore GraphQL code generation for type safety

### Documentation

- Add JSDoc comments to all public types
- Create type usage examples and best practices
- Implement automated type documentation generation

## References

- [TypeScript Handbook - Modules](https://www.typescriptlang.org/docs/handbook/modules.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)

## Review Date

This ADR should be reviewed in 6 months to assess the effectiveness of the type organization and identify any needed adjustments.
