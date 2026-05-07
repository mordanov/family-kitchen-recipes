import React from 'react'

import { toRgba } from '../../utils'

export function RecipeMemberFeedback({ recipe, compact = true }) {
  const feedback = recipe.member_feedback || []
  if (!feedback.length) return null

  return (
    <>
      {!compact ? <div className="section-title" style={{ marginTop: 10 }}>❤️ Предпочтения семьи</div> : null}
      <div className="recipe-feedback">
        {feedback.map((item) => {
          const color = item.member_color || '#FF6B35'
          const disliked = item.status === 'disliked'
          return (
            <span
              key={`${item.member_id}-${item.status}`}
              className={`recipe-feedback-chip ${disliked ? 'is-disliked' : 'is-preferred'}`}
              style={{
                borderColor: color,
                background: toRgba(color, 0.14),
                color,
              }}
            >
              {disliked ? '💔' : '❤️'} {item.member_name}
            </span>
          )
        })}
      </div>
    </>
  )
}

