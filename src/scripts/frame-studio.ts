import {
  IMAGE_ACCEPT,
  type Aspect,
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

type Handle = 'nw' | 'ne' | 'sw' | 'se'

type DraftSlot = Slot & { id: string }
type DraftText = TextBind & { id: string }
type Layout = { slots: DraftSlot[]; texts: DraftText[]; mood?: MoodPlacement }

type PointerMode =
  | { kind: 'move'; id: string; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'resize'; id: string; handle: Handle; startX: number; startY: number; origin: Slot }
  | { kind: 'rotate'; id: string; origin: number; startAngle: number }
  | { kind: 'radius'; id: string }
  | { kind: 'mood-move'; startX: number; startY: number; originX: number; originY: number }
  | { kind: 'mood-resize' }
  | { kind: 'mood-rotate'; origin: number; startAngle: number }
  | { kind: 'draw'; startX: number; startY: number }

const RESIZE = new Set<string>(['nw', 'ne', 'sw', 'se'])
const MAX_TILT = 45
const MAX_CORNER = 24
const FRAME_WIDTH_DP = 360
const ASPECT_HEIGHT_DP: Record<Aspect, number> = { story: 640, post: 450 }
const MIN_MOOD_SIZE_DP = 16
const MAX_MOOD_SIZE_DP = 180

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

export function mountStudio(root: HTMLElement): void {
  const frame = $('[data-frame]', root)
  const overlayImg = $('[data-overlay]', root) as HTMLImageElement
  const slotLayer = $('[data-slots]', root)
  const moodLayer = $('[data-mood-layer]', root)
  const rubber = $('[data-rubber]', root)
  const list = $('[data-slot-list]', root)
  const inspector = $('[data-inspector]', root)
  const snippet = $('[data-snippet]', root) as HTMLTextAreaElement
  const status = $('[data-status]', root)
  const toasts = $('[data-toasts]')
  const idLabel = $('[data-id]', root)
  const addMoodButton = $('[data-add-mood]', root) as HTMLButtonElement
  const deleteMoodButton = $('[data-delete-mood]', root) as HTMLButtonElement
  const moodStatus = $('[data-mood-status]', root)

  const overlays: Record<Aspect, File | null> = { story: null, post: null }
  const overlayUrl: Record<Aspect, string | null> = { story: null, post: null }
  const layouts: Record<Aspect, Layout> = {
    story: { slots: [], texts: [] },
    post: { slots: [], texts: [] },
  }

  let aspect: Aspect = 'story'
  let selectedId: string | null = null
  let moodSelected = false
  let pointer: PointerMode | null = null
  let iconFile: File | null = null

  function layout(): Layout {
    return layouts[aspect]
  }

  function selected(): DraftSlot | undefined {
    return layout().slots.find((slot) => slot.id === selectedId)
  }

  function moodSizeFractions(mood: MoodPlacement): { width: number; height: number } {
    return {
      width: mood.sizeDp / FRAME_WIDTH_DP,
      height: mood.sizeDp / ASPECT_HEIGHT_DP[aspect],
    }
  }

  function clampMoodPosition(mood: MoodPlacement): void {
    const size = moodSizeFractions(mood)
    mood.x = clamp01(Math.min(mood.x, 1 - size.width))
    mood.y = clamp01(Math.min(mood.y, 1 - size.height))
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

  function moodCenterPx(mood: MoodPlacement): { x: number; y: number } {
    const box = frame.getBoundingClientRect()
    const size = moodSizeFractions(mood)
    return {
      x: box.left + (mood.x + size.width / 2) * box.width,
      y: box.top + (mood.y + size.height / 2) * box.height,
    }
  }

  function moodPointerAngle(event: PointerEvent, mood: MoodPlacement): number {
    const center = moodCenterPx(mood)
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
    el.classList.toggle('is-selected', slot.id === selectedId)
    el.style.left = `${slot.x * 100}%`
    el.style.top = `${slot.y * 100}%`
    el.style.width = `${slot.w * 100}%`
    el.style.height = `${slot.h * 100}%`
    el.style.transform = `rotate(${slot.rotation}deg)`
    el.style.setProperty('--fill', FILLS[slot.photo % FILLS.length])
    el.style.setProperty('--corner', `${slot.cornerDp}`)
    const label = el.querySelector('.slot__label')
    const meta = el.querySelector('.slot__meta')
    if (label) label.textContent = `photo ${slot.photo + 1}`
    if (meta) meta.textContent = `${Math.round(slot.rotation)}° · r${Math.round(slot.cornerDp)}`
  }

  function applyMoodBox(el: HTMLElement, mood: MoodPlacement): void {
    el.classList.toggle('is-selected', moodSelected)
    el.style.left = `${mood.x * 100}%`
    el.style.top = `${mood.y * 100}%`
    el.style.width = `${(mood.sizeDp / FRAME_WIDTH_DP) * 100}%`
    el.style.transform = `rotate(${mood.rotation}deg)`
    const meta = el.querySelector('.mood-face__meta')
    if (meta) meta.textContent = `${Math.round(mood.rotation)}° · ${Math.round(mood.sizeDp)}dp`
  }

  function paintDragging(): void {
    const currentPointer = pointer
    if (!currentPointer || currentPointer.kind === 'draw') return
    if (
      currentPointer.kind === 'mood-move' ||
      currentPointer.kind === 'mood-resize' ||
      currentPointer.kind === 'mood-rotate'
    ) {
      const mood = layout().mood
      const el = moodLayer.querySelector('[data-mood]')
      if (mood && el instanceof HTMLElement) applyMoodBox(el, mood)
      return
    }
    const slot = layout().slots.find((item) => item.id === currentPointer.id)
    if (!slot) return
    const el = slotLayer.querySelector(`[data-slot-id="${slot.id}"]`)
    if (el instanceof HTMLElement) applySlotBox(el, slot)
  }

  function paintSelection(): void {
    for (const node of slotLayer.children) {
      if (node instanceof HTMLElement) {
        node.classList.toggle('is-selected', node.dataset.slotId === selectedId)
      }
    }
    const mood = moodLayer.querySelector('[data-mood]')
    if (mood instanceof HTMLElement) mood.classList.toggle('is-selected', moodSelected)
  }

  function renderMood(): void {
    moodLayer.replaceChildren()
    const mood = layout().mood
    addMoodButton.hidden = mood != null
    deleteMoodButton.hidden = mood == null
    moodStatus.textContent = mood == null ? 'not used in this aspect' : `${Math.round(mood.sizeDp)}dp mood face`
    if (!mood) return

    const el = document.createElement('div')
    el.className = 'mood-face'
    el.dataset.mood = ''
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', 'mood face placement')
    el.innerHTML = `
      <svg class="mood-face__art" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M13 20c1.6-2.6 4.6-2.6 6.2 0M28.8 20c1.6-2.6 4.6-2.6 6.2 0M15 27c3.2 5.4 14.8 5.4 18 0" />
      </svg>
      <span class="mood-face__meta"></span>
      <span class="mood-face__size" data-mood-handle="resize" aria-label="resize mood face"></span>
      <span class="slot__rotate" data-mood-handle="rotate" aria-label="rotate mood face"></span>
    `
    applyMoodBox(el, mood)
    moodLayer.append(el)
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

    list.replaceChildren()
    if (slots.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'studio__hint'
      empty.textContent = 'no slots yet — drag on the canvas or add one'
      list.append(empty)
    }
    for (const slot of slots) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'slot-row' + (slot.id === selectedId ? ' is-selected' : '')
      row.dataset.slotId = slot.id
      row.innerHTML = `<span>photo ${slot.photo + 1}</span><span>${Math.round(slot.w * 100)}×${Math.round(slot.h * 100)}</span>`
      list.append(row)
    }
    renderInspector()
    renderMood()
  }

  function renderInspector(): void {
    const slot = selected()
    inspector.hidden = slot == null
    if (!slot) return
    input('[data-slot-photo]', inspector).value = String(slot.photo + 1)
  }

  function renderOverlay(): void {
    const url = overlayUrl[aspect]
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
    $('[data-overlay-empty]', root).textContent =
      url != null ? '' : `upload a ${aspect} overlay`
    input('[data-overlay-file]', root).value = ''
  }

  function select(id: string | null): void {
    selectedId = id
    moodSelected = false
    renderSlots()
  }

  function addMood(): void {
    if (layout().mood) return
    layout().mood = defaultMood()
    selectedId = null
    moodSelected = true
    renderSlots()
    setStatus(`${aspect} mood face added — move, resize, or rotate it on the canvas`)
  }

  function removeMood(): void {
    if (!layout().mood) return
    delete layout().mood
    moodSelected = false
    renderSlots()
    setStatus(`${aspect} will not render a mood face`)
  }

  function addSlot(): void {
    const slots = layout().slots
    slots.push(defaultSlot(slots.length))
    selectedId = slots[slots.length - 1].id
    moodSelected = false
    renderSlots()
    setStatus(`slot ${slots.length} added — drag it onto the hole`)
  }

  function removeSelected(): void {
    const slots = layout().slots
    const index = slots.findIndex((slot) => slot.id === selectedId)
    if (index < 0) return
    slots.splice(index, 1)
    slots.forEach((slot, i) => {
      slot.photo = i
    })
    selectedId = slots[index]?.id ?? slots[index - 1]?.id ?? null
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
    const moodHandle = target.dataset.moodHandle
    const moodEl = target.closest('[data-mood]')
    const slotEl = target.closest('[data-slot-id]')
    if (moodEl instanceof HTMLElement) {
      const mood = layout().mood
      if (!mood) return
      selectedId = null
      moodSelected = true
      if (moodHandle === 'rotate') {
        pointer = {
          kind: 'mood-rotate',
          origin: mood.rotation,
          startAngle: moodPointerAngle(event, mood),
        }
      } else if (moodHandle === 'resize') {
        pointer = { kind: 'mood-resize' }
      } else {
        pointer = {
          kind: 'mood-move',
          startX: x,
          startY: y,
          originX: mood.x,
          originY: mood.y,
        }
      }
      paintSelection()
    } else if (handle && slotEl instanceof HTMLElement) {
      const id = slotEl.dataset.slotId
      const slot = layout().slots.find((item) => item.id === id)
      if (!slot || !id) return
      selectedId = id
      moodSelected = false
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
      selectedId = id
      moodSelected = false
      pointer = { kind: 'move', id, startX: x, startY: y, originX: slot.x, originY: slot.y }
      paintSelection()
    } else {
      selectedId = null
      moodSelected = false
      pointer = { kind: 'draw', startX: x, startY: y }
      rubber.hidden = false
      paintSelection()
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
    } else if (currentPointer.kind === 'mood-move') {
      const mood = layout().mood
      if (!mood) return
      mood.x = currentPointer.originX + (x - currentPointer.startX)
      mood.y = currentPointer.originY + (y - currentPointer.startY)
      clampMoodPosition(mood)
      paintDragging()
    } else if (currentPointer.kind === 'mood-resize') {
      const mood = layout().mood
      if (!mood) return
      const sizeFromX = (x - mood.x) * FRAME_WIDTH_DP
      const sizeFromY = (y - mood.y) * ASPECT_HEIGHT_DP[aspect]
      const maximum = Math.min(
        MAX_MOOD_SIZE_DP,
        (1 - mood.x) * FRAME_WIDTH_DP,
        (1 - mood.y) * ASPECT_HEIGHT_DP[aspect],
      )
      mood.sizeDp = Math.round(clamp(Math.max(sizeFromX, sizeFromY), MIN_MOOD_SIZE_DP, maximum))
      clampMoodPosition(mood)
      paintDragging()
    } else if (currentPointer.kind === 'mood-rotate') {
      const mood = layout().mood
      if (!mood) return
      mood.rotation = applyTilt(
        currentPointer.origin + wrapDelta(moodPointerAngle(event, mood) - currentPointer.startAngle),
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
        layout().slots.push(slot)
        selectedId = slot.id
        setStatus(`photo ${slot.photo + 1} drawn`)
      }
      renderSlots()
    } else if (pointer) {
      renderSlots()
    }
    pointer = null
  }

  frame.addEventListener('pointerup', endPointer)
  frame.addEventListener('pointercancel', endPointer)

  list.addEventListener('click', (event) => {
    const row = (event.target as HTMLElement).closest('[data-slot-id]')
    if (row instanceof HTMLElement && row.dataset.slotId) select(row.dataset.slotId)
  })

  $('[data-add-slot]', root).addEventListener('click', addSlot)
  $('[data-delete-slot]', root).addEventListener('click', removeSelected)
  addMoodButton.addEventListener('click', addMood)
  deleteMoodButton.addEventListener('click', removeMood)

  root.querySelectorAll<HTMLButtonElement>('[data-aspect]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.aspect
      if (next !== 'story' && next !== 'post') return
      aspect = next
      root.querySelectorAll('[data-aspect]').forEach((node) => {
        node.classList.toggle('is-active', node === button)
      })
      selectedId = null
      moodSelected = false
      renderOverlay()
      renderSlots()
    })
  })

  input('[data-overlay-file]', root).accept = IMAGE_ACCEPT
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
    const previousUrl = overlayUrl[aspect]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    overlayUrl[aspect] = URL.createObjectURL(file)
    renderOverlay()
    setStatus(`${aspect} overlay loaded — drag slots onto the holes`)
  })

  input('[data-icon-file]', root).addEventListener('change', (event) => {
    const picker = event.target as HTMLInputElement
    const file = picker.files?.[0]
    if (!file) {
      iconFile = null
      return
    }
    if (!imageExt(file)) {
      picker.value = ''
      iconFile = null
      toast('error', 'icon must be png, jpg, or jpeg')
      return
    }
    iconFile = file
  })

  inspector.addEventListener('input', (event) => {
    const slot = selected()
    if (!slot || !(event.target instanceof HTMLInputElement)) return
    if (event.target.matches('[data-slot-photo]')) {
      slot.photo = Math.max(0, Math.floor(Number(event.target.value) - 1))
    }
    renderSlots()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    const active = document.activeElement
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
    if (!root.contains(active) && selectedId == null && !moodSelected) return
    if (selectedId) {
      event.preventDefault()
      removeSelected()
    } else if (moodSelected) {
      event.preventDefault()
      removeMood()
    }
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
  syncId()

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

    const texts = (which: Aspect): TextBind[] =>
      layouts[which].texts.map(({ bind, x, y, font, sizeSp, color }) => ({
        bind,
        x,
        y,
        font,
        sizeSp,
        color,
      }))

    try {
      const storyOverlay = `story.${storyExt}`
      const postOverlay = `post.${postExt}`
      const iconName = `icon.${iconExt}`
      const manifest = buildManifest({
        id,
        names: { en, vi },
        premium: input('[name="premium"]', root).checked,
        story: {
          overlay: storyOverlay,
          slots: layouts.story.slots,
          texts: texts('story'),
          mood: layouts.story.mood,
        },
        post: {
          overlay: postOverlay,
          slots: layouts.post.slots,
          texts: texts('post'),
          mood: layouts.post.mood,
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
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.fillStyle = '#FBE7D6'
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = '#F6B393'
    ctx.fillRect(28, 28, 72, 72)
    return pngFromCanvas(canvas)
  }

  renderOverlay()
  renderSlots()
  setStatus('upload a story overlay, then drag on the canvas to punch a photo hole')
}
