/**
 * Coach-mark tour for the studio: a spotlight over one area at a time with a short card.
 * Runs once on the first visit (localStorage) and again from the `?` button.
 */
/** A step without a target is a centred card over the dimmed page (the welcome). */
type Step = { target?: string; title: string; body: string }

const SEEN_KEY = 'loggoo-studio-tour'
const PAD = 6

const STEPS: Step[] = [
  {
    title: 'welcome to loggoo studio',
    body: 'Design a frame pack the app can render: photo slots, a mood face, the loggoo mark, and a note, on a story and a post page. This quick tour shows where everything lives — about a minute.',
  },
  {
    target: '.topbar__file',
    title: 'name the pack',
    body: 'Type the English name here — the pack id is derived from it (snake_case). Saved drafts show their time next to it.',
  },
  {
    target: '[data-tour-pack]',
    title: 'pack settings',
    body: 'Vietnamese name, loggoo plus, and which app release the pack targets (schema). The optional rail icon is a square 256px png.',
  },
  {
    target: '[data-tour-pages]',
    title: 'two pages',
    body: 'A pack has a story (9:16) and a post (4:5) aspect. Switching to an empty one copies the other page as a starting point.',
  },
  {
    target: '[data-tour-tools]',
    title: 'tools',
    body: 'Select, draw a photo slot by dragging, add a default slot, and add the note text, mood face, or loggoo icon. Add tools disappear once the item exists.',
  },
  {
    target: '[data-frame]',
    title: 'the canvas',
    body: 'Drag to move, corners to resize, the top knob rotates, the inner dot rounds photo corners. Right-click for duplicate / reorder / delete. ⌘Z undoes, ⌘+wheel zooms.',
  },
  {
    target: '.panel--right',
    title: 'design panel',
    body: 'Follows the selection: overlay and background when nothing is picked; X Y W H, rotation, corner, photo index for a slot; typography for the note.',
  },
  {
    target: '[data-tour-layers]',
    title: 'layers',
    body: 'Top row paints on top. Drag rows or use ▲ ▼ to reorder. Note text is pinned above everything, the background below.',
  },
  {
    target: '[data-preview]',
    title: 'preview',
    body: 'Renders the page like the app, with placeholder photos in the slots and no handles. Click again to edit.',
  },
  {
    target: '[data-export]',
    title: 'export',
    body: 'Every page needs at least one photo slot. Export builds a zip — unzip it into loggoo_asset/frames/<id>/ and paste the catalog snippet into catalog.json.',
  },
]

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private mode: the tour simply runs again next time */
  }
}

export function mountTour(root: HTMLElement, tourRoot: HTMLElement): void {
  const spot = tourRoot.querySelector('.tour__spot') as HTMLElement
  const card = tourRoot.querySelector('.tour__card') as HTMLElement
  const title = tourRoot.querySelector('[data-tour-title]') as HTMLElement
  const body = tourRoot.querySelector('[data-tour-body]') as HTMLElement
  const count = tourRoot.querySelector('[data-tour-count]') as HTMLElement
  const back = tourRoot.querySelector('[data-tour-back]') as HTMLButtonElement
  const next = tourRoot.querySelector('[data-tour-next]') as HTMLButtonElement
  let step = -1

  function place(): void {
    const selector = STEPS[step].target
    const target = selector ? root.querySelector(selector) : null
    spot.hidden = target == null
    if (!(target instanceof HTMLElement)) {
      const c = card.getBoundingClientRect()
      card.style.left = `${Math.max(8, (window.innerWidth - c.width) / 2)}px`
      card.style.top = `${Math.max(8, (window.innerHeight - c.height) / 2)}px`
      return
    }
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const r = target.getBoundingClientRect()
    spot.style.left = `${r.left - PAD}px`
    spot.style.top = `${r.top - PAD}px`
    spot.style.width = `${r.width + PAD * 2}px`
    spot.style.height = `${r.height + PAD * 2}px`
    // card: below the target, else above, else beside it (tall targets like the canvas); clamped to the viewport
    const c = card.getBoundingClientRect()
    const gap = 12
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top: number
    let left: number
    if (r.bottom + gap + c.height <= vh - 8) {
      top = r.bottom + gap
      left = r.left
    } else if (r.top - gap - c.height >= 8) {
      top = r.top - gap - c.height
      left = r.left
    } else {
      top = Math.max(8, Math.min(r.top, vh - c.height - 8))
      left = r.right + gap + c.width <= vw - 8 ? r.right + gap : r.left - gap - c.width
    }
    if (r.width > vw * 0.5 && (top === r.bottom + gap || top === r.top - gap - c.height)) left = r.left + r.width / 2 - c.width / 2
    card.style.left = `${Math.max(8, Math.min(left, vw - c.width - 8))}px`
    card.style.top = `${top}px`
  }

  function show(index: number): void {
    step = index
    title.textContent = STEPS[step].title
    body.textContent = STEPS[step].body
    count.textContent = `${step + 1} / ${STEPS.length}`
    back.disabled = step === 0
    next.textContent = step === STEPS.length - 1 ? 'done' : step === 0 ? 'show me' : 'next'
    tourRoot.hidden = false
    place()
    next.focus()
  }

  function stop(): void {
    tourRoot.hidden = true
    step = -1
    markSeen()
  }

  function start(): void {
    show(0)
  }

  next.addEventListener('click', () => (step < STEPS.length - 1 ? show(step + 1) : stop()))
  back.addEventListener('click', () => step > 0 && show(step - 1))
  tourRoot.querySelector('[data-tour-skip]')?.addEventListener('click', stop)
  tourRoot.addEventListener('click', (event) => {
    // clicking the dimmed backdrop (not the card) ends the tour
    if (event.target === tourRoot || event.target === spot) stop()
  })
  document.addEventListener('keydown', (event) => {
    if (tourRoot.hidden) return
    if (event.key === 'Escape') stop()
    else if (event.key === 'ArrowRight' || event.key === 'Enter') next.click()
    else if (event.key === 'ArrowLeft') back.click()
  })
  window.addEventListener('resize', () => !tourRoot.hidden && place())
  root.querySelector('[data-tour]')?.addEventListener('click', start)

  if (!seen()) window.setTimeout(start, 600)
}
