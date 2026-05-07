import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flushMicrotasks, renderReact } from './helpers/renderReact'

async function loadMenuPage(apiMock) {
  vi.resetModules()
  vi.doMock('../src/api.js', () => ({ api: apiMock }))
  const { MenuPage } = await import('../src/pages/MenuPage.jsx')
  return renderReact(React.createElement(MenuPage, {
    active: true,
    toast: vi.fn(),
    quickActions: { open: false, message: '', onConfirm: null, skipNext: false, skipConfirm: false },
    setQuickActions: vi.fn(),
  }))
}

describe('MenuPage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders an empty state when there is no active menu', async () => {
    await loadMenuPage({
      getActiveMenu: vi.fn().mockRejectedValue(new Error('missing')),
      listRecipes: vi.fn().mockResolvedValue([]),
      listPrepared: vi.fn().mockResolvedValue([]),
      listStock: vi.fn().mockResolvedValue([]),
      listMembers: vi.fn().mockResolvedValue([]),
      addMenuItem: vi.fn(),
      updateMenuItem: vi.fn(),
      removeMenuItem: vi.fn(),
      closeMenu: vi.fn(),
      getShoppingList: vi.fn(),
      createMenu: vi.fn(),
      autoFillMenu: vi.fn(),
      setItemAssignments: vi.fn(),
    })
    await flushMicrotasks()

    expect(document.body.textContent).toContain('Нет активного меню')
    expect(document.body.textContent).toContain('Создайте меню')
  })

  it('renders compact shared-recipe select after loading recipes', async () => {
    await loadMenuPage({
      getActiveMenu: vi.fn().mockResolvedValue({
        id: 7,
        title: 'Тестовое меню',
        weeks: 2,
        status: 'active',
        items: [],
      }),
      listRecipes: vi.fn().mockResolvedValue([
        { id: 1, title: 'Сырники', cooking_method: 'frying', servings: 2, kbju_calculated: false },
        { id: 2, title: 'Борщ', cooking_method: 'boiling', servings: 6, kbju_calculated: false },
      ]),
      listPrepared: vi.fn().mockResolvedValue([]),
      listStock: vi.fn().mockResolvedValue([]),
      listMembers: vi.fn().mockResolvedValue([]),
      addMenuItem: vi.fn(),
      updateMenuItem: vi.fn(),
      removeMenuItem: vi.fn(),
      closeMenu: vi.fn(),
      getShoppingList: vi.fn(),
      createMenu: vi.fn(),
      autoFillMenu: vi.fn(),
      setItemAssignments: vi.fn(),
    })
    await flushMicrotasks()

    const select = document.getElementById('add-item-recipe-select')
    expect(select).toBeTruthy()
    expect(select.textContent).toContain('Сырники')
    expect(select.textContent).toContain('Борщ')
  })
})
