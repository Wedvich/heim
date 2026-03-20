---
name: wrapup
description: Session-end wrapup — updates recap, plan, and docs, then commits
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
---

# /wrapup — Session End Summary

Persist what happened this session into docs and commit the result. This is the complement to `/recap` — run it at the end of a work session.

## Steps

1. **Gather session diff:**
   - Find last session boundary: `git log -1 --format=%h -- docs/recap.md`
   - `git log --oneline <boundary>..HEAD` for commit list
   - `git diff --stat <boundary>..HEAD` for scope
   - If no new commits since the boundary, tell the user and skip to step 3

2. **Update `docs/recap.md`:**
   - Demote the current "Latest" section to "Previous" (prepend "Previous: " to its heading)
   - Write a new "Latest" section summarizing: commits, new/modified files, design decisions
   - Include a "Next up" subsection derived from `docs/plan.md`
   - Remove any `<!-- last-session -->` and `<!-- last-commit -->` HTML comments if present

3. **Update `docs/plan.md`:**
   - Check off completed items (match against commits and changed files)
   - Add any new items that emerged during the session
   - Don't rewrite structure — only update checkboxes and add items

4. **Audit `docs/` against codebase:**
   - For each doc, verify key claims: file paths, type/function names, schema, env vars
   - Grep/glob to check — don't just skim
   - Fix discrepancies (renames, removals, changed schema)
   - Leave planned-but-unimplemented items alone

5. **Commit:**
   - If uncommitted non-doc changes exist, ask the user about committing those first
   - Stage all changed doc files
   - Commit with message: `docs: update plan, recap, and <other changed docs>`

## Rules

- Derive everything from git history and codebase — don't speculate.
- Keep recap sections concise but orientable.
- Preserve existing doc structure and voice.
- Ask before committing non-doc changes.
