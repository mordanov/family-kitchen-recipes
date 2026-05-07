import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { click, flushMicrotasks, renderReact } from './helpers/renderReact'

async function loadShoppingPage(apiMock, extras = {}) {
  vi.resetModules()
  vi.doMock('../src/api.js', () => ({ api: apiMock }))
  const { ShoppingPage } = await import('../src/pages/ShoppingPage.jsx')
  const toast = vi.fn()
  const navigate = vi.fn()
  await renderReact(React.createElement(ShoppingPage, {
    active: true,
    toast,
    navigate,
    ...extras,
  }))
  return { toast, navigate }
}

describe('ShoppingPage', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders grouped shopping items returned by API', async () => {
    await loadShoppingPage({
      getActiveMenu: vi.fn().mockResolvedValue({ id: 7, title: 'Меню недели' }),
      getShoppingList: vi.fn().mockResolvedValue({
        menu_title: 'Меню недели',
        shopping_lists: { 'Рататуй': 'томаты 2 шт\nпомидоры 1 шт' },
        to_buy_list: 'помидор - 3шт',
        in_stock_list: '',
        prepared_items: [],
      }),
    })
    await flushMicrotasks()

    const combinedItems = document.querySelectorAll('.shopping-combined-item span')
    expect(combinedItems.length).toBe(1)
    expect(combinedItems[0].textContent).toContain('помидор - 3шт')
  })

  it('refresh button reloads shopping list with latest stock snapshot', async () => {
    const getShoppingList = vi.fn().mockResolvedValue({
      menu_title: 'Меню',
      shopping_lists: { 'Суп': 'морковь 2 шт' },
      to_buy_list: 'морковь 2 шт',
      in_stock_list: '',
      prepared_items: [],
    })

    const { toast } = await loadShoppingPage({
      getActiveMenu: vi.fn().mockResolvedValue({ id: 3, title: 'Меню' }),
      getShoppingList,
    })
    await flushMicrotasks()

    const refreshButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Обновить'))
    expect(refreshButton).toBeTruthy()

    await click(refreshButton)
    await flushMicrotasks()

    expect(getShoppingList).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenCalledWith('Список покупок обновлён', 'success')
  })
})
