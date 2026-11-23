import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import PhoneSimulator from './PhoneSimulator'
import ToolbarIcon from './ToolbarIcon'
import ToolbarSelect from './ToolbarSelect'

import type { Workspace } from './workspace'
import { changeWorkspace, readSharedPreference, readSharedProjects, saveSharedPreferences } from './workspaceClient'

const STORAGE_KEY = 'framedock.projects'
const THEME_KEY = 'framedock.theme'
const projectNameOrder = new Intl.Collator('en', { sensitivity: 'base' })

function alphabeticalName(name: string): string {
  return name.replace(/[\p{P}\p{S}]/gu, '').trim()
}

function readTheme() {
  try {
    const saved = readSharedPreference(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Use the system preference when storage is unavailable.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
const defaults: Workspace = { projects: [], selectedId: '' }

function previewUrl(input: string): string {
  if (!input || input.startsWith('/')) throw new Error('Enter a hostname, IP address, port, or full URL.')
  const hasOnlyPort = /^\d+$/.test(input)
  const url = hasOnlyPort
    ? new URL(window.location.origin)
    : new URL(input.includes('://') ? input : `${window.location.protocol}//${input}`)
  if (hasOnlyPort) {
    if (Number(input) < 1 || Number(input) > 65535) throw new Error('Enter a port from 1 to 65535.')
    url.port = input
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS URL without sign-in details.')
  }
  if (url.origin === window.location.origin) throw new Error('Choose an app outside FrameDock.')
  if (window.location.protocol === 'https:' && url.protocol === 'http:') {
    throw new Error('Use an HTTPS app address when FrameDock is served over HTTPS.')
  }
  return url.href
}

function readWorkspace(): Workspace {
  try {
    const shared = readSharedProjects()
    const cached = shared ? null : localStorage.getItem(STORAGE_KEY)
    const { projects, selectedId } = shared ?? (cached ? JSON.parse(cached) as Workspace : defaults)
    const valid = projects.filter((project) => {
      if (!project.id || !project.name || !project.url) return false
      try {
        return previewUrl(project.url) === project.url
      } catch {
        return false
      }
    })
    return {
      projects: valid,
      selectedId: valid.some((project) => project.id === selectedId) ? selectedId : valid[0]?.id ?? '',
    }
  } catch {
    return defaults
  }
}

const controlClass = 'min-h-10 rounded-lg border border-forest-200 bg-white px-3 text-sm text-charcoal'
const buttonClass = controlClass + ' font-medium hover:bg-forest-50'

export default function App() {
  const [theme, setTheme] = useState(readTheme)
  const [workspace, setWorkspace] = useState(readWorkspace)
  const [editor, setEditor] = useState<'add' | 'edit' | null>(null)
  const [error, setError] = useState('')
  const [editorPosition, setEditorPosition] = useState({ top: 52, left: 8 })
  const editorPopover = useRef<HTMLDivElement>(null)
  const active = workspace.projects.find((project) => project.id === workspace.selectedId) ?? workspace.projects[0]
  const orderedProjects = [...workspace.projects].sort((a, b) =>
    projectNameOrder.compare(alphabeticalName(a.name), alphabeticalName(b.name)),
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    } catch {
      // The current browser session still works when storage is disabled.
    }
  }, [workspace])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b201f' : '#ffffff')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // The toggle still works for this visit.
    }
  }, [theme])

  function toggleEditor(mode: 'add' | 'edit', event: MouseEvent<HTMLButtonElement>) {
    if (editor === mode && editorPopover.current?.matches(':popover-open')) {
      event.preventDefault()
      closeEditor()
      return
    }

    const button = event.currentTarget.getBoundingClientRect()
    setEditorPosition({
      top: button.bottom + 12,
      left: Math.max(8, Math.min(button.left, window.innerWidth - 408)),
    })
    setEditor(mode)
    setError('')
  }

  function closeEditor() {
    editorPopover.current?.hidePopover()
    setEditor(null)
    setError('')
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const address = String(form.get('url') ?? '').trim()
      const url = previewUrl(address)
      const name = String(form.get('name') ?? '').trim() || new URL(url).host
      const editing = editor === 'edit' && active
      const project = { id: editing ? editing.id : url + '-' + Date.now(), name, url, address }
      const result = await changeWorkspace({ type: 'project', project, editing: Boolean(editing) })
      setWorkspace(result.workspace)
      closeEditor()
    } catch (error) {
      setError(error instanceof TypeError ? 'Enter a full app URL or a port number.' : (error as Error).message)
    }
  }

  async function deleteProject() {
    if (!active || !window.confirm('Delete ' + active.name + ' from FrameDock?')) return
    try {
      const result = await changeWorkspace({ type: 'delete', id: active.id })
      setWorkspace(result.workspace)
      closeEditor()
    } catch {
      setError('FrameDock could not remove the project on Spark.')
    }
  }

  async function selectProject(id: string) {
    try {
      const result = await changeWorkspace({ type: 'select', id })
      setWorkspace(result.workspace)
      closeEditor()
    } catch {
      console.warn('FrameDock could not switch the shared project on Spark.')
    }
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveSharedPreferences({ [THEME_KEY]: next })
  }

  return (
    <PhoneSimulator
      project={active ?? null}
      dark={theme === 'dark'}
      toggleTheme={toggleTheme}
      projectControls={
          <>
            <h1 className="mr-1 shrink-0" title="FrameDock">
              <span
                role="img"
                aria-label="FrameDock"
                className="block h-8 w-8 bg-current"
                style={{
                  mask: 'url(/framedock-mark.png) center / contain no-repeat',
                  WebkitMask: 'url(/framedock-mark.png) center / contain no-repeat',
                }}
              />
            </h1>
            <ToolbarSelect
              label="Project"
              className="flex h-9 w-28 shrink-0 items-center justify-between gap-2 rounded-lg border border-forest-200 bg-white px-2.5 text-left text-sm text-charcoal hover:bg-forest-50 disabled:opacity-40 sm:w-36"
              menuWidth={320}
              value={active?.id ?? ''}
              emptyLabel="No projects"
              groups={[{ options: orderedProjects.map((project) => ({ value: project.id, label: project.name, detail: project.address ?? project.url.replace(/^(https?:\/\/[^/]+)\/$/, '$1') })) }]}
              onSelect={(id) => { void selectProject(id) }}
            />
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-forest-200 text-charcoal-soft hover:bg-forest-50 disabled:opacity-40" type="button" aria-label="Edit URL" disabled={!active} popoverTarget="project-editor" popoverTargetAction="show" aria-expanded={editor === 'edit'} onClick={(event) => toggleEditor('edit', event)}>
              <ToolbarIcon name="edit" />
            </button>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-forest-200 text-charcoal-soft hover:bg-forest-50" type="button" aria-label="Add project" popoverTarget="project-editor" popoverTargetAction="show" aria-expanded={editor === 'add'} onClick={(event) => toggleEditor('add', event)}>
              <ToolbarIcon name="add" />
            </button>
          </>
      }
      projectEditor={
        <div
          id="project-editor"
          ref={editorPopover}
          popover="auto"
          role="dialog"
          aria-labelledby="project-editor-title"
          onToggle={(event) => {
            if (event.newState === 'closed' && !event.currentTarget.matches(':popover-open')) {
              setEditor(null)
              setError('')
            }
          }}
          style={editorPosition}
          className="theme-flyout fixed inset-auto m-0 w-[calc(100vw-16px)] max-w-[400px] rounded-xl border border-forest-200 bg-white p-4 text-charcoal shadow-xl"
        >
          {editor && (
            <form key={editor + (active?.id ?? '')} className="space-y-3" onSubmit={saveProject}>
              <h2 id="project-editor-title" className="text-sm font-semibold">{editor === 'edit' ? 'Edit project' : 'Add project'}</h2>
              <input aria-label="Project name" name="name" className={controlClass + ' w-full'} placeholder="Project name" defaultValue={editor === 'edit' ? active?.name : ''} />
              <input aria-label="App address" name="url" className={controlClass + ' w-full'} placeholder="e.g. devbox.local:3000 or 3000" defaultValue={editor === 'edit' ? active?.address ?? active?.url : ''} required autoFocus />
              {error && <p role="alert" className="text-sm text-[#b54d52]">{error}</p>}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {editor === 'edit' && active && (
                  <button type="button" className={buttonClass + ' mr-auto text-[#b54d52]'} onClick={deleteProject}>Delete project</button>
                )}
                <button type="button" className={buttonClass} onClick={closeEditor}>Cancel</button>
                <button type="submit" className={buttonClass}>Save</button>
              </div>
            </form>
          )}
        </div>
      }
    />
  )
}
