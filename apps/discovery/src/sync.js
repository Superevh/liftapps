// The cloud copy of a DiscoveryLift workspace, and the way back.
//
// One cloud document holds the whole workspace: { projects: { [projectId]: project } }. It leaves out
// what belongs to this browser only: which project is open, who "me" is (and whether it was picked),
// and transient UI hints (lastView, lastField, lastCreated).
//
// Two shape changes make concurrent edits merge (see shared/cloud/patch.mjs):
//   ideas  keyed by each idea's unique `id` instead of its display key (NA-12). Two people creating an
//          idea at the same moment both pick NA-12; keyed by id both survive, and fromCloud gives the
//          later one the next free number. The renumbering is deterministic, so every browser agrees.
//   order  a list of { id } so inserts and reorders from two people merge instead of overwriting.

const LOCAL_KEYS = ['me', 'meChosen', 'lastView', 'lastField', 'lastCreated']

const cache = new WeakMap()
export function projectToCloud(p) {
  if (cache.has(p)) return cache.get(p)
  const out = {}
  for (const [k, v] of Object.entries(p)) if (!LOCAL_KEYS.includes(k) && k !== 'ideas' && k !== 'order') out[k] = v
  const ideas = {}
  for (const i of Object.values(p.ideas)) ideas[i.id] = i
  const seen = new Set()
  out.ideas = ideas
  out.order = []
  for (const k of p.order) {
    const id = p.ideas[k]?.id
    if (id && !seen.has(id)) { seen.add(id); out.order.push({ id }) }
  }
  cache.set(p, out)
  return out
}

const pcache = new WeakMap()
export function toCloud(ws) {
  if (pcache.has(ws.projects)) return pcache.get(ws.projects)
  const projects = {}
  for (const [id, p] of Object.entries(ws.projects)) projects[id] = projectToCloud(p)
  const out = { projects }
  pcache.set(ws.projects, out)
  return out
}

const num = key => { const m = /-(\d+)$/.exec(key ?? ''); return m ? +m[1] : 0 }
const validCloud = p => p && typeof p === 'object' && p.space && Array.isArray(p.fields) && p.ideas && typeof p.ideas === 'object' && Array.isArray(p.views) && Array.isArray(p.users) && p.users.length > 0

// A cloud project back in the app's shape, with this browser's own bits from `local` (may be undefined).
export function projectFromCloud(id, cp, local, chosenHint) {
  // Oldest first, so the idea that took a key first keeps it.
  const list = Object.entries(cp.ideas).map(([iid, i]) => (i.id === iid ? i : { ...i, id: iid }))
  list.sort((a, b) => (a.created ?? 0) - (b.created ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  let next = Math.max(cp.nextNum || 1, ...list.map(i => num(i.key) + 1))
  const ideas = {}
  const keyOf = {}
  for (let i of list) {
    if (!i.key || ideas[i.key]) {
      let key
      do key = `${cp.space.key}-${next++}`; while (ideas[key] || list.some(x => x.key === key))
      i = { ...i, key }
    }
    ideas[i.key] = i
    keyOf[i.id] = i.key
  }
  const order = []
  const placed = new Set()
  for (const o of Array.isArray(cp.order) ? cp.order : []) {
    const k = keyOf[o?.id]
    if (k && !placed.has(k)) { placed.add(k); order.push(k) }
  }
  for (const i of list) if (!placed.has(i.key)) order.push(i.key)

  const { order: _o, ideas: _i, ...rest } = cp
  const me = local && cp.users.some(u => u.id === local.me) ? local.me : cp.users[0].id
  const out = { ...rest, id, ideas, order, nextNum: next, me, meChosen: local?.meChosen ?? chosenHint === id }
  for (const k of ['lastView', 'lastField', 'lastCreated']) if (local?.[k] !== undefined) out[k] = local[k]
  return out
}

// The cloud document merged into the current workspace (keeps the open project when it still exists).
export function fromCloud(ws, data, chosenHint) {
  const projects = {}
  for (const [id, cp] of Object.entries(data?.projects ?? {})) if (validCloud(cp)) projects[id] = projectFromCloud(id, cp, ws.projects[id], chosenHint)
  const ids = Object.keys(projects)
  if (!ids.length) return null
  return { ...ws, current: projects[ws.current] ? ws.current : ids[0], projects }
}

// Name shown in the workspace switcher.
export function workspaceName(data) {
  const names = Object.values(data?.projects ?? {}).map(p => p.space?.name?.trim()).filter(Boolean)
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0] ?? ''
}
