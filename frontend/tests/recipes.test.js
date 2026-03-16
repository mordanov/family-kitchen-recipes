import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  })
}

function renderRecipesShell() {
  document.body.innerHTML = '<div id="recipes-grid"></div>'
}

describe('RecipesPage', () => {
  beforeEach(() => {
    renderRecipesShell()
    setGlobal('App', {
      cookingMethodLabel: vi.fn(() => 'Варка'),
      formatDate: vi.fn(() => '15 марта 2026'),
      toast: vi.fn(),
    })
    setGlobal('API', {
      listRecipes: vi.fn(),
      getRecipe: vi.fn(),
      recalcKbju: vi.fn(),
      updateRecipe: vi.fn(),
      createRecipe: vi.fn(),
      deleteRecipe: vi.fn(),
    })

    loadBrowserScript('../../public/js/recipes.js', 'RecipesPage')
  })

  it('renders preferred and disliked family feedback chips using member names', async () => {
    window.API.listRecipes.mockResolvedValue([
      {
        id: 10,
        title: 'Блины',
        ingredients: 'Мука',
        shopping_list: 'Мука',
        cooking_method: 'boiling',
        servings: 2,
        kbju_calculated: true,
        calories: 120,
        proteins: 5,
        fats: 4,
        carbs: 15,
        member_feedback: [
          { member_id: 1, member_name: 'Алиса', member_color: '#4ECDC4', status: 'preferred' },
          { member_id: 2, member_name: 'Борис', member_color: '#FF6B35', status: 'disliked' },
        ],
      },
    ])

    await window.RecipesPage.load()

    const gridText = document.getElementById('recipes-grid').textContent
    expect(gridText).toContain('Алиса')
    expect(gridText).toContain('Борис')
    expect(gridText).toContain('❤️')
    expect(gridText).toContain('💔')
  })
})

