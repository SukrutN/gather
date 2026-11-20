import { findNode } from '@shared/model'
import type { Comment } from '@shared/types'
import { useEffect, useState } from 'react'
import { useStudio } from '../store'

type Scope = 'doc' | 'all'

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CommentsPanel(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  const [scope, setScope] = useState<Scope>('doc')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [draftBody, setDraftBody] = useState('')

  useEffect(() => {
    if (!state.commentsOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setCommentsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.commentsOpen, controller])

  if (!project) return null
  const selected = state.selectedId
  const visible = state.comments.filter((comment) =>
    scope === 'doc' ? comment.docId === selected : true,
  )
  const unresolved = state.comments.filter((comment) => !comment.resolved).length
  const sorted = [...visible].sort(
    (a, b) => Number(a.resolved) - Number(b.resolved) || b.savedAt.localeCompare(a.savedAt),
  )
  const draft =
    state.commentDraft && (!selected || state.commentDraft.docId === selected) ? state.commentDraft : null
  const pageName = (docId: string): string => {
    const node = findNode(project.binder, docId)
    return node ? node.title : 'Deleted page'
  }

  const sendReply = (commentId: string): void => {
    const text = replyText.trim()
    if (!text) return
    controller.replyTo(commentId, text)
    setReplyFor(null)
    setReplyText('')
  }

  return (
    <aside className="inspector comments-panel" aria-label="Comments">
      <div className="comments-head">
        <div className="inspector-label">Comments{unresolved ? ` (${unresolved})` : ''}</div>
        <button className="btn small quiet" type="button" onClick={() => controller.setCommentsOpen(false)}>
          Close
        </button>
      </div>
      <div className="inspector-scroll">
        <div className="segmented comments-scope" role="group" aria-label="Comment scope">
          <button type="button" className={scope === 'doc' ? 'on' : ''} onClick={() => setScope('doc')}>
            This page
          </button>
          <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>
            All pages
          </button>
        </div>

        <label className="inspector-field">
          <span>Your name</span>
          <input
            value={state.author}
            placeholder="How comments are signed"
            onChange={(event) => controller.setAuthor(event.target.value)}
          />
        </label>

        {draft ? (
          <div className="comment-draft">
            {draft.excerpt ? <blockquote>{draft.excerpt}</blockquote> : <p className="hint">On the whole page.</p>}
            <textarea
              rows={3}
              value={draftBody}
              placeholder="Write the comment."
              autoFocus
              onChange={(event) => setDraftBody(event.target.value)}
            />
            <div className="comment-actions">
              <button
                className="btn small"
                type="button"
                disabled={!draftBody.trim()}
                onClick={() => {
                  controller.addComment(draftBody)
                  setDraftBody('')
                }}
              >
                Comment
              </button>
              <button
                className="btn small quiet"
                type="button"
                onClick={() => {
                  controller.cancelComment()
                  setDraftBody('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <p className="hint">No comments{scope === 'doc' ? ' on this page' : ''} yet. Select text and press Comment.</p>
        ) : (
          sorted.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              pageName={scope === 'all' ? pageName(comment.docId) : null}
              replyFor={replyFor}
              replyText={replyText}
              pendingDelete={pendingDelete}
              onReplyText={setReplyText}
              onSendReply={sendReply}
              onCancelReply={() => {
                setReplyFor(null)
                setReplyText('')
              }}
              onAskReply={() => {
                setReplyFor(comment.id)
                setReplyText('')
              }}
              onResolve={() => controller.toggleResolved(comment.id)}
              onAskDelete={() => setPendingDelete(comment.id)}
              onDelete={() => {
                controller.deleteComment(comment.id)
                setPendingDelete(null)
              }}
              onKeepDelete={() => setPendingDelete(null)}
              onJump={scope === 'all' ? () => controller.select(comment.docId) : undefined}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function CommentCard({
  comment,
  pageName,
  replyFor,
  replyText,
  pendingDelete,
  onReplyText,
  onSendReply,
  onCancelReply,
  onAskReply,
  onResolve,
  onAskDelete,
  onDelete,
  onKeepDelete,
  onJump,
}: {
  comment: Comment
  pageName: string | null
  replyFor: string | null
  replyText: string
  pendingDelete: string | null
  onReplyText: (text: string) => void
  onSendReply: (commentId: string) => void
  onCancelReply: () => void
  onAskReply: () => void
  onResolve: () => void
  onAskDelete: () => void
  onDelete: () => void
  onKeepDelete: () => void
  onJump: (() => void) | undefined
}): JSX.Element {
  return (
    <article className={comment.resolved ? 'comment-card resolved' : 'comment-card'}>
      <header>
        <strong>{comment.author}</strong>
        <span>{formatTime(comment.savedAt)}</span>
        {onJump && pageName ? (
          <button className="btn small quiet" type="button" onClick={onJump}>
            {pageName}
          </button>
        ) : null}
      </header>
      {comment.excerpt ? <blockquote>{comment.excerpt}</blockquote> : null}
      <p>{comment.body}</p>
      {comment.replies.map((reply) => (
        <div className="comment-reply" key={reply.id}>
          <strong>{reply.author}</strong>
          <span>{formatTime(reply.savedAt)}</span>
          <p>{reply.body}</p>
        </div>
      ))}
      <div className="comment-actions">
        {replyFor === comment.id ? (
          <>
            <input
              value={replyText}
              placeholder="Reply…"
              autoFocus
              onChange={(event) => onReplyText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSendReply(comment.id)
                if (event.key === 'Escape') onCancelReply()
              }}
            />
            <button className="btn small" type="button" disabled={!replyText.trim()} onClick={() => onSendReply(comment.id)}>
              Send
            </button>
            <button className="btn small quiet" type="button" onClick={onCancelReply}>
              Don’t
            </button>
          </>
        ) : (
          <>
            <button className="btn small quiet" type="button" onClick={onAskReply}>
              Reply
            </button>
            <button className="btn small quiet" type="button" onClick={onResolve}>
              {comment.resolved ? 'Reopen' : 'Resolve'}
            </button>
            {pendingDelete === comment.id ? (
              <>
                <button className="btn small danger" type="button" onClick={onDelete}>
                  Delete it
                </button>
                <button className="btn small quiet" type="button" onClick={onKeepDelete}>
                  Keep
                </button>
              </>
            ) : (
              <button
                className="btn small danger"
                type="button"
                aria-label="Delete comment"
                onClick={onAskDelete}
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}
