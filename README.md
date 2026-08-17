# loggoo — marketing site

Astro static site for **loggoo** (snap & frame your day) by KomKat Studio.

## run

\`\`\`bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview
\`\`\`

Deploy \`dist/\` to any static host (Vercel, Netlify, Cloudflare Pages — no adapter needed).

## structure

- \`src/data/site.ts\` — single source of truth: store URLs, contact email, studio name, legal dates. **Edit this first.**
- \`src/styles/global.css\` — design tokens (\`--lg-*\`) lifted from the Loggoo design system, plus layout primitives.
- \`src/layouts/Base.astro\` — html shell, meta/OG tags, nav + footer.
- \`src/layouts/Legal.astro\` — shell for prose pages (terms, privacy).
- \`src/components/\` — one component per landing section.
- \`src/pages/index.astro\` · \`terms.astro\` · \`privacy.astro\`
- \`public/screens/\` — real app screenshots (transparent PNG, device bezel included).

## before launch

1. Replace the placeholder App Store / Google Play URLs in \`src/data/site.ts\`.
2. Testimonials in \`src/components/Testimonials.astro\` are placeholders — swap in real reviews or delete the component from \`index.astro\`.
3. Confirm the governing-law jurisdiction in \`terms.astro\` section 12 with a lawyer, and the analytics provider named in \`privacy.astro\` section 7.
4. Add \`public/og.png\` (1200×630) — referenced by Base.astro.

## type + color

Quicksand 700 for every heading, number and button. Nunito for body and the italic journal voice. All UI copy lowercase. Cream surfaces, cocoa ink, one peach accent; mood hues are the only saturated colors and are never used for chrome.
