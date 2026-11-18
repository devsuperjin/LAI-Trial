export * from '@lai/dsh-adapter/gateway'
import { bootstrapWithToken as exchangeToken } from '@lai/dsh-adapter/gateway'

/** Use the normal authenticated root in production and the Vite proxy in development. */
export function bootstrapWithToken(token: string): Promise<void> {
  return exchangeToken(token, import.meta.env.DEV ? '/dsh-auth' : '/')
}
