/** LAI archive filtering uses the same DSH authenticated session catalog as Runs. */
export async function archivedRuns(): Promise<{ archivedSessionIds: string[] }> {
  const response = await fetch('/lai-api/runs/archives', { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Could not read archived runs (${response.status})`)
  return response.json() as Promise<{ archivedSessionIds: string[] }>
}
