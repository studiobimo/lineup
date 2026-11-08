// A version is a promise (docs/API.md), so anything a client of `v1` could be relying on must stay.
interface Schema {
  $ref?: string
  type?: string | string[]
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, Schema>
  items?: Schema
  anyOf?: Schema[]
}

interface Media {
  content?: Record<string, { schema?: Schema }>
}

interface Operation {
  requestBody?: Media
  responses?: Record<string, Media>
  parameters?: { name: string; in: string; required?: boolean }[]
}

interface OpenApi {
  paths?: Record<string, Record<string, Operation>>
  components?: { schemas?: Record<string, Schema> }
}

const METHODS = new Set(['get', 'put', 'post', 'patch', 'delete'])

const typeOf = ({ type, anyOf }: Schema) =>
  JSON.stringify(type ?? anyOf?.map(({ type }) => type) ?? null)

function compareRequest(before: Schema, after: Schema, at: string, found: string[]) {
  if (typeOf(before) !== typeOf(after)) found.push(`${at}: the type changed`)
  const gone = (before.enum ?? []).filter((value) => !after.enum?.includes(value))
  if (after.enum && gone.length > 0) found.push(`${at}: ${gone.join()} no longer accepted`)
  for (const field of after.required ?? []) {
    if (!before.required?.includes(field)) found.push(`${at}.${field}: newly required`)
  }
  for (const [field, schema] of Object.entries(before.properties ?? {})) {
    const next = after.properties?.[field]
    if (!next) found.push(`${at}.${field}: removed`)
    else compareRequest(schema, next, `${at}.${field}`, found)
  }
}

function compareResponse(before: Schema, after: Schema, at: string, found: string[]) {
  if (typeOf(before) !== typeOf(after)) found.push(`${at}: the type changed`)
  for (const field of before.required ?? []) {
    if (!after.required?.includes(field)) found.push(`${at}.${field}: no longer always there`)
  }
  for (const [field, schema] of Object.entries(before.properties ?? {})) {
    const next = after.properties?.[field]
    if (!next) found.push(`${at}.${field}: removed`)
    else compareResponse(schema, next, `${at}.${field}`, found)
  }
  if (before.items && after.items) compareResponse(before.items, after.items, `${at}[]`, found)
}

const jsonSchema = (media: Media | undefined) => media?.content?.['application/json']?.schema

function compareOperation(before: Operation, after: Operation, at: string, found: string[]) {
  const request = [jsonSchema(before.requestBody), jsonSchema(after.requestBody)] as const
  if (request[0] && request[1]) compareRequest(request[0], request[1], `${at} request`, found)
  for (const parameter of after.parameters ?? []) {
    const known = before.parameters?.some(({ name }) => name === parameter.name)
    if (parameter.required && !known) found.push(`${at}: needs ${parameter.name}`)
  }
  for (const [status, response] of Object.entries(before.responses ?? {})) {
    if (!status.startsWith('2')) continue
    const next = after.responses?.[status]
    if (!next) {
      found.push(`${at}: no longer answers ${status}`)
      continue
    }
    const pair = [jsonSchema(response), jsonSchema(next)] as const
    if (pair[0] && pair[1]) compareResponse(pair[0], pair[1], `${at} ${status}`, found)
  }
}

export function breakingChanges(before: OpenApi, after: OpenApi) {
  const found: string[] = []
  for (const [path, operations] of Object.entries(before.paths ?? {})) {
    for (const [method, operation] of Object.entries(operations)) {
      if (!METHODS.has(method)) continue
      const at = `${method.toUpperCase()} ${path}`
      const next = after.paths?.[path]?.[method]
      if (next) compareOperation(operation, next, at, found)
      else found.push(`${at}: removed`)
    }
  }
  return found
}
