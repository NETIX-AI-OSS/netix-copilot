// Thin fetch wrapper. The SDK owns its own HTTP so it works identically inside viz-ui (SWR) and
// cafm-v2-ui (react-query) without depending on either.

export class CopilotHttpError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Copilot request failed with status ${status}`)
    this.name = 'CopilotHttpError'
    this.status = status
    this.body = body
  }

  // 404/405/501 on the stream endpoint means the streaming route is not deployed yet.
  get isRouteMissing(): boolean {
    return this.status === 404 || this.status === 405 || this.status === 501
  }
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
