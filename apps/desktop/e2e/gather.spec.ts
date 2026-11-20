import { readFileSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Locator, type Page } from 'playwright-core'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createFixture, ids } from './fixture'

const nodeRequire = createRequire(import.meta.url)

/** Resolves the local Electron binary the way electron/index.js does. */
function electronExecutable(): string {
  const entry = nodeRequire.resolve('electron')
  const packageDir = dirname(entry)
  const relative = readFileSync(join(packageDir, 'path.txt'), 'utf8').trim()
  return join(packageDir, 'dist', relative)
}

let app: ElectronApplication
let window: Page
let dir: string

beforeAll(async () => {
  dir = await createFixture()
  app = await electron.launch({
    executablePath: electronExecutable(),
    args: [resolve('out/main/index.js')],
    env: { ...process.env, GATHER_PROJECT: dir } as Record<string, string>,
  })
  window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  // Electron's userData persists between runs; start every run from the same
  // preferences (theme, inspector, author, recent) or earlier runs leak in.
  await window.evaluate(() => localStorage.clear())
  await window.reload()
  await window.waitForLoadState('domcontentloaded')
}, 120_000)

afterAll(async () => {
  await app.close()
})

async function visible(locator: Locator, timeout = 10_000): Promise<Locator> {
  await locator.waitFor({ state: 'visible', timeout })
  return locator
}async function hidden(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'hidden', timeout: 10_000 })
}

it('opens the project passed through GATHER_PROJECT', async () => {
  // The binder only renders with a project open; the Welcome screen can show a
  // "Continue …" button with the same title, so wait for the binder first.
  await visible(window.locator('.binder'), 20_000)
  await visible(window.getByRole('button', { name: 'E2E Novel', exact: true }))
})

it('shows the binder tree and selects a scene', async () => {
  await window.locator('.row-name', { hasText: 'Lamplight' }).click()
  const title = await visible(window.locator('.doc-title'))
  expect(await title.inputValue()).toBe('Lamplight')
  await visible(window.locator('textarea.manuscript'))
})

it('edits the body, autosaves to disk, and records the session', async () => {
  const body = window.locator('textarea.manuscript')
  const before = await body.inputValue()
  await body.fill(`${before} Fresh words for the count.`)
  await expect
    .poll(async () => readFile(join(dir, 'documents', `${ids.sceneA}.md`), 'utf8'), { timeout: 15_000 })
    .toContain('Fresh words for the count.')
  await expect
    .poll(async () => readFile(join(dir, 'project.json'), 'utf8'), { timeout: 15_000 })
    .toMatch(/"history":\s*{[^}]*"[0-9-]{10}":\s*5/)
})

it('shows stats with today’s words and the goal', async () => {
  await window.getByRole('button', { name: 'Stats' }).click()
  const dialog = await visible(window.locator('.stats-dialog'))
  expect(await dialog.textContent()).toContain('Today')
  expect(await dialog.locator('.stats-grid dd').first().textContent()).toBe('5 words')
  expect(await dialog.textContent()).toContain('of a 5,000 word goal')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await hidden(dialog)
})

it('toggles the theme and back', async () => {
  const themeButton = window.locator('.topbar').getByRole('button', { name: /^(Dark|Light)$/ })
  await visible(themeButton)
  const label = (await themeButton.textContent())?.trim()
  const initial = label === 'Dark' ? 'light' : 'dark'
  await themeButton.click()
  await expect
    .poll(async () => window.evaluate(() => document.documentElement.dataset.theme), { timeout: 10_000 })
    .toBe(initial === 'light' ? 'dark' : 'light')
  await themeButton.click()
  await expect
    .poll(async () => window.evaluate(() => document.documentElement.dataset.theme), { timeout: 10_000 })
    .toBe(initial)
})

