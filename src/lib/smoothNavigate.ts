import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateOptions } from 'react-router-dom';

type WithTransitions = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Go to a page with a short cross-fade of the page area (the menu and top bar stay put): used when a
 * notification, toast or release note takes you somewhere. Plain navigation where the browser has no
 * view transitions or the person prefers less motion. The look: "page" in src/index.css.
 */
export function useSmoothNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      const doc = document as WithTransitions;
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (calm || !doc.startViewTransition) {
        navigate(to, options);
        return;
      }
      doc.startViewTransition(() => flushSync(() => navigate(to, options)));
    },
    [navigate],
  );
}
