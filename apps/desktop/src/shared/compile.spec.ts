import { describe, expect, it } from 'vitest'
import { blankDoc } from './model'
import {
  DEFAULT_COMPILE_OPTIONS,
  PRINT_PRESETS,
  collectPieces,
  compileDocxFiles,
  compileEpubFiles,
  compileHtml,
  compileMarkdown,
  dedicationText,
  escapeXml,
  inlineRuns,
  presetMicrons,
  proseToHtml,
  type CompileOptions,
} from './compile'
import type { BinderNode, Doc, Project } from './types'

let counter = 0
function uuid(): string {
  counter += 1
  return `6f0c2a10-1b2c-4d3e-8f01-${String(counter).padStart(12, '0')}`
}

function node(id: string, kind: BinderNode['kind'], title: string, children?: BinderNode[]): BinderNode {
  return children ? { id, kind, title, children } : { id, kind, title }
}

function shelf(kind: BinderNode['kind'], children: BinderNode[]): BinderNode {
  return node(uuid(), kind, kind.charAt(0).toUpperCase() + kind.slice(1), children)
}

function makeBook(): { project: Project; docs: Record<string, Doc> } {
  const sceneA = node(uuid(), 'scene', 'Keys')
  const sceneB = node(uuid(), 'scene', 'The Drawer')
  const sceneC = node(uuid(), 'scene', 'The Slip')
  const part = node(uuid(), 'part', 'The Night Stack', [node(uuid(), 'chapter', 'After Close', [sceneA, sceneB])])
  const partChapter = part.children![0]!
  const looseChapter = node(uuid(), 'chapter', 'Returned', [sceneC])
  const dedication = node(uuid(), 'note', 'Dedication')
  const manuscript = shelf('manuscript', [part, looseChapter])
  const docs: Record<string, Doc> = {
    [part.id]: { ...blankDoc(part.id, 'part', 'The Night Stack'), body: 'Part intro text.' },
    [partChapter.id]: { ...blankDoc(partChapter.id, 'chapter', 'After Close'), body: 'Chapter opener.' },
    [sceneA.id]: { ...blankDoc(sceneA.id, 'scene', 'Keys'), synopsis: 'She locks up.', body: 'Alpha beta **gamma**.' },
    [sceneB.id]: { ...blankDoc(sceneB.id, 'scene', 'The Drawer'), body: 'Delta epsilon.' },
    [looseChapter.id]: { ...blankDoc(looseChapter.id, 'chapter', 'Returned'), body: 'Chapter two opener.' },
    [sceneC.id]: { ...blankDoc(sceneC.id, 'scene', 'The Slip'), body: 'Zeta eta theta.' },
    [dedication.id]: { ...blankDoc(dedication.id, 'note', 'Dedication'), body: 'For the night shift.' },
  }
  const project: Project = {
    format: 'gather-project',
    version: 1,
    title: 'Small <Hours> & "Hours"',
    author: 'N. Hale',
    wordGoal: 0,
    threads: [],
    history: {},
    created: '2026-01-08T00:40:00.000Z',
    modified: '2026-01-08T00:40:00.000Z',
    binder: [manuscript, shelf('characters', []), shelf('places', []), shelf('notes', [dedication])],
  }
  return { project, docs }
}

const allIds = (project: Project): string[] => {
  const ids: string[] = []
  const walk = (nodes: BinderNode[]): void => {
    for (const current of nodes) {
      if (current.kind === 'part' || current.kind === 'chapter' || current.kind === 'scene') ids.push(current.id)
      if (current.children) walk(current.children)
    }
  }
  walk(project.binder)
  return ids
}

