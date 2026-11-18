import type { EpubFile } from './types'
import { displayTitle } from './model'
import type { BinderNode, Doc, Project } from './types'

export const PRINT_PRESETS = {
  '5x8': {
    id: '5x8',
    label: '5 × 8',
    detail: 'Small paperback',
    widthIn: 5,
    heightIn: 8,
    marginTopIn: 0.62,
    marginRightIn: 0.58,
    marginBottomIn: 0.7,
    marginLeftIn: 0.72,
    fontPt: 11,
  },
  '6x9': {
    id: '6x9',
    label: '6 × 9',
    detail: 'Trade paperback',
    widthIn: 6,
    heightIn: 9,
    marginTopIn: 0.72,
    marginRightIn: 0.64,
    marginBottomIn: 0.78,
    marginLeftIn: 0.84,
    fontPt: 11.5,
  },
  letter: {
    id: 'letter',
    label: 'US Letter',
    detail: '8.5 × 11',
    widthIn: 8.5,
    heightIn: 11,
    marginTopIn: 1,
    marginRightIn: 1,
    marginBottomIn: 1,
    marginLeftIn: 1.15,
    fontPt: 12,
  },
} as const

export type PrintPresetId = keyof typeof PRINT_PRESETS

export interface ScenePiece {
  title: string
  body: string
}

export interface PartPiece {
  type: 'part'
  title: string
  body: string
}

export interface ChapterPiece {
  type: 'chapter'
  title: string
  body: string
  scenes: ScenePiece[]
}

export type Piece = PartPiece | ChapterPiece

export function presetMicrons(id: PrintPresetId): { width: number; height: number } {
  const preset = PRINT_PRESETS[id]
  return {
    width: Math.round(preset.widthIn * 25400),
    height: Math.round(preset.heightIn * 25400),
  }
}

function bookTitle(project: Project): string {
  return displayTitle(project.title || 'Untitled Novel')
}

function pieceTitle(docs: Record<string, Doc>, node: BinderNode): string {
  return displayTitle(docs[node.id]?.title ?? node.title)
}

function chapterPiece(chapter: BinderNode, docs: Record<string, Doc>, included: Set<string>): ChapterPiece | null {
  const scenes = (chapter.children ?? [])
    .filter((node) => node.kind === 'scene' && included.has(node.id))
    .map((node) => ({
      title: pieceTitle(docs, node),
      body: docs[node.id]?.body ?? '',
    }))
  const self = included.has(chapter.id)
  if (!self && scenes.length === 0) return null
  return {
    type: 'chapter',
    title: pieceTitle(docs, chapter),
    body: self ? (docs[chapter.id]?.body ?? '') : '',
    scenes,
  }
}

export function collectPieces(project: Project, docs: Record<string, Doc>, included: Set<string>): Piece[] {
  const manuscript = project.binder.find((node) => node.kind === 'manuscript')
  if (!manuscript) return []
  const pieces: Piece[] = []
  for (const child of manuscript.children ?? []) {
    if (child.kind === 'part') {
      if (included.has(child.id)) {
        pieces.push({
          type: 'part',
          title: pieceTitle(docs, child),
          body: docs[child.id]?.body ?? '',
        })
      }
      for (const chapter of child.children ?? []) {
        if (chapter.kind !== 'chapter') continue
        const piece = chapterPiece(chapter, docs, included)
        if (piece) pieces.push(piece)
      }
    } else if (child.kind === 'chapter') {
      const piece = chapterPiece(child, docs, included)
      if (piece) pieces.push(piece)
    }
  }
  return pieces
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || 'Untitled'
}

export function compileMarkdown(project: Project, docs: Record<string, Doc>, included: Set<string>): string {
  const lines: string[] = [`# ${oneLine(bookTitle(project))}`, '']
  const author = project.author.trim()
  if (author) lines.push(author, '')
  for (const piece of collectPieces(project, docs, included)) {
    lines.push('---', '')
    if (piece.type === 'part') {
      lines.push(`# ${oneLine(piece.title)}`, '')
      if (piece.body.trim()) lines.push(piece.body.trim(), '')
    } else {
      lines.push(`## ${oneLine(piece.title)}`, '')
      if (piece.body.trim()) lines.push(piece.body.trim(), '')
      for (const scene of piece.scenes) {
        lines.push(`### ${oneLine(scene.title)}`, '')
        if (scene.body.trim()) lines.push(scene.body.trim(), '')
      }
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function inline(text: string): string {
  let value = escapeXml(text)
  value = value.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  value = value.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  return value
}

export function proseToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''
  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n')
      if (lines.length === 1) {
        const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0] ?? '')
        if (heading) {
          const level = Math.min(6, (heading[1]?.length ?? 1) + 3)
          return `<h${level}>${inline(heading[2] ?? '')}</h${level}>`
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test((lines[0] ?? '').trim())) return '<hr />'
      }
      if (lines.every((line) => /^\s*[-*]\s+\S/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
          .join('')
        return `<ul>${items}</ul>`
      }
      return `<p>${lines.map((line) => inline(line)).join('<br />')}</p>`
    })
    .join('\n')
}

