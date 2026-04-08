const dealerState = {
  products: [],
  filtered: [],
  activeCategory: 'all',
  query: '',
  dealer: null
};

function normalizeText(text='') {
  return text.toString().trim().toLowerCase();
}

function formatPrice(n) {
  return new Intl.NumberFormat('uk-UA').format(Number(n || 0)) + ' грн';
}

function statusText(item) {
  if (item.status === 'в наявності') return 'В наявності';
  if (item.status === 'в дорозі') return item.eta ? `В дорозі · ${item.eta}` : 'В дорозі';
  return 'Відсутній';
}

function statusClass(item) {
  if (item.status === 'в наявності') return 'instock';
  if (item.status === 'в дорозі') return 'transit';
  return 'out';
}

function initMobileMenu() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!toggle || !menu) return;
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  const openMenu = () => {
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  toggle.addEventListener('click', () => menu.classList.contains('open') ? closeMenu() : openMenu());
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.closest('.mobile-menu-link')) closeMenu();
  });
}

function renderCategories() {
  const wrap = document.querySelector('[data-categories]');
  const categories = ['all', ...new Set(dealerState.products.map(p => p.category).filter(Boolean))];
  wrap.innerHTML = categories.map(cat => {
    const label = cat === 'all' ? 'Усі товари' : cat;
    const active = dealerState.activeCategory === cat ? 'active' : '';
    return `<button class="category-pill ${active}" type="button" data-cat="${cat}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
    dealerState.activeCategory = btn.dataset.cat;
    filterProducts();
  }));
}

function filterProducts() {
  const q = normalizeText(dealerState.query);
  dealerState.filtered = dealerState.products.filter(item => {
    const matchesCategory = dealerState.activeCategory === 'all' || item.category === dealerState.activeCategory;
    const hay = normalizeText([item.name, item.model, item.brand, item.specs, item.category].join(' '));
    return matchesCategory && (!q || hay.includes(q));
  });
  renderCategories();
  renderCatalog();
}

function renderCatalog() {
  const tableBody = document.querySelector('[data-catalog-body]');
  const mobileList = document.querySelector('[data-mobile-list]');
  const count = document.querySelector('[data-count]');
  if (count) count.textContent = `${dealerState.filtered.length} позицій`;
  if (!dealerState.filtered.length) {
    tableBody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--muted)">Товари поки не знайдено.</td></tr>';
    mobileList.innerHTML = '<div class="panel-card"><p class="note">Товари поки не знайдено.</p></div>';
    return;
  }

  tableBody.innerHTML = dealerState.filtered.map(item => `
    <tr>
      <td>${item.category}</td>
      <td>
        <a class="name-cell" href="product.html?id=${encodeURIComponent(item.id)}&dealer=1">
          <strong>${item.name}</strong>
          <span>${item.model || ''}</span>
        </a>
      </td>
      <td>${item.specs || ''}</td>
      <td><span class="price dealer-retail-price">${formatPrice(item.price)}</span></td>
      <td><span class="price dealer-own-price">${formatPrice(item.dealerPrice)}</span></td>
      <td><span class="badge ${statusClass(item)}">${statusText(item)}</span></td>
    </tr>
  `).join('');

  mobileList.innerHTML = dealerState.filtered.map(item => `
    <a class="item-card" href="product.html?id=${encodeURIComponent(item.id)}&dealer=1">
      <div class="item-sep"></div>
      <div class="item-grid">
        <div>
          <div class="item-key">Товар</div>
          <div class="item-val"><strong>${item.name}</strong></div>
        </div>
        <div>
          <div class="item-key">Ціна дилера</div>
          <div class="item-val"><strong>${formatPrice(item.dealerPrice)}</strong></div>
        </div>
      </div>
      <div class="item-grid">
        <div>
          <div class="item-key">Роздрібна ціна</div>
          <div class="item-val">${formatPrice(item.price)}</div>
        </div>
        <div>
          <div class="item-key">Категорія</div>
          <div class="item-val">${item.category}</div>
        </div>
      </div>
      <div class="item-grid">
        <div>
          <div class="item-key">Характеристики</div>
          <div class="item-val">${item.specs || ''}</div>
        </div>
        <div>
          <div class="item-key">Наявність</div>
          <div class="item-val"><span class="badge ${statusClass(item)}">${statusText(item)}</span></div>
        </div>
      </div>
    </a>
  `).join('');
}

async function logoutEverywhere() {
  await window.KOMPUTERRA_DEALER_AUTH.logout();
  location.href = 'dealer-login.html';
}

window.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();
  document.querySelector('[data-search]').addEventListener('input', (e) => {
    dealerState.query = e.target.value;
    filterProducts();
  });
  document.querySelector('[data-dealer-logout]').addEventListener('click', logoutEverywhere);
  document.querySelector('[data-mobile-logout]').addEventListener('click', (e) => {
    e.preventDefault();
    logoutEverywhere();
  });

  const auth = window.KOMPUTERRA_DEALER_AUTH;
  const session = await auth.refreshSession();
  if (!session?.session_token) {
    location.href = 'dealer-login.html';
    return;
  }
  dealerState.dealer = session;
  document.querySelector('[data-dealer-name]').textContent = session.name || session.login || 'Дилер';

  try {
    dealerState.products = await auth.fetchCatalog();
    dealerState.filtered = [...dealerState.products];
    document.querySelector('[data-sync-note]').textContent = `Показано ціни дилера ${session.name || session.login}. Якщо індивідуальна ціна не задана, підставляється роздрібна.`;
    renderCategories();
    renderCatalog();
  } catch (error) {
    document.querySelector('[data-sync-note]').textContent = 'Не вдалося завантажити дилерський каталог.';
  }
});
