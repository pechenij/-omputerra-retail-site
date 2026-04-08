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

async function safeFetchJson(url) {
  try {
    if (location.protocol === 'file:') throw new Error('skip fetch on file protocol');
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (error) {
    return null;
  }
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
function getId() {
  return new URLSearchParams(location.search).get('id');
}
function wantsDealerView() {
  return new URLSearchParams(location.search).get('dealer') === '1';
}
async function loadConfig() {
  return await safeFetchJson('data/site-config.json') || window.KOMPUTERRA_DEFAULT_CONFIG || {};
}
function fallbackProducts() {
  return (window.KOMPUTERRA_DEFAULT_PRODUCTS || []).filter(item => !item.hiddenByAdmin && !item.hiddenBySheet);
}
async function loadProduct(id) {
  if (wantsDealerView() && window.KOMPUTERRA_DEALER_AUTH) {
    const dealerItem = await window.KOMPUTERRA_DEALER_AUTH.fetchProduct(id).catch(() => null);
    if (dealerItem) return { item: dealerItem, dealerMode: true };
  }
  if (window.KOMPUTERRA_fetchSupabaseProductById) {
    const remote = await window.KOMPUTERRA_fetchSupabaseProductById(id);
    if (remote) return { item: remote, dealerMode: false };
  }
  const fallback = fallbackProducts().find(item => item.id === id) || null;
  return { item: fallback, dealerMode: false };
}
function fill(item, config, dealerMode) {
  document.title = `${item.name} — КОМПУТЕРРА`;
  document.querySelector('[data-product-name]').textContent = item.name;
  document.querySelector('[data-product-model]').textContent = item.model || '';
  document.querySelector('[data-product-copy]').textContent = item.description || '';
  document.querySelector('[data-product-category]').textContent = item.category || '';
  document.querySelector('[data-product-specs]').textContent = item.specs || '';
  document.querySelector('[data-product-warranty]').textContent = item.warranty || '';
  const badge = document.querySelector('[data-product-status]');
  badge.textContent = statusText(item);
  badge.className = `badge ${statusClass(item)}`;
  document.querySelector('[data-product-price]').textContent = formatPrice(item.price);
  const dealerBox = document.querySelector('[data-dealer-price-box]');
  const dealerPriceNode = document.querySelector('[data-product-dealer-price]');
  if (dealerMode && dealerBox && dealerPriceNode) {
    dealerBox.classList.remove('hidden');
    dealerPriceNode.textContent = formatPrice(item.dealerPrice || item.price);
  }
  const img = document.querySelector('[data-product-image]');
  img.src = item.image || 'assets/placeholder-inverter.svg';
  img.alt = item.name;
  const pdf = document.querySelector('[data-product-pdf]');
  if (!item.pdf || item.pdf === '#') {
    pdf.classList.add('disabled');
    pdf.setAttribute('aria-disabled', 'true');
    pdf.removeAttribute('href');
    pdf.removeAttribute('target');
  } else {
    pdf.href = item.pdf;
  }
  document.querySelectorAll('[data-phone-display]').forEach(el => el.textContent = config.phoneDisplay || '096 044 64 46');
  document.querySelectorAll('[data-phone-href]').forEach(el => el.href = config.phoneHref || 'tel:+380960446446');
  document.querySelectorAll('[data-address]').forEach(el => el.textContent = config.address || 'м. Світловодськ, вул. Городоцька, 13');
  const back = document.querySelector('.back-link');
  if (dealerMode) back.href = 'dealer-portal.html';
}
async function boot() {
  initMobileMenu();
  const id = getId();
  const config = await loadConfig();
  const { item, dealerMode } = await loadProduct(id);
  if (!item) {
    document.querySelector('[data-product-root]').innerHTML = '<div class="panel-card"><p>Товар не знайдено.</p></div>';
    return;
  }
  fill(item, config, dealerMode);
}
boot();
