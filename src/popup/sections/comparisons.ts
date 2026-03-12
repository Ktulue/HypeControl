// src/popup/sections/comparisons.ts
import { ComparisonItem, UserSettings } from '../../shared/types';
import { getPending, setPendingField } from '../pendingState';

export interface ComparisonsController {
  render(settings: UserSettings): void;
}

export function initComparisons(el: HTMLElement): ComparisonsController {
  const listEl = el.querySelector<HTMLUListElement>('#comparison-list')!;
  const addBtnEl = el.querySelector<HTMLButtonElement>('#btn-add-comparison')!;
  const subpanelEl = el.querySelector<HTMLElement>('#comparison-subpanel')!;
  const subpanelTitleEl = el.querySelector<HTMLElement>('#subpanel-title')!;
  const spEmoji = el.querySelector<HTMLInputElement>('#sp-emoji')!;
  const spName = el.querySelector<HTMLInputElement>('#sp-name')!;
  const spPrice = el.querySelector<HTMLInputElement>('#sp-price')!;
  const spPlural = el.querySelector<HTMLInputElement>('#sp-plural')!;
  const spSimilarityEl = el.querySelector<HTMLElement>('#sp-similarity')!;
  const spSimilarityMsg = el.querySelector<HTMLElement>('#sp-similarity-msg')!;
  const spSaveBtnEl = el.querySelector<HTMLButtonElement>('#sp-save')!;
  const spCancelBtnEl = el.querySelector<HTMLButtonElement>('#sp-cancel')!;
  const spConfirmBtnEl = el.querySelector<HTMLButtonElement>('#sp-confirm')!;
  const spCancelSimilarityBtnEl = el.querySelector<HTMLButtonElement>('#sp-cancel-similarity')!;

  let editingId: string | null = null;
  let dragSrcIdx: number | null = null;

  function generateId(): string {
    return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function isSimilar(name: string, items: ComparisonItem[], ignoreId?: string): string | null {
    const norm = name.trim().toLowerCase();
    const existing = items.find(i => i.id !== ignoreId && (i.name.toLowerCase().includes(norm) || norm.includes(i.name.toLowerCase())));
    return existing?.name ?? null;
  }

  function openSubpanel(title: string, item?: ComparisonItem): void {
    subpanelTitleEl.textContent = title;
    spEmoji.value = item?.emoji ?? '';
    spName.value = item?.name ?? '';
    spPrice.value = item?.price != null ? String(item.price) : '';
    spPlural.value = item?.pluralLabel ?? '';
    spSimilarityEl.hidden = true;
    subpanelEl.hidden = false;
    addBtnEl.hidden = true;
    spName.focus();
  }

  function closeSubpanel(): void {
    subpanelEl.hidden = true;
    addBtnEl.hidden = false;
    editingId = null;
    spSimilarityEl.hidden = true;
  }

  function commitSubpanel(force = false): void {
    const name = spName.value.trim();
    const price = parseFloat(spPrice.value);
    if (!name || isNaN(price) || price <= 0) return;

    const items = getPending().comparisonItems;
    if (!force) {
      const similar = isSimilar(name, items, editingId ?? undefined);
      if (similar) {
        spSimilarityMsg.textContent = `"${name}" is similar to existing item "${similar}"`;
        spSimilarityEl.hidden = false;
        return;
      }
    }

    const newItem: ComparisonItem = {
      id: editingId ?? generateId(),
      emoji: spEmoji.value.trim() || '📦',
      name,
      price: Math.round(price * 100) / 100,
      pluralLabel: spPlural.value.trim() || name + 's',
      enabled: true,
      isPreset: false,
      frictionScope: 'both',
    };

    let updated: ComparisonItem[];
    if (editingId) {
      updated = items.map(i => i.id === editingId ? newItem : i);
    } else {
      updated = [...items, newItem];
    }
    setPendingField('comparisonItems', updated);
    closeSubpanel();
    renderList(updated);
  }

  spSaveBtnEl.addEventListener('click', () => commitSubpanel(false));
  spConfirmBtnEl.addEventListener('click', () => commitSubpanel(true));
  spCancelSimilarityBtnEl.addEventListener('click', () => { spSimilarityEl.hidden = true; });
  spCancelBtnEl.addEventListener('click', closeSubpanel);

  addBtnEl.addEventListener('click', () => {
    editingId = null;
    openSubpanel('Add Item');
  });

  function makeEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    text?: string
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderScopeSegmented(container: HTMLElement, value: ComparisonItem['frictionScope']): void {
    container.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }

  function renderList(items: ComparisonItem[]): void {
    listEl.innerHTML = '';
    items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'comparison-row';
      li.draggable = true;
      li.dataset.idx = String(idx);

      // Drag handle
      li.appendChild(makeEl('span', { class: 'drag-handle', title: 'Drag to reorder' }, '⠿'));

      // Enable toggle
      const toggleLabel = makeEl('label', { class: 'toggle-wrap', title: 'Enable/disable' });
      const toggleEl = makeEl('input', { type: 'checkbox', class: 'item-toggle' });
      toggleEl.checked = item.enabled;
      toggleLabel.appendChild(toggleEl);
      toggleLabel.appendChild(makeEl('span', { class: 'toggle-track' }));
      li.appendChild(toggleLabel);

      // Emoji (textContent is safe)
      li.appendChild(makeEl('span', { class: 'comparison-emoji' }, item.emoji));

      // Name + price
      const info = makeEl('div', { class: 'comparison-info' });
      info.appendChild(makeEl('div', { class: 'comparison-name' }, item.name));
      info.appendChild(makeEl('div', { class: 'comparison-price' }, `$${item.price.toFixed(2)}`));
      li.appendChild(info);

      // Scope segmented (only when enabled)
      if (item.enabled) {
        const scopeWrap = makeEl('div', { class: 'comparison-scope' });
        const segmented = makeEl('div', { class: 'segmented', style: 'font-size:10px;' });
        (['nudge', 'full', 'both'] as ComparisonItem['frictionScope'][]).forEach(val => {
          const btn = makeEl('button', { class: `seg-btn${item.frictionScope === val ? ' active' : ''}`, 'data-value': val }, val.charAt(0).toUpperCase() + val.slice(1));
          btn.addEventListener('click', () => {
            const updated = getPending().comparisonItems.map((ci, i) =>
              i === idx ? { ...ci, frictionScope: val } : ci
            );
            setPendingField('comparisonItems', updated);
            renderScopeSegmented(segmented, val);
          });
          segmented.appendChild(btn);
        });
        scopeWrap.appendChild(segmented);
        li.appendChild(scopeWrap);
      }

      // Edit / Delete (custom items only)
      if (!item.isPreset) {
        const actions = makeEl('div', { class: 'comparison-actions' });
        const editBtn = makeEl('button', { class: 'btn-icon', title: 'Edit' }, '✏️');
        editBtn.addEventListener('click', () => {
          editingId = item.id;
          openSubpanel('Edit Item', item);
        });
        const deleteBtn = makeEl('button', { class: 'btn-icon', title: 'Delete' }, '×');
        deleteBtn.addEventListener('click', () => {
          const updated = getPending().comparisonItems.filter((_, i) => i !== idx);
          setPendingField('comparisonItems', updated);
          renderList(getPending().comparisonItems);
        });
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(actions);
      }

      // Toggle enable/disable
      toggleEl.addEventListener('change', () => {
        const updated = getPending().comparisonItems.map((ci, i) =>
          i === idx ? { ...ci, enabled: toggleEl.checked } : ci
        );
        setPendingField('comparisonItems', updated);
        renderList(getPending().comparisonItems);
      });

      // Drag-and-drop
      li.addEventListener('dragstart', () => {
        dragSrcIdx = idx;
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        listEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        if (dragSrcIdx === null || dragSrcIdx === idx) return;
        const updated = [...getPending().comparisonItems];
        const [moved] = updated.splice(dragSrcIdx, 1);
        updated.splice(idx, 0, moved);
        setPendingField('comparisonItems', updated);
        renderList(updated);
        dragSrcIdx = null;
      });

      listEl.appendChild(li);
    });
  }

  function render(settings: UserSettings): void {
    renderList(settings.comparisonItems);
  }

  return { render };
}
