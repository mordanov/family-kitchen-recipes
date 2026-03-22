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

function renderRecipeFormShell() {
  document.body.innerHTML = `
    <div id="recipes-grid"></div>
    <input id="recipe-search" value="" />
    <div id="modal-recipe-form" class="modal-backdrop">
      <input id="recipe-id" value="" />
      <div id="modal-recipe-title"></div>
      <span id="save-recipe-btn-text"></span>
      <input id="recipe-title" value="" />
      <select id="recipe-method"><option value="boiling">boiling</option></select>
      <input id="recipe-servings" value="4" />
      <input id="recipe-active-cooking-time" value="" />
      <input id="recipe-cooking-time" value="" />
      <textarea id="recipe-ingredients"></textarea>
      <textarea id="recipe-instructions"></textarea>
      <textarea id="recipe-shopping"></textarea>
      <textarea id="recipe-extra"></textarea>
      <div id="recipe-categories-editor"></div>
      <input id="recipe-image" type="file" />
      <img id="image-preview" alt="preview" src="data:,preview" style="display:none" />
      <div id="image-upload-placeholder" style="display:block"></div>
      <input id="recipe-freezer-yes" type="checkbox" />
      <input id="recipe-freezer-no" type="checkbox" checked />
    </div>
  `
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
        categories: ['напитки'],
        ingredients: 'Мука',
        shopping_list: 'Мука',
        cooking_method: 'boiling',
        servings: 2,
        cooking_time_minutes: 15,
        active_cooking_time_minutes: 5,
        freezer_friendly: true,
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
    expect(gridText).toContain('напитки')
    expect(gridText).toContain('15 мин')
    expect(gridText).toContain('5 мин активно')
    expect(gridText).toContain('Для морозилки')
  })

  it('saves active cooking time and freezer flag from the recipe form', async () => {
    renderRecipeFormShell()
    window.API.createRecipe.mockResolvedValue({ id: 77 })
    window.API.listRecipes.mockResolvedValue([])

    window.RecipesPage.openCreate()

    expect(document.getElementById('recipe-freezer-no').checked).toBe(true)
    expect(document.getElementById('recipe-freezer-yes').checked).toBe(false)

    document.getElementById('recipe-title').value = 'Пельмени'
    document.getElementById('recipe-ingredients').value = 'Тесто\nФарш'
    document.getElementById('recipe-shopping').value = 'Тесто\nФарш'
    document.getElementById('recipe-active-cooking-time').value = '20'
    document.getElementById('recipe-cooking-time').value = '45'
    window.RecipesPage.setFreezerFriendly(true)

    await window.RecipesPage.saveRecipe()

    expect(window.API.createRecipe).toHaveBeenCalledTimes(1)
    const submitted = window.API.createRecipe.mock.calls[0][0]
    expect(submitted.get('active_cooking_time_minutes')).toBe('20')
    expect(submitted.get('cooking_time_minutes')).toBe('45')
    expect(submitted.get('freezer_friendly')).toBe('true')
    expect(document.getElementById('recipe-freezer-yes').checked).toBe(true)
    expect(document.getElementById('recipe-freezer-no').checked).toBe(false)
  })
})

