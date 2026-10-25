# GoalLift research notes

Reference product: a leading strategy-to-goals OKR platform (studied from its public marketing site and public help centre only). No account was created, no sign-in was attempted, and no text, icons, illustrations or screenshots were copied. The notes below paraphrase behaviour. GoalLift's UI uses its own labels and copy and never names the reference product.

Captured with REA `capture_browser_scenario` (headless Chrome, accessibility snapshots), 26 Oct 2026.
Evidence IDs: `ev_f15abd01…` (home page), `ev_923d5d1b…` (help centre + search), `ev_09c56b94…` (help-centre searches), plus two larger captures saved to the session's tool-results directory (goal types, statuses, update frequency, alignment, progress drivers, individual goals, organising goals, cadences, sub-teams).

## Sources

| Topic | URL |
|---|---|
| Product home (strategy map demo, goal types) | https://www.perdoo.com/ |
| Goal types | https://support.perdoo.com/en/articles/14092782-goals-types-in-perdoo |
| Goal statuses | https://support.perdoo.com/en/articles/4640875-goal-statuses |
| Update frequency / "update due" | https://support.perdoo.com/en/articles/6705304-update-frequency-per-goal |
| Aligning OKRs | https://support.perdoo.com/en/articles/5391069-aligning-okrs |
| Progress drivers for Objectives | https://support.perdoo.com/en/articles/4898961-progress-drivers-for-objectives |
| Individual goals | https://support.perdoo.com/en/articles/5356295-individual-goals |
| Organising goals (team / lead / timeframe) | https://support.perdoo.com/en/articles/4342501-organizing-your-goals-in-perdoo |
| Cadences and timeframes | https://support.perdoo.com/en/articles/4515060-cadences-and-timeframes |
| Sub-teams | https://support.perdoo.com/en/articles/4396290-sub-teams |
| Search index pages used to find the above | https://support.perdoo.com/en/?q=goal+types (and similar `?q=` searches) |

## Domain model observed

**Goal types (a strategy pyramid).**
- *Ultimate goal*: the mission / vision statement at the top of the map.
- *Strategic pillars*: a few "how we win" choices under the ultimate goal.
- *Objectives*: time-bound "change" goals, the destination ("where do we want to go?").
- *Key results*: measurable outcomes that show how close an objective is ("what results get us there?"). Outcome, not output.
- *Initiatives*: projects / work that help achieve a key result (or keep a KPI healthy), or standalone work. By default they carry **zero weight** in objective progress.
- *KPIs*: ongoing "health" metrics with no timeframe (stay above / below a threshold).

**Ownership.** Each goal is owned by exactly one *team* (where a team can be the company, a department, a team or a sub-team; teams nest to any depth) and led by exactly one *person* (the lead). Individual goals are allowed either without a team or under a special "individuals" team. Team pages list goals the team owns; user pages list goals the person leads; both grouped by timeframe.

**Alignment.** An objective aligns to **one** parent only (deliberately, for clarity): a strategic pillar, another objective, a specific key result (or initiative) of an objective, or a KPI. Alignment is optional but recommended. Typical patterns: company objectives support a pillar; department/team objectives support a company or department objective; sub-team objectives align to the department; annual company objectives with quarterly team objectives beneath them. Alignment can be changed later ("re-align").

**Progress rollup ("progress drivers").** Objective progress is computed, never typed: from key results (default), from aligned child objectives, or both. Items are equally weighted by default; weights can be customised and initiatives can optionally be given weight. A metric key result's progress comes from its metric (start → target, current value). Negative progress counts as 0.

**Statuses / confidence.** On track, needs attention, off track, accomplished (manual only), no status. The lead sets status during a progress update (last status pre-filled), or it can be computed from value vs. expected progress by date. An objective's status is the **weakest** status among its key results (or aligned objectives).

**Check-in cadence.** Each goal has an update frequency (weekly by default for quarterly OKRs). After 7 days without an update (weekly), the goal shows as "update due" / outdated in lists and dashboards.

