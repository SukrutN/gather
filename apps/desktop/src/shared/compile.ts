import type { PackagedFile } from './types'
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

/** Choices that shape a compiled book. Defaults reproduce classic output. */
export interface CompileOptions {
  /** Print each scene's title above its body. */
  sceneTitles: boolean
  /** Prefix "Chapter n" (and "Part I" with 'parts'). */
  numbering: 'none' | 'chapters' | 'parts'
  /** What separates two scenes within a chapter. */
  separator: 'stars' | 'blank' | 'rule'
  /** Include each scene's synopsis as a quoted block. */
  includeSynopsis: boolean
  /** Add a copyright page after the title page. */
  copyrightPage: boolean
  /** Include the note titled "Dedication" as a dedication page. */
  dedication: boolean
}

export const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
  sceneTitles: false,
  numbering: 'none',
  separator: 'stars',
  includeSynopsis: false,
  copyrightPage: false,
  dedication: false,
}

/** The body of the note titled "Dedication", if the project has one. */
export function dedicationText(project: Project, docs: Record<string, Doc>): string {
  const notes = project.binder.find((node) => node.kind === 'notes')
  for (const note of notes?.children ?? []) {
    if (note.kind === 'note' && note.title.trim().toLowerCase() === 'dedication') {
      return (docs[note.id]?.body ?? '').trim()
    }
  }
  return ''
}

