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
      updateStock: vi.fn(),
      createStock: vi.fn(),
      deleteStock: vi.fn(),
      updatePrepared: vi.fn(),
      createPrepared: vi.fn(),
      deletePrepared: vi.fn(),
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
})

