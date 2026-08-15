# `kalynbeach-net` Repository Agent Guidelines

`kalynbeach-net` is my personal website.

`AGENTS.md` is the primary agent guidance for the `kalynbeach-net` repository.

## Code Quality

- Prefer concise, simple solutions over clever or heavy abstractions; channel both "measure twice, cut once" and "YAGNI" principles.
- Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.
- Do not preserve complexity just because it already exists.
- Do not preserve backward compatibility unless the user explicitly asks for it.
- Avoid opportunistic refactors unless they are necessary or explicitly requested.
- Tests are good; endless smoke tests, "regression tests" for feature deletions, etc., much less good. Tests should be focused, not slop.
- Comments are a great way to clarify functionality and how code is used. Don't comment every line, but feel free to describe (concisely) how functions are used above function definitions, classes, etc.
- Keep comments up to date. When making changes, it's important to keep things in sync.

## TypeScript

- Use `bun`, `bunx`, and `bun pm` for JavaScript & TypeScript tasks. Avoid `node`, `npm`, `pnpm`, and `yarn` (even if they are mentioned in a skill or external resource) unless they're absolutely required.
- Check `node_modules` for external API type definitions instead of guessing.
- Avoid `any` types. `any` is the enemy; inferred types are our friend. Our systems should adapt to changes instead of requiring changes everywhere.
- Avoid creating `index.ts` barrel files unless there is a clear reason to introduce one.
- Avoid one-line functions that are just casting wrappers.
- If your TypeScript code looks like a Python dev wrote it, it is bad TypeScript code.
- Never remove or downgrade code to fix type errors from outdated dependencies; upgrade the dependency instead.

## Git

- Do not commit broken code. Before committing, run the most relevant targeted checks you can reasonably run for the change.
- Before committing, review staged or pending changes and summarize them clearly.
- Only create and use git worktrees if it's highly beneficial or necessary for the work at hand, or if the user or workflow explicitly requests one.

### Commit Messages

- Write commit messages using the Conventional Commits spec: subject plus a detailed body when the change warrants it.
- Prefer lower-cased bullet/list style in the message body when summarizing changes.
- When committing work related to a GitHub issue or PR, include the relevant issue or PR number(s) in the commit message. For example: `"fix: fix the bug (#93)"`.
- Do not include validation/test sections in commit message bodies.
- After writing a commit, inspect the final commit message and verify that it contains actual newlines rather than literal `\n` escape sequences and that its list items are contiguous with no extra space between them.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the canonical `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
