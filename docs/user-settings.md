# User Settings

How Heim stores per-user preferences that don't belong to the domain model — things like color scheme, locale, or UI density. Distinct from auth state (session, identity) and from domain state (households, events).

## Scope

A "user setting" is a per-user preference that:

- Affects presentation or client behavior, not domain decisions.
- Is acceptable to lose if a user clears their browser (it's a preference, not data).
- Contains no PII. PII belongs in forgettable payloads, never here.

First setting: **color scheme**. The same shape applies to future settings like `locale` or `density`.

## Client storage

### localStorage keys

- One key per setting. Key name is a kebab-case noun, preferring the matching CSS or web platform term where one exists.
- Color scheme: key `color-scheme`, values `'light' | 'dark' | 'system'`. Default when unset: `'system'`.
- Future examples (illustrative): `locale` (BCP 47 tag), `density` (`'comfortable' | 'compact'`).

### DOM exposure

Settings that affect first render are applied to `<html>` via dataset attributes so CSS can key off them without a paint cycle:

- `<html data-{name}-pref="...">` holds the user's chosen preference, including any `'system'`/auto sentinel.
- `<html data-{name}="...">` holds the resolved value, if resolution differs from the raw preference (e.g. `'system'` → `'light'`/`'dark'`).

For color scheme this means `data-color-scheme-pref` (light/dark/system) and `data-color-scheme` (light/dark). The CSS `color-scheme` property on `<html>` is also set to the resolved value so native UA widgets follow along.

### Pre-paint IIFE

Settings that would cause a flash if applied after React mounts must be applied by an inline `<script>` in `<head>`, before any blocking stylesheet. The script is small, dependency-free, and wrapped in `try/catch` because `localStorage` throws in some privacy modes. If it throws, the CSS `<meta name="color-scheme" content="light dark" />` fallback handles UA widget colors and the page falls back to the `prefers-color-scheme` media query.

The color-scheme IIFE lives in [`packages/web/index.html`](../packages/web/index.html).

### React access

Components read the current preference from `<html>`'s dataset (single source of truth, already applied) and write through both `localStorage.setItem` and the dataset attribute when the user changes the setting. No React-side hydration is required; the IIFE has already run.

The component-side API is not yet implemented — current scope is the IIFE and this spec.

## Server-side persistence (deferred)

Today, settings live only on the device. The design below is what we'll implement when we want preferences to follow a user across devices.

### Domain shape

Per-user settings hang off the `User` aggregate as a non-PII blob on `UserState` (see [`packages/domain/src/user/user-state.ts`](../packages/domain/src/user/user-state.ts)):

```ts
type UserSettings = {
  colorScheme?: "light" | "dark" | "system";
  // future: locale, density, ...
};

type UserState = {
  // ...existing identity fields...
  settings: UserSettings;
  settingsUpdatedAt: string; // ISO timestamp
};
```

New event:

```ts
type UserSettingsUpdated = {
  type: "UserSettingsUpdated";
  settings: Partial<UserSettings>;
  updatedAt: string;
};
```

Apply by shallow merge into `UserState.settings`, replacing `settingsUpdatedAt`.

### Sync

- `GET /api/auth/session` response gains an optional `settings` field and `settingsUpdatedAt`.
- On login (or session restore), if `settingsUpdatedAt` from the server is newer than the client's locally stored `settingsUpdatedAt` (a sibling localStorage key, e.g. `settings-updated-at`), overwrite localStorage from the server. Otherwise leave the client values alone.
- When the user changes a setting in the UI, write locally first, then `POST` to a settings endpoint that emits a `UserSettingsUpdated` event. Reconciliation is last-write-wins by `settingsUpdatedAt`.

### Why not cookies for hydration

We considered putting the preference in a cookie so the server could deliver it before any client JS runs. Heim's web is a pure SPA today (Vite + React Router `BrowserRouter`); the HTML is a static asset built at compile time, identical for every request. A cookie wouldn't reach the document before the inline IIFE runs — the IIFE is already first-paint-fast — and there's no server-rendered HTML in which to inject a `data-color-scheme` attribute. If we later move to SSR (React Router framework mode) or have the API serve and template the HTML, revisit this: a cookie + server-injected `data-color-scheme` would let us drop the IIFE for logged-in users.

## Privacy and erasure

- `UserSettings` must contain no PII. Names, emails, addresses, free-text fields, or anything that could identify a person belong in the encrypted forgettable payload, not here.
- A user's settings are erased alongside the rest of their data via the existing crypto-shredding path. The blob sits inside the user's forgettable area so right-to-erasure deletes it with everything else.
- Aggregates of settings (e.g. "how many users prefer dark mode") are fine to derive from event projections; raw `UserSettingsUpdated` events are safe to keep because they hold no PII.
- Before adding any new field to `UserSettings`, confirm against the PII rule in the root [`CLAUDE.md`](../CLAUDE.md). When in doubt, it's not a setting — it's profile data, and it belongs in the forgettable payload.
