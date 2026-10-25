
// The server keeps, per board, a snapshot plus an ordered log of actions. Every client folds the
// same log through the same reducer, so they all converge on the same board.
//
// Interface (all async except subscribe):
//   createBoard(id, snapshot, ownerKey)
//   getBoards(ids)              -> [{ id, snapshot, seq, events: [{ seq, action }] }]
//   append(id, action)          -> seq assigned by the server
//   eventsSince(id, afterSeq)   -> [{ seq, action }]
//   saveSnapshot(id, seq, snapshot)
//   deleteBoard(id, ownerKey)
//   subscribe(id, onEvent, onReady) -> { send({ seq, action }), close() }
//
//
// Lift Apps use the same anonymous document backend as RetroLift (no sign-in).
export function createBackend() {
  const env = import.meta.env
  // VITE_BACKEND=mock wins so local testing never touches the real database.
  if (env.VITE_BACKEND === 'mock') return mockBackend()
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return supabaseBackend(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  return null
}

function supabaseBackend(url, key) {
  // Anonymous only: no session is kept or read from the URL.
  // The client library loads on first use, so app home screens stay small.
  let client = null
  const getSb = () => (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lift-kit-auth' } })))
  const rpc = async (fn, args) => {
    const sb = await getSb()
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data
  }
  return {
    kind: 'supabase',
    createBoard: (id, snapshot, ownerKey) => rpc('create_board', { p_id: id, p_snapshot: snapshot, p_owner_key: ownerKey }),
    getBoards: ids => rpc('get_boards', { p_ids: ids }),
    append: (id, action) => rpc('append_event', { p_board: id, p_action: action }),
    eventsSince: (id, after) => rpc('events_since', { p_board: id, p_after: after }),
    saveSnapshot: (id, seq, snapshot) => rpc('save_snapshot', { p_board: id, p_seq: seq, p_snapshot: snapshot }),
    deleteBoard: (id, ownerKey) => rpc('delete_board', { p_id: id, p_owner_key: ownerKey }),
    auth: null,
    subscribe(id, onEvent, onReady) {
      let closed = false
      const chP = getSb().then(sb => {
        if (closed) return null
        const ch = sb.channel(`board:${id}`, { config: { broadcast: { self: false } } })
        ch.on('broadcast', { event: 'evt' }, ({ payload }) => onEvent(payload))
          .subscribe(status => { if (status === 'SUBSCRIBED') onReady() })
        return { sb, ch }
      })
      return {
        // Before the socket has joined, deliver over HTTP; the server log is the source of truth either way.
        send: payload => chP.then(x => x && (x.ch.state === 'joined' ? x.ch.send({ type: 'broadcast', event: 'evt', payload }) : x.ch.httpSend('evt', payload))).catch(() => {}),
        close: () => { closed = true; chP.then(x => x && x.sb.removeChannel(x.ch)).catch(() => {}) },
      }
    },
  }
}

// A stand-in server for local development (VITE_BACKEND=mock): the "database" lives in
// localStorage, Web Locks serialise writes across tabs and BroadcastChannel plays Realtime.
function mockBackend() {
  const KEY = 'lift-kit-mock-server'
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? { boards: {} } } catch { return { boards: {} } } }
  const write = db => localStorage.setItem(KEY, JSON.stringify(db))
  const latency = () => new Promise(r => setTimeout(r, 40 + Math.random() * 80))
  const tx = async fn => { await latency(); return navigator.locks.request(KEY, () => { const db = read(); const out = fn(db); write(db); return out }) }
  const eventsAfter = (b, after) => b.events.filter(e => e.seq > after)
  return {
    kind: 'mock',
    auth: null,
    createBoard: (id, snapshot, ownerKey) => tx(db => { db.boards[id] = { snapshot, seq: 0, head: 0, ownerKey, events: [] } }),
    getBoards: ids => tx(db => ids.filter(id => db.boards[id]).map(id => {
      const b = db.boards[id]
      return { id, snapshot: b.snapshot, seq: b.seq, events: eventsAfter(b, b.seq) }
    })),
    append: (id, action) => tx(db => {
      const b = db.boards[id]
      if (!b) throw new Error('board not found')
      b.head += 1
      b.events.push({ seq: b.head, action })
      return b.head
    }),
    eventsSince: (id, after) => tx(db => db.boards[id] ? eventsAfter(db.boards[id], after) : []),
    saveSnapshot: (id, seq, snapshot) => tx(db => {
      const b = db.boards[id]
      if (b && seq > b.seq && seq <= b.head) Object.assign(b, { seq, snapshot })
    }),
    deleteBoard: (id, ownerKey) => tx(db => { if (db.boards[id]?.ownerKey === ownerKey) delete db.boards[id] }),
    subscribe(id, onEvent, onReady) {
      const ch = new BroadcastChannel(`lift-kit-mock:${id}`)
      ch.onmessage = e => onEvent(e.data)
      setTimeout(onReady, 0)
      return { send: payload => ch.postMessage(payload), close: () => ch.close() }
    },
  }
}
