/** Authenticated human management API; never used by model-facing tools. */
export type SecretField = 'username' | 'token' | 'password'
export type CredentialStatus = Record<string, Record<SecretField, boolean>>
export async function credentialStatus(): Promise<CredentialStatus> {
  const response = await fetch('/lai-api/credentials/status', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new Error(`Credential status unavailable (${response.status})`)
  return response.json() as Promise<CredentialStatus>
}
export async function revealCredential(id: string, field: SecretField): Promise<string> {
  const response = await fetch('/lai-api/credentials/reveal', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json', 'x-lai-credentials': '1' }, body: JSON.stringify({ id, field }) })
  if (!response.ok) throw new Error(`Credential reveal failed (${response.status})`)
  const result = await response.json() as { value: string }
  return result.value
}
