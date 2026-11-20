export function App(): JSX.Element {
  return (
    <main>
      <header className="masthead">
        <p className="name">Gather</p>
        <nav className="masthead-links">
          <a href="#download">Download</a>
          <a href="https://github.com/SukrutN/gather">GitHub</a>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Free, open source, runs offline</p>
        <h1>
          Your novel stays in a folder on <em>your</em> computer.
        </h1>
        <div className="uneven">
          <div className="talk">
            <p className="lede">
              Gather is a word processor with a book-shaped filing system. Nothing is uploaded and there is no account:
              a project is a folder of Markdown files. If you delete Gather tomorrow, the manuscript is still readable
              in Notepad.
            </p>
            <p>It runs on Windows and costs nothing. It exports Word, Markdown, HTML, EPUB, and PDF.</p>
          </div>
          <figure className="excerpt">
            <blockquote>
              <p>
                Leah Voss locked the street door at ten, and the building waited to see if she meant it. Pier Street
                still had traffic. Inside, the lamps over the newspapers dropped to their night setting.
              </p>
            </blockquote>
            <figcaption>Opening of the sample project, The Keep of Small Hours.</figcaption>
          </figure>
        </div>
      </section>

      <section className="index-band">
        <p className="eyebrow light">What’s in it</p>
        <ol className="index">
          <li>
            <span className="index-number">01</span>
            <div>
              <h3>The binder</h3>
              <p>
                Parts, chapters, and scenes in a tree on the left, plus shelves for characters, places, and notes. Drag
                rows to reorder or nest them. Scenes can carry point of view, location, story day, and a plot thread.
              </p>
            </div>
          </li>
          <li>
            <span className="index-number">02</span>
            <div>
              <h3>The editor</h3>
              <p>
                A plain page with a title, a synopsis line, a status, and a live word count. Focus mode hides the rest
                of the app; there is a dark theme and typewriter scrolling for writing at night.
              </p>
            </div>
          </li>
          <li>
            <span className="index-number">03</span>
            <div>
              <h3>Ways to see the book</h3>
              <p>
                An outline of the whole manuscript, a timeline that sorts scenes by story day, a corkboard, and
                search across every file.
              </p>
            </div>
          </li>
          <li>
            <span className="index-number">04</span>
            <div>
              <h3>Versions</h3>
              <p>
                Gather saves a version whenever you reopen a project that changed, and you can save named ones at any
                time. Click a version to see which pages changed, compare a page line by line, and put it back.
              </p>
            </div>
          </li>
          <li>
            <span className="index-number">05</span>
            <div>
              <h3>Comments</h3>
              <p>
                Select text and leave a note, with replies and resolved states. Comments are stored inside the
                project folder, so they survive a sync drive, a zip, or a USB stick.
              </p>
            </div>
          </li>
          <li>
            <span className="index-number">06</span>
            <div>
              <h3>Export</h3>
              <p>
                One compile screen for Word, Markdown, HTML, EPUB, and PDF, with print presets for 5 × 8, 6 × 9, and
                US Letter.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="download" id="download">
        <p className="eyebrow">Download</p>
        <h2>Getting the app</h2>
        <div className="download-grid">
          <div className="download-card">
            <h3>Windows installer</h3>
            <p>
              Get <code>Gather-Setup.exe</code> from the releases page and run it. It installs for your user only, so
              there is no admin prompt, and the app checks for updates by itself.
            </p>
            <p>
              Windows will warn about an unknown publisher the first time, because the build is not code-signed yet.
              <code> More info → Run anyway</code> gets past it.
            </p>
            <a className="download-link" href="https://github.com/SukrutN/gather/releases/latest">
              Latest release ↗
            </a>
          </div>
          <div className="download-card">
            <h3>From source</h3>
            <p>Node 20.19 or newer, then:</p>
            <pre>
              <code>{`git clone https://github.com/SukrutN/gather.git
cd gather
npm install
npm run dev:desktop`}</code>
            </pre>
            <p className="fineprint">
              To package an installer yourself: <code>npm run dist</code>.
            </p>
          </div>
        </div>
      </section>

      <footer className="colophon">
        <span>Gather is free and open source.</span>
        <a href="https://github.com/SukrutN/gather">github.com/SukrutN/gather</a>
      </footer>
    </main>
  )
}
