const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'admin12345';
let products = [];

function formatPrice(n) {
  return new Intl.NumberFormat('uk-UA').format(Number(n || 0)) + ' грн';
}

function statusText(item) {
  if (item.status === 'в наявності') return 'в наявності';
  if (item.status === 'в дорозі') return item.eta ? `в дорозі · ${item.eta}` : 'в дорозі';
  return 'відсутній';
}

async function loadProducts() {
  const result = window.KOMPUTERRA_fetchSupabaseProducts
    ? await window.KOMPUTERRA_fetchSupabaseProducts()
    : { products: [], meta: { status: 'disabled' } };
  products = result.products || [];
  renderProducts(result.meta);
}

function renderProducts(meta) {
  const list = document.querySelector('[data-product-list]');
  const feedback = document.querySelector('[data-sync-feedback]');
  if (feedback) {
    feedback.textContent = meta?.status === 'live'
      ? `Підключено до Supabase. Зараз у базі: ${products.length} товар(ів).`
      : 'Не вдалося завантажити товари з Supabase. Показано порожній список.';
  }
  if (!products.length) {
    list.innerHTML = '<div class="admin-empty"><p>У базі поки немає видимих товарів.</p><p class="note">Додай товари у Supabase Table Editor.</p></div>';
    return;
  }
  list.innerHTML = products.map(item => `
    <div class="admin-item">
      <div class="admin-item-main">
        <h3>${item.name}</h3>
        <p>${item.model || ''} · ${item.category || ''}</p>
        <p>${formatPrice(item.price)} · ${statusText(item)}</p>
      </div>
      <div class="admin-actions admin-actions--inline">
        <button class="btn" type="button" disabled>Підключимо редагування після імпорту всіх товарів</button>
      </div>
    </div>
  `).join('');
}

function initLogin() {
  document.forms.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = e.target.login.value.trim();
    const password = e.target.password.value.trim();
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      document.querySelector('[data-login]').classList.add('hidden');
      document.querySelector('[data-panel]').classList.remove('hidden');
      await loadProducts();
    } else {
      alert('Невірний логін або пароль');
    }
  });
}

window.addEventListener('DOMContentLoaded', initLogin);
