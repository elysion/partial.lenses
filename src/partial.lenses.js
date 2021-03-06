import {
  array0,
  assert,
  acyclicEqualsU,
  always,
  applyU,
  assocPartialU,
  curry2,
  curry3,
  curry4,
  dissocPartialU,
  id,
  isArray,
  isDefined,
  isObject,
  keys,
  sndU
} from "infestines"

//

function pair(x0, x1) {return [x0, x1]}

//

function mapPartialIndexU(xi2y, xs) {
  const ys = [], n=xs.length
  for (let i=0, y; i<n; ++i)
    if (isDefined(y = xi2y(xs[i], i)))
      ys.push(y)
  return ys.length ? ys : void 0
}

//

const Applicative = (map, of, ap) => ({map, of, ap})

const Ident = Applicative(applyU, id, applyU)

const Const = {map: sndU}

const ConstFlip = (empty, tacnoc) => Applicative(sndU, always(empty), tacnoc)

function ConstOf(m) {
  const concat = m.concat,
        empty = m.empty
  return ConstFlip(empty(), (l, r) => concat(r, l))
}

//

const run = (o, C, xi2yC, s, i) => toFunction(o)(C, xi2yC, s, i)

//

export function mkFoldBy(empty, tacnoc, by) {
  const a = ConstFlip(empty, tacnoc)
  return curry2((t, s) => run(t, a, by, s))
}

//

const reqApplicative = f => assert(f, id, "Traversals require an applicative.")

//

function Concat(l, r) {this.l = l; this.r = r}

const isConcat = n => n.constructor === Concat

const ap = (r, l) => isDefined(l) ? isDefined(r) ? new Concat(l, r) : l : r

const rconcat = t => h => ap(t, h)

function pushTo(n, ys) {
  while (n && isConcat(n)) {
    const l = n.l
    n = n.r
    if (l && isConcat(l)) {
      pushTo(l.l, ys)
      pushTo(l.r, ys)
    } else
      ys.push(l)
  }
  ys.push(n)
}

function toArray(n) {
  if (isDefined(n)) {
    const ys = []
    pushTo(n, ys)
    return ys
  }
}

function foldlRec(f, r, n) {
  while (isConcat(n)) {
    const l = n.l
    n = n.r
    r = isConcat(l)
      ? foldlRec(f, foldlRec(f, r, l.l), l.r)
      : f(r, l[0], l[1])
  }
  return f(r, n[0], n[1])
}

const foldl = (f, r, n) => isDefined(n) ? foldlRec(f, r, n) : r

const Collect = ConstFlip(void 0, ap)

const collectMapU = (t, xi2y, s) =>
  toArray(run(t, Collect, xi2y, s)) || []

//

function traversePartialIndex(A, xi2yA, xs) {
  const ap = A.ap, map = A.map
  let s = reqApplicative(A.of)(void 0), i = xs.length
  while (i--)
    s = ap(map(rconcat, s), xi2yA(xs[i], i))
  return map(toArray, s)
}

//

const array0ToUndefined = xs => xs.length ? xs : void 0

const object0ToUndefined = o => {
  if (!isObject(o))
    return o
  for (const k in o)
    return o
}

//

const isProp = x => typeof x === "string"

const getProp = (k, o) => isObject(o) ? o[k] : void 0

const setProp = (k, v, o) =>
  isDefined(v) ? assocPartialU(k, v, o) : dissocPartialU(k, o)

const funProp = k => (F, xi2yF, x, _) =>
  (0,F.map)(v => setProp(k, v, x), xi2yF(getProp(k, x), k))

//

const isIndex = x => Number.isInteger(x) && 0 <= x

const nulls = n => Array(n).fill(null)

const getIndex = (i, xs) => isArray(xs) ? xs[i] : void 0