export function copyrightLines(project: Project, year = new Date().getFullYear()): string[] {
  const author = project.author.trim()
  const lines = [bookTitle(project)]
  if (author) lines.push(author)
  lines.push(`Copyright © ${year} ${author || 'the author'}`)
  lines.push('All rights reserved.')
  return lines
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX']

function romanNumber(value: number): string {
  return ROMAN[value - 1] ?? String(value)
}

interface ScenePiece {
  title: string
  body: string
  synopsis: string
}

interface PartPiece {
  type: 'part'
  title: string
  body: string
}

interface ChapterPiece {
  type: 'chapter'
  title: string
  body: string
  scenes: ScenePiece[]
}

export type Piece = PartPiece | ChapterPiece

/** A piece with its position in the book, ready for numbering. */
export interface DecoratedPiece {
  type: 'part' | 'chapter'
  title: string
  body: string
  scenes: Array<{ title: string; body: string; synopsis: string }>
  /** Display title with numbering applied. */
  displayTitle: string
}

export function decoratePieces(pieces: Piece[], options: CompileOptions): DecoratedPiece[] {
  let chapter = 0
  let part = 0
  return pieces.map((piece) => {
    if (piece.type === 'part') {
      part += 1
      const prefix = options.numbering === 'parts' ? `Part ${romanNumber(part)} — ` : ''
      return {
        type: 'part' as const,
        title: piece.title,
        body: piece.body,
        scenes: [],
        displayTitle: `${prefix}${oneLine(piece.title)}`,
      }
    }
    chapter += 1
    const prefix = options.numbering !== 'none' ? `Chapter ${chapter} — ` : ''
    return {
      type: 'chapter' as const,
      title: piece.title,
      body: piece.body,
      scenes: piece.scenes,
      displayTitle: `${prefix}${oneLine(piece.title)}`,
    }
  })
}

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
      synopsis: docs[node.id]?.synopsis ?? '',
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

export function compileMarkdown(
  project: Project,
  docs: Record<string, Doc>,
  included: Set<string>,
  options: CompileOptions = DEFAULT_COMPILE_OPTIONS,
): string {
  const pieces = decoratePieces(collectPieces(project, docs, included), options)
  const lines: string[] = [`# ${oneLine(bookTitle(project))}`, '']
  const author = project.author.trim()
  if (author) lines.push(author, '')
  lines.push('## Contents', '')
  for (const piece of pieces) {
    lines.push(piece.type === 'part' ? `- ${piece.displayTitle}` : `  - ${piece.displayTitle}`)
  }
  lines.push('')
  if (options.copyrightPage) {
    lines.push('---', '', '## Copyright', '')
    for (const line of copyrightLines(project)) lines.push(line, '')
  }
  if (options.dedication) {
    const dedication = dedicationText(project, docs)
    if (dedication) {
      lines.push('---', '', '## Dedication', '')
      lines.push(dedication, '')
    }
  }
  const sceneTitle = (title: string): void => {
    if (options.sceneTitles && title.trim()) lines.push(`### ${oneLine(title)}`, '')
  }
  const synopsis = (text: string): void => {
    if (options.includeSynopsis && text.trim()) lines.push(...text.trim().split('\n').map((line) => `> ${line}`), '')
  }
  const separator = (index: number): void => {
    if (index === 0) return
    if (options.separator === 'stars') lines.push('* * *', '')
    else if (options.separator === 'rule') lines.push('***', '')
  }
  for (const piece of pieces) {
    lines.push('---', '')
    if (piece.type === 'part') {
      lines.push(`# ${piece.displayTitle}`, '')
      if (piece.body.trim()) lines.push(piece.body.trim(), '')
    } else {
      lines.push(`## ${piece.displayTitle}`, '')
      if (piece.body.trim()) lines.push(piece.body.trim(), '')
      piece.scenes.forEach((scene, index) => {
        separator(index)
        sceneTitle(scene.title)
        synopsis(scene.synopsis)
        if (scene.body.trim()) lines.push(scene.body.trim(), '')
      })
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
      @top-center {
        content: string(runhead);
        font-family: Palatino, "Palatino Linotype", Georgia, serif;
        font-size: 9pt;
        font-style: italic;
        color: #444;
      }
      @bottom-center {
        content: counter(page);
        font-family: Palatino, "Palatino Linotype", Georgia, serif;
        font-size: 9pt;
        color: #444;
      }
    }
    @page front {
      @top-center { content: none; }
      @bottom-center { content: none; }
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
    .title-page, .contents, .copyright, .dedication { page: front; text-align: center; }
    .title-page { padding-top: ${titlePad}in; }
    .copyright, .dedication { break-before: page; page-break-before: always; padding-top: 2.8in; }
    .copyright p { text-indent: 0; margin: 0.35em 0; }
    .dedication p { text-indent: 0; font-style: italic; margin: 0.35em 0; }
    .title-page h1 {
      font-weight: normal;
      font-size: 1.8em;
      line-height: 1.15;
      margin: 0 0 0.8em;
    }
    .byline { font-style: italic; margin: 0; }
    .contents { break-before: page; page-break-before: always; text-align: left; }
    .contents h2 { text-align: center; }
    .contents ol { list-style: none; padding: 0; }
    .contents li { margin: 0.35em 0; }
    .contents .part-line { margin-top: 1em; font-variant: small-caps; }
    .part, .chapter { break-before: page; page-break-before: always; }
    h2 {
      font-weight: normal;
      text-align: center;
      font-size: 1.45em;
      line-height: 1.2;
      margin: 0 0 1.4em;
      page-break-after: avoid;
      break-after: avoid;
    }
    .chapter h2 { string-set: runhead content(); margin-top: 1.6em; }
    .part h2 { margin-top: 28%; font-size: 1.7em; }
    .scene-break {
      text-align: center;
      text-indent: 0;
      margin: 1.3em 0;
      letter-spacing: 0.35em;
    }
    .scene-title {
      text-align: center;
      font-weight: normal;
      font-style: italic;
      font-size: 1em;
      margin: 1.4em 0 0.8em;
      page-break-after: avoid;
      break-after: avoid;
    }
    .synopsis {
      margin: 0 0 0.9em;
      padding: 0.1em 1.4em;
      border-left: 1px solid #a49d90;
      font-style: italic;
      color: #5e584f;
    }
    .synopsis p { text-indent: 0; }
    p { text-indent: 1.15em; margin: 0; orphans: 2; widows: 2; }
    h2 + p, h3 + p, h4 + p, .scene-break + p, hr + p, .scene-title + p, .synopsis + p { text-indent: 0; }
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

function renderPieces(pieces: DecoratedPiece[], options: CompileOptions): string {
  return pieces
    .map((piece) => {
      if (piece.type === 'part') {
        const body = proseToHtml(piece.body)
        return `<section class="part"><h2>${escapeXml(oneLine(piece.displayTitle))}</h2>${body}</section>`
      }
      const body = proseToHtml(piece.body)
      const scenes = piece.scenes
        .map((scene, index) => {
          const rule =
            index === 0
              ? ''
              : options.separator === 'stars'
                ? '<p class="scene-break">* * *</p>'
                : options.separator === 'rule'
                  ? '<hr />'
                  : ''
          const title =
            options.sceneTitles && scene.title.trim() ? `<h4 class="scene-title">${escapeXml(oneLine(scene.title))}</h4>` : ''
          const synopsis =
            options.includeSynopsis && scene.synopsis.trim()
              ? `<blockquote class="synopsis">${proseToHtml(scene.synopsis)}</blockquote>`
              : ''
          return `${rule}<section class="scene" id="s-${index + 1}">${title}${synopsis}${proseToHtml(scene.body)}</section>`
        })
        .join('\n')
      return `<section class="chapter"><h2>${escapeXml(oneLine(piece.displayTitle))}</h2>${body}${scenes}</section>`
    })
    .join('\n')
}

function frontMatterHtml(project: Project, docs: Record<string, Doc>, options: CompileOptions): string {
  const parts: string[] = []
  if (options.copyrightPage) {
    const lines = copyrightLines(project)
      .map((line) => `<p>${escapeXml(line)}</p>`)
      .join('')
    parts.push(`<section class="copyright">${lines}</section>`)
  }
  if (options.dedication) {
    const dedication = dedicationText(project, docs)
    if (dedication) {
      parts.push(`<section class="dedication">${proseToHtml(dedication)}</section>`)
    }
  }
  return parts.join('\n')
}

function titlePage(project: Project): string {
  const author = project.author.trim()
  const byline = author ? `<p class="byline">${escapeXml(author)}</p>` : ''
  return `<section class="title-page"><h1>${escapeXml(bookTitle(project))}</h1>${byline}</section>`
}

function contentsHtml(pieces: DecoratedPiece[]): string {
  const items = pieces
    .map((piece) => {
      const klass = piece.type === 'part' ? 'part-line' : 'chapter-line'
      return `<li class="${klass}">${escapeXml(oneLine(piece.displayTitle))}</li>`
    })
    .join('')
  return `<section class="contents"><h2>Contents</h2><ol>${items}</ol></section>`
}

export function compileHtml(
  project: Project,
  docs: Record<string, Doc>,
  included: Set<string>,
  presetId: PrintPresetId,
  options: CompileOptions = DEFAULT_COMPILE_OPTIONS,
): string {
  const pieces = decoratePieces(collectPieces(project, docs, included), options)
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
    ${frontMatterHtml(project, docs, options)}
    ${contentsHtml(pieces)}
    ${renderPieces(pieces, options)}
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
.copyright { text-align: center; margin-top: 25%; }
.copyright p { text-indent: 0; margin: 0.35em 0; }
.dedication { text-align: center; margin-top: 30%; }
.dedication p { text-indent: 0; font-style: italic; margin: 0.35em 0; }
.part, .chapter, .contents { page-break-before: always; break-before: page; }
.scene-break { text-align: center; text-indent: 0; margin: 1.3em 0; letter-spacing: 0.35em; }
.scene-title { text-align: center; font-weight: normal; font-style: italic; font-size: 1em; margin: 1.4em 0 0.8em; }
.synopsis { margin: 0 0 0.9em; padding: 0.1em 1.4em; border-left: 1px solid #a49d90; font-style: italic; color: #5e584f; }
.synopsis p { text-indent: 0; }
.contents ol { list-style: none; padding: 0; }
.contents .part-line { margin-top: 1em; }
p { text-indent: 1.15em; margin: 0.15em 0; }
h2 + p, .scene-break + p, .scene-title + p, .synopsis + p { text-indent: 0; }
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

export function compileEpubFiles(
  project: Project,
  docs: Record<string, Doc>,
  included: Set<string>,
  options: CompileOptions = DEFAULT_COMPILE_OPTIONS,
): PackagedFile[] {
  const pieces = decoratePieces(collectPieces(project, docs, included), options)
  const files: PackagedFile[] = []
  const manifest: string[] = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="contents" href="contents.xhtml" media-type="application/xhtml+xml"/>',
  ]
  const spine = ['<itemref idref="title"/>', '<itemref idref="contents"/>', '<itemref idref="nav"/>']
  const toc: string[] = [
    `<li><a href="title.xhtml">${escapeXml(bookTitle(project))}</a></li>`,
    '<li><a href="contents.xhtml">Contents</a></li>',
  ]
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

  const frontItems: string[] = []
  if (options.copyrightPage) {
    const lines = copyrightLines(project)
      .map((line) => `<p>${escapeXml(line)}</p>`)
      .join('')
    files.push({
      path: 'OEBPS/copyright.xhtml',
      text: xhtml('Copyright', `<section class="copyright">${lines}</section>`),
    })
    manifest.push('<item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>')
    spine.splice(1, 0, '<itemref idref="copyright"/>')
    frontItems.push('<li><a href="copyright.xhtml">Copyright</a></li>')
  }
  if (options.dedication) {
    const dedication = dedicationText(project, docs)
    if (dedication) {
      files.push({
        path: 'OEBPS/dedication.xhtml',
        text: xhtml('Dedication', `<section class="dedication">${proseToHtml(dedication)}</section>`),
      })
      manifest.push('<item id="dedication" href="dedication.xhtml" media-type="application/xhtml+xml"/>')
      spine.splice(options.copyrightPage ? 2 : 1, 0, '<itemref idref="dedication"/>')
      frontItems.push('<li><a href="dedication.xhtml">Dedication</a></li>')
    }
  }
  toc.push(...frontItems)

  for (const piece of pieces) {
    if (piece.type === 'part') {
      flushPart()
      partCount += 1
      const href = `p-${String(partCount).padStart(3, '0')}.xhtml`
      const body = proseToHtml(piece.body)
      files.push({
        path: `OEBPS/${href}`,
        text: xhtml(piece.title, `<section class="part" epub:type="part"><h2>${escapeXml(oneLine(piece.displayTitle))}</h2>${body}</section>`),
      })
      manifest.push(
        `<item id="p${partCount}" href="${href}" media-type="application/xhtml+xml"/>`,
      )
      spine.push(`<itemref idref="p${partCount}"/>`)
      pendingPart = { href, title: oneLine(piece.displayTitle), chapters: [] }
      continue
    }
    chapterCount += 1
    const href = `c-${String(chapterCount).padStart(3, '0')}.xhtml`
    const body = proseToHtml(piece.body)
    const scenes = piece.scenes
      .map((scene, index) => {
        const rule =
          index === 0
            ? ''
            : options.separator === 'stars'
              ? '<p class="scene-break">* * *</p>'
              : options.separator === 'rule'
                ? '<hr/>'
                : ''
        const title =
          options.sceneTitles && scene.title.trim()
            ? `<h3 class="scene-title">${escapeXml(oneLine(scene.title))}</h3>`
            : ''
        const synopsis =
          options.includeSynopsis && scene.synopsis.trim()
            ? `<blockquote class="synopsis">${proseToHtml(scene.synopsis)}</blockquote>`
            : ''
        return `${rule}<section class="scene" id="s-${index + 1}">${title}${synopsis}${proseToHtml(scene.body)}</section>`
      })
      .join('\n')
    files.push({
      path: `OEBPS/${href}`,
      text: xhtml(
        piece.title,
        `<section class="chapter" epub:type="chapter"><h2>${escapeXml(oneLine(piece.displayTitle))}</h2>${body}${scenes}</section>`,
      ),
    })
    manifest.push(`<item id="c${chapterCount}" href="${href}" media-type="application/xhtml+xml"/>`)
    spine.push(`<itemref idref="c${chapterCount}"/>`)
    const chapterItem = `<li><a href="${href}">${escapeXml(oneLine(piece.displayTitle))}</a></li>`
    if (pendingPart) pendingPart.chapters.push(chapterItem)
    else toc.push(chapterItem)
  }
  flushPart()

  const nav = xhtml(
    'Contents',
    `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${toc.join('')}</ol></nav>`,
  )
  files.push({
    path: 'OEBPS/contents.xhtml',
    text: xhtml('Contents', contentsHtml(pieces)),
  })
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

/* ------------------------------------------------------------------ */
/* DOCX                                                               */
/* ------------------------------------------------------------------ */

const TWIPS_PER_IN = 1440

function twips(inches: number): number {
  return Math.round(inches * TWIPS_PER_IN)
}

interface InlineRun {
  text: string
  bold: boolean
  italic: boolean
}

/** Split Markdown emphasis (`**bold**`, `*italic*`) into runs. */
export function inlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = []
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g
  let index = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > index) runs.push({ text: text.slice(index, start), bold: false, italic: false })
    const token = match[0]
    if (token.startsWith('**')) runs.push({ text: token.slice(2, -2), bold: true, italic: false })
    else runs.push({ text: token.slice(1, -1), bold: false, italic: true })
    index = start + token.length
  }
  if (index < text.length || runs.length === 0) {
    runs.push({ text: text.slice(index), bold: false, italic: false })
  }
  return runs
}

function docxRun(text: string, bold: boolean, italic: boolean): string {
  const props = bold || italic ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr>` : ''
  return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

interface ParaOptions {
  style?: string
  align?: 'center'
  pageBreakBefore?: boolean
  keepNext?: boolean
  firstLine?: boolean
  before?: number
  bold?: boolean
  italic?: boolean
  /** Render the text as one run, without Markdown emphasis parsing. */
  plain?: boolean
}

function paraXml(text: string, opts: ParaOptions = {}): string {
  const pPr: string[] = []
  if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`)
  if (opts.pageBreakBefore) pPr.push('<w:pageBreakBefore/>')
  if (opts.keepNext) pPr.push('<w:keepNext/>')
  if (opts.before !== undefined) pPr.push(`<w:spacing w:before="${opts.before}"/>`)
  if (opts.align === 'center') pPr.push('<w:jc w:val="center"/>')
  if (opts.firstLine) pPr.push('<w:ind w:firstLine="432"/>')
  const bold = Boolean(opts.bold)
  const italic = Boolean(opts.italic)
  const runs = opts.plain
    ? docxRun(text, bold, italic)
    : inlineRuns(text)
        .map((run) => docxRun(run.text, run.bold || bold, run.italic || italic))
        .join('')
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${runs}</w:p>`
}

function docxProse(markdown: string, firstAfterHeading: { current: boolean }): string {
  const normalized = markdown.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''
  const out: string[] = []
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const single = lines.length === 1 ? (lines[0] ?? '') : ''
    const heading = /^(#{1,3})\s+(.+)$/.exec(single)
    if (heading) {
      out.push(paraXml(heading[2] ?? '', { style: 'ProseHeading', align: 'center', keepNext: true, plain: true }))
      firstAfterHeading.current = true
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(single.trim())) {
      out.push(paraXml('* * *', { style: 'SceneBreak', plain: true }))
      firstAfterHeading.current = true
      continue
    }
    if (lines.every((line) => /^\s*[-*]\s+\S/.test(line))) {
      for (const line of lines) {
        out.push(paraXml(`\u2022 ${line.replace(/^\s*[-*]\s+/, '')}`, { style: 'ListPara' }))
      }
      firstAfterHeading.current = false
      continue
    }
    out.push(paraXml(block, { firstLine: !firstAfterHeading.current }))
    firstAfterHeading.current = false
  }
  return out.join('')
}

function docxStyles(fontPt: number): string {
  const size = Math.round(fontPt * 2)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/>
        <w:sz w:val="${size}"/><w:szCs w:val="${size}"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="0"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="BookTitle"><w:name w:val="Book Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="3600"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FrontText"><w:name w:val="Front Text"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240"/><w:jc w:val="center"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Byline"><w:name w:val="Byline"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="360"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="${size + 4}"/><w:szCs w:val="${size + 4}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="PartHead"><w:name w:val="Part Head"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="4320" w:after="720"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="${Math.round(size * 1.7)}"/><w:szCs w:val="${Math.round(size * 1.7)}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ChapterHead"><w:name w:val="Chapter Head"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="1440" w:after="720"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="${Math.round(size * 1.4)}"/><w:szCs w:val="${Math.round(size * 1.4)}"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ProseHeading"><w:name w:val="Prose Heading"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240"/><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:i/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="SynopsisNote"><w:name w:val="Synopsis Note"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="240"/><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="595248"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="RuleLine"><w:name w:val="Rule Line"/><w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="1C1915"/></w:pBdr>
      <w:spacing w:before="240" w:after="240"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="240"/><w:jc w:val="center"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TocPart"><w:name w:val="Toc Part"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240"/></w:pPr>
    <w:rPr><w:b/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TocChapter"><w:name w:val="Toc Chapter"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="120"/><w:ind w:left="360"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListPara"><w:name w:val="List Para"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/></w:pPr>
  </w:style>
</w:styles>
`
}

export function compileDocxFiles(
  project: Project,
  docs: Record<string, Doc>,
  included: Set<string>,
  presetId: PrintPresetId,
  options: CompileOptions = DEFAULT_COMPILE_OPTIONS,
): PackagedFile[] {
  const preset = PRINT_PRESETS[presetId]
  const pieces = decoratePieces(collectPieces(project, docs, included), options)
  const body: string[] = []

  body.push(paraXml(oneLine(bookTitle(project)), { style: 'BookTitle', plain: true }))
  const author = project.author.trim()
  if (author) body.push(paraXml(author, { style: 'Byline', plain: true }))
  body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

  const frontBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  if (options.copyrightPage) {
    for (const line of copyrightLines(project)) {
      body.push(paraXml(line, { style: 'FrontText', plain: true }))
    }
    body.push(frontBreak)
  }
  if (options.dedication) {
    const dedication = dedicationText(project, docs)
    if (dedication) {
      for (const line of dedication.split('\n')) {
        if (line.trim()) body.push(paraXml(line, { style: 'FrontText', italic: true, plain: true }))
      }
      body.push(frontBreak)
    }
  }

  body.push(paraXml('Contents', { style: 'ChapterHead', plain: true }))
  for (const piece of pieces) {
    body.push(paraXml(oneLine(piece.displayTitle), { style: piece.type === 'part' ? 'TocPart' : 'TocChapter', plain: true }))
  }

  const firstAfterHeading = { current: true }
  for (const piece of pieces) {
    if (piece.type === 'part') {
      body.push(paraXml(oneLine(piece.displayTitle), { style: 'PartHead', pageBreakBefore: true, keepNext: true, plain: true }))
      firstAfterHeading.current = true
      body.push(docxProse(piece.body, firstAfterHeading))
    } else {
      body.push(paraXml(oneLine(piece.displayTitle), { style: 'ChapterHead', pageBreakBefore: true, keepNext: true, plain: true }))
      firstAfterHeading.current = true
      body.push(docxProse(piece.body, firstAfterHeading))
      piece.scenes.forEach((scene, index) => {
        if (index > 0) {
          if (options.separator === 'stars') {
            body.push(paraXml('* * *', { style: 'SceneBreak', plain: true }))
          } else if (options.separator === 'rule') {
            body.push('<w:p><w:pPr><w:pStyle w:val="RuleLine"/></w:pPr></w:p>')
          } else {
            body.push('<w:p/>')
          }
          firstAfterHeading.current = true
        }
        if (options.sceneTitles && scene.title.trim()) {
          body.push(paraXml(oneLine(scene.title), { style: 'ProseHeading', keepNext: true, plain: true }))
          firstAfterHeading.current = true
        }
        if (options.includeSynopsis && scene.synopsis.trim()) {
          const text = scene.synopsis.trim()
          for (const line of text.split('\n')) {
            body.push(paraXml(line, { style: 'SynopsisNote', plain: true }))
          }
          firstAfterHeading.current = false
        }
        body.push(docxProse(scene.body, firstAfterHeading))
      })
    }
  }

  const sect = `<w:sectPr><w:pgSz w:w="${twips(preset.widthIn)}" w:h="${twips(preset.heightIn)}"/><w:pgMar w:top="${twips(preset.marginTopIn)}" w:right="${twips(preset.marginRightIn)}" w:bottom="${twips(preset.marginBottomIn)}" w:left="${twips(preset.marginLeftIn)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}${sect}</w:body></w:document>
`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
`
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
`
  return [
    { path: '[Content_Types].xml', text: types },
    { path: '_rels/.rels', text: rootRels },
    { path: 'word/document.xml', text: document },
    { path: 'word/styles.xml', text: docxStyles(preset.fontPt) },
    { path: 'word/_rels/document.xml.rels', text: docRels },
  ]
}
