const fs = require('fs')
const fmt = require('util').format
const path = require('path')
const callsites = require('callsites')

const parse = require('../parser')

const CLASS_RE = /\.[^.]+/g
const ID_RE = /#[^. ]+/g

exports.unclosed = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr',
  'doctype'
]

exports.resolveTagOrSymbol = function resolveTagOrSymbol (string) {
  const props = {
    tagname: 'div',
    classname: [],
    id: '',
    content: ''
  }

  string = string.replace(ID_RE, function (id) {
    props.id = id.slice(1)
    return ''
  })

  string = string.replace(CLASS_RE, function (cls) {
    props.classname.push(cls.slice(1))
    return ''
  })

  if (string) props.tagname = string
  props.classname = props.classname.join(' ')
  return props
}

exports.resolveInclude = function resolver (info, shouldParse) {
  let dirname = info.location

  const cs = callsites()

  if (!dirname && cs.length) {
    for (let c of cs) {
      cs.shift()
      const f = c.getFileName()
      const index = f.indexOf('/mineral/index') > -1
      if (index) break
    }

    if (cs[1]) dirname = path.dirname(cs[1].getFileName())
  }

  let stat = null

  try {
    stat = fs.statSync(info.location)
  } catch (_) {
  }

  if (stat && !stat.isDirectory()) {
    dirname = path.dirname(info.location)
  }

  const location = path.resolve(dirname, info.path)
  const text = fs.readFileSync(location, 'utf8')

  return {
    tree: shouldParse ? parse(text) : text,
    location: location
  }
}

exports.die = function die (info, name, message) {
  const msg = fmt('%s:%d:%d', message, info.pos.column, info.pos.lineno)
  const err = new Error(msg)
  err.stack = ''
  err.name = name
  throw err
}

exports.scopedExpression = function scopedExpression (data, info, str) {
  const args = Object.keys(data).concat(['__format', 'return ' + str + ';'])
  const fn = Function.apply(null, args)
  const values = Object.keys(data).map(k => data[k])
  values.push(fmt)

  try {
    return fn.apply(data, values)
  } catch (ex) {
    console.warn('%s: %s in %s %s:%s',
      ex.name, ex.message, info.location, info.pos.column, info.pos.lineno)
    return ''
  }
}

exports.each = function each (o, f) {
  const has = Object.prototype.hasOwnProperty
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; ++i) f(o[i], i)
  } else {
    for (let k in o) if (has.call(o, k)) f(o[k], k)
  }
}
