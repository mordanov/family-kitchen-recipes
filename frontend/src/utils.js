export const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
export const MEAL_LABELS = {
  breakfast: '🌅 Завтрак',
  lunch: '☀️ Обед',
  dinner: '🌙 Ужин',
}
export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner']

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function cookingMethodLabel(method) {
  if (!method) return '—'
  if (typeof method === 'object') {
    return [method.emoji, method.name].filter(Boolean).join(' ')
  }

  const map = {
    boiling: '🫕 Варка',
    frying: '🍳 Жарка',
    dry_frying: '🥘 Жарка на сухой сковороде',
    stewing: '♨️ Тушение',
    air_fryer: '💨 Аэрогриль',
    baking: '🔥 Запекание',
    raw: '🥗 Сырое',
    sous_vide: '♨️ Су-вид',
    grill: '🍖 Гриль',
    other: '🍽️ Разное',
  }

  return map[method] || method
}

export function getRecipeEmoji(method) {
  if (method && typeof method === 'object') return method.emoji || '🍽️'
  const map = {
    boiling: '🍲',
    frying: '🍳',
    dry_frying: '🥘',
    stewing: '♨️',
    air_fryer: '🌀',
    baking: '🥧',
    raw: '🥗',
    other: '🍽️',
  }
  return map[method] || '🍽️'
}

export function weeksLabel(count) {
  if (count === 1) return 'неделя'
  if (count < 5) return 'недели'
  return 'недель'
}

export function toRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(255,107,53,${alpha})`
  const clean = hex.replace('#', '').trim()
  const normalized = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(255,107,53,${alpha})`
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function calcAge(birthDateStr) {
  if (!birthDateStr) return null
  const today = new Date()
  const bd = new Date(birthDateStr)
  let age = today.getFullYear() - bd.getFullYear()
  const monthDiff = today.getMonth() - bd.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
    age -= 1
  }
  return age
}

export function dietLabel(diet) {
  return {
    weight_gain: '📈 Набор веса',
    weight_loss: '📉 Снижение веса',
    weight_maintain: '⚖️ Поддержание веса',
  }[diet] || diet
}

export function dietClass(diet) {
  if (diet === 'weight_gain') return 'gain'
  if (diet === 'weight_loss') return 'loss'
  return 'maintain'
}

export function genderIcon(gender) {
  if (gender === 'male') return '👨'
  if (gender === 'female') return '👩'
  if (gender === 'other') return '🧑'
  return ''
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

export function mapToLines(obj) {
  return Object.entries(obj)
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

export function parseLines(text) {
  const result = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim().toLowerCase()
    if (key && value) result[key] = value
  }
  return result
}

export function kbjuFromRecipe(recipe) {
  return {
    calories: Number(recipe?.calories || 0),
    proteins: Number(recipe?.proteins || 0),
    fats: Number(recipe?.fats || 0),
    carbs: Number(recipe?.carbs || 0),
  }
}

export function formatRounded(value) {
  return Number(value || 0).toFixed(0)
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function pluralItems(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'позиция'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'позиции'
  return 'позиций'
}

export function presetMenuTitle() {
  const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
  return `Меню на ${months[new Date().getMonth()]}`
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

