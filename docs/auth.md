# Auth & Multi-Tenancy Domain Model (First Bounded Context)

## Aggregates

**User**

- `userId: UUID`
- `email?: string` (optional, but unique when present)
- `emailVerified: boolean`
- `displayName?: string`
- State derived from: `UserCreated`, `EmailSetOnUser`, `EmailVerifiedOnUser`, `DisplayNameChanged`

**Identity** (links external provider to User)

- `identityId: UUID`
- `userId: UUID`
- `provider: 'google' | 'apple' | string` (extensible)
- `providerSubjectId: string` (the `sub` claim — stable, never changes)
- `providerEmail?: string` (what the provider reported, used for merge logic)
- State derived from: `IdentityLinkedToUser`, `IdentityUnlinkedFromUser`

**Tenant**

- `tenantId: UUID`
- `name: string`
- `settings: TenantSettings`
- State derived from: `TenantCreated`, `TenantRenamed`, `TenantSettingsChanged`

**Membership** (User ↔ Tenant relationship)

- `membershipId: UUID`
- `userId: UUID`
- `tenantId: UUID`
- `role: Role` (owner, member, etc.)
- State derived from: `MemberAddedToTenant`, `MemberRoleChanged`, `MemberRemovedFromTenant`

## Login Flow

```
1. User authenticates via Google/Apple → backend receives ID token
2. Validate ID token, extract: provider, sub, email?, email_verified?
3. Lookup Identity by (provider, sub)
   → FOUND: load linked User, issue JWT pair, done
   → NOT FOUND:
     4. If email present AND verified by provider:
        → Lookup User by email
          → FOUND: create Identity linked to existing User (auto-merge)
          → NOT FOUND: create new User + Identity
     5. If no verified email:
        → create new User (no email) + Identity
6. Issue JWT access token (short-lived) + refresh token
7. Access token contains: userId, tenantId (if selected), actingUserId (if impersonating)
```

## Dev Bypass Auth

For local development and testing, a `DEV_AUTH_BYPASS=true` environment variable enables:

- A `/dev/login` endpoint that accepts a `userId` and returns a JWT pair without OIDC
- Only available when `NODE_ENV=development`
- Documented in CLAUDE.md so agents can use it for testing

## ABAC Policy Engine (Initial Shape)

```typescript
interface PolicyContext {
  subject: { userId: string; role: Role; tenantId: string };
  action: string; // e.g., "tenant:invite", "chore:complete"
  resource?: { type: string; ownerId?: string; tenantId: string };
  environment?: { timestamp: Date };
}

type PolicyDecision = "allow" | "deny";
type Policy = (ctx: PolicyContext) => PolicyDecision;
```

Initial policies are role-based: owner can do everything, member has restricted actions. The engine lives in `@heim/domain` so it's shared.
