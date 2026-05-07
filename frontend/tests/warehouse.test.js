import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { changeValue, click, flushMicrotasks, renderReact } from './helpers/renderReact'

async function loadWarehousePage(apiMock) {
  vi.resetModules()
  vi.doMock('../src/api.js', () => ({ api: apiMock }))
  const { WarehousePage } = await import('../src/pages/WarehousePage.jsx')
  const toast = vi.fn()
  await renderReact(React.createElement(WarehousePage, {
    active: true,
    toast,
  }))
  return { toast }
}

function mockEmptyLoad() {
  return {
    listStock: vi.fn().mockResolvedValue([]),
    listPrepared: vi.fn().mockResolvedValue([]),
    listRecipes: vi.fn().mockResolvedValue([]),
    listDrafts: vi.fn().mockResolvedValue([]),
    updateStock: vi.fn(),
    createStock: vi.fn(),
    deleteStock: vi.fn(),
    updatePrepared: vi.fn(),
    createPrepared: vi.fn(),
    deletePrepared: vi.fn(),
    commitDraft: vi.fn(),
    deleteDraft: vi.fn(),
  }
}

const DRAFT_1 = {
  id: 1,
  created_at: '2026-04-08T10:00:00',
  items: [
    { name: 'молоко', quantity: '1 л' },
    { name: 'хлеб', quantity: '2 шт' },
  ],
}

const DRAFT_EMPTY_ITEMS = {
  id: 2,
  created_at: '2026-04-08T11:00:00',
  items: [],
}

