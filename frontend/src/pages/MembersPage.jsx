import React, { useEffect, useMemo, useState } from 'react'

import { api } from '../api'
import { EmptyState, Modal, PageHeader, Spinner } from '../components'
import { calcAge, dietClass, dietLabel, genderIcon, initials, readFileAsDataUrl } from '../utils'

const PRESET_COLORS = ['#FF6B35', '#FF4757', '#FF6B81', '#F9CA24', '#6AB04C', '#4ECDC4', '#45AAF2', '#A29BFE', '#FD79A8', '#00B894', '#E17055', '#74B9FF']

const defaultForm = {
  id: '',
  name: '',
  birth_date: '',
  weight: '',
  gender: '',
  diet_model: 'weight_maintain',
  color: '#FF6B35',
  photoFile: null,
  photoPreview: '',
  photoRemoved: false,
}

function buildMemberFormData(form) {
  const fd = new FormData()
  fd.append('name', form.name.trim())
  if (form.birth_date) fd.append('birth_date', form.birth_date)
  if (form.weight) fd.append('weight', form.weight)
  if (form.gender) fd.append('gender', form.gender)
  fd.append('diet_model', form.diet_model)
  fd.append('color', form.color)
  if (form.photoFile) fd.append('photo', form.photoFile)
  if (form.photoRemoved) fd.append('remove_photo', '1')
  return fd
}

