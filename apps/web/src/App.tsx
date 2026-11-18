const presets = [
  { name: '5 × 8', detail: 'Small paperback', width: 5, height: 8 },
  { name: '6 × 9', detail: 'Trade paperback', width: 6, height: 9 },
  { name: 'US Letter', detail: '8.5 × 11', width: 8.5, height: 11 },
]

export function App(): JSX.Element {
  return (
    <>
      <a className="skip" href="#jobs">
        Skip to the three jobs
      </a>
      <div className="spine" aria-hidden="true">
        <span>Gather</span>
      </div>
      <header className="running">
        <span>A local-first novel studio</span>
        <a href="#download">Run it locally</a>
      </header>
      <main>
        <section className="hero">
          <p className="rubric">Volume 01 — The folder is the book</p>
          <h1>Gather</h1>
          <p className="lede">
            Keep a long manuscript organized, draft in a clean editor, and format ebook and print from the same project.
            Gather never asks for an account. The novel lives in a folder on your machine.
          </p>
        </section>

        <section className="jobs" id="jobs">
          <h2>Three jobs</h2>
          <ol>
            <li>
              <span className="numeral">I</span>
              <div>
                <h3>Keep a long manuscript organized</h3>
                <p>
                  Parts, chapters, and scenes stay in a binder you can add to, rename, delete, and reorder. Characters,
                  places, and notes sit on shelves beside the draft, not in another application.
                </p>
              </div>
            </li>
            <li>
              <span className="numeral">II</span>
              <div>
                <h3>Draft in a clean editor</h3>
                <p>
                  A page for the sentence in front of you: title, synopsis, a status from idea to done, and a live word
                  count. Focus mode puts the binder away.
                </p>
              </div>
            </li>
            <li>
              <span className="numeral">III</span>
              <div>
                <h3>Format ebook and print from the same project</h3>
                <p>
                  Choose the manuscript items that belong in this version. They export in binder order as Markdown, HTML,
                  EPUB, or PDF, with a title page taken from the project.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="chapter" id="binder">
          <p className="rubric">01</p>
          <h2>The binder</h2>
          <div className="split">
            <p>
              The binder is the book’s order, written down. Manuscript holds parts, chapters, and scenes. Three more
              shelves — Characters, Places, and Notes — keep the world within reach of the draft. Move a chapter and the
              compile order moves with it.
            </p>
            <ol className="binder-sketch" aria-hidden="true">
              <li className="root">Manuscript</li>
              <li>The Night Stack</li>
              <li className="deep">After Close</li>
              <li className="deeper">Keys</li>
              <li className="deeper">The Drawer</li>
              <li className="root">Characters</li>
              <li className="root">Places</li>
              <li className="root">Notes</li>
            </ol>
          </div>
        </section>

        <section className="chapter" id="corkboard">
          <p className="rubric">02</p>
          <h2>The corkboard</h2>
          <p>
            Scenes become cards: a title, a synopsis, and a status. Idea, draft, revised, done. The board follows the
            chapter or part you have selected. Click a card and you are in that scene.
          </p>
          <div className="cards">
            <article>
              <span>Revised</span>
              <h3>Keys</h3>
              <p>Leah locks the street door and finds the evening clerk’s note.</p>
            </article>
            <article>
              <span>Draft</span>
              <h3>The Drawer</h3>
              <p>A catalog drawer is labeled with hours instead of letters.</p>
            </article>
            <article>
              <span>Idea</span>
              <h3>The Slip</h3>
              <p>Mr. Adel has already signed for a book that was never lent.</p>
            </article>
          </div>
        </section>

        <section className="chapter" id="notes">
          <p className="rubric">03</p>
          <h2>Notes, people, places</h2>
          <div className="split sheets">
            <article>
              <p className="rubric">Character</p>
              <h3>Leah Voss</h3>
              <dl>
                <div>
                  <dt>Role</dt>
                  <dd>Night librarian</dd>
                </div>
                <div>
                  <dt>Summary</dt>
                  <dd>Keeps the library between close and open, and suspects the catalog is keeping her.</dd>
                </div>
              </dl>
            </article>
            <article>
              <p className="rubric">Place</p>
              <h3>Pier Street Library</h3>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>Civic building</dd>
                </div>
                <div>
                  <dt>Summary</dt>
                  <dd>Too large for the town, and too loved to close.</dd>
                </div>
              </dl>
            </article>
          </div>
          <p>
            Character sheets keep a name, a role, a summary, and notes. Place sheets keep a type instead of a role.
            Research notes use the same quiet editor as a scene: title, synopsis, status, and a page to write on.
          </p>
        </section>

        <section className="chapter" id="compile">
          <p className="rubric">04</p>
          <h2>Compile</h2>
          <p>
            One project, four copies. Markdown for the plain text. HTML you can open or print. EPUB for readers. PDF for
            the page, made by the desktop app itself. Each print preset sets the page size and the margins. The title
            page uses the title and author from project settings, and every chapter starts on a new page.
          </p>
          <div className="specimens">
            {presets.map((preset) => (
              <figure key={preset.name}>
                <div
                  className="page"
                  style={{
                    width: `${preset.width * 18}px`,
                    height: `${preset.height * 18}px`,
                  }}
                >
                  <strong>Title</strong>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <figcaption>
                  <b>{preset.name}</b>
                  <span>{preset.detail}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="colophon" id="download">
          <p className="rubric">Colophon</p>
          <h2>Run Gather on your machine</h2>
          <p>
            There is no hosted editor and no price. Clone the repository, install, and open the studio. The marketing
            site is the same repository.
          </p>
          <p>
            <a href="https://github.com/SukrutN/gather">github.com/SukrutN/gather</a>
          </p>
          <pre>
            <code>{`git clone https://github.com/SukrutN/gather.git
cd gather
npm install
npm run dev:desktop`}</code>
          </pre>
          <p className="site-cmd">
            The site you are reading: <code>npm run dev:web</code>
          </p>
        </section>
      </main>
    </>
  )
}
