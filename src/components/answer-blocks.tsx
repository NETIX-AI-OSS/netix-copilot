import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'

// The answer container, with a pass over the rendered blocks that adds what a stylesheet cannot:
// a `label: value` list becomes a key–value grid, a table gets a horizontal scroller and
// right-aligned numeric cells, a short opening paragraph becomes the lede. It reads the DOM, so
// the built-in renderer and a host `renderMarkdown` get the same treatment.
//
// React owns every node in here. Moving one under a wrapper is safe only once React will never
// remove it or insert a sibling before it, and while the caret is drawn React is still reshaping
// the tree as text arrives — so structure waits for the caret to go; classes are added at any time.

const KV_ITEM = /^\s*([^:\n]{2,48}):\s+(\S.*)$/
const NUMERIC_CELL = /^[-+]?\d[\d.,]*\s*[%°a-zA-Z/]*$/
const LEDE_MAX = 160
const STRUCTURE = 'h1, h2, h3, ul, ol, table, .nxcp-answer-scroll'

// Where an item's label ends: the child holding the colon and the offset just past it, or -1 when
// the label ends with a whole node (a bold label). Null when the item is not `label: value` or the
// colon sits inside an element the pass will not open.
interface Boundary {
  node: ChildNode
  offset: number
}

function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE
}

function kvBoundary(item: Element): Boundary | null {
  const text = item.textContent ?? ''
  if (!KV_ITEM.test(text) || item.querySelector('ul, ol')) return null
  let end = text.indexOf(':') + 1
  for (const node of item.childNodes) {
    const length = (node.textContent ?? '').length
    if (end === length) return { node, offset: -1 }
    if (end < length) return isText(node) ? { node, offset: end } : null
    end -= length
  }
  return null
}

function splitItem(item: Element, { node, offset }: Boundary): void {
  const label = item.ownerDocument.createElement('span')
  const value = item.ownerDocument.createElement('span')
  label.className = 'nxcp-kv-label'
  value.className = 'nxcp-kv-value'
  if (offset >= 0 && isText(node)) node.splitText(offset)
  while (item.firstChild && item.firstChild !== node) label.append(item.firstChild)
  label.append(node)
  while (item.firstChild) value.append(item.firstChild)
  item.append(label, value)
}

function enhanceList(list: Element): void {
  if (list.classList.contains('nxcp-kv')) return
  const splits: Array<[Element, Boundary]> = []
  for (const item of list.children) {
    const boundary = item.tagName === 'LI' ? kvBoundary(item) : null
    if (!boundary) return
    splits.push([item, boundary])
  }
  if (splits.length === 0) return
  list.classList.add('nxcp-kv')
  for (const [item, boundary] of splits) splitItem(item, boundary)
}

function wrapTable(table: Element): void {
  if (table.parentElement?.classList.contains('nxcp-answer-scroll')) return
  const scroll = table.ownerDocument.createElement('div')
  scroll.className = 'nxcp-answer-scroll'
  table.replaceWith(scroll)
  scroll.append(table)
}

function markLede(container: HTMLElement): void {
  const first = container.firstElementChild
  if (!first || first.tagName !== 'P') return
  const next = first.nextElementSibling
  first.classList.toggle(
    'nxcp-answer-lede',
    next !== null && next.matches(STRUCTURE) && (first.textContent ?? '').trim().length < LEDE_MAX,
  )
}

// Idempotent: a second pass over an enhanced answer changes nothing.
export function enhanceAnswer(container: HTMLElement): void {
  if (container.querySelector('.nxcp-caret') === null) {
    for (const list of container.querySelectorAll('ul, ol')) enhanceList(list)
    for (const table of container.querySelectorAll('table')) wrapTable(table)
  }
  for (const cell of container.querySelectorAll('td, th')) {
    cell.classList.toggle('nxcp-answer-num', NUMERIC_CELL.test((cell.textContent ?? '').trim()))
  }
  markLede(container)
}

// useLayoutEffect warns under React 18 server rendering, and there is no DOM to enhance there.
const useEnhanceEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect

export interface AnswerBlocksProps {
  children: ReactNode
}

export function AnswerBlocks({ children }: AnswerBlocksProps): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null)
  // After every commit: the pass touches a handful of nodes and does nothing twice.
  useEnhanceEffect(() => {
    try {
      if (ref.current) enhanceAnswer(ref.current)
    } catch {
      // Cosmetic only; a surprise in host markup must not take the transcript down with it.
    }
  })
  return (
    <div className='nxcp-answer' ref={ref}>
      {children}
    </div>
  )
}
