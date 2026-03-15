import { afterEach, beforeEach, vi } from 'vitest'

function resetGlobal(name) {
  Object.defineProperty(globalThis, name, {
    value: undefined,
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()

  resetGlobal('API')
  resetGlobal('App')
  resetGlobal('MenuPage')
  resetGlobal('RecipesPage')
  resetGlobal('ShoppingPage')
  resetGlobal('HistoryPage')

  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('location', { reload: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