describe('collectPieces', () => {
  it('walks the manuscript in order when everything is included', () => {
    const { project, docs } = makeBook()
    const pieces = collectPieces(project, docs, new Set(allIds(project)))
    expect(pieces.map((piece) => piece.type)).toEqual(['part', 'chapter', 'chapter'])
    const chapter = pieces[1]
    expect(chapter?.type).toBe('chapter')
    if (chapter?.type === 'chapter') {
      expect(chapter.body).toBe('Chapter opener.')
      expect(chapter.scenes.map((scene) => scene.body)).toEqual(['Alpha beta **gamma**.', 'Delta epsilon.'])
    } else {
      expect.unreachable('expected a chapter piece')
    }
  })

  it('exports a chapter whose text is unchecked while a scene is checked', () => {
    const { project, docs } = makeBook()
    const partChapter = project.binder[0]!.children![0]!.children![0]!
    const sceneA = partChapter.children![0]!
    const pieces = collectPieces(project, docs, new Set([sceneA.id]))
    const chapterPiece = pieces.find((piece) => piece.type === 'chapter' && piece.body === '')
    expect(chapterPiece?.type).toBe('chapter')
    if (chapterPiece?.type === 'chapter') {
      expect(chapterPiece.scenes).toHaveLength(1)
    }
  })

  it('skips a part header but keeps its chapters when the part is unchecked', () => {
    const { project, docs } = makeBook()
    const part = project.binder[0]!.children![0]!
    const partChapter = part.children![0]!
    const included = new Set([partChapter.id, ...partChapter.children!.map((child) => child.id)])
    const pieces = collectPieces(project, docs, included)
    expect(pieces.map((piece) => piece.type)).toEqual(['chapter'])
    expect(pieces[0]!.title).toBe('After Close')
  })

  it('includes chapter text but no scene bodies when only the chapter is checked', () => {
    const { project, docs } = makeBook()
    const partChapter = project.binder[0]!.children![0]!.children![0]!
    const pieces = collectPieces(project, docs, new Set([partChapter.id]))
    expect(pieces).toHaveLength(1)
    const piece = pieces[0]!
    if (piece.type === 'chapter') {
      expect(piece.body).toBe('Chapter opener.')
      expect(piece.scenes).toHaveLength(0)
    } else {
      expect.unreachable('expected a chapter piece')
    }
  })
})

describe('compileMarkdown', () => {
  it('renders title, author, contents, breaks, and scene rules', () => {
    const { project, docs } = makeBook()
    const markdown = compileMarkdown(project, docs, new Set(allIds(project)))
    expect(markdown.startsWith('# Small <Hours> & "Hours"')).toBe(true)
    expect(markdown).toContain('N. Hale')
    expect(markdown).toContain('## Contents')
    expect(markdown).toContain('- The Night Stack')
    expect(markdown).toContain('  - After Close')
    expect(markdown).toContain('* * *')
    expect(markdown).toContain('Chapter opener.')
    expect(markdown).toContain('Alpha beta **gamma**.')
    expect(markdown).not.toContain('Zeta eta theta.\n\n# ')
  })

  it('excludes unchecked items', () => {
    const { project, docs } = makeBook()
    const partChapter = project.binder[0]!.children![0]!.children![0]!
    const included = new Set([partChapter.id])
    const markdown = compileMarkdown(project, docs, included)
    expect(markdown).toContain('Chapter opener.')
    expect(markdown).not.toContain('The Slip')
    expect(markdown).not.toContain('Alpha beta')
  })
})

describe('compileHtml', () => {
  it('produces a self-contained print document', () => {
    const { project, docs } = makeBook()
    const html = compileHtml(project, docs, new Set(allIds(project)), '6x9')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('size: 6in 9in')
    expect(html).toContain('Small &lt;Hours&gt; &amp; &quot;Hours&quot;')
    expect(html).toContain('class="title-page"')
    expect(html).toContain('class="contents"')
    expect(html.match(/class="chapter"/g)).toHaveLength(2)
    expect(html).toContain('class="scene-break">* * *')
    expect(html).toContain('<strong>gamma</strong>')
  })
})

describe('proseToHtml and escapes', () => {
  it('handles headings, rules, lists, and emphasis', () => {
    expect(proseToHtml('# Heading\n\nText with *em* and **strong**.')).toContain('<h4>Heading</h4>')
    expect(proseToHtml('---')).toBe('<hr />')
    expect(proseToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>')
    expect(proseToHtml('a\nb')).toBe('<p>a<br />b</p>')
    expect(proseToHtml('')).toBe('')
  })

  it('escapes XML entities', () => {
    expect(escapeXml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;')
  })

  it('splits inline runs on markdown emphasis', () => {
    const runs = inlineRuns('plain **bold** and *em* end')
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false },
      { text: 'bold', bold: true, italic: false },
      { text: ' and ', bold: false, italic: false },
      { text: 'em', bold: false, italic: true },
      { text: ' end', bold: false, italic: false },
    ])
    expect(inlineRuns('')).toEqual([{ text: '', bold: false, italic: false }])
  })
})

