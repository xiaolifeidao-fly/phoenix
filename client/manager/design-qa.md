# Dashboard Layout QA

- Source visual truth: `/var/folders/sh/f4sx61qs31g_zwvr_ffw68c00000gn/T/codex-clipboard-9a4db5d9-6424-478a-8ccc-e3f51064e115.png`
- Implementation target: `http://localhost:9901/suffer-web/manager-dashboard`
- Viewport: 1280 x 720 desktop
- State: blocked by the management-console login screen before dashboard data is available

**Findings**

- [P1] Visual comparison blocked
  Location: management dashboard authenticated state.
  Evidence: the local preview redirects to the login screen, so the combined 真人提交 / 真人实际 card cannot be captured with real dashboard content.
  Impact: final spacing, truncation, and responsive rendering cannot be visually confirmed in this environment.
  Fix: sign in to the local management console and recapture the dashboard at desktop and narrow widths.

**Implementation Checklist**

- [x] Place the 真人组合卡 in a third-row, half-width layout.
- [x] Add a matching 低价提交量 / 低价实际完成量 card using artificial product `15` and upstream categories `8`, `10`.
- [x] Keep separate detail and category-filter actions for the 真人 statistics.
- [x] Verify TypeScript compilation and diff whitespace checks.

**Follow-up Polish**

- Verify the populated card on desktop and mobile after an authenticated session is available.

final result: blocked
