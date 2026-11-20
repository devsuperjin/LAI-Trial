export interface CredentialEntry {
  kind?: 'generic' | 'api' | 'ssh'
  endpoint?: string
  host?: string
  port?: number
  description?: string
  service?: string
  enabled?: boolean
  allowUpdates?: boolean
  allowedPresets?: string[]
}
export interface CredentialDraft {
  id: string; kind: 'generic' | 'api' | 'ssh'; endpoint: string; host: string; port: string
  description: string; service: string; username: string; token: string; password: string
  enabled: boolean; allowUpdates: boolean; allowedPresets: string[]; existing: boolean
}
export const emptyCredential = (): CredentialDraft => ({ id: '', kind: 'generic', endpoint: '', host: '', port: '', description: '', service: '', username: '', token: '', password: '', enabled: true, allowUpdates: false, allowedPresets: [], existing: false })
export function editCredential(id: string, entry: CredentialEntry): CredentialDraft {
  return { ...emptyCredential(), ...entry, id, port: entry.port ? String(entry.port) : '', allowedPresets: [...entry.allowedPresets ?? []], existing: true }
}
