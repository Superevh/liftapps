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
- **Level is a first-class field**, with a fixed colour, badge and indent per level (walnut / bronze / forest / gold) so levels can never blur. The alignment picker only offers parents one level up, in an overlapping timeframe (same quarter, or the annual timeframe containing it).
- Strategic pillars and KPIs are out of scope for v1; annual company objectives play the "strategy" role and departments cascade from them.
- Progress driver per objective: key results (default), aligned objectives, or both, equal weight by default with optional per-KR weight; initiatives never count (kept as the "what we'll do" list).
- Confidence on check-in: on track / at risk / off track; objective status = weakest KR. "Needs check-in" after 7 days without one.
- Quarter close: an objective can be closed with a 0–1.0 score and a short reflection.
- A rule-based **KR quality helper** (no API) nudges outcome-style key results: flags missing numbers/targets, activity verbs (launch, build, do…), vague verbs without a number, and start = target.
- One local workspace in localStorage with JSON export / import; seeded with a fictional "Example Co".
