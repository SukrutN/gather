# Gather

Marketing site: https://sukrutn.github.io/gather/

Gather is a local-first novel studio. A project is a folder of ordinary files on your machine. There is no account, no sync, and no hosted editor. The desktop app works offline. This repository also contains the marketing site.

Gather does its jobs:

- Keep a long manuscript organized in a binder of parts, chapters, and scenes, with shelves for characters, places, and notes. Drag rows to reorder or nest, duplicate any item, and keep copies of any page you can restore later.
- Draft in a clean editor with a title, synopsis, status, live word count, a details panel for scene and character metadata, keywords, custom fields on every page, a focus mode that hides the binder, typewriter scrolling, a dark theme, Ctrl+B / Ctrl+I for emphasis, and a pinned reference page shown under the editor while you write elsewhere.
- See the whole book at once: an outliner in binder order, a timeline that sorts scenes by story day, a corkboard of scene cards, and project-wide search (keywords included).
- Keep the habit going: set a manuscript word goal, track words per day, and watch your writing streak.
- Version everything: every open that changed since the last checkpoint keeps an automatic version, you can keep named versions any time, compare any page between versions, and restore a page or the whole project.
- Comment on selected text for a co-writer or editor, with replies and resolved states — comments live in `comments.json` inside the project, so they travel with the folder.
- Keep reference material in the Research shelf: PDFs, images, and clippings stored in the project's `research/` folder, opened by your system's apps, moved and shared with the project.
- Format ebook and print from the same project: Markdown, HTML, DOCX, EPUB, and PDF, with compile options for scene titles, chapter and part numbering, scene separators, synopsis copies, a copyright page, and a dedication.
- Bring an existing book in: File → Import Manuscript reads a `.md` or `.txt` file and splits it into chapters and scenes by headings.
- Back the whole project up as one zip any time with File → Back Up Project.
- Package it as software: `npm run dist` builds a Windows installer and a portable exe, and the installed app updates itself from GitHub Releases.

## Requirements

- Node.js 20.19.x, or Node.js 22.12 or newer
- npm 10 or newer

## Install

From the repository root:

```bash
npm install
```

## Run the desktop app

Development, with a hot-reloaded window:

```bash
npm run dev:desktop
```

Production build, then open that build:

```bash
npm run start:desktop
```

`npm run start:desktop` typechecks, builds, and launches the app. It does not talk to a server.

In the app:

- **New project** asks for an empty-of-Gather folder and writes `project.json` plus the four binder shelves.
- **Open project** loads a folder that already contains `project.json`.
- **Open sample** writes a short original novel, *The Keep of Small Hours*, into a folder you choose.

Edits autosave. Ctrl+S or Cmd+S saves immediately. File → Compile, or the Compile button, exports the manuscript.

Keyboard shortcuts:

| Shortcut | What it does |
| --- | --- |
| `Ctrl/Cmd+N` | New project |
| `Ctrl/Cmd+O` | Open project |
| `Ctrl/Cmd+S` | Save now |
| `Ctrl/Cmd+Shift+E` | Compile |
| `Ctrl/Cmd+Shift+F` | Find in project |
| `Ctrl/Cmd+Shift+M` | Import a manuscript |
| `Ctrl/Cmd+Shift+D` | Toggle focus mode |
| `Ctrl/Cmd+Shift+L` | Toggle light and dark |
| `Ctrl/Cmd+B` | Bold the selection |
| `Ctrl/Cmd+I` | Italicize the selection |

## Build and run the site

Development:

```bash
npm run dev:web
```

Production build, then preview it locally:

```bash
npm run build:web
npm run preview:web
```

Build both the desktop app and the site:

```bash
npm run build
```

Typecheck both apps without emitting bundles:

```bash
npm run typecheck
```

