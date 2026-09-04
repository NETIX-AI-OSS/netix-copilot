// The pass over a rendered answer: what the stylesheet promises for bullets and tables, and what
// the enhancer adds for label: value lists, tables and the lede — for the built-in renderer and
// for host markup alike. jsdom computes no cascade, so the rules are asserted on the stylesheet
// and the hooks they need on the DOM.

import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { AnswerBlocks } from '../components/answer-blocks'
import { Markdown } from '../components/markdown'
import { COPILOT_CSS } from '../ui/styles'

function answer(children: ReactNode) {
  const utils = render(<AnswerBlocks>{children}</AnswerBlocks>)
  const root = () => utils.container.querySelector('.nxcp-answer') as HTMLElement
  return { ...utils, root }
}

function md(text: string, streaming = false) {
  return answer(<Markdown text={text} streaming={streaming} />)
}

const READINGS = '- Supply fan: On\n- Supply air temperature: 17.7°C'

describe('list markers', () => {
  it('sets list-style on the answer, since a host preflight strips it', () => {
    expect(COPILOT_CSS).toContain('.nxcp-answer ul {\n  list-style: disc;\n}')
    expect(COPILOT_CSS).toContain('.nxcp-answer ol {\n  list-style: decimal;\n}')
    expect(COPILOT_CSS).toContain(
      '.nxcp-answer ul,\n.nxcp-answer ol {\n  margin: 0 0 10px;\n  padding-inline-start: 22px;\n}',
    )
    const { root } = md('- alpha\n- beta')
    expect(root().className).toBe('nxcp-answer')
    expect(root().querySelector(':scope > ul > li')).toBeTruthy()
  })

  it('typesets the body at 14px in the ink colour', () => {
    expect(COPILOT_CSS).toContain(
      '.nxcp-answer {\n  max-width: 860px;\n  font-size: 14px;\n  line-height: 1.6;\n  color: var(--nxcp-text);',
    )
  })
})

describe('key–value lists', () => {
  it('turns a label: value list into a grid of label and value spans', () => {
    const { root } = md(READINGS)
    const list = root().querySelector('ul') as HTMLElement
    expect(list.classList.contains('nxcp-kv')).toBe(true)
    const rows = [...list.querySelectorAll('li')].map((item) => [
      item.querySelector('.nxcp-kv-label')?.textContent,
      item.querySelector('.nxcp-kv-value')?.textContent?.trim(),
    ])
    expect(rows).toEqual([
      ['Supply fan:', 'On'],
      ['Supply air temperature:', '17.7°C'],
    ])
    expect(list.textContent).toBe('Supply fan: OnSupply air temperature: 17.7°C')
    expect(COPILOT_CSS).toContain('.nxcp-answer .nxcp-kv {\n  display: grid;')
    expect(COPILOT_CSS).toContain('.nxcp-answer .nxcp-kv > li {\n  display: grid;')
  })

  it('keeps a bold label bold, with the colon beside it', () => {
    const { root } = md('- **Supply fan**: On\n- **Mode**: *Auto*')
    const labels = [...root().querySelectorAll('.nxcp-kv-label')]
    expect(labels.map((label) => label.innerHTML)).toEqual([
      '<strong>Supply fan</strong>:',
      '<strong>Mode</strong>:',
    ])
    expect(root().querySelector('.nxcp-kv-value em')?.textContent).toBe('Auto')
  })

  it('leaves a list alone unless every item is a label and a value', () => {
    for (const text of [
      '- Supply fan: On\n- Check the filter',
      '- **Supply fan: On**',
      '- a: b',
      '- See: ',
    ]) {
      const { root, unmount } = md(text)
      expect(root().querySelector('.nxcp-kv')).toBeNull()
      expect(root().querySelector('.nxcp-kv-label')).toBeNull()
      unmount()
    }
  })

  it('leaves an item that holds a nested list alone', () => {
    const { root } = answer(
      <ul>
        <li>
          Fans: <ul>{<li>Supply: On</li>}</ul>
        </li>
      </ul>,
    )
    expect(root().querySelector(':scope > ul')?.classList.contains('nxcp-kv')).toBe(false)
    expect(root().querySelector('li li')?.parentElement?.classList.contains('nxcp-kv')).toBe(true)
  })
})

describe('tables', () => {
  const table = (
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>kWh</th>
          <th>2024</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>AHU-1</td>
          <td>1,204.5</td>
          <td>-3%</td>
        </tr>
        <tr>
          <td>Total</td>
          <td>17.7 °C</td>
          <td>n/a</td>
        </tr>
      </tbody>
    </table>
  )

  it('wraps a table in a scroller and right-aligns numeric cells', () => {
    const { root, rerender } = answer(table)
    expect(root().querySelector(':scope > .nxcp-answer-scroll > table')).toBeTruthy()
    const numeric = [...root().querySelectorAll('.nxcp-answer-num')].map((cell) => cell.textContent)
    expect(numeric).toEqual(['2024', '1,204.5', '-3%', '17.7 °C'])
    expect(COPILOT_CSS).toContain('.nxcp-answer-scroll {\n  max-width: 100%;')
    expect(COPILOT_CSS).toContain('overflow-x: auto;\n}\n.nxcp-answer table {\n  width: 100%;')
    expect(COPILOT_CSS).toContain(
      '.nxcp-answer .nxcp-answer-num {\n  text-align: end;\n  font-variant-numeric: tabular-nums;\n}',
    )

    rerender(<AnswerBlocks>{table}</AnswerBlocks>)
    expect(root().querySelectorAll('.nxcp-answer-scroll')).toHaveLength(1)
    expect(root().querySelectorAll('table')).toHaveLength(1)
  })
})

