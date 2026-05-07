import React from 'react'

import { DAY_LABELS } from '../../utils'

export function MenuAddPanel({
  currentWeek,
  allMembers,
  allRecipes,
  addItemDay,
  addItemMealType,
  pendingAssignments,
  selectedRecipeId,
  onAddDayChange,
  onAddMealChange,
  onMemberAssignmentChange,
  onAddAssignmentsOnly,
  onSelectedRecipeChange,
  onAddSharedRecipe,
}) {
  return (
    <div className="add-recipe-panel">
      <h4>➕ Добавить блюдо в меню (неделя {currentWeek})</h4>
      <div className="form-row" style={{ gap: 8, marginBottom: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">День</label>
          <select className="form-control" value={addItemDay} onChange={(event) => onAddDayChange(event.target.value)}>
            <option value="">— без дня —</option>
            {DAY_LABELS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Приём пищи</label>
          <select className="form-control" value={addItemMealType} onChange={(event) => onAddMealChange(event.target.value)}>
            <option value="">— без приёма —</option>
            <option value="breakfast">🌅 Завтрак</option>
            <option value="lunch">☀️ Обед</option>
            <option value="dinner">🌙 Ужин</option>
          </select>
        </div>
      </div>

      {allMembers.length ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 6 }}>Назначение по членам семьи (необязательно)</div>
          {allMembers.map((member) => (
            <div key={member.id} className="member-assignment-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="member-dot" style={{ background: member.color, width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontSize: 13, minWidth: 80 }}>{member.name}</span>
              <select
                className="form-control"
                style={{ flex: 1, fontSize: 13 }}
                value={pendingAssignments[member.id] || ''}
                onChange={(event) => onMemberAssignmentChange(member.id, event.target.value)}
              >
                <option value="">— как у всех —</option>
                {allRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
              </select>
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }} onClick={onAddAssignmentsOnly}>+ Добавить назначения членам семьи</button>
          <hr className="divider" style={{ margin: '14px 0' }} />
        </div>
      ) : null}

      <div className="form-group" style={{ marginBottom: 10 }}>
        <label className="form-label">Общее блюдо для всей семьи</label>
        <select id="add-item-recipe-select" className="form-control" value={selectedRecipeId} onChange={(event) => onSelectedRecipeChange(event.target.value)}>
          <option value="">— выберите рецепт —</option>
          {allRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onAddSharedRecipe}>+ Добавить общее блюдо</button>
    </div>
  )
}

