/** Provider-specific endpoint rules for the pinned DSH adapter APIs. */
export const DEEPSEEK_MESSAGES_URL = 'https://api.deepseek.com/anthropic'

/**
 * Refuse an endpoint that would send the native DeepSeek Messages adapter to the Chat Completions root.
 * @param namespace - DSH settings namespace owning the selected provider.
 * @param value - Optional endpoint override from the form.
 */
export function validateProviderEndpoint(namespace: string, value: string): void {
  if (!value.trim()) return
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS endpoint without credentials in the URL.')
  }
  if (namespace === 'llm-deepseek' && url.hostname === 'api.deepseek.com' && ['', '/v1'].includes(url.pathname.replace(/\/+$/, ''))) {
    throw new Error(`The built-in DeepSeek provider uses the Messages API. Set the endpoint to ${DEEPSEEK_MESSAGES_URL}. For an OpenAI-compatible API, add a custom provider instead.`)
  }
}
