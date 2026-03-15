/**
 * API client – all requests to backend
 */
const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('token');
  }

  async function request(method, path, body = null, isFormData = false) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isFormData && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(BASE + path, opts);

    if (res.status === 401) {
      localStorage.removeItem('token');
      location.reload();
      return;
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const e = await res.json(); msg = e.detail || msg; } catch {}
      throw new Error(msg);
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return null;
  }

  return {
    get:    (path)         => request('GET',    path),
    post:   (path, body)   => request('POST',   path, body),
    put:    (path, body)   => request('PUT',    path, body),
    patch:  (path, body)   => request('PATCH',  path, body),
    delete: (path)         => request('DELETE', path),
    postForm: (path, fd)   => request('POST',   path, fd, true),
    putForm:  (path, fd)   => request('PUT',    path, fd, true),

    // Auth
    login: (username, password) => request('POST', '/auth/login', { username, password }),
    me:    () => request('GET', '/auth/me'),

    // Recipes
    listRecipes:      (search = '') => request('GET', `/recipes/${search ? '?search=' + encodeURIComponent(search) : ''}`),
    getRecipe:        (id)          => request('GET', `/recipes/${id}`),
    createRecipe:     (fd)          => request('POST', '/recipes/', fd, true),
    updateRecipe:     (id, fd)      => request('PUT',  `/recipes/${id}`, fd, true),
    deleteRecipe:     (id)          => request('DELETE', `/recipes/${id}`),
    recalcKbju:       (id)          => request('POST', `/recipes/${id}/recalculate`),
    kbjuStatus:       (id)          => request('GET',  `/recipes/${id}/kbju-status`),

    // Menus
    listMenus:        ()            => request('GET',  '/menus/'),
    getActiveMenu:    ()            => request('GET',  '/menus/active'),
    getMenu:          (id)          => request('GET',  `/menus/${id}`),
    createMenu:       (data)        => request('POST', '/menus/', data),
    closeMenu:        (id)          => request('POST', `/menus/${id}/close`),
    addMenuItem:      (id, data)    => request('POST', `/menus/${id}/items`, data),
    updateMenuItem:   (mid, iid, d) => request('PATCH',  `/menus/${mid}/items/${iid}`, d),
    removeMenuItem:   (mid, iid)    => request('DELETE', `/menus/${mid}/items/${iid}`),
    getShoppingList:  (id)          => request('GET',  `/menus/${id}/shopping-list`),
  };
})();
