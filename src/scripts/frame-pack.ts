/**
 * Pack schema v4 — the file committed to loggoo_asset. Canvas fractions, not pixels.
 * v3 added `layers`, the bottom-to-top paint order per aspect.
 * v4 adds an optional `background` (colour or full-bleed image, always painted first), an optional `logo`
 * placement (the Loggoo mark in one of three styles, a `layers` entry like the mood), and text `w` / `maxLines` / `align`.
 */

export const SCHEMA_VERSION = 4
export const SLUG = /^[a-z0-9_]{1,40}$/
export const BINDS = ['title', 'date', 'note', 'mood'] as const
export const FONTS = ['poppins', 'caveat', 'sacramento', 'baloo', 'playfair'] as const
export const ALIGNS = ['start', 'center', 'end'] as const
/** tile = mark on the dark brand tile; dark / light = bare mark (no tile) for light / dark artwork. */
export const LOGO_STYLES = ['tile', 'dark', 'light'] as const
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
export const MAX_TEXT_LINES = 20
export const ASPECTS = ['story', 'post'] as const
export const IMAGE_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg'

export type Bind = (typeof BINDS)[number]
export type Font = (typeof FONTS)[number]
export type Aspect = (typeof ASPECTS)[number]
export type Align = (typeof ALIGNS)[number]
export type LogoStyle = (typeof LOGO_STYLES)[number]

export type Slot = {
  photo: number
  x: number
  y: number
  w: number
  h: number
  rotation: number
  cornerDp: number
}

/** A text box: `w` is its width as a canvas fraction; text wraps inside it and is cut with an ellipsis after `maxLines`. Rotates about its centre. */
export type TextBind = {
  bind: Bind
  x: number
  y: number
  w: number
  rotation: number
  font: Font
  sizeSp: number
  color: string
  maxLines: number
  align: Align
}

/** Shared by the mood face and the Loggoo logo tile: a square sticker sized in dp. */
export type MoodPlacement = {
  x: number
  y: number
  sizeDp: number
  rotation: number
}

export type LogoPlacement = MoodPlacement & { style: LogoStyle }

/** Painted first, under everything. Image files are full-bleed like the overlay. */
export type Background = { kind: 'color'; color: string } | { kind: 'image'; file: string }

/** One entry in the paint order. The background always paints below and text binds above every layer. */
export type Layer = { kind: 'overlay' } | { kind: 'photo'; photo: number } | { kind: 'mood' } | { kind: 'logo' }

export type AspectLayout = {
  overlay: string
  background?: Background
  slots: Slot[]
  texts: TextBind[]
  mood?: MoodPlacement
  logo?: LogoPlacement
  /** Bottom to top. Contains the overlay once, every photo once, and the mood / logo iff present. */
  layers: Layer[]
}

export type PackManifest = {
  schemaVersion: number
  id: string
  names: { en: string; vi: string }
  premium: boolean
  photoCapacity: number
  story: AspectLayout
  post: AspectLayout
}

export type CatalogEntry = {
  id: string
  schemaVersion: number
  updatedAt: string
  premium: boolean
  names: { en: string; vi: string }
  icon: string
  manifest: string
}

/** Overlay / icon files we accept. `.jpeg` is stored as `.jpg`. */
export type ImageExt = 'png' | 'jpg'

/** Folder / catalog id from the English name. Empty if nothing slug-worthy remains. */
export function slugFromName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/g, '')
  return SLUG.test(slug) ? slug : ''
}