function setIndex(i, x, xs) {
  if (isDefined(x)) {
    if (!isArray(xs))
      return i < 0 ? void 0 : nulls(i).concat([x])
    const n = xs.length
    if (n <= i)
      return xs.concat(nulls(i - n), [x])
    if (i < 0)
      return !n ? void 0 : xs
    const ys = Array(n)
    for (let j=0; j<n; ++j)
      ys[j] = xs[j]
    ys[i] = x
    return ys
  } else {
    if (isArray(xs)) {
      const n = xs.length
      if (!n)
        return void 0
      if (i < 0 || n <= i)
        return xs
      if (n === 1)
        return void 0
      const ys = Array(n-1)
      for (let j=0; j<i; ++j)
        ys[j] = xs[j]
      for (let j=i+1; j<n; ++j)
        ys[j-1] = xs[j]
      return ys
    }
  }
}

const funIndex = i => (F, xi2yF, xs, _) =>
  (0,F.map)(y => setIndex(i, y, xs), xi2yF(getIndex(i, xs), i))

//

const seemsOptic = x => typeof x === "function" && x.length === 4

const optic = o => assert(o, seemsOptic, "Expecting an optic.")

const close = (o, F, xi2yF) => (x, i) => o(F, xi2yF, x, i)

function composed(oi0, os) {
  switch (os.length - oi0) {
    case 0:  return identity
    case 1:  return toFunction(os[oi0])
    default: return (F, xi2yF, x, i) => {
      let n = os.length
      xi2yF = close(toFunction(os[--n]), F, xi2yF)
      while (oi0 < --n)
        xi2yF = close(toFunction(os[n]), F, xi2yF)
      return run(os[oi0], F, xi2yF, x, i)
    }
  }
}

function setU(o, x, s) {
  switch (typeof o) {
    case "string":   return setProp(o, x, s)
    case "number":   return setIndex(o, x, s)
    case "function": return optic(o)(Ident, always(x), s, void 0)
    default:         return modifyComposed(o, always(x), s)
  }
}

function getComposed(ls, s) {
  for (let i=0, n=ls.length, l; i<n; ++i)
    switch (typeof (l = ls[i])) {
      case "string": s = getProp(l, s); break
      case "number": s = getIndex(l, s); break
      default: return composed(i, ls)(Const, id, s, ls[i-1])
    }
  return s
}

function getU(l, s) {
  switch (typeof l) {
    case "string":   return getProp(l, s)
    case "number":   return getIndex(l, s)
    case "function": return optic(l)(Const, id, s, void 0)
    default:         return getComposed(l, s)
  }
}

function modifyComposed(os, xi2x, x) {
  let n = os.length
  const xs = []
  for (let i=0, o; i<n; ++i) {
    xs.push(x)
    switch (typeof (o = os[i])) {
      case "string":
        x = getProp(o, x)
        break
      case "number":
        x = getIndex(o, x)
        break
      default:
        x = composed(i, os)(Ident, xi2x, x, os[i-1])
        n = i
        break
    }
  }
  if (n === os.length)
    x = xi2x(x, os[n-1])
  while (0 <= --n) {
    const o = os[n]
    switch (typeof o) {
      case "string": x = setProp(o, x, xs[n]); break
      case "number": x = setIndex(o, x, xs[n]); break
    }
  }
  return x
}

//

function getPick(template, x) {
  let r
  for (const k in template) {
    const v = getU(template[k], x)
    if (isDefined(v)) {
      if (!r)
        r = {}
      r[k] = v
    }
  }
  return r
}

const setPick = (template, x) => value => {
  if (!isObject(value))
    value = void 0
  for (const k in template)
    x = setU(template[k], value && value[k], x)
  return x
}

//

const show = (labels, dir) => x =>
  console.log.apply(console, labels.concat([dir, x])) || x

function branchOn(keys, vals) {
  const n = keys.length
  return (A, xi2yA, x, _) => {
    const ap = A.ap,
          wait = (x, i) => 0 <= i ? y => wait(setProp(keys[i], y, x), i-1) : x
    let r = reqApplicative(A.of)(wait(x, n-1))
    if (!isObject(x))
      x = void 0
    for (let i=n-1; 0<=i; --i) {
      const k = keys[i], v = x && x[k]
      r = ap(r, (vals ? vals[i](A, xi2yA, v, k) : xi2yA(v, k)))
    }
    return (0,A.map)(object0ToUndefined, r)
  }
}

