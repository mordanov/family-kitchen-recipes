import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderWarehouseShell() {
  document.body.innerHTML = `<div id="warehouse-content"></div>`
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Set up all API mocks needed by load() with default empty returns. */
function mockEmptyLoad() {
  window.API.listStock.mockResolvedValue([])
  window.API.listPrepared.mockResolvedValue([])
  window.API.listRecipes.mockResolvedValue([])
  window.API.listDrafts.mockResolvedValue([])
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
    renderWarehouseShell()

    setGlobal('App', { toast: vi.fn() })

    setGlobal('API', {
      listStock:      vi.fn(),
      listPrepared:   vi.fn(),
      listRecipes:    vi.fn(),
      listDrafts:     vi.fn().mockResolvedValue([]),
      updateStock:    vi.fn(),
      createStock:    vi.fn(),
      deleteStock:    vi.fn(),
      updatePrepared: vi.fn(),
      createPrepared: vi.fn(),
      deletePrepared: vi.fn(),
      commitDraft:    vi.fn(),
      deleteDraft:    vi.fn(),
    })

    loadBrowserScript('../../public/js/warehouse.js', 'WarehousePage')
  })

  // ── Stock / prepared ────────────────────────────────────────────────────────

  it('renders stock and prepared items as framed rows with actions inside', async () => {
    window.API.listStock.mockResolvedValue([
      { id: 1, name: 'Баклажан', quantity: '5 шт', added_on: '2026-03-15' },
    ])
    window.API.listPrepared.mockResolvedValue([
      { id: 2, recipe_id: 10, servings: 2, note: 'морозилка', added_on: '2026-03-15', recipe: { title: 'Рагу' } },
    ])
    window.API.listRecipes.mockResolvedValue([{ id: 10, title: 'Рагу' }])

    await window.WarehousePage.load()

    const rows = document.querySelectorAll('.warehouse-row')
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.querySelector('.warehouse-row-actions')).toBeTruthy()
      expect(row.querySelector('.js-edit-stock, .js-edit-prepared')).toBeTruthy()
      expect(row.querySelector('.js-delete-stock, .js-delete-prepared')).toBeTruthy()
    }
  })

  // ── Draft zone list ─────────────────────────────────────────────────────────

  it('does not render draft zone when there are no drafts', async () => {
    mockEmptyLoad()
    await window.WarehousePage.load()
    expect(document.querySelector('.draft-zone')).toBeFalsy()
  })

  it('renders compact clickable draft rows (no inline edit forms on the page)', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelector('.draft-zone')).toBeTruthy()
    expect(document.querySelectorAll('.draft-list-row').length).toBe(1)
    // Inline edit inputs should NOT appear on the page – they live in the modal
    expect(document.querySelector('.draft-item-row')).toBeFalsy()
    // Old inline action buttons should not be present
    expect(document.querySelector('.js-commit-draft')).toBeFalsy()
    expect(document.querySelector('.js-discard-draft')).toBeFalsy()
  })

  it('shows item count in draft row label', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelector('.draft-list-count').textContent).toContain('2')
  })

  it('renders one row per draft when multiple drafts exist', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1, DRAFT_EMPTY_ITEMS])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelectorAll('.draft-list-row').length).toBe(2)
  })

  // ── Draft modal: opening ────────────────────────────────────────────────────

  it('clicking a draft row opens the draft modal', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(false)
    document.querySelector('.js-open-draft').click()
    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(true)
  })

  it('modal title contains the draft date', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    expect(document.getElementById('draft-modal-title').textContent).toContain('Чек от')
  })

  it('modal shows editable item rows pre-filled with draft data', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    const rows = document.querySelectorAll('#draft-modal-items .draft-item-row')
    expect(rows.length).toBe(2)
    expect(rows[0].querySelector('.draft-item-name').value).toBe('молоко')
    expect(rows[0].querySelector('.draft-item-qty').value).toBe('1 л')
    expect(rows[1].querySelector('.draft-item-name').value).toBe('хлеб')
  })

  it('close button hides the modal', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()
    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(true)

    document.querySelector('.js-close-draft').click()
    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(false)
  })

  // ── Draft modal: item manipulation ──────────────────────────────────────────

  it('delete button removes item row from modal', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    expect(document.querySelectorAll('#draft-modal-items .draft-item-row').length).toBe(2)
    document.querySelector('.js-del-modal-item').click()
    expect(document.querySelectorAll('#draft-modal-items .draft-item-row').length).toBe(1)
  })

  it('"Добавить позицию" appends an empty editable row', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    expect(document.querySelectorAll('#draft-modal-items .draft-item-row').length).toBe(2)
    document.querySelector('.js-add-draft-row').click()
    const rows = document.querySelectorAll('#draft-modal-items .draft-item-row')
    expect(rows.length).toBe(3)
    expect(rows[2].querySelector('.draft-item-name').value).toBe('')
  })

  it('newly added row can be deleted via its own delete button', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()
    document.querySelector('.js-add-draft-row').click()

    expect(document.querySelectorAll('#draft-modal-items .draft-item-row').length).toBe(3)
    // delete the last (newly added) row
    const delBtns = document.querySelectorAll('.js-del-modal-item')
    delBtns[delBtns.length - 1].click()
    expect(document.querySelectorAll('#draft-modal-items .draft-item-row').length).toBe(2)
  })

  // ── Draft modal: Применить (commit) ─────────────────────────────────────────

  it('"Применить" sends edited item values to API and reloads', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockResolvedValue({ items_added: 2 })

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    // Edit first item name
    document.querySelector('#draft-modal-items .draft-item-name').value = 'молоко топлёное'

    window.API.listDrafts.mockResolvedValue([])
    document.querySelector('.js-commit-draft-modal').click()
    await flushPromises()

    expect(window.API.commitDraft).toHaveBeenCalledWith(1, {
      items: [
        { name: 'молоко топлёное', quantity: '1 л' },
        { name: 'хлеб', quantity: '2 шт' },
      ],
    })
    expect(window.App.toast).toHaveBeenCalledWith('Добавлено на склад: 2 поз.', 'success')
  })

  it('"Применить" skips rows with empty name', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    // Clear both names
    document.querySelectorAll('#draft-modal-items .draft-item-name').forEach(i => { i.value = '  ' })

    document.querySelector('.js-commit-draft-modal').click()
    await flushPromises()

    expect(window.API.commitDraft).not.toHaveBeenCalled()
    expect(window.App.toast).toHaveBeenCalledWith('Нет позиций для добавления на склад', 'error')
  })

  it('"Применить" closes modal after success', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockResolvedValue({ items_added: 2 })

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    window.API.listDrafts.mockResolvedValue([])
    document.querySelector('.js-commit-draft-modal').click()
    await flushPromises()

    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(false)
  })

  it('"Применить" shows error toast if API fails', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_1])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockRejectedValue(new Error('server error'))

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    document.querySelector('.js-commit-draft-modal').click()
    await flushPromises()

    expect(window.App.toast).toHaveBeenCalledWith('Ошибка: server error', 'error')
  })

  // ── Draft modal: Удалить черновик (discard) ─────────────────────────────────

  it('"Удалить черновик" calls API.deleteDraft after confirmation and closes modal', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_EMPTY_ITEMS])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.deleteDraft.mockResolvedValue({ ok: true })

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    window.API.listDrafts.mockResolvedValue([])
    document.querySelector('.js-discard-draft-modal').click()
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(window.API.deleteDraft).toHaveBeenCalledWith(2)
    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(false)
  })

  it('"Удалить черновик" does nothing when confirmation is cancelled', async () => {
    window.API.listDrafts.mockResolvedValue([DRAFT_EMPTY_ITEMS])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()
    document.querySelector('.js-open-draft').click()

    vi.stubGlobal('confirm', vi.fn(() => false))
    document.querySelector('.js-discard-draft-modal').click()
    await flushPromises()

    expect(window.API.deleteDraft).not.toHaveBeenCalled()
    expect(document.getElementById('draft-modal').classList.contains('open')).toBe(true)
  })
})
