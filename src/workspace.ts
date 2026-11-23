export interface Project {
  id: string
  name: string
  url: string
  address?: string
}

export interface Workspace {
  projects: Project[]
  selectedId: string
}

export const preferenceKeys = [
  'framedock.theme', 'phone-preview.mode', 'phone-preview.preset',
  'phone-preview.preset.iphone', 'phone-preview.preset.android',
] as const

export type Preferences = Partial<Record<(typeof preferenceKeys)[number], string>>

export interface Snapshot {
  workspace: Workspace
  preferences: Preferences
}

export type WorkspaceChange =
  | { type: 'import'; workspace: Workspace; preferences: Preferences }
  | { type: 'project'; project: Project; editing: boolean }
  | { type: 'delete' | 'select'; id: string }
  | { type: 'preferences'; preferences: Preferences }