const normalizer = xi2x => (F, xi2yF, x, i) =>
  (0,F.map)(x => xi2x(x, i), xi2yF(xi2x(x, i), i))

const replacer = (inn, out) => x => acyclicEqualsU(x, inn) ? out : x

function findIndex(xi2b, xs) {
  for (let i=0, n=xs.length; i<n; ++i)
    if (xi2b(xs[i], i))
      return i
  return -1
}

function partitionIntoIndex(xi2b, xs, ts, fs) {
  for (let i=0, n=xs.length, x; i<n; ++i)
    (xi2b(x = xs[i], i) ? ts : fs).push(x)
}

//

export function toFunction(o) {
  switch (typeof o) {
    case "string":   return funProp(o)
    case "number":   return funIndex(o)
    case "function": return optic(o)
    default:         return composed(0,o)
  }
}

// Operations on optics

export const modify = curry3((o, xi2x, s) => {
  switch (typeof o) {
    case "string":   return setProp(o, xi2x(getProp(o, s), o), s)
    case "number":   return setIndex(o, xi2x(getIndex(o, s), o), s)
    case "function": return optic(o)(Ident, xi2x, s, void 0)
    default:         return modifyComposed(o, xi2x, s)
  }
})

export const remove = curry2((o, s) => setU(o, void 0, s))

export const set = curry3(setU)

// Nesting

export function compose() {
  switch (arguments.length) {
    case 0: return identity
    case 1: return arguments[0]
    default: {
      const n = arguments.length, lenses = Array(n)
      for (let i=0; i<n; ++i)
        lenses[i] = arguments[i]
      return lenses
    }
  }
}

// Querying

export const chain = curry2((xi2yO, xO) =>
  [xO, choose((xM, i) => isDefined(xM) ? xi2yO(xM, i) : zero)])

export const choice = (...ls) => choose(x => {
  const i = findIndex(l => isDefined(getU(l, x)), ls)
  return i < 0 ? zero : ls[i]
})

export const choose = xiM2o => (C, xi2yC, x, i) =>
  run(xiM2o(x, i), C, xi2yC, x, i)

export const when = p => (C, xi2yC, x, i) =>
  p(x, i) ? xi2yC(x, i) : zero(C, xi2yC, x, i)

export const optional = when(isDefined)

export function zero(C, xi2yC, x, i) {
  const of = C.of
  return of ? of(x) : (0,C.map)(always(x), xi2yC(void 0, i))
}

// Recursing

export function lazy(o2o) {
  let memo = (C, xi2yC, x, i) => (memo = toFunction(o2o(rec)))(C, xi2yC, x, i)
  function rec(C, xi2yC, x, i) {return memo(C, xi2yC, x, i)}
  return rec
}

// Debugging

export const log = (...labels) => iso(show(labels, "get"), show(labels, "set"))

// Operations on traversals

export const collect = curry2((t, s) => collectMapU(t, id, s))

export const collectMap = curry3(collectMapU)

export const foldMapOf =
  curry4((m, t, xMi2y, s) => run(t, ConstOf(m), xMi2y, s))

export const foldOf = curry3((m, t, s) => run(t, ConstOf(m), id, s))

export const productOf = mkFoldBy(1, (y, x) => x * y, replacer(void 0, 1))

export const sumOf = mkFoldBy(0, (y, x) => x + y, replacer(void 0, 0))

export const foldlOf = curry4((t, f, r, s) =>
  foldl(f, r, run(t, Collect, pair, s)))

export const foldrOf = curry4((t, f, r, s) => {
  const xs = collectMapU(t, pair, s)
  for (let i=xs.length-1; 0<=i; --i) {
    const x = xs[i]
    r = f(r, x[0], x[1])
  }
  return r
})

// Creating new traversals

export function branch(template) {
  const keys = [], vals = []
  for (const k in template) {
    keys.push(k)
    vals.push(toFunction(template[k]))
  }
  return branchOn(keys, vals)
}

// Traversals and combinators

export function sequence(A, xi2yA, xs, _) {
  if (isArray(xs))
    return A === Ident
    ? mapPartialIndexU(xi2yA, xs)
    : traversePartialIndex(A, xi2yA, xs)
  else if (isObject(xs))
    return branchOn(keys(xs))(A, xi2yA, xs)
  else
    return reqApplicative(A.of)(xs)
}

