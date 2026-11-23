import { preferenceKeys, type Preferences, type Snapshot, type Workspace, type WorkspaceChange } from './workspace'

const PROJECTS_KEY = 'framedock.projects'
const IMPORTED_KEY = 'framedock.workspaceImported'
let loaded: Snapshot | undefined
let queue: Promise<unknown> = Promise.resolve()

export function readSharedPreference(key: keyof Preferences): string | null {
  return loaded?.preferences[key] ?? localStorage.getItem(key)
}

export function readSharedProjects(): Workspace | undefined {
  return loaded?.workspace
}

export function changeWorkspace(change: WorkspaceChange): Promise<Snapshot> {
  const task = queue.then(async () => {
    const response = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('FrameDock could not save the workspace on Spark.')
    return loaded = await response.json() as Snapshot
  })
  queue = task.catch(() => {})
  return task
}

export function saveSharedPreferences(preferences: Preferences): void {
  void changeWorkspace({ type: 'preferences', preferences }).catch(() => {
    console.warn('FrameDock saved this preference in the current browser only.')
  })
}

export async function loadSharedWorkspace(): Promise<void> {
  try {
    const response = await fetch('/api/workspace', { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return
    loaded = await response.json() as Snapshot

    if (localStorage.getItem(IMPORTED_KEY)) return
    const raw = localStorage.getItem(PROJECTS_KEY)
    const preferences: Preferences = {}
    for (const key of preferenceKeys) {
      const value = localStorage.getItem(key)
      if (value) preferences[key] = value
    }
    if (raw || Object.keys(preferences).length) {
      const workspace = raw ? JSON.parse(raw) as Workspace : { projects: [], selectedId: '' }
      await changeWorkspace({ type: 'import', workspace, preferences })
    }
    localStorage.setItem(IMPORTED_KEY, '1')
  } catch {
    // The cached workspace remains available if Spark cannot be reached.
  }
}
