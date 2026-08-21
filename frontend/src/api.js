const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function handleResponse(response) {
  if (response.status === 401) {
    localStorage.removeItem('token')
    window.location.reload()
    return undefined
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const error = await response.json()
      message = error.detail || message
    } catch {
      // noop
    }
    throw new Error(message)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return null
}

async function request(method, path, body = null, isFormData = false) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (!isFormData && body) headers['Content-Type'] = 'application/json'

  const options = { method, headers }
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body)
  }

  const response = await fetch(BASE + path, options)
  return handleResponse(response)
}

async function download(path) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(BASE + path, { method: 'GET', headers })
  if (response.status === 401) {
    localStorage.removeItem('token')
    window.location.reload()
    return null
  }
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const error = await response.json()
      message = error.detail || message
    } catch {
      // noop
    }
    throw new Error(message)
  }
  return response.blob()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  postForm: (path, fd) => request('POST', path, fd, true),
  putForm: (path, fd) => request('PUT', path, fd, true),

  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),

  listRecipes: (search = '') => request('GET', `/recipes/${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getRecipe: (id) => request('GET', `/recipes/${id}`),
  createRecipe: (fd) => request('POST', '/recipes/', fd, true),
  updateRecipe: (id, fd) => request('PUT', `/recipes/${id}`, fd, true),
  deleteRecipe: (id) => request('DELETE', `/recipes/${id}`),
  deleteRecipeMaterial: (id) => request('DELETE', `/recipes/${id}/additional-material`),
  downloadRecipeMaterial: (id) => download(`/recipes/${id}/additional-material/download`),
  recalcKbju: (id) => request('POST', `/recipes/${id}/recalculate`),
  kbjuStatus: (id) => request('GET', `/recipes/${id}/kbju-status`),

  listMenus: () => request('GET', '/menus/'),
  getActiveMenu: () => request('GET', '/menus/active'),
  getMenu: (id) => request('GET', `/menus/${id}`),
  createMenu: (data) => request('POST', '/menus/', data),
  closeMenu: (id) => request('POST', `/menus/${id}/close`),
  autoFillMenu: (id, data) => request('POST', `/menus/${id}/auto-fill`, data),
  addMenuItem: (id, data) => request('POST', `/menus/${id}/items`, data),
  updateMenuItem: (menuId, itemId, data) => request('PATCH', `/menus/${menuId}/items/${itemId}`, data),
  removeMenuItem: (menuId, itemId) => request('DELETE', `/menus/${menuId}/items/${itemId}`),
  setItemAssignments: (menuId, itemId, assignments) => request('PUT', `/menus/${menuId}/items/${itemId}/assignments`, assignments),
  getShoppingList: (id) => request('GET', `/menus/${id}/shopping-list`),

  listStock: () => request('GET', '/warehouse/items'),
  createStock: (data) => request('POST', '/warehouse/items', data),
  updateStock: (id, data) => request('PATCH', `/warehouse/items/${id}`, data),
  deleteStock: (id) => request('DELETE', `/warehouse/items/${id}`),

  listPrepared: () => request('GET', '/warehouse/prepared'),
  createPrepared: (data) => request('POST', '/warehouse/prepared', data),
  updatePrepared: (id, data) => request('PATCH', `/warehouse/prepared/${id}`, data),
  deletePrepared: (id) => request('DELETE', `/warehouse/prepared/${id}`),

  listDrafts: () => request('GET', '/warehouse/drafts'),
  updateDraft: (id, data) => request('PATCH', `/warehouse/drafts/${id}`, data),
  deleteDraft: (id) => request('DELETE', `/warehouse/drafts/${id}`),
  commitDraft: (id, data) => request('POST', `/warehouse/drafts/${id}/commit`, data),

  getProductSynonyms: () => request('GET', '/settings/warehouse/product-synonyms'),
  setProductSynonyms: (aliases) => request('PUT', '/settings/warehouse/product-synonyms', { aliases }),
  getPhraseSynonyms: () => request('GET', '/settings/warehouse/phrase-synonyms'),
  setPhraseSynonyms: (aliases) => request('PUT', '/settings/warehouse/phrase-synonyms', { aliases }),

  listMembers: () => request('GET', '/members/'),
  getMember: (id) => request('GET', `/members/${id}`),
  createMember: (fd) => request('POST', '/members/', fd, true),
  updateMember: (id, fd) => request('PUT', `/members/${id}`, fd, true),
  deleteMember: (id) => request('DELETE', `/members/${id}`),
  addPreferredRecipe: (memberId, recipeId) => request('POST', `/members/${memberId}/preferred/${recipeId}`),
  removePreferredRecipe: (memberId, recipeId) => request('DELETE', `/members/${memberId}/preferred/${recipeId}`),
  addDislikedRecipe: (memberId, recipeId) => request('POST', `/members/${memberId}/disliked/${recipeId}`),
  removeDislikedRecipe: (memberId, recipeId) => request('DELETE', `/members/${memberId}/disliked/${recipeId}`),

  searchRecipeImages: (q) => request('GET', `/recipes/image-search?q=${encodeURIComponent(q)}`),
  setImageFromUrl: (id, url) => request('POST', `/recipes/${id}/image-from-url`, { url }),

  parseRecipeImages: (files) => {
    const fd = new FormData()
    files.forEach((file) => fd.append('images', file))
    return request('POST', '/recipes/ocr', fd, true)
  },

  parseRecipePdf: (file) => {
    const fd = new FormData()
    fd.append('pdf', file)
    return request('POST', '/recipes/ocr-pdf', fd, true)
  },

  getRecipeCategories: () => request('GET', '/directories/recipe-categories'),
  createRecipeCategory: (data) => request('POST', '/directories/recipe-categories', data),
  updateRecipeCategory: (id, data) => request('PUT', `/directories/recipe-categories/${id}`, data),
  deleteRecipeCategory: (id) => request('DELETE', `/directories/recipe-categories/${id}`),

  getCookingMethods: () => request('GET', '/directories/cooking-methods'),
  createCookingMethod: (data) => request('POST', '/directories/cooking-methods', data),
  updateCookingMethod: (id, data) => request('PUT', `/directories/cooking-methods/${id}`, data),
  deleteCookingMethod: (id) => request('DELETE', `/directories/cooking-methods/${id}`),
}