describe('compileEpubFiles', () => {
  it('lays out an EPUB 3 package', () => {
    const { project, docs } = makeBook()
    const files = compileEpubFiles(project, docs, new Set(allIds(project)))
    const paths = files.map((file) => file.path)
    expect(paths).toContain('META-INF/container.xml')
    expect(paths).toContain('OEBPS/content.opf')
    expect(paths).toContain('OEBPS/nav.xhtml')
    expect(paths).toContain('OEBPS/title.xhtml')
    expect(paths).toContain('OEBPS/p-001.xhtml')
    expect(paths).toContain('OEBPS/c-001.xhtml')
    expect(paths).toContain('OEBPS/c-002.xhtml')
    expect(paths).not.toContain('OEBPS/p-002.xhtml')

    const opf = files.find((file) => file.path === 'OEBPS/content.opf')!.text
    expect(opf).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"')
    expect(opf).toContain('<dc:creator>N. Hale</dc:creator>')
    expect(opf).toContain('<dc:title>Small &lt;Hours&gt; &amp; &quot;Hours&quot;</dc:title>')
    expect(opf).toMatch(/<meta property="dcterms:modified">\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/meta>/)
    const spineStart = opf.indexOf('<spine>')
    const chapter1 = opf.indexOf('idref="c1"')
    const chapter2 = opf.indexOf('idref="c2"')
    expect(spineStart).toBeGreaterThan(-1)
    expect(chapter1).toBeGreaterThan(spineStart)
    expect(chapter2).toBeGreaterThan(chapter1)

    const nav = files.find((file) => file.path === 'OEBPS/nav.xhtml')!.text
    expect(nav).toContain('epub:type="toc"')
    expect(nav).toContain('href="p-001.xhtml"')
    expect(nav).toContain('href="c-001.xhtml"')

    const part = files.find((file) => file.path === 'OEBPS/p-001.xhtml')!.text
    expect(part).toContain('epub:type="part"')

    const chapter = files.find((file) => file.path === 'OEBPS/c-001.xhtml')!.text
    expect(chapter).toContain('Chapter opener.')
    expect(chapter).toContain('class="scene-break">* * *')
  })

  it('omits the creator tag without an author', () => {
    const { project, docs } = makeBook()
    const files = compileEpubFiles({ ...project, author: '' }, docs, new Set(allIds(project)))
    const opf = files.find((file) => file.path === 'OEBPS/content.opf')!.text
    expect(opf).not.toContain('<dc:creator>')
  })
})

describe('compileDocxFiles', () => {
  it('writes a complete WordprocessingML package', () => {
    const { project, docs } = makeBook()
    const files = compileDocxFiles(project, docs, new Set(allIds(project)), '6x9')
    const paths = files.map((file) => file.path)
    expect(paths).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/styles.xml',
      'word/_rels/document.xml.rels',
    ])
    const types = files[0]!.text
    expect(types).toContain('wordprocessingml.document.main+xml')
    expect(types).toContain('wordprocessingml.styles+xml')

    const rels = files[1]!.text
    expect(rels).toContain('Target="word/document.xml"')

    const doc = files[2]!.text
    expect(doc).toContain('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"')
    expect(doc).toContain('Small &lt;Hours&gt; &amp; &quot;Hours&quot;')
    expect(doc).toContain('N. Hale')
    expect(doc).toContain('<w:pgSz w:w="8640" w:h="12960"/>')
    expect(doc).toContain('<w:pgMar w:top="1037" w:right="922"')
    expect(doc).toContain('<w:br w:type="page"/>')
    expect(doc.match(/<w:pageBreakBefore\/>/g)?.length).toBe(3)
    expect(doc).toContain('The Night Stack')
    expect(doc).toContain('Chapter opener.')
    expect(doc).toContain('Alpha beta ')
    expect(doc).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">gamma</w:t>')
    expect(doc).toContain('<w:t xml:space="preserve">* * *</w:t>')
    expect(doc).toContain('Zeta eta theta.')
  })

  it('matches preset page sizes in twips', () => {
    const { project, docs } = makeBook()
    for (const presetId of ['5x8', '6x9', 'letter'] as const) {
      const files = compileDocxFiles(project, docs, new Set(allIds(project)), presetId)
      const doc = files[2]!.text
      const preset = PRINT_PRESETS[presetId]
      expect(doc).toContain(`<w:pgSz w:w="${Math.round(preset.widthIn * 1440)}" w:h="${Math.round(preset.heightIn * 1440)}"/>`)
    }
  })

  it('styles the base font from the preset', () => {
    const { project, docs } = makeBook()
    const files = compileDocxFiles(project, docs, new Set(allIds(project)), 'letter')
    const styles = files[3]!.text
    expect(styles).toContain('w:styleId="BookTitle"')
    expect(styles).toContain('w:styleId="ChapterHead"')
    expect(styles).toContain('w:styleId="SceneBreak"')
    expect(styles).toContain('<w:sz w:val="24"/>')
  })
})

