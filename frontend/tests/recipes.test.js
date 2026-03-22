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
      <input id="recipe-material" type="file" />
      <img id="image-preview" alt="preview" src="data:,preview" style="display:none" />
      <div id="image-upload-placeholder" style="display:block"></div>
      <div id="document-upload-filename" style="display:none"></div>
      <input id="recipe-freezer-yes" type="checkbox" />
      <input id="recipe-freezer-no" type="checkbox" checked />
    </div>
    <div id="modal-document-viewer" class="modal-backdrop"></div>
    <iframe id="document-viewer-frame"></iframe>
    <div id="document-viewer-title"></div>
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
        additional_material_path: '/documents/blini.pdf',
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
    expect(gridText).toContain('PDF')
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
    expect(document.getElementById('recipe-freezer-yes').checked).toBe(false)
    expect(document.getElementById('recipe-freezer-no').checked).toBe(true)
    expect(document.getElementById('recipe-title').value).toBe('')
  })

  it('clears the previous image preview when editing a recipe without an image', () => {
    renderRecipeFormShell()

    window.RecipesPage.openEdit({
      id: 1,
      title: 'С картинкой',
      categories: ['закуска'],
      ingredients: 'Тесто',
      recipe: '',
      shopping_list: 'Тесто',
      cooking_method: 'boiling',
      servings: 2,
      cooking_time_minutes: 10,
      active_cooking_time_minutes: null,
      freezer_friendly: false,
      extra_info: '',
      image_path: '/uploads/first.png',
    })

    const preview = document.getElementById('image-preview')
    const placeholder = document.getElementById('image-upload-placeholder')

    expect(preview.getAttribute('src')).toBe('/uploads/first.png')
    expect(preview.style.display).toBe('block')
    expect(placeholder.style.display).toBe('none')

    window.RecipesPage.openEdit({
      id: 2,
      title: 'Без картинки',
      categories: ['закуска'],
      ingredients: 'Фарш',
      recipe: '',
      shopping_list: 'Фарш',
      cooking_method: 'boiling',
      servings: 2,
      cooking_time_minutes: 12,
      active_cooking_time_minutes: null,
      freezer_friendly: false,
      extra_info: '',
      image_path: null,
    })

    expect(preview.hasAttribute('src')).toBe(false)
    expect(preview.style.display).toBe('none')
    expect(placeholder.style.display).toBe('block')
  })

  it('resets recipe form state when the modal is closed', () => {
    renderRecipeFormShell()

    window.RecipesPage.openEdit({
      id: 3,
      title: 'Лазанья',
      categories: ['мясо', 'гарнир'],
      ingredients: 'Листы\nФарш',
      recipe: 'Собрать слои',
      shopping_list: 'Листы\nФарш',
      cooking_method: 'boiling',
      servings: 6,
      cooking_time_minutes: 60,
      active_cooking_time_minutes: 25,
      freezer_friendly: true,
      extra_info: 'Пробный рецепт',
      image_path: '/uploads/lasagna.png',
    })

    window.RecipesPage.closeModal()

    expect(document.getElementById('modal-recipe-form').classList.contains('open')).toBe(false)
    expect(document.getElementById('recipe-id').value).toBe('')
    expect(document.getElementById('recipe-title').value).toBe('')
    expect(document.getElementById('recipe-ingredients').value).toBe('')
    expect(document.getElementById('recipe-instructions').value).toBe('')
    expect(document.getElementById('recipe-shopping').value).toBe('')
    expect(document.getElementById('recipe-extra').value).toBe('')
    expect(document.getElementById('recipe-active-cooking-time').value).toBe('')
    expect(document.getElementById('recipe-cooking-time').value).toBe('')
    expect(document.getElementById('recipe-servings').value).toBe('4')
    expect(document.getElementById('recipe-method').value).toBe('boiling')
    expect(document.getElementById('recipe-freezer-yes').checked).toBe(false)
    expect(document.getElementById('recipe-freezer-no').checked).toBe(true)
    expect(document.getElementById('image-preview').hasAttribute('src')).toBe(false)
    expect(document.getElementById('image-preview').style.display).toBe('none')
    expect(document.getElementById('image-upload-placeholder').style.display).toBe('block')
    expect(document.getElementById('recipe-categories-editor').textContent).toContain('закуска')
  })
})

