import {
  ALIGNS,
  FONTS,
  HEX_COLOR,
  IMAGE_ACCEPT,
  LOGO_STYLES,
  MAX_TEXT_LINES,
  type Align,
  type Aspect,
  type Background,
  type Font,
  type Layer,
  type LogoPlacement,
  type LogoStyle,
  type MoodPlacement,
  type Slot,
  type TextBind,
  buildManifest,
  catalogSnippet,
  clamp01,
  imageExt,
  slugFromName,
  zipStore,
} from './frame-pack'
import { clearDraft, loadDraft, saveDraft } from './frame-draft'

type Handle = 'nw' | 'ne' | 'sw' | 'se'

type DraftSlot = Slot & { id: string }
type DraftText = TextBind & { id: string }
/** The two square stickers share one placement shape and one canvas code path. */
type Sticker = 'mood' | 'logo'
/** `layers` is the paint order, bottom to top: 'overlay', 'mood', 'logo', or a slot id. Texts always paint above. */
type Layout = { slots: DraftSlot[]; texts: DraftText[]; mood?: MoodPlacement; logo?: LogoPlacement; layers: string[] }
type DraftBackground = { kind: 'color'; color: string } | { kind: 'image'; file: File }
type Mode = 'select' | 'draw'

/** What undo/redo and the saved draft carry. Files are immutable, so snapshots share them by reference. */
type Snapshot = {
  layouts: string
  overlays: Record<Aspect, File | null>
  backgrounds: Record<Aspect, DraftBackground | null>
}
type Draft = {
  nameEn: string
  nameVi: string
  premium: boolean
  aspect: Aspect
  layouts: Record<Aspect, Layout>
  overlays: Record<Aspect, File | null>
  backgrounds?: Record<Aspect, DraftBackground | null>
  icon: File | null
  savedAt: number
}

type PointerMode =
  | { kind: 'move'; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'resize'; id: string; handle: Handle; startX: number; startY: number; origin: Slot }
  | { kind: 'rotate'; id: string; origin: number; startAngle: number }
  | { kind: 'radius'; id: string }
  | { kind: 'sticker-move'; which: Sticker; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'sticker-resize'; which: Sticker }
  | { kind: 'sticker-rotate'; which: Sticker; origin: number; startAngle: number }
  | { kind: 'text-move'; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'text-resize'; id: string }
  | { kind: 'text-rotate'; id: string; origin: number; startAngle: number }
  | { kind: 'draw'; startX: number; startY: number }

const RESIZE = new Set<string>(['nw', 'ne', 'sw', 'se'])
const STICKERS: Sticker[] = ['mood', 'logo']
const MAX_TILT = 45
const MAX_CORNER = 24
const FRAME_WIDTH_DP = 360
const ASPECT_HEIGHT_DP: Record<Aspect, number> = { story: 640, post: 450 }
const MIN_STICKER_SIZE_DP = 16
const MAX_STICKER_SIZE_DP = 180
const MIN_TEXT_W = 0.05
const HISTORY_LIMIT = 100
/** Rail tile is 40dp; 256px covers 3x screens with room for the ring. Below 128px it visibly blurs. */
const ICON_MIN_PX = 128
const ICON_RECOMMENDED_PX = 256
const ZOOM_STEP = 1.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4
/** Stand-in for the day's note so the author can judge wrapping and the line cap. */
const NOTE_SAMPLE =
  'Slow morning, long walk by the river, and a good book before bed. Felt like the day finally caught its breath.'
const FONT_FAMILY: Record<Font, string> = {
  poppins: "'Poppins', sans-serif",
  caveat: "'Caveat', cursive",
  sacramento: "'Sacramento', cursive",
  baloo: "'Baloo 2', sans-serif",
  playfair: "'Playfair Display', serif",
}

const FILLS = ['#F6B393', '#9BD9B8', '#A9D6EE', '#F6E3A3', '#F3C3CB', '#E8804F']
function uid(): string {
  return crypto.randomUUID()
}

function $(sel: string, root: ParentNode = document): HTMLElement {
  const node = root.querySelector(sel)
  if (!(node instanceof HTMLElement)) throw new Error(`missing ${sel}`)
  return node
}

function input(sel: string, root: ParentNode = document): HTMLInputElement {
  const node = root.querySelector(sel)
  if (!(node instanceof HTMLInputElement)) throw new Error(`missing ${sel}`)
  return node
}

function selectEl(sel: string, root: ParentNode = document): HTMLSelectElement {
  const node = root.querySelector(sel)
  if (!(node instanceof HTMLSelectElement)) throw new Error(`missing ${sel}`)
  return node
}

function fileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buffer) => new Uint8Array(buffer))
}

