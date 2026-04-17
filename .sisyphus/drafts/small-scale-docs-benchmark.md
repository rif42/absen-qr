# Draft: Small-Scale Docs Benchmark

## Requirements (confirmed)
- compare current `docs/` set against industry-standard documentation for a small-scale application
- include internet-backed research rather than repo-only opinion

## Technical Decisions
- compare against lightweight/small-team baseline rather than enterprise frameworks
- treat `docs/` as the project-facing source of truth per repository guidance
- classify the current API material as embedded API coverage, not yet a definitive standalone API reference

## Research Findings
- `docs/README.md`: documentation index only; links to PRD and implementation plan
- `docs/prd/mentor-student-qr-attendance-v1.md`: product/problem/goals/personas/requirements/success metrics/constraints are documented
- `docs/implementation/mentor-student-qr-attendance-v1-plan.md`: architecture/data model/API/UI/testing/risk/order are documented
- the implementation plan includes an `## API Surface` section with routes and brief endpoint intent, so API documentation exists inside `docs/`
- that API section is not yet definitive reference-grade because it lacks request/response schemas, auth/secret-link rules per endpoint, status/error contract, query/path param details, and concrete examples
- industry baseline from lightweight documentation guidance: README, quickstart/how-to, architecture overview, and API reference when HTTP endpoints exist
- optional-but-common maturity docs: ADRs for major tradeoffs, changelog/release notes, contributing guide, and runbook/operations notes once others operate the app
- sources consulted: Open Source Guides (`https://opensource.guide/starting-a-project`), Diátaxis (`https://diataxis.fr/`), OpenAPI spec (`https://spec.openapis.org/oas/latest.html`), ADR guidance (`https://adr.github.io/`), Keep a Changelog (`https://keepachangelog.com/en/1.1.0/`)

## Open Questions
- whether missing docs should be treated as immediate baseline gaps or later-stage maturity improvements

## Scope Boundaries
- INCLUDE: current `docs/` comparison, small-scale app documentation baseline, practical recommendations
- EXCLUDE: implementation changes outside planning artifacts, rewriting project docs