export function MembersPage({ active, toast }) {
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState([])
  const [recipes, setRecipes] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [formOpen, setFormOpen] = useState(false)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [prefsMember, setPrefsMember] = useState(null)
  const [prefsSearch, setPrefsSearch] = useState('')

  useEffect(() => {
    if (!active) return
    load()
  }, [active])

  async function load() {
    setLoading(true)
    try {
      const [membersList, recipeList] = await Promise.all([api.listMembers(), api.listRecipes()])
      setMembers(membersList)
      setRecipes(recipeList)
    } catch (error) {
      toast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(defaultForm)
    setFormOpen(true)
  }

  function openEdit(member) {
    setForm({
      id: member.id,
      name: member.name,
      birth_date: member.birth_date || '',
      weight: member.weight ?? '',
      gender: member.gender || '',
      diet_model: member.diet_model || 'weight_maintain',
      color: member.color || '#FF6B35',
      photoFile: null,
      photoPreview: member.photo_path || '',
      photoRemoved: false,
    })
    setFormOpen(true)
  }

  async function saveMember() {
    if (!form.name.trim()) {
      toast('Введите имя', 'error')
      return
    }

    try {
      const fd = buildMemberFormData(form)
      if (form.id) {
        await api.updateMember(form.id, fd)
        toast('Изменения сохранены', 'success')
      } else {
        await api.createMember(fd)
        toast('Участник добавлен', 'success')
      }
      setFormOpen(false)
      setForm(defaultForm)
      await load()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  async function deleteMember(memberId) {
    const member = members.find((value) => value.id === memberId)
    if (!window.confirm(`Удалить ${member ? member.name : 'участника'}?`)) return
    try {
      await api.deleteMember(memberId)
      toast('Участник удалён', 'success')
      await load()
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  async function onPhotoChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const preview = await readFileAsDataUrl(file)
    setForm((prev) => ({ ...prev, photoFile: file, photoPreview: preview, photoRemoved: false }))
  }

  function openPrefs(member) {
    setPrefsMember(member)
    setPrefsSearch('')
    setPrefsOpen(true)
  }

  async function togglePref(recipeId, type) {
    if (!prefsMember) return
    try {
      const list = type === 'preferred' ? prefsMember.preferred_recipe_ids : prefsMember.disliked_recipe_ids
      const exists = list.includes(recipeId)
      let updated
      if (type === 'preferred') {
        updated = exists ? await api.removePreferredRecipe(prefsMember.id, recipeId) : await api.addPreferredRecipe(prefsMember.id, recipeId)
      } else {
        updated = exists ? await api.removeDislikedRecipe(prefsMember.id, recipeId) : await api.addDislikedRecipe(prefsMember.id, recipeId)
      }
      setMembers((prev) => prev.map((member) => member.id === updated.id ? updated : member))
      setPrefsMember(updated)
    } catch (error) {
      toast(error.message, 'error')
    }
  }

  const filteredRecipes = useMemo(() => {
    const query = prefsSearch.toLowerCase()
    return recipes.filter((recipe) => !query || recipe.title.toLowerCase().includes(query))
  }, [prefsSearch, recipes])

  return (
    <div className={`page ${active ? 'active' : ''}`}>
      <PageHeader title="Члены" accent="семьи" actions={<button className="btn btn-primary" onClick={openCreate}>+ Добавить</button>} />
      {loading ? <Spinner /> : null}
      {!loading && !members.length ? <EmptyState emoji="👨‍👩‍👧" title="Семья пока пустая" description="Добавьте первого члена семьи" actions={<button className="btn btn-primary" onClick={openCreate}>+ Добавить</button>} /> : null}
      {!loading && members.length ? (
        <div className="members-grid">
          {members.map((member) => (
            <div key={member.id} className="member-card">
              <div className="member-card-accent" style={{ background: member.color }} />
              <div className="member-card-body">
                <div className="member-top">
                  {member.photo_path ? <img className="member-avatar" src={member.photo_path} alt={member.name} /> : <div className="member-avatar-placeholder" style={{ background: member.color }}>{initials(member.name)}</div>}
                  <div>
                    <div className="member-name">{member.name}</div>
                    {member.gender ? <span style={{ fontSize: 18 }}>{genderIcon(member.gender)}</span> : null}
                  </div>
                </div>
                <div className="member-stats">
                  <div className="member-stat"><span className="sv">{calcAge(member.birth_date) ?? '—'}</span><span className="sl">лет</span></div>
                  <div className="member-stat"><span className="sv">{member.weight != null ? member.weight : '—'}</span><span className="sl">кг</span></div>
                </div>
                {member.diet_model ? <div><span className={`diet-badge ${dietClass(member.diet_model)}`}>{dietLabel(member.diet_model)}</span></div> : null}
                <div className="member-prefs">❤️ Любимых: <b>{(member.preferred_recipe_ids || []).length}</b> &nbsp; 💔 Нелюбимых: <b>{(member.disliked_recipe_ids || []).length}</b></div>
              </div>
              <div className="member-card-actions">
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openPrefs(member)}>❤️</button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(member)}>✏️</button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteMember(member.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={formOpen}
        title={form.id ? 'Изменить участника' : 'Новый член семьи'}
        onClose={() => { setFormOpen(false); setForm(defaultForm) }}
        maxWidth="560px"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => { setFormOpen(false); setForm(defaultForm) }}>Отмена</button>
            <button className="btn btn-primary" onClick={saveMember}>Сохранить</button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Имя *</label>
          <input className="form-control" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Дата рождения</label>
            <input type="date" className="form-control" value={form.birth_date} onChange={(event) => setForm((prev) => ({ ...prev, birth_date: event.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Вес (кг)</label>
            <input type="number" min="1" max="499" step="0.1" className="form-control" value={form.weight} onChange={(event) => setForm((prev) => ({ ...prev, weight: event.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Пол</label>
            <select className="form-control" value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}>
              <option value="">— не указан —</option>
              <option value="male">👨 Мужской</option>
              <option value="female">👩 Женский</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Модель питания</label>
            <select className="form-control" value={form.diet_model} onChange={(event) => setForm((prev) => ({ ...prev, diet_model: event.target.value }))}>
              <option value="weight_maintain">⚖️ Поддержание веса</option>
              <option value="weight_loss">📉 Снижение веса</option>
              <option value="weight_gain">📈 Набор веса</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Цвет</label>
          <div className="color-row">
            <div className="color-swatch" style={{ background: form.color }}>
              <input type="color" value={form.color} onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))} />
            </div>
            <div className="preset-colors">
              {PRESET_COLORS.map((color) => <div key={color} className={`preset-color ${form.color === color ? 'selected' : ''}`} style={{ background: color }} onClick={() => setForm((prev) => ({ ...prev, color }))} />)}
            </div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Фото</label>
          <div className="image-upload-area">
            <input type="file" accept="image/*" onChange={onPhotoChange} />
            {!form.photoPreview ? (
              <div>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>Нажмите или перетащите фото</div>
              </div>
            ) : <img className="image-preview" src={form.photoPreview} alt="preview" />}
          </div>
          {form.photoPreview ? <div style={{ marginTop: 8 }}><button className="btn btn-danger btn-sm" type="button" onClick={() => setForm((prev) => ({ ...prev, photoPreview: '', photoFile: null, photoRemoved: true }))}>🗑️ Удалить фото</button></div> : null}
        </div>
      </Modal>

      <Modal
        open={prefsOpen}
        title={prefsMember ? `Предпочтения: ${prefsMember.name}` : 'Предпочтения'}
        onClose={() => { setPrefsOpen(false); setPrefsMember(null) }}
        maxWidth="720px"
        footer={<button className="btn btn-secondary" onClick={() => { setPrefsOpen(false); setPrefsMember(null) }}>Закрыть</button>}
      >
        {prefsMember ? (
          <>
            <input className="pref-search" value={prefsSearch} onChange={(event) => setPrefsSearch(event.target.value)} placeholder="🔍 Фильтр рецептов..." />
            <div className="prefs-columns">
              <div className="prefs-col">
                <h4>❤️ Любимые рецепты</h4>
                <div className="prefs-list">
                  {filteredRecipes.map((recipe) => {
                    const activePref = (prefsMember.preferred_recipe_ids || []).includes(recipe.id)
                    return <div key={`pref-${recipe.id}`} className={`pref-item ${activePref ? 'preferred' : ''}`} onClick={() => togglePref(recipe.id, 'preferred')}>{activePref ? '✅' : '○'} {recipe.title}</div>
                  })}
                </div>
              </div>
              <div className="prefs-col">
                <h4>💔 Нелюбимые рецепты</h4>
                <div className="prefs-list">
                  {filteredRecipes.map((recipe) => {
                    const activePref = (prefsMember.disliked_recipe_ids || []).includes(recipe.id)
                    return <div key={`dis-${recipe.id}`} className={`pref-item ${activePref ? 'disliked' : ''}`} onClick={() => togglePref(recipe.id, 'disliked')}>{activePref ? '💔' : '○'} {recipe.title}</div>
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}

