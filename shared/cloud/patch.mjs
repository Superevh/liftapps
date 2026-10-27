// Keyed JSON patches: what changed between two versions of a plain-JSON state, written as small ops
// that still apply cleanly on top of someone else's concurrent edits. Arrays whose items all carry a
// unique `id` are compared by id (insert / remove / reorder), so two people adding objectives at the
// same time both keep theirs. Everything else is replaced whole: last writer wins per field.
//
//   ['s', path, value]           set a value (object key, or the whole state when path is [])
//   ['d', path]                  delete an object key
//   ['i', path, item, afterId]   insert an item into a keyed array after afterId (null = at the start)
//   ['r', path, id]              remove an item from a keyed array
//   ['o', path, ids]             reorder a keyed array
//
// A path is a list of segments: a string key, or { id } for an item of a keyed array. Ops whose
// path no longer exists (someone deleted the parent meanwhile) are skipped.

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasId = x => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number')
const keyedList = a => a.every(hasId) && new Set(a.map(x => x.id)).size === a.length
const keyedPair = (a, b) => Array.isArray(a) && Array.isArray(b) && (a.length > 0 || b.length > 0) && keyedList(a) && keyedList(b)

export function same(a, b) {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]))
}

export function diff(a, b, path = [], out = []) {
  if (a === b) return out
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) if (!(k in b) && a[k] !== undefined) out.push(['d', [...path, k]])
    for (const k of Object.keys(b)) {
      if (b[k] === undefined) { if (k in a && a[k] !== undefined) out.push(['d', [...path, k]]); continue }
      if (!(k in a) || a[k] === undefined) out.push(['s', [...path, k], b[k]])
      else diff(a[k], b[k], [...path, k], out)
    }
    return out
  }
  if (keyedPair(a, b)) {
    const inA = new Map(a.map(x => [x.id, x]))
    const inB = new Map(b.map(x => [x.id, x]))
    for (const x of a) if (!inB.has(x.id)) out.push(['r', path, x.id])
    // Where the inserts and removals alone would leave things, to see if a reorder is needed too.
    const order = a.filter(x => inB.has(x.id)).map(x => x.id)
    let prev = null
    for (const x of b) {
      if (!inA.has(x.id)) {
        out.push(['i', path, x, prev])
        order.splice(prev === null ? 0 : order.indexOf(prev) + 1, 0, x.id)
      } else diff(inA.get(x.id), x, [...path, { id: x.id }], out)
      prev = x.id
    }
    if (order.some((id, i) => id !== b[i].id)) out.push(['o', path, b.map(x => x.id)])
    return out
  }
  if (!same(a, b)) out.push(['s', path, b])
  return out
}

const NOT_FOUND = Symbol('not found')

function child(container, seg) {
  if (typeof seg === 'object' && seg !== null) {
    if (!Array.isArray(container)) return NOT_FOUND
    const item = container.find(x => hasId(x) && x.id === seg.id)
    return item === undefined ? NOT_FOUND : item
  }
  if (!isObj(container) && !Array.isArray(container)) return NOT_FOUND
  return Object.prototype.hasOwnProperty.call(container, seg) ? container[seg] : NOT_FOUND
}

function withChild(container, seg, value) {
  if (typeof seg === 'object' && seg !== null) return container.map(x => (hasId(x) && x.id === seg.id ? value : x))
  if (Array.isArray(container)) { const c = container.slice(); c[seg] = value; return c }
  return { ...container, [seg]: value }
}

// Copy-on-write update of the value at `path`; returns `root` unchanged when the path is gone.
function update(root, path, fn) {
  if (!path.length) return fn(root)
  const [seg, ...rest] = path
  const cur = child(root, seg)
  if (cur === NOT_FOUND) {
    // A missing last key can still be set on an object.
    if (!rest.length && typeof seg === 'string' && isObj(root)) { const v = fn(undefined); return v === NOT_FOUND ? root : { ...root, [seg]: v } }
    return root
  }
  const next = update(cur, rest, fn)
  if (next === NOT_FOUND) {
    if (Array.isArray(root) || typeof seg !== 'string') return root
    const { [seg]: _gone, ...keep } = root
    return keep
  }
  return next === cur ? root : withChild(root, seg, next)
}

function applyOp(state, op) {
  const [kind, path] = op
  switch (kind) {
    case 's': return update(state, path, () => op[2])
    case 'd': return path.length ? update(state, path, () => NOT_FOUND) : state
    case 'i': return update(state, path, arr => {
      if (!Array.isArray(arr)) return arr === undefined ? [op[2]] : arr
      if (arr.some(x => hasId(x) && x.id === op[2].id)) return arr
      const at = op[3] === null ? 0 : arr.findIndex(x => hasId(x) && x.id === op[3]) + 1
      const c = arr.slice()
      c.splice(at === 0 && op[3] !== null ? c.length : at, 0, op[2])
      return c
    })
    case 'r': return update(state, path, arr => (Array.isArray(arr) ? arr.filter(x => !(hasId(x) && x.id === op[2])) : arr))
    case 'o': return update(state, path, arr => {
      if (!Array.isArray(arr)) return arr
      const pos = new Map(op[2].map((id, i) => [id, i]))
      return arr.map((x, i) => [x, hasId(x) && pos.has(x.id) ? pos.get(x.id) : op[2].length + i]).sort((p, q) => p[1] - q[1]).map(p => p[0])
    })
    default: return state
  }
}

export const apply = (state, ops) => ops.reduce(applyOp, state)
