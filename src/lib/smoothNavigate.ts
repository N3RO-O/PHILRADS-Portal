import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateOptions } from 'react-router-dom';

type WithTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Go to a page with a short cross-fade of the page area (the menu and top bar stay put): used when a
 * notification, toast or release note takes you somewhere. Plain navigation where the browser has no
 * view transitions or the person prefers less motion. The look: "page" in src/index.css.
 * `then` runs right after the move, in the same step: close the sheet or menu the link sat in there
 * (closing it first would unmount the caller, and React Router ignores a navigate from there).
 */
export function useSmoothNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions, then?: () => void) => {
      const doc = document as WithTransitions;
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const move = () => {
        navigate(to, options);
        then?.();
      };
      if (calm || !doc.startViewTransition) {
        move();
        return;
      }
      doc.startViewTransition(() => flushSync(move));
    },
    [navigate],
  );
}
