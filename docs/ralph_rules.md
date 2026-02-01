# Ralph Loop Rules for Railsync

## Always do this order

1. Choose the next smallest task from docs/railsync\_tasks.md (Now section)
2. Implement minimal working change
3. Run: npm run verify
4. If verify fails: fix until it passes
5. Update docs/railsync\_tasks.md (move completed tasks, split tasks if discovered too large)
6. Commit with a small message

## Constraints

* No refactors unless required to complete the selected task
* Prefer the smallest diff that makes progress
* Keep API contracts explicit (request/response types)
* Add explanation strings from rules engine early (to support UI)

## Stop condition

Only declare completion when:

* npm run verify passes
* and the selected task is checked off
