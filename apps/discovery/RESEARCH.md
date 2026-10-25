# DiscoveryLift research: gap list

Captured 26 Oct 2026 with REA `capture_browser_scenario` (headless Chrome, accessibility snapshots) on public pages only. No sign-in, no account. Only behaviour was noted; no text, icons, illustrations or screenshots were copied.

## Sources

- https://www.atlassian.com/software/jira/product-discovery/features (product feature page)
- https://support.atlassian.com/jira-product-discovery/resources/ (documentation index)
- https://support.atlassian.com/jira-product-discovery/docs/what-are-insights/
- https://support.atlassian.com/jira-product-discovery/docs/jira-product-discovery-fields-reference/
- https://support.atlassian.com/jira-product-discovery/docs/expression-based-formulas/
- https://support.atlassian.com/jira-product-discovery/docs/comment-and-share-views/
- Two guessed doc URLs returned 404 and were not used: `/docs/what-are-fields/`, `/docs/create-formula-fields/`.

## What the reference product does

- **Ideas and insights.** Ideas hold the problem and possible solution. Insights are evidence attached to an idea: a description, an optional link to the source (ticket, deal, dashboard), a **rating of how strongly it supports the idea**, and labels. An aggregate field can add up the insight ratings so it can be used to prioritise.
- **Field types.** Standard: checkbox, date, hyperlink, single and multi select (**each option can carry a weight**), number, person, rating (1–5), short text (255 characters), slider (1–100). Dynamic: comments count, **votes (with a per-person vote allowance)**, insights count, delivery progress, custom formula. System: status, created and updated, labels, linked items, delivery status.
- **Custom formulas.** Three kinds: roll-up (sum of fields), weighted score (each input scaled 0–100 across all ideas, then weighted; negative weights lower the score), and a hand-written expression with `{Field name}`, numbers and + − × ÷.
- **Views.** List, board, matrix and timeline, each with filter, sort and grouping (board columns and swimlanes), chosen visible fields and a short description of the view.
- **Sharing.** Views can be published as read-only pages for stakeholders, commented on, shared inside the team and exported (CSV and spreadsheets).
- **Ideas.** Description templates, comments, merging, idea types and hierarchy, archiving.
- **Delivery.** Ideas link to build tickets. Progress and status roll up from those tickets.
- **Engagement.** Teammates react to, comment on and vote for ideas.

## Gaps in the original prototype (~/jpd-clone) and what this version does

| Gap | Status |
|---|---|
| Insight rating, labels and source link; insight impact field | **Done.** Each insight has a 1–5 impact, labels and a link, and can be edited. The built-in *Insight impact* field adds up the ratings. |
| User-defined formula fields (the prototype had one hard-coded score) | **Done.** Formula fields can be a written expression (safe parser, no eval, live check and preview), a weighted score (0–100, negative weights allowed) or a sum of fields. Renaming a field updates the expressions that use it. |
| Option weights on select and multi select | **Done.** The weights feed formulas and matrix axes. |
| Missing field types: checkbox, date, link, slider, votes, comments count | **Done.** Votes have a per-person allowance and an "acting as" teammate switcher, so a team can vote in one browser. |
| Editing fields after they are created | **Done.** Field settings let you rename, describe, manage options (colour, weight, order), change the vote allowance and edit formulas. Deleting a field removes it from views and filters. |
| Grouping by person or checkbox (only selects before) | **Done** for list groups, board columns and swimlanes, and timeline groups. |
| Number-range filters (categories only before) | **Done.** Min and max on any numeric or computed field. |
| Idea templates | **Done.** Three starter templates, editable in Project settings. You can pick one in the create dialog or from an empty description. |
| Archiving | **Done.** Archive or restore from the idea menu. An *Archived ideas* page lists them, and archived ideas are left out of every view and of weighted-score scaling. |
| Several projects, export and import | **Done.** Projects are stored in localStorage. You can export a project as JSON, import one as a new project, export any view as CSV, and duplicate or delete views. |
| Published view for stakeholders | **Improved.** Read-only roadmap page with a project banner, the view's description, local filter and sort, and read-only idea details (overview, insights, delivery). |
| Delivery tickets | **Kept.** Tickets are added by hand with a status; progress rolls up. Each ticket can now have its own key. |

## Left as gaps (out of scope for a browser-only app)

- Real integrations: linking to a live issue tracker, chat apps, a browser extension that captures insights, imports from other tools.
- Accounts, permissions, real-time collaboration, and published links that work on other devices. Publishing is local; to share a project, export it.
- Comments on views, @mentions, emoji reactions, notifications and automation rules.
- Merging ideas, idea types and hierarchy, and copying insights between ideas.
- Delivery progress weighted by story points, and a separate delivery status field.
- Conditional colour formatting for number and slider fields.
- Global fields shared across projects.
- Advanced sorting on more than one field.
