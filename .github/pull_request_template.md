## Context

Why this change, problem, or need.

## Change

What was done, with the key files or modules.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run smoke` (UI / card / export / CSS)
- [ ] Lighthouse Accessibility with no regression
- [ ] Complete keyboard flow verified
- [ ] Documentation updated

CI runs typecheck, tests, and build. `npm run smoke` and Lighthouse stay manual because they need a
browser and a local server.

## Accessibility

Impact and Lighthouse results (scores + fixed items).

## Screenshots

Before / after for any visual change (attached files, not committed).

## Risks

Side effects, rollback, points to test manually.
