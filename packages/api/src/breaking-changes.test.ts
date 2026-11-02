import { describe, expect, it } from 'vitest'

import { breakingChanges } from './breaking-changes'

const json = (schema: object) => ({ content: { 'application/json': { schema } } })

const document = (request: object, response: object) => ({
  paths: {
    '/things': {
      post: { requestBody: json(request), responses: { 201: json(response) } }
    }
  }
})

const request = {
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['a', 'b'] } }
}
const response = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' }, note: { type: 'string' } }
}
const before = document(request, response)

describe('a change to the API', () => {
  it('is fine when it only adds', () => {
    const after = document(
      { ...request, properties: { ...request.properties, extra: { type: 'string' } } },
      { ...response, properties: { ...response.properties, more: { type: 'string' } } }
    )
    const paths = { ...after.paths, '/more': { get: { responses: {} } } }
    expect(breakingChanges(before, { paths })).toEqual([])
  })

  it('breaks when a route goes', () => {
    expect(breakingChanges(before, { paths: {} })).toEqual(['POST /things: removed'])
  })

  it('breaks when a response field goes, changes type or may be absent', () => {
    const { properties } = response
    const gone = { ...response, properties: { id: properties.id } }
    expect(breakingChanges(before, document(request, gone))).toEqual([
      'POST /things 201.note: removed'
    ])
    const retyped = { ...response, properties: { ...properties, note: { type: 'number' } } }
    expect(breakingChanges(before, document(request, retyped))).toEqual([
      'POST /things 201.note: the type changed'
    ])
    const optional = { ...response, required: [] }
    expect(breakingChanges(before, document(request, optional))).toEqual([
      'POST /things 201.id: no longer always there'
    ])
  })

  it('breaks when a request asks for more or allows less', () => {
    const required = { ...request, required: ['name', 'kind'] }
    expect(breakingChanges(before, document(required, response))).toEqual([
      'POST /things request.kind: newly required'
    ])
    const fewer = {
      ...request,
      properties: { ...request.properties, kind: { type: 'string', enum: ['a'] } }
    }
    expect(breakingChanges(before, document(fewer, response))).toEqual([
      'POST /things request.kind: b no longer accepted'
    ])
  })

  it('breaks when a response it used to give is gone', () => {
    const after = {
      paths: {
        '/things': {
          post: { requestBody: before.paths['/things'].post.requestBody, responses: {} }
        }
      }
    }
    expect(breakingChanges(before, after)).toEqual(['POST /things: no longer answers 201'])
  })
})
