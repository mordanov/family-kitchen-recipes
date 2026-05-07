import React, { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { changeValue, click, flushMicrotasks, renderReact } from './helpers/renderReact'

async function loadApp({ login = vi.fn(), me = vi.fn() } = {}) {
  vi.resetModules()

  const pageLoads = {
    recipes: vi.fn(),
    menu: vi.fn(),
    shopping: vi.fn(),
    history: vi.fn(),
    warehouse: vi.fn(),
    members: vi.fn(),
    settings: vi.fn(),
  }

  const makePage = (name, key) => ({ active }) => {
    useEffect(() => {
      if (active) pageLoads[key]()
    }, [active])

    return React.createElement('section', {
      'data-page': name,
      'data-active': active ? 'true' : 'false',
    })
  }

  vi.doMock('../src/api.js', () => ({
    api: { login, me },
  }))
  vi.doMock('../src/pages/RecipesPage.jsx', () => ({ RecipesPage: makePage('recipes', 'recipes') }))
  vi.doMock('../src/pages/MenuPage.jsx', () => ({ MenuPage: makePage('menu', 'menu') }))
  vi.doMock('../src/pages/ShoppingPage.jsx', () => ({ ShoppingPage: makePage('shopping', 'shopping') }))
  vi.doMock('../src/pages/HistoryPage.jsx', () => ({ HistoryPage: makePage('history', 'history') }))
  vi.doMock('../src/pages/WarehousePage.jsx', () => ({ WarehousePage: makePage('warehouse', 'warehouse') }))
  vi.doMock('../src/pages/MembersPage.jsx', () => ({ MembersPage: makePage('members', 'members') }))
  vi.doMock('../src/pages/SettingsPage.jsx', () => ({ SettingsPage: makePage('settings', 'settings') }))

  const { default: App } = await import('../src/App.jsx')
  const rendered = await renderReact(React.createElement(App))

  return { ...rendered, login, me, pageLoads }
}

describe('App', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    localStorage.clear()
  })

  it('shows a validation error when login credentials are missing', async () => {
    await loadApp()

    await click(document.querySelector('button.btn.btn-primary'))

    expect(document.body.textContent).toContain('Введите логин и пароль')
  })

  it('stores the token and opens the app after a successful login', async () => {
    const login = vi.fn().mockResolvedValue({ access_token: 'jwt-token', username: 'chef' })
    const { pageLoads } = await loadApp({ login, me: vi.fn().mockResolvedValue({ username: 'chef' }) })

    await changeValue(document.getElementById('login-username'), 'chef')
    await changeValue(document.getElementById('login-password'), 'secret')
    await click(document.querySelector('button.btn.btn-primary'))
    await flushMicrotasks()

    expect(localStorage.getItem('token')).toBe('jwt-token')
    expect(document.body.textContent).toContain('Вы вошли как chef')
    expect(pageLoads.recipes).toHaveBeenCalled()
    expect(document.querySelector('.nav-item.active').textContent).toContain('Рецепты')
  })

  it('activates the requested page and triggers its loader on navigation', async () => {
    localStorage.setItem('token', 'stored-token')
    const me = vi.fn().mockResolvedValue({ username: 'chef' })
    const { pageLoads } = await loadApp({ me })
    await flushMicrotasks()

    const shoppingButton = Array.from(document.querySelectorAll('.nav-item')).find((button) => button.textContent.includes('Список покупок'))
    await click(shoppingButton)
    await flushMicrotasks()

    expect(document.querySelector('.nav-item.active').textContent).toContain('Список покупок')
    expect(pageLoads.shopping).toHaveBeenCalled()
    expect(pageLoads.recipes).toHaveBeenCalled()
  })
})
