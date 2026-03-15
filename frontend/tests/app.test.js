import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderAppShell() {
  document.body.innerHTML = `
    <div id="auth-screen" style="display:flex"></div>
    <div id="app" style="display:none"></div>
    <input id="login-username" value="" />
    <input id="login-password" value="" />
    <div id="auth-error" style="display:none"></div>
    <div id="sidebar-username"></div>
    <div id="toast-container"></div>

    <button class="nav-item" data-page="recipes"></button>
    <button class="nav-item" data-page="menu"></button>
    <button class="nav-item" data-page="shopping"></button>
    <button class="nav-item" data-page="history"></button>

    <section id="page-recipes" class="page"></section>
    <section id="page-menu" class="page"></section>
    <section id="page-shopping" class="page"></section>
    <section id="page-history" class="page"></section>
  `
}

function stubPages() {
  setGlobal('RecipesPage', { load: vi.fn() })
  setGlobal('MenuPage', { load: vi.fn() })
  setGlobal('ShoppingPage', { load: vi.fn() })
  setGlobal('HistoryPage', { load: vi.fn() })
}

describe('App', () => {
  beforeEach(() => {
    renderAppShell()
    stubPages()
    setGlobal('API', {
      login: vi.fn(),
      me: vi.fn(),
    })

    loadBrowserScript('../../public/js/app.js', 'App')
  })

  it('shows a validation error when login credentials are missing', async () => {
    await window.App.login()

    expect(window.API.login).not.toHaveBeenCalled()
    expect(document.getElementById('auth-error').textContent).toContain('Введите логин и пароль')
    expect(document.getElementById('auth-error').style.display).toBe('block')
  })

  it('stores the token and opens the app after a successful login', async () => {
    document.getElementById('login-username').value = 'chef'
    document.getElementById('login-password').value = 'secret'
    window.API.login.mockResolvedValue({ access_token: 'jwt-token', username: 'chef' })

    await window.App.login()

    expect(localStorage.getItem('token')).toBe('jwt-token')
    expect(document.getElementById('auth-screen').style.display).toBe('none')
    expect(document.getElementById('app').style.display).toBe('block')
    expect(document.getElementById('sidebar-username').textContent).toBe('chef')
    expect(window.RecipesPage.load).toHaveBeenCalledTimes(1)
    expect(document.getElementById('page-recipes').classList.contains('active')).toBe(true)
    expect(document.querySelector('.nav-item[data-page="recipes"]').classList.contains('active')).toBe(true)
  })

  it('activates the requested page and triggers its loader on navigation', () => {
    window.App.navigate('shopping')

    expect(document.getElementById('page-shopping').classList.contains('active')).toBe(true)
    expect(document.querySelector('.nav-item[data-page="shopping"]').classList.contains('active')).toBe(true)
    expect(window.ShoppingPage.load).toHaveBeenCalledTimes(1)
    expect(window.RecipesPage.load).not.toHaveBeenCalled()
  })
})
