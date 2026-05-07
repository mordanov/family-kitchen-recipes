import React from 'react'

import { Badge, Modal } from '../../components'
import { cookingMethodLabel, formatDate, getRecipeEmoji } from '../../utils'
import { RecipeMemberFeedback } from './RecipeMemberFeedback'

export function RecipeDetailModal({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onRecalc,
  onDownloadMaterial,
  onRemoveMaterial,
}) {
  return (
    <Modal
      open={Boolean(recipe)}
      title="Рецепт"
      onClose={onClose}
      maxWidth="720px"
      headerActions={recipe ? (
        <>
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>✏️ Изменить</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑️</button>
        </>
      ) : null}
    >
      {recipe ? (
        <>
          <div className="recipe-detail-header">
            <div className="recipe-detail-img">
              {recipe.image_path ? <img src={recipe.image_path} alt={recipe.title} /> : getRecipeEmoji(recipe.cooking_method)}
            </div>
            <div className="recipe-detail-info">
              <div className="recipe-detail-title">{recipe.title}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge className="badge-primary">{cookingMethodLabel(recipe.cooking_method)}</Badge>
                <Badge>{recipe.servings} порций</Badge>
                {Number.isFinite(recipe.cooking_time_minutes) ? <Badge>⏱ Общее время: {recipe.cooking_time_minutes} мин</Badge> : null}
                {Number.isFinite(recipe.active_cooking_time_minutes) ? <Badge>🔥 Активное время: {recipe.active_cooking_time_minutes} мин</Badge> : null}
                <Badge>{recipe.freezer_friendly ? '❄️ Подходит для морозильной камеры' : '🧊 Не для морозильной камеры'}</Badge>
                <Badge style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Обновлён: {formatDate(recipe.updated_at)}</Badge>
              </div>
              <RecipeMemberFeedback recipe={recipe} compact={false} />
              {recipe.kbju_calculated ? (
                <div className="kbju-big">
                  <div className="kbju-big-item"><span className="val">{recipe.calories?.toFixed(0) ?? '–'}</span><span className="lbl">ккал</span></div>
                  <div className="kbju-big-item accent"><span className="val">{recipe.proteins?.toFixed(1) ?? '–'}</span><span className="lbl">белки г</span></div>
                  <div className="kbju-big-item accent"><span className="val">{recipe.fats?.toFixed(1) ?? '–'}</span><span className="lbl">жиры г</span></div>
                  <div className="kbju-big-item accent"><span className="val">{recipe.carbs?.toFixed(1) ?? '–'}</span><span className="lbl">углев. г</span></div>
                </div>
              ) : (
                <p style={{ marginTop: 12, color: 'var(--c-text-muted)' }}>
                  ⏳ КБЖУ рассчитывается...
                  <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={onRecalc}>Пересчитать</button>
                </p>
              )}
            </div>
          </div>
          <div className="section-title">🏷️ Категория блюда</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(recipe.categories || []).length
              ? recipe.categories.map((category) => <Badge key={category} className="badge-accent">{category}</Badge>)
              : <em>Не указаны</em>}
          </div>
          <div className="section-title">📋 Ингредиенты</div>
          <div className="ingredients-text">{recipe.ingredients || <em>Не указаны</em>}</div>
          {recipe.recipe ? <><div className="section-title">👨‍🍳 Рецепт</div><div className="ingredients-text" style={{ borderColor: 'var(--c-accent)' }}>{recipe.recipe}</div></> : null}
          {recipe.shopping_list ? <><div className="section-title">🛒 Закупочный список</div><div className="ingredients-text" style={{ borderColor: 'var(--c-accent)' }}>{recipe.shopping_list}</div></> : null}
          {recipe.additional_material_path ? (
            <>
              <div className="section-title">📄 Дополнительный материал</div>
              <div className="ingredients-text" style={{ borderColor: 'var(--c-border)' }}>Файл: {recipe.additional_material_original_name || 'material.pdf'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={onDownloadMaterial}>⬇️ Скачать PDF</button>
                <button className="btn btn-danger btn-sm" onClick={onRemoveMaterial}>🗑️ Удалить материал</button>
              </div>
            </>
          ) : null}
          {recipe.extra_info ? <><div className="section-title">📝 Доп. информация</div><div className="ingredients-text" style={{ borderColor: 'var(--c-secondary)' }}>{recipe.extra_info}</div></> : null}
        </>
      ) : null}
    </Modal>
  )
}

