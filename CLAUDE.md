# Heim

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

## Project Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/auth.md](docs/auth.md)
- [docs/overview.md](docs/overview.md)
- [docs/plan.md](docs/plan.md)
- [docs/tech-stack.md](docs/tech-stack.md)
- [docs/testing.md](docs/testing.md)
