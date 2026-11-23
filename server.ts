import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { relayPortFor, readStatusBar } from './relay'
import { preferenceKeys, type Preferences, type Project, type Snapshot, type Workspace, type WorkspaceChange } from './src/workspace'

const root = resolve('dist')
const data = process.env.FRAMEDOCK_DATA_DIR || '/data'
const stateFile = join(data, 'workspace.json')

interface StoredWorkspace extends Snapshot {
  removedUrls: string[]
}

function readState(): StoredWorkspace {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8')) as StoredWorkspace
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return { workspace: { projects: [], selectedId: '' }, preferences: {}, removedUrls: [] }
  }
}

mkdirSync(data, { recursive: true })
let state = readState()

function saveState(next: StoredWorkspace) {
  const temporary = stateFile + '.tmp'
  writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 })
  renameSync(temporary, stateFile)
  state = next
}

function snapshot(): Snapshot {
  return { workspace: state.workspace, preferences: state.preferences }
}

function validProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const { id, name, url, address } = value as Partial<Project>
  if (typeof id !== 'string' || id.length === 0 || id.length > 4200 ||
      typeof name !== 'string' || !name.trim() || name.length > 160 ||
      typeof url !== 'string' || url.length > 4096 ||
      (address !== undefined && (typeof address !== 'string' || address.length > 4096))) return false
  try {
    const target = new URL(url)
    return (target.protocol === 'http:' || target.protocol === 'https:') && !target.username && !target.password
  } catch {
    return false
  }
}

function workspaceWithSelection(projects: Project[], selectedId: string): Workspace {
  return { projects, selectedId: projects.some((project) => project.id === selectedId) ? selectedId : projects[0]?.id ?? '' }
}

function validatedPreferences(value: unknown): Preferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const output: Preferences = {}
  for (const [key, setting] of Object.entries(value)) {
    if (!preferenceKeys.includes(key as keyof Preferences) || typeof setting !== 'string' || setting.length > 64) return null
    output[key as keyof Preferences] = setting
  }
  return output
}

function applyChange(change: WorkspaceChange): StoredWorkspace | null {
  const { workspace, preferences, removedUrls } = state
  switch (change.type) {
    case 'import': {
      const incoming = change.workspace
      const importedPreferences = validatedPreferences(change.preferences)
      if (!incoming || !Array.isArray(incoming.projects) || !importedPreferences) return null
      const byUrl = new Set([...workspace.projects.map((project) => project.url), ...removedUrls])
      const byId = new Set(workspace.projects.map((project) => project.id))
      const projects = [...workspace.projects]
      for (const project of incoming.projects) {
        if (!validProject(project) || byUrl.has(project.url) || byId.has(project.id)) continue
        projects.push(project)
        byUrl.add(project.url)
        byId.add(project.id)
      }
      if (projects.length > 250) return null
      return {
        ...state,
        workspace: workspaceWithSelection(projects, workspace.selectedId || incoming.selectedId),
        preferences: { ...importedPreferences, ...preferences },
      }
    }
    case 'project': {
      const project = change.project
      if (!validProject(project)) return null
      const previous = workspace.projects.find((item) => item.id === project.id)
      if (!previous && (change.editing || workspace.projects.length >= 250)) return null
      const projects = previous
        ? workspace.projects.map((item) => item.id === project.id ? project : item)
        : [...workspace.projects, project]
      return {
        ...state,
        workspace: { projects, selectedId: project.id },
        removedUrls: previous && previous.url !== project.url ? [...new Set([...removedUrls, previous.url])] : removedUrls,
      }
    }
    case 'delete': {
      const index = workspace.projects.findIndex((project) => project.id === change.id)
      if (index === -1) return state
      const projects = workspace.projects.filter((project) => project.id !== change.id)
      const selectedId = workspace.selectedId === change.id ? projects[index]?.id ?? projects.at(-1)?.id ?? '' : workspace.selectedId
      return {
        ...state,
        workspace: workspaceWithSelection(projects, selectedId),
        removedUrls: [...new Set([...removedUrls, workspace.projects[index].url])],
      }
    }
    case 'select':
      return { ...state, workspace: workspaceWithSelection(workspace.projects, change.id) }
    case 'preferences': {
      const next = validatedPreferences(change.preferences)
      return next ? { ...state, preferences: { ...preferences, ...next } } : null
    }
    default:
      return null
  }
}

Bun.serve({
  hostname: '0.0.0.0',
  port: 80,
  maxRequestBodySize: 512 * 1024,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/api/relay' && request.method === 'GET') {
      try {
        const target = new URL(url.searchParams.get('url') ?? '')
        const known = state.workspace.projects.some((project) => { try { return new URL(project.url).origin === target.origin } catch { return false } })
        const status = known ? await readStatusBar(target.href) : null
        const port = known ? relayPortFor(target.origin) : null
        return port ? Response.json({ port, status }, { headers: { 'Cache-Control': 'no-store' } }) : new Response(null, { status: 404 })
      } catch {
        return new Response(null, { status: 400 })
      }
    }
    if (url.pathname === '/api/workspace') {
      const headers = { 'Cache-Control': 'no-store' }
      if (request.method === 'GET') return Response.json(snapshot(), { headers })
      if (request.method !== 'POST') return new Response(null, { status: 405, headers })
      if (request.headers.get('origin') !== url.origin) return new Response(null, { status: 403, headers })
      if (!request.headers.get('content-type')?.startsWith('application/json')) {
        return new Response(null, { status: 415, headers })
      }
      let change: WorkspaceChange
      try {
        change = await request.json() as WorkspaceChange
      } catch {
        return new Response(null, { status: 400, headers })
      }
      const next = change && applyChange(change)
      if (!next) return new Response(null, { status: 400, headers })
      try {
        if (next !== state) saveState(next)
      } catch {
        return new Response(null, { status: 503, headers })
      }
      return Response.json(snapshot(), { headers })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 })
    let filePath: string
    try {
      filePath = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    } catch {
      return new Response(null, { status: 400 })
    }
    if (!filePath.startsWith(root + sep)) return new Response(null, { status: 404 })
    const file = Bun.file(filePath)
    if (!await file.exists()) return new Response(null, { status: 404 })
    const isAsset = url.pathname.startsWith('/assets/')
    const headers = new Headers({
      'Content-Type': file.type,
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    let body = file
    if (isAsset && /\.(js|css)$/.test(filePath)) {
      headers.set('Vary', 'Accept-Encoding')
      const acceptsGzip = request.headers.get('accept-encoding')?.split(',').some((entry) => {
        const [encoding, quality] = entry.trim().split(';', 2)
        return encoding.trim().toLowerCase() === 'gzip' &&
          (quality === undefined || Number(quality.trim().split('=')[1]) > 0)
      })
      const compressed = Bun.file(filePath + '.gz')
      if (acceptsGzip && await compressed.exists()) {
        body = compressed
        headers.set('Content-Encoding', 'gzip')
      }
    }
    headers.set('Content-Length', String(body.size))
    return new Response(request.method === 'HEAD' ? null : body, { headers })
  },
})