describe('WarehousePage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // ── Stock / prepared ────────────────────────────────────────────────────────

  it('renders stock and prepared items as framed rows with actions inside', async () => {
    const api = mockEmptyLoad()
    api.listStock.mockResolvedValue([
      { id: 1, name: 'Баклажан', quantity: '5 шт', added_on: '2026-03-15' },
    ])
    api.listPrepared.mockResolvedValue([
      { id: 2, recipe_id: 10, servings: 2, note: 'морозилка', added_on: '2026-03-15', recipe: { title: 'Рагу' } },
    ])
    api.listRecipes.mockResolvedValue([{ id: 10, title: 'Рагу' }])

    await loadWarehousePage(api)
    await flushMicrotasks()

    const rows = document.querySelectorAll('.warehouse-row')
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.querySelector('.warehouse-row-actions')).toBeTruthy()
      expect(row.textContent).toContain('Изменить')
      expect(row.textContent).toContain('Удалить')
    }
  })

  // ── Draft zone list ─────────────────────────────────────────────────────────

  it('does not render draft zone when there are no drafts', async () => {
    await loadWarehousePage(mockEmptyLoad())
    await flushMicrotasks()
    expect(document.querySelector('.draft-zone')).toBeFalsy()
  })

  it('renders compact clickable draft rows (no inline edit forms on the page)', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()

    expect(document.querySelector('.draft-zone')).toBeTruthy()
    expect(document.querySelectorAll('.draft-list-row').length).toBe(1)
    expect(document.querySelector('.draft-item-row')).toBeFalsy()
  })

  it('shows item count in draft row label', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()

    expect(document.querySelector('.draft-list-count').textContent).toContain('2')
  })

  it('renders one row per draft when multiple drafts exist', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1, DRAFT_EMPTY_ITEMS])

    await loadWarehousePage(api)
    await flushMicrotasks()

    expect(document.querySelectorAll('.draft-list-row').length).toBe(2)
  })

  // ── Draft modal: opening ────────────────────────────────────────────────────

  it('clicking a draft row opens the draft modal', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()

    expect(document.body.textContent).not.toContain('Удалить черновик')
    await click(document.querySelector('.draft-list-row'))
    expect(document.body.textContent).toContain('Удалить черновик')
  })

  it('modal title contains the draft date', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    expect(document.body.textContent).toContain('Чек от')
  })

  it('modal shows editable item rows pre-filled with draft data', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    const rows = document.querySelectorAll('.draft-item-row')
    expect(rows.length).toBe(2)
    expect(rows[0].querySelector('.draft-item-name').value).toBe('молоко')
    expect(rows[0].querySelector('.draft-item-qty').value).toBe('1 л')
    expect(rows[1].querySelector('.draft-item-name').value).toBe('хлеб')
  })

  it('close button hides the modal', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))
    expect(document.body.textContent).toContain('Удалить черновик')

    await click(document.querySelector('.modal-close'))
    expect(document.body.textContent).not.toContain('Удалить черновик')
  })

  // ── Draft modal: item manipulation ──────────────────────────────────────────

  it('delete button removes item row from modal', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    expect(document.querySelectorAll('.draft-item-row').length).toBe(2)
    await click(document.querySelector('.draft-item-row button'))
    expect(document.querySelectorAll('.draft-item-row').length).toBe(1)
  })

  it('"Добавить позицию" appends an empty editable row', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    expect(document.querySelectorAll('.draft-item-row').length).toBe(2)
    const addButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Добавить позицию'))
    await click(addButton)
    const rows = document.querySelectorAll('.draft-item-row')
    expect(rows.length).toBe(3)
    expect(rows[2].querySelector('.draft-item-name').value).toBe('')
  })

  // ── Draft modal: Применить (commit) ─────────────────────────────────────────

  it('"Применить" sends edited item values to API and reloads', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])
    api.commitDraft.mockResolvedValue({ items_added: 2 })

    const { toast } = await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    await changeValue(document.querySelector('.draft-item-name'), 'молоко топлёное')

    api.listDrafts.mockResolvedValue([])
    const applyButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Применить')
    await click(applyButton)
    await flushMicrotasks()

    expect(api.commitDraft).toHaveBeenCalledWith(1, {
      items: [
        { name: 'молоко топлёное', quantity: '1 л' },
        { name: 'хлеб', quantity: '2 шт' },
      ],
    })
    expect(toast).toHaveBeenCalledWith('Добавлено на склад: 2 поз.', 'success')
  })

  it('"Применить" skips rows with empty name', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])

    const { toast } = await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    for (const input of document.querySelectorAll('.draft-item-name')) {
      await changeValue(input, '  ')
    }

    const applyButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Применить')
    await click(applyButton)
    await flushMicrotasks()

    expect(api.commitDraft).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Нет позиций для добавления на склад', 'error')
  })

  it('"Применить" shows error toast if API fails', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_1])
    api.commitDraft.mockRejectedValue(new Error('server error'))

    const { toast } = await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    const applyButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Применить')
    await click(applyButton)
    await flushMicrotasks()

    expect(toast).toHaveBeenCalledWith('Ошибка: server error', 'error')
  })

  // ── Draft modal: Удалить черновик (discard) ─────────────────────────────────

  it('"Удалить черновик" calls API.deleteDraft after confirmation and closes modal', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_EMPTY_ITEMS])
    api.deleteDraft.mockResolvedValue({ ok: true })

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    api.listDrafts.mockResolvedValue([])
    const deleteButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Удалить черновик')
    await click(deleteButton)
    await flushMicrotasks()

    expect(window.confirm).toHaveBeenCalled()
    expect(api.deleteDraft).toHaveBeenCalledWith(2)
    expect(document.body.textContent).not.toContain('Удалить черновик')
  })

  it('"Удалить черновик" does nothing when confirmation is cancelled', async () => {
    const api = mockEmptyLoad()
    api.listDrafts.mockResolvedValue([DRAFT_EMPTY_ITEMS])

    await loadWarehousePage(api)
    await flushMicrotasks()
    await click(document.querySelector('.draft-list-row'))

    vi.stubGlobal('confirm', vi.fn(() => false))
    const deleteButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Удалить черновик')
    await click(deleteButton)
    await flushMicrotasks()

    expect(api.deleteDraft).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Удалить черновик')
  })
})
