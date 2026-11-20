import { formatWords, projectStats } from '@shared/model'
import { useEffect } from 'react'
import { useStudio } from '../store'

export function StatsDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project

  useEffect(() => {
    if (!state.statsOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setStatsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.statsOpen, controller])

  if (!state.statsOpen || !project) return null

  const stats = projectStats(project, state.docs)
  const percent = stats.goal > 0 ? Math.min(100, Math.round((stats.total / stats.goal) * 100)) : 0
  const peak = Math.max(1, ...stats.last7.map((day) => day.words))
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="scrim" onClick={() => controller.setStatsOpen(false)}>
      <div
        className="dialog stats-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="stats-title">Writing stats</h2>
        <p>Net words added per day, kept in this project.</p>

        <div className="stats-big">
          <p className="stats-total">{formatWords(stats.total)}</p>
          <p className="stats-goal">
            {stats.goal > 0
              ? `of a ${stats.goal.toLocaleString('en-US')} word goal · ${percent}%`
              : 'in the manuscript. Set a goal in Project settings.'}
          </p>
          {stats.goal > 0 ? (
            <div className="goal-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </div>

        <dl className="stats-grid">
          <div>
            <dt>Today</dt>
            <dd>{formatWords(stats.today)}</dd>
          </div>
          <div>
            <dt>Streak</dt>
            <dd>
              {stats.streak === 0 ? '0 days' : `${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
            </dd>
          </div>
          <div>
            <dt>Scenes done</dt>
            <dd>
              {stats.scenesDone} / {stats.scenesTotal}
            </dd>
          </div>
        </dl>

        <div className="stats-week" aria-label="Words per day, last seven days">
          {stats.last7.map((day) => {
            const date = new Date(`${day.day}T00:00:00`)
            const height = day.words === 0 ? 0 : Math.max(6, Math.round((day.words / peak) * 100))
            return (
              <div key={day.day} className="stats-day">
                <span className="stats-bar" style={{ height: `${height}%` }} title={`${day.day}: ${day.words}`} />
                <span className="stats-day-label">{dayLabels[date.getDay()] ?? ''}</span>
              </div>
            )
          })}
        </div>

        <footer className="dialog-actions">
          <button type="button" className="btn" onClick={() => controller.setStatsOpen(false)}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
