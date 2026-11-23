type Platform = 'iphone' | 'android' | 'tablet'

interface DevicePreset {
  id: string
  label: string
  platform: Platform
  width: number
  height: number
  statusBar: number
  bottomInset: number
  screenRadius: number
  shellPadding: number
  camera?: 'island' | 'hole' | 'notch'
  cameraSize?: number
  rightInset?: number
}

const iphone = { platform: 'iphone', statusBar: 59, bottomInset: 34, screenRadius: 55, shellPadding: 8, camera: 'island' } as const
const android = { platform: 'android', statusBar: 32, bottomInset: 24, screenRadius: 28, shellPadding: 8, camera: 'hole' } as const
const tablet = { platform: 'tablet', statusBar: 24, bottomInset: 0, screenRadius: 20, shellPadding: 10 } as const

export const DEVICE_GROUPS: { platform: Platform; label: string }[] = [
  { platform: 'iphone', label: 'iPhone' },
  { platform: 'android', label: 'Android phones' },
  { platform: 'tablet', label: 'Tablets' },
]

// Portrait dimensions come from Chrome DevTools where available. The iPhone 18
// and Duo sizes use Apple's display resolutions at an assumed 3× scale.
export const PRESETS: DevicePreset[] = [
  { ...iphone, id: 'se', label: 'iPhone SE', width: 375, height: 667,
    statusBar: 20, bottomInset: 0, screenRadius: 4, shellPadding: 12, camera: undefined },
  { ...iphone, id: 'iphone-16e', label: 'iPhone 16e / 17e', width: 390, height: 844, statusBar: 47, camera: 'notch' },
  { ...iphone, id: 'iphone', label: 'iPhone 15 / 15 Pro / 16', width: 393, height: 852 },
  { ...iphone, id: 'promax', label: 'iPhone 15 Plus / Pro Max / 16 Plus', width: 430, height: 932 },
  { ...iphone, id: 'iphone-18-pro', label: 'iPhone 16–18 Pro / iPhone 17', width: 402, height: 874, statusBar: 62 },
  { ...iphone, id: 'iphone-18-pro-max', label: 'iPhone 16–18 Pro Max', width: 440, height: 956, statusBar: 62 },
  // The Duo profiles model screen layouts with reserved space for system UI.
  // Safari's exact viewable area varies by pose and browser chrome.
  { ...iphone, id: 'duo-folded', label: 'iPhone Duo (folded)', width: 466, height: 678,
    statusBar: 0, rightInset: 84, screenRadius: 35, camera: undefined },
  { ...iphone, id: 'duo-open-portrait', label: 'iPhone Duo (open)', width: 626, height: 890,
    statusBar: 34, screenRadius: 38, camera: undefined },
  { ...android, id: 'galaxy-a55', label: 'Samsung Galaxy A55', width: 360, height: 800 },
  { ...android, id: 'pixel', label: 'Google Pixel 7', width: 412, height: 915, statusBar: 52, cameraSize: 26 },
  // 1344 × 2992 display modeled at 3×, with the established Pixel XL frame.
  { ...android, id: 'pixel-11-pro-xl', label: 'Google Pixel 11 Pro XL', width: 448, height: 997, statusBar: 66, cameraSize: 28 },
  { ...android, id: 'galaxy-fold-closed', label: 'Galaxy Z Fold6 (folded)', width: 412, height: 968 },
  { ...android, id: 'galaxy-fold-open', label: 'Galaxy Z Fold6 (open)', width: 744, height: 860, camera: undefined },
  { ...tablet, id: 'tablet', label: 'Small tablet (4:3)', width: 768, height: 1024 },
  { ...tablet, id: 'ipad-pro', label: 'iPad Pro 13-inch', width: 1032, height: 1376, bottomInset: 20 },
]
