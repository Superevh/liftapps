// Tiny, safe expression language for formula fields:  numbers, {Field name}, + - * /, parentheses.
// No eval. Parse once into an AST, then evaluate with a field resolver.

export function tokenize(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j++
      const n = Number(src.slice(i, j))
      if (Number.isNaN(n)) throw new Error(`bad number "${src.slice(i, j)}"`)
      out.push({ t: 'num', v: n }); i = j; continue
    }
    if (c === '{') {
      const j = src.indexOf('}', i)
      if (j < 0) throw new Error('missing }')
      out.push({ t: 'field', v: src.slice(i + 1, j).trim() }); i = j + 1; continue
    }
    if ('+-*/()'.includes(c)) { out.push({ t: c }); i++; continue }
    throw new Error(`unexpected "${c}"`)
  }
  return out
}

export function parse(src) {
  const toks = tokenize(src)
  let p = 0
  const peek = () => toks[p]?.t
  const expr = () => {
    let left = term()
    while (peek() === '+' || peek() === '-') { const op = toks[p++].t; left = { op, a: left, b: term() } }
    return left
  }
  const term = () => {
    let left = unary()
    while (peek() === '*' || peek() === '/') { const op = toks[p++].t; left = { op, a: left, b: unary() } }
    return left
  }
  const unary = () => {
    if (peek() === '-') { p++; return { op: 'neg', a: unary() } }
    return atom()
  }
  const atom = () => {
    const tk = toks[p++]
    if (!tk) throw new Error('unexpected end')
    if (tk.t === 'num') return { num: tk.v }
    if (tk.t === 'field') return { field: tk.v }
    if (tk.t === '(') { const e = expr(); if (toks[p++]?.t !== ')') throw new Error('missing )'); return e }
    throw new Error(`unexpected "${tk.t}"`)
  }
  if (!toks.length) throw new Error('empty')
  const ast = expr()
  if (p < toks.length) throw new Error(`unexpected "${toks[p].t}"`)
  return ast
}

// Returns null when any referenced value is missing or a division by zero happens.
export function evaluate(ast, resolve) {
  if ('num' in ast) return ast.num
  if ('field' in ast) { const v = resolve(ast.field); return v == null || Number.isNaN(v) ? null : v }
  if (ast.op === 'neg') { const a = evaluate(ast.a, resolve); return a == null ? null : -a }
  const a = evaluate(ast.a, resolve)
  const b = evaluate(ast.b, resolve)
  if (a == null || b == null) return null
  switch (ast.op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b === 0 ? null : a / b
    default: return null
  }
}

export function fieldRefs(ast, out = []) {
  if (!ast) return out
  if ('field' in ast) out.push(ast.field)
  if (ast.a) fieldRefs(ast.a, out)
  if (ast.b) fieldRefs(ast.b, out)
  return out
}

// Validate an expression against known field names. Returns { ok, error }.
export function check(src, names) {
  try {
    const ast = parse(src)
    const missing = fieldRefs(ast).filter(n => !names.some(x => x.toLowerCase() === n.toLowerCase()))
    if (missing.length) return { ok: false, error: { unknown: missing } }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: { syntax: e.message } }
  }
}