it('outlines the manuscript and the story-day timeline', async () => {
  await window.getByRole('button', { name: 'Outline' }).click()
  await visible(window.locator('.outline-row').first())
  expect(await window.locator('.outline-row').count()).toBe(3)
  await window.getByRole('button', { name: 'Timeline' }).click()
  await visible(window.locator('.outline-day').first())
  const days = window.locator('.outline-day')
  expect(await days.count()).toBe(2)
  expect(await days.first().textContent()).toBe('1')
  expect(await days.nth(1).textContent()).toBe('2')
  await window.getByRole('button', { name: 'Binder' }).click()
})

it('pins POV chips on the corkboard', async () => {
  await window.getByRole('button', { name: 'Corkboard' }).click()
  await visible(window.locator('.card').first())
  expect(await window.locator('.card').count()).toBe(2)
  expect(await window.locator('.card-chips').first().textContent()).toContain('Rook')
  await window.getByRole('button', { name: 'Editor' }).click()
})

it('finds text across the project', async () => {
  await window.getByRole('button', { name: 'Search', exact: true }).click()
  const input = await visible(window.locator('.search-input'))
  await input.fill('ledger')
  const first = await visible(window.locator('.search-results button').first(), 15_000)
  expect(await first.textContent()).toContain('The Ledger')
  await first.click()
  await expect
    .poll(async () => window.locator('.doc-title').inputValue(), { timeout: 10_000 })
    .toBe('The Ledger')
})

it('shows scene metadata in the inspector', async () => {
  await window.locator('.row-name', { hasText: 'Lamplight' }).click()
  const inspector = await visible(window.locator('.inspector'))
  expect(await inspector.textContent()).toContain('Story day')
  expect(await inspector.locator('select').first().inputValue()).toBe(ids.rook)
})

it('keeps a snapshot copy of the current page', async () => {
  await window.locator('.doc-meta-tools').getByRole('button', { name: /Copies/ }).click()
  await visible(window.locator('.popover'))
  await window.getByRole('button', { name: 'Keep a copy now' }).click()
  await visible(window.locator('.snapshot-list li').first())
  await expect
    .poll(async () => (await readdir(join(dir, 'snapshots', ids.sceneA))).length, { timeout: 10_000 })
    .toBe(1)
  await window.keyboard.press('Escape')
  await hidden(window.locator('.popover'))
})

it('duplicates the selected scene with a copy suffix', async () => {
  await window.getByRole('button', { name: 'Duplicate' }).click()
  await visible(window.locator('.row-name', { hasText: 'Lamplight (copy)' }))
  await expect
    .poll(async () => window.locator('.doc-title').inputValue(), { timeout: 10_000 })
    .toBe('Lamplight (copy)')
})

it('opens the compile dialog with the Word format', async () => {
  await window.getByRole('button', { name: 'Compile' }).click()
  const dialog = await visible(window.locator('.compile-dialog'))
  expect(await dialog.textContent()).toContain('Word')
  expect(await dialog.locator('.check-node').count()).toBeGreaterThanOrEqual(4)
  await window.keyboard.press('Escape')
  await hidden(dialog)
})

it('persists a button reorder to project.json', async () => {
  await window.getByRole('button', { name: 'Down' }).click()
  try {
    await expect
      .poll(
        async () => {
          const content = await readFile(join(dir, 'project.json'), 'utf8')
          return content.indexOf('"title": "Lamplight (copy)"') - content.indexOf('"title": "The Ledger"')
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)
  } catch (error) {
    const diagnostics = await window.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      banner: document.querySelector('.banner')?.textContent ?? null,
      rows: [...document.querySelectorAll('.binder .row-name')].map((row) => row.textContent),
      title: (document.querySelector('.doc-title') as HTMLInputElement | null)?.value ?? null,
    }))
    console.log('REORDER DIAGNOSTICS:', JSON.stringify(diagnostics, null, 2))
    throw error
  }
})

