// src/popup/scrollSpy.ts

export interface ScrollSpyItem {
  id: string;
  sectionEl: HTMLElement;
  headingEl: HTMLElement;
  navEl: HTMLElement;
}

/**
 * Sets up IntersectionObserver-based scroll-spy.
 * Returns a disconnect function to clean up.
 */
export function initScrollSpy(
  contentEl: HTMLElement,
  items: ScrollSpyItem[]
): () => void {
  let activeId: string | null = null;

  function activate(id: string): void {
    if (id === activeId) return;
    if (activeId) {
      items.find(i => i.id === activeId)?.navEl.classList.remove('active');
    }
    items.find(i => i.id === id)?.navEl.classList.add('active');
    activeId = id;
  }

  // Activate first section immediately
  if (items.length > 0) activate(items[0].id);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (id) { activate(id); break; }
        }
      }
    },
    {
      root: contentEl,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0,
    }
  );

  items.forEach(item => {
    item.headingEl.dataset.sectionId = item.id;
    observer.observe(item.headingEl);

    item.navEl.addEventListener('click', () => {
      item.sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  return () => observer.disconnect();
}