function printCss(presetId: PrintPresetId): string {
  const preset = PRINT_PRESETS[presetId]
  const titlePad = Math.max(1.15, preset.heightIn * 0.28).toFixed(2)
  return `
    @page {
      size: ${preset.widthIn}in ${preset.heightIn}in;
      margin: ${preset.marginTopIn}in ${preset.marginRightIn}in ${preset.marginBottomIn}in ${preset.marginLeftIn}in;
      @bottom-center {
        content: counter(page);
        font-family: Palatino, "Palatino Linotype", Georgia, serif;
        font-size: 9pt;
        color: #444;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
      font-size: ${preset.fontPt}pt;
      line-height: 1.45;
      color: #1a1612;
      background: white;
    }
    .title-page { text-align: center; padding-top: ${titlePad}in; }
    .title-page h1 {
      font-weight: normal;
      font-size: 1.8em;
      line-height: 1.15;
      margin: 0 0 0.8em;
    }
    .byline { font-style: italic; margin: 0; }
    .part, .chapter { break-before: page; page-break-before: always; }
    h2 {
      font-weight: normal;
      text-align: center;
      font-size: 1.45em;
      line-height: 1.2;
      margin: 0 0 1.2em;
      page-break-after: avoid;
      break-after: avoid;
    }
    .part h2 { margin-top: 28%; font-size: 1.7em; }
    .scene-title {
      text-align: center;
      font-style: italic;
      font-weight: normal;
      font-size: 1em;
      margin: 1.5em 0 0.8em;
      page-break-after: avoid;
      break-after: avoid;
    }
    p { text-indent: 1.15em; margin: 0; orphans: 2; widows: 2; }
    h2 + p, h3 + p, h4 + p, .scene-title + p, hr + p { text-indent: 0; }
    h4, h5, h6 { font-weight: normal; font-style: italic; text-align: center; page-break-after: avoid; }
    ul { margin: 0.6em 0 0.6em 1.2em; padding: 0; }
    li { margin: 0.15em 0; }
    hr { border: 0; border-top: 1px solid #1a1612; width: 28%; margin: 1.4em auto; }
    @media screen {
      body { background: #f3eee4; }
      article {
        background: white;
        max-width: 42rem;
        margin: 2rem auto;
        padding: 8vh 8vw 12vh;
        box-shadow: 0 16px 50px rgba(40, 30, 15, 0.08);
      }
      .part, .chapter { break-before: auto; page-break-before: auto; margin-top: 3.5rem; }
    }
  `
}

function renderPieces(pieces: Piece[]): string {
  return pieces
    .map((piece) => {
      if (piece.type === 'part') {
        const body = proseToHtml(piece.body)
        return `<section class="part"><h2>${escapeXml(oneLine(piece.title))}</h2>${body}</section>`
      }
      const body = proseToHtml(piece.body)
      const scenes = piece.scenes
        .map((scene, index) => {
          const prose = proseToHtml(scene.body)
          return `<section class="scene" id="s-${index + 1}"><h3 class="scene-title">${escapeXml(oneLine(scene.title))}</h3>${prose}</section>`
        })
        .join('\n')
      return `<section class="chapter"><h2>${escapeXml(oneLine(piece.title))}</h2>${body}${scenes}</section>`
    })
    .join('\n')
}

function titlePage(project: Project): string {
  const author = project.author.trim()
  const byline = author ? `<p class="byline">${escapeXml(author)}</p>` : ''
  return `<section class="title-page"><h1>${escapeXml(bookTitle(project))}</h1>${byline}</section>`
}

