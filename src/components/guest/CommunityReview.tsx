import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Flag, MessagesSquare } from 'lucide-react';
import { forumService } from '../../services';
import type { ForumAction, ForumReviewItem } from '../../services/guest/forum';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatShortInstant } from '../../lib/format';
import { EmptyState, LoadError, Skeleton } from '../ui/Card';
import { StaffMark } from './forumUi';

/**
 * Staff, on the Guest page: the community posts and comments people reported, and what is hidden.
 * Hide or keep (dismiss) closes the reports; anything hidden can be shown again.
 */
export function CommunityReview() {
  const data = useAsyncData(useCallback(() => forumService.review(), []));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (i: ForumReviewItem, a: ForumAction) => {
    setBusy(i.id);
    setError(null);
    try {
      await forumService.moderate(i.kind, i.id, a);
      data.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  if (data.status === 'loading') return <Skeleton className="h-64" />;
  if (data.status === 'error') return <LoadError message={data.error.message} onRetry={data.reload} />;
  const reported = data.data.filter((i) => i.openReports > 0);
  const hidden = data.data.filter((i) => i.openReports === 0 && i.hidden);

  const row = (i: ForumReviewItem) => (
    <li key={`${i.kind}-${i.id}`} className="flex flex-col gap-2 py-4">
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
        <span className="font-semibold text-ink">{i.authorName}</span>
        {i.authorStaff && <StaffMark />}
        <span aria-hidden>·</span>
        {i.kind === 'post' ? 'Post' : 'Comment'}
        <span aria-hidden>·</span>
        {formatShortInstant(i.createdAt)}
        {i.hidden && (
          <span className="ml-1 font-semibold text-status-low">
            Hidden{i.hiddenReason ? `: ${i.hiddenReason.toLowerCase()}` : ''}
          </span>
        )}
      </p>
      {i.kind === 'post' ? (
        <p className="font-semibold text-ink">{i.title}</p>
      ) : (
        <p className="text-xs text-muted">
          On <span className="font-semibold text-ink-soft">{i.title}</span>
        </p>
      )}
      {i.body && <p className="line-clamp-4 whitespace-pre-wrap text-sm text-ink-soft">{i.body}</p>}
      {i.openReports > 0 && (
        <p className="flex items-start gap-2 text-sm text-status-out">
          <Flag className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {i.openReports === 1 ? '1 report' : `${i.openReports} reports`}
            {i.reasons.length > 0 && <span className="text-ink-soft">: {i.reasons.slice(0, 3).join('; ')}</span>}
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {i.hidden ? (
          <button type="button" className="chip gap-1.5" disabled={busy === i.id} onClick={() => void act(i, 'unhide')}>
            <Eye className="h-4 w-4" aria-hidden /> Show it again
          </button>
        ) : (
          <button type="button" className="chip gap-1.5" disabled={busy === i.id} onClick={() => void act(i, 'hide')}>
            <EyeOff className="h-4 w-4" aria-hidden /> Hide it
          </button>
        )}
        {i.openReports > 0 && (
          <button type="button" className="chip" disabled={busy === i.id} onClick={() => void act(i, 'dismiss')}>
            {i.hidden ? 'Keep it hidden' : 'It’s fine, keep it'}
          </button>
        )}
        <Link to={`/guest/post?id=${encodeURIComponent(i.postId)}`} className="link text-sm">
          Open the post
        </Link>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-soft">
        Guests post, comment and upvote in the community on the guest page. Posts show at once; anything three people report is hidden until you look. You can also hide, pin and unpin from a post on the guest page itself.
      </p>
      {error && (
        <p role="alert" className="text-sm text-status-out">
          {error}
        </p>
      )}
      <section aria-labelledby="review-reported">
        <h2 id="review-reported" className="text-base font-bold text-ink">
          Reported {reported.length > 0 && <span className="tabular-nums text-muted">({reported.length})</span>}
        </h2>
        {reported.length ? (
          <ul className="divide-y divide-line/70 border-b border-line/70">{reported.map(row)}</ul>
        ) : (
          <EmptyState icon={MessagesSquare} title="Nothing reported">
            When someone reports a post or comment, it shows here.
          </EmptyState>
        )}
      </section>
      {hidden.length > 0 && (
        <section aria-labelledby="review-hidden">
          <h2 id="review-hidden" className="text-base font-bold text-ink">
            Hidden <span className="tabular-nums text-muted">({hidden.length})</span>
          </h2>
          <ul className="divide-y divide-line/70 border-b border-line/70">{hidden.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
