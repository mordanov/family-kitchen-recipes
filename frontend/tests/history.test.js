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

  it('renders history card with KBJU report hint', async () => {
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
    expect(text).toContain('Меню недели')
    expect(text).toContain('КБЖУ-отчёт доступен в деталях меню')
  })

  it('shows kbju matrix (days x family members) in menu detail modal', async () => {
    const menu = {
      id: 2,
      title: 'Детальное меню',
      weeks: 1,
      status: 'closed',
      created_at: '2026-03-10T12:00:00Z',
      closed_at: '2026-03-12T12:00:00Z',
      items: [
        {
          id: 11,
          week_number: 1,
          day_of_week: 2,
          meal_type: 'breakfast',
          is_cooked: false,
          recipe: null,
          member_assignments: [
            {
              member_id: 7,
              member_name: 'Папа',
              recipe: { title: 'Омлет', calories: 600, proteins: 35, fats: 20, carbs: 30, kbju_calculated: true },
            },
          ],
        },
      ],
      kbju_summary: {
        total: { calories: 1200, proteins: 70, fats: 40, carbs: 130 },
        by_day: [{ day_of_week: 2, calories: 600 }],
        by_member: [{ member_id: 7, member_name: 'Папа', member_color: '#FF6B35', calories: 1200 }],
      },
    }
    window.API.getMenu.mockResolvedValue(menu)

    await window.HistoryPage.openMenu(2)

    const modalText = document.body.textContent
    expect(modalText).toContain('КБЖУ по дням и членам семьи')
    expect(modalText).toContain('День')
    expect(modalText).toContain('Папа')
    expect(modalText).toContain('Вт')
    expect(modalText).toContain('К 600')
    expect(modalText).toContain('Папа: Омлет')
  })
})
