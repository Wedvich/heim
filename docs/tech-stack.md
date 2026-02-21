# Tech Stack

| Concern            | Choice                                             | Notes                                                                            |
| ------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Language           | TypeScript (end-to-end)                            | Strict mode, shared domain package                                               |
| Runtime            | Node.js                                            |                                                                                  |
| Package manager    | Yarn (nodeLinker: node-modules)                    | No PnP                                                                           |
| Monorepo           | Turborepo                                          |                                                                                  |
| Backend framework  | Express                                            |                                                                                  |
| Frontend framework | React (PWA)                                        | No meta-framework (no Next/Remix)                                                |
| Database           | PostgreSQL                                         | Event store + projections                                                        |
| Testing            | Vitest                                             | Testing trophy approach, EARS methodology                                        |
| E2E testing        | Playwright                                         | Against dedicated test tenant                                                    |
| Linting            | oxlint                                             |                                                                                  |
| Formatting         | oxfmt (or Prettier fallback if oxfmt isn't stable) |                                                                                  |
| Git hooks          | Lefthook (replaces Husky + lint-staged)            |                                                                                  |
| Commit linting     | commitlint + @commitlint/config-conventional       | Enforced via Lefthook commit-msg hook                                            |
| Releases           | @changesets/cli                                    | Monorepo-aware changelogs + GitHub Releases                                      |
| CI/CD              | GitHub Actions                                     | Public repo, free tier                                                           |
| Containers         | Docker + Docker Compose                            | Postgres runs via Compose in `@heim/infra`; app code runs natively via Turborepo |
| IaC (future)       | Pulumi (TypeScript)                                | Phase 2, replaces Compose for prod                                               |
| Auth               | JWT (access + refresh), Google OIDC + Apple ID     | Custom implementation, `jose` library for token handling                         |