| Script | What it does |
| --- | --- |
| `npm run dev:desktop` | Run the desktop studio in development |
| `npm run start:desktop` | Typecheck, build, and open the production desktop app |
| `npm run build:desktop` | Typecheck and build the desktop app |
| `npm run dev:web` | Run the marketing site in development |
| `npm run build:web` | Typecheck and build the marketing site |
| `npm run preview:web` | Serve the production site locally |
| `npm run build` | Build the desktop app and the site |
| `npm run typecheck` | Typecheck both apps |
| `npm run test` | Run the unit test suite |
| `npm run test:e2e` | Build, then drive the real app with Playwright |
| `npm run dist` | Build, then package the Windows installer and portable exe |

## Project folder

A Gather project is a directory:

```text
my-novel/
  project.json
  comments.json
  documents/
    6f0c2a10-1b2c-4d3e-8f01-000000000004.md
  research/           optional reference files, kept as-is and opened by your system
  snapshots/          optional per-page copies, kept from the editor
  history/            version checkpoints, kept and restored from the History dialog
```

`project.json` holds the book title, the author, and the binder tree. Every part, chapter, scene, character, place, and note has one Markdown file named with its id: `documents/<id>.md`. The four shelves — Manuscript, Characters, Places, and Notes — are structural and do not have their own files.

```json
{
  "format": "gather-project",
  "version": 1,
  "title": "The Keep of Small Hours",
  "author": "N. Hale",
  "wordGoal": 30000,
  "threads": [{ "id": "6f0c2a10-1b2c-4d3e-8f01-000000000040", "name": "The slipped hour", "color": "#6e2e2e" }],
  "history": { "2026-01-08": 500 },
  "created": "2026-01-08T00:40:00.000Z",
  "modified": "2026-01-08T00:40:00.000Z",
  "binder": [
    {
      "id": "6f0c2a10-1b2c-4d3e-8f01-000000000001",
      "kind": "manuscript",
      "title": "Manuscript",
      "children": [
        {
          "id": "6f0c2a10-1b2c-4d3e-8f01-000000000003",
          "kind": "chapter",
          "title": "After Close",
          "children": [
            {
              "id": "6f0c2a10-1b2c-4d3e-8f01-000000000004",
              "kind": "scene",
              "title": "Keys"
            }
          ]
        }
      ]
    }
  ]
}
```

`wordGoal` is the manuscript goal shown in Stats. `threads` are color-coded plot threads you can tag scenes with. `history` is net words written per day, keyed like `"2026-01-08"`, which powers the streak and the seven-day chart. Gather prunes days that land back at zero, and none of these fields are required.

## Versions

The History button opens the project's version list. Two kinds of versions exist:

- **Automatic checkpoints.** Every time you open a project that changed since the last checkpoint, Gather keeps one. Open, write, close; reopen later and the whole session is a restore point.
- **Named versions.** "Keep a version now" adds one with a message, like a commit.

Storage is content-addressed and lives inside the project, so it stays local and travels with the folder:

```text
my-novel/
  history/
    versions.json          the manifest: id, date, message, and blob hash per page
    blobs/<sha256>.md       one file per unique page content, shared between versions
    blobs/<sha256>.json     the project.json content as of that version
```

Unchanged pages are stored once no matter how many versions reference them, and a page that existed in one version and not the next is recorded as deleted rather than forgotten. Pick a version to see which pages changed, click a page to see a line diff against the previous version, then restore that page or the whole project. Session data (`modified`, the daily word `history`) is excluded from version blobs, so restores never rewind your stats.

## Comments

Select text in the editor and press Comment. The comment stores the quoted excerpt, the author, and the date; replies thread under it; resolved comments fade but stay. Comments live in `comments.json` at the project root, so a co-writer who receives the folder (a sync drive, a zip, a USB stick) sees the same conversation. The Comments panel has a This page / All pages toggle for reviewing a manuscript.

Your display name for comments is asked in the panel and kept on this machine only.

## Shared folders

