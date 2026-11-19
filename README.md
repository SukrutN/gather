# Gather

Marketing site: https://sukrutn.github.io/gather/

Gather is a local-first novel studio. A project is a folder of ordinary files on your machine. There is no account, no sync, and no hosted editor. The desktop app works offline. This repository also contains the marketing site.

Gather does three jobs:

- Keep a long manuscript organized in a binder of parts, chapters, and scenes, with shelves for characters, places, and notes.
- Draft in a clean editor with a title, synopsis, status, live word count, and a focus mode that hides the binder.
- Format ebook and print from the same project: Markdown, HTML, EPUB, and PDF.

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

## Project folder

A Gather project is a directory:

```text
my-novel/
  project.json
  documents/
    6f0c2a10-1b2c-4d3e-8f01-000000000004.md
```

`project.json` holds the book title, the author, and the binder tree. Every part, chapter, scene, character, place, and note has one Markdown file named with its id: `documents/<id>.md`. The four shelves — Manuscript, Characters, Places, and Notes — are structural and do not have their own files.

```json
{
  "format": "gather-project",
  "version": 1,
  "title": "The Keep of Small Hours",
  "author": "N. Hale",
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

## Export formats

Compile walks the manuscript in binder order. You choose which parts, chapters, and scenes to include. Unchecking a part or chapter clears everything inside it; you can check a scene again on its own. If any scene in a chapter is included, that chapter still starts a new page, and the chapter’s own text is included only when the chapter itself is checked.

The title page uses the project title and author (Project settings in the app).

| Format | What you get |
| --- | --- |
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
apps/desktop    Electron, Vite, React, TypeScript
apps/web        Vite, React, TypeScript marketing site
```

npm workspaces install from the repository root. Desktop bundles are written to `apps/desktop/out/`. The site build is `apps/web/dist/`. Neither is committed.
