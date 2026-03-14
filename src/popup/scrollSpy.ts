// src/popup/scrollSpy.ts

export interface ScrollSpyItem {
  id: string;
  sectionEl: HTMLElement;
  headingEl: HTMLElement;
  navEl: HTMLElement;
}

export interface ScrollSpyController {
  /** Jump instantly to a section by id and activate its nav item. */
  jumpTo: (id: string) => void;
  /** Remove the scroll listener. */
  disconnect: () => void;
}

/**
 * Sets up scroll-spy using a scroll event listener.
 *
 * Padding is calculated dynamically so the last section's heading can always
 * scroll flush to the top of the content area:
 *   paddingBottom = contentEl.clientHeight - lastSection.offsetHeight
 *
 * Heading positions are measured relative to the scroll container via
 * getBoundingClientRect() to avoid offsetParent mismatches.
 *
 * The section whose heading has scrolled past the top 25% threshold is active.
 * Nav clicks immediately activate the target item then smooth-scroll to it.
 */
export function initScrollSpy(
  contentEl: HTMLElement,
  items: ScrollSpyItem[]
): ScrollSpyController {
  if (items.length === 0) return { jumpTo: () => {}, disconnect: () => {} };

  let activeId: string | null = null;

  function activate(id: string): void {
    if (id === activeId) return;
    if (activeId) {
      items.find(i => i.id === activeId)?.navEl.classList.remove('active');
    }
    items.find(i => i.id === id)?.navEl.classList.add('active');
    activeId = id;
  }

  // Dynamic padding: last section heading can always reach the top of the viewport
  const lastSection = items[items.length - 1].sectionEl;
  const padding = Math.max(0, contentEl.clientHeight - lastSection.offsetHeight);
  contentEl.style.paddingBottom = `${padding}px`;

  // Activate first section on init
  activate(items[0].id);

  /** Returns heading's absolute offset from the top of the scroll container's content area. */
  function headingOffset(item: ScrollSpyItem): number {
    const headingRect = item.headingEl.getBoundingClientRect();
    const containerRect = contentEl.getBoundingClientRect();
    return headingRect.top - containerRect.top + contentEl.scrollTop;
  }

  function onScroll(): void {
    const threshold = contentEl.scrollTop + contentEl.clientHeight * 0.25;
    let best = items[0];
    for (const item of items) {
      if (headingOffset(item) <= threshold) best = item;
    }
    activate(best.id);
  }

  contentEl.addEventListener('scroll', onScroll);

  items.forEach(item => {
    item.navEl.addEventListener('click', () => {
      activate(item.id);
      item.sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  return {
    jumpTo: (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      item.sectionEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      activate(id);
    },
    disconnect: () => contentEl.removeEventListener('scroll', onScroll),
  };
}
