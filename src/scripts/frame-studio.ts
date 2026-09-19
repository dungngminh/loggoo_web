import {
  ALIGNS,
  ASPECTS,
  FONTS,
  HEX_COLOR,
  IMAGE_ACCEPT,
  LOGO_STYLES,
  MAX_TEXT_LINES,
  SCHEMA_VERSION,
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
  schemaVersion?: number
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
/** Safe-area insets as canvas fractions: 16dp at the sides; stories also keep the top / bottom 14% clear of the story UI chrome. */
const SAFE_INSET: Record<Aspect, { x: number; y: number }> = {
  story: { x: 16 / 360, y: 0.14 },
  post: { x: 16 / 360, y: 16 / 450 },
}
const SNAP_PX = 6
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
/** Placeholder "photos" for preview mode: little pastel scenes as inline SVG, one per photo index. */
const PREVIEW_PHOTOS = [
  // sunset over hills
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#F6B393'/><stop offset='1' stop-color='#F6E3A3'/></linearGradient></defs><rect width='400' height='400' fill='url(#s)'/><circle cx='280' cy='150' r='56' fill='#FBF6F0' opacity='.85'/><path d='M0 300 Q120 200 240 290 T400 270 V400 H0z' fill='#9BD9B8'/><path d='M0 340 Q160 260 400 330 V400 H0z' fill='#6FB894'/></svg>`,
  // sea and sky
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#A9D6EE'/><ellipse cx='110' cy='110' rx='70' ry='28' fill='#FBF6F0' opacity='.9'/><ellipse cx='300' cy='70' rx='50' ry='20' fill='#FBF6F0' opacity='.7'/><rect y='240' width='400' height='160' fill='#5FA8D3'/><path d='M0 250 Q50 240 100 250 T200 250 T300 250 T400 250' stroke='#FBF6F0' stroke-width='4' fill='none' opacity='.6'/></svg>`,
  // pink blossom
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#F3C3CB'/><circle cx='120' cy='150' r='70' fill='#E8804F' opacity='.55'/><circle cx='250' cy='230' r='95' fill='#F6B393' opacity='.7'/><circle cx='320' cy='110' r='40' fill='#FBF6F0' opacity='.8'/><path d='M60 360 L120 250 L200 380z' fill='#4A3728' opacity='.35'/></svg>`,
  // night
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#4A3728'/><circle cx='300' cy='100' r='40' fill='#F6E3A3'/><circle cx='80' cy='60' r='3' fill='#FBF6F0'/><circle cx='150' cy='130' r='2' fill='#FBF6F0'/><circle cx='220' cy='50' r='2.5' fill='#FBF6F0'/><path d='M0 320 Q100 260 200 320 T400 300 V400 H0z' fill='#211915'/></svg>`,
].map((svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
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
  const ctx = $('[data-ctx]')
  const guideV = $('[data-guide="v"]', root)
  const guideH = $('[data-guide="h"]', root)
  const list = $('[data-layer-list]', root)
  const inspector = $('[data-inspector]', root)
  const lockRatio = input('[data-slot-lock]', root)
  const textInspector = $('[data-text-inspector]', root)
  const stickerInspector = $('[data-sticker-inspector]', root)
  const snippet = $('[data-snippet]', root) as HTMLTextAreaElement
  const status = $('[data-status]', root)
  const toasts = $('[data-toasts]')
  const idLabel = $('[data-id]', root)
  const removeOverlayButton = $('[data-remove-overlay]', root) as HTMLButtonElement
  const removeBackgroundButton = $('[data-remove-background]', root) as HTMLButtonElement
  const backgroundStatus = $('[data-background-status]', root)
  const addTextButton = $('[data-add-text]', root) as HTMLButtonElement
  const undoButton = $('[data-undo]', root) as HTMLButtonElement
  const redoButton = $('[data-redo]', root) as HTMLButtonElement
  const savedLabel = $('[data-saved]', root)

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
    paintHistory()
  }

  function paintHistory(): void {
    undoButton.disabled = historyIndex <= 0
    redoButton.disabled = historyIndex >= history.length - 1
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
    paintHistory()
    setStatus('undo')
  }

  function redo(): void {
    if (historyIndex >= history.length - 1) return
    historyIndex++
    restore(history[historyIndex])
    paintHistory()
    setStatus('redo')
  }

  function setZoom(next: number): void {
    zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    frame.style.setProperty('--zoom', String(zoom))
    $('[data-zoom]', root).textContent = `${Math.round(zoom * 100)}%`
  }

  function schemaVersion(): number {
    return Number(selectEl('[name="schemaVersion"]', root).value) || SCHEMA_VERSION
  }

  /** `data-schema` on the root drives the CSS that hides controls the chosen schema never had; canvas colour is inline so it re-renders. */
  function syncSchemaHint(): void {
    root.dataset.schema = String(schemaVersion())
    $('[data-schema-hint]', root).hidden = schemaVersion() >= SCHEMA_VERSION
    renderBackground()
  }

  function scheduleSave(): void {
    window.clearTimeout(saveTimer)
    savedLabel.textContent = 'saving…'
    saveTimer = window.setTimeout(() => {
      const draft: Draft = {
        nameEn: input('[name="nameEn"]', root).value,
        nameVi: input('[name="nameVi"]', root).value,
        premium: input('[name="premium"]', root).checked,
        schemaVersion: schemaVersion(),
        aspect,
        layouts: JSON.parse(JSON.stringify(layouts)) as Record<Aspect, Layout>,
        overlays: { ...overlays },
        backgrounds: { ...backgrounds },
        icon: iconFile,
        savedAt: Date.now(),
      }
      void saveDraft(draft).then(
        () => (savedLabel.textContent = `saved ${new Date(draft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`),
        () => (savedLabel.textContent = 'not saved'),
      )
    }, 400)
  }

  /** Inline z-index: 10 + stack position; texts sit at 90; the selected layer lifts above everything so its handles stay reachable. */
  function layerZ(id: string, isSelected: boolean): string {
    return isSelected ? '100' : String(10 + layout().layers.indexOf(id))
  }

  /** Lights the active page button (the `.frame` also carries data-aspect; the class is harmless there). */
  function paintAspect(): void {
    root.querySelectorAll<HTMLElement>('[data-aspect]').forEach((node) => {
      node.classList.toggle('is-active', node.dataset.aspect === aspect)
    })
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

  function selectedSticker(): Sticker | undefined {
    return selection === 'mood' || selection === 'logo' ? selection : undefined
  }

  /** The design panel shows the section this kind needs; 'none' / 'frame' / 'background' fall back to the aspect settings. */
  function paintSelectionKind(): void {
    root.dataset.selection =
      selection == null ? 'none'
      : selection === 'overlay' ? 'frame'
      : selection === 'background' ? 'background'
      : selectedSticker() ? 'sticker'
      : selectedText() ? 'text'
      : selected() ? 'slot'
      : 'none'
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

  // One toast at a time: a new one replaces whatever is showing, so rapid actions never stack a column of them.
  let toastTimer: number | undefined
  function toast(kind: 'error' | 'success' | 'info', message: string): void {
    window.clearTimeout(toastTimer)
    toasts.replaceChildren()
    const el = document.createElement('p')
    el.className = `toast toast--${kind}`
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status')
    el.textContent = message
    toasts.append(el)
    toastTimer = window.setTimeout(() => {
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

  /**
   * Smart guides for a move: snap the box's left / centre / right (and top / centre / bottom) to the canvas edges, centre,
   * and safe-area lines when within SNAP_PX on screen, and light the matching guide line. Alt bypasses it.
   */
  function snapMove(box: { x: number; y: number; w: number; h: number }, event: PointerEvent): { x: number; y: number } {
    const rect = frame.getBoundingClientRect()
    const safe = SAFE_INSET[aspect]
    const axis = (pos: number, size: number, inset: number, threshold: number): { pos: number; line: number | null } => {
      const targets = [0, inset, 0.5, 1 - inset, 1]
      const edges = [pos, pos + size / 2, pos + size]
      let best: { pos: number; line: number | null; delta: number } = { pos, line: null, delta: threshold }
      for (const target of targets) {
        edges.forEach((edge, i) => {
          const delta = Math.abs(edge - target)
          if (delta < best.delta) best = { pos: target - (size * i) / 2, line: target, delta }
        })
      }
      return best
    }
    const snapX = event.altKey ? { pos: box.x, line: null } : axis(box.x, box.w, safe.x, SNAP_PX / rect.width)
    const snapY = event.altKey ? { pos: box.y, line: null } : axis(box.y, box.h, safe.y, SNAP_PX / rect.height)
    guideV.hidden = snapX.line == null
    guideH.hidden = snapY.line == null
    if (snapX.line != null) guideV.style.left = `${snapX.line * 100}%`
    if (snapY.line != null) guideH.style.top = `${snapY.line * 100}%`
    return { x: snapX.pos, y: snapY.pos }
  }

  function hideGuides(): void {
    guideV.hidden = true
    guideH.hidden = true
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

  /** Box size on the app's fixed design canvas (360dp wide), so authors read the same numbers the manifest implies. */
  function sizeLabel(w: number, h: number): string {
    return `${Math.round(w * FRAME_WIDTH_DP)}×${Math.round(h * ASPECT_HEIGHT_DP[aspect])}dp`
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
    el.style.setProperty('--photo', PREVIEW_PHOTOS[slot.photo % PREVIEW_PHOTOS.length])
    el.style.setProperty('--corner', `${slot.cornerDp}`)
    const label = el.querySelector('.slot__label')
    const meta = el.querySelector('.slot__meta')
    if (label) label.textContent = `photo ${slot.photo + 1}`
    if (meta) meta.textContent = `${sizeLabel(slot.w, slot.h)} · ${Math.round(slot.rotation)}° · r${Math.round(slot.cornerDp)}`
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
    paintSelectionKind()
  }

  function renderStickers(): void {
    stickerLayer.replaceChildren()
    for (const which of STICKERS) {
      const sticker = layout()[which]
      const addButton = $(`[data-add-sticker="${which}"]`, root) as HTMLButtonElement
      const deleteButton = $(`[data-delete-sticker="${which}"]`, root) as HTMLButtonElement
      addButton.hidden = sticker != null
      deleteButton.hidden = selection !== which
      const statusEl = $(`[data-sticker-status="${which}"]`, root)
      statusEl.hidden = selection !== which
      statusEl.textContent = which === 'mood' ? 'mood face' : 'loggoo icon'
      if (which === 'logo') {
        const logo = layout().logo
        root.querySelectorAll<HTMLElement>('[data-logo-style]').forEach((node) => {
          node.hidden = logo == null || selection !== 'logo'
          node.classList.toggle('is-active', node.dataset.logoStyle === logo?.style)
        })
      }
      if (!sticker) continue

      const el = document.createElement('div')
      el.className = `mood-face mood-face--${which}`
      el.dataset.sticker = which
      if (which === 'logo') el.dataset.minSchema = '4'
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
        <span class="text-box__width" data-text-handle="w" aria-label="change text width" data-min-schema="4"></span>
        <span class="slot__rotate" data-text-handle="rotate" aria-label="rotate text" data-min-schema="4"></span>
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
        name = overlays[aspect] ? 'frame overlay' : 'frame overlay · optional'
      } else if (id === 'mood') {
        name = 'mood face'
        swatch = 'var(--lg-primary)'
      } else if (id === 'logo') {
        name = 'loggoo icon'
        swatch = '#211915'
      } else {
        const slot = layout().slots.find((item) => item.id === id)
        if (!slot) continue
        name = `photo ${slot.photo + 1} · ${sizeLabel(slot.w, slot.h)}`
        swatch = FILLS[slot.photo % FILLS.length]
      }
      const row = layerRow(
        id,
        name,
        swatch,
        `<button type="button" data-layer-up aria-label="bring forward" data-min-schema="3" ${i === top ? 'disabled' : ''}>▲</button>
         <button type="button" data-layer-down aria-label="send backward" data-min-schema="3" ${i === 0 ? 'disabled' : ''}>▼</button>`,
      )
      if (id === 'logo') row.dataset.minSchema = '4'
      row.classList.toggle('is-missing', id === 'overlay' && overlays[aspect] == null)
      row.classList.toggle('is-movable', schemaVersion() >= 3)
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
    row.dataset.minSchema = '4'
    row.classList.toggle('is-missing', background == null)
    list.append(row)
  }

  function renderInspector(): void {
    paintSelectionKind()
    const slot = selected()
    inspector.hidden = slot == null
    if (slot) {
      input('[data-slot-photo]', inspector).value = String(slot.photo + 1)
      input('[data-slot-x]', inspector).value = String(Math.round(slot.x * FRAME_WIDTH_DP))
      input('[data-slot-y]', inspector).value = String(Math.round(slot.y * ASPECT_HEIGHT_DP[aspect]))
      input('[data-slot-w]', inspector).value = String(Math.round(slot.w * FRAME_WIDTH_DP))
      input('[data-slot-h]', inspector).value = String(Math.round(slot.h * ASPECT_HEIGHT_DP[aspect]))
      input('[data-slot-rotation]', inspector).value = String(Math.round(slot.rotation))
      input('[data-slot-corner]', inspector).value = String(Math.round(slot.cornerDp))
    }

    const which = selectedSticker()
    const sticker = which && layout()[which]
    stickerInspector.hidden = sticker == null
    if (sticker) {
      input('[data-sticker-x]', stickerInspector).value = String(Math.round(sticker.x * FRAME_WIDTH_DP))
      input('[data-sticker-y]', stickerInspector).value = String(Math.round(sticker.y * ASPECT_HEIGHT_DP[aspect]))
      input('[data-sticker-size]', stickerInspector).value = String(Math.round(sticker.sizeDp))
      input('[data-sticker-rotation]', stickerInspector).value = String(Math.round(sticker.rotation))
    }

    const text = selectedText()
    textInspector.hidden = text == null
    if (!text) return
    input('[data-text-x]', textInspector).value = String(Math.round(text.x * FRAME_WIDTH_DP))
    input('[data-text-y]', textInspector).value = String(Math.round(text.y * ASPECT_HEIGHT_DP[aspect]))
    input('[data-text-w]', textInspector).value = String(Math.round(text.w * FRAME_WIDTH_DP))
    input('[data-text-rotation]', textInspector).value = String(Math.round(text.rotation))
    selectEl('[data-text-font]', textInspector).value = text.font
    input('[data-text-size]', textInspector).value = String(text.sizeSp)
    input('[data-text-color]', textInspector).value = text.color
    input('[data-text-lines]', textInspector).value = String(text.maxLines)
    selectEl('[data-text-align]', textInspector).value = text.align
  }

  function renderBackground(): void {
    const background = backgrounds[aspect]
    frame.style.background = background?.kind === 'color' && schemaVersion() >= SCHEMA_VERSION ? background.color : ''
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
    frame.style.setProperty('--safe-x', `${SAFE_INSET[aspect].x * 100}%`)
    frame.style.setProperty('--safe-y', `${SAFE_INSET[aspect].y * 100}%`)
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

  /** Backspace, the context menu, and the layers panel all delete through here. */
  function removeSelection(): void {
    if (selection == null) return
    if (selection === 'overlay') removeOverlay()
    else if (selection === 'background') removeBackground()
    else if (selection === 'mood' || selection === 'logo') removeSticker(selection)
    else if (selectedText()) removeText(selection)
    else removeSelected()
  }

  /** Only photo slots duplicate: stickers and the note are one-per-aspect. The copy lands 16dp down-right, one layer above the original. */
  function duplicateSelected(): void {
    const slot = selected()
    if (!slot) return
    const { slots, layers } = layout()
    const copy: DraftSlot = {
      ...slot,
      id: uid(),
      photo: slots.length,
      x: clamp01(Math.min(slot.x + 16 / FRAME_WIDTH_DP, 1 - slot.w)),
      y: clamp01(Math.min(slot.y + 16 / ASPECT_HEIGHT_DP[aspect], 1 - slot.h)),
    }
    slots.push(copy)
    layers.splice(layers.indexOf(slot.id) + 1, 0, copy.id)
    selection = copy.id
    commit()
    renderSlots()
    setStatus(`photo ${copy.photo + 1} duplicated`)
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
    if (lockRatio.checked) {
      // Follow whichever axis the pointer stretched more, then keep the box inside the canvas from its anchored corner.
      const ratio = origin.w / origin.h
      let w = right - left
      let h = bottom - top
      if (w / origin.w >= h / origin.h) h = w / ratio
      else w = h * ratio
      const roomW = handle.includes('w') ? right : 1 - left
      const roomH = handle.includes('n') ? bottom : 1 - top
      if (w > roomW) {
        w = roomW
        h = w / ratio
      }
      if (h > roomH) {
        h = roomH
        w = h * ratio
      }
      if (handle.includes('w')) left = right - w
      else right = left + w
      if (handle.includes('n')) top = bottom - h
      else bottom = top + h
    }
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
    // Capture routes the pointer to the frame, so the frame carries the grabbed element's cursor for the whole drag.
    const cursor = getComputedStyle(target).cursor
    frame.style.cursor = cursor === 'grab' || cursor === 'pointer' ? 'grabbing' : cursor
    event.preventDefault()
  })

  frame.addEventListener('pointermove', (event) => {
    const currentPointer = pointer
    if (!currentPointer) return
    const { x, y } = localFrac(event)
    if (currentPointer.kind === 'move') {
      const slot = layout().slots.find((item) => item.id === currentPointer.id)
      if (!slot) return
      const snapped = snapMove(
        { x: currentPointer.originX + (x - currentPointer.startX), y: currentPointer.originY + (y - currentPointer.startY), w: slot.w, h: slot.h },
        event,
      )
      slot.x = clamp01(Math.min(snapped.x, 1 - slot.w))
      slot.y = clamp01(Math.min(snapped.y, 1 - slot.h))
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
      const size = stickerSizeFractions(sticker)
      const snapped = snapMove(
        { x: currentPointer.originX + (x - currentPointer.startX), y: currentPointer.originY + (y - currentPointer.startY), w: size.width, h: size.height },
        event,
      )
      sticker.x = snapped.x
      sticker.y = snapped.y
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
      const snapped = snapMove(
        { x: currentPointer.originX + (x - currentPointer.startX), y: currentPointer.originY + (y - currentPointer.startY), w: text.w, h: 0 },
        event,
      )
      text.x = clamp01(Math.min(snapped.x, 1 - text.w))
      text.y = clamp01(snapped.y)
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
      rubber.dataset.size = sizeLabel(Math.abs(x - currentPointer.startX), Math.abs(y - currentPointer.startY))
    }
  })

  function endPointer(): void {
    hideGuides()
    frame.style.cursor = mode === 'draw' ? 'crosshair' : 'default'
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

  // Drag a movable row to reorder the paint order (pointer-based so touch works); a plain click still selects.
  // The dragged row rides with the pointer and the other rows slide out of its way, like Figma's layer list.
  let layerDrag: { id: string; startY: number; active: boolean; row: HTMLElement; others: HTMLElement[]; mids: number[]; from: number; to: number } | null = null
  let layerDragged = false
  function movableRows(): HTMLElement[] {
    return [...list.querySelectorAll<HTMLElement>('[data-layer].is-movable')]
  }
  function paintLayerDrag(drag: NonNullable<typeof layerDrag>): void {
    const step = drag.row.offsetHeight + 1 // rows are 1px apart
    drag.others.forEach((row, i) => {
      // `i` indexes the list without the dragged row; rows between the hole and the drop slot slide toward the hole
      const shift = i >= drag.from && i < drag.to ? -step : i < drag.from && i >= drag.to ? step : 0
      row.style.transform = shift ? `translateY(${shift}px)` : ''
    })
  }
  list.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement
    const row = target.closest<HTMLElement>('[data-layer].is-movable')
    if (event.button !== 0 || !row?.dataset.layer || target.closest('button')) return
    const rows = movableRows()
    const from = rows.indexOf(row)
    const others = rows.filter((item) => item !== row)
    layerDrag = {
      id: row.dataset.layer,
      startY: event.clientY,
      active: false,
      row,
      others,
      // untransformed midpoints, measured once so the sliding rows do not move their own targets
      mids: others.map((item) => {
        const box = item.getBoundingClientRect()
        return box.top + box.height / 2
      }),
      from,
      to: from,
    }
    list.setPointerCapture(event.pointerId)
    // no text selection while dragging
    event.preventDefault()
  })
  list.addEventListener('pointermove', (event) => {
    if (!layerDrag) return
    if (!layerDrag.active) {
      if (Math.abs(event.clientY - layerDrag.startY) < 4) return
      layerDrag.active = true
      layerDrag.row.classList.add('is-dragging')
      list.classList.add('is-reordering')
    }
    layerDrag.row.style.transform = `translateY(${event.clientY - layerDrag.startY}px)`
    // drop slot = how many other rows sit above the pointer
    layerDrag.to = layerDrag.mids.filter((mid) => mid < event.clientY).length
    paintLayerDrag(layerDrag)
  })
  function endLayerDrag(): void {
    if (!layerDrag) return
    const drag = layerDrag
    layerDrag = null
    drag.row.style.transform = ''
    drag.row.classList.remove('is-dragging')
    list.classList.remove('is-reordering')
    drag.others.forEach((row) => (row.style.transform = ''))
    if (!drag.active) return
    layerDragged = true
    if (drag.to === drag.from) return
    const order = drag.others.map((row) => row.dataset.layer!)
    order.splice(drag.to, 0, drag.id)
    layout().layers = order.reverse()
    commit()
    renderSlots()
  }
  list.addEventListener('pointerup', endLayerDrag)
  list.addEventListener('pointercancel', endLayerDrag)

  list.addEventListener('click', (event) => {
    if (layerDragged) {
      layerDragged = false
      return
    }
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

  // Grid and safe-area overlays are view helpers only: session state, never part of the draft or the pack.
  root.querySelectorAll<HTMLButtonElement>('[data-helper]').forEach((button) => {
    button.addEventListener('click', () => {
      const on = button.classList.toggle('is-active')
      button.setAttribute('aria-pressed', String(on))
      frame.classList.toggle(`show-${button.dataset.helper}`, on)
    })
  })

  // Preview is view state only: the canvas paints like the app (placeholder photos, no handles) and ignores the pointer.
  const previewButton = $('[data-preview]', root) as HTMLButtonElement
  previewButton.addEventListener('click', () => {
    const on = !frame.classList.contains('is-preview')
    frame.classList.toggle('is-preview', on)
    $('.canvas', root).classList.toggle('is-preview', on)
    previewButton.classList.toggle('is-active', on)
    previewButton.setAttribute('aria-pressed', String(on))
    if (on) {
      selection = null
      renderSlots()
      setStatus('preview · placeholder photos stand in for the day\'s pictures · click ▶ again to edit')
      toast('info', 'preview mode · click ▶ again to edit')
    } else {
      setStatus('back to editing')
      toast('info', 'edit mode')
    }
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
      paintAspect()
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
    if (!slot || !(event.target instanceof HTMLInputElement) || event.target === lockRatio) return
    if (!event.target.matches('[data-slot-photo]')) return
    slot.photo = Math.max(0, Math.floor(Number(event.target.value) - 1))
    commit()
    renderSlots()
  })

  // Sizes commit on `change` (blur / Enter), not `input`: re-rendering mid-typing would clamp "1" to the 14dp minimum under the cursor.
  inspector.addEventListener('change', (event) => {
    const slot = selected()
    const field = event.target
    if (!slot || !(field instanceof HTMLInputElement)) return
    const value = Number(field.value)
    if (field.matches('[data-slot-x], [data-slot-y], [data-slot-rotation], [data-slot-corner]')) {
      if (Number.isFinite(value)) {
        // Typed positions keep the box inside the canvas, like a drag would.
        if (field.matches('[data-slot-x]')) slot.x = clamp(value / FRAME_WIDTH_DP, 0, 1 - slot.w)
        else if (field.matches('[data-slot-y]')) slot.y = clamp(value / ASPECT_HEIGHT_DP[aspect], 0, 1 - slot.h)
        else if (field.matches('[data-slot-rotation]')) slot.rotation = Math.round(clamp(value, -MAX_TILT, MAX_TILT))
        else slot.cornerDp = Math.round(clamp(value, 0, MAX_CORNER))
        commit()
      }
      renderSlots()
      return
    }
    if (!field.matches('[data-slot-w], [data-slot-h]')) return
    const isW = field.matches('[data-slot-w]')
    const dp = value
    if (Number.isFinite(dp) && dp > 0) {
      // Typed sizes resize from the top-left corner, clamped to the canvas; the lock keeps the other side in ratio.
      const ratio = slot.w / slot.h
      if (isW) slot.w = clamp(dp / FRAME_WIDTH_DP, 0.04, 1 - slot.x)
      else slot.h = clamp(dp / ASPECT_HEIGHT_DP[aspect], 0.04, 1 - slot.y)
      if (lockRatio.checked) {
        if (isW) slot.h = clamp(slot.w / ratio, 0.04, 1 - slot.y)
        else slot.w = clamp(slot.h * ratio, 0.04, 1 - slot.x)
      }
      commit()
    }
    renderSlots()
  })

  stickerInspector.addEventListener('change', (event) => {
    const which = selectedSticker()
    const sticker = which && layout()[which]
    const field = event.target
    if (!sticker || !(field instanceof HTMLInputElement)) return
    const value = Number(field.value)
    if (Number.isFinite(value)) {
      if (field.matches('[data-sticker-x]')) sticker.x = clamp01(value / FRAME_WIDTH_DP)
      else if (field.matches('[data-sticker-y]')) sticker.y = clamp01(value / ASPECT_HEIGHT_DP[aspect])
      else if (field.matches('[data-sticker-size]')) {
        sticker.sizeDp = Math.round(clamp(value, MIN_STICKER_SIZE_DP, MAX_STICKER_SIZE_DP))
      } else if (field.matches('[data-sticker-rotation]')) sticker.rotation = Math.round(clamp(value, -MAX_TILT, MAX_TILT))
      else return
      clampStickerPosition(sticker)
      commit()
    }
    renderSlots()
  })

  textInspector.addEventListener('change', (event) => {
    const text = selectedText()
    const field = event.target
    if (!text || !(field instanceof HTMLInputElement) || !field.matches('[data-text-x], [data-text-y], [data-text-w], [data-text-rotation]')) return
    const value = Number(field.value)
    if (Number.isFinite(value)) {
      if (field.matches('[data-text-x]')) text.x = clamp(value / FRAME_WIDTH_DP, 0, 1 - text.w)
      else if (field.matches('[data-text-y]')) text.y = clamp01(value / ASPECT_HEIGHT_DP[aspect])
      else if (field.matches('[data-text-w]')) text.w = clamp(value / FRAME_WIDTH_DP, MIN_TEXT_W, 1 - text.x)
      else text.rotation = Math.round(clamp(value, -MAX_TILT, MAX_TILT))
      commit()
    }
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
      if (key === 'd') {
        event.preventDefault()
        duplicateSelected()
        return
      }
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    if (typing) return
    if (!root.contains(active) && selection == null) return
    if (selection == null) return
    event.preventDefault()
    removeSelection()
  })

  // Right-click on the canvas: select what is under the cursor and open the context menu there.
  frame.addEventListener('contextmenu', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || mode === 'draw') return
    event.preventDefault()
    const slotEl = target.closest<HTMLElement>('[data-slot-id]')
    const stickerEl = target.closest<HTMLElement>('[data-sticker]')
    const textEl = target.closest<HTMLElement>('[data-text-id]')
    selection =
      slotEl?.dataset.slotId ?? stickerEl?.dataset.sticker ?? textEl?.dataset.textId ?? (overlays[aspect] ? 'overlay' : null)
    if (selection == null) return
    renderSlots()
    openContextMenu(event)
  })
  // Same menu from a layer row: right-click selects the row, then offers duplicate / reorder / delete for it.
  list.addEventListener('contextmenu', (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-layer]')
    if (!row?.dataset.layer) return
    event.preventDefault()
    selection = row.dataset.layer
    renderSlots()
    openContextMenu(event)
  })
  function openContextMenu(event: MouseEvent): void {
    if (selection == null) return
    const inLayers = layout().layers.includes(selection)
    $('[data-ctx-action="duplicate"]', ctx).hidden = selected() == null
    $('[data-ctx-action="up"]', ctx).hidden = !inLayers
    $('[data-ctx-action="down"]', ctx).hidden = !inLayers
    ctx.hidden = false
    // Keep the menu on screen near the cursor.
    const { width, height } = ctx.getBoundingClientRect()
    ctx.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`
    ctx.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`
  }
  ctx.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-ctx-action]')
    ctx.hidden = true
    if (!button || selection == null) return
    const action = button.dataset.ctxAction
    if (action === 'duplicate') duplicateSelected()
    else if (action === 'up') moveLayer(selection, 1)
    else if (action === 'down') moveLayer(selection, -1)
    else if (action === 'delete') removeSelection()
  })
  document.addEventListener('pointerdown', (event) => {
    if (!ctx.hidden && !ctx.contains(event.target as Node)) ctx.hidden = true
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') ctx.hidden = true
  })

  undoButton.addEventListener('click', undo)
  redoButton.addEventListener('click', redo)

  $('[data-export]', root).addEventListener('click', () => {
    void exportPack()
  })

  root.querySelectorAll('input[name]').forEach((field) => {
    field.addEventListener('input', () => field.classList.remove('is-invalid'))
  })
  input('[name="nameEn"]', root).addEventListener('input', () => {
    syncId()
  })
  root.querySelectorAll('input[name], select[name]').forEach((field) => {
    field.addEventListener('input', scheduleSave)
  })
  selectEl('[name="schemaVersion"]', root).addEventListener('input', syncSchemaHint)
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
    selectEl('[name="schemaVersion"]', root).value = String(SCHEMA_VERSION)
    syncSchemaHint()
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
    selectEl('[name="schemaVersion"]', root).value = String(draft.schemaVersion ?? SCHEMA_VERSION)
    syncSchemaHint()
    layouts.story = draft.layouts.story
    layouts.post = draft.layouts.post
    overlays.story = draft.overlays.story
    overlays.post = draft.overlays.post
    backgrounds.story = draft.backgrounds?.story ?? null
    backgrounds.post = draft.backgrounds?.post ?? null
    iconFile = draft.icon
    syncId()
    aspect = draft.aspect === 'post' ? 'post' : 'story'
    paintAspect()
    selection = null
    resetHistory()
    renderOverlay()
    renderSlots()
    savedLabel.textContent = `saved ${new Date(draft.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
    const emptyAspect = ASPECTS.find((which) => layouts[which].slots.length === 0)
    if (emptyAspect) {
      toast('error', `draw at least one photo slot on the ${emptyAspect} canvas`)
      return
    }
    // ponytail: overlays are optional from v4 on; v2 / v3 readers still require both files.
    if (schemaVersion() < SCHEMA_VERSION && (!overlays.story || !overlays.post)) {
      toast('error', `schema v${schemaVersion()} needs both a story overlay and a post overlay`)
      return
    }
    const storyExt = overlays.story ? imageExt(overlays.story) : null
    const postExt = overlays.post ? imageExt(overlays.post) : null
    const iconExt = iconFile ? imageExt(iconFile) : 'png'
    if ((overlays.story && !storyExt) || (overlays.post && !postExt) || !iconExt) {
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
      const storyOverlay = storyExt ? `story.${storyExt}` : undefined
      const postOverlay = postExt ? `post.${postExt}` : undefined
      const iconName = `icon.${iconExt}`
      const storyBg = background('story')
      const postBg = background('post')
      const manifest = buildManifest({
        id,
        names: { en, vi },
        premium: input('[name="premium"]', root).checked,
        schemaVersion: schemaVersion(),
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
        { path: `frames/${id}/${iconName}`, data: iconFile ? await fileBytes(iconFile) : await fallbackIcon() },
      ]
      if (storyOverlay && overlays.story) files.push({ path: `frames/${id}/${storyOverlay}`, data: await fileBytes(overlays.story) })
      if (postOverlay && overlays.post) files.push({ path: `frames/${id}/${postOverlay}`, data: await fileBytes(overlays.post) })
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
  syncSchemaHint()
  renderOverlay()
  renderSlots()
  resetHistory()
  setStatus('switch to draw slot to punch a photo hole — an overlay is optional')
  void restoreDraft()
}
