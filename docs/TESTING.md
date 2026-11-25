# Testing

## Automated tests

```bash
cd backend && pytest -q          # 31 tests: engine cases + full API (auth, RBAC, dashboard, review audit, reports, alerts)
cd frontend && npm run test:engine   # the browser demo engine must match the same cases
cd frontend && npx tsc --noEmit      # type check
```

### What is covered

| Area | Test |
|---|---|
| Spec examples | `tests/engine_cases.json`: *"Okay naman … pero sobrang tagal ng response"* → negative / frustration / Response Time; sarcasm example → negative + possible sarcasm; Filipino positives/negatives; neutral inquiry |
| Negation & contrast | *"Hindi mabagal, mabilis nga eh"* → positive; *"Hindi maganda…"* → negative |
| Priority ≠ sentiment | allergic reaction → critical; refund follow-up → high; suggestion → medium; inquiry → low |
| Score vs confidence | separate ranges; configurable thresholds change labels |
| Data-driven dashboard | KPI totals equal the feedback list count; sentiment filter equals the KPI count |
| Duplicates | identical manual entry → 409 |
| Human review | correction stored with original AI value, reviewer and time; audit log entry written |
| RBAC | Viewer can see the dashboard but not feedback, users or settings |
| Security | weak passwords rejected; invalid thresholds rejected; Claude cannot be enabled without a key |
| Integrations | platforms report `not_connected` with the missing variables; sync adds nothing |
| Insights | summary contains the real totals and the sample-data notice |
| Reports | PDF, Excel and CSV generated and downloadable; platform report requires a platform |
| Notifications | running alert checks twice creates no duplicates |

## End-to-end check (performed before release)

A browser run (Playwright, Edge) signed in, generated an executive summary, opened and confirmed a feedback
analysis, added manual feedback, used the sentiment playground (sarcasm detected), generated insights,
downloaded a PDF report, checked integrations, created a user, saved settings, verified the audit log and
notifications, and confirmed every page fits a 390 px phone screen with no JavaScript errors.

## Manual test checklist for a new deployment

1. Sign in as Super Admin; change the temporary password.
2. Create an Analyst and a Viewer; confirm each sees only its allowed pages.
3. Add 3 manual feedback items (positive, negative Taglish, a safety concern) and check the reasons and priorities.
4. Correct one classification and confirm it appears in the review history and audit log.
5. Generate each report type in each format.
6. Connect one platform (see the deployment guide), run **Sync now**, and confirm items appear without the sample badge.
