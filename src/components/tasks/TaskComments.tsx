import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { timeAgo } from '../../lib/geo';
import { taskExtras } from '../../services';
import { COMMENT_MAX, type TaskComment } from '../../services/tasks/taskExtras';
import type { Task } from '../../services/tasks/types';
import { PersonAvatar } from '../ui/PersonAvatar';

/**
 * A short conversation on a task, between the person who gave it and the person doing it (anyone who
 * can see the task can join in). The other person hears about each comment in the bell.
 */
export function TaskComments({ task, me }: { task: Task; me: string | null }) {
  const uid = useId();
  const [list, setList] = useState<TaskComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setList(null);
    setError(null);
    taskExtras
      .comments(task.id)
      .then((c) => live && setList(c))
      .catch((e: Error) => {
        if (!live) return;
        setList([]);
        setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [task.id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const c = await taskExtras.addComment(task.id, text);
      setList((l) => [...(l ?? []), c]);
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (c: TaskComment) => {
    setList((l) => l?.filter((x) => x.id !== c.id) ?? null);
    try {
      await taskExtras.removeComment(c.id);
    } catch (e) {
      setList((l) => [...(l ?? []), c].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setError((e as Error).message);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter starts a new line. (Inside the task form, so Enter must not save it.)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };
  const other =
    me && task.createdById === me && task.assigneeId && task.assigneeId !== me
      ? task.assigneeName?.split(' ')[0]
      : me && task.assigneeId === me && task.createdById && task.createdById !== me
        ? task.createdByName?.split(' ')[0]
        : null;
  const role = (c: TaskComment) => (c.authorId && c.authorId === task.createdById && task.createdById !== task.assigneeId ? 'Gave this task' : null);

  return (
    <section className="flex flex-col gap-2" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="flex items-center gap-2 text-sm font-semibold text-ink">
        <MessageSquare className="h-4 w-4 text-ink-soft" aria-hidden />
        Comments
        {list && list.length > 0 && <span className="text-xs font-medium text-muted">{list.length}</span>}
      </h3>

      {list === null ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading comments…
        </p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted">{other ? `No comments yet. Ask ${other} a question or share an update.` : 'No comments yet. Ask a question or share an update.'}</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {list.map((c) => (
            <li key={c.id} className="group flex items-start gap-2.5 animate-fade-in">
              <PersonAvatar id={c.authorId} name={c.authorName} size="xs" frame={false} />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface-sunken px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold text-ink">{c.authorId === me ? 'You' : c.authorName}</span>
                  {role(c) && <span className="text-muted">{role(c)}</span>}
                  <time className="text-muted" dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
                    {timeAgo(c.createdAt)}
                  </time>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-soft">{c.body}</p>
              </div>
              {c.authorId === me && (
                <button
                  type="button"
                  className="icon-btn h-8 w-8 shrink-0 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Delete your comment"
                  title="Delete"
                  onClick={() => void remove(c)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-end gap-2">
        <label htmlFor={`${uid}-new`} className="sr-only">
          Write a comment
        </label>
        <textarea
          id={`${uid}-new`}
          className="field min-h-10 resize-none py-2"
          rows={1}
          value={draft}
          maxLength={COMMENT_MAX}
          placeholder={other ? `Write to ${other}…` : 'Write a comment…'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <button type="button" className="btn-primary h-10 shrink-0 px-3" onClick={() => void send()} disabled={!draft.trim() || busy} aria-label="Send comment">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose">
          {error}
        </p>
      )}
    </section>
  );
}
