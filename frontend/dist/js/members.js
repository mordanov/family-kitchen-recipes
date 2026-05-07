/**
 * MembersPage – family members management
 */
const MembersPage = (() => {
  const PRESET_COLORS = [
    '#FF6B35', '#FF4757', '#FF6B81', '#F9CA24',
    '#6AB04C', '#4ECDC4', '#45AAF2', '#A29BFE',
    '#FD79A8', '#00B894', '#E17055', '#74B9FF',
  ];

  function calcAge(birthDateStr) {
    if (!birthDateStr) return null;
    const today = new Date();
    const bd = new Date(birthDateStr);
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return age;
  }

  let _members = [];
  let _recipes = [];
  let _prefsCurrentMember = null;
  let _photoRemoved = false;

  async function load() {
    const grid = document.getElementById('members-grid');
    grid.innerHTML = '<div class="spinner"></div>';
    try {
      [_members, _recipes] = await Promise.all([API.listMembers(), API.listRecipes()]);
      render(_members);
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><span class="emoji">⚠️</span><h3>Ошибка загрузки</h3><p>${e.message}</p></div>`;
    }
  }

  function render(members) {
    const grid = document.getElementById('members-grid');
    if (!members.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <span class="emoji">👨‍👩‍👧</span>
          <h3>Семья пока пустая</h3>
          <p>Добавьте первого члена семьи</p>
          <button class="btn btn-primary" onclick="MembersPage.openCreate()">+ Добавить</button>
        </div>`;
      return;
    }
    grid.innerHTML = members.map(m => memberCardHtml(m)).join('');
  }

  function dietLabel(d) {
    const map = {
      weight_gain: '📈 Набор веса',
      weight_loss: '📉 Снижение веса',
      weight_maintain: '⚖️ Поддержание веса',
    };
    return map[d] || d;
  }

  function dietClass(d) {
    if (d === 'weight_gain') return 'gain';
    if (d === 'weight_loss') return 'loss';
    return 'maintain';
  }

  function genderIcon(g) {
    if (g === 'male') return '👨';
    if (g === 'female') return '👩';
    if (g === 'other') return '🧑';
    return '';
  }

  function initials(name) {
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function memberCardHtml(m) {
    const avatarHtml = m.photo_path
      ? `<img class="member-avatar" src="${m.photo_path}" alt="${m.name}"/>`
      : `<div class="member-avatar-placeholder" style="background:${m.color}">${initials(m.name)}</div>`;

    const prefCount = (m.preferred_recipe_ids || []).length;
    const disCount  = (m.disliked_recipe_ids  || []).length;

    return `
      <div class="member-card">
        <div class="member-card-accent" style="background:${m.color}"></div>
        <div class="member-card-body">
          <div class="member-top">
            ${avatarHtml}
            <div>
              <div class="member-name">${m.name}</div>
              ${m.gender ? `<span style="font-size:18px">${genderIcon(m.gender)}</span>` : ''}
            </div>
          </div>
          <div class="member-stats">
            <div class="member-stat">
              <span class="sv">${calcAge(m.birth_date) ?? '—'}</span>
              <span class="sl">лет</span>
            </div>
            <div class="member-stat">
              <span class="sv">${m.weight != null ? m.weight : '—'}</span>
              <span class="sl">кг</span>
            </div>
          </div>
          ${m.diet_model ? `<div><span class="diet-badge ${dietClass(m.diet_model)}">${dietLabel(m.diet_model)}</span></div>` : ''}
          <div class="member-prefs">
            ❤️ Любимых: <b>${prefCount}</b> &nbsp; 💔 Нелюбимых: <b>${disCount}</b>
          </div>
        </div>
        <div class="member-card-actions">
          <button class="btn btn-secondary btn-sm btn-icon" title="Предпочтения" onclick="MembersPage.openPrefs(${m.id})">❤️</button>
          <button class="btn btn-secondary btn-sm btn-icon" title="Изменить" onclick="MembersPage.openEdit(${m.id})">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" title="Удалить" onclick="MembersPage.deleteMember(${m.id})">🗑️</button>
        </div>
      </div>`;
  }

  // ─── Form modal ───

  function initColorPicker() {
    const container = document.getElementById('member-preset-colors');
    container.innerHTML = PRESET_COLORS.map(c =>
      `<div class="preset-color" style="background:${c}" data-color="${c}" onclick="MembersPage.selectColor('${c}')"></div>`
    ).join('');
  }

  function selectColor(hex) {
    document.getElementById('member-color').value = hex;
    document.getElementById('member-color-swatch').style.background = hex;
    document.getElementById('member-color-picker').value = hex;
    document.querySelectorAll('.preset-color').forEach(el => {
      el.classList.toggle('selected', el.dataset.color === hex);
    });
  }

  function onColorPick(hex) {
    selectColor(hex);
  }

  function openCreate() {
    _photoRemoved = false;
    document.getElementById('modal-member-title').textContent = 'Новый член семьи';
    document.getElementById('member-id').value = '';
    document.getElementById('member-name').value = '';
    document.getElementById('member-birth-date').value = '';
    document.getElementById('member-weight').value = '';
    document.getElementById('member-gender').value = '';
    document.getElementById('member-diet').value = 'weight_maintain';
    document.getElementById('member-photo-input').value = '';
    document.getElementById('member-photo-preview').style.display = 'none';
    document.getElementById('member-photo-preview').src = '';
    document.getElementById('member-photo-placeholder').style.display = '';
    document.getElementById('member-photo-remove').style.display = 'none';
    initColorPicker();
    selectColor('#FF6B35');
    document.getElementById('modal-member-form').classList.add('open');
  }

  function openEdit(id) {
    _photoRemoved = false;
    const m = _members.find(x => x.id === id);
    if (!m) return;
    document.getElementById('modal-member-title').textContent = 'Изменить участника';
    document.getElementById('member-id').value = m.id;
    document.getElementById('member-name').value = m.name;
    document.getElementById('member-birth-date').value = m.birth_date ?? '';
    document.getElementById('member-weight').value = m.weight ?? '';
    document.getElementById('member-gender').value = m.gender ?? '';
    document.getElementById('member-diet').value = m.diet_model ?? 'weight_maintain';
    document.getElementById('member-photo-input').value = '';
    initColorPicker();
    selectColor(m.color || '#FF6B35');

    if (m.photo_path) {
      document.getElementById('member-photo-preview').src = m.photo_path;
      document.getElementById('member-photo-preview').style.display = 'block';
      document.getElementById('member-photo-placeholder').style.display = 'none';
      document.getElementById('member-photo-remove').style.display = '';
    } else {
      document.getElementById('member-photo-preview').style.display = 'none';
      document.getElementById('member-photo-placeholder').style.display = '';
      document.getElementById('member-photo-remove').style.display = 'none';
    }
    document.getElementById('modal-member-form').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-member-form').classList.remove('open');
  }

  function previewPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('member-photo-preview').src = e.target.result;
      document.getElementById('member-photo-preview').style.display = 'block';
      document.getElementById('member-photo-placeholder').style.display = 'none';
      document.getElementById('member-photo-remove').style.display = '';
      _photoRemoved = false;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    _photoRemoved = true;
    document.getElementById('member-photo-preview').style.display = 'none';
    document.getElementById('member-photo-preview').src = '';
    document.getElementById('member-photo-placeholder').style.display = '';
    document.getElementById('member-photo-remove').style.display = 'none';
    document.getElementById('member-photo-input').value = '';
  }

  async function saveMember() {
    const id = document.getElementById('member-id').value;
    const name = document.getElementById('member-name').value.trim();
    if (!name) { App.toast('Введите имя', 'error'); return; }

    const fd = new FormData();
    fd.append('name', name);
    const birthDate = document.getElementById('member-birth-date').value;
    const weight = document.getElementById('member-weight').value;
    const gender = document.getElementById('member-gender').value;
    const diet = document.getElementById('member-diet').value;
    const color = document.getElementById('member-color').value || '#FF6B35';

    if (birthDate) fd.append('birth_date', birthDate);
    if (weight) fd.append('weight', weight);
    if (gender) fd.append('gender', gender);
    fd.append('diet_model', diet);
    fd.append('color', color);

    const photoFile = document.getElementById('member-photo-input').files[0];
    if (photoFile) fd.append('photo', photoFile);
    if (_photoRemoved) fd.append('remove_photo', '1');

    try {
      if (id) {
        await API.updateMember(id, fd);
        App.toast('Изменения сохранены', 'success');
      } else {
        await API.createMember(fd);
        App.toast('Участник добавлен', 'success');
      }
      closeModal();
      await load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  async function deleteMember(id) {
    const m = _members.find(x => x.id === id);
    if (!confirm(`Удалить ${m ? m.name : 'участника'}?`)) return;
    try {
      await API.deleteMember(id);
      App.toast('Участник удалён', 'success');
      await load();
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  // ─── Preferences modal ───

  function openPrefs(memberId) {
    _prefsCurrentMember = _members.find(m => m.id === memberId);
    if (!_prefsCurrentMember) return;
    document.getElementById('prefs-member-id').value = memberId;
    document.getElementById('modal-prefs-title').textContent = `Предпочтения: ${_prefsCurrentMember.name}`;
    document.getElementById('pref-search').value = '';
    renderPrefsLists(_prefsCurrentMember, '');
    document.getElementById('modal-member-prefs').classList.add('open');
  }

  function closePrefsModal() {
    document.getElementById('modal-member-prefs').classList.remove('open');
    _prefsCurrentMember = null;
    render(_members);
  }

  function filterPrefs(query) {
    if (_prefsCurrentMember) renderPrefsLists(_prefsCurrentMember, query);
  }

  function renderPrefsLists(member, query) {
    const q = query.toLowerCase();
    const filtered = _recipes.filter(r => !q || r.title.toLowerCase().includes(q));

    const prefSet  = new Set(member.preferred_recipe_ids || []);
    const disSet   = new Set(member.disliked_recipe_ids  || []);

    document.getElementById('prefs-preferred-list').innerHTML = filtered.map(r => {
      const active = prefSet.has(r.id) ? 'preferred' : '';
      return `<div class="pref-item ${active}" onclick="MembersPage.togglePref(${r.id},'preferred')">
        ${prefSet.has(r.id) ? '✅' : '○'} ${r.title}
      </div>`;
    }).join('');

    document.getElementById('prefs-disliked-list').innerHTML = filtered.map(r => {
      const active = disSet.has(r.id) ? 'disliked' : '';
      return `<div class="pref-item ${active}" onclick="MembersPage.togglePref(${r.id},'disliked')">
        ${disSet.has(r.id) ? '💔' : '○'} ${r.title}
      </div>`;
    }).join('');
  }

  async function togglePref(recipeId, type) {
    if (!_prefsCurrentMember) return;
    const mid = _prefsCurrentMember.id;
    const list = type === 'preferred'
      ? _prefsCurrentMember.preferred_recipe_ids
      : _prefsCurrentMember.disliked_recipe_ids;
    const idx = list.indexOf(recipeId);
    try {
      let updated;
      if (type === 'preferred') {
        updated = idx >= 0
          ? await API.removePreferredRecipe(mid, recipeId)
          : await API.addPreferredRecipe(mid, recipeId);
      } else {
        updated = idx >= 0
          ? await API.removeDislikedRecipe(mid, recipeId)
          : await API.addDislikedRecipe(mid, recipeId);
      }
      // update local cache
      const mIdx = _members.findIndex(m => m.id === mid);
      if (mIdx >= 0) _members[mIdx] = updated;
      _prefsCurrentMember = updated;
      renderPrefsLists(updated, document.getElementById('pref-search').value);
    } catch (e) {
      App.toast(e.message, 'error');
    }
  }

  return {
    load,
    render,
    openCreate,
    openEdit,
    closeModal,
    saveMember,
    deleteMember,
    previewPhoto,
    removePhoto,
    selectColor,
    onColorPick,
    openPrefs,
    closePrefsModal,
    filterPrefs,
    togglePref,
  };
})();