describe('print presets', () => {
  it('converts presets to microns', () => {
    expect(presetMicrons('5x8')).toEqual({ width: 127000, height: 203200 })
    expect(presetMicrons('letter')).toEqual({ width: 215900, height: 279400 })
  })

  it('covers the three book sizes', () => {
    expect(Object.keys(PRINT_PRESETS)).toEqual(['5x8', '6x9', 'letter'])
  })
})

describe('compile options', () => {
  it('numbers chapters and parts when asked', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const markdown = compileMarkdown(project, docs, included, {
      ...DEFAULT_COMPILE_OPTIONS,
      numbering: 'parts',
    })
    expect(markdown).toContain('# Part I — The Night Stack')
    expect(markdown).toContain('## Chapter 1 — After Close')
    expect(markdown).toContain('## Chapter 2 — Returned')
    const html = compileHtml(project, docs, included, '6x9', { ...DEFAULT_COMPILE_OPTIONS, numbering: 'chapters' })
    expect(html).toContain('Chapter 1 — After Close')
    expect(html).not.toContain('Part I')
    const files = compileEpubFiles(project, docs, included, { ...DEFAULT_COMPILE_OPTIONS, numbering: 'parts' })
    const chapter = files.find((file) => file.path === 'OEBPS/c-001.xhtml')!.text
    expect(chapter).toContain('Chapter 1 — After Close')
  })

  it('prints scene titles and synopses when asked', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const options: CompileOptions = { ...DEFAULT_COMPILE_OPTIONS, sceneTitles: true, includeSynopsis: true }
    const markdown = compileMarkdown(project, docs, included, options)
    expect(markdown).toContain('### Keys')
    expect(markdown).toContain('> She locks up.')
    const html = compileHtml(project, docs, included, '6x9', options)
    expect(html).toContain('<h4 class="scene-title">Keys</h4>')
    expect(html).toContain('class="synopsis"')
    const files = compileEpubFiles(project, docs, included, options)
    const chapter = files.find((file) => file.path === 'OEBPS/c-001.xhtml')!.text
    expect(chapter).toContain('<h3 class="scene-title">Keys</h3>')
    const docx = compileDocxFiles(project, docs, included, '6x9', options)
    const document = docx[2]!.text
    expect(document).toContain('<w:pStyle w:val="ProseHeading"/>')
    expect(document).toContain('She locks up.')
    expect(document).toContain('<w:pStyle w:val="SynopsisNote"/>')
  })

  it('switches the scene separator', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const blank = compileMarkdown(project, docs, included, { ...DEFAULT_COMPILE_OPTIONS, separator: 'blank' })
    expect(blank).not.toContain('* * *')
    const rule = compileMarkdown(project, docs, included, { ...DEFAULT_COMPILE_OPTIONS, separator: 'rule' })
    expect(rule).toContain('***')
    expect(rule).not.toContain('* * *')
    const html = compileHtml(project, docs, included, '6x9', { ...DEFAULT_COMPILE_OPTIONS, separator: 'rule' })
    expect(html).toContain('<hr />')
    const docx = compileDocxFiles(project, docs, included, '6x9', { ...DEFAULT_COMPILE_OPTIONS, separator: 'rule' })
    expect(docx[2]!.text).toContain('<w:pStyle w:val="RuleLine"/>')
  })

  it('defaults keep the classic output', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const plain = compileMarkdown(project, docs, included)
    const explicit = compileMarkdown(project, docs, included, DEFAULT_COMPILE_OPTIONS)
    expect(plain).toBe(explicit)
    expect(plain).not.toContain('Chapter 1 —')
    expect(plain).not.toContain('### ')
    expect(plain).not.toContain('> She locks up.')
    expect(plain).not.toContain('## Copyright')
    expect(plain).not.toContain('Dedication')
    const html = compileHtml(project, docs, included, '6x9')
    expect(html).not.toContain('<h4 class="scene-title"')
    expect(html).not.toContain('class="synopsis"')
    expect(html).not.toContain('class="copyright"')
  })
})