it('adds a comment on selected text and persists it', async () => {
  await window.locator('.row-title', { hasText: /^Lamplight$/ }).first().click()
  const body = window.locator('textarea.manuscript')
  await body.waitFor({ state: 'visible' })
  await body.evaluate((el) => {
    const area = el as HTMLTextAreaElement
    area.focus()
    area.setSelectionRange(0, 18)
  })
  await window.locator('.doc-meta-tools').getByRole('button', { name: 'Comment' }).click()
  const panel = await visible(window.locator('.comments-panel'))
  const draft = await visible(panel.locator('.comment-draft'))
  await draft.locator('textarea').fill('Tighten the first beat.')
  await draft.getByRole('button', { name: 'Comment', exact: true }).click()
  await visible(panel.locator('.comment-card'))
  await expect
    .poll(async () => readFile(join(dir, 'comments.json'), 'utf8'), { timeout: 15_000 })
    .toContain('Tighten the first beat.')
})

it('replies to and resolves a comment', async () => {
  const panel = await visible(window.locator('.comments-panel'))
  const card = panel.locator('.comment-card').first()
  await card.getByRole('button', { name: 'Reply' }).click()
  await card.locator('input').fill('Agreed — it drags.')
  await card.getByRole('button', { name: 'Send' }).click()
  await visible(panel.locator('.comment-reply').first())
  await expect
    .poll(async () => readFile(join(dir, 'comments.json'), 'utf8'), { timeout: 15_000 })
    .toContain('Agreed — it drags.')
  await card.getByRole('button', { name: 'Resolve' }).click()
  await expect
    .poll(async () => (await card.getAttribute('class')) ?? '', { timeout: 10_000 })
    .toContain('resolved')
  await expect
    .poll(async () => readFile(join(dir, 'comments.json'), 'utf8'), { timeout: 15_000 })
    .toMatch(/"resolved": true/)
})

it('keeps a named version and restores an earlier page', async () => {
  await expect
    .poll(async () => readFile(join(dir, 'history', 'versions.json'), 'utf8'), { timeout: 15_000 })
    .toContain('gather-history')
  await window.getByRole('button', { name: 'History' }).click()
  const dialog = await visible(window.locator('.history-dialog'))
  await dialog.locator('.history-keep input').fill('Before the rewrite')
  await dialog.getByRole('button', { name: 'Keep a version now' }).click()
  await expect
    .poll(async () => dialog.locator('.version-row').count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2)

  const rows = dialog.locator('.version-row')
  await rows.nth((await rows.count()) - 1).click()
  await visible(dialog.locator('.changed-list button').first())
  await dialog.locator('.changed-list button', { hasText: 'Lamplight' }).first().click()
  await visible(dialog.locator('.diff-view'))
  await dialog.getByRole('button', { name: 'Restore this page' }).click()
  await expect
    .poll(async () => window.locator('textarea.manuscript').inputValue(), { timeout: 10_000 })
    .not.toContain('Fresh words for the count.')

  // Restoring everything from the newest version should undo that revert.
  await rows.first().click()
  await dialog.getByRole('button', { name: 'Restore everything…' }).click()
  await dialog.getByRole('button', { name: 'Restore everything', exact: true }).click()
  await expect
    .poll(async () => window.locator('.banner.bar').textContent() ?? '', { timeout: 10_000 })
    .toContain('Restored the version')
  await expect
    .poll(async () => window.locator('textarea.manuscript').inputValue(), { timeout: 10_000 })
    .toContain('Fresh words for the count.')
  await window.keyboard.press('Escape')
  await hidden(dialog)
})

