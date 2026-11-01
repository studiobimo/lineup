import { describe, expect, it } from 'vitest'

import { saveProfile, toHandle } from './profile-store'

describe('toHandle', () => {
  it.each([
    ['dmoralesz', 'dmoralesz'],
    ['@dmoralesz', 'dmoralesz'],
    ['  @DMoralesZ ', 'dmoralesz'],
    ['https://www.instagram.com/dmoralesz/', 'dmoralesz'],
    ['instagram.com/dmoralesz?igsh=abc', 'dmoralesz'],
    ['some.name_1', 'some.name_1'],
    ['not a handle!', 'notahandle']
  ])('reads %s', (typed, handle) => {
    expect(toHandle(typed)).toBe(handle)
  })

  it('stops at the longest handle Instagram allows', () => {
    expect(toHandle('a'.repeat(40))).toHaveLength(30)
  })
})

describe('saveProfile', () => {
  it('keeps what was typed for the next visit', () => {
    saveProfile({ handle: 'some.name', name: 'Some Name' })
    expect(JSON.parse(localStorage.getItem('profile') ?? '')).toEqual({
      handle: 'some.name',
      name: 'Some Name'
    })
  })
})
