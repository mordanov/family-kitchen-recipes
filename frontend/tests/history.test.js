import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderShell() {
  document.body.innerHTML = `
    <div id="history-content"></div>
    <div id="shopping-content"></div>
  `
}

describe('HistoryPage KBJU', () => {
  beforeEach(() => {
    renderShell()

    setGlobal('App', {
      formatDate: vi.fn(() => '15 марта 2026'),
      toast: vi.fn(),
      navigate: vi.fn(),
    })

    setGlobal('API', {
      listMenus: vi.fn(),
      getMenu: vi.fn(),
      getActiveMenu: vi.fn(),
      getShoppingList: vi.fn(),
    })

    loadBrowserScript('../../public/js/shopping.js', 'HistoryPage')
  })

  it('renders kbju totals and breakdown in history cards', async () => {
    window.API.listMenus.mockResolvedValue([
      {
        id: 1,
        title: 'Меню недели',
        weeks: 1,
        status: 'closed',
        created_at: '2026-03-10T12:00:00Z',
        closed_at: '2026-03-12T12:00:00Z',
        items: [],
        kbju_summary: {
          total: { calories: 1500, proteins: 80, fats: 50, carbs: 170 },
          by_day: [{ day_of_week: 1, calories: 700 }],
          by_member: [{ member_id: 5, member_name: 'Алиса', member_color: '#4ECDC4', calories: 900 }],
        },
      },
    ])

    await window.HistoryPage.load()

    const text = document.getElementById('history-content').textContent
    expect(text).toContain('1500 ккал')
    expect(text).toContain('Пн: 700 ккал')
    expect(text).toContain('Алиса: 900 ккал')
  })

  it('shows kbju section in menu detail modal', async () => {
    const menu = {
      id: 2,
      title: 'Детальное меню',
      weeks: 1,
      status: 'closed',
      created_at: '2026-03-10T12:00:00Z',
      closed_at: '2026-03-12T12:00:00Z',
      items: [],
      kbju_summary: {
        total: { calories: 1200, proteins: 70, fats: 40, carbs: 130 },
        by_day: [{ day_of_week: 2, calories: 600 }],
        by_member: [{ member_id: 7, member_name: 'Папа', member_color: '#FF6B35', calories: 1200 }],
      },
    }
    window.API.getMenu.mockResolvedValue(menu)

    await window.HistoryPage.openMenu(2)

    const modalText = document.body.textContent
    expect(modalText).toContain('КБЖУ меню')
    expect(modalText).toContain('1200 ккал')
    expect(modalText).toContain('Вт: 600 ккал')
    expect(modalText).toContain('Папа: 1200 ккал')
  })
})

