const ADMIN_LOGIN = 'compadmin';
const ADMIN_EMAIL = 'compadmin@komputerra.local';
const SESSION_KEY = 'komputerra_admin_supabase_session_v1';
const CATEGORY_ALL = 'Усі товари';
let products = [];
let currentEditId = null;
let activeCategory = CATEGORY_ALL;
let authSession = null;

function getConfig() {
  return window.KOMPUTERRA_SUPABASE_CONFIG || { url: '', anonKey: '', table: 'products' };
}

function getRestUrl() {
  const cfg = getConfig();
  return cfg.url.replace(/\/$/, '') + '/rest/v1/' + (cfg.table || 'products');
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'product';
}

function formatPrice(n) {
  return new Intl.NumberFormat('uk-UA').format(Number(n || 0)) + ' грн';
}

function statusText(item) {
  if (item.status === 'в наявності') return 'в наявності';
  if (item.status === 'в дорозі') return item.eta ? `в дорозі · ${item.eta}` : 'в дорозі';
  return 'відсутній';
}

function saveFeedback(text, isError = false) {
  const node = document.querySelector('[data-save-feedback]');
  if (!node) return;
  node.textContent = text || '';
  node.style.color = isError ? '#b42318' : '';
}

function toPayload(form) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const brand = String(fd.get('brand') || '').trim();
  const model = String(fd.get('model') || '').trim();
  return {
    slug: slugify(model || name),
    category: String(fd.get('category') || '').trim(),
    brand,
    model,
    name,
    specs: String(fd.get('specs') || '').trim(),
    description: String(fd.get('description') || '').trim(),
    price: Number(fd.get('price') || 0),
    warranty: String(fd.get('warranty') || '').trim(),
    status: String(fd.get('status') || 'в наявності').trim(),
    eta: String(fd.get('eta') || '').trim(),
    image_url: String(fd.get('image') || '').trim(),
    pdf_url: String(fd.get('pdf') || '').trim(),
    is_active: form.isActive.checked,
    hidden_by_admin: !form.isActive.checked,
    sort_order: Number(fd.get('sortOrder') || 0),
    updated_at: new Date().toISOString()
  };
}

function setFormMode(title, item) {
  currentEditId = item?.id || null;
  document.querySelector('[data-form-title]').textContent = title;
  saveFeedback('');
}

function resetForm() {
  const form = document.forms.productForm;
  form.reset();
  form.category.value = 'однофазні інвертори';
  form.status.value = 'в наявності';
  form.sortOrder.value = '0';
  form.isActive.checked = true;
  setFormMode('Додати товар', null);
}

function fillForm(item) {
  const form = document.forms.productForm;
  form.name.value = item.name || '';
  form.model.value = item.model || '';
  form.brand.value = item.brand || '';
  form.category.value = item.category || 'однофазні інвертори';
  form.specs.value = item.specs || '';
  form.price.value = Number(item.price || 0);
  form.status.value = item.status || 'в наявності';
  form.eta.value = item.eta || '';
  form.warranty.value = item.warranty || '';
  form.description.value = item.description || '';
  form.image.value = item.image || '';
  form.pdf.value = item.pdf || '';
  form.sortOrder.value = Number(item.sortOrder || 0);
  form.isActive.checked = item.isActive !== false && !item.hiddenByAdmin;
  setFormMode('Редагувати товар', item);
  document.getElementById('product-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCategories() {
  const node = document.querySelector('[data-admin-categories]');
  const categories = [CATEGORY_ALL, ...new Set(products.map(item => item.category).filter(Boolean))];
  node.innerHTML = categories.map(category => `
    <button class="category-pill ${category === activeCategory ? 'is-active' : ''}" type="button" data-category="${category}">${category}</button>
  `).join('');
  node.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategories();
      renderProducts();
    });
  });
}

function getVisibleProducts() {
  return products.filter(item => activeCategory === CATEGORY_ALL || item.category === activeCategory);
}