// Operations on lenses

export const get = curry2(getU)

// Creating new lenses

export const lens = curry2((get, set) => (F, xi2yF, x, i) =>
  (0,F.map)(y => set(y, x, i), xi2yF(get(x, i), i)))

// Computing derived props

export const augment = template => lens(
  x => {
    const z = dissocPartialU(0, x)
    if (z)
      for (const k in template)
        z[k] = template[k](z)
    return z
  },
  (y, x) => {
    if (isObject(y)) {
      if (!isObject(x))
        x = void 0
      let z
      const set = (k, v) => {
        if (!z)
          z = {}
        z[k] = v
      }
      for (const k in y) {
        if (!(k in template))
          set(k, y[k])
        else
          if (x && k in x)
            set(k, x[k])
      }
      return z
    }
  })

// Enforcing invariants

export const defaults = out => (F, xi2yF, x, i) =>
  (0,F.map)(replacer(out), xi2yF(isDefined(x) ? x : out, i))

export const required = inn => replace(inn, void 0)

export const define = v => normalizer(x => isDefined(x) ? x : v)

export const normalize = xi2x =>
  normalizer((x, i) => isDefined(x) ? xi2x(x, i) : void 0)

export const rewrite = yi2y => (F, xi2yF, x, i) =>
  (0,F.map)(y => isDefined(y) ? yi2y(y, i) : void 0, xi2yF(x, i))

// Lensing arrays

export const append = (F, xi2yF, xs, i) =>
  (0,F.map)(x => array0ToUndefined((isArray(xs) ? xs : array0)
                                   .concat(isDefined(x) ? [x] : array0)),
            xi2yF(void 0, i))

export const filter = xi2b => (F, xi2yF, xs, i) => {
  let ts, fs = array0
  if (isArray(xs))
    partitionIntoIndex(xi2b, xs, ts = [], fs = [])
  return (0,F.map)(ts => array0ToUndefined(isArray(ts)?ts.concat(fs):fs),
                   xi2yF(ts, i))
}

export const find = xi2b => choose(xs => {
  if (!isArray(xs))
    return 0
  const i = findIndex(xi2b, xs)
  return i < 0 ? append : i
})

export function findWith(...ls) {
  const lls = compose(...ls)
  return [find(x => isDefined(getU(lls, x))), lls]
}

export const index = x =>
  assert(x, isIndex, "`index` expects a non-negative integer.")

// Lensing objects

export const prop = x =>
  assert(x, isProp, "`prop` expects a string.")

export function props() {
  const n = arguments.length, template = {}
  for (let i=0, k; i<n; ++i)
    template[k = arguments[i]] = k
  return pick(template)
}

// Providing defaults

export const valueOr = v => (_F, xi2yF, x, i) =>
  xi2yF(isDefined(x) && x !== null ? x : v, i)

// Adapting to data

export const orElse =
  curry2((d, l) => choose(x => isDefined(getU(l, x)) ? l : d))

// Read-only mapping

export const to = wi2x => (F, xi2yF, w, i) =>
  (0,F.map)(always(w), xi2yF(wi2x(w, i), i))

export const just = x => to(always(x))

// Transforming data

export const pick = template => (F, xi2yF, x, i) =>
  (0,F.map)(setPick(template, x), xi2yF(getPick(template, x), i))

export const replace = curry2((inn, out) => (F, xi2yF, x, i) =>
  (0,F.map)(replacer(out, inn), xi2yF(replacer(inn, out)(x), i)))

// Operations on isomorphisms

export const getInverse = curry2(setU)

// Creating new isomorphisms

export const iso =
  curry2((bwd, fwd) => (F, xi2yF, x, i) => (0,F.map)(fwd, xi2yF(bwd(x), i)))

// Isomorphisms and combinators

export const identity = (_F, xi2yF, x, i) => xi2yF(x, i)

export const inverse = iso => (F, xi2yF, x, i) =>
  (0,F.map)(x => getU(iso, x), xi2yF(setU(iso, x), i))
