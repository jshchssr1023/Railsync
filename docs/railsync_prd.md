# Railsync PRD (North Star)

## Goal
Railsync selects the best repair shop network option for a railcar event based on:
- car inputs
- overrides
- shop capabilities
- commodity constraints
- configurable JSON rules

## Users
- Internal schedulers / fleet ops
- (Optional) customer-facing read-only view later

## Core flows
1) User enters car/event inputs in web UI
2) User selects optional overrides
3) System evaluates eligible shops + ranks them
4) UI displays results grid + explanations

## Non-goals (for now)
- Auth / SSO
- Full audit trails
- Advanced scenario planning

## Definition of Done (for the loop)
- `npm run verify` passes
- A user can submit the form and get results in the grid
- Rules can be changed in JSON without code changes
- Database seeded with minimal shops/capabilities/commodities/rules
