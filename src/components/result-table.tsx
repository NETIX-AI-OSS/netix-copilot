import type { ReactNode } from 'react'

import { useCopilotAdapters } from '../adapters/context'
import { formatResultCell } from '../transport/result-data'
import type { CopilotResultData } from '../types'

// Matches what the drawer this replaces showed, so adopting the SDK is not a regression.
const MAX_VISIBLE_ROWS = 10

export interface ResultTableProps {
  data: CopilotResultData
  maxRows?: number
}

// The tabular half of an answer: ml-engine returns the rows behind the prose, and losing them was
// the most visible thing hosts gave up when they moved onto the SDK.
export function ResultTable({ data, maxRows = MAX_VISIBLE_ROWS }: ResultTableProps): ReactNode {
  const { t } = useCopilotAdapters()

  // A scalar result has no columns at all. Printing the value beats printing an empty table.
  if (data.columns.length === 0 || data.rows.length === 0) {
    const scalar = formatResultCell(data.raw)
    if (scalar === '') return null
    return (
      <div className='nxcp-result'>
        <div className='nxcp-result-caption'>{t('copilot.result.label')}</div>
        <p className='nxcp-result-scalar'>{scalar}</p>
      </div>
    )
  }

  const visible = data.rows.slice(0, maxRows)

  return (
    <div className='nxcp-result'>
      <div className='nxcp-result-caption'>{t('copilot.result.label')}</div>
      <div className='nxcp-result-scroll'>
        <table className='nxcp-table'>
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
      {data.rows.length > visible.length ? (
        <p className='nxcp-result-more'>
          {t('copilot.result.more', { shown: visible.length, total: data.rows.length })}
        </p>
      ) : null}
    </div>
  )
}
