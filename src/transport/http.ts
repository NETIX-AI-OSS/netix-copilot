// Thin fetch wrapper. The SDK owns its own HTTP so it works identically inside viz-ui (SWR) and
// cafm-v2-ui (react-query) without depending on either.

// A DRF error body is a JSON object carrying a `detail` string. A router or a proxy answering 404
// carries HTML, plain text or nothing, so this is what separates "no such route" from "no such
// resource": ml-engine raises NotFound("No such thread.") from a route that is deployed and ran.
function readDetail(body: string): string | undefined {
  const trimmed = body.trim()
  if (!trimmed.startsWith('{')) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const detail = (parsed as Record<string, unknown>).detail
  if (typeof detail !== 'string') return undefined
  const text = detail.trim()
  return text === '' ? undefined : text
}

export class CopilotHttpError extends Error {
  readonly status: number
  readonly body: string
  // The `detail` the application itself sent back, when it was the application that answered.
  readonly detail: string | undefined

  constructor(status: number, body: string, message?: string) {
    const detail = readDetail(body)
    super(message ?? detail ?? `Copilot request failed with status ${status}`)
    this.name = 'CopilotHttpError'
    this.status = status
    this.body = body
    this.detail = detail
  }

  // True when the application answered rather than the router: the route exists, ran, and rejected
  // this particular resource. Never a reason to conclude anything about what the cluster deploys.
  get isResourceError(): boolean {
    return this.detail !== undefined
  }

  // 405 and 501 say this contract is not served here whatever the body. A 404 says it only when
  // nothing answered with a DRF error body.
  get isRouteMissing(): boolean {
    if (this.status === 405 || this.status === 501) return true
    return this.status === 404 && !this.isResourceError
  }
}

// True only when the answer says this cluster does not serve the route, never when it says the
// named resource is gone. Degrading a transport is a durable decision and needs the stronger claim.
export function isRouteMissing(error: unknown): boolean {
  return error instanceof CopilotHttpError && error.isRouteMissing
}

// A 404 that carried a DRF `detail` is about the resource, not the route, and must reach the user.
export function isResourceError(error: unknown): boolean {
  return error instanceof CopilotHttpError && error.isResourceError
}

export type CopilotFetch = (input: string, init?: RequestInit) => Promise<Response>

export type AuthTokenProvider = () => string | null | undefined | Promise<string | null | undefined>

export interface HttpConfig {
  baseUrl: string
  getAuthToken?: AuthTokenProvider
  fetchImpl?: CopilotFetch
  // Extra headers merged into every request, for example an organization or tenant header.
  headers?: Record<string, string>
}

export function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export async function buildHeaders(
  config: HttpConfig,
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...config.headers, ...extra }
  const token = await config.getAuthToken?.()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function resolveFetch(config: HttpConfig): CopilotFetch {
  if (config.fetchImpl) return config.fetchImpl
  if (typeof fetch === 'function') return (input, init) => fetch(input, init)
  throw new Error('netix-copilot requires a fetch implementation.')
}

export interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
  accept?: string
}

// Perform a request and return the raw Response, throwing CopilotHttpError on a non-2xx.
export async function request(
  config: HttpConfig,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const method = options.method ?? 'GET'
  const headers = await buildHeaders(config, {
    Accept: options.accept ?? 'application/json',
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  })
  const init: RequestInit = { method, headers }
  if (options.body !== undefined) init.body = JSON.stringify(options.body)
  if (options.signal) init.signal = options.signal

  const response = await resolveFetch(config)(joinUrl(config.baseUrl, path), init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new CopilotHttpError(response.status, body)
  }
  return response
}

export async function requestJson<T>(
  config: HttpConfig,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await request(config, path, options)
  const text = await response.text()
  if (text.trim() === '') return {} as T
  return JSON.parse(text) as T
}