describe('lede', () => {
  it('marks a short opening paragraph only when structure follows it', () => {
    const lede = (text: string) => {
      const { root, unmount } = md(text)
      const first = root().firstElementChild as HTMLElement
      const marked = first.classList.contains('nxcp-answer-lede')
      unmount()
      return marked
    }
    expect(lede('AHU-1 is running normally.\n\n' + READINGS)).toBe(true)
    expect(lede('AHU-1 is running normally.\n\n## Readings')).toBe(true)
    expect(lede('AHU-1 is running normally.\n\nNothing else to report.')).toBe(false)
    expect(lede('AHU-1 is running normally.')).toBe(false)
    expect(lede('## Readings\n\n' + READINGS)).toBe(false)
    expect(lede(`${'AHU-1 is running normally. '.repeat(7)}\n\n${READINGS}`)).toBe(false)
    expect(COPILOT_CSS).toContain('.nxcp-answer .nxcp-answer-lede {\n  font-size: 15px;')
  })

  it('appears while the following list is still arriving', () => {
    const { root } = md('AHU-1 is running normally.\n\n- Supply', true)
    expect(root().firstElementChild?.classList.contains('nxcp-answer-lede')).toBe(true)
  })
})

describe('streaming', () => {
  const FULL = `AHU-1 is running normally.\n\n${READINGS}\n\nAll readings are within range.`

  it('holds the grid until the caret goes, then builds it once', () => {
    const { root, rerender } = md(
      'AHU-1 is running normally.\n\n- Supply fan: On\n- Supply air',
      true,
    )
    expect(root().querySelector('.nxcp-kv')).toBeNull()
    expect(root().querySelector('ul > li:last-child > .nxcp-caret')).toBeTruthy()

    rerender(
      <AnswerBlocks>
        <Markdown text={FULL} streaming />
      </AnswerBlocks>,
    )
    expect(root().querySelector('.nxcp-kv')).toBeNull()
    expect(root().querySelectorAll('.nxcp-caret')).toHaveLength(1)
    expect(root().lastElementChild?.lastElementChild?.className).toBe('nxcp-caret')

    for (let pass = 0; pass < 2; pass += 1) {
      rerender(
        <AnswerBlocks>
          <Markdown text={FULL} />
        </AnswerBlocks>,
      )
      expect(root().querySelector('.nxcp-caret')).toBeNull()
      expect(root().querySelectorAll('.nxcp-kv')).toHaveLength(1)
      expect(root().querySelectorAll('.nxcp-kv-label')).toHaveLength(2)
      expect(root().querySelector('.nxcp-kv-value .nxcp-kv-label')).toBeNull()
      expect(root().querySelectorAll('li > .nxcp-kv-value')).toHaveLength(2)
    }
  })

  it('survives a token-by-token stream, bare list markers included', () => {
    const text = `Readings:\n\n- **Supply fan**: On\n- Supply air temperature: 17.7°C\n\nDone.`
    const { root, rerender } = md(text.slice(0, 3), true)
    for (let cut = 4; cut <= text.length; cut += 1) {
      rerender(
        <AnswerBlocks>
          <Markdown text={text.slice(0, cut)} streaming />
        </AnswerBlocks>,
      )
      expect(root().querySelectorAll('.nxcp-caret')).toHaveLength(1)
      expect(root().querySelector('.nxcp-kv')).toBeNull()
    }
    rerender(
      <AnswerBlocks>
        <Markdown text={text} />
      </AnswerBlocks>,
    )
    expect(root().textContent).toBe('Readings:Supply fan: OnSupply air temperature: 17.7°CDone.')
    expect(root().querySelector('.nxcp-kv-label')?.innerHTML).toBe('<strong>Supply fan</strong>:')
  })
})

describe('host markup', () => {
  it('enhances what a host renderer emits the same way', () => {
    const { root } = answer(
      <ul>
        <li>Supply fan: On</li>
      </ul>,
    )
    const item = root().querySelector('ul.nxcp-kv > li') as HTMLElement
    expect(item.querySelector('.nxcp-kv-label')?.textContent).toBe('Supply fan:')
    expect(item.querySelector('.nxcp-kv-value')?.textContent).toBe(' On')
  })

  it('waits for the sibling caret a host fragment streams behind', () => {
    const fragment = (
      <ul>
        <li>Supply fan: On</li>
      </ul>
    )
    const { root, rerender } = answer(
      <>
        {fragment}
        <span className='nxcp-caret' aria-hidden='true' />
      </>,
    )
    expect(root().querySelector('.nxcp-kv')).toBeNull()
    expect(root().lastElementChild?.className).toBe('nxcp-caret')
    rerender(<AnswerBlocks>{fragment}</AnswerBlocks>)
    expect(root().querySelector('.nxcp-caret')).toBeNull()
    expect(root().querySelector('ul.nxcp-kv .nxcp-kv-value')?.textContent).toBe(' On')
  })
})
