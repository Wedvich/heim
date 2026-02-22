# Heim

## Principles

- Good developer experience and ergonomics is a very high priority.

## Source Control (Git)

### Commit

- Format: type(scope): description
- Types: feat, fix, refactor, test, docs, chore, ci
- Scopes: domain, api, web, infra, repo
- Example: feat(domain): add User aggregate with identity linking

Commit messages are enforced by commitlint.

## Development

Tasks are orchestrated with Turborepo. Run from the repo root:

    yarn turbo build
    yarn turbo dev
    yarn turbo lint
    yarn turbo test
    yarn turbo test:watch
    yarn turbo typecheck

Filter to a specific package with `-F`:

    yarn turbo build -F @heim/api
    yarn turbo test -F @heim/domain

### Infrastructure

    yarn turbo dev                                 # Start everything (Postgres + API + Web)
    yarn turbo dev -F @heim/api...                 # API + Postgres only
    yarn turbo dev -F @heim/web                    # Web only (against remote API)
    docker compose -f packages/infra/compose.yml down -v   # Wipe database

## Project Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/auth.md](docs/auth.md)
- [docs/database.md](docs/database.md)
- [docs/overview.md](docs/overview.md)
- [docs/plan.md](docs/plan.md)
- [docs/tech-stack.md](docs/tech-stack.md)
- [docs/testing.md](docs/testing.md)
