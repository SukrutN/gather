import { canDelete, canMove, displayTitle, isContainer, kindLabel, moveNode } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useState } from 'react'
import { useStudio } from '../store'

type Placement = 'inside' | 'after'

interface Hint {
  id: string
  placement: Placement
}

const dragId = { current: null as string | null }

export function Binder(): JSX.Element | null {
  const { state, controller, choices } = useStudio()
  const [hint, setHint] = useState<Hint | null>(null)
  if (!state.project) return null
  const binder = state.project.binder
  const selected = state.selectedId
  const removable = selected ? canDelete(binder, selected) : false
  const up = selected ? canMove(binder, selected, -1) : false
  const down = selected ? canMove(binder, selected, 1) : false

  return (
    <aside className="binder">
      <div className="binder-label">Binder</div>
      <div className="binder-scroll" role="tree" aria-label="Binder">
        {binder.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} hint={hint} setHint={setHint} />
        ))}
      </div>
      <div className="binder-actions">
        {choices.map((choice) => (
          <button
            key={`${choice.parentId}-${choice.kind}`}
            className="btn small"
            type="button"
            onClick={() => controller.add(choice.parentId, choice.kind)}
          >
            {choice.label}
          </button>
        ))}
        <button className="btn small quiet" type="button" disabled={!up} onClick={() => selected && controller.move(selected, -1)}>
          Up
        </button>
        <button className="btn small quiet" type="button" disabled={!down} onClick={() => selected && controller.move(selected, 1)}>
          Down
        </button>
        <button
          className="btn small quiet"
          type="button"
          disabled={!removable}
          onClick={() => selected && controller.duplicate(selected)}
        >
          Duplicate
        </button>
        <button className="btn small danger" type="button" disabled={!removable} onClick={() => selected && controller.askDelete(selected)}>
          Remove
        </button>
      </div>
    </aside>
  )
}

function TreeRow({
  node,
  depth,
  hint,
  setHint,
}: {
  node: BinderNode
  depth: number
  hint: Hint | null
  setHint: (hint: Hint | null) => void
}): JSX.Element {
  const { state, controller } = useStudio()
  const selected = state.selectedId === node.id
  const container = isContainer(node.kind)
  const collapsed = Boolean(state.collapsed[node.id])
  const placement: Placement = container ? 'inside' : 'after'
  const dropInside = hint?.id === node.id && hint.placement === 'inside'
  const dropAfter = hint?.id === node.id && hint.placement === 'after'

  const accepts = (source: string): boolean => {
    if (!state.project || source === node.id) return false
    return moveNode(state.project.binder, source, node.id, placement) !== state.project.binder
  }

  const classes = ['row']
  if (selected) classes.push('selected')
  if (dropInside) classes.push('drop-inside')
  if (dropAfter) classes.push('drop-after')

  return (
    <div className="tree-branch">
      <div
        className={classes.join(' ')}
        style={{ paddingLeft: 8 + depth * 14 }}
        data-kind={node.kind}
        draggable
        onDragStart={(event) => {
          dragId.current = node.id
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', node.id)
        }}
        onDragEnd={() => {
          dragId.current = null
          setHint(null)
        }}
        onDragOver={(event) => {
          const source = dragId.current
          if (!source || !accepts(source)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          if (hint?.id !== node.id) setHint({ id: node.id, placement })
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget
          if (next instanceof Node && event.currentTarget.contains(next)) return
          if (hint?.id === node.id) setHint(null)
        }}
        onDrop={(event) => {
          event.preventDefault()
          const source = dragId.current
          if (source && accepts(source)) controller.reorder(source, node.id, placement)
          dragId.current = null
          setHint(null)
        }}
      >
        {container ? (
          <button
            className="twist"
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${displayTitle(node.title)}` : `Collapse ${displayTitle(node.title)}`}
            onClick={() => controller.toggleCollapse(node.id)}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="twist spacer" aria-hidden="true" />
        )}
        <button
          className="row-name"
          type="button"
          aria-current={selected ? 'true' : undefined}
          onClick={() => controller.select(node.id)}
        >
          <span className="row-title">{displayTitle(node.title)}</span>
          <span className="row-kind">{kindLabel(node.kind)}</span>
        </button>
      </div>
      {container && !collapsed
        ? (node.children ?? []).map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} hint={hint} setHint={setHint} />
          ))
        : null}
    </div>
  )
}
