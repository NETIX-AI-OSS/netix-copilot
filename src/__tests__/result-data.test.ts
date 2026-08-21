// result_data arrives in whatever shape the tool that produced it felt like returning, and older
// rows store the whole thing as JSON text. Every branch here is a shape seen on a real answer.

import { describe, expect, it } from 'vitest'

import { formatResultCell, normalizeResultData } from '../transport/result-data'

describe('normalizeResultData', () => {
  it('reads the { columns, data } shape the SQL tools return', () => {
    const table = normalizeResultData({
      columns: ['technician', 'closed'],
      data: [
        { technician: 'Ali', closed: 12 },
        { technician: 'Sam', closed: 9 },
      ],
    })
    expect(table?.columns).toEqual(['technician', 'closed'])
    expect(table?.rows).toHaveLength(2)
    expect(table?.rows[0]).toEqual({ technician: 'Ali', closed: 12 })
  })

  it('accepts rows and records as aliases for data', () => {
    expect(normalizeResultData({ columns: ['a'], rows: [{ a: 1 }] })?.rows).toEqual([{ a: 1 }])
    expect(normalizeResultData({ columns: ['a'], records: [{ a: 2 }] })?.rows).toEqual([{ a: 2 }])
    expect(normalizeResultData({ columns: ['a'], results: [{ a: 3 }] })?.rows).toEqual([{ a: 3 }])
  })

  it('lines positional rows up with the declared columns', () => {
    const table = normalizeResultData({
      columns: ['status', 'count'],
      data: [
        ['Open', 4],
        ['Closed', 7],
      ],
    })
    expect(table?.rows).toEqual([
      { status: 'Open', count: 4 },
      { status: 'Closed', count: 7 },
    ])
  })

  it('names an extra positional cell rather than dropping it', () => {
    const table = normalizeResultData({ columns: ['a'], data: [[1, 2]] })
    expect(table?.rows[0]).toEqual({ a: 1, column_2: 2 })
  })

  it('derives columns from the row keys when the backend declares none', () => {
    const table = normalizeResultData([
      { id: 1, label: 'AHU-1' },
      { id: 2, note: 'extra' },
    ])
    expect(table?.columns).toEqual(['id', 'label', 'note'])
  })

  it('turns a list of primitives into a one-column table', () => {
    const table = normalizeResultData(['a', 'b'])
    expect(table?.columns).toEqual(['value'])
    expect(table?.rows).toEqual([{ value: 'a' }, { value: 'b' }])
  })

  it('renders a plain object as key and value', () => {
    const table = normalizeResultData({ total: 12, open: 4 })
    expect(table?.columns).toEqual(['key', 'value'])
    expect(table?.rows).toEqual([
      { key: 'total', value: 12 },
      { key: 'open', value: 4 },
    ])
  })

  it('parses a payload stored as JSON text', () => {
    const table = normalizeResultData('{"columns":["a"],"data":[{"a":1}]}')
    expect(table?.rows).toEqual([{ a: 1 }])
  })

  it('keeps an unparseable string as a scalar rather than throwing', () => {
    const table = normalizeResultData('not json at all')
    expect(table).toEqual({ columns: [], rows: [], raw: 'not json at all' })
  })

  it('keeps a scalar answer as a scalar', () => {
    expect(normalizeResultData(42)).toEqual({ columns: [], rows: [], raw: 42 })
  })

  it('keeps the untouched payload beside the normalized table', () => {
    const raw = { columns: ['a'], data: [{ a: 1 }] }
    expect(normalizeResultData(raw)?.raw).toEqual(raw)
  })

  it('returns undefined when there is genuinely nothing to show', () => {
    expect(normalizeResultData(undefined)).toBeUndefined()
    expect(normalizeResultData(null)).toBeUndefined()
    expect(normalizeResultData('')).toBeUndefined()
    expect(normalizeResultData([])).toBeUndefined()
    expect(normalizeResultData({})).toBeUndefined()
  })

  it('caps the column count so a pathological payload cannot render a mile-wide table', () => {
    const wide: Record<string, number> = {}
    for (let index = 0; index < 80; index += 1) wide[`c${index}`] = index
    expect(normalizeResultData([wide])?.columns).toHaveLength(40)
    expect(normalizeResultData({ columns: Object.keys(wide), data: [wide] })?.columns).toHaveLength(
      40,
    )
  })
})

describe('formatResultCell', () => {
  it('renders scalars as themselves and objects as JSON', () => {
    expect(formatResultCell('a')).toBe('a')
    expect(formatResultCell(3)).toBe('3')
    expect(formatResultCell(false)).toBe('false')
    expect(formatResultCell({ a: 1 })).toBe('{"a":1}')
    expect(formatResultCell([1, 2])).toBe('[1,2]')
  })

  it('renders a missing cell as empty, never as undefined or null', () => {
    expect(formatResultCell(undefined)).toBe('')
    expect(formatResultCell(null)).toBe('')
  })
})