The project folder is the collaboration channel, so Gather watches it. When the window regains focus, it compares the folder against what it last saved:

- **Changed on disk, nothing unsaved here** — the project reloads on the spot, keeping your place, and a banner says so. A co-writer's edits in a shared Dropbox folder appear the moment you look.
- **Changed on disk, unsaved edits here** — Gather never clobbers your work. It tells you to save (Ctrl+S) and reopen to see the new state.
- **Conflicted copies** (the `Conflicted copy…` files sync services make) are counted and reported once; Gather always reads the main files, and its version history is the safety net.

## Installers and updates

```bash
npm run dist
```

packages the app into `apps/desktop/release/`: `Gather-Setup-1.1.0.exe` (NSIS installer that can install per-user without admin rights) and `Gather-Portable-1.1.0.exe` (a single portable executable).

On Windows, `dist` first runs `apps/desktop/scripts/prepare-win-codesign-cache.mjs`. electron-builder's tool archive contains two macOS symlinks that cannot extract without admin rights or Developer Mode; the script pre-populates the tool cache once (real file copies replace the symlinks) so packaging works on any machine. With Developer Mode enabled the script simply finds nothing to do.

The installed app checks GitHub Releases on launch, downloads newer versions in the background, and offers a restart when ready — Help → Check for Updates does it on demand. Running from source, the same menu item explains that updates apply to the installed app.

Publishing is one push: `.github/workflows/release.yml` builds, tests, packages, and publishes to GitHub Releases whenever you push a version tag (`git tag v1.1.1 && git push --tags`), using the workflow's built-in token — no local credentials needed.

**Code signing.** The builds above are unsigned, so Windows SmartScreen shows its "unknown publisher" warning on first run ("More info → Run anyway"). To sign instead: buy a Windows code-signing certificate (an OV cert for a named publisher, or an EV cert, which also builds SmartScreen reputation), then set two environment variables and build — no config change needed:

```powershell
$env:CSC_LINK = "path\to\certificate.pfx"   # or a base64 blob from a cloud token
$env:CSC_KEY_PASSWORD = "the passphrase"
npm run dist
```

electron-builder picks both up automatically and signs the installer and the app. Publishing unsigned installers works; the warning is the only cost.

A full project also has top-level `characters`, `places`, and `notes` shelves. Ids are UUIDs. Binder kinds:

| Kind | Role |
| --- | --- |
| `manuscript` | Root shelf. Holds parts and chapters. |
| `part` | A part. Holds chapters. Has a Markdown file. |
| `chapter` | A chapter. Holds scenes. Has a Markdown file. |
| `scene` | A scene. Has a Markdown file. |
| `characters` | Root shelf for character sheets. |
| `character` | A character sheet. |
| `places` | Root shelf for place sheets. |
| `place` | A place sheet. |
| `notes` | Root shelf for notes. |
| `note` | A note. |

Each document starts with a short header between `---` lines. Values are quoted. The prose, or the sheet notes, follows a blank line.

Scene, part, chapter, or note:

```markdown
---
title: "Keys"
kind: "scene"
status: "revised"
synopsis: "Leah locks the street door and finds the evening clerk’s note."
---

Leah Voss locked the street door at ten.
```

Character:

```markdown
---
title: "Leah Voss"
kind: "character"
status: "revised"
role: "Night librarian"
summary: "Keeps the library between close and open."
---

She counts the lamps when she is nervous.
```

Place sheets use `type` instead of `role`. Status is one of `idea`, `draft`, `revised`, or `done`. On open, Gather reads the title from the Markdown file back into the binder. You can edit these files by hand; keep the id in the filename and in `project.json` the same.

Scenes can also carry `pov` and `location` (character and place ids), `thread` (a thread id from `project.json`), and `day` (a story day like `"3"` or `"late evening"` — the timeline sorts numeric days first). Character sheets can carry `goal`, `fear`, and `secret`, plus one `link` line per relationship: `link: "<character id> <note>"`. Place sheets can carry `sense` and `control`. Chapters can carry `words`, a word goal for that chapter. Any other `key: "value"` line is kept as a custom field.

