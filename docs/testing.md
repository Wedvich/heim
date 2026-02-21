# Testing Strategy

## Approach: Testing Trophy (Kent C. Dodds)

The bulk of tests are **integration tests** that exercise domain behavior through meaningful scenarios, not isolated unit tests of individual functions.

## EARS Methodology Mapping

| EARS Pattern                                              | Maps to                         | Example                                                             |
| --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| **Event-driven** ("WHEN event THEN behavior")             | Projection tests                | WHEN `ItemMarkedEmpty` THEN shopping list projection includes item  |
| **State-driven** ("WHILE state WHEN command THEN result") | Aggregate command handler tests | WHILE user has no email WHEN `SetEmail` THEN `EmailSetOnUser` event |
| **Ubiquitous** ("The system SHALL...")                    | Invariant tests                 | The system SHALL reject commands with mismatched tenant IDs         |
| **Unwanted** ("IF condition THEN NOT behavior")           | Negative/guard tests            | IF aggregate version conflicts THEN NOT accept the command          |

## Test Organization

```
packages/domain/tests/
├── auth/
│   ├── user.ears.test.ts          # User aggregate behavior
│   ├── tenant.ears.test.ts        # Tenant aggregate behavior
│   ├── membership.ears.test.ts    # Membership behavior
│   ├── login-flow.ears.test.ts    # Integration: full login scenarios
│   └── policies.ears.test.ts      # ABAC policy evaluation
└── event-store/
    ├── append.ears.test.ts
    ├── bitemporal.ears.test.ts
    └── projections.ears.test.ts
```

## Dev Bypass for Testing

- Integration tests use the dev bypass auth to avoid OIDC round-trips
- E2E tests run in a dedicated test tenant in the live environment
- The test tenant is seeded via commands, not direct DB manipulation
