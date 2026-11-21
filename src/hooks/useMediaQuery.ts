import { useEffect, useState } from 'react';

/**
 * 订阅一个媒体查询。首页用它决定"参考图舞台"还是"竖版布局"，
 * 两套布局共用同一个 Globe，所以不能只靠 CSS 显隐，必须由 React 选一棵树。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
