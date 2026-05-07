import React from 'react'
import { describe, expect, it } from 'vitest'

import { renderReact } from './helpers/renderReact'
import { RecipeCard } from '../src/pages/recipes/RecipeCard'
import { RecipeDetailModal } from '../src/pages/recipes/RecipeDetailModal'
import { buildRecipeFormData, createEmptyRecipeForm } from '../src/pages/recipes/recipeForm'

describe('Recipes React modules', () => {
  it('renders preferred and disliked family feedback chips using member names', async () => {
    await renderReact(React.createElement(RecipeCard, {
      recipe: {
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
      onOpen: () => {},
    }))

    expect(document.body.textContent).toContain('Алиса')
    expect(document.body.textContent).toContain('Борис')
    expect(document.body.textContent).toContain('❤️')
    expect(document.body.textContent).toContain('💔')
    expect(document.body.textContent).toContain('напитки')
    expect(document.body.textContent).toContain('15 мин')
    expect(document.body.textContent).toContain('5 мин активно')
    expect(document.body.textContent).toContain('Для морозилки')
    expect(document.body.textContent).toContain('PDF')
  })

  it('saves active cooking time and freezer flag in recipe form data', () => {
    const submitted = buildRecipeFormData({
      id: '',
      title: 'Пельмени',
      cooking_method: '1',
      servings: 4,
      active_cooking_time_minutes: '20',
      cooking_time_minutes: '45',
      ingredients: 'Тесто\nФарш',
      recipe: '',
      shopping_list: 'Тесто\nФарш',
      extra_info: '',
      freezer_friendly: true,
      categories: ['1'],
      imageFile: null,
      materialFile: null,
      imagePreview: '',
      additionalMaterialName: '',
    })

    expect(submitted.get('active_cooking_time_minutes')).toBe('20')
    expect(submitted.get('cooking_time_minutes')).toBe('45')
    expect(submitted.get('freezer_friendly')).toBe('true')
    expect(submitted.getAll('categories')).toEqual(['1'])
  })

  it('creates a clean default recipe form using the first method and category', () => {
    const form = createEmptyRecipeForm(
      [{ id: 7, emoji: '🫕', name: 'Варка' }],
      [{ id: 4, name: 'закуска' }],
    )

    expect(form.title).toBe('')
    expect(form.cooking_method).toBe('7')
    expect(form.categories).toEqual(['4'])
    expect(form.freezer_friendly).toBe(false)
    expect(form.imagePreview).toBe('')
  })

  it('shows recipe detail data and material actions in the detail modal', async () => {
    await renderReact(React.createElement(RecipeDetailModal, {
      recipe: {
        id: 3,
        title: 'Лазанья',
        categories: ['мясо', 'гарнир'],
        ingredients: 'Листы\nФарш',
        recipe: 'Собрать слои',
        shopping_list: 'Листы\nФарш',
        cooking_method: { id: 1, name: 'Варка', emoji: '🫕' },
        servings: 6,
        cooking_time_minutes: 60,
        active_cooking_time_minutes: 25,
        freezer_friendly: true,
        extra_info: 'Пробный рецепт',
        image_path: '/uploads/lasagna.png',
        kbju_calculated: true,
        calories: 360,
        proteins: 20,
        fats: 12,
        carbs: 33,
        updated_at: '2026-03-15T12:00:00Z',
        additional_material_path: '/documents/lasagna.pdf',
        additional_material_original_name: 'lasagna.pdf',
        member_feedback: [],
      },
      onClose: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onRecalc: () => {},
      onDownloadMaterial: () => {},
      onRemoveMaterial: () => {},
    }))

    expect(document.body.textContent).toContain('Лазанья')
    expect(document.body.textContent).toContain('Подходит для морозильной камеры')
    expect(document.body.textContent).toContain('lasagna.pdf')
    expect(document.body.textContent).toContain('Собрать слои')
    expect(document.body.textContent).toContain('Пробный рецепт')
    expect(document.body.textContent).toContain('Скачать PDF')
  })
})

