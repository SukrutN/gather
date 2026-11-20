/**
 * Splits a raw manuscript file into chapters and scenes.
 *
 * One `#` heading makes a chapter; `##` makes a scene inside it. Text before
 * the first heading becomes an opening chapter. A file with no headings at all
 * is split into scenes on runs of three or more blank lines, under one
 * chapter. Everything else — lists, emphasis, rules — is kept as written.
 */

export interface ImportedScene {
  title: string
  body: string
}

export interface ImportedChapter {
  title: string
  body: string
  scenes: ImportedScene[]
}

export interface ImportedManuscript {
  chapters: ImportedChapter[]
}

const HEADING = /^(#{1,2})[ \t]*(.*?)\s*#*\s*$/

function cleanBody(text: string): string {
  return text.replace(/^\n+/, '').replace(/\s+$/, '')
}

export function importManuscript(raw: string): ImportedManuscript {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.trim()) return { chapters: [] }

  // Headings are detected per line: `.` cannot cross a newline, so a single
  // test() against the whole file misses any heading after the first line.
  const hasHeadings = text.split('\n').some((line) => HEADING.test(line))
  if (hasHeadings) {
    const chapters: ImportedChapter[] = []
    let opening: string[] = []
    let chapter: ImportedChapter | null = null
    let scene: ImportedScene | null = null

    const pushChapter = (title: string, body: string): ImportedChapter => {
      const next: ImportedChapter = { title, body: cleanBody(body), scenes: [] }
      chapters.push(next)
      return next
    }

    const lines = text.split('\n')
    let buffer: string[] = []
    for (const line of lines) {
      const match = HEADING.exec(line)
      if (!match) {
        buffer.push(line)
        continue
      }
      const level = (match[1] ?? '').length
      const title = (match[2] ?? '').trim()
      if (chapter) {
        if (scene) {
          scene.body = cleanBody(buffer.join('\n'))
          scene = null
        } else {
          chapter.body = cleanBody(buffer.join('\n'))
        }
      } else {
        opening = buffer
      }
      buffer = []
      if (level === 1) {
        chapter = pushChapter(title || `Chapter ${chapters.length + 1}`, '')
        scene = null
      } else if (chapter) {
        scene = { title: title || `Scene ${chapter.scenes.length + 1}`, body: '' }
        chapter.scenes.push(scene)
      } else {
        // A scene before any chapter heading: open a chapter for it.
        chapter = pushChapter('Opening', '')
        scene = { title: title || `Scene ${chapter.scenes.length + 1}`, body: '' }
        chapter.scenes.push(scene)
      }
    }
    if (chapter) {
      if (scene) {
        scene.body = cleanBody(buffer.join('\n'))
      } else {
        chapter.body = cleanBody(buffer.join('\n'))
      }
    }

    const openingText = cleanBody(opening.join('\n'))
    if (openingText) {
      const openingChapter: ImportedChapter = { title: 'Opening', body: openingText, scenes: [] }
      chapters.unshift(openingChapter)
    }

    // Chapters with neither body nor scenes are husks; drop them.
    const kept = chapters.filter((item) => item.body.trim() || item.scenes.length > 0)
    return { chapters: kept }
  }

  // No headings: split scenes on three or more newlines worth of gap.
  const chunks = text.split(/\n{3,}/)
  const scenes: ImportedScene[] = []
  let index = 0
  for (const chunk of chunks) {
    const body = cleanBody(chunk)
    if (!body.trim()) continue
    index += 1
    scenes.push({ title: `Scene ${index}`, body })
  }
  if (scenes.length === 0) return { chapters: [] }
  return { chapters: [{ title: 'Imported manuscript', body: '', scenes }] }
}
