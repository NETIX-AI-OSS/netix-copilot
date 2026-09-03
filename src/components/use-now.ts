import { useEffect, useRef, useState } from 'react'

export type NowFn = () => number

// The clock behind every live counter in the trace. It ticks only while `active`, holds its
// last reading once the run stops, and is undefined until the first tick so no render ever
// reads the wall clock. `now` is injectable for tests.
export function useNow(
  active: boolean,
  now: NowFn = Date.now,
  intervalMs = 1000,
): number | undefined {
  const [value, setValue] = useState<number | undefined>(undefined)
  const nowRef = useRef(now)
  useEffect(() => {
    nowRef.current = now
  }, [now])
  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => setValue(nowRef.current()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return value
}

// A value that follows `value` with a trailing delay, so a live region fed from it changes at
// most once per `delayMs` however fast the source moves.
export function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return settled
}
