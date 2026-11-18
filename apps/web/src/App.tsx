export function App(): JSX.Element {
  return (
    <main>
      <p className="name">Gather</p>
      <h1>Your novel stays in a folder on your computer.</h1>
      <div className="uneven">
        <div className="talk">
          <p>
            You line the book up in a binder, write in a plain editor, and export Markdown, HTML, EPUB, or PDF from the
            same project. No account, and it works offline.
          </p>
          <p>There’s a corkboard for scenes, and pages for characters, places, and notes.</p>
          <p>
            <a href="https://github.com/SukrutN/gather">github.com/SukrutN/gather</a>
          </p>
        </div>
        <figure className="excerpt">
          <blockquote>
            <p>
              Leah Voss locked the street door at ten, and the building waited to see if she meant it. Pier Street still
              had traffic. Inside, the lamps over the newspapers dropped to their night setting.
            </p>
          </blockquote>
          <figcaption>Opening of the sample project, The Keep of Small Hours.</figcaption>
        </figure>
      </div>
      <section className="run" id="download">
        <h2>To run it</h2>
        <pre>
          <code>{`git clone https://github.com/SukrutN/gather.git
cd gather
npm install
npm run dev:desktop`}</code>
        </pre>
        <p>
          This page: <code>npm run dev:web</code>
        </p>
      </section>
    </main>
  )
}
