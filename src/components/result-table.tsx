import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { formatResultCell } from '../transport/result-data'
import type { CopilotResultData, JsonValue } from '../types'
import { useNotify } from './notify'

// Matches what the drawer this replaces showed, so adopting the SDK is not a regression.
const MAX_VISIBLE_ROWS = 10

export interface ResultTableProps {
  data: CopilotResultData
  maxRows?: number
}

// False for a scalar with nothing to print, so the caller can skip the card around it.
export function hasResultContent(data: CopilotResultData): boolean {
  if (data.columns.length > 0 && data.rows.length > 0) return true
  return formatResultCell(data.raw) !== ''
}

function csvCell(value: JsonValue | undefined): string {
  return `"${formatResultCell(value).replace(/"/g, '""')}"`
}

// Every row, not the ten on screen: the export is how a user gets past the cap.
export function toCsv(data: CopilotResultData): string {
  const header = data.columns.map(csvCell).join(',')
  const body = data.rows.map((row) => data.columns.map((column) => csvCell(row[column])).join(','))
  return [header, ...body].join('\n')
}

function downloadCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'copilot-result.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoked after the click has been handed to the browser, not before.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// The tabular half of an answer: ml-engine returns the rows behind the prose, and losing them was
// the most visible thing hosts gave up when they moved onto the SDK.
export function ResultTable({ data, maxRows = MAX_VISIBLE_ROWS }: ResultTableProps): ReactNode {
  const { t } = useCopilotAdapters()
  const notify = useNotify()

  // A scalar result has no columns at all. Printing the value beats printing an empty table.
  if (data.columns.length === 0 || data.rows.length === 0) {
    const scalar = formatResultCell(data.raw)
    if (scalar === '') return null
    return (
      <div className='nxcp-result'>
        <p className='nxcp-result-scalar' aria-label={t('copilot.result.label')}>
          {scalar}
        </p>
      </div>
    )
  }

  const visible = data.rows.slice(0, maxRows)
  const exportCsv = () => {
    downloadCsv(toCsv(data))
    notify({ message: t('copilot.artifact.exported', { rows: data.rows.length }) })
  }

  return (
    <div className='nxcp-result'>
      <div className='nxcp-result-scroll'>
        <table className='nxcp-table' aria-label={t('copilot.result.label')}>
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th key={column} scope='col'>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={index}>
                {data.columns.map((column) => (
                  <td key={column}>{formatResultCell(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='nxcp-result-foot'>
        {data.rows.length > visible.length ? (
          <p className='nxcp-result-more'>
            {t('copilot.result.more', { shown: visible.length, total: data.rows.length })}
          </p>
        ) : null}
        <button type='button' className='nxcp-result-export' onClick={exportCsv}>
          {t('copilot.artifact.downloadCsv')}
        </button>
      </div>
    </div>
  )
}
