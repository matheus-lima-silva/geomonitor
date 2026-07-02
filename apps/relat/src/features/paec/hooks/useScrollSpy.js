// Scroll-spy do editor: a secao cujo topo passou de scrollTop + threshold
// vira ativa. Rola o CONTAINER (nao scrollIntoView — o shell e de scroll
// interno). Copia local do hook do monthly-report (features autocontidas).

import { useCallback, useEffect, useState } from 'react';

const THRESHOLD_PX = 120;

export function useScrollSpy(containerRef, sectionIds) {
  const [activeId, setActiveId] = useState(sectionIds[0]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onScroll = () => {
      const anchor = container.scrollTop + THRESHOLD_PX;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = container.querySelector(`#${id}`);
        if (el && el.offsetTop - container.offsetTop <= anchor) current = id;
      }
      setActiveId(current);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef, sectionIds]);

  const scrollTo = useCallback((id) => {
    const container = containerRef.current;
    const el = container ? container.querySelector(`#${id}`) : null;
    if (container && el) {
      container.scrollTo({ top: el.offsetTop - container.offsetTop - 8, behavior: 'smooth' });
    }
    setActiveId(id);
  }, [containerRef]);

  return { activeId, scrollTo };
}
