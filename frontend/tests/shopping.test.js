import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderShoppingShell() {
  document.body.innerHTML = `
    <div id="shopping-content"></div>
  `
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('ShoppingPage', () => {
  beforeEach(() => {
    renderShoppingShell()

    setGlobal('App', {
      navigate: vi.fn(),
      toast: vi.fn(),
    })

    setGlobal('API', {
      getActiveMenu: vi.fn(),
      getShoppingList: vi.fn(),
    })

    loadBrowserScript('../../public/js/shopping.js', 'ShoppingPage')
  })

  it('renders grouped shopping items returned by API', async () => {
    window.API.getActiveMenu.mockResolvedValue({ id: 7, title: 'Меню недели' })
    window.API.getShoppingList.mockResolvedValue({
      menu_title: 'Меню недели',
      shopping_lists: { 'Рататуй': 'томаты 2 шт\nпомидоры 1 шт' },
      to_buy_list: 'помидор - 3шт',
      in_stock_list: '',
      prepared_items: [],
    })

    await window.ShoppingPage.load()

    const combinedItems = document.querySelectorAll('.shopping-combined-item span')
    expect(combinedItems.length).toBe(1)
    expect(combinedItems[0].textContent).toContain('помидор - 3шт')
  })

  it('refresh button reloads shopping list with latest stock snapshot', async () => {
    window.API.getActiveMenu.mockResolvedValue({ id: 3, title: 'Меню' })
    window.API.getShoppingList.mockResolvedValue({
      menu_title: 'Меню',
      shopping_lists: { 'Суп': 'морковь 2 шт' },
      to_buy_list: 'морковь 2 шт',
      in_stock_list: '',
      prepared_items: [],
    })

    await window.ShoppingPage.load()

    const refreshButton = document.querySelector('.js-shopping-refresh')
    expect(refreshButton).toBeTruthy()

    refreshButton.click()
    await flushPromises()

    expect(window.API.getShoppingList).toHaveBeenCalledTimes(2)
    expect(window.App.toast).toHaveBeenCalledWith('Список покупок обновлён', 'success')
  })
})