function renderProducts() {
  const list = document.querySelector('[data-product-list]');
  const visible = getVisibleProducts();
  if (!visible.length) {
    list.innerHTML = '<div class="admin-empty"><p>У цій категорії поки немає товарів.</p></div>';
    return;
  }
  list.innerHTML = visible.map(item => `
    <div class="admin-item ${item.hiddenByAdmin || item.isActive === false ? 'is-sheet-hidden' : ''}">
      <div class="admin-item-main">
        <h3>${item.name}</h3>
        <p>${item.model || ''} · ${item.category || ''}</p>
        <p>${formatPrice(item.price)} · ${statusText(item)}</p>
        ${item.hiddenByAdmin || item.isActive === false ? '<p class="admin-state">Приховано на сайті</p>' : ''}
      </div>
      <div class="admin-actions admin-actions--inline">
        <button class="btn primary" type="button" data-edit-id="${item.id}">Редагувати</button>
        <button class="btn" type="button" data-delete-id="${item.id}">${item.hiddenByAdmin || item.isActive === false ? 'Повернути' : 'Видалити'}</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = products.find(x => x.id === btn.dataset.editId);
      if (item) fillForm(item);
    });
  });

  list.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = products.find(x => x.id === btn.dataset.deleteId);
      if (!item) return;
      const restore = item.hiddenByAdmin || item.isActive === false;
      const okay = restore
        ? confirm(`Повернути товар "${item.name}" на сайт?`)
        : confirm(`Приховати товар "${item.name}" з роздрібного сайту?`);
      if (!okay) return;
      try {
        await patchProduct(item.id, {
          hidden_by_admin: !restore,
          is_active: restore,
          updated_at: new Date().toISOString()
        });
        await loadProducts();
        if (!restore && currentEditId === item.id) resetForm();
      } catch (error) {
        alert('Не вдалося оновити товар: ' + error.message);
      }
    });
  });
}

function mapRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category || '',
    brand: row.brand || '',
    model: row.model || '',
    name: row.name || '',
    specs: row.specs || '',
    description: row.description || '',
    price: Number(row.price || 0),
    warranty: row.warranty || '',
    status: row.status || 'в наявності',
    eta: row.eta || '',
    image: row.image_url || '',
    pdf: row.pdf_url || '',
    hiddenByAdmin: !!row.hidden_by_admin,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0)
  };
}

async function signInWithPassword(password) {
  const cfg = getConfig();
  const res = await fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.anonKey
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || 'Невірний логін або пароль');
  }
  authSession = data;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  return data;
}

function getAuthHeaders() {
  const cfg = getConfig();
  const token = authSession?.access_token;
  if (!token) throw new Error('Немає авторизації');
  return {
    apikey: cfg.anonKey,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function loadProducts() {
  const endpoint = new URL(getRestUrl());
  endpoint.searchParams.set('select', 'id,slug,category,brand,model,name,specs,description,price,warranty,status,eta,image_url,pdf_url,is_active,hidden_by_admin,sort_order');
  endpoint.searchParams.set('order', 'sort_order.asc.nullslast,name.asc');
  const res = await fetch(endpoint.toString(), { headers: getAuthHeaders() });
  const rows = await res.json().catch(() => []);
  if (!res.ok) throw new Error((rows && rows.message) || 'Не вдалося завантажити товари');
  products = Array.isArray(rows) ? rows.map(mapRow) : [];
  renderCategories();
  renderProducts();
}

async function patchProduct(id, payload) {
  const endpoint = new URL(getRestUrl());
  endpoint.searchParams.set('id', 'eq.' + id);
  const res = await fetch(endpoint.toString(), {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && data.message) || 'PATCH failed');
  return data;
}

async function insertProduct(payload) {
  const res = await fetch(getRestUrl(), {
    method: 'POST',
    headers: { ...getAuthHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && data.message) || 'POST failed');
  return data;
}

async function handleSave(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = toPayload(form);
  if (!payload.name || !payload.model || !payload.brand) {
    saveFeedback('Заповни назву, модель і бренд.', true);
    return;
  }
  try {
    saveFeedback('Зберігаю...');
    if (currentEditId) {
      await patchProduct(currentEditId, payload);
      saveFeedback('Товар оновлено в Supabase.');
    } else {
      await insertProduct(payload);
      saveFeedback('Новий товар додано в Supabase.');
    }
    await loadProducts();
    resetForm();
  } catch (error) {
    saveFeedback(error.message || 'Не вдалося зберегти товар.', true);
  }
}

function togglePanel(isOpen) {
  document.querySelector('[data-login]').classList.toggle('hidden', isOpen);
  document.querySelector('[data-panel]').classList.toggle('hidden', !isOpen);
}

async function afterLogin() {
  togglePanel(true);
  await loadProducts();
  resetForm();
}

function logout() {
  authSession = null;
  sessionStorage.removeItem(SESSION_KEY);
  togglePanel(false);
}

async function tryRestoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    authSession = JSON.parse(raw);
    await loadProducts();
    togglePanel(true);
    return true;
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    authSession = null;
    return false;
  }
}

function initLogin() {
  document.forms.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = e.target.login.value.trim();
    const password = e.target.password.value;
    if (![ADMIN_LOGIN, ADMIN_EMAIL].includes(login)) {
      alert('Невірний логін або пароль');
      return;
    }
    try {
      await signInWithPassword(password);
      await afterLogin();
    } catch (error) {
      alert(error.message || 'Невірний логін або пароль');
    }
  });
}

function initAdmin() {
  document.forms.productForm.addEventListener('submit', handleSave);
  document.querySelector('[data-reset-form]').addEventListener('click', resetForm);
  document.querySelector('[data-logout]').addEventListener('click', logout);
}

window.addEventListener('DOMContentLoaded', async () => {
  initLogin();
  initAdmin();
  await tryRestoreSession();
});