function pngFromCanvas(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('icon encode failed'))
        return
      }
      void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)))
    }, 'image/png')
  })
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function wrapDelta(deg: number): number {
  let value = deg
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

function defaultSlot(photo: number): DraftSlot {
  return {
    id: uid(),
    photo,
    x: 0.12,
    y: 0.18 + (photo % 3) * 0.06,
    w: 0.36,
    h: 0.28,
    rotation: photo % 2 === 0 ? -4 : 5,
    cornerDp: 8,
  }
}

function defaultMood(): MoodPlacement {
  return { x: 0.72, y: 0.08, sizeDp: 48, rotation: 0 }
}

function defaultLogo(): LogoPlacement {
  return { x: 0.06, y: 0.88, sizeDp: 32, rotation: 0, style: 'tile' }
}

function defaultText(): DraftText {
  return {
    id: uid(),
    bind: 'note',
    x: 0.1,
    y: 0.7,
    w: 0.8,
    rotation: 0,
    font: 'caveat',
    sizeSp: 18,
    color: '#4A3728',
    maxLines: 3,
    align: 'start',
  }
}

function emptyLayout(): Layout {
  return { slots: [], texts: [], layers: ['overlay'] }
}

function sameBackground(a: DraftBackground | null, b: DraftBackground | null): boolean {
  if (a == null || b == null) return a === b
  if (a.kind !== b.kind) return false
  return a.kind === 'color' ? a.color === (b as { color: string }).color : a.file === (b as { file: File }).file
}

export function mountStudio(root: HTMLElement): void {
  const frame = $('[data-frame]', root)
  const overlayImg = $('[data-overlay]', root) as HTMLImageElement
  const backgroundImg = $('[data-background]', root) as HTMLImageElement
  const slotLayer = $('[data-slots]', root)
  const stickerLayer = $('[data-stickers]', root)
  const textLayer = $('[data-texts]', root)
  const rubber = $('[data-rubber]', root)
  const list = $('[data-layer-list]', root)
  const inspector = $('[data-inspector]', root)
  const textInspector = $('[data-text-inspector]', root)
  const snippet = $('[data-snippet]', root) as HTMLTextAreaElement
  const status = $('[data-status]', root)
  const toasts = $('[data-toasts]')
  const idLabel = $('[data-id]', root)
  const removeOverlayButton = $('[data-remove-overlay]', root) as HTMLButtonElement
  const removeBackgroundButton = $('[data-remove-background]', root) as HTMLButtonElement
  const backgroundStatus = $('[data-background-status]', root)
  const addTextButton = $('[data-add-text]', root) as HTMLButtonElement

  const overlays: Record<Aspect, File | null> = { story: null, post: null }
  const backgrounds: Record<Aspect, DraftBackground | null> = { story: null, post: null }
  // Object URLs live as long as the page: history and the draft keep old Files reachable anyway.
  const objectUrls = new Map<File, string>()
  const layouts: Record<Aspect, Layout> = { story: emptyLayout(), post: emptyLayout() }
  const history: Snapshot[] = []
  let historyIndex = -1
  let zoom = 1
  let saveTimer: number | undefined

  let aspect: Aspect = 'story'
  let mode: Mode = 'select'
  /** A slot id, a text id, 'mood', 'logo', 'overlay', 'background', or nothing. */
  let selection: string | null = null
  let pointer: PointerMode | null = null
  let iconFile: File | null = null

  function layout(): Layout {
    return layouts[aspect]
  }

  function urlFor(file: File): string {
    let url = objectUrls.get(file)
    if (!url) {
      url = URL.createObjectURL(file)
      objectUrls.set(file, url)
    }
    return url
  }

  function snapshot(): Snapshot {
    return { layouts: JSON.stringify(layouts), overlays: { ...overlays }, backgrounds: { ...backgrounds } }
  }

  function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
    return (
      a.layouts === b.layouts &&
      a.overlays.story === b.overlays.story &&
      a.overlays.post === b.overlays.post &&
      sameBackground(a.backgrounds.story, b.backgrounds.story) &&
      sameBackground(a.backgrounds.post, b.backgrounds.post)
    )
  }

  /** Record the current state as an undo step. No-op when nothing changed since the last step. */
  function commit(): void {
    const next = snapshot()
    if (historyIndex >= 0 && sameSnapshot(history[historyIndex], next)) return
    history.splice(historyIndex + 1)
    history.push(next)
    if (history.length > HISTORY_LIMIT) history.shift()
    historyIndex = history.length - 1
  }

  function resetHistory(): void {
    history.length = 0
    historyIndex = -1
    commit()
  }

  function restore(step: Snapshot): void {
    const parsed = JSON.parse(step.layouts) as Record<Aspect, Layout>
    layouts.story = parsed.story
    layouts.post = parsed.post
    overlays.story = step.overlays.story
    overlays.post = step.overlays.post
    backgrounds.story = step.backgrounds.story
    backgrounds.post = step.backgrounds.post
    selection = null
    renderOverlay()
    renderSlots()
  }

  function undo(): void {
    if (historyIndex <= 0) return
    historyIndex--
    restore(history[historyIndex])
    setStatus('undo')
  }

  function redo(): void {
    if (historyIndex >= history.length - 1) return
    historyIndex++
    restore(history[historyIndex])
    setStatus('redo')
  }

  function setZoom(next: number): void {
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    frame.style.setProperty('--zoom', String(zoom))
    $('[data-zoom]', root).textContent = `${Math.round(zoom * 100)}%`
  }

  function scheduleSave(): void {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const draft: Draft = {
        nameEn: input('[name="nameEn"]', root).value,
        nameVi: input('[name="nameVi"]', root).value,
        premium: input('[name="premium"]', root).checked,
        aspect,
        layouts: JSON.parse(JSON.stringify(layouts)) as Record<Aspect, Layout>,
        overlays: { ...overlays },
        backgrounds: { ...backgrounds },
        icon: iconFile,
        savedAt: Date.now(),
      }
      void saveDraft(draft)
    }, 400)
  }

  /** Inline z-index: 10 + stack position; texts sit at 90; the selected layer lifts above everything so its handles stay reachable. */
  function layerZ(id: string, isSelected: boolean): string {
    return isSelected ? '100' : String(10 + layout().layers.indexOf(id))
  }

  function moveLayer(id: string, delta: 1 | -1): void {
    const layers = layout().layers
    const from = layers.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= layers.length) return
    layers.splice(from, 1)
    layers.splice(to, 0, id)
    commit()
    renderSlots()
  }

  function selected(): DraftSlot | undefined {
    return layout().slots.find((slot) => slot.id === selection)
  }

  function selectedText(): DraftText | undefined {
    return layout().texts.find((text) => text.id === selection)
  }

  function stickerSizeFractions(sticker: MoodPlacement): { width: number; height: number } {
    return {
      width: sticker.sizeDp / FRAME_WIDTH_DP,
      height: sticker.sizeDp / ASPECT_HEIGHT_DP[aspect],
    }
  }

  function clampStickerPosition(sticker: MoodPlacement): void {
    const size = stickerSizeFractions(sticker)
    sticker.x = clamp01(Math.min(sticker.x, 1 - size.width))
    sticker.y = clamp01(Math.min(sticker.y, 1 - size.height))
  }

  function setStatus(message: string): void {
    status.textContent = message
  }

  function toast(kind: 'error' | 'success' | 'info', message: string): void {
    const el = document.createElement('p')
    el.className = `toast toast--${kind}`
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
    el.textContent = message
    toasts.append(el)
    window.setTimeout(() => {
      el.classList.add('is-leaving')
      window.setTimeout(() => el.remove(), 220)
    }, kind === 'error' ? 4200 : 2800)
  }

  function clearInvalid(): void {
    root.querySelectorAll('.is-invalid').forEach((node) => node.classList.remove('is-invalid'))
  }

  function markInvalid(name: string): HTMLInputElement {
    const field = input(`[name="${name}"]`, root)
    field.classList.add('is-invalid')
    return field
  }

  function syncId(): string {
    const slug = slugFromName(input('[name="nameEn"]', root).value)
    idLabel.textContent = slug || '—'
    return slug
  }

  function localFrac(event: PointerEvent): { x: number; y: number } {
    const box = frame.getBoundingClientRect()
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    }
  }

  function slotCenterPx(slot: DraftSlot): { x: number; y: number } {
    const box = frame.getBoundingClientRect()
    return {
      x: box.left + (slot.x + slot.w / 2) * box.width,
      y: box.top + (slot.y + slot.h / 2) * box.height,
    }
  }

  function pointerAngle(event: PointerEvent, slot: DraftSlot): number {
    const center = slotCenterPx(slot)
    return (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI
  }

  function stickerCenterPx(sticker: MoodPlacement): { x: number; y: number } {
    const box = frame.getBoundingClientRect()
    const size = stickerSizeFractions(sticker)
    return {
      x: box.left + (sticker.x + size.width / 2) * box.width,
      y: box.top + (sticker.y + size.height / 2) * box.height,
    }
  }

  /** Angle from the text box's centre; its height comes from the DOM since it follows the line cap. */
  function textPointerAngle(event: PointerEvent, text: DraftText): number {
    const el = textLayer.querySelector(`[data-text-id="${text.id}"]`)
    if (!(el instanceof HTMLElement)) return 0
    const box = el.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI
  }

  function stickerPointerAngle(event: PointerEvent, sticker: MoodPlacement): number {
    const center = stickerCenterPx(sticker)
    return (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI
  }

  function applyTilt(degrees: number): number {
    const snapped = Math.abs(degrees) < 2 ? 0 : degrees
    return Math.round(clamp(snapped, -MAX_TILT, MAX_TILT))
  }

  function applyCorner(event: PointerEvent, slot: DraftSlot): number {
    const box = frame.getBoundingClientRect()
    const center = slotCenterPx(slot)
    const rad = (-slot.rotation * Math.PI) / 180
    const dx = event.clientX - center.x
    const dy = event.clientY - center.y
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad) + (slot.w * box.width) / 2
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad) + (slot.h * box.height) / 2
    const dp = (Math.min(localX, localY) * 360) / box.width
    return Math.round(clamp(dp, 0, MAX_CORNER))
  }

  function applySlotBox(el: HTMLElement, slot: DraftSlot): void {
    const isSelected = slot.id === selection
    el.classList.toggle('is-selected', isSelected)
    el.style.left = `${slot.x * 100}%`
    el.style.top = `${slot.y * 100}%`
    el.style.width = `${slot.w * 100}%`
    el.style.height = `${slot.h * 100}%`
    el.style.transform = `rotate(${slot.rotation}deg)`
    el.style.zIndex = layerZ(slot.id, isSelected)
    el.style.setProperty('--fill', FILLS[slot.photo % FILLS.length])
    el.style.setProperty('--corner', `${slot.cornerDp}`)
    const label = el.querySelector('.slot__label')
    const meta = el.querySelector('.slot__meta')
    if (label) label.textContent = `photo ${slot.photo + 1}`
    if (meta) meta.textContent = `${Math.round(slot.rotation)}° · r${Math.round(slot.cornerDp)}`
  }

  function applyStickerBox(el: HTMLElement, which: Sticker, sticker: MoodPlacement): void {
    const isSelected = selection === which
    el.classList.toggle('is-selected', isSelected)
    el.style.left = `${sticker.x * 100}%`
    el.style.top = `${sticker.y * 100}%`
    el.style.width = `${(sticker.sizeDp / FRAME_WIDTH_DP) * 100}%`
    el.style.transform = `rotate(${sticker.rotation}deg)`
    el.style.zIndex = layerZ(which, isSelected)
    if (which === 'logo') el.dataset.logoStyle = (sticker as LogoPlacement).style
    const meta = el.querySelector('.mood-face__meta')
    if (meta) meta.textContent = `${Math.round(sticker.rotation)}° · ${Math.round(sticker.sizeDp)}dp`
  }

  function applyTextBox(el: HTMLElement, text: DraftText): void {
    const isSelected = text.id === selection
    el.classList.toggle('is-selected', isSelected)
    el.style.left = `${text.x * 100}%`
    el.style.top = `${text.y * 100}%`
    el.style.width = `${text.w * 100}%`
    el.style.transform = `rotate(${text.rotation}deg)`
    el.style.zIndex = isSelected ? '100' : '90'
    el.style.fontFamily = FONT_FAMILY[text.font]
    el.style.color = text.color
    el.style.textAlign = text.align
    el.style.setProperty('--sp', String(text.sizeSp))
    el.style.setProperty('--lines', String(text.maxLines))
    const meta = el.querySelector('.text-box__meta')
    if (meta)
      meta.textContent = `${text.font} · ${text.sizeSp}sp · ${text.maxLines} line${text.maxLines === 1 ? '' : 's'} · ${Math.round(text.rotation)}°`
  }

  function paintDragging(): void {
    const currentPointer = pointer
    if (!currentPointer || currentPointer.kind === 'draw') return
    if (currentPointer.kind.startsWith('sticker-')) {
      const which = (currentPointer as { which: Sticker }).which
      const sticker = layout()[which]
      const el = stickerLayer.querySelector(`[data-sticker="${which}"]`)
      if (sticker && el instanceof HTMLElement) applyStickerBox(el, which, sticker)
      return
    }
    if (currentPointer.kind.startsWith('text-')) {
      const text = layout().texts.find((item) => item.id === (currentPointer as { id: string }).id)
      const el = text && textLayer.querySelector(`[data-text-id="${text.id}"]`)
      if (text && el instanceof HTMLElement) applyTextBox(el, text)
      return
    }
    const slot = layout().slots.find((item) => item.id === (currentPointer as { id: string }).id)
    if (!slot) return
    const el = slotLayer.querySelector(`[data-slot-id="${slot.id}"]`)
    if (el instanceof HTMLElement) applySlotBox(el, slot)
  }

  function paintSelection(): void {
    for (const node of slotLayer.children) {
      if (node instanceof HTMLElement && node.dataset.slotId) {
        const isSelected = node.dataset.slotId === selection
        node.classList.toggle('is-selected', isSelected)
        node.style.zIndex = layerZ(node.dataset.slotId, isSelected)
      }
    }
    for (const node of stickerLayer.children) {
      if (node instanceof HTMLElement && node.dataset.sticker) {
        const isSelected = node.dataset.sticker === selection
        node.classList.toggle('is-selected', isSelected)
        node.style.zIndex = layerZ(node.dataset.sticker, isSelected)
      }
    }
    for (const node of textLayer.children) {
      if (node instanceof HTMLElement && node.dataset.textId) {
        const isSelected = node.dataset.textId === selection
        node.classList.toggle('is-selected', isSelected)
        node.style.zIndex = isSelected ? '100' : '90'
      }
    }
    frame.classList.toggle('is-frame-selected', selection === 'overlay')
    overlayImg.style.zIndex = layerZ('overlay', selection === 'overlay')
    for (const row of list.querySelectorAll<HTMLElement>('[data-layer]')) {
      row.classList.toggle('is-selected', row.dataset.layer === selection)
    }
  }

  function renderStickers(): void {
    stickerLayer.replaceChildren()
    for (const which of STICKERS) {
      const sticker = layout()[which]
      const addButton = $(`[data-add-sticker="${which}"]`, root) as HTMLButtonElement
      const deleteButton = $(`[data-delete-sticker="${which}"]`, root) as HTMLButtonElement
      addButton.hidden = sticker != null
      deleteButton.hidden = sticker == null
      $(`[data-sticker-status="${which}"]`, root).textContent =
        sticker == null ? 'not used in this aspect' : `${Math.round(sticker.sizeDp)}dp ${which === 'mood' ? 'mood face' : 'loggoo mark'}`
      if (which === 'logo') {
        const logo = layout().logo
        root.querySelectorAll<HTMLElement>('[data-logo-style]').forEach((node) => {
          node.hidden = logo == null
          node.classList.toggle('is-active', node.dataset.logoStyle === logo?.style)
        })
      }
      if (!sticker) continue

      const el = document.createElement('div')
      el.className = `mood-face mood-face--${which}`
      el.dataset.sticker = which
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', which === 'mood' ? 'mood face placement' : 'loggoo icon placement')
      const art =
        which === 'mood'
          ? `<svg class="mood-face__art" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M13 20c1.6-2.6 4.6-2.6 6.2 0M28.8 20c1.6-2.6 4.6-2.6 6.2 0M15 27c3.2 5.4 14.8 5.4 18 0" />
            </svg>`
          : `<svg class="mood-face__art mood-face__art--logo" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="18.5" cy="26" r="10" stroke="currentColor" stroke-width="5" />
              <circle cx="29.5" cy="26" r="10" stroke="currentColor" stroke-width="5" />
              <circle cx="36.5" cy="11.5" r="5" fill="#F6B393" />
            </svg>`
      el.innerHTML = `
        ${art}
        <span class="mood-face__meta"></span>
        <span class="mood-face__size" data-sticker-handle="resize" aria-label="resize"></span>
        <span class="slot__rotate" data-sticker-handle="rotate" aria-label="rotate"></span>
      `
      applyStickerBox(el, which, sticker)
      stickerLayer.append(el)
    }
  }

  function renderTexts(): void {
    textLayer.replaceChildren()
    addTextButton.hidden = layout().texts.length > 0
    for (const text of layout().texts) {
      const el = document.createElement('div')
      el.className = 'text-box'
      el.dataset.textId = text.id
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', 'note text placement')
      el.innerHTML = `
        <span class="text-box__body"></span>
        <span class="text-box__meta"></span>
        <span class="text-box__width" data-text-handle="w" aria-label="change text width"></span>
        <span class="slot__rotate" data-text-handle="rotate" aria-label="rotate text"></span>
      `
      $('.text-box__body', el).textContent = NOTE_SAMPLE
      applyTextBox(el, text)
      textLayer.append(el)
    }
  }

  function renderSlots(): void {
    const slots = layout().slots
    slotLayer.replaceChildren()
    for (const slot of slots) {
      const el = document.createElement('div')
      el.className = 'slot'
      el.dataset.slotId = slot.id
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', `photo slot ${slot.photo + 1}`)
      el.innerHTML = `
        <span class="slot__fill"></span>
        <span class="slot__label"></span>
        <span class="slot__meta"></span>
        <span class="slot__handle" data-handle="nw"></span>
        <span class="slot__handle" data-handle="ne"></span>
        <span class="slot__handle" data-handle="sw"></span>
        <span class="slot__handle" data-handle="se"></span>
        <span class="slot__handle slot__handle--radius" data-handle="radius"></span>
        <span class="slot__rotate" data-handle="rotate" aria-label="rotate"></span>
      `
      applySlotBox(el, slot)
      slotLayer.append(el)
    }

    renderLayers()
    renderInspector()
    renderStickers()
    renderTexts()
    scheduleSave()
  }

  function backgroundLabel(): string {
    const background = backgrounds[aspect]
    if (!background) return 'background · none'
    return background.kind === 'color' ? `background · ${background.color}` : `background · ${background.file.name}`
  }

  function layerRow(id: string, name: string, swatch: string, tools: string): HTMLElement {
    const row = document.createElement('div')
    row.className = 'layer-row'
    row.dataset.layer = id
    row.setAttribute('role', 'button')
    row.tabIndex = 0
    row.classList.toggle('is-selected', id === selection)
    row.innerHTML = `
      <span class="layer-row__swatch"></span>
      <span class="layer-row__name"></span>
      <span class="layer-row__tools">${tools}</span>
    `
    $('.layer-row__name', row).textContent = name
    if (swatch) row.style.setProperty('--swatch', swatch)
    return row
  }

  function renderLayers(): void {
    list.replaceChildren()
    const layers = layout().layers
    const top = layers.length - 1
    // Texts always paint above the stack: pinned rows on top, no reorder tools.
    for (const text of layout().texts) {
      const row = layerRow(text.id, `note text · ${text.font} ${text.sizeSp}sp`, text.color, '<span class="layer-row__pin">top</span>')
      row.classList.add('is-pinned')
      list.append(row)
    }
    // Photoshop order: top of the stack is the first row.
    for (let i = top; i >= 0; i--) {
      const id = layers[i]
      let name = ''
      let swatch = ''
      if (id === 'overlay') {
        name = overlays[aspect] ? 'frame overlay' : 'frame overlay · none yet'
      } else if (id === 'mood') {
        name = 'mood face'
        swatch = 'var(--lg-primary)'
      } else if (id === 'logo') {
        name = 'loggoo icon'
        swatch = '#211915'
      } else {
        const slot = layout().slots.find((item) => item.id === id)
        if (!slot) continue
        name = `photo ${slot.photo + 1} · ${Math.round(slot.w * 100)}×${Math.round(slot.h * 100)}`
        swatch = FILLS[slot.photo % FILLS.length]
      }
      const row = layerRow(
        id,
        name,
        swatch,
        `<button type="button" data-layer-up aria-label="bring forward" ${i === top ? 'disabled' : ''}>▲</button>
         <button type="button" data-layer-down aria-label="send backward" ${i === 0 ? 'disabled' : ''}>▼</button>`,
      )
      row.classList.toggle('is-missing', id === 'overlay' && overlays[aspect] == null)
      list.append(row)
    }
    // The background always paints first: pinned row at the bottom.
    const background = backgrounds[aspect]
    const row = layerRow(
      'background',
      backgroundLabel(),
      background?.kind === 'color' ? background.color : '',
      '<span class="layer-row__pin">bottom</span>',
    )
    row.classList.add('is-pinned')
    row.classList.toggle('is-missing', background == null)
    list.append(row)
  }

  function renderInspector(): void {
    const slot = selected()
    inspector.hidden = slot == null
    if (slot) input('[data-slot-photo]', inspector).value = String(slot.photo + 1)

    const text = selectedText()
    textInspector.hidden = text == null
    if (!text) return
    selectEl('[data-text-font]', textInspector).value = text.font
    input('[data-text-size]', textInspector).value = String(text.sizeSp)
    input('[data-text-color]', textInspector).value = text.color
    input('[data-text-lines]', textInspector).value = String(text.maxLines)
    selectEl('[data-text-align]', textInspector).value = text.align
  }

  function renderBackground(): void {
    const background = backgrounds[aspect]
    frame.style.background = background?.kind === 'color' ? background.color : ''
    if (background?.kind === 'image') {
      backgroundImg.hidden = false
      backgroundImg.src = urlFor(background.file)
    } else {
      backgroundImg.hidden = true
      backgroundImg.removeAttribute('src')
    }
    input('[data-background-color]', root).value = background?.kind === 'color' ? background.color : '#FBF6F0'
    input('[data-background-file]', root).value = ''
    removeBackgroundButton.hidden = background == null
    backgroundStatus.textContent =
      background == null
        ? 'none · the app paints its own surface'
        : background.kind === 'color'
          ? `solid ${background.color}`
          : `${background.file.name} · full-bleed`
  }

  function renderOverlay(): void {
    const file = overlays[aspect]
    const url = file ? urlFor(file) : null
    frame.dataset.aspect = aspect
    frame.classList.toggle('has-overlay', url != null)
    if (url) {
      overlayImg.hidden = false
      overlayImg.src = url
    } else {
      overlayImg.hidden = true
      overlayImg.removeAttribute('src')
    }
    $('[data-aspect-label]', root).textContent = aspect === 'story' ? '9:16 story' : '4:5 post'
    $('[data-overlay-empty]', root).textContent = url != null ? '' : `upload a ${aspect} overlay`
    input('[data-overlay-file]', root).value = ''
    removeOverlayButton.hidden = url == null
    if (url == null && selection === 'overlay') selection = null
    overlayImg.style.zIndex = layerZ('overlay', selection === 'overlay')
    frame.classList.toggle('is-frame-selected', selection === 'overlay')
    renderBackground()
    scheduleSave()
  }

  function selectLayer(id: string | null): void {
    selection = id
    renderSlots()
  }

  function addSticker(which: Sticker): void {
    if (layout()[which]) return
    if (which === 'mood') layout().mood = defaultMood()
    else layout().logo = defaultLogo()
    layout().layers.push(which)
    selection = which
    commit()
    renderSlots()
    setStatus(`${aspect} ${which === 'mood' ? 'mood face' : 'loggoo icon'} added — move, resize, or rotate it on the canvas`)
  }

  function removeSticker(which: Sticker): void {
    if (!layout()[which]) return
    delete layout()[which]
    layout().layers = layout().layers.filter((id) => id !== which)
    if (selection === which) selection = null
    commit()
    renderSlots()
    setStatus(`${aspect} will not render a ${which === 'mood' ? 'mood face' : 'loggoo icon'}`)
  }

  function addText(): void {
    if (layout().texts.length > 0) return
    const text = defaultText()
    layout().texts.push(text)
    selection = text.id
    commit()
    renderSlots()
    setStatus(`${aspect} note text added — drag it, pull the right edge to set its width, top knob rotates`)
  }

  function removeText(id: string): void {
    layout().texts = layout().texts.filter((text) => text.id !== id)
    if (selection === id) selection = null
    commit()
    renderSlots()
    setStatus(`${aspect} will not render the note`)
  }

  function setBackground(next: DraftBackground | null): void {
    backgrounds[aspect] = next
    commit()
    renderBackground()
    renderLayers()
    scheduleSave()
  }

  /** New photos go straight under the frame, like the app's default paint order. */
  function insertSlot(slot: DraftSlot): void {
    const { slots, layers } = layout()
    slots.push(slot)
    const overlayIndex = layers.indexOf('overlay')
    layers.splice(overlayIndex < 0 ? layers.length : overlayIndex, 0, slot.id)
    selection = slot.id
  }

  /**
   * First visit to an empty aspect copies the other aspect's slots, stickers, text, background, and layer order so
   * the author only nudges positions instead of redrawing. Heights are rescaled so each box keeps its dp size.
   */
  function seedFromOtherAspect(): void {
    const target = layout()
    if (target.slots.length > 0 || target.mood || target.logo || target.texts.length > 0 || backgrounds[aspect]) return
    const other: Aspect = aspect === 'story' ? 'post' : 'story'
    const source = layouts[other]
    if (source.slots.length === 0 && !source.mood && !source.logo && source.texts.length === 0 && !backgrounds[other]) return
    const scaleY = ASPECT_HEIGHT_DP[other] / ASPECT_HEIGHT_DP[aspect]
    const idMap = new Map<string, string>()
    target.slots = source.slots.map((slot) => {
      const id = uid()
      idMap.set(slot.id, id)
      const h = clamp01(Math.min(1, slot.h * scaleY))
      return { ...slot, id, h, y: clamp01(Math.min(slot.y * scaleY, 1 - h)) }
    })
    for (const which of STICKERS) {
      const sticker = source[which]
      if (!sticker) continue
      const copy = { ...sticker, y: sticker.y * scaleY }
      clampStickerPosition(copy)
      if (which === 'mood') target.mood = copy
      else target.logo = copy as LogoPlacement
    }
    target.texts = source.texts.map((text) => ({ ...text, id: uid(), y: clamp01(text.y * scaleY) }))
    target.layers = source.layers.map((id) => idMap.get(id) ?? id)
    backgrounds[aspect] = backgrounds[other]
    commit()
    setStatus(`copied ${other}'s layout — nudge it for ${aspect}`)
  }

  function addSlot(): void {
    const slots = layout().slots
    insertSlot(defaultSlot(slots.length))
    commit()
    renderSlots()
    setStatus(`slot ${slots.length} added — drag it onto the hole`)
  }

  function removeSelected(): void {
    const slots = layout().slots
    const index = slots.findIndex((slot) => slot.id === selection)
    if (index < 0) return
    const [removed] = slots.splice(index, 1)
    layout().layers = layout().layers.filter((id) => id !== removed.id)
    slots.forEach((slot, i) => {
      slot.photo = i
    })
    selection = slots[index]?.id ?? slots[index - 1]?.id ?? null
    commit()
    renderSlots()
  }

  function applyResize(origin: Slot, handle: Handle, x: number, y: number): Slot {
    let left = origin.x
    let top = origin.y
    let right = origin.x + origin.w
    let bottom = origin.y + origin.h
    if (handle.includes('w')) left = Math.min(x, right - 0.04)
    if (handle.includes('e')) right = Math.max(x, left + 0.04)
    if (handle.includes('n')) top = Math.min(y, bottom - 0.04)
    if (handle.includes('s')) bottom = Math.max(y, top + 0.04)
    return {
      ...origin,
      x: clamp01(left),
      y: clamp01(top),
      w: clamp01(right - left),
      h: clamp01(bottom - top),
    }
  }

  frame.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const { x, y } = localFrac(event)
    const handle = target.dataset.handle
    const stickerHandle = target.dataset.stickerHandle
    const stickerEl = target.closest('[data-sticker]')
    const textEl = target.closest('[data-text-id]')
    const slotEl = target.closest('[data-slot-id]')
    if (stickerEl instanceof HTMLElement) {
      const which = stickerEl.dataset.sticker as Sticker
      const sticker = layout()[which]
      if (!sticker) return
      selection = which
      if (stickerHandle === 'rotate') {
        pointer = {
          kind: 'sticker-rotate',
          which,
          origin: sticker.rotation,
          startAngle: stickerPointerAngle(event, sticker),
        }
      } else if (stickerHandle === 'resize') {
        pointer = { kind: 'sticker-resize', which }
      } else {
        pointer = { kind: 'sticker-move', which, startX: x, startY: y, originX: sticker.x, originY: sticker.y }
      }
      paintSelection()
    } else if (textEl instanceof HTMLElement) {
      const id = textEl.dataset.textId
      const text = layout().texts.find((item) => item.id === id)
      if (!text || !id) return
      selection = id
      const textHandle = target.dataset.textHandle
      if (textHandle === 'w') pointer = { kind: 'text-resize', id }
      else if (textHandle === 'rotate') {
        pointer = { kind: 'text-rotate', id, origin: text.rotation, startAngle: textPointerAngle(event, text) }
      } else pointer = { kind: 'text-move', id, startX: x, startY: y, originX: text.x, originY: text.y }
      paintSelection()
    } else if (handle && slotEl instanceof HTMLElement) {
      const id = slotEl.dataset.slotId
      const slot = layout().slots.find((item) => item.id === id)
      if (!slot || !id) return
      selection = id
      if (handle === 'rotate') {
        pointer = { kind: 'rotate', id, origin: slot.rotation, startAngle: pointerAngle(event, slot) }
      } else if (handle === 'radius') {
        pointer = { kind: 'radius', id }
      } else if (RESIZE.has(handle)) {
        pointer = {
          kind: 'resize',
          id,
          handle: handle as Handle,
          startX: x,
          startY: y,
          origin: { ...slot },
        }
      }
    } else if (slotEl instanceof HTMLElement) {
      const id = slotEl.dataset.slotId
      const slot = layout().slots.find((item) => item.id === id)
      if (!slot || !id) return
      selection = id
      pointer = { kind: 'move', id, startX: x, startY: y, originX: slot.x, originY: slot.y }
      paintSelection()
    } else if (mode === 'draw') {
      selection = null
      pointer = { kind: 'draw', startX: x, startY: y }
      rubber.hidden = false
      paintSelection()
    } else {
      // select mode: empty canvas click picks the frame (when there is one) or clears the selection
      selection = overlays[aspect] != null ? 'overlay' : null
      paintSelection()
      return
    }
    frame.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  frame.addEventListener('pointermove', (event) => {
    const currentPointer = pointer
    if (!currentPointer) return
    const { x, y } = localFrac(event)
    if (currentPointer.kind === 'move') {
      const slot = layout().slots.find((item) => item.id === currentPointer.id)
      if (!slot) return
      slot.x = clamp01(currentPointer.originX + (x - currentPointer.startX))
      slot.y = clamp01(currentPointer.originY + (y - currentPointer.startY))
      slot.x = clamp01(Math.min(slot.x, 1 - slot.w))
      slot.y = clamp01(Math.min(slot.y, 1 - slot.h))
      paintDragging()
    } else if (currentPointer.kind === 'resize') {
      const slot = layout().slots.find((item) => item.id === currentPointer.id)
      if (!slot) return
      Object.assign(slot, applyResize(currentPointer.origin, currentPointer.handle, x, y))
      paintDragging()
    } else if (currentPointer.kind === 'rotate') {
      const slot = layout().slots.find((item) => item.id === currentPointer.id)
      if (!slot) return
      slot.rotation = applyTilt(
        currentPointer.origin + wrapDelta(pointerAngle(event, slot) - currentPointer.startAngle),
      )
      paintDragging()
    } else if (currentPointer.kind === 'radius') {
      const slot = layout().slots.find((item) => item.id === currentPointer.id)
      if (!slot) return
      slot.cornerDp = applyCorner(event, slot)
      paintDragging()
    } else if (currentPointer.kind === 'sticker-move') {
      const sticker = layout()[currentPointer.which]
      if (!sticker) return
      sticker.x = currentPointer.originX + (x - currentPointer.startX)
      sticker.y = currentPointer.originY + (y - currentPointer.startY)
      clampStickerPosition(sticker)
      paintDragging()
    } else if (currentPointer.kind === 'sticker-resize') {
      const sticker = layout()[currentPointer.which]
      if (!sticker) return
      const sizeFromX = (x - sticker.x) * FRAME_WIDTH_DP
      const sizeFromY = (y - sticker.y) * ASPECT_HEIGHT_DP[aspect]
      const maximum = Math.min(
        MAX_STICKER_SIZE_DP,
        (1 - sticker.x) * FRAME_WIDTH_DP,
        (1 - sticker.y) * ASPECT_HEIGHT_DP[aspect],
      )
      sticker.sizeDp = Math.round(clamp(Math.max(sizeFromX, sizeFromY), MIN_STICKER_SIZE_DP, maximum))
      clampStickerPosition(sticker)
      paintDragging()
    } else if (currentPointer.kind === 'sticker-rotate') {
      const sticker = layout()[currentPointer.which]
      if (!sticker) return
      sticker.rotation = applyTilt(
        currentPointer.origin + wrapDelta(stickerPointerAngle(event, sticker) - currentPointer.startAngle),
      )
      paintDragging()
    } else if (currentPointer.kind === 'text-move') {
      const text = layout().texts.find((item) => item.id === currentPointer.id)
      if (!text) return
      text.x = clamp01(Math.min(currentPointer.originX + (x - currentPointer.startX), 1 - text.w))
      text.y = clamp01(currentPointer.originY + (y - currentPointer.startY))
      paintDragging()
    } else if (currentPointer.kind === 'text-resize') {
      const text = layout().texts.find((item) => item.id === currentPointer.id)
      if (!text) return
      text.w = clamp(x - text.x, MIN_TEXT_W, 1 - text.x)
      paintDragging()
    } else if (currentPointer.kind === 'text-rotate') {
      const text = layout().texts.find((item) => item.id === currentPointer.id)
      if (!text) return
      text.rotation = applyTilt(
        currentPointer.origin + wrapDelta(textPointerAngle(event, text) - currentPointer.startAngle),
      )
      paintDragging()
    } else {
      const left = Math.min(currentPointer.startX, x)
      const top = Math.min(currentPointer.startY, y)
      rubber.style.left = `${left * 100}%`
      rubber.style.top = `${top * 100}%`
      rubber.style.width = `${Math.abs(x - currentPointer.startX) * 100}%`
      rubber.style.height = `${Math.abs(y - currentPointer.startY) * 100}%`
    }
  })

  function endPointer(): void {
    if (pointer?.kind === 'draw') {
      const w = parseFloat(rubber.style.width) / 100
      const h = parseFloat(rubber.style.height) / 100
      const x = parseFloat(rubber.style.left) / 100
      const y = parseFloat(rubber.style.top) / 100
      rubber.hidden = true
      rubber.style.width = '0'
      rubber.style.height = '0'
      if (w >= 0.04 && h >= 0.04) {
        const slot: DraftSlot = {
          id: uid(),
          photo: layout().slots.length,
          x,
          y,
          w,
          h,
          rotation: 0,
          cornerDp: 8,
        }
        insertSlot(slot)
        setMode('select')
        setStatus(`photo ${slot.photo + 1} drawn — back in select mode`)
      }
      commit()
      renderSlots()
    } else if (pointer) {
      commit()
      renderSlots()
    }
    pointer = null
  }

  // Clicking the stage around the canvas clears the selection; the sidebar keeps it so its buttons still apply.
  $('.stage', root).addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || frame.contains(event.target as Node)) return
    selectLayer(null)
  })

  // ⌘/Ctrl + wheel (and trackpad pinch, which arrives as a ctrlKey wheel) zooms about the cursor; a plain wheel scrolls.
  const stage = $('.stage', root)
  stage.addEventListener(
    'wheel',
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const before = zoom
      setZoom(zoom * Math.exp(-event.deltaY * 0.01))
      const ratio = zoom / before
      const box = stage.getBoundingClientRect()
      const px = event.clientX - box.left
      const py = event.clientY - box.top
      stage.scrollLeft = (stage.scrollLeft + px) * ratio - px
      stage.scrollTop = (stage.scrollTop + py) * ratio - py
    },
    { passive: false },
  )

  frame.addEventListener('pointerup', endPointer)
  frame.addEventListener('pointercancel', endPointer)

  list.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const row = target.closest('[data-layer]')
    if (!(row instanceof HTMLElement) || !row.dataset.layer) return
    if (target.closest('[data-layer-up]')) moveLayer(row.dataset.layer, 1)
    else if (target.closest('[data-layer-down]')) moveLayer(row.dataset.layer, -1)
    else selectLayer(row.dataset.layer)
  })
  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const row = (event.target as HTMLElement).closest('[data-layer]')
    if (row instanceof HTMLElement && row.dataset.layer && event.target === row) {
      event.preventDefault()
      selectLayer(row.dataset.layer)
    }
  })

  function setMode(next: Mode): void {
    mode = next
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.mode === next)
    })
    frame.style.cursor = next === 'draw' ? 'crosshair' : 'default'
    const hint = $('[data-mode-hint]', root)
    hint.firstChild!.textContent =
      next === 'draw'
        ? 'draw: drag on the canvas to punch a photo hole · switches back to select after one · '
        : 'select: click the frame, a slot, a sticker, or the note · move / resize · top knob rotates · inner dot rounds photo corners · '
  }

  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.mode
      if (next === 'select' || next === 'draw') setMode(next)
    })
  })

  $('[data-add-slot]', root).addEventListener('click', addSlot)
  $('[data-delete-slot]', root).addEventListener('click', removeSelected)
  for (const which of STICKERS) {
    $(`[data-add-sticker="${which}"]`, root).addEventListener('click', () => addSticker(which))
    $(`[data-delete-sticker="${which}"]`, root).addEventListener('click', () => removeSticker(which))
  }
  root.querySelectorAll<HTMLButtonElement>('[data-logo-style]').forEach((button) => {
    button.addEventListener('click', () => {
      const logo = layout().logo
      const style = button.dataset.logoStyle
      if (!logo || !(LOGO_STYLES as readonly string[]).includes(style ?? '')) return
      logo.style = style as LogoStyle
      selection = 'logo'
      commit()
      renderSlots()
    })
  })
  addTextButton.addEventListener('click', addText)
  $('[data-delete-text]', root).addEventListener('click', () => {
    const text = selectedText()
    if (text) removeText(text.id)
  })

  root.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.aspect
      if (next !== 'story' && next !== 'post') return
      aspect = next
      root.querySelectorAll('[data-aspect]').forEach((node) => {
        node.classList.toggle('is-active', node === button)
      })
      selection = null
      seedFromOtherAspect()
      renderOverlay()
      renderSlots()
    })
  })

  input('[data-overlay-file]', root).accept = IMAGE_ACCEPT
  input('[data-background-file]', root).accept = IMAGE_ACCEPT
  input('[data-icon-file]', root).accept = IMAGE_ACCEPT

  input('[data-overlay-file]', root).addEventListener('change', (event) => {
    const picker = event.target as HTMLInputElement
    const file = picker.files?.[0]
    if (!file) return
    if (!imageExt(file)) {
      picker.value = ''
      toast('error', 'overlay must be png, jpg, or jpeg')
      return
    }
    overlays[aspect] = file
    selection = 'overlay'
    commit()
    renderOverlay()
    renderSlots()
    setStatus(`${aspect} overlay loaded — drag slots onto the holes`)
  })

  function removeOverlay(): void {
    if (!overlays[aspect]) return
    overlays[aspect] = null
    commit()
    renderOverlay()
    renderLayers()
    setStatus(`${aspect} overlay removed — slots and mood stay put`)
  }

  removeOverlayButton.addEventListener('click', removeOverlay)

  input('[data-background-file]', root).addEventListener('change', (event) => {
    const picker = event.target as HTMLInputElement
    const file = picker.files?.[0]
    if (!file) return
    if (!imageExt(file)) {
      picker.value = ''
      toast('error', 'background must be png, jpg, or jpeg')
      return
    }
    setBackground({ kind: 'image', file })
    setStatus(`${aspect} background image set — it paints under everything`)
  })

  // `input` fires on every drag of the colour wheel; only `change` commits, so undo gets one step per pick.
  input('[data-background-color]', root).addEventListener('input', (event) => {
    const color = (event.target as HTMLInputElement).value.toUpperCase()
    backgrounds[aspect] = { kind: 'color', color }
    frame.style.background = color
    backgroundImg.hidden = true
  })
  input('[data-background-color]', root).addEventListener('change', (event) => {
    setBackground({ kind: 'color', color: (event.target as HTMLInputElement).value.toUpperCase() })
    setStatus(`${aspect} background colour set`)
  })

  function removeBackground(): void {
    if (!backgrounds[aspect]) return
    setBackground(null)
    if (selection === 'background') selectLayer(null)
    setStatus(`${aspect} background removed`)
  }

  removeBackgroundButton.addEventListener('click', removeBackground)

  function imageSize(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('undecodable image'))
      img.src = URL.createObjectURL(file)
    })
  }

  input('[data-icon-file]', root).addEventListener('change', async (event) => {
    const picker = event.target as HTMLInputElement
    const file = picker.files?.[0]
    const iconStatus = $('[data-icon-status]', root)
    if (!file) {
      iconFile = null
      iconStatus.textContent = ''
      scheduleSave()
      return
    }
    if (!imageExt(file)) {
      picker.value = ''
      iconFile = null
      toast('error', 'icon must be png, jpg, or jpeg')
      return
    }
    const size = await imageSize(file).catch(() => null)
    if (!size) {
      picker.value = ''
      iconFile = null
      toast('error', 'icon could not be decoded')
      return
    }
    if (size.width !== size.height || size.width < ICON_MIN_PX) {
      picker.value = ''
      iconFile = null
      iconStatus.textContent = ''
      toast('error', `icon must be square and at least ${ICON_MIN_PX}px — got ${size.width}×${size.height}`)
      return
    }
    iconFile = file
    iconStatus.textContent =
      size.width < ICON_RECOMMENDED_PX
        ? `${size.width}px icon — ${ICON_RECOMMENDED_PX}px is recommended so the rail stays crisp`
        : `${size.width}px icon ✓`
    scheduleSave()
  })

  inspector.addEventListener('input', (event) => {
    const slot = selected()
    if (!slot || !(event.target instanceof HTMLInputElement)) return
    if (event.target.matches('[data-slot-photo]')) {
      slot.photo = Math.max(0, Math.floor(Number(event.target.value) - 1))
    }
    commit()
    renderSlots()
  })

  textInspector.addEventListener('input', (event) => {
    const text = selectedText()
    const field = event.target
    if (!text || !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return
    if (field.matches('[data-text-font]') && (FONTS as readonly string[]).includes(field.value)) {
      text.font = field.value as Font
    } else if (field.matches('[data-text-size]')) {
      text.sizeSp = clamp(Math.round(Number(field.value)) || 4, 4, 200)
    } else if (field.matches('[data-text-color]') && HEX_COLOR.test(field.value)) {
      text.color = field.value.toUpperCase()
    } else if (field.matches('[data-text-lines]')) {
      text.maxLines = clamp(Math.floor(Number(field.value)) || 1, 1, MAX_TEXT_LINES)
    } else if (field.matches('[data-text-align]') && (ALIGNS as readonly string[]).includes(field.value)) {
      text.align = field.value as Align
    } else {
      return
    }
    // Colour drags fire `input` continuously; the change event below commits once.
    if (field.matches('[data-text-color]')) {
      const el = textLayer.querySelector(`[data-text-id="${text.id}"]`)
      if (el instanceof HTMLElement) applyTextBox(el, text)
      return
    }
    commit()
    renderTexts()
    renderLayers()
    scheduleSave()
  })
  textInspector.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-text-color]')) return
    commit()
    renderLayers()
    scheduleSave()
  })

  document.addEventListener('keydown', (event) => {
    const active = document.activeElement
    const typing =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement
    const meta = event.metaKey || event.ctrlKey
    if (meta && !event.altKey) {
      // Zoom: ⌘/Ctrl + / - / 0. Taken over from the browser so the page chrome stays put.
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        setZoom(zoom * ZOOM_STEP)
        return
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setZoom(zoom / ZOOM_STEP)
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        setZoom(1)
        return
      }
      // Undo/redo: ⌘/Ctrl Z, ⌘/Ctrl ⇧ Z, Ctrl Y. Text fields keep the browser's own undo.
      if (typing) return
      const key = event.key.toLowerCase()
      if (key === 'z' && event.shiftKey) {
        event.preventDefault()
        redo()
        return
      }
      if (key === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    if (typing) return
    if (!root.contains(active) && selection == null) return
    if (selection == null) return
    event.preventDefault()
    if (selection === 'overlay') removeOverlay()
    else if (selection === 'background') removeBackground()
    else if (selection === 'mood' || selection === 'logo') removeSticker(selection)
    else if (selectedText()) removeText(selection)
    else removeSelected()
  })

  $('[data-export]', root).addEventListener('click', () => {
    void exportPack()
  })

  root.querySelectorAll('input[name]').forEach((field) => {
    field.addEventListener('input', () => field.classList.remove('is-invalid'))
  })
  input('[name="nameEn"]', root).addEventListener('input', () => {
    syncId()
  })
  root.querySelectorAll('input[name]').forEach((field) => {
    field.addEventListener('input', scheduleSave)
  })
  syncId()

  $('[data-reset]', root).addEventListener('click', () => {
    if (!window.confirm('Start over? This clears the saved draft, both overlays, backgrounds, slots, and names.')) return
    window.clearTimeout(saveTimer)
    void clearDraft()
    overlays.story = null
    overlays.post = null
    backgrounds.story = null
    backgrounds.post = null
    layouts.story = emptyLayout()
    layouts.post = emptyLayout()
    iconFile = null
    input('[name="nameEn"]', root).value = ''
    input('[name="nameVi"]', root).value = ''
    input('[name="premium"]', root).checked = true
    input('[data-icon-file]', root).value = ''
    snippet.value = ''
    syncId()
    selection = null
    resetHistory()
    renderOverlay()
    renderSlots()
    toast('info', 'fresh canvas')
  })

  async function restoreDraft(): Promise<void> {
    const draft = await loadDraft<Draft>()
    if (!draft) return
    input('[name="nameEn"]', root).value = draft.nameEn
    input('[name="nameVi"]', root).value = draft.nameVi
    input('[name="premium"]', root).checked = draft.premium
    layouts.story = draft.layouts.story
    layouts.post = draft.layouts.post
    overlays.story = draft.overlays.story
    overlays.post = draft.overlays.post
    backgrounds.story = draft.backgrounds?.story ?? null
    backgrounds.post = draft.backgrounds?.post ?? null
    iconFile = draft.icon
    syncId()
    aspect = draft.aspect
    root.querySelectorAll<HTMLElement>('[data-aspect]').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.aspect === aspect)
    })
    selection = null
    resetHistory()
    renderOverlay()
    renderSlots()
    toast('info', `restored your draft from ${new Date(draft.savedAt).toLocaleString()}`)
    setStatus('draft restored — "start over" clears it')
  }

  async function exportPack(): Promise<void> {
    const en = input('[name="nameEn"]', root).value.trim()
    const vi = input('[name="nameVi"]', root).value.trim()
    const id = syncId()
    clearInvalid()
    if (!en || !vi) {
      if (!en) markInvalid('nameEn')
      if (!vi) markInvalid('nameVi')
      ;(!en ? input('[name="nameEn"]', root) : input('[name="nameVi"]', root)).focus()
      toast('error', 'fill both English and Vietnamese names')
      return
    }
    if (!id) {
      markInvalid('nameEn').focus()
      toast('error', 'English name needs a letter or number so an id can be made')
      return
    }
    if (!overlays.story || !overlays.post) {
      toast('error', 'upload both a story overlay and a post overlay')
      return
    }
    const storyExt = imageExt(overlays.story)
    const postExt = imageExt(overlays.post)
    const iconExt = iconFile ? imageExt(iconFile) : 'png'
    if (!storyExt || !postExt || !iconExt) {
      toast('error', 'overlays and icon must be png, jpg, or jpeg')
      return
    }

    const layers = (which: Aspect): Layer[] =>
      layouts[which].layers.flatMap((id): Layer[] => {
        if (id === 'overlay') return [{ kind: 'overlay' }]
        if (id === 'mood') return [{ kind: 'mood' }]
        if (id === 'logo') return [{ kind: 'logo' }]
        const slot = layouts[which].slots.find((item) => item.id === id)
        return slot ? [{ kind: 'photo', photo: slot.photo }] : []
      })

    const texts = (which: Aspect): TextBind[] => layouts[which].texts.map(({ id: _id, ...text }) => text)

    /** Background image files are `story_bg.<ext>` / `post_bg.<ext>`; colours need no file. */
    const background = (which: Aspect): { manifest?: Background; file?: { path: string; data: File } } => {
      const value = backgrounds[which]
      if (!value) return {}
      if (value.kind === 'color') return { manifest: value }
      const name = `${which}_bg.${imageExt(value.file) ?? 'png'}`
      return { manifest: { kind: 'image', file: name }, file: { path: name, data: value.file } }
    }

    try {
      const storyOverlay = `story.${storyExt}`
      const postOverlay = `post.${postExt}`
      const iconName = `icon.${iconExt}`
      const storyBg = background('story')
      const postBg = background('post')
      const manifest = buildManifest({
        id,
        names: { en, vi },
        premium: input('[name="premium"]', root).checked,
        story: {
          overlay: storyOverlay,
          background: storyBg.manifest,
          slots: layouts.story.slots,
          texts: texts('story'),
          mood: layouts.story.mood,
          logo: layouts.story.logo,
          layers: layers('story'),
        },
        post: {
          overlay: postOverlay,
          background: postBg.manifest,
          slots: layouts.post.slots,
          texts: texts('post'),
          mood: layouts.post.mood,
          logo: layouts.post.logo,
          layers: layers('post'),
        },
      })
      const entry = catalogSnippet(manifest, iconName)
      const encoder = new TextEncoder()
      const files = [
        { path: `frames/${id}/manifest.json`, data: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) },
        { path: `frames/${id}/${storyOverlay}`, data: await fileBytes(overlays.story) },
        { path: `frames/${id}/${postOverlay}`, data: await fileBytes(overlays.post) },
        { path: `frames/${id}/${iconName}`, data: iconFile ? await fileBytes(iconFile) : await fallbackIcon() },
      ]
      for (const bg of [storyBg, postBg]) {
        if (bg.file) files.push({ path: `frames/${id}/${bg.file.path}`, data: await fileBytes(bg.file.data) })
      }
      const blob = zipStore(files)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${id}.zip`
      link.click()
      URL.revokeObjectURL(link.href)
      snippet.value = `${JSON.stringify(entry, null, 2)},`
      toast('success', 'zip downloaded — unzip into loggoo_asset')
      setStatus('paste the catalog snippet into catalog.json, then commit')
    } catch {
      toast('error', 'export failed — try again')
    }
  }

  async function fallbackIcon(): Promise<Uint8Array> {
    const canvas = document.createElement('canvas')
    canvas.width = ICON_RECOMMENDED_PX
    canvas.height = ICON_RECOMMENDED_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.fillStyle = '#FBE7D6'
    ctx.fillRect(0, 0, ICON_RECOMMENDED_PX, ICON_RECOMMENDED_PX)
    ctx.fillStyle = '#F6B393'
    ctx.fillRect(56, 56, 144, 144)
    return pngFromCanvas(canvas)
  }

  setMode('select')
  setZoom(1)
  renderOverlay()
  renderSlots()
  resetHistory()
  setStatus('upload a story overlay, then switch to draw slot to punch a photo hole')
  void restoreDraft()
}
