export interface DiffRow {
  type: 'same' | 'add' | 'remove' | 'gap'
  text: string
}

function lines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  if (!normalized) return []
  const split = normalized.split('\n')
  if (split.length > 1 && split[split.length - 1] === '') split.pop()
  return split
}

/**
 * Line diff between two texts using a longest-common-subsequence table.
 * Manuscript pages are small, so the quadratic table is fine here.
 */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = lines(before)
  const b = lines(after)

  // LCS lengths: table[(i + 1) * (b.length + 1) + (j + 1)]
  const width = b.length + 1
  const table = new Int32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)])
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i] as string })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      rows.push({ type: 'remove', text: a[i] as string })
      i += 1
    } else {
      rows.push({ type: 'add', text: b[j] as string })
      j += 1
    }
  }
  while (i < a.length) {
    rows.push({ type: 'remove', text: a[i] as string })
    i += 1
  }
  while (j < b.length) {
    rows.push({ type: 'add', text: b[j] as string })
    j += 1
  }
  return rows
}

/**
 * Collapses runs of unchanged lines down to `context` lines on each side of a
 * change, inserting a gap marker where lines were hidden.
 */
export function collapseContext(rows: DiffRow[], context = 3): DiffRow[] {
  const keep = new Array<boolean>(rows.length).fill(false)
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.type === 'same') continue
    for (let at = Math.max(0, index - context); at <= Math.min(rows.length - 1, index + context); at += 1) {
      keep[at] = true
    }
  }
  const out: DiffRow[] = []
  let gap = false
  for (let index = 0; index < rows.length; index += 1) {
    if (keep[index]) {
      out.push(rows[index] as DiffRow)
      gap = false
    } else if (!gap) {
      out.push({ type: 'gap', text: '' })
      gap = true
    }
  }
  return out
}

/** Same lines only — no visible changes. */
export function isUnchanged(rows: DiffRow[]): boolean {
  return rows.every((row) => row.type === 'same')
}
