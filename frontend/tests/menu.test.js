import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderMenuShell() {
  document.body.innerHTML = `
    <div id="menu-content"></div>
    <div id="shopping-modal-body"></div>
    <div id="modal-shopping-list"></div>
    <input id="menu-title" value="" />
    <select id="menu-weeks"><option value="1">1</option><option value="2">2</option></select>
    <div id="modal-new-menu"></div>
  `
}

describe('MenuPage', () => {
  beforeEach(() => {
    renderMenuShell()
    setGlobal('App', {
      cookingMethodLabel: vi.fn((method) => method),
      formatDate: vi.fn(() => '15 марта 2026'),
      toast: vi.fn(),
    })
    setGlobal('API', {
      getActiveMenu: vi.fn(),
      listRecipes: vi.fn(),
      addMenuItem: vi.fn(),
      updateMenuItem: vi.fn(),
      removeMenuItem: vi.fn(),
      closeMenu: vi.fn(),
      getShoppingList: vi.fn(),
      createMenu: vi.fn(),
    })

    loadBrowserScript('../../public/js/menu.js', 'MenuPage')
  })

  it('renders an empty state when there is no active menu', async () => {
    window.API.getActiveMenu.mockRejectedValue(new Error('missing'))
    window.API.listRecipes.mockResolvedValue([])

    await window.MenuPage.load()

    expect(document.getElementById('menu-content').textContent).toContain('Нет активного меню')
    expect(document.getElementById('menu-content').textContent).toContain('Создайте меню')
  })

  it('filters the recipe picker by title after loading recipes', async () => {
    window.API.getActiveMenu.mockResolvedValue({
      id: 7,
      title: 'Тестовое меню',
      weeks: 2,
      status: 'active',
      items: [],
    })
    window.API.listRecipes.mockResolvedValue([
      { id: 1, title: 'Сырники', cooking_method: 'frying', servings: 2, kbju_calculated: false },
      { id: 2, title: 'Борщ', cooking_method: 'boiling', servings: 6, kbju_calculated: false },
    ])

    await window.MenuPage.load()
    window.MenuPage.filterPicker('сыр')

    const picker = document.getElementById('recipe-picker-list')
    expect(picker.textContent).toContain('Сырники')
    expect(picker.textContent).not.toContain('Борщ')
  })
})
