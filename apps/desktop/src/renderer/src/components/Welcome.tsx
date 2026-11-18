import { useStudio } from '../store'

export function Welcome(): JSX.Element {
  const { controller, state } = useStudio()
  const desktop = Boolean(window.gather)
  return (
    <section className="welcome">
      <p className="eyebrow">A local-first novel studio</p>
      <h1>Gather</h1>
      <p className="lede">
        The manuscript stays in a folder you choose. Ordinary files, no account, and the desk works when the network does
        not.
      </p>
      {desktop ? (
        <div className="welcome-actions">
          <button className="btn" type="button" onClick={() => void controller.newProject()}>
            New project
          </button>
          <button className="btn quiet" type="button" onClick={() => void controller.openProject()}>
            Open project
          </button>
          <button className="btn quiet" type="button" onClick={() => void controller.openSample()}>
            Open sample
          </button>
        </div>
      ) : (
        <p className="lede">Open Gather from the desktop app. This page is the studio, not a browser site.</p>
      )}
      {state.banner ? (
        <p className="banner" role="alert">
          {state.banner}
          <button type="button" onClick={controller.dismissBanner}>
            Dismiss
          </button>
        </p>
      ) : null}
    </section>
  )
}
