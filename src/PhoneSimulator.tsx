import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import DraggableRestoreButton from './DraggableRestoreButton'
import ToolbarIcon from './ToolbarIcon'
import ToolbarSelect from './ToolbarSelect'
import { DEVICE_GROUPS, PRESETS } from './devicePresets'
import { readSharedPreference, saveSharedPreferences } from './workspaceClient'

const DEFAULT_PRESET_ID = 'iphone-18-pro-max'
const MODE_KEY = 'phone-preview.mode'
const PRESET_KEY = 'phone-preview.preset'
const ZOOM_LEVELS = [0, 1, 1.2, 1.5, 2]

type Mode = 'frame' | 'fill'
type Orientation = 'portrait' | 'landscape'
type ScrollPosition = { left: number; top: number }

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function useLocalClock() {
  const [time, setTime] = useState(() => clockFormat.format(new Date()))

  useEffect(() => {
    let timer: number
    function update() {
      window.clearTimeout(timer)
      const now = new Date()
      setTime(clockFormat.format(now))
      timer = window.setTimeout(update, 60_000 - (now.getTime() % 60_000))
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return time
}

const iconButton = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-forest-200 text-charcoal-soft hover:bg-forest-50 disabled:opacity-40'

function frameCorners(radius: number): CSSProperties {
  return {
    '--corner-radius': `${radius}px`,
    '--corner-x': `${radius * 1.55}px`,
  } as CSSProperties
}

function readMode(): Mode {
  try {
    return readSharedPreference(MODE_KEY) === 'fill' ? 'fill' : 'frame'
  } catch {
    return 'frame'
  }
}

function normalizePreset(id: unknown) {
  if (id === 'duo-open-landscape') return 'duo-open-portrait'
  if (id === 'pixel-9-pro-xl') return 'pixel-11-pro-xl'
  return id
}

function readDevices() {
  const defaults = { active: DEFAULT_PRESET_ID, iphone: DEFAULT_PRESET_ID, android: 'pixel-11-pro-xl', rotated: false }
  try {
    const savedActive = readSharedPreference(PRESET_KEY)
    const active = PRESETS.find((preset) => preset.id === normalizePreset(savedActive))
    const iphoneId = normalizePreset(readSharedPreference('phone-preview.preset.iphone'))
    const androidId = normalizePreset(readSharedPreference('phone-preview.preset.android'))
    const iphone = PRESETS.find((preset) => preset.platform === 'iphone' && preset.id === iphoneId)
    const android = PRESETS.find((preset) => preset.platform === 'android' && preset.id === androidId)
    return {
      active: active?.id ?? defaults.active,
      rotated: savedActive === 'duo-open-landscape',
      iphone: active?.platform === 'iphone' ? active.id : iphone?.id ?? defaults.iphone,
      android: active?.platform === 'android' ? active.id : android?.id ?? defaults.android,
    }
  } catch {
    return defaults
  }
}

function StatusBarIcons({ className = '' }: { className?: string } = {}) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`} aria-hidden="true">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
        <rect x="0" y="8" width="3" height="4" rx="0.75" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="0.75" />
        <rect x="10" y="3" width="3" height="9" rx="0.75" />
        <rect x="15" y="0.5" width="3" height="11.5" rx="0.75" />
      </svg>
      <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M1.5 4.2a10 10 0 0 1 13 0" />
        <path d="M3.8 6.8a6.5 6.5 0 0 1 8.4 0" />
        <path d="M6.1 9.3a3 3 0 0 1 3.8 0" />
        <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect
          x="0.75"
          y="1"
          width="21"
          height="10"
          rx="2.5"
          stroke="currentColor"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
        <rect x="2.25" y="2.5" width="17" height="7" rx="1.25" fill="currentColor" />
        <path d="M23.25 4v4c1.2-.3 1.2-3.7 0-4Z" fill="currentColor" fillOpacity="0.4" />
      </svg>
    </span>
  )
}

function DeviceCutout({ camera, cameraSize = 20, statusBar }: {
  camera?: (typeof PRESETS)[number]['camera']
  cameraSize?: number
  statusBar: number
}) {
  return (
    <>
      {camera === 'island' ? (
        <span
          data-testid="dynamic-island"
          className="absolute left-1/2 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black [corner-shape:superellipse(1.15)]"
          style={{ top: (statusBar - 37) / 2 }}
        />
      ) : null}
      {camera === 'notch' ? (
        <span data-testid="notch" className="absolute left-1/2 top-0 h-[34px] w-[162px] -translate-x-1/2 rounded-b-[22px] bg-black" />
      ) : null}
      {camera === 'hole' ? (
        <span
          data-testid="punch-hole-camera"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
          style={{ width: cameraSize, height: cameraSize }}
        />
      ) : null}
    </>
  )
}

/**
 * Dev-only phone mockup. The framed iframe loads the selected app directly in the browser.
 *
 * The outer frame scales to fit the browser while the iframe keeps its device
 * viewport. Fill mode stretches the same iframe to the whole window without
 * remounting it, so app state survives.
 */
function luminance(color: string): number {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!hex) return 1
  const h = hex[1].length === 3 ? hex[1].split('').map((ch) => ch + ch).join('') : hex[1]
  const [red, green, blue] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export default function PhoneSimulator({ project, projectControls, projectEditor, dark, toggleTheme }: {
  project: { id: string; name: string; url: string } | null
  projectControls: ReactNode
  projectEditor: ReactNode
  dark: boolean
  toggleTheme: () => void
}) {
  const time = useLocalClock()
  const [devices, setDevices] = useState(readDevices)
  const presetId = devices.active
  const [rotated, setRotated] = useState(devices.rotated)
  const [mode, setModeLocal] = useState<Mode>(readMode)
  const [reloadCount, setReloadCount] = useState(0)
  const [relay, setRelay] = useState<{ for: string; url: string } | null>(null)
  const [touchProject, setTouchProject] = useState<string | null>(null)
  const handshakeFrame = useRef<HTMLIFrameElement | null>(null)
  const relayTimer = useRef<number | undefined>(undefined)
  const [relayDecided, setRelayDecided] = useState<string | null>(null)
  const [pageStatus, setPageStatus] = useState<{ for: string; translucent: boolean; declared: boolean; color: string | null } | null>(null)
  const [appViewport, setAppViewport] = useState<{ key: string; frame: HTMLIFrameElement; dark: boolean; canvasColor?: string; scrolled: boolean } | null>(null)
  const [readyPreview, setReadyPreview] = useState<{ key: string; frame: HTMLIFrameElement } | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const loadedFrame = useRef<HTMLIFrameElement | null>(null)
  const fallbackTimer = useRef<number | undefined>(undefined)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const lastRotation = useRef(rotated)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const stageScroll = useRef<{ key: string; positions: Partial<Record<Orientation, ScrollPosition>> }>({ key: '', positions: {} })
  const [fitScale, setFitScale] = useState(1)
  const [stageHeight, setStageHeight] = useState(0)
  const [zoom, setZoom] = useState(0)
  const zoomedIn = zoom > 1
  const rawScale = zoomedIn ? zoom : zoom === 1 ? Math.min(1, fitScale) : fitScale

  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]
  const isFill = mode === 'fill' && project !== null
  const isIPhone = preset.platform === 'iphone'
  const isAndroid = preset.platform === 'android'
  const hasContinuousFrame = preset.camera !== undefined || isAndroid || (preset.platform === 'iphone' && preset.id !== 'se')
  const shellRadius = preset.screenRadius + preset.shellPadding
  const screenWidth = rotated ? preset.height : preset.width
  const screenHeight = rotated ? preset.width : preset.height
  const isLandscape = screenWidth > screenHeight
  // The device is scaled with CSS zoom, not a transform: Chromium composites a transformed iframe's scrolling and
  // fixed layers separately, and at fractional scales they disagree by a pixel row, so page text peeks past a fixed
  // header. Zoom re-lays the frame out at its final size, so every layer lands on the same pixels. The scale is
  // rounded down so the screen is a whole number of device pixels wide, and the page area is rounded up to whole
  // device pixels so the page never sees a viewport smaller than the device.
  const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const scale = Math.max(0.05, Math.floor(rawScale * screenWidth * pixelRatio + 1e-6) / (screenWidth * pixelRatio))
  // Safari can apply ancestor CSS zoom to iframe content a second time.
  const ua = navigator.userAgent
  const useTransformScale = /AppleWebKit/.test(ua) &&
    (/iPhone|iPad|iPod/.test(ua) || !/Chrome|Chromium|Edg|OPR/.test(ua))
  const wholePixels = (size: number) => useTransformScale ? size : Math.ceil(size * scale * pixelRatio - 1e-6) / (scale * pixelRatio) + 0.001
  const orientation = isLandscape ? 'landscape' : 'portrait'
  const scrollKey = JSON.stringify([project?.id, project?.url, presetId, zoom])
  const landscapeCutout = isLandscape && preset.camera !== undefined
  const statusBar = landscapeCutout ? 0 : preset.statusBar
  const rightInset = preset.rightInset ?? 0
  const sideSafeArea = landscapeCutout ? preset.statusBar : 0
  const bottomInset = landscapeCutout && !isAndroid ? 21 : preset.bottomInset
  const relayActive = project !== null && relay?.for === project.url
  const touchEnabled = !isFill && relayActive && touchProject === project?.url
  const frameUrl = relayActive && relay ? relay.url : project?.url ?? ''
  const frameKey = JSON.stringify([project?.id, frameUrl, reloadCount])
  const appOrigin = project ? new URL(frameUrl).origin : ''
  const projectUrl = project?.url

  // Set up safe areas and touch on the relay before loading the preview.
  async function enableRelay() {
    if (!project || (relayActive && pageStatus?.for === project.url)) return
    const decidingFor = project.url
    try {
      const answer = await fetch('/api/relay?url=' + encodeURIComponent(project.url))
      if (!answer.ok) return
      const body = await answer.json() as { port?: number; status?: { translucent: boolean; declared: boolean; color: string | null } | null }
      if (body.status) setPageStatus({ for: project.url, ...body.status })
      if (!body.port) return
      const port = body.port
      const target = new URL(project.url)
      setRelay({ for: project.url, url: location.protocol + '//' + location.hostname + ':' + port + target.pathname + target.search })
    } catch { /* relay unavailable: keep the direct preview */ }
    finally { setRelayDecided(decidingFor) }
  }
  useEffect(() => {
    if (projectUrl) void enableRelay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUrl])
  const previewLoading = readyPreview?.key !== frameKey || readyPreview.frame !== iframeRef.current
  const viewport = appViewport?.key === frameKey && appViewport.frame === iframeRef.current ? appViewport : null
  // An installed iPhone web app gets a solid status bar unless the page asks for the translucent one.
  const statusKnown = project && pageStatus?.for === project.url ? pageStatus : null
  const solidStatus = isIPhone && !isFill && statusBar > 0 && statusKnown !== null && statusKnown.declared && !statusKnown.translucent
  const declaredColor = statusKnown?.color
  const solidColor = declaredColor && (!viewport || (luminance(declaredColor) < 0.5) === viewport.dark)
    ? declaredColor
    : viewport?.dark ? '#000000' : '#ffffff'
  const solidDark = luminance(solidColor) < 0.5
  const innerWidth = screenWidth - rightInset - (viewport ? 0 : sideSafeArea)
  const innerHeight = screenHeight - (viewport ? (solidStatus ? statusBar : 0) : statusBar + bottomInset)
  const sideButtonWidth = hasContinuousFrame ? 6 : 0
  const frameWidth = screenWidth + 2 * preset.shellPadding + (isLandscape ? 0 : sideButtonWidth)
  const frameHeight = screenHeight + 2 * preset.shellPadding + (isLandscape ? sideButtonWidth : 0)
  const horizontalOnly = isLandscape && (!zoomedIn || frameHeight * scale <= stageHeight)
  const portraitFrameWidth = Math.min(preset.width, preset.height) + 2 * preset.shellPadding + sideButtonWidth
  const portraitFrameHeight = Math.max(preset.width, preset.height) + 2 * preset.shellPadding

  const sendViewport = useCallback(() => {
    if (!appOrigin) return
    const insets = {
      top: isFill || solidStatus ? 0 : statusBar,
      right: isFill ? 0 : sideSafeArea,
      bottom: isFill ? 0 : bottomInset,
      left: isFill || isAndroid ? 0 : sideSafeArea,
    }
    iframeRef.current?.contentWindow?.postMessage({ type: 'framedock:viewport', insets, platform: preset.platform, touch: touchEnabled }, appOrigin)
  }, [appOrigin, isFill, solidStatus, statusBar, sideSafeArea, bottomInset, isAndroid, preset.platform, touchEnabled])

  useEffect(() => {
    const receiveViewport = (event: MessageEvent) => {
      const frame = iframeRef.current
      if (!frame || event.source !== frame.contentWindow || event.origin !== appOrigin) return
      const data = event.data
      if (data?.type === 'framedock:viewport-ready' && typeof data.dark === 'boolean' && (!relayActive || data.relay === true)) {
        const dark = data.dark
        const scrolled = data.scrolled === true
        const canvasColor = typeof data.canvasColor === 'string' && /^rgb\(\d+, \d+, \d+\)$/.test(data.canvasColor)
          ? data.canvasColor : undefined
        handshakeFrame.current = frame
        const updateViewport = () => setAppViewport((current) =>
          current?.frame === frame && current.dark === dark && current.canvasColor === canvasColor && current.scrolled === scrolled
            ? current : { key: frameKey, frame, dark, canvasColor, scrolled })
        if (viewport?.dark !== undefined && viewport.dark !== dark) flushSync(updateViewport)
        else updateViewport()
        window.clearTimeout(fallbackTimer.current)
        setReadyPreview((current) => current?.frame === frame ? current : { key: frameKey, frame })
      }
    }

    window.addEventListener('message', receiveViewport)
    sendViewport()
    return () => window.removeEventListener('message', receiveViewport)
  }, [appOrigin, frameKey, relayActive, sendViewport, viewport?.dark])

  useLayoutEffect(() => () => window.clearTimeout(fallbackTimer.current), [frameKey])


  function onPreviewLoad(frame: HTMLIFrameElement) {
    if (frame !== iframeRef.current) return
    if (loadedFrame.current === frame) {
      setAppViewport(null)
      setReadyPreview(null)
    }
    loadedFrame.current = frame
    window.clearTimeout(fallbackTimer.current)
    sendViewport()
    window.clearTimeout(relayTimer.current)
    if (!relayActive) {
      relayTimer.current = window.setTimeout(() => {
        if (iframeRef.current === frame && handshakeFrame.current !== frame) void enableRelay()
      }, 1800)
    }
    // Pages that don't use the preview protocol can display after a short grace period.
    fallbackTimer.current = window.setTimeout(() => {
      if (iframeRef.current === frame) {
        setReadyPreview((current) => current?.frame === frame ? current : { key: frameKey, frame })
      }
    }, 140)
  }

  const rotationScale = useRef(scale)
  useLayoutEffect(() => {
    rotationScale.current = scale
  }, [scale])

  useLayoutEffect(() => {
    if (rotated === lastRotation.current) return
    lastRotation.current = rotated
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const angle = isLandscape ? '-90deg' : '90deg'
    const turnScale = rotationScale.current
    const keyframes = useTransformScale
      ? [{ transform: `rotate(${angle}) scale(${turnScale})` }, { transform: `rotate(0deg) scale(${turnScale})` }]
      : [{ rotate: angle }, { rotate: '0deg' }]
    const animation = shellRef.current?.animate?.(
      keyframes,
      { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    )
    return () => animation?.cancel()
  }, [rotated, isLandscape, useTransformScale])

  function setMode(next: Mode) {
    setModeLocal(next)
    saveSharedPreferences({ [MODE_KEY]: next })
  }

  function rotatePreview() {
    const stage = stageRef.current
    if (stage) {
      if (stageScroll.current.key !== scrollKey) {
        stageScroll.current = { key: scrollKey, positions: {} }
      }
      stageScroll.current.positions[orientation] = { left: stage.scrollLeft, top: stage.scrollTop }
    }
    setRotated((current) => !current)
  }

  function selectDevice(id: string) {
    const next = PRESETS.find((item) => item.id === id)
    if (!next || next.id === presetId) return
    const keepOrientation = isLandscape !== (next.width > next.height)
    lastRotation.current = keepOrientation
    setRotated(keepOrientation)
    setDevices((current) => ({
      ...current,
      active: id,
      iphone: next.platform === 'iphone' ? id : current.iphone,
      android: next.platform === 'android' ? id : current.android,
    }))
    saveSharedPreferences({
      [PRESET_KEY]: id,
      ...(next.platform === 'iphone' && { 'phone-preview.preset.iphone': id }),
      ...(next.platform === 'android' && { 'phone-preview.preset.android': id }),
    })
  }

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (isFill || !stage) return

    const fit = () => {
      const { clientWidth, clientHeight } = stage
      if (clientWidth && clientHeight) {
        // Use the same portrait-based scale on either side of a rotation.
        setFitScale(Math.min(
          clientWidth / (portraitFrameWidth + 36),
          stage.offsetHeight / (portraitFrameHeight + 56),
        ))
        setStageHeight(clientHeight)
        const saved = stageScroll.current.key === scrollKey && stageScroll.current.positions[orientation]
        if (isLandscape && !saved) {
          stage.scrollLeft = (stage.scrollWidth - clientWidth) / 2
        }
      }
    }

    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [isFill, isLandscape, frameWidth, frameHeight, portraitFrameWidth, portraitFrameHeight, orientation, scrollKey])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (isFill || !stage) return
    const saved = stageScroll.current.key === scrollKey && stageScroll.current.positions[orientation]
    if (saved) {
      stage.scrollTo(saved.left, saved.top)
    } else if (isLandscape) {
      stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
    }
  }, [isFill, isLandscape, frameWidth, scale, horizontalOnly, orientation, scrollKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_KEY, mode)
    } catch {
      // Private browsing; the choice simply is not remembered.
    }
  }, [mode])

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESET_KEY, devices.active)
      window.localStorage.setItem(PRESET_KEY + '.iphone', devices.iphone)
      window.localStorage.setItem(PRESET_KEY + '.android', devices.android)
    } catch {
      // The preview still works when storage is unavailable.
    }
  }, [devices])

  useEffect(() => {
    if (!isFill) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('frame')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFill])


  return (
    <div className="theme-area flex h-dvh min-h-[360px] flex-col bg-white">
      <header className={isFill ? 'hidden' : 'theme-chrome shrink-0 border-b border-forest-100 px-4 py-2'}>
        <div className="overflow-x-auto">
          <nav aria-label="Preview controls" className="mx-auto flex w-max items-center gap-1.5 sm:gap-2">
            {projectControls}
            <ToolbarSelect
              label="Device"
              showTitle={false}
              className="flex h-9 w-36 shrink-0 items-center justify-between gap-2 rounded-lg border border-forest-200 bg-white px-2.5 text-left text-sm text-charcoal hover:bg-forest-50 sm:w-60 lg:w-[22rem]"
              menuWidth={352}
              value={presetId}
              onSelect={selectDevice}
              groups={DEVICE_GROUPS.map(({ platform, label }) => ({
                label,
                options: PRESETS.filter((item) => item.platform === platform).map((item) => ({
                  value: item.id,
                  label: `${item.label} · ${item.width}×${item.height}`,
                })),
              }))}
            />
            <div role="group" aria-label="Preview platform" className="relative flex shrink-0 rounded-lg border border-forest-200 p-0.5">
              <span
                aria-hidden="true"
                data-testid="platform-highlight"
                className={['pointer-events-none absolute left-0.5 top-0.5 h-[30px] w-8 rounded-md bg-forest-100 transition-transform duration-200 ease-out motion-reduce:transition-none', isAndroid && 'translate-x-full', !isAndroid && !isIPhone && 'invisible'].filter(Boolean).join(' ')}
              />
              <button
                type="button"
                aria-pressed={isIPhone}
                aria-label="iPhone"
                onClick={() => selectDevice(devices.iphone)}
                className="relative grid h-[30px] w-8 place-items-center rounded-md text-charcoal-soft hover:bg-forest-50 aria-pressed:text-forest-900 aria-pressed:hover:bg-transparent"
              >
                <ToolbarIcon name="apple" />
              </button>
              <button
                type="button"
                aria-pressed={isAndroid}
                aria-label="Android"
                onClick={() => selectDevice(devices.android)}
                className="relative grid h-[30px] w-8 place-items-center rounded-md text-charcoal-soft hover:bg-forest-50 aria-pressed:text-forest-900 aria-pressed:hover:bg-transparent"
              >
                <ToolbarIcon name="android" />
              </button>
            </div>

            <button
              type="button"
              onClick={rotatePreview}
              aria-label={isLandscape ? 'Rotate to portrait' : 'Rotate to landscape'}
              className={iconButton}
            >
              <span className={`transition-transform duration-200 ease-out motion-reduce:transition-none ${isLandscape ? 'rotate-90' : ''}`}>
                <ToolbarIcon name="rotate" />
              </span>
            </button>

            <button
              type="button"
              onClick={(event) => {
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                  const icon = event.currentTarget.querySelector('svg')
                  icon?.getAnimations().forEach((animation) => animation.cancel())
                  icon?.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 280, easing: 'ease-out' })
                }
                setReloadCount((current) => current + 1)
              }}
              disabled={!project}
              aria-label="Reload preview"
              className={iconButton}
            >
              <ToolbarIcon name="reload" />
            </button>

            <button
              type="button"
              onClick={() => { if (relayActive) setTouchProject(touchEnabled ? null : project?.url ?? null) }}
              aria-disabled={!relayActive}
              aria-pressed={touchEnabled}
              aria-label="Touch"
              className={`${iconButton} aria-pressed:bg-forest-100 aria-disabled:opacity-40`}
            >
              <ToolbarIcon name="touch" />
            </button>

            <button
              type="button"
              onClick={() => setMode('fill')}
              disabled={!project}
              aria-label="Open desktop preview"
              className={iconButton}
            >
              <ToolbarIcon name="window" />
            </button>

            <ToolbarSelect
              label="Preview zoom"
              className={iconButton}
              menuWidth={112}
              value={String(zoom)}
              icon={<ToolbarIcon name="zoom" />}
              groups={[{ options: ZOOM_LEVELS.map((level) => ({
                value: String(level),
                label: level === 0 ? 'Fit' : `${level * 100}%`,
              })) }]}
              onSelect={(value) => setZoom(Number(value))}
            />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Dark mode"
              aria-pressed={dark}
              className={iconButton}
            >
              <span className="grid h-5 w-5 place-items-center">
                <span className={`col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${dark ? '-rotate-45 scale-50 opacity-0' : 'opacity-100'}`}>
                  <ToolbarIcon name="moon" />
                </span>
                <span className={`col-start-1 row-start-1 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${dark ? 'opacity-100' : 'rotate-45 scale-50 opacity-0'}`}>
                  <ToolbarIcon name="sun" />
                </span>
              </span>
            </button>
          </nav>
        </div>
        {projectEditor}
      </header>

      <div
        className={
          isFill
            ? 'theme-area fixed inset-0 z-40 bg-ivory'
            : `theme-area flex min-h-0 flex-1 flex-col items-center bg-ivory ${zoomedIn ? '' : 'p-4 sm:p-6'}`
        }
      >
        <div
          ref={stageRef}
          tabIndex={!isFill && (zoomedIn || horizontalOnly) ? 0 : undefined}
          className={isFill
            ? 'h-full w-full'
            : `min-h-0 w-full flex-1 ${horizontalOnly ? 'overflow-x-auto overflow-y-hidden' : zoomedIn ? 'overflow-auto' : ''}`}
        >
          <div
            className={isFill ? 'h-full w-full' : 'relative flex min-h-full min-w-full items-center justify-center'}
            style={!isFill && (zoomedIn || isLandscape) ? {
              width: (frameWidth + (zoomedIn ? 120 : 36)) * scale,
              height: horizontalOnly ? undefined : (frameHeight + 144) * scale,
            } : undefined}
          >
          <div
            ref={shellRef}
            className={isFill ? 'h-full w-full' : isIPhone ? 'absolute iphone-shell' : 'absolute'}
            style={
              isFill
                ? undefined
                : {
                    background: hasContinuousFrame ? (isIPhone ? undefined : '#09090b') : '#1C1C1E',
                    borderRadius: shellRadius,
                    padding: preset.shellPadding,
                    boxShadow: hasContinuousFrame ? undefined : [
                      'inset 0 0 0 1px #959598',
                      'inset 0 0 0 3px #38383C',
                      '0 12px 28px rgba(0, 0, 0, 0.22)',
                    ].join(', '),
                    ...(useTransformScale ? { transform: `scale(${scale})` } : { zoom: scale }),
                    isolation: 'isolate',
                  }
            }
          >
            {!isFill && hasContinuousFrame ? (
              isIPhone ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 drop-shadow-[0_10px_14px_rgba(0,0,0,0.22)]"
                >
                  <span className="continuous-corners absolute inset-0 bg-zinc-500" style={frameCorners(shellRadius)} />
                  <span className="continuous-corners absolute inset-[2px] bg-zinc-950" style={frameCorners(shellRadius - 2)} />
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 drop-shadow-[0_20px_22px_rgba(0,0,0,0.30)]"
                >
                  <span className="continuous-corners absolute inset-0 bg-zinc-900" style={frameCorners(shellRadius)} />
                  <span className="continuous-corners absolute inset-[2px] bg-zinc-950" style={frameCorners(shellRadius - 2)} />
                </div>
              )
            ) : null}
            {!isFill && (preset.camera === 'island' || isAndroid) ? (
              <div
                aria-hidden="true"
                data-testid="hardware-buttons"
                className={isLandscape
                  ? 'pointer-events-none absolute left-full top-0 rotate-90 origin-top-left'
                  : 'pointer-events-none absolute inset-0'}
                style={isLandscape ? {
                  width: screenHeight + 2 * preset.shellPadding,
                  height: screenWidth + 2 * preset.shellPadding,
                } : undefined}
              >
                {isAndroid ? (
                  <>
                    <span className="absolute -right-[3px] top-[19%] h-[37px] w-[3px] rounded-r bg-zinc-600" />
                    <span className="absolute -right-[3px] top-[26%] h-[79px] w-[3px] rounded-r bg-zinc-600" />
                  </>
                ) : (
                  <>
                    <span className="absolute -left-[3px] top-[15%] h-[23px] w-[3px] rounded-l bg-zinc-600" />
                    <span className="absolute -left-[3px] top-[20%] h-[41px] w-[3px] rounded-l bg-zinc-600" />
                    <span className="absolute -left-[3px] top-[26%] h-[41px] w-[3px] rounded-l bg-zinc-600" />
                    <span className="absolute -right-[3px] top-[23%] h-[61px] w-[3px] rounded-r bg-zinc-600" />
                  </>
                )}
              </div>
            ) : null}
            <div
              className={
                isFill
                  ? 'relative h-full w-full overflow-hidden bg-ivory'
                  : `device-chrome relative flex flex-col overflow-hidden ${
                      viewport ? (viewport.dark ? 'bg-zinc-950' : 'bg-[#fff]') : 'bg-ivory'
                    }`
              }
              style={
                isFill
                  ? undefined
                  : {
                      width: screenWidth,
                      height: screenHeight,
                      borderRadius: preset.screenRadius,
                      backgroundColor: previewLoading ? (dark ? '#111315' : '#fff') : viewport?.canvasColor ?? (viewport?.dark ? '#09090b' : '#fff'),
                      // Keep composited page layers (glows, blurs) inside the rounded screen at fractional scales.
                      isolation: 'isolate',
                      transform: 'translateZ(0)',
                      contain: 'paint',
                      // Keep page blur from sampling the workspace through the landscape corners.
                      filter: isIPhone && isLandscape ? 'brightness(1)' : undefined,
                    }
              }
            >
              {!isFill && statusBar > 0 ? (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none select-none items-center ${
                    viewport && !solidStatus ? 'absolute left-0 top-0 z-10' : solidStatus ? 'relative shrink-0' : 'relative shrink-0 bg-ivory'
                  } ${(solidStatus ? solidDark : viewport?.dark) ? 'text-[#fff]' : 'text-charcoal'} ${
                    preset.camera === 'island' ? 'grid grid-cols-[1fr_125px_1fr] justify-items-center' : 'flex justify-between px-4'
                  }`}
                  style={{
                    height: statusBar,
                    width: viewport ? innerWidth : undefined,
                    ...(solidStatus ? { background: solidColor } : {}),
                    ...(viewport?.canvasColor && !viewport.scrolled && !solidStatus
                      ? { backgroundColor: viewport.canvasColor }
                      : {}),
                  }}
                >
                  {viewport && (!viewport.canvasColor || viewport.scrolled) && !solidStatus && preset.camera === 'island' && (
                    <span
                      className="absolute inset-x-0 bottom-0 -z-10"
                      style={{
                        height: statusBar / 2,
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        maskImage: 'linear-gradient(to bottom, transparent, rgb(0 0 0 / 25%) 35%, transparent), linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)',
                        maskComposite: 'intersect',
                      }}
                    />
                  )}
                  <span className="text-[15px] font-semibold leading-none tabular-nums">
                    {time}
                  </span>
                  {preset.camera !== 'island' && (
                    <DeviceCutout camera={preset.camera} cameraSize={preset.cameraSize} statusBar={statusBar} />
                  )}
                  <StatusBarIcons className={preset.camera === 'island' ? 'col-start-3' : ''} />
                </div>
              ) : null}
              {!isFill && rightInset ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 flex select-none flex-col items-center gap-3 bg-ivory pt-5 text-sm font-semibold text-charcoal"
                  style={{ width: rightInset }}
                >
                  <span>{time}</span>
                  <StatusBarIcons />
                  <span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-black" />
                </div>
              ) : null}

              <div
                className={isFill ? 'h-full w-full' : undefined}
                style={isFill ? undefined : { width: wholePixels(innerWidth), height: wholePixels(innerHeight) }}
              >
                {project && relayDecided === project.url && <iframe
                  key={frameKey}
                  ref={iframeRef}
                  onLoad={(event) => onPreviewLoad(event.currentTarget)}
                  title={project.name + ' preview'}
                  src={frameUrl}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                  referrerPolicy="no-referrer"
                  style={previewLoading ? { visibility: 'hidden' } : undefined}
                  className={`block h-full w-full border-0 ${viewport?.dark ? 'bg-zinc-950' : 'bg-white'}`}
                />}
              </div>

              {!isFill && landscapeCutout && preset.camera !== 'island' ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-full top-0 z-10 rotate-90 origin-top-left"
                  style={{ width: screenHeight, height: preset.statusBar }}
                >
                  <DeviceCutout camera={preset.camera} cameraSize={preset.cameraSize} statusBar={preset.statusBar} />
                </div>
              ) : null}

              {!isFill && isAndroid && bottomInset > 0 ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center"
                  style={{ height: bottomInset, width: innerWidth }}
                >
                  <span className={`h-1 w-[96px] rounded-full ${viewport?.dark ? 'bg-[#fff]' : 'bg-charcoal'}`} />
                </div>
              ) : null}
              {!isFill && isIPhone && hasContinuousFrame && (
                <div
                  aria-hidden="true"
                  className="iphone-screen-trim pointer-events-none absolute inset-0 z-20"
                  style={frameCorners(preset.screenRadius)}
                />
              )}
              {previewLoading && (
                <div
                  role={project ? 'status' : undefined}
                  className={['absolute inset-0 z-20 grid place-items-center', dark ? 'bg-[#111315] text-[#fff]' : 'bg-[#fff] text-black'].join(' ')}
                >
                  {project ? (
                    <>
                      <span className="sr-only">Loading {project.name} preview</span>
                      <span aria-hidden="true" className="h-5 w-5 rounded-full border-2 border-current border-r-transparent opacity-25 motion-safe:animate-spin" />
                    </>
                  ) : <p className="text-sm opacity-60">No project selected</p>}
                </div>
              )}
            </div>
            {!isFill && preset.camera === 'island' && (
              <div
                aria-hidden="true"
                className={landscapeCutout
                  ? 'pointer-events-none absolute z-30 rotate-90 origin-top-left'
                  : 'pointer-events-none absolute z-30'}
                style={{
                  top: preset.shellPadding,
                  left: preset.shellPadding + (landscapeCutout ? screenWidth : 0),
                  visibility: previewLoading ? 'hidden' : undefined,
                  width: landscapeCutout ? screenHeight : innerWidth,
                  height: preset.statusBar,
                }}
              >
                <DeviceCutout camera="island" statusBar={preset.statusBar} />
              </div>
            )}
          </div>

          </div>
        </div>
      </div>

      {isFill ? <DraggableRestoreButton dark={viewport?.dark ?? dark} onRestore={() => setMode('frame')} /> : null}
    </div>
  )
}
