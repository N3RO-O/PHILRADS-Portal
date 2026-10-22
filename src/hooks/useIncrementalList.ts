import { useEffect, useRef, useState } from 'react';

/**
 * Render long lists in pages as the user scrolls (infinite scroll), so phones never
 * lay out thousands of rows at once. `resetKey` starts again from the first page
 * whenever filters or sorting change.
 */
export function useIncrementalList<T>(items: T[], resetKey: string, pageSize = 40) {
  const [count, setCount] = useState(pageSize);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => setCount(pageSize), [resetKey, pageSize]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(c + pageSize, items.length));
      },
      // Start loading well before the end is visible, so scrolling never hits a wall.
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, items.length, pageSize]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    sentinel,
    showMore: () => setCount((c) => Math.min(c + pageSize, items.length)),
  };
}
