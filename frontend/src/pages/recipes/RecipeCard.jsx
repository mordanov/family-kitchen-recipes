import React from 'react'

import { Badge } from '../../components'
import { cookingMethodLabel, getRecipeEmoji } from '../../utils'
import { RecipeMemberFeedback } from './RecipeMemberFeedback'

export function RecipeCard({ recipe, onOpen }) {
  return (
    <div className="recipe-card" onClick={() => onOpen(recipe)}>
      <div className="recipe-card-img">
        {recipe.image_path ? <img src={recipe.image_path} alt={recipe.title} loading="lazy" /> : getRecipeEmoji(recipe.cooking_method)}
      </div>
      <div className="recipe-card-body">
        <div className="recipe-card-title">{recipe.title}</div>
        <div className="recipe-card-meta">
          <Badge className="badge-primary">{cookingMethodLabel(recipe.cooking_method)}</Badge>
          <Badge>{recipe.servings} порц.</Badge>
          {Number.isFinite(recipe.cooking_time_minutes) ? <Badge>⏱ {recipe.cooking_time_minutes} мин</Badge> : null}
          {Number.isFinite(recipe.active_cooking_time_minutes) ? <Badge>🔥 {recipe.active_cooking_time_minutes} мин активно</Badge> : null}
          {recipe.freezer_friendly ? <Badge>❄️ Для морозилки</Badge> : null}
          {recipe.additional_material_path ? <Badge>📄 PDF</Badge> : null}
          {(recipe.categories || []).slice(0, 3).map((category) => (
            <Badge key={category} className="badge-accent">{category}</Badge>
          ))}
        </div>
        {recipe.kbju_calculated ? (
          <div className="kbju-strip">
            <div className="kbju-item"><div className="kv">{recipe.calories?.toFixed(0) ?? '–'}</div><div className="kl">ккал</div></div>
            <div className="kbju-item"><div className="kv">{recipe.proteins?.toFixed(1) ?? '–'}</div><div className="kl">белки</div></div>
            <div className="kbju-item"><div className="kv">{recipe.fats?.toFixed(1) ?? '–'}</div><div className="kl">жиры</div></div>
            <div className="kbju-item"><div className="kv">{recipe.carbs?.toFixed(1) ?? '–'}</div><div className="kl">углев.</div></div>
          </div>
        ) : (
          <p className="kbju-pending">⏳ КБЖУ рассчитывается...</p>
        )}
        <RecipeMemberFeedback recipe={recipe} />
      </div>
    </div>
  )
}

