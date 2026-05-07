import React from 'react'

import { Badge } from '../../components'
import { cookingMethodLabel, DAY_LABELS, MEAL_LABELS, MEAL_ORDER } from '../../utils'

function MenuSlotCard({ item, closed, allMembers, onToggleCooked, onRemoveItem, onMakeSameForAll, onMakeDifferentForAll }) {
  const body = item.member_assignments?.length ? item.member_assignments.map((assignment) => {
    const member = allMembers.find((value) => value.id === assignment.member_id)
    return (
      <div key={`${item.id}-${assignment.member_id}`} className="slot-member-row">
        <span className="slot-member-dot" style={{ background: member?.color || '#999' }} />
        <span className="slot-member-name">{member?.name || `#${assignment.member_id}`}:</span>
        <span className="slot-recipe-title">{assignment.recipe?.title || '—'}</span>
      </div>
    )
  }) : (
    <>
      <div className="slot-recipe-title">{item.recipe?.title || 'Удалённый рецепт'}</div>
      {item.recipe?.kbju_calculated ? <div className="slot-meta">{item.recipe.calories?.toFixed(0)} ккал</div> : null}
    </>
  )

  return (
    <div key={item.id} className={`slot-card ${item.is_cooked ? 'cooked' : ''}`}>
      <button className={`slot-card-check ${item.is_cooked ? 'checked' : ''}`} onClick={() => onToggleCooked(item.id, !item.is_cooked)}>{item.is_cooked ? '✓' : ''}</button>
      <div className="slot-card-body">
        {body}
        {!closed && allMembers.length ? (
          <div className="slot-quick-actions">
            <button className="slot-quick-btn" onClick={() => onMakeSameForAll(item)}>👥 Одинаковое всем</button>
            <button className="slot-quick-btn" onClick={() => onMakeDifferentForAll(item)}>🧩 Разные блюда</button>
          </div>
        ) : null}
      </div>
      {!closed ? <button className="slot-remove-btn" onClick={() => onRemoveItem(item.id)}>✕</button> : null}
    </div>
  )
}

function MenuFlatRow({ item, closed, allMembers, preparedByRecipeId, stockNames, onToggleCooked, onRemoveItem }) {
  const preparedServings = item.recipe ? preparedByRecipeId[item.recipe.id] || 0 : 0
  const matchedStock = item.recipe?.shopping_list
    ? item.recipe.shopping_list
      .split('\n')
      .map((line) => line.trim().toLowerCase().split(' ')[0])
      .filter(Boolean)
      .filter((token) => stockNames.has(token)).length
    : 0

  return (
    <div key={item.id} className={`menu-item-row ${item.is_cooked ? 'cooked' : ''}`}>
      <button className={`menu-item-check ${item.is_cooked ? 'checked' : ''}`} onClick={() => onToggleCooked(item.id, !item.is_cooked)}>{item.is_cooked ? '✓' : ''}</button>
      <div style={{ flex: 1 }}>
        <div className="menu-item-title">{item.recipe ? item.recipe.title : (item.member_assignments?.length ? 'Разные блюда' : 'Удалённый рецепт')}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {item.day_of_week ? <Badge style={{ background: 'var(--c-surface2)', color: 'var(--c-text-muted)' }}>{DAY_LABELS[(item.day_of_week - 1) % 7]}</Badge> : null}
          {item.meal_type ? <Badge style={{ background: 'var(--c-surface2)', color: 'var(--c-text-muted)' }}>{MEAL_LABELS[item.meal_type] || item.meal_type}</Badge> : null}
          {item.recipe ? <span className="menu-item-meta">{cookingMethodLabel(item.recipe.cooking_method)} · {item.recipe.servings} порц.</span> : null}
          {item.recipe?.kbju_calculated ? <span className="menu-item-kbju">{item.recipe.calories?.toFixed(0)} ккал</span> : null}
          {preparedServings > 0 ? <Badge style={{ background: '#eef7ff', color: '#2b5a9a' }}>🍱 Заготовка: {preparedServings} порц.</Badge> : null}
          {matchedStock > 0 ? <Badge style={{ background: '#f0fff8', color: '#1f7d4f' }}>✅ На складе: {matchedStock} поз.</Badge> : null}
          {(item.member_assignments || []).map((assignment) => {
            const member = allMembers.find((value) => value.id === assignment.member_id)
            return (
              <Badge key={`${item.id}-${assignment.member_id}`} style={{ background: `${member?.color || '#999'}20`, color: member?.color || '#999', border: '1px solid currentColor' }}>
                {member?.name || `#${assignment.member_id}`}: {assignment.recipe?.title || '—'}
              </Badge>
            )
          })}
        </div>
      </div>
      {!closed ? <button className="btn btn-secondary btn-sm" onClick={() => onRemoveItem(item.id)}>✕</button> : null}
    </div>
  )
}

export function MenuItemsList({
  weekItems,
  usesSlots,
  activeMenu,
  allMembers,
  preparedByRecipeId,
  stockNames,
  onToggleCooked,
  onRemoveItem,
  onMakeSameForAll,
  onMakeDifferentForAll,
}) {
  if (!weekItems.length) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: 'var(--c-text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
        <p>Блюда для этой недели ещё не добавлены</p>
      </div>
    )
  }

  const closed = activeMenu?.status === 'closed'

  if (!usesSlots) {
    return weekItems.map((item) => (
      <MenuFlatRow
        key={item.id}
        item={item}
        closed={closed}
        allMembers={allMembers}
        preparedByRecipeId={preparedByRecipeId}
        stockNames={stockNames}
        onToggleCooked={onToggleCooked}
        onRemoveItem={onRemoveItem}
      />
    ))
  }

  const sortedDays = [...new Set(weekItems.filter((item) => item.day_of_week).map((item) => item.day_of_week))].sort((a, b) => a - b)
  const sortedMeals = MEAL_ORDER.filter((meal) => weekItems.some((item) => item.meal_type === meal))
  const grid = {}
  weekItems.forEach((item) => {
    if (!item.day_of_week || !item.meal_type) return
    grid[item.day_of_week] ||= {}
    grid[item.day_of_week][item.meal_type] ||= []
    grid[item.day_of_week][item.meal_type].push(item)
  })

  return (
    <div className="meal-grid">
      <div className="meal-grid-header">
        <div className="meal-grid-corner" />
        {sortedMeals.map((meal) => <div key={meal} className="meal-grid-meal-label">{MEAL_LABELS[meal]}</div>)}
      </div>
      {sortedDays.map((day) => (
        <div key={day} className="meal-grid-row">
          <div className="meal-grid-day-label">{DAY_LABELS[(day - 1) % 7]}</div>
          {sortedMeals.map((meal) => (
            <div key={`${day}-${meal}`} className="meal-grid-cell">
              {(grid[day]?.[meal] || []).length ? (grid[day]?.[meal] || []).map((item) => (
                <MenuSlotCard
                  key={item.id}
                  item={item}
                  closed={closed}
                  allMembers={allMembers}
                  onToggleCooked={onToggleCooked}
                  onRemoveItem={onRemoveItem}
                  onMakeSameForAll={onMakeSameForAll}
                  onMakeDifferentForAll={onMakeDifferentForAll}
                />
              )) : <div className="meal-grid-empty">—</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

