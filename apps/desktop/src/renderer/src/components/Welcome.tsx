import { useStudio } from '../store'

export function Welcome(): JSX.Element {
  const { controller, state } = useStudio()
  const desktop = Boolean(window.gather)
  return (
    <section className="welcome">
      <p className="lede">Your novel stays in a folder on this computer.</p>
      {desktop ? (
        <div className="welcome-actions">
          {state.recent ? (
            <button className="btn" type="button" onClick={() => void controller.openRecent()}>
              Continue “{state.recent.title}”
            </button>
          ) : null}
          <button className={state.recent ? 'btn quiet' : 'btn'} type="button" onClick={() => void controller.newProject()}>
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
        <p className="lede">Open this in the Gather app.</p>
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
