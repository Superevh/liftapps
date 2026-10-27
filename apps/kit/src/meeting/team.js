// A team space: one shared live document (id prefix "lfms") that lists the team's meetings.
// It holds no action items. The team page loads every listed meeting and reads the actions
// from there, so each action has a single source: the meeting it was captured in (or the one
// it was carried to). The reducer is pure: time from action.at only.

const line = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '')
export const MAX_TEAM_MEETINGS = 300

export function newTeam({ id, name, owner, at }) {
  return { kind: 'meetingteam', v: 1, id, name: line(name, 60) || 'Team', createdAt: at, creatorId: owner.id, members: [], meetings: {} }
}

// The summary a meeting registers in its team: enough to list it before the meeting itself loads.
export const meetingSummary = d => ({ id: d.id, title: line(d.title, 120), date: isDate(d.date) ? d.date : '', seriesId: d.series?.id ?? d.id })

export function reduceTeam(t, a) {
  if (!t || t.kind !== 'meetingteam') return t
  switch (a.type) {
    case 'RENAME': return line(a.name, 60) ? { ...t, name: line(a.name, 60) } : t
    case 'MEMBER_ADD': {
      const names = (Array.isArray(a.names) ? a.names : [a.name]).map(n => line(n, 60)).filter(Boolean)
      const members = [...t.members]
      for (const n of names) if (!members.some(x => x.toLowerCase() === n.toLowerCase()) && members.length < 60) members.push(n)
      return { ...t, members }
    }
    case 'MEMBER_REMOVE': return { ...t, members: t.members.filter(x => x !== a.name) }
    // Idempotent: registering again only refreshes the summary (and never re-adds a removed-then-deleted id twice).
    case 'REGISTER': {
      const m = a.meeting
      if (!m?.id || !/^lfmt[a-z0-9]+$/.test(m.id)) return t
      const prev = t.meetings[m.id]
      if (!prev && Object.keys(t.meetings).length >= MAX_TEAM_MEETINGS) return t
      const next = { id: m.id, title: line(m.title, 120), date: isDate(m.date) ? m.date : '', seriesId: String(m.seriesId ?? m.id).slice(0, 40), addedAt: prev?.addedAt ?? a.at }
      if (prev && prev.title === next.title && prev.date === next.date && prev.seriesId === next.seriesId) return t
      return { ...t, meetings: { ...t.meetings, [m.id]: next } }
    }
    case 'UNREGISTER': {
      if (!t.meetings[a.id]) return t
      const meetings = { ...t.meetings }
      delete meetings[a.id]
      return { ...t, meetings }
    }
    default: return t
  }
}
