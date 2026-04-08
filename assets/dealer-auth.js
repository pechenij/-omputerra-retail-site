(function(){
  const SESSION_KEY = 'komputerra_dealer_session_v1';

  function getConfig() {
    return window.KOMPUTERRA_SUPABASE_CONFIG || { url: '', anonKey: '' };
  }

  function restHeaders(contentType = true) {
    const cfg = getConfig();
    const headers = {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + cfg.anonKey,
      Accept: 'application/json'
    };
    if (contentType) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function rpc(fn, payload = {}, { contentType = true } = {}) {
    const cfg = getConfig();
    const url = cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn;
    const res = await fetch(url, {
      method: 'POST',
      headers: restHeaders(contentType),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (data && (data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      throw new Error(message);
    }
    return data;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function setSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function login(login, password) {
    const data = await rpc('dealer_login', { p_login: login, p_password: password });
    if (!data || !data.id || !data.session_token) {
      throw new Error('Невірний логін або пароль');
    }
    setSession(data);
    return data;
  }

  async function refreshSession() {
    const session = getSession();
    if (!session?.session_token) return null;
    try {
      const data = await rpc('dealer_session', { p_session_token: session.session_token });
      if (!data || !data.id) {
        clearSession();
        return null;
      }
      const merged = { ...session, ...data };
      setSession(merged);
      return merged;
    } catch (error) {
      clearSession();
      return null;
    }
  }

  async function fetchCatalog() {
    const session = await refreshSession();
    if (!session?.session_token) throw new Error('Потрібен вхід дилера');
    const rows = await rpc('dealer_catalog', { p_session_token: session.session_token });
    return Array.isArray(rows) ? rows.map(mapDealerProduct) : [];
  }

  async function fetchProduct(productId) {
    const session = await refreshSession();
    if (!session?.session_token || !productId) return null;
    const row = await rpc('dealer_product', { p_session_token: session.session_token, p_product_id: productId });
    return row ? mapDealerProduct(row) : null;
  }

  async function logout() {
    const session = getSession();
    if (session?.session_token) {
      try {
        await rpc('dealer_logout', { p_session_token: session.session_token });
      } catch (error) {}
    }
    clearSession();
  }

  function mapDealerProduct(row) {
    return {
      id: row.product_id || row.id,
      dealerId: row.dealer_id || null,
      category: row.category || '',
      brand: row.brand || '',
      model: row.model || '',
      name: row.name || '',
      specs: row.specs || '',
      description: row.description || '',
      price: Number(row.retail_price || row.price || 0),
      dealerPrice: Number(row.dealer_price || row.price || row.retail_price || 0),
      warranty: row.warranty || '',
      status: row.status || 'в наявності',
      eta: row.eta || '',
      image: row.image_url || row.image || '',
      pdf: row.pdf_url || row.pdf || '#',
      sortOrder: Number(row.sort_order || 0)
    };
  }

  window.KOMPUTERRA_DEALER_AUTH = {
    login,
    logout,
    getSession,
    refreshSession,
    fetchCatalog,
    fetchProduct
  };
})();