export function imageExt(file: File): ImageExt | null {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'png'
  if (type === 'image/jpeg') return 'jpg'
  const name = file.name.toLowerCase()
  if (name.endsWith('.png')) return 'png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg'
  return null
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function sanitizeSlot(slot: Slot): Slot {
  const w = clamp01(slot.w)
  const h = clamp01(slot.h)
  const x = clamp01(Math.min(slot.x, 1 - w))
  const y = clamp01(Math.min(slot.y, 1 - h))
  return {
    photo: Math.max(0, Math.floor(slot.photo)),
    x: round4(x),
    y: round4(y),
    w: round4(Math.max(0.04, w)),
    h: round4(Math.max(0.04, h)),
    rotation: round4(slot.rotation),
    cornerDp: Math.max(0, round4(slot.cornerDp)),
  }
}

const ASPECT_HEIGHT_DP: Record<Aspect, number> = {
  story: 640,
  post: 450,
}

export function sanitizeMood(mood: MoodPlacement, aspect: Aspect): MoodPlacement {
  const sizeDp = round4(Math.min(180, Math.max(16, mood.sizeDp)))
  const widthFraction = sizeDp / 360
  const heightFraction = sizeDp / ASPECT_HEIGHT_DP[aspect]
  return {
    x: round4(clamp01(Math.min(mood.x, 1 - widthFraction))),
    y: round4(clamp01(Math.min(mood.y, 1 - heightFraction))),
    sizeDp,
    rotation: round4(Math.min(45, Math.max(-45, mood.rotation))),
  }
}

export function sanitizeText(text: TextBind): TextBind {
  const w = round4(Math.max(0.05, clamp01(text.w)))
  return {
    bind: text.bind,
    x: round4(clamp01(Math.min(text.x, 1 - w))),
    y: round4(clamp01(text.y)),
    w,
    rotation: round4(Math.min(45, Math.max(-45, text.rotation))),
    font: text.font,
    sizeSp: round4(Math.min(200, Math.max(4, text.sizeSp))),
    color: HEX_COLOR.test(text.color) ? text.color.toUpperCase() : '#4A3728',
    maxLines: Math.min(MAX_TEXT_LINES, Math.max(1, Math.floor(text.maxLines))),
    align: text.align,
  }
}

type Stickers = { mood: boolean; logo: boolean }
const LAYER_KINDS = new Set<string>(['overlay', 'photo', 'mood', 'logo'])

/** Default order: photos in index order, then the overlay, then the mood, then the logo. */
export function defaultLayers(slots: Slot[], stickers: Stickers): Layer[] {
  const layers: Layer[] = slots.map((slot) => ({ kind: 'photo', photo: slot.photo }))
  layers.push({ kind: 'overlay' })
  if (stickers.mood) layers.push({ kind: 'mood' })
  if (stickers.logo) layers.push({ kind: 'logo' })
  return layers
}

/** Keeps the author's order but guarantees every layer appears exactly once; missing ones fall to the bottom. */
export function sanitizeLayers(layers: Layer[], slots: Slot[], stickers: Stickers): Layer[] {
  const photos = new Set(slots.map((slot) => slot.photo))
  const seen = new Set<string>()
  const out: Layer[] = []
  for (const layer of layers) {
    const key = layer.kind === 'photo' ? `photo:${layer.photo}` : layer.kind
    if (!LAYER_KINDS.has(layer.kind) || seen.has(key)) continue
    if (layer.kind === 'photo' && !photos.has(layer.photo)) continue
    if (layer.kind === 'mood' && !stickers.mood) continue
    if (layer.kind === 'logo' && !stickers.logo) continue
    seen.add(key)
    out.push(layer)
  }
  const missing = defaultLayers(slots, stickers).filter((layer) => {
    const key = layer.kind === 'photo' ? `photo:${layer.photo}` : layer.kind
    return !seen.has(key)
  })
  return [...missing, ...out]
}

type AspectInput = {
  overlay: string
  background?: Background
  slots: Slot[]
  texts: TextBind[]
  mood?: MoodPlacement
  logo?: LogoPlacement
  layers?: Layer[]
}

function buildAspect(input: AspectInput, aspect: Aspect, slots: Slot[]): AspectLayout {
  const stickers = { mood: input.mood != null, logo: input.logo != null }
  return {
    overlay: input.overlay,
    ...(input.background ? { background: input.background } : {}),
    slots,
    texts: input.texts.map(sanitizeText),
    ...(input.mood ? { mood: sanitizeMood(input.mood, aspect) } : {}),
    ...(input.logo ? { logo: { ...sanitizeMood(input.logo, aspect), style: input.logo.style } } : {}),
    layers: sanitizeLayers(input.layers ?? [], slots, stickers),
  }
}

export function buildManifest(input: {
  id: string
  names: { en: string; vi: string }
  premium: boolean
  story: AspectInput
  post: AspectInput
}): PackManifest {
  const storySlots = input.story.slots.map(sanitizeSlot)
  const postSlots = input.post.slots.map(sanitizeSlot)
  const photoCapacity = Math.max(
    1,
    ...storySlots.map((slot) => slot.photo + 1),
    ...postSlots.map((slot) => slot.photo + 1),
  )
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    names: input.names,
    premium: input.premium,
    photoCapacity,
    story: buildAspect(input.story, 'story', storySlots),
    post: buildAspect(input.post, 'post', postSlots),
  }
}

export function catalogSnippet(manifest: PackManifest, iconFile = 'icon.png'): CatalogEntry {
  return {
    id: manifest.id,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    premium: manifest.premium,
    names: manifest.names,
    icon: `frames/${manifest.id}/${iconFile}`,
    manifest: `frames/${manifest.id}/manifest.json`,
  }
}

function crc32(data: Uint8Array): number {
  let crc = ~0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ~crc >>> 0
}

function dosTime(date: Date): { time: number; day: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function view(length: number, write: (data: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(length)
  write(new DataView(bytes.buffer))
  return bytes
}

/** Uncompressed zip so the studio has no extra dependency. */
export function zipStore(files: { path: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder()
  const { time, day } = dosTime(new Date())
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.path)
    const crc = crc32(file.data)
    const local = concat([
      view(30, (data) => {
        data.setUint32(0, 0x04034b50, true)
        data.setUint16(4, 20, true)
        data.setUint16(8, 0, true)
        data.setUint16(10, time, true)
        data.setUint16(12, day, true)
        data.setUint32(14, crc, true)
        data.setUint32(18, file.data.length, true)
        data.setUint32(22, file.data.length, true)
        data.setUint16(26, name.length, true)
      }),
      name,
      file.data,
    ])
    locals.push(local)
    centrals.push(
      concat([
        view(46, (data) => {
          data.setUint32(0, 0x02014b50, true)
          data.setUint16(4, 20, true)
          data.setUint16(6, 20, true)
          data.setUint16(10, 0, true)
          data.setUint16(12, time, true)
          data.setUint16(14, day, true)
          data.setUint32(16, crc, true)
          data.setUint32(20, file.data.length, true)
          data.setUint32(24, file.data.length, true)
          data.setUint16(28, name.length, true)
          data.setUint32(42, offset, true)
        }),
        name,
      ]),
    )
    offset += local.length
  }

  const central = concat(centrals)
  const end = view(22, (data) => {
    data.setUint32(0, 0x06054b50, true)
    data.setUint16(8, files.length, true)
    data.setUint16(10, files.length, true)
    data.setUint32(12, central.length, true)
    data.setUint32(16, offset, true)
  })
  const bytes = concat([...locals, central, end])
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buffer], { type: 'application/zip' })
}