export function compileHtml(project: Project, docs: Record<string, Doc>, included: Set<string>, presetId: PrintPresetId): string {
  const pieces = collectPieces(project, docs, included)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="generator" content="Gather" />
  <title>${escapeXml(bookTitle(project))}</title>
  <style>${printCss(presetId)}</style>
</head>
<body>
  <article>
    ${titlePage(project)}
    ${renderPieces(pieces)}
  </article>
</body>
</html>
`
}

const EPUB_CSS = `
body { font-family: Georgia, Palatino, "Palatino Linotype", serif; line-height: 1.5; margin: 0; }
h1, h2 { font-weight: normal; text-align: center; line-height: 1.2; }
.title-page { text-align: center; margin-top: 20%; }
.byline { font-style: italic; }
.part, .chapter { page-break-before: always; break-before: page; }
.scene-title { text-align: center; font-style: italic; font-weight: normal; font-size: 1em; margin: 1.4em 0 0.8em; page-break-after: avoid; }
p { text-indent: 1.15em; margin: 0.15em 0; }
h2 + p, h3 + p, .scene-title + p { text-indent: 0; }
ul { margin: 0.6em 0 0.6em 1.2em; padding: 0; }
nav ol { font-family: Georgia, Palatino, serif; }
`.trim()

function xhtml(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`
}

function utcStamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function compileEpubFiles(project: Project, docs: Record<string, Doc>, included: Set<string>): EpubFile[] {
  const pieces = collectPieces(project, docs, included)
  const files: EpubFile[] = []
  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
  ]
  const spine = ['<itemref idref="title"/>', '<itemref idref="nav"/>']
  const toc: string[] = [`<li><a href="title.xhtml">${escapeXml(bookTitle(project))}</a></li>`]
  let partCount = 0
  let chapterCount = 0
  let pendingPart: { href: string; title: string; chapters: string[] } | null = null

  const flushPart = (): void => {
    if (!pendingPart) return
    const nested = pendingPart.chapters.length ? `<ol>${pendingPart.chapters.join('')}</ol>` : ''
    toc.push(`<li><a href="${pendingPart.href}">${escapeXml(pendingPart.title)}</a>${nested}</li>`)
    pendingPart = null
  }

  files.push({
    path: 'OEBPS/title.xhtml',
    text: xhtml(bookTitle(project), titlePage(project)),
  })

  for (const piece of pieces) {
    if (piece.type === 'part') {
      flushPart()
      partCount += 1
      const href = `p-${String(partCount).padStart(3, '0')}.xhtml`
      const body = proseToHtml(piece.body)
      files.push({
        path: `OEBPS/${href}`,
        text: xhtml(piece.title, `<section class="part" epub:type="part"><h2>${escapeXml(oneLine(piece.title))}</h2>${body}</section>`),
      })
      manifest.push(
        `<item id="p${partCount}" href="${href}" media-type="application/xhtml+xml"/>`,
      )
      spine.push(`<itemref idref="p${partCount}"/>`)
      pendingPart = { href, title: oneLine(piece.title), chapters: [] }
      continue
    }
    chapterCount += 1
    const href = `c-${String(chapterCount).padStart(3, '0')}.xhtml`
    const body = proseToHtml(piece.body)
    const scenes = piece.scenes
      .map((scene, index) => {
        return `<section class="scene" id="s-${index + 1}"><h3 class="scene-title">${escapeXml(oneLine(scene.title))}</h3>${proseToHtml(scene.body)}</section>`
      })
      .join('\n')
    files.push({
      path: `OEBPS/${href}`,
      text: xhtml(
        piece.title,
        `<section class="chapter" epub:type="chapter"><h2>${escapeXml(oneLine(piece.title))}</h2>${body}${scenes}</section>`,
      ),
    })
    manifest.push(`<item id="c${chapterCount}" href="${href}" media-type="application/xhtml+xml"/>`)
    spine.push(`<itemref idref="c${chapterCount}"/>`)
    const sceneLinks = piece.scenes
      .map(
        (scene, index) =>
          `<li><a href="${href}#s-${index + 1}">${escapeXml(oneLine(scene.title))}</a></li>`,
      )
      .join('')
    const sceneList = sceneLinks ? `<ol>${sceneLinks}</ol>` : ''
    const chapterItem = `<li><a href="${href}">${escapeXml(oneLine(piece.title))}</a>${sceneList}</li>`
    if (pendingPart) pendingPart.chapters.push(chapterItem)
    else toc.push(chapterItem)
  }
  flushPart()

  const nav = xhtml(
    'Contents',
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${toc.join('')}</ol></nav>`,
  )
  files.push({ path: 'OEBPS/nav.xhtml', text: nav })
  files.push({ path: 'OEBPS/style.css', text: EPUB_CSS })

  const author = project.author.trim()
  const creator = author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : ''
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(bookTitle(project))}</dc:title>
    ${creator}
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${utcStamp()}</meta>
  </metadata>
  <manifest>
    ${manifest.join('\n    ')}
  </manifest>
  <spine>
    ${spine.join('\n    ')}
  </spine>
</package>
`
  files.push({ path: 'OEBPS/content.opf', text: opf })
  files.push({
    path: 'META-INF/container.xml',
    text: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  })
  return files
}
