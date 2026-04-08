const ADMIN_LOGIN = 'compadmin';
const ADMIN_EMAIL = 'compadmin@komputerra.local';
const SESSION_KEY = 'komputerra_admin_supabase_session_v1';
const CATEGORY_ALL = 'Усі товари';
let products = [];
let dealers = [];
let dealerPrices = [];
let currentEditId = null;
let currentDealerId = null;
let currentDealerEditId = null;
let activeCategory = CATEGORY_ALL;
let authSession = null;
let dealersReady = true;
let dealerPricesReady = true;

function getConfig() {
  return window.KOMPUTERRA_SUPABASE_CONFIG || { url: '', anonKey: '', table: 'products' };
}

function restBase() {
  return getConfig().url.replace(/\/$/, '') + '/rest/v1/';
}

function tableUrl(table) {
  return restBase() + table;
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

function saveDealerFeedback(text, isError = false) {
  const node = document.querySelector('[data-dealer-save-feedback]');
  if (!node) return;
  node.textContent = text || '';
  node.style.color = isError ? '#b42318' : '';
}

function renderDealerSetupNotice(message) {
  const list = document.querySelector('[data-dealer-list]');
  if (!list) return;
  list.innerHTML = `<div class="admin-empty admin-warning"><p>${message}</p></div>`;
}

function renderDealerPricesSetupNotice(message) {
  const list = document.querySelector('[data-dealer-prices-list]');
  if (!list) return;
  list.innerHTML = `<div class="admin-empty admin-warning"><p>${message}</p></div>`;
  const saveBtn = document.querySelector('[data-save-dealer-prices]');
  if (saveBtn) saveBtn.disabled = true;
}

function toProductPayload(form) {
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

function toDealerPayload(form) {
  const fd = new FormData(form);
  return {
    name: String(fd.get('name') || '').trim(),
    login: String(fd.get('login') || '').trim(),
    password: String(fd.get('password') || '').trim(),
    is_active: form.isActive.checked,
    updated_at: new Date().toISOString()
  };
}

function setFormMode(title, item) {
  currentEditId = item?.id || null;
  document.querySelector('[data-form-title]').textContent = title;
  saveFeedback('');
}

function setDealerFormMode(title, item) {
  currentDealerEditId = item?.id || null;
  document.querySelector('[data-dealer-form-title]').textContent = title;
  saveDealerFeedback('');
}

function resetProductForm() {
  const form = document.forms.productForm;
  form.reset();
  form.category.value = 'однофазні інвертори';
  form.status.value = 'в наявності';
  form.sortOrder.value = '0';
  form.isActive.checked = true;
  setFormMode('Додати товар', null);
}

function resetDealerForm() {
  const form = document.forms.dealerForm;
  form.reset();
  form.isActive.checked = true;
  setDealerFormMode('Додати дилера', null);
}

function fillProductForm(item) {
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

function fillDealerForm(item) {
  const form = document.forms.dealerForm;
  form.name.value = item.name || '';
  form.login.value = item.login || '';
  form.password.value = item.password || '';
  form.isActive.checked = item.isActive !== false;
  setDealerFormMode('Редагувати дилера', item);
  document.getElementById('dealer-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mapProduct(row) {
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

function mapDealer(row) {
  return {
    id: row.id,
    name: row.name || '',
    login: row.login || '',
    password: row.password || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at || ''
  };
}

function mapDealerPrice(row) {
  return {
    id: row.id,
    dealerId: row.dealer_id,
    productId: row.product_id,
    dealerPrice: Number(row.dealer_price || 0)
  };
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
      if (item) fillProductForm(item);
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
        await patchRow('products', item.id, {
          hidden_by_admin: !restore,
          is_active: restore,
          updated_at: new Date().toISOString()
        });
        await loadProducts();
        if (!restore && currentEditId === item.id) resetProductForm();
      } catch (error) {
        alert('Не вдалося оновити товар: ' + error.message);
      }
    });
  });
}

