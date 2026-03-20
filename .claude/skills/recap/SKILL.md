---
name: recap
description: Session-start recap — summarizes recent changes and suggests next steps
allowed-tools: Read, Grep, Glob, Bash
---

# /recap — Session Start Summary

Generate a "Previously on Heim..." summary to orient the user at the start of a work session.

## Steps

1. **Find the last session boundary:** `git log -1 --format=%h -- docs/recap.md`. Use this as the starting point for the git log range. If `docs/recap.md` has never been committed, fall back to a 2-week lookback using `git log --since="2 weeks ago"`.

   Then **read `docs/recap.md`** for prior session context.

2. **Gather git history** for the range `<last-commit>..HEAD`:
   - `git log --oneline <last-commit>..HEAD` — commit list
   - `git diff --stat <last-commit>..HEAD` — files changed summary
   - `git diff --name-only <last-commit>..HEAD -- docs/` — doc changes

   If `last-commit` equals HEAD (no new commits), say so and skip to step 4.

3. **Read `docs/plan.md`** for roadmap context and next milestones.

4. **Run tests** with `yarn turbo test` to check current health.

5. **Print the structured summary** to the terminal:

```
## Previously on Heim...

### What changed
<!-- Group commits by scope: domain, api, web, infra, docs, repo -->
<!-- For each group, list commits as bullet points -->
<!-- Include a files-changed summary -->

### Current state
<!-- Test results: pass/fail count -->
<!-- Where things left off based on recap.md -->

### Suggested next steps
<!-- Derive from plan.md and any incomplete work visible in recap.md or recent commits -->
```

## Rules

- Do NOT modify any files. This skill is read-only.
- Keep the output concise — this is a quick orientation, not a full changelog.
- If there are no commits since the last recap, say "No new commits since last session" and focus on current state and next steps.
