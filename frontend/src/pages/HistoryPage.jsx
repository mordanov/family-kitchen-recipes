import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { Badge, EmptyState, Modal, PageHeader, ProgressBar, Spinner } from '../components'
import { DAY_LABELS, formatDate, formatRounded, kbjuFromRecipe } from '../utils'

function buildKbjuMatrix(menu) {
  const members = new Map()
  const hasAssignments = (menu.items || []).some((item) => Array.isArray(item.member_assignments) && item.member_assignments.length)

  for (const member of menu?.kbju_summary?.by_member || []) {
    if (!members.has(member.member_id)) {
      members.set(member.member_id, {
        member_id: member.member_id,
        member_name: member.member_name || `#${member.member_id}`,
        member_color: member.member_color || '#888',
      })
    }
  }

  for (const item of menu.items || []) {
    for (const assignment of item.member_assignments || []) {
      if (!members.has(assignment.member_id)) {
        members.set(assignment.member_id, {
          member_id: assignment.member_id,
          member_name: assignment.member_name || `#${assignment.member_id}`,
          member_color: assignment.member_color || '#888',
        })
      }
    }
  }

  if (!members.size && !hasAssignments) {
    members.set(0, { member_id: 0, member_name: 'Семья', member_color: '#6B6B80' })
  }

  const dayRows = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    cells: Object.fromEntries(Array.from(members.values()).map((member) => [member.member_id, { calories: 0, proteins: 0, fats: 0, carbs: 0 }])),
  }))

  for (const item of menu.items || []) {
    const day = item.day_of_week
    if (!day || day < 1 || day > 7) continue
    const row = dayRows[day - 1]

    if (item.member_assignments?.length) {
      for (const assignment of item.member_assignments) {
        row.cells[assignment.member_id] ||= { calories: 0, proteins: 0, fats: 0, carbs: 0 }
        const kbju = kbjuFromRecipe(assignment.recipe)
        row.cells[assignment.member_id].calories += kbju.calories
        row.cells[assignment.member_id].proteins += kbju.proteins
        row.cells[assignment.member_id].fats += kbju.fats
        row.cells[assignment.member_id].carbs += kbju.carbs
      }
    } else if (row.cells[0] && item.recipe) {
      const kbju = kbjuFromRecipe(item.recipe)
      row.cells[0].calories += kbju.calories
      row.cells[0].proteins += kbju.proteins
      row.cells[0].fats += kbju.fats
      row.cells[0].carbs += kbju.carbs
    }
  }

  return { members: Array.from(members.values()), rows: dayRows }
}

