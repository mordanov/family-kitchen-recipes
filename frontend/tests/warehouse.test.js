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
  document.body.innerHTML = `
    <div id="warehouse-content"></div>
  `
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const EMPTY_LOAD = {
  listStock: () => window.API.listStock.mockResolvedValue([]),
  listPrepared: () => window.API.listPrepared.mockResolvedValue([]),
  listRecipes: () => window.API.listRecipes.mockResolvedValue([]),
  listDrafts: () => window.API.listDrafts.mockResolvedValue([]),
}

function mockEmptyLoad() {
  EMPTY_LOAD.listStock()
  EMPTY_LOAD.listPrepared()
  EMPTY_LOAD.listRecipes()
  EMPTY_LOAD.listDrafts()
}

describe('WarehousePage', () => {
  beforeEach(() => {
    renderWarehouseShell()

    setGlobal('App', {
      toast: vi.fn(),
    })

    setGlobal('API', {
      listStock: vi.fn(),
      listPrepared: vi.fn(),
      listRecipes: vi.fn(),
      listDrafts: vi.fn().mockResolvedValue([]),
      updateStock: vi.fn(),
      createStock: vi.fn(),
      deleteStock: vi.fn(),
      updatePrepared: vi.fn(),
      createPrepared: vi.fn(),
      deletePrepared: vi.fn(),
      commitDraft: vi.fn(),
      deleteDraft: vi.fn(),
    })

    loadBrowserScript('../../public/js/warehouse.js', 'WarehousePage')
  })

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

  // ── Draft zone rendering ──────────────────────────────────────────────────

  it('renders draft zone with cards and item rows when drafts exist', async () => {
    window.API.listDrafts.mockResolvedValue([
      {
        id: 1,
        created_at: '2026-04-08T10:00:00',
        items: [
          { name: 'молоко', quantity: '1 л' },
          { name: 'хлеб', quantity: '2 шт' },
        ],
      },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelector('.draft-zone')).toBeTruthy()
    expect(document.querySelector('.draft-card')).toBeTruthy()
    expect(document.querySelectorAll('.draft-item-row').length).toBe(2)
    expect(document.querySelector('.js-commit-draft')).toBeTruthy()
    expect(document.querySelector('.js-discard-draft')).toBeTruthy()
  })

  it('does not render draft zone when there are no drafts', async () => {
    mockEmptyLoad()

    await window.WarehousePage.load()

    expect(document.querySelector('.draft-zone')).toBeFalsy()
  })

  it('renders multiple draft cards when multiple drafts exist', async () => {
    window.API.listDrafts.mockResolvedValue([
      { id: 1, created_at: '2026-04-08T09:00:00', items: [{ name: 'масло', quantity: '200 г' }] },
      { id: 2, created_at: '2026-04-08T11:00:00', items: [{ name: 'яйца', quantity: '10 шт' }] },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelectorAll('.draft-card').length).toBe(2)
    expect(document.querySelectorAll('.draft-item-row').length).toBe(2)
  })

  it('pre-fills input fields with item name and quantity', async () => {
    window.API.listDrafts.mockResolvedValue([
      {
        id: 7,
        created_at: '2026-04-08T10:00:00',
        items: [{ name: 'сметана', quantity: '400 г' }],
      },
    ])
    mockEmptyLoad()
    window.API.listDrafts.mockResolvedValue([
      { id: 7, created_at: '2026-04-08T10:00:00', items: [{ name: 'сметана', quantity: '400 г' }] },
    ])

    await window.WarehousePage.load()

    const nameInput = document.querySelector('.draft-item-name')
    const qtyInput = document.querySelector('.draft-item-qty')
    expect(nameInput.value).toBe('сметана')
    expect(qtyInput.value).toBe('400 г')
  })

  // ── Delete item from draft ────────────────────────────────────────────────

  it('removes item row when its delete button is clicked', async () => {
    window.API.listDrafts.mockResolvedValue([
      {
        id: 3,
        created_at: '2026-04-08T10:00:00',
        items: [
          { name: 'кефир', quantity: '1 л' },
          { name: 'творог', quantity: '500 г' },
        ],
      },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    expect(document.querySelectorAll('.draft-item-row').length).toBe(2)

    document.querySelector('.js-del-draft-item').click()

    expect(document.querySelectorAll('.draft-item-row').length).toBe(1)
  })

  it('shows empty message when the last item is deleted from a draft', async () => {
    window.API.listDrafts.mockResolvedValue([
      { id: 4, created_at: '2026-04-08T10:00:00', items: [{ name: 'лук', quantity: '1 кг' }] },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    document.querySelector('.js-del-draft-item').click()

    expect(document.querySelectorAll('.draft-item-row').length).toBe(0)
    expect(document.querySelector('.draft-empty')).toBeTruthy()
  })

  // ── Commit draft ──────────────────────────────────────────────────────────

  it('commit button sends current input values to API and reloads', async () => {
    const draft = {
      id: 5,
      created_at: '2026-04-08T10:00:00',
      items: [
        { name: 'молоко', quantity: '1 л' },
        { name: 'хлеб', quantity: '2 шт' },
      ],
    }
    window.API.listDrafts.mockResolvedValue([draft])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockResolvedValue({ items_added: 2 })

    await window.WarehousePage.load()

    // Simulate user editing first item name
    document.querySelector('.draft-item-name').value = 'молоко топлёное'

    // After commit, load() fires again — stub it to return empty
    window.API.listDrafts.mockResolvedValue([])

    document.querySelector('.js-commit-draft').click()
    await flushPromises()

    expect(window.API.commitDraft).toHaveBeenCalledWith(5, {
      items: [
        { name: 'молоко топлёное', quantity: '1 л' },
        { name: 'хлеб', quantity: '2 шт' },
      ],
    })
    expect(window.App.toast).toHaveBeenCalledWith('Добавлено на склад: 2 поз.', 'success')
  })

  it('commit button skips rows with empty name', async () => {
    window.API.listDrafts.mockResolvedValue([
      {
        id: 6,
        created_at: '2026-04-08T10:00:00',
        items: [{ name: 'чеснок', quantity: '1 гол.' }],
      },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockResolvedValue({ items_added: 0 })

    await window.WarehousePage.load()

    // Clear the name field to simulate user emptying it
    document.querySelector('.draft-item-name').value = '   '

    document.querySelector('.js-commit-draft').click()
    await flushPromises()

    expect(window.API.commitDraft).not.toHaveBeenCalled()
    expect(window.App.toast).toHaveBeenCalledWith('Нет позиций для добавления на склад', 'error')
  })

  it('commit button shows error toast if API call fails', async () => {
    window.API.listDrafts.mockResolvedValue([
      { id: 9, created_at: '2026-04-08T10:00:00', items: [{ name: 'соль', quantity: '1 кг' }] },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.commitDraft.mockRejectedValue(new Error('server error'))

    await window.WarehousePage.load()

    document.querySelector('.js-commit-draft').click()
    await flushPromises()

    expect(window.App.toast).toHaveBeenCalledWith('Ошибка: server error', 'error')
  })

  // ── Discard draft ─────────────────────────────────────────────────────────

  it('discard button calls API.deleteDraft with correct id after confirmation', async () => {
    window.API.listDrafts.mockResolvedValue([
      { id: 11, created_at: '2026-04-08T10:00:00', items: [] },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])
    window.API.deleteDraft.mockResolvedValue({ ok: true })

    await window.WarehousePage.load()

    // Stub load() after delete to return empty drafts
    window.API.listDrafts.mockResolvedValue([])

    document.querySelector('.js-discard-draft').click()
    await flushPromises()

    expect(window.confirm).toHaveBeenCalled()
    expect(window.API.deleteDraft).toHaveBeenCalledWith(11)
  })

  it('discard button does not call API if confirmation is cancelled', async () => {
    window.API.listDrafts.mockResolvedValue([
      { id: 12, created_at: '2026-04-08T10:00:00', items: [] },
    ])
    window.API.listStock.mockResolvedValue([])
    window.API.listPrepared.mockResolvedValue([])
    window.API.listRecipes.mockResolvedValue([])

    await window.WarehousePage.load()

    vi.stubGlobal('confirm', vi.fn(() => false))

    document.querySelector('.js-discard-draft').click()
    await flushPromises()

    expect(window.API.deleteDraft).not.toHaveBeenCalled()
  })
})