describe('front matter', () => {
  it('adds a copyright page and a dedication in markdown', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const options: CompileOptions = { ...DEFAULT_COMPILE_OPTIONS, copyrightPage: true, dedication: true }
    const markdown = compileMarkdown(project, docs, included, options)
    expect(markdown).toContain('## Copyright')
    expect(markdown).toMatch(/Copyright © \d{4} N\. Hale/)
    expect(markdown).toContain('All rights reserved.')
    expect(markdown).toContain('## Dedication')
    expect(markdown).toContain('For the night shift.')
  })

  it('adds front matter sections in html and epub', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const options: CompileOptions = { ...DEFAULT_COMPILE_OPTIONS, copyrightPage: true, dedication: true }
    const html = compileHtml(project, docs, included, '6x9', options)
    expect(html).toContain('class="copyright"')
    expect(html).toMatch(/Copyright © \d{4} N\. Hale/)
    expect(html).toContain('class="dedication"')
    expect(html).toContain('For the night shift.')
    const files = compileEpubFiles(project, docs, included, options)
    const paths = files.map((file) => file.path)
    expect(paths).toContain('OEBPS/copyright.xhtml')
    expect(paths).toContain('OEBPS/dedication.xhtml')
    const copyright = files.find((file) => file.path === 'OEBPS/copyright.xhtml')!.text
    expect(copyright).toContain('All rights reserved.')
    const nav = files.find((file) => file.path === 'OEBPS/nav.xhtml')!.text
    expect(nav).toContain('href="copyright.xhtml"')
    expect(nav).toContain('href="dedication.xhtml"')
    const opf = files.find((file) => file.path === 'OEBPS/content.opf')!.text
    const titlePos = opf.indexOf('idref="title"')
    const copyrightPos = opf.indexOf('idref="copyright"')
    const dedicationPos = opf.indexOf('idref="dedication"')
    expect(titlePos).toBeGreaterThan(-1)
    expect(copyrightPos).toBeGreaterThan(titlePos)
    expect(dedicationPos).toBeGreaterThan(copyrightPos)
  })

  it('adds front matter to the docx package', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const options: CompileOptions = { ...DEFAULT_COMPILE_OPTIONS, copyrightPage: true, dedication: true }
    const files = compileDocxFiles(project, docs, included, '6x9', options)
    const document = files[2]!.text
    expect(document).toContain('<w:pStyle w:val="FrontText"/>')
    expect(document).toMatch(/Copyright © \d{4} N\. Hale/)
    expect(document).toContain('For the night shift.')
    const styles = files[3]!.text
    expect(styles).toContain('w:styleId="FrontText"')
  })

  it('skips a missing dedication quietly', () => {
    const { project, docs } = makeBook()
    const included = new Set(allIds(project))
    const options: CompileOptions = { ...DEFAULT_COMPILE_OPTIONS, dedication: true }
    const stripped = { ...project, binder: project.binder.filter((node) => node.kind !== 'notes') }
    const markdown = compileMarkdown(stripped, docs, included, options)
    expect(markdown).not.toContain('## Dedication')
    expect(dedicationText(stripped, docs)).toBe('')
    expect(dedicationText(project, docs)).toBe('For the night shift.')
  })
})
