import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { click, flushMicrotasks, renderReact } from './helpers/renderReact'

async function loadHistoryPage(apiMock) {
  vi.resetModules()
  vi.doMock('../src/api.js', () => ({ api: apiMock }))
  const { HistoryPage } = await import('../src/pages/HistoryPage.jsx')
  return renderReact(React.createElement(HistoryPage, {
    active: true,
    toast: vi.fn(),
  }))
}

describe('HistoryPage KBJU', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders history card with KBJU report hint', async () => {
    await loadHistoryPage({
      listMenus: vi.fn().mockResolvedValue([
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
      ]),
      getMenu: vi.fn(),
    })
    await flushMicrotasks()

    expect(document.body.textContent).toContain('Меню недели')
    expect(document.body.textContent).toContain('КБЖУ-отчёт доступен в деталях меню')
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
    await loadHistoryPage({
      listMenus: vi.fn().mockResolvedValue([
        {
          id: 2,
          title: 'Детальное меню',
          weeks: 1,
          status: 'closed',
          created_at: '2026-03-10T12:00:00Z',
          closed_at: '2026-03-12T12:00:00Z',
          items: menu.items,
        },
      ]),
      getMenu: vi.fn().mockResolvedValue(menu),
    })
    await flushMicrotasks()

    const card = document.querySelector('.history-card')
    await click(card)
    await flushMicrotasks()

    const modalText = document.body.textContent
    expect(modalText).toContain('КБЖУ по дням и членам семьи')
    expect(modalText).toContain('День')
    expect(modalText).toContain('Папа')
    expect(modalText).toContain('Вт')
    expect(modalText).toContain('К 600')
    expect(modalText).toContain('Папа: Омлет')
  })
})