function itemLabel(item) {
  if (item.recipe) return item.recipe.title
  if (item.member_assignments?.length) {
    const namesById = new Map((item.menu_kbju_by_member || []).map((member) => [member.member_id, member.member_name]))
    return item.member_assignments.map((assignment) => `${assignment.member_name || namesById.get(assignment.member_id) || `#${assignment.member_id}`}: ${assignment.recipe?.title || '—'}`).join(' · ')
  }
  return 'Удалённый рецепт'
}

function itemKbju(item) {
  if (item.recipe?.kbju_calculated) return `${item.recipe.calories?.toFixed(0)} ккал`
  if (item.member_assignments?.length) {
    const sum = item.member_assignments.reduce((acc, assignment) => acc + Number(assignment.recipe?.calories || 0), 0)
    return sum > 0 ? `${sum.toFixed(0)} ккал` : ''
  }
  return ''
}

export function HistoryPage({ active, toast }) {
  const [loading, setLoading] = useState(false)
  const [menus, setMenus] = useState([])
  const [selectedMenu, setSelectedMenu] = useState(null)

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      setMenus(await api.listMenus())
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function openMenu(menuId) {
    try {
      setSelectedMenu(await api.getMenu(menuId))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  const matrix = useMemo(() => selectedMenu ? buildKbjuMatrix(selectedMenu) : null, [selectedMenu])

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="История" accent="меню" />
      {loading ? <Spinner /> : null}
      {!loading && !menus.length ? <EmptyState emoji="📚" title="История меню пуста" description="Здесь будут отображаться все созданные меню" /> : null}
      {!loading && menus.length ? (
        <div className="history-list">
          {menus.map((menu) => {
            const total = menu.items.length
            const cooked = menu.items.filter((item) => item.is_cooked).length
            const pct = total ? Math.round((cooked / total) * 100) : 0
            const isClosed = menu.status === 'closed'
            return (
              <div key={menu.id} className={`history-card ${isClosed ? 'closed' : ''}`} onClick={() => openMenu(menu.id)}>
                <div style={{ fontSize: 36 }}>{isClosed ? '📕' : '📖'}</div>
                <div className="history-card-info">
                  <div className="history-card-title">
                    {menu.title}{' '}
                    {isClosed ? <Badge style={{ background: '#e8e8ef', color: '#6B6B80' }}>Закрыто</Badge> : <Badge style={{ background: '#E8FFF2', color: '#2ECC71' }}>● Активное</Badge>}
                  </div>
                  <div className="history-card-meta">
                    {menu.weeks} нед. · {total} блюд · Приготовлено: {cooked}/{total} ({pct}%) · Создано: {formatDate(menu.created_at)}
                    {menu.closed_at ? ` · Закрыто: ${formatDate(menu.closed_at)}` : ''}
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--c-text-muted)', fontSize: 12 }}>КБЖУ-отчёт доступен в деталях меню</div>
                  <div style={{ marginTop: 8 }}><ProgressBar value={pct} /></div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <Modal open={Boolean(selectedMenu)} title={selectedMenu?.title || ''} onClose={() => setSelectedMenu(null)} maxWidth="980px">
        {selectedMenu ? (
          <>
            <p style={{ marginBottom: 20, color: 'var(--c-text-muted)' }}>
              {selectedMenu.weeks} нед. · Создано: {formatDate(selectedMenu.created_at)} · Приготовлено: {selectedMenu.items.filter((item) => item.is_cooked).length}/{selectedMenu.items.length}
            </p>
            <div className="shopping-list-block" style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>КБЖУ по дням и членам семьи</h4>
              {matrix?.members.length ? (
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, background: 'white' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 8, border: '1px solid var(--c-border)', textAlign: 'left' }}>День</th>
                        {matrix.members.map((member) => <th key={member.member_id} style={{ padding: 8, border: '1px solid var(--c-border)', textAlign: 'left', whiteSpace: 'nowrap', color: member.member_color }}>{member.member_name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.rows.map((row) => (
                        <tr key={row.day}>
                          <td style={{ padding: 8, border: '1px solid var(--c-border)', fontWeight: 700 }}>{DAY_LABELS[row.day - 1]}</td>
                          {matrix.members.map((member) => {
                            const cell = row.cells[member.member_id] || { calories: 0, proteins: 0, fats: 0, carbs: 0 }
                            return (
                              <td key={`${row.day}-${member.member_id}`} style={{ padding: 8, border: '1px solid var(--c-border)', verticalAlign: 'top', fontSize: 12, lineHeight: 1.45 }}>
                                К {formatRounded(cell.calories)}<br />Б {formatRounded(cell.proteins)} · Ж {formatRounded(cell.fats)} · У {formatRounded(cell.carbs)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p style={{ color: 'var(--c-text-muted)' }}>Нет данных КБЖУ</p>}
            </div>
            {Array.from({ length: selectedMenu.weeks }, (_, index) => index + 1).map((week) => {
              const items = selectedMenu.items.filter((item) => item.week_number === week).map((item) => ({ ...item, menu_kbju_by_member: selectedMenu?.kbju_summary?.by_member || [] }))
              if (!items.length) return null
              return (
                <div key={week} style={{ marginBottom: 20 }}>
                  <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--c-primary)', marginBottom: 12 }}>Неделя {week}</h4>
                  {items.map((item) => {
                    const kbju = itemKbju(item)
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: item.is_cooked ? '#F0FFF8' : 'var(--c-surface2)', borderRadius: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{item.is_cooked ? '✅' : '⬜'}</span>
                        <span style={{ fontWeight: 700, textDecoration: item.is_cooked ? 'line-through' : 'none', opacity: item.is_cooked ? 0.6 : 1 }}>{itemLabel(item)}</span>
                        {kbju ? <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-primary)', fontWeight: 700 }}>{kbju}</span> : null}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        ) : null}
      </Modal>
    </div>
  )
}

