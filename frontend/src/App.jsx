import React, { useEffect, useState } from 'react'

import { api } from './api'
import { ToastContainer } from './components'
import { HistoryPage } from './pages/HistoryPage'
import { MembersPage } from './pages/MembersPage'
import { MenuPage } from './pages/MenuPage'
import { RecipesPage } from './pages/RecipesPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { WarehousePage } from './pages/WarehousePage'

const NAV_ITEMS = [
  { key: 'recipes', icon: '🍽️', label: 'Рецепты' },
  { key: 'menu', icon: '📅', label: 'Меню' },
  { key: 'shopping', icon: '🛒', label: 'Список покупок' },
  { key: 'warehouse', icon: '🏪', label: 'Склад' },
  { key: 'members', icon: '👨‍👩‍👧', label: 'Семья' },
  { key: 'settings', icon: '⚙️', label: 'Настройки' },
  { key: 'history', icon: '📚', label: 'История меню' },
]

export default function App() {
  const [booting, setBooting] = useState(true)
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [currentUser, setCurrentUser] = useState(null)
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [page, setPage] = useState('recipes')
  const [toasts, setToasts] = useState([])
  const [quickConfirmDisabled, setQuickConfirmDisabled] = useState(() => localStorage.getItem('menu.quickActions.skipConfirm') === '1')
  const [quickActions, setQuickActions] = useState({ open: false, message: '', onConfirm: null, skipNext: false, skipConfirm: quickConfirmDisabled })

  useEffect(() => {
    setQuickActions((prev) => ({ ...prev, skipConfirm: quickConfirmDisabled }))
  }, [quickConfirmDisabled])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      if (!token) {
        setBooting(false)
        return
      }
      try {
        const user = await api.me()
        if (!cancelled) {
          setCurrentUser(user)
        }
      } catch {
        localStorage.removeItem('token')
        if (!cancelled) {
          setToken('')
          setCurrentUser(null)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [token])

  function toast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' }
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type, icon: icons[type] || 'ℹ️' }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3500)
  }

  async function login() {
    if (!authForm.username.trim() || !authForm.password) {
      setAuthError('Введите логин и пароль')
      return
    }
    try {
      const response = await api.login(authForm.username.trim(), authForm.password)
      localStorage.setItem('token', response.access_token)
      setToken(response.access_token)
      setCurrentUser({ username: response.username })
      setAuthError('')
      setAuthForm((prev) => ({ ...prev, password: '' }))
    } catch {
      setAuthError('Неверный логин или пароль')
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken('')
    setCurrentUser(null)
    setAuthForm((prev) => ({ ...prev, password: '' }))
    setPage('recipes')
  }

  const isAuthenticated = Boolean(token && currentUser)

  return (
    <>
      {booting ? <div className="boot-screen"><div className="spinner" /></div> : null}
      {!booting && !isAuthenticated ? (
        <div id="auth-screen">
          <div className="auth-card">
            <div className="auth-logo">
              <span className="emoji">📖</span>
              <h1>Книга семейных рецептов</h1>
            </div>
            {authError ? <div className="auth-error">{authError}</div> : null}
            <div className="form-group">
              <label htmlFor="login-username">Имя пользователя</label>
              <input id="login-username" type="text" value={authForm.username} autoComplete="username" onChange={(event) => setAuthForm((prev) => ({ ...prev, username: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && document.getElementById('login-password')?.focus()} />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Пароль</label>
              <input id="login-password" type="password" value={authForm.password} autoComplete="current-password" onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))} onKeyDown={(event) => event.key === 'Enter' && login()} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={login}>Войти</button>
          </div>
        </div>
      ) : null}

      {!booting && isAuthenticated ? (
        <div id="app" style={{ display: 'block' }}>
          <aside className="app-sidebar">
            <div className="sidebar-logo">
              <span className="emoji">📖</span>
              <h2>Книга рецептов</h2>
            </div>
            <div className="sidebar-user">Вы вошли как <span>{currentUser.username}</span></div>
            <nav className="sidebar-nav">
              {NAV_ITEMS.map((item) => (
                <button key={item.key} className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => setPage(item.key)}>
                  <span className="nav-icon">{item.icon}</span> {item.label}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <button className="btn-logout" onClick={logout}>← Выйти</button>
            </div>
          </aside>
          <main className="main-content">
            <RecipesPage active={page === 'recipes'} toast={toast} />
            <MenuPage active={page === 'menu'} toast={toast} quickActions={quickActions} setQuickActions={setQuickActions} />
            <ShoppingPage active={page === 'shopping'} toast={toast} navigate={setPage} />
            <WarehousePage active={page === 'warehouse'} toast={toast} />
            <MembersPage active={page === 'members'} toast={toast} />
            <SettingsPage active={page === 'settings'} toast={toast} quickConfirmDisabled={quickConfirmDisabled} setQuickConfirmDisabled={setQuickConfirmDisabled} />
            <HistoryPage active={page === 'history'} toast={toast} />
          </main>
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
    </>
  )
}