function renderDealers() {
  const list = document.querySelector('[data-dealer-list]');
  if (!dealersReady) {
    renderDealerSetupNotice('Таблиця дилерів ще не підключена. Спочатку виконай SUPABASE-DEALERS-SETUP.sql у Supabase, а потім онови сторінку.');
    return;
  }
  if (!dealers.length) {
    list.innerHTML = '<div class="admin-empty"><p>Дилерів поки немає.</p></div>';
    return;
  }
  list.innerHTML = dealers.map(item => `
    <div class="admin-item ${item.isActive ? '' : 'is-sheet-hidden'}">
      <div class="admin-item-main">
        <h3>${item.name}</h3>
        <p>Логін: ${item.login}</p>
        <p>${item.isActive ? 'активний' : 'вимкнений'}</p>
      </div>
      <div class="admin-actions admin-actions--inline">
        <button class="btn" type="button" data-prices-id="${item.id}">Ціни</button>
        <button class="btn primary" type="button" data-edit-dealer-id="${item.id}">Редагувати</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit-dealer-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = dealers.find(x => x.id === btn.dataset.editDealerId);
      if (item) fillDealerForm(item);
    });
  });

  list.querySelectorAll('[data-prices-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentDealerId = btn.dataset.pricesId;
      renderDealerPrices();
      document.querySelector('.dealer-prices-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderDealerPrices() {
  const title = document.querySelector('[data-price-panel-title]');
  const subtitle = document.querySelector('[data-price-panel-subtitle]');
  const list = document.querySelector('[data-dealer-prices-list]');
  const saveBtn = document.querySelector('[data-save-dealer-prices]');
  if (!dealerPricesReady || !dealersReady) {
    renderDealerPricesSetupNotice('Щоб керувати дилерськими цінами, спочатку виконай SUPABASE-DEALERS-SETUP.sql у Supabase.');
    return;
  }
  if (!currentDealerId) {
    title.textContent = 'Оберіть дилера';
    subtitle.textContent = 'Для товарів без індивідуальної ціни дилер побачить роздрібну ціну.';
    list.innerHTML = '<div class="admin-empty"><p>Оберіть дилера у списку праворуч, щоб задати індивідуальні ціни.</p></div>';
    saveBtn.disabled = true;
    return;
  }
  const dealer = dealers.find(d => d.id === currentDealerId);
  const map = new Map(dealerPrices.filter(x => x.dealerId === currentDealerId).map(x => [x.productId, x.dealerPrice]));
  title.textContent = `Ціни дилера: ${dealer?.name || ''}`;
  subtitle.textContent = `Логін дилера: ${dealer?.login || ''}. Порожнє поле = дилер бачить роздрібну ціну.`;
  list.innerHTML = products.map(item => `
    <div class="dealer-price-row">
      <div>
        <div class="dealer-price-name">${item.name}</div>
        <div class="dealer-price-meta">${item.category} · Роздріб: ${formatPrice(item.price)}</div>
      </div>
      <div class="note">Роздріб: <strong>${formatPrice(item.price)}</strong></div>
      <div><input type="number" min="0" step="1" data-dealer-price-input data-product-id="${item.id}" value="${map.has(item.id) ? map.get(item.id) : ''}" placeholder="роздрібна"></div>
    </div>
  `).join('');
  saveBtn.disabled = false;
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

async function fetchRows(table, queryBuilder) {
  const endpoint = new URL(tableUrl(table));
  if (queryBuilder) queryBuilder(endpoint.searchParams);
  const res = await fetch(endpoint.toString(), { headers: getAuthHeaders() });
  const rows = await res.json().catch(() => []);
  if (!res.ok) throw new Error((rows && rows.message) || 'Не вдалося завантажити дані');
  return Array.isArray(rows) ? rows : [];
}

async function loadProducts() {
  const rows = await fetchRows('products', (p) => {
    p.set('select', 'id,slug,category,brand,model,name,specs,description,price,warranty,status,eta,image_url,pdf_url,is_active,hidden_by_admin,sort_order');
    p.set('order', 'sort_order.asc.nullslast,name.asc');
  });
  products = rows.map(mapProduct);
  renderCategories();
  renderProducts();
}

async function loadDealers() {
  try {
    const rows = await fetchRows('dealers', (p) => {
      p.set('select', 'id,name,login,password,is_active,created_at');
      p.set('order', 'name.asc');
    });
    dealersReady = true;
    dealers = rows.map(mapDealer);
    renderDealers();
  } catch (error) {
    dealersReady = false;
    dealers = [];
    renderDealerSetupNotice('Таблиця дилерів ще не підключена. Спочатку виконай SUPABASE-DEALERS-SETUP.sql у Supabase, а потім онови сторінку.');
  }
}

async function loadDealerPrices() {
  try {
    const rows = await fetchRows('dealer_prices', (p) => {
      p.set('select', 'id,dealer_id,product_id,dealer_price');
    });
    dealerPricesReady = true;
    dealerPrices = rows.map(mapDealerPrice);
    renderDealerPrices();
  } catch (error) {
    dealerPricesReady = false;
    dealerPrices = [];
    renderDealerPricesSetupNotice('Таблиця дилерських цін ще не підключена. Після запуску SUPABASE-DEALERS-SETUP.sql цей блок запрацює автоматично.');
  }
}

async function patchRow(table, id, payload) {
  const endpoint = new URL(tableUrl(table));
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

async function insertRow(table, payload) {
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: { ...getAuthHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && data.message) || 'POST failed');
  return data;
}

async function upsertRows(table, payload) {
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: { ...getAuthHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && data.message) || 'UPSERT failed');
  return data;
}

async function deleteDealerPrice(dealerId, productId) {
  const endpoint = new URL(tableUrl('dealer_prices'));
  endpoint.searchParams.set('dealer_id', 'eq.' + dealerId);
  endpoint.searchParams.set('product_id', 'eq.' + productId);
  const res = await fetch(endpoint.toString(), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'DELETE failed');
  }
}

async function handleProductSave(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = toProductPayload(form);
  if (!payload.name || !payload.model || !payload.brand) {
    saveFeedback('Заповни назву, модель і бренд.', true);
    return;
  }
  try {
    saveFeedback('Зберігаю...');
    if (currentEditId) {
      await patchRow('products', currentEditId, payload);
      saveFeedback('Товар оновлено в Supabase.');
    } else {
      await insertRow('products', payload);
      saveFeedback('Новий товар додано в Supabase.');
    }
    await loadProducts();
    resetProductForm();
    renderDealerPrices();
  } catch (error) {
    saveFeedback(error.message || 'Не вдалося зберегти товар.', true);
  }
}

async function handleDealerSave(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const payload = toDealerPayload(form);
  if (!dealersReady) {
    saveDealerFeedback('Спочатку виконай SUPABASE-DEALERS-SETUP.sql у Supabase.', true);
    return;
  }
  if (!payload.name || !payload.login || !payload.password) {
    saveDealerFeedback("Заповни ім'я, логін і пароль.", true);
    return;
  }
  try {
    saveDealerFeedback('Зберігаю дилера...');
    if (currentDealerEditId) {
      await patchRow('dealers', currentDealerEditId, payload);
      saveDealerFeedback('Дилера оновлено.');
    } else {
      payload.created_at = new Date().toISOString();
      await insertRow('dealers', payload);
      saveDealerFeedback('Нового дилера додано.');
    }
    await loadDealers();
    resetDealerForm();
  } catch (error) {
    saveDealerFeedback(error.message || 'Не вдалося зберегти дилера.', true);
  }
}

async function saveDealerPrices() {
  if (!dealerPricesReady || !dealersReady) {
    alert('Спочатку виконай SUPABASE-DEALERS-SETUP.sql у Supabase.');
    return;
  }
  if (!currentDealerId) return;
  const inputs = [...document.querySelectorAll('[data-dealer-price-input]')];
  const existing = dealerPrices.filter(x => x.dealerId === currentDealerId);
  const existingMap = new Map(existing.map(x => [x.productId, x]));
  const upserts = [];
  const deletes = [];
  inputs.forEach(input => {
    const productId = input.dataset.productId;
    const raw = String(input.value || '').trim();
    if (!raw) {
      if (existingMap.has(productId)) deletes.push(productId);
      return;
    }
    upserts.push({
      dealer_id: currentDealerId,
      product_id: productId,
      dealer_price: Number(raw)
    });
  });
  const btn = document.querySelector('[data-save-dealer-prices]');
  btn.textContent = 'Зберігаємо...';
  try {
    if (upserts.length) await upsertRows('dealer_prices', upserts);
    for (const productId of deletes) {
      await deleteDealerPrice(currentDealerId, productId);
    }
    await loadDealerPrices();
    btn.textContent = 'Зберегти ціни';
    alert('Дилерські ціни оновлено.');
  } catch (error) {
    btn.textContent = 'Зберегти ціни';
    alert('Не вдалося зберегти ціни: ' + error.message);
  }
}

function togglePanel(isOpen) {
  document.querySelector('[data-login]').classList.toggle('hidden', isOpen);
  document.querySelector('[data-panel]').classList.toggle('hidden', !isOpen);
}

async function afterLogin() {
  togglePanel(true);
  await loadProducts();
  await loadDealers();
  await loadDealerPrices();
  resetProductForm();
  resetDealerForm();
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
    await loadDealers();
    await loadDealerPrices();
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
  document.forms.productForm.addEventListener('submit', handleProductSave);
  document.querySelector('[data-reset-form]').addEventListener('click', resetProductForm);
  document.forms.dealerForm.addEventListener('submit', handleDealerSave);
  document.querySelector('[data-reset-dealer-form]').addEventListener('click', resetDealerForm);
  document.querySelector('[data-logout]').addEventListener('click', logout);
  document.querySelector('[data-save-dealer-prices]').addEventListener('click', saveDealerPrices);
}

window.addEventListener('DOMContentLoaded', async () => {
  initLogin();
  initAdmin();
  await tryRestoreSession();
});