it('reloads the project when files change on disk', async () => {
  // Let the previous save (and its status capture) settle first, so the app
  // has no unsaved work when the folder changes underneath it.
  await expect
    .poll(async () => window.locator('.save-state').textContent() ?? '', { timeout: 15_000 })
    .toContain('Saved')
  await window.waitForTimeout(700)

  const file = join(dir, 'documents', `${ids.sceneA}.md`)
  const before = await readFile(file, 'utf8')
  await writeFile(file, `${before}\n\nAn outside hand edited this.`, 'utf8')
  await window.evaluate(() => globalThis.dispatchEvent(new Event('focus')))
  await expect
    .poll(async () => window.locator('textarea.manuscript').inputValue(), { timeout: 15_000 })
    .toContain('An outside hand edited this.')
  await expect
    .poll(async () => window.locator('.banner.bar').textContent() ?? '', { timeout: 10_000 })
    .toContain('changed on disk')
})

it('saves custom fields from the inspector', async () => {
  await window.locator('.row-title', { hasText: /^Lamplight$/ }).first().click()
  const details = window.getByRole('button', { name: 'Details' })
  if ((await details.getAttribute('aria-pressed')) !== 'true') {
    await details.click()
  }
  const inspector = await visible(window.locator('.inspector'))
  await inspector.getByRole('button', { name: 'Add a field' }).click()
  const rows = inspector.locator('.pair-row')
  await rows.locator('input').first().fill('mood')
  await rows.locator('input').nth(1).fill('rain on the roof')
  await expect
    .poll(async () => readFile(join(dir, 'documents', `${ids.sceneA}.md`), 'utf8'), { timeout: 15_000 })
    .toContain('mood: "rain on the roof"')

  const keywordInput = inspector.getByPlaceholder('Add a keyword, press Enter')
  await keywordInput.fill('night')
  await keywordInput.press('Enter')
  await expect
    .poll(async () => readFile(join(dir, 'documents', `${ids.sceneA}.md`), 'utf8'), { timeout: 15_000 })
    .toContain('keyword: "night"')
})

it('wraps a selection in bold with Ctrl+B and persists it', async () => {
  const body = window.locator('textarea.manuscript')
  await body.waitFor({ state: 'visible' })
  await body.evaluate((el) => {
    const area = el as HTMLTextAreaElement
    area.focus()
    area.setSelectionRange(4, 9)
  })
  await window.keyboard.press('Control+B')
  await expect
    .poll(async () => window.locator('textarea.manuscript').inputValue(), { timeout: 10_000 })
    .toContain('The **lamps** counted')
  await expect
    .poll(async () => readFile(join(dir, 'documents', `${ids.sceneA}.md`), 'utf8'), { timeout: 15_000 })
    .toContain('**lamps**')
})

it('pins a page as a reference while writing elsewhere', async () => {
  const body = window.locator('textarea.manuscript')
  await body.waitFor({ state: 'visible' })
  await window.getByRole('button', { name: 'Pin as reference' }).click()
  await window.locator('.row-title', { hasText: /^The Ledger$/ }).click()
  await visible(window.locator('.quickref'))
  expect(await window.locator('.quickref').textContent()).toContain('lamps')
  await window.locator('.quickref').getByRole('button', { name: 'Close' }).click()
  await hidden(window.locator('.quickref'))
  await window.locator('.row-title', { hasText: /^Lamplight$/ }).first().click()
})

it('offers compile formatting choices', async () => {
  await window.getByRole('button', { name: 'Compile' }).click()
  const dialog = await visible(window.locator('.compile-dialog'))
  const sceneTitles = dialog.getByRole('checkbox', { name: 'Print scene titles' })
  await sceneTitles.check()
  expect(await sceneTitles.isChecked()).toBe(true)
  const synopsis = dialog.getByRole('checkbox', { name: 'Include synopses' })
  await synopsis.check()
  expect(await synopsis.isChecked()).toBe(true)
  const copyright = dialog.getByRole('checkbox', { name: 'Copyright page' })
  await copyright.check()
  expect(await copyright.isChecked()).toBe(true)
  expect(await dialog.textContent()).toContain('Formatting')
  await window.keyboard.press('Escape')
  await hidden(dialog)
})
