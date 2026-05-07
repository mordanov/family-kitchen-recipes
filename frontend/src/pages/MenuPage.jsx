import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { ConfirmOverlay, EmptyState, Modal, PageHeader, Spinner } from '../components'
import { DAY_LABELS, MEAL_LABELS, MEAL_ORDER, presetMenuTitle } from '../utils'
import { MenuAddPanel } from './menu/MenuAddPanel'
import { MenuItemsList } from './menu/MenuItemsList'
import { MenuStatusBanner } from './menu/MenuStatusBanner'

function isMealSlotMenu(menu) {
  return Boolean(menu?.items?.some((item) => item.meal_type && item.day_of_week))
}

function buildAssignments(pendingAssignments) {
  return Object.entries(pendingAssignments)
    .filter(([memberId, recipeId]) => memberId !== '__shared' && Number.isFinite(Number(memberId)) && recipeId)
    .map(([memberId, recipeId]) => ({
      member_id: Number(memberId),
      recipe_id: recipeId,
    }))
}

export function MenuPage({ active, toast, quickActions, setQuickActions }) {
  const [loading, setLoading] = useState(false)
  const [activeMenu, setActiveMenu] = useState(null)
  const [currentWeek, setCurrentWeek] = useState(1)
  const [allRecipes, setAllRecipes] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [preparedByRecipeId, setPreparedByRecipeId] = useState({})
  const [stockNames, setStockNames] = useState(new Set())
  const [addItemMealType, setAddItemMealType] = useState('')
  const [addItemDay, setAddItemDay] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [pendingAssignments, setPendingAssignments] = useState({})
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ title: '', weeks: 1 })
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoForm, setAutoForm] = useState({
    title: presetMenuTitle(),
    weeks: 1,
    recipes_per_week: 5,
    use_meal_slots: false,
    meals: ['breakfast', 'lunch', 'dinner'],
    days: [1, 2, 3, 4, 5, 6, 7],
  })
  const [shoppingModalData, setShoppingModalData] = useState(null)

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const [activeMenuRes, recipesRes, preparedRes, stockRes, membersRes] = await Promise.allSettled([
        api.getActiveMenu(),
        api.listRecipes(),
        api.listPrepared(),
        api.listStock(),
        api.listMembers(),
      ])

      const menu = activeMenuRes.status === 'fulfilled' ? activeMenuRes.value : null
      const recipes = recipesRes.status === 'fulfilled' ? recipesRes.value : []
      const members = membersRes.status === 'fulfilled' ? membersRes.value : []

      const preparedMap = {}
      if (preparedRes.status === 'fulfilled') {
        for (const item of preparedRes.value || []) {
          preparedMap[item.recipe_id] = (preparedMap[item.recipe_id] || 0) + Number(item.servings || 0)
        }
      }

      const nextStockNames = new Set()
      if (stockRes.status === 'fulfilled') {
        for (const item of stockRes.value || []) {
          if (item.name) nextStockNames.add(String(item.name).trim().toLowerCase())
        }
      }

      setActiveMenu(menu)
      setAllRecipes(recipes)
      setAllMembers(members)
      setPreparedByRecipeId(preparedMap)
      setStockNames(nextStockNames)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const weekItems = useMemo(() => {
    return (activeMenu?.items || [])
      .filter((item) => item.week_number === currentWeek)
      .sort((a, b) => a.position - b.position)
  }, [activeMenu, currentWeek])

  async function addItem(recipeId = null) {
    if (!activeMenu) return
    try {
      const updated = await api.addMenuItem(activeMenu.id, {
        recipe_id: recipeId,
        week_number: currentWeek,
        day_of_week: addItemDay ? Number(addItemDay) : null,
        meal_type: addItemMealType || null,
        member_assignments: buildAssignments(pendingAssignments),
      })
      setActiveMenu(updated)
      setPendingAssignments({})
      setSelectedRecipeId('')
      toast(recipeId ? 'Блюдо добавлено в меню' : 'Блюда добавлены в меню', 'success')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function toggleCooked(itemId, isCooked) {
    if (!activeMenu) return
    try {
      setActiveMenu(await api.updateMenuItem(activeMenu.id, itemId, { is_cooked: isCooked }))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function removeItem(itemId) {
    if (!activeMenu) return
    try {
      setActiveMenu(await api.removeMenuItem(activeMenu.id, itemId))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function confirmClose() {
    if (!activeMenu) return
    if (!window.confirm('Закрыть меню досрочно? Его можно будет просмотреть в истории.')) return
    try {
      await api.closeMenu(activeMenu.id)
      toast('Меню закрыто', 'success')
      await load()
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function openShoppingList() {
    if (!activeMenu) {
      toast('Нет активного меню', 'error')
      return
    }

    try {
      setShoppingModalData(await api.getShoppingList(activeMenu.id))
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function createMenu() {
    if (!createForm.title.trim()) {
      toast('Введите название меню', 'error')
      return
    }
    try {
      await api.createMenu({ title: createForm.title.trim(), weeks: Number(createForm.weeks) })
      setCreateModalOpen(false)
      setCreateForm({ title: '', weeks: 1 })
      setCurrentWeek(1)
      await load()
      toast('Меню создано!', 'success')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function createAutoMenu() {
    if (!autoForm.title.trim()) {
      toast('Введите название меню', 'error')
      return
    }
    if (!autoForm.use_meal_slots && (Number(autoForm.recipes_per_week) < 1 || Number(autoForm.recipes_per_week) > 21)) {
      toast('Укажите от 1 до 21 блюда в неделю', 'error')
      return
    }

    const payload = {
      use_meal_slots: autoForm.use_meal_slots,
      days: autoForm.days,
      meals: autoForm.meals,
    }
    if (!autoForm.use_meal_slots) payload.recipes_per_week = Number(autoForm.recipes_per_week)

    try {
      let menu = null
      const created = await api.createMenu({ title: autoForm.title.trim(), weeks: Number(autoForm.weeks) }).then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error }),
      )

      if (created.ok) {
        menu = created.value
      } else {
        const message = String(created.error?.message || '')
        const activeExists = message.includes('Уже есть активное меню') || message.toLowerCase().includes('active menu')

        if (!activeExists) {
          toast(`Ошибка: ${created.error?.message || 'Не удалось создать меню'}`, 'error')
          return
        }

        const existing = await api.getActiveMenu().catch(() => null)
        if (existing && Array.isArray(existing.items) && existing.items.length === 0) {
          const result = await api.autoFillMenu(existing.id, payload)
          setAutoModalOpen(false)
          setCurrentWeek(1)
          await load()
          const added = result?.added || 0
          toast(
            added > 0 ? `Заполнил текущее активное меню: добавлено ${added} блюд` : 'Текущее активное меню найдено, но блюда не добавлены',
            added > 0 ? 'success' : 'info',
          )
          return
        }

        setAutoModalOpen(false)
        await load()
        toast('Уже есть активное меню. Закройте текущее меню или очистите его перед авто-подбором.', 'error')
        return
      }

      const result = await api.autoFillMenu(menu.id, payload).catch((fillError) => {
        toast(`Меню создано, но авто-подбор не удался: ${fillError.message}`, 'error')
        return { added: 0 }
      })

      setAutoModalOpen(false)
      setCurrentWeek(1)
      await load()
      const added = result?.added || 0
      toast(added > 0 ? `Готово! Добавлено ${added} блюд в меню` : 'Меню создано, блюда не добавлены', added > 0 ? 'success' : 'info')
    } catch (error) {
      toast(`Ошибка: ${error.message}`, 'error')
    }
  }

  async function confirmQuickAction(message, action) {
    if (quickActions.skipConfirm) {
      await action()
      return
    }
    setQuickActions((prev) => ({
      ...prev,
      open: true,
      message,
      onConfirm: action,
    }))
  }

  async function makeSameForAll(item) {
    await confirmQuickAction('Назначить одинаковое блюдо всем членам семьи в этом слоте?', async () => {
      let recipeId = item?.recipe_id || item?.recipe?.id
      if (!recipeId && item?.member_assignments?.length) recipeId = item.member_assignments[0].recipe_id
      if (!recipeId) {
        toast('Нет базового блюда для копирования', 'error')
        return
      }
      try {
        setActiveMenu(await api.setItemAssignments(activeMenu.id, item.id, allMembers.map((member) => ({ member_id: member.id, recipe_id: recipeId }))))
        toast('Назначено одинаковое блюдо всем', 'success')
      } catch (error) {
        toast(`Ошибка: ${error.message}`, 'error')
      }
    })
  }

  async function makeDifferentForAll(item) {
    await confirmQuickAction('Подобрать разные блюда для каждого члена семьи в этом слоте? Текущие назначения будут перезаписаны.', async () => {
      if (!allRecipes.length) {
        toast('Нет рецептов для назначения', 'error')
        return
      }
      const used = new Set()
      const assignments = []
      for (const member of allMembers) {
        let chosenId = null
        const preferredIds = Array.isArray(member.preferred_recipe_ids) ? member.preferred_recipe_ids : []
        for (const recipeId of preferredIds) {
          if (!used.has(recipeId) && allRecipes.some((recipe) => recipe.id === recipeId)) {
            chosenId = recipeId
            break
          }
        }
        if (!chosenId) chosenId = allRecipes.find((recipe) => !used.has(recipe.id))?.id || allRecipes[0]?.id
        if (!chosenId) continue
        used.add(chosenId)
        assignments.push({ member_id: member.id, recipe_id: chosenId })
      }
      try {
        setActiveMenu(await api.setItemAssignments(activeMenu.id, item.id, assignments))
        toast('Назначены разные блюда по членам семьи', 'success')
      } catch (error) {
        toast(`Ошибка: ${error.message}`, 'error')
      }
    })
  }

  const usesSlots = isMealSlotMenu(activeMenu)
  const totalItems = activeMenu?.items?.length || 0
  const cookedItems = activeMenu?.items?.filter((item) => item.is_cooked).length || 0
  const progress = totalItems ? Math.round((cookedItems / totalItems) * 100) : 0

  if (!active) return <div className="page" />

  return (
    <div className="page active">
      <PageHeader
        title="Активное"
        accent="меню"
        actions={(
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={openShoppingList}>🛒 Список покупок</button>
            <button className="btn btn-secondary" onClick={() => { setAutoForm((prev) => ({ ...prev, title: presetMenuTitle() })); setAutoModalOpen(true) }}>🎲 Авто-подбор</button>
            <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>+ Новое меню</button>
          </div>
        )}
      />

      {loading ? <Spinner /> : null}
      {!loading && !activeMenu ? (
        <EmptyState
          emoji="📅"
          title="Нет активного меню"
          description="Создайте меню вручную или воспользуйтесь авто-подбором"
          actions={
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>+ Создать меню</button>
              <button className="btn btn-secondary" onClick={() => setAutoModalOpen(true)}>🎲 Авто-подбор</button>
            </div>
          }
        />
      ) : null}

      {!loading && activeMenu ? (
        <>
          <MenuStatusBanner menu={activeMenu} totalItems={totalItems} cookedItems={cookedItems} progress={progress} onClose={confirmClose} />

          <div className="weeks-tabs">
            {Array.from({ length: activeMenu.weeks }, (_, index) => index + 1).map((week) => (
              <button key={week} className={`week-tab ${currentWeek === week ? 'active' : ''}`} onClick={() => setCurrentWeek(week)}>Неделя {week}</button>
            ))}
          </div>

          <div className="menu-items-list">
            <MenuItemsList
              weekItems={weekItems}
              usesSlots={usesSlots}
              activeMenu={activeMenu}
              allMembers={allMembers}
              preparedByRecipeId={preparedByRecipeId}
              stockNames={stockNames}
              onToggleCooked={toggleCooked}
              onRemoveItem={removeItem}
              onMakeSameForAll={makeSameForAll}
              onMakeDifferentForAll={makeDifferentForAll}
            />
          </div>

          {activeMenu.status !== 'closed' ? (
            <MenuAddPanel
              currentWeek={currentWeek}
              allMembers={allMembers}
              allRecipes={allRecipes}
              addItemDay={addItemDay}
              addItemMealType={addItemMealType}
              pendingAssignments={pendingAssignments}
              selectedRecipeId={selectedRecipeId}
              onAddDayChange={setAddItemDay}
              onAddMealChange={setAddItemMealType}
              onMemberAssignmentChange={(memberId, value) => setPendingAssignments((prev) => {
                const next = { ...prev }
                if (value) next[memberId] = Number(value)
                else delete next[memberId]
                return next
              })}
              onAddAssignmentsOnly={() => addItem(null)}
              onSelectedRecipeChange={setSelectedRecipeId}
              onAddSharedRecipe={() => {
                const recipeId = Number(selectedRecipeId)
                if (!recipeId) {
                  toast('Выберите рецепт из списка', 'error')
                  return
                }
                addItem(recipeId)
              }}
            />
          ) : null}
        </>
      ) : null}

      <Modal
        open={createModalOpen}
        title="Новое меню"
        onClose={() => setCreateModalOpen(false)}
        maxWidth="460px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={createMenu}>Создать меню</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Название меню</label>
          <input className="form-control" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Количество недель</label>
          <select className="form-control" value={createForm.weeks} onChange={(event) => setCreateForm((prev) => ({ ...prev, weeks: Number(event.target.value) }))}>
            {[1, 2, 3, 4].map((week) => <option key={week} value={week}>{week} {week === 1 ? 'неделя' : 'недели'}</option>)}
          </select>
        </div>
      </Modal>

      <Modal
        open={autoModalOpen}
        title="🎲 Авто-подбор меню"
        onClose={() => setAutoModalOpen(false)}
        maxWidth="520px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setAutoModalOpen(false)}>Отмена</button>
            <button className="btn btn-primary" onClick={createAutoMenu}>🎲 Подобрать меню</button>
          </>
        )}
      >
        <div style={{ background: 'var(--c-surface2)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.7, borderLeft: '4px solid var(--c-primary)' }}>
          <strong>Как работает авто-подбор:</strong><br />
          🥇 Любимые блюда членов семьи + совпадение со складом<br />
          🥈 Просто любимые блюда · 🥉 Нейтральные рецепты<br />
          🔄 Рецепты прошлого меню — в конце каждой группы
        </div>
        <div className="form-group">
          <label className="form-label">Название меню</label>
          <input className="form-control" value={autoForm.title} onChange={(event) => setAutoForm((prev) => ({ ...prev, title: event.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Количество недель</label>
            <select className="form-control" value={autoForm.weeks} onChange={(event) => setAutoForm((prev) => ({ ...prev, weeks: Number(event.target.value) }))}>
              {[1, 2, 3, 4].map((week) => <option key={week} value={week}>{week} неделя</option>)}
            </select>
          </div>
          {!autoForm.use_meal_slots ? (
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Блюд в неделю</label>
              <input type="number" min="1" max="21" className="form-control" value={autoForm.recipes_per_week} onChange={(event) => setAutoForm((prev) => ({ ...prev, recipes_per_week: Number(event.target.value) }))} />
            </div>
          ) : null}
        </div>
        <div style={{ border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={autoForm.use_meal_slots} onChange={(event) => setAutoForm((prev) => ({ ...prev, use_meal_slots: event.target.checked }))} />
            Режим завтрак / обед / ужин (по дням)
          </label>
          {autoForm.use_meal_slots ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Приёмы пищи:</div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {MEAL_ORDER.map((meal) => (
                  <label key={meal} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoForm.meals.includes(meal)}
                      onChange={(event) => setAutoForm((prev) => ({
                        ...prev,
                        meals: event.target.checked ? [...prev.meals, meal] : prev.meals.filter((value) => value !== meal),
                      }))}
                    />
                    {MEAL_LABELS[meal]}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Дни недели:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DAY_LABELS.map((day, index) => (
                  <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoForm.days.includes(index + 1)}
                      onChange={(event) => setAutoForm((prev) => ({
                        ...prev,
                        days: event.target.checked ? [...prev.days, index + 1] : prev.days.filter((value) => value !== index + 1),
                      }))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(shoppingModalData)} title="🛒 Список покупок" onClose={() => setShoppingModalData(null)} maxWidth="600px">
        {shoppingModalData ? (
          Object.keys(shoppingModalData.shopping_lists || {}).length ? (
            Object.entries(shoppingModalData.shopping_lists).map(([title, list]) => (
              <div key={title} className="shopping-recipe">
                <h4>{title}</h4>
                <pre>{list}</pre>
              </div>
            ))
          ) : <EmptyState emoji="🎉" title="Всё готово!" description="Все блюда уже приготовлены" />
        ) : null}
      </Modal>

      <ConfirmOverlay
        open={quickActions.open}
        message={quickActions.message}
        allowSkip
        skip={quickActions.skipNext}
        onSkipChange={(value) => setQuickActions((prev) => ({ ...prev, skipNext: value }))}
        onCancel={() => setQuickActions((prev) => ({ ...prev, open: false }))}
        onConfirm={async () => {
          const shouldSkip = quickActions.skipNext
          if (shouldSkip) localStorage.setItem('menu.quickActions.skipConfirm', '1')
          setQuickActions((prev) => ({ ...prev, open: false, skipConfirm: prev.skipConfirm || shouldSkip }))
          await quickActions.onConfirm?.()
        }}
      />
    </div>
  )
}






