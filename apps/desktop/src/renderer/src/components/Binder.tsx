import {
  addChoicesForSelection,
  canDelete,
  canMove,
  displayTitle,
  isContainer,
  isRootKind,
  kindLabel,
  moveNode,
} from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useEffect, useState } from 'react'
import { useStudio } from '../store'

type Placement = 'inside' | 'after'

interface Hint {
  id: string
  placement: Placement
}

type Menu = { kind: 'add' | 'row'; id: string } | null

const dragId = { current: null as string | null }

export function Binder(): JSX.Element | null {
  const { state } = useStudio()
  const [hint, setHint] = useState<Hint | null>(null)
  const [menu, setMenu] = useState<Menu>(null)

  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null)
    }
    const onDown = (event: MouseEvent): void => {
      const target = event.target
      if (
        target instanceof Element &&
        (target.closest('.row-actions') || target.closest('.menu-popover'))
      ) {
        return
      }
      setMenu(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [menu])

  if (!state.project) return null

  return (
    <aside className="binder">
      <div className="binder-label">Binder</div>
      <div className="binder-scroll" role="tree" aria-label="Binder">
        {state.project.binder.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} hint={hint} setHint={setHint} menu={menu} setMenu={setMenu} />
        ))}
      </div>
    </aside>
  )
}

function TreeRow({
  node,
  depth,
  hint,
  setHint,
  menu,
  setMenu,
}: {
  node: BinderNode
  depth: number
  hint: Hint | null
  setHint: (hint: Hint | null) => void
  menu: Menu
  setMenu: (menu: Menu) => void
}): JSX.Element {
  const { state, controller } = useStudio()
  const selected = state.selectedId === node.id
  const container = isContainer(node.kind)
  const collapsed = Boolean(state.collapsed[node.id])
  const root = isRootKind(node.kind)
  const binder = state.project?.binder ?? []
  const choices = addChoicesForSelection(binder, node.id)
  const placement: Placement = container ? 'inside' : 'after'
  const removable = canDelete(binder, node.id)
  const duplicable = removable && node.kind !== 'file'
  const up = canMove(binder, node.id, -1)
  const down = canMove(binder, node.id, 1)
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

  const title = displayTitle(node.title)
  const addOpen = menu?.kind === 'add' && menu.id === node.id
  const rowOpen = menu?.kind === 'row' && menu.id === node.id

  return (
    <div className="tree-branch">
      <div
        className={classes.join(' ')}
        style={{ paddingLeft: 8 + depth * 14 }}
        data-kind={node.kind}
        draggable
        title="Drag to move"
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
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
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
          <span className="row-title">{title}</span>
          <span className="row-kind">{kindLabel(node.kind)}</span>
        </button>
        <span className="row-actions">
          <button
            className="row-action"
            type="button"
            aria-label={`Add near ${title}`}
            disabled={choices.length === 0}
            onClick={() => setMenu(addOpen ? null : { kind: 'add', id: node.id })}
          >
            +
          </button>
          {root ? null : (
            <button
              className="row-action"
              type="button"
              aria-label={`Row actions for ${title}`}
              onClick={() => setMenu(rowOpen ? null : { kind: 'row', id: node.id })}
            >
              ⋯
            </button>
          )}
        </span>
        {addOpen ? (
          <div className="menu-popover row-menu" role="menu" aria-label="Add">
            {choices.map((choice) => (
              <button
                key={`${choice.parentId}-${choice.kind}`}
                type="button"
                role="menuitem"
                onClick={() => {
                  controller.add(choice.parentId, choice.kind)
                  setMenu(null)
                }}
              >
                <span>{choice.label}</span>
                <span className="menu-check" />
              </button>
            ))}
          </div>
        ) : null}
        {rowOpen ? (
          <div className="menu-popover row-menu" role="menu" aria-label="Row actions">
            <button type="button" role="menuitem" disabled={!up} onClick={() => { controller.move(node.id, -1); setMenu(null) }}>
              <span>Move up</span>
              <span className="menu-check" />
            </button>
            <button type="button" role="menuitem" disabled={!down} onClick={() => { controller.move(node.id, 1); setMenu(null) }}>
              <span>Move down</span>
              <span className="menu-check" />
            </button>
            <button type="button" role="menuitem" disabled={!duplicable} onClick={() => { controller.duplicate(node.id); setMenu(null) }}>
              <span>Duplicate</span>
              <span className="menu-check" />
            </button>
            <div className="menu-separator" />
            <button
              type="button"
              role="menuitem"
              className="danger"
              disabled={!removable}
              onClick={() => {
                controller.askDelete(node.id)
                setMenu(null)
              }}
            >
              <span>Remove…</span>
              <span className="menu-check" />
            </button>
          </div>
        ) : null}
      </div>
      {container && !collapsed
        ? (node.children ?? []).map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} hint={hint} setHint={setHint} menu={menu} setMenu={setMenu} />
          ))
        : null}
    </div>
  )
}