## Importing and backups

File → Import Manuscript reads a `.md` or `.txt` file and splits it by headings: one `#` makes a chapter, `##` makes a scene inside it, text before the first heading becomes an "Opening" chapter, and a file with no headings is split into scenes on blank gaps. The imported chapters are appended to the binder.

File → Back Up Project zips the entire project folder — every file, including versions and comments — into a single archive you choose. Unzip it anywhere and open it like any project.

## Export formats

Compile walks the manuscript in binder order. You choose which parts, chapters, and scenes to include. Unchecking a part or chapter clears everything inside it; you can check a scene again on its own. If any scene in a chapter is included, that chapter still starts a new page, and the chapter’s own text is included only when the chapter itself is checked.

The title page uses the project title and author (Project settings in the app).

The Formatting panel on the compile screen is the same for every format: print scene titles (off by default), number chapters ("Chapter 1 — Title"), number parts too ("Part I — …"), choose the scene separator (* * *, a blank line, or a rule), and include each scene's synopsis as a quoted block — the copy an editor would mark up.

| Format | What you get |
| --- | --- |
| Word | One `.docx` file. Real WordprocessingML with print-preset page size and margins, a title page, a contents list, and page breaks before parts and chapters. Markdown emphasis becomes bold and italic. |
| Markdown | One `.md` file. The book title is a heading, then the author. A horizontal rule marks the break before each part and chapter. Scene titles are smaller headings. |
| HTML | One self-contained `.html` file using the print preset below. Open it in a browser or print it. Chapters and parts start on a new page. |
| EPUB | An EPUB 3 file. The ZIP starts with `mimetype` stored uncompressed (`application/epub+zip`), then `META-INF/container.xml`, then an `OEBPS` package with `content.opf`, a CSS file, a title page, a nav document (`nav.xhtml`, declared `properties="nav"`), and one XHTML file per included part or chapter. |
| PDF | Written by Electron `printToPDF` from the same HTML as the HTML export. Page size comes from the preset. Margins are the CSS page margins, not an extra printer margin. |

Print presets:

| Preset | Page | Margins (top, right, bottom, left) |
| --- | --- | --- |
| 5 × 8 | 5 in × 8 in | 0.62 in, 0.58 in, 0.70 in, 0.72 in |
| 6 × 9 | 6 in × 9 in | 0.72 in, 0.64 in, 0.78 in, 0.84 in |
| US Letter | 8.5 in × 11 in | 1 in, 1 in, 1 in, 1.15 in |

EPUB is reflowable. The preset applies to PDF and HTML only.

## Layout

```text
apps/desktop          Electron, Vite, React, TypeScript
  src/shared          Model, Markdown, and compile logic
  src/main            Electron main process
  src/preload         Context bridge
  src/renderer        The studio UI
  e2e                 Playwright tests that drive the real app
apps/web              Vite, React, TypeScript marketing site
```

npm workspaces install from the repository root. Desktop bundles are written to `apps/desktop/out/`. The site build is `apps/web/dist/`. Neither is committed.

## Tests

Unit tests cover the Markdown header round-trip, project validation, binder operations (including every drag-and-drop rule), writing stats, the outliner and timeline, search, comment sanitizing, the line diff, the version store (real files in temp folders: dedupe, deletion tracking, corrupt manifests), and all five export formats down to ZIP byte structure:

```bash
npm run test
```

End-to-end tests build the app, launch the real Electron binary against a fixture project, and click through the studio — editing, autosave to disk, session history, theme toggling, the outliner, the corkboard, search, snapshots, duplication, the compile dialog, commenting on selected text (verified in `comments.json`), and keeping a named version then restoring an earlier page from it:

```bash
npm run test:e2e
```