**Timeframes.** A cadence is a series of timeframes (annual, quarterly…). The recommended setup is annual company goals + quarterly team goals. OKRs and their initiatives belong to one timeframe; KPIs have none.

**Key screens.** Strategy map (top-down tree from ultimate goal → pillars → objectives → key results, with team chip and % on each card, collapsible), a cascade / list view with filters (stage, goal type, status, team, lead, timeframe), team and user pages, goal detail panel (progress driver, alignment, aligned goals, update history), dashboards (performance by timeframe, engagement / outdated goals).

## How GoalLift maps company → department → team → personal

GoalLift keeps the same objective / key result / initiative core and alignment-to-one-parent rule, but makes the four levels **explicit and strict** instead of a free-form team tree:

| GoalLift level | Owner | Typical timeframe | Aligns to (exactly one level up) |
|---|---|---|---|
| Company 公司 | the organisation | annual or quarter | nothing (top) |
| Department 部门 | a department | quarter | a company objective or one of its key results |
| Team 团队 | a team (belongs to a department) | quarter | a department objective or key result (own department listed first) |
| Personal 个人 | a person | quarter | a team objective or key result (own team listed first) |

Design choices (ours, not the reference's):
- **Level is a first-class field.** Since the v2 redesign the level is conveyed by *where you are* (sidebar unit, breadcrumb) plus a small text label and one accent colour per level (walnut / bronze / sage-forest / gold); see "Mooncamp UX" below. The alignment picker only offers parents one level up, in an overlapping timeframe (same quarter, or the annual timeframe containing it).
- Strategic pillars and KPIs are out of scope for v1; annual company objectives play the "strategy" role and departments cascade from them.
- Progress driver per objective: key results (default), aligned objectives, or both, equal weight by default with optional per-KR weight; initiatives never count (kept as the "what we'll do" list).
- Confidence on check-in: on track / at risk / off track; objective status = weakest KR. "Needs check-in" after 7 days without one.
- Quarter close: an objective can be closed with a 0–1.0 score and a short reflection.
- A rule-based **KR quality helper** (no API) nudges outcome-style key results: flags missing numbers/targets, activity verbs (launch, build, do…), vague verbs without a number, and start = target.
- One local workspace in localStorage with JSON export / import; seeded with a fictional coffee roaster, "Juniper Roasters" (2 departments, 4 teams, 9 people, 13 objectives). Storage key is `goallift-workspace-v2`, so v1 test data is not carried over.

## Mooncamp UX (second reference, for the v2 information architecture)

Why: users found v1 "very messy" (every level's cards on one long filtered page). Mooncamp is one of the best-rated OKR tools for clarity (G2 ~4.8) and has an explicit company → team → individual hierarchy, so v2 follows its *navigation and layout patterns*. Studied from public pages only: marketing pages and the public help centre (served as Markdown via its docs index). No account, no sign-in, no trial. Nothing was copied: GoalLift uses its own labels, copy, icons and visuals and never names the reference in the UI.

Captured 26 Oct 2026 with REA `capture_browser_scenario` (headless Chrome, accessibility snapshots): evidence `ev_c83f574a…` (home page: product tabs "Goals & OKRs / Dashboards / Check-ins / Strategy Maps"), `ev_43c78e84…` (check-ins and dashboards product pages). Help-centre articles were read from the public docs index.

| Topic | URL |
|---|---|
| Home / product tour tabs | https://mooncamp.com/ |
| Goals & OKRs product page (views: table, list, network, tree) | https://mooncamp.com/goals-and-okrs |
| Check-ins product page | https://mooncamp.com/check-ins |
| Dashboards product page | https://mooncamp.com/dashboards |
| Docs index | https://mooncamp.com/docs/llms.txt |
| Sidebar | https://mooncamp.com/docs/sidebar |
| Goals overview (company / team / individual) | https://mooncamp.com/docs/goals-overview |
| Teamspaces (nested teams) | https://mooncamp.com/docs/teamspaces |
| Views (cascade, list, tree, network) | https://mooncamp.com/docs/views |
| Goal tree | https://mooncamp.com/docs/goal-tree |
| Cycles and the cycle picker | https://mooncamp.com/docs/cycles |
| Progress measurement (aggregation) | https://mooncamp.com/docs/progress-measurement |
| Updating goals | https://mooncamp.com/docs/updating-goals |
| Goal statuses | https://mooncamp.com/docs/goal-statuses |
| Progress dashboard | https://mooncamp.com/docs/progress-dashboard |
| Check-ins | https://mooncamp.com/docs/check-ins |
| Adding key results / sub-goals | https://mooncamp.com/docs/adding-subgoals |

**Navigation model.** A persistent left sidebar: search / home / inbox / settings at the top; then *spaces*: the company space plus the teamspaces you belong to (teams nest via parent teams, so the org chart is the navigation); then tools (goals, check-ins, dashboards); trash and help at the bottom. Picking a space shows that unit's goals only ("on a teamspace, goals are pre-filtered to show the respective team's goals"). The personal home page shows the goals you own.

**OKR list layout.** The default goal view is a *cascade*: a nested table where an objective row expands to its key results and to aligned sub-goals, with inline progress, owner and status. Alternatives are a flat list, a tree and a network view; views can be filtered and saved, but the unit page itself is already scoped, so filters are secondary.

**Levels / teams.** Level is implicit in the space you are in (company space vs a teamspace vs your home), not a badge on every row. Team owners, colours and icons are set once in team settings.

**Tree / map view.** A top-down tree of goal cards connected by branches; each card shows the essentials; per-card expand / collapse (a counter of hidden children), "expand next level" and expand / collapse all; zoom and pan; isolated (unaligned) goals are easy to spot; card size adjustable.

**Check-in flow.** Progress is updated in three places: inline from the cascade row, from the progress bar on the goal detail, or in a (weekly) check-in. An update records the new value and a status; the system suggests a status from progress versus time elapsed. Check-ins add comments and form a feed / history per goal.

**Progress display.** Progress bar + percentage on every row; objectives aggregate the average of their sub-items by default (key results converted to 0–100%), optionally weighted; statuses are colour-coded (on track / progressing / off track, plus closed statuses).

**Cycle switcher.** A cycle picker in the top-right of every view; the choice applies app-wide (lists and dashboards). Goals belong to a cycle.

**Dashboard.** A progress dashboard: overall progress versus expected, goals at risk, counts by type, and progress grouped by team or member, all scoped by the cycle filter.

### What GoalLift v2 adopts (own UI, own words)

| Pattern | GoalLift v2 |
|---|---|
| Org-shaped sidebar | Sidebar: Overview, My OKRs, OKR tree; then the organisation: Company → each Department → its Teams (with a quiet % per unit); settings and data at the bottom. Becomes a drawer below 900px. |
| Unit page shows only its goals | Company / department / team / person pages list only objectives owned by that unit, with a breadcrumb, one level label, unit progress, and links to the units one level down (departments, teams or people). |
| Cascade rows | Objective rows (status dot, title, lead avatar, progress bar + %). A caret expands KR rows (title, current / target, progress, last check-in, Check in) and a collapsible **Contributing OKRs** group with the aligned objectives from the level below, which expand the same way: company → department → team → person drill-down in place. |
| Tree | OKR tree: top-down cards with level shown as a thin accent line and a small label, per-branch fold with hidden-count, expand / collapse all, zoom (auto-fits on open); unaligned objectives listed separately. |
| Check-in | Side panel per KR: new value (with live progress preview), confidence, comment; history below. |
| Aggregation | New default progress driver "key results and contributing objectives", so a personal check-in visibly rolls up to the team, department and company objective. |
| Cycle picker | Cycle switcher in the header, applied to every page and the overview. |
| Progress dashboard | Compact Overview: overall %, progress by level and by department, at-risk key results, check-ins due. |

Not adopted: saved views, custom statuses, plans / drafts, integrations, inline editing of values in the row (GoalLift keeps one explicit check-in path so history stays complete).
