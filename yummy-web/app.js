const API_BASE = 'https://yummy-foodhub-webapp.onrender.com';

const state = {
  user: readStorage('yummy-user'),
  cart: [],
  menu: [],
  inventory: [],
  orders: [],
  staffOrders: [],
  myDishes: [],
  dashboard: null,
  sellerDashboard: null,
  sellerOrders: [],
  page: 'menu',
  pageHistory: [],
  category: 'All',
  search: '',
  registering: false,
  authMode: 'customer',
  menuSource: 'all',
  recipeSource: 'community',
};

const imageChoices = [
  'photo-1547592180-85f173990554',
  'photo-1512621776951-a57141f2eefd',
  'photo-1565299624946-b28f40a0ae38',
  'photo-1568901346375-23c9450c58cd',
  'photo-1476224203421-9ac39bcb3327',
  'photo-1490645935967-10de6ba17061',
  'photo-1546069901-ba9599a7e63c',
  'photo-1513104890138-7c749659a591',
];

function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function money(value) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

async function api(path, options = {}) {
  // Use the same origin so local and hosted frontend pages call their serving API.
  const token = readStorage('yummy-token');
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function setMessage(element, text) {
  element.textContent = text;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function updateAuthForm() {
  const staffMode = state.authMode === 'staff';
  const nameField = document.querySelector('#name-field');
  const title = document.querySelector('#auth-title');
  const eyebrow = document.querySelector('#auth-eyebrow');
  const intro = document.querySelector('#auth-intro');
  const submit = document.querySelector('#auth-submit');
  const switchCopy = document.querySelector('#auth-switch-copy');
  const switchButton = document.querySelector('#auth-switch');
  const password = document.querySelector('[name="password"]');
  nameField.classList.toggle('hidden', !state.registering || staffMode);
  title.textContent = state.registering ? 'Make yourself at home.' : staffMode ? 'Welcome, team.' : 'Come on in.';
  eyebrow.textContent = state.registering ? 'A SEAT IS WAITING' : staffMode ? 'STAFF & ADMIN ACCESS' : 'WELCOME BACK';
  intro.textContent = state.registering ? 'Create an account and find your new favorite.' : staffMode ? 'Sign in with your staff account to manage menu stock.' : 'Sign in to pick up where your appetite left off.';
  submit.textContent = state.registering ? 'Create account' : 'Sign in';
  switchCopy.textContent = state.registering ? 'Already have an account?' : 'New around here?';
  switchButton.textContent = state.registering ? 'Sign in' : 'Create an account';
  password.autocomplete = state.registering ? 'new-password' : 'current-password';
  document.querySelector('#auth-switch-row').classList.toggle('hidden', staffMode);
  document.querySelectorAll('[data-auth-mode]').forEach((button) => {
    const active = button.dataset.authMode === state.authMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#auth-message').textContent = '';
}

function showAuth() {
  document.querySelector('#auth-view').classList.remove('hidden');
  document.querySelector('#app-view').classList.add('hidden');
}

function showApp() {
  document.querySelector('#auth-view').classList.add('hidden');
  document.querySelector('#app-view').classList.remove('hidden');
  const isAdmin = state.user.role === 'admin';
  const isStaff = state.user.role === 'staff';
  document.querySelector('#customer-nav').classList.toggle('hidden', isAdmin || isStaff);
  document.querySelector('#staff-nav').classList.toggle('hidden', !isStaff);
  document.querySelector('#admin-nav').classList.toggle('hidden', !isAdmin);
  document.querySelector('#user-name').textContent = state.user.name;
  document.querySelector('#user-role').textContent = state.user.role;
  document.querySelector('#user-avatar').textContent = (state.user.name || 'Y').trim().charAt(0).toUpperCase();
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  state.page = isAdmin ? 'dashboard' : isStaff ? 'inventory' : 'menu';
  state.pageHistory = [];
  setActiveNav();
  renderPage();
}

function setActiveNav() {
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === state.page);
  });
  document.querySelector('#back-button').disabled = state.pageHistory.length === 0;
}

function setPage(page) {
  if (page === state.page) return;
  state.pageHistory.push(state.page);
  state.page = page;
  setActiveNav();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  const previousPage = state.pageHistory.pop();
  if (!previousPage) return;
  state.page = previousPage;
  setActiveNav();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadMenu() {
  return api('/menu');
}

async function renderPage() {
  // Keep navigation state in one place so page changes can refresh their own data.
  const content = document.querySelector('#page-content');
  const crumb = document.querySelector('#page-crumb');
  const pages = {
    menu: 'Discover', orders: 'My orders', inventory: 'Inventory',
    'staff-orders': 'Orders', dashboard: 'Dashboard', 'my-dishes': 'My food',
    'my-sales': 'My sales', 'create-recipe': 'Create dish',
  };
  crumb.textContent = pages[state.page] || 'Discover';
  if (state.page === 'menu') {
    content.innerHTML = '<div class="empty-state">Loading today\'s menu...</div>';
    try {
      state.menu = await loadMenu();
      renderMenu();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} Make sure the server and database are running. <button data-action="retry-menu">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'dashboard') {
    content.innerHTML = '<div class="empty-state">Preparing your business overview...</div>';
      try {
        state.dashboard = await api('/admin/dashboard');
      renderAdminDashboard();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-dashboard">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'create-recipe') {
    renderCreateRecipe();
    return;
  }
  if (state.page === 'my-dishes') {
    content.innerHTML = '<div class="empty-state">Loading your dishes...</div>';
    try {
      state.myDishes = await api(`/recipes/user/${encodeURIComponent(state.user.id)}`);
      renderMyDishes();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-my-dishes">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'my-sales') {
    content.innerHTML = '<div class="empty-state">Loading your sales...</div>';
    try {
      [state.sellerDashboard, state.sellerOrders] = await Promise.all([
        api('/seller/dashboard'),
        api('/seller/orders'),
      ]);
      renderSellerDashboard();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-my-sales">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'orders') {
    content.innerHTML = '<div class="empty-state">Gathering your orders...</div>';
    try {
      state.orders = await api(`/orders/${encodeURIComponent(state.user.id)}`);
      renderOrders();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="retry-orders">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'staff-orders') {
    content.innerHTML = '<div class="empty-state">Loading orders...</div>';
    try {
        state.staffOrders = await api('/staff/orders');
      renderStaffOrders();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-staff-orders">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'inventory') {
    content.innerHTML = '<div class="empty-state">Loading inventory...</div>';
    try {
      state.inventory = await api('/inventory');
      renderInventory();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="retry-inventory">Try again</button></div>`;
    }
  }
}

function renderMenu() {
  const categories = ['All', ...new Set(state.menu.map((item) => item.category).filter(Boolean))];
  if (!categories.includes(state.category)) state.category = 'All';
  const filtered = state.menu.filter((item) => {
    const matchesCategory = state.category === 'All' || item.category === state.category;
    const source = item.listing_type || (item.seller_user_id ? 'community' : 'business');
    const matchesSource = state.menuSource === 'all' || source === state.menuSource;
    const query = state.search.trim().toLowerCase();
    const searchable = [
      item.title,
      item.category,
      item.description,
      item.seller_name,
      item.creator_name,
      item.creator_role,
      ...(item.ingredients || []).map((ingredient) => `${ingredient.quantity_text} ${ingredient.ingredient_name}`),
    ].join(' ').toLowerCase();
    return matchesCategory && matchesSource && (!query || searchable.includes(query));
  });
  const cards = filtered.map((item, index) => {
    const outOfStock = Number(item.stock_quantity) <= 0;
    const image = imageChoices[index % imageChoices.length];
    const imageUrl = item.image_url || `https://images.unsplash.com/${image}?auto=format&fit=crop&w=700&q=80`;
    const safeImageUrl = String(imageUrl).replace(/['"]/g, '\\$&');
    const ingredients = (item.ingredients || []).map((ingredient) => {
      const quantity = ingredient.quantity_text ? `${ingredient.quantity_text} ` : '';
      return `${quantity}${ingredient.ingredient_name}`;
    }).join(', ');
    // Older menu rows may not have a source value until they pass through the schema migration.
    const listingType = item.listing_type || (item.seller_user_id ? 'community' : 'business');
    const source = listingType === 'community'
      ? `Community dish · ${item.seller_name || item.creator_name || 'Local cook'}`
      : item.creator_name
        ? `Hub menu · ${item.creator_name} (${item.creator_role || 'staff'})`
        : 'Hub menu · Yummy Food Hub';
    const recipeDetails = item.preparation_steps
      ? `<details class="food-recipe"><summary>View recipe</summary><p>${escapeHtml(item.preparation_steps)}</p></details>`
      : '';
    return `<article class="food-card">
      <div class="food-photo" style="background-image:url('${safeImageUrl}')"><span class="food-tag">${escapeHtml(item.category || 'Fresh pick')}</span></div>
      <div class="food-body"><div class="food-title-row"><h3 class="food-title">${escapeHtml(item.title)}</h3><span class="food-price">${money(item.price)}</span></div>
      <p class="food-source">${escapeHtml(source)}</p>
      <p class="food-description">${escapeHtml(item.description || 'Freshly prepared with good ingredients and a little extra care.')}</p>
      <p class="food-ingredients"><strong>Ingredients</strong> ${escapeHtml(ingredients || 'Not listed')}</p>
      ${recipeDetails}
      <div class="food-footer"><span class="stock-label ${outOfStock ? 'out' : ''}">${outOfStock ? 'Unavailable · admin review' : `Available · ${Number(item.stock_quantity)} left`}</span>
      <button class="add-button" data-action="add" data-id="${escapeHtml(item.id)}"><span aria-hidden="true">+</span> ${outOfStock ? 'Request order' : 'Add'}</button></div></div>
    </article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `
    <div class="menu-banner"><div class="banner-copy"><p class="banner-kicker">A GOOD DAY STARTS HERE</p><h2>Something lovely<br>for your table.</h2><p>Fresh favorites, made to brighten your day.</p></div></div>
    <div class="page-heading"><div><p class="eyebrow">THE GOOD STUFF</p><h1>Today's menu</h1><p>Find a little delicious in every bite.</p></div></div>
    <div class="menu-tools"><div class="menu-filters"><div class="source-list" role="group" aria-label="Dish source">${[['all', 'All dishes'], ['business', 'Hub menu'], ['community', 'Community']].map(([source, label]) => `<button class="source-button ${source === state.menuSource ? 'active' : ''}" data-action="source" data-source="${source}">${label}</button>`).join('')}</div><div class="category-list">${categories.map((category) => `<button class="category-button ${category === state.category ? 'active' : ''}" data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}</div></div>
    <label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input id="menu-search" type="search" value="${escapeHtml(state.search)}" placeholder="Find something good" aria-label="Search menu"></label></div>
    <div class="section-title"><h2>${state.category === 'All' ? 'Customer favorites' : escapeHtml(state.category)}</h2><span>${filtered.length} ${filtered.length === 1 ? 'dish' : 'dishes'}</span></div>
    ${filtered.length ? `<div class="menu-grid">${cards}</div>` : '<div class="empty-state">No dishes found. Try another search or category.</div>'}`;
}

function renderOrders() {
  const content = document.querySelector('#page-content');
  const orders = state.orders;
  const rows = orders.map((order) => {
    const items = (order.items || []).map((item) => {
      const status = String(item.item_status || order.status || 'pending').toLowerCase();
      const seller = item.seller_name || 'Yummy Food Hub';
      return `<div class="order-line"><span>${item.quantity} × ${escapeHtml(item.title)}<small>from ${escapeHtml(seller)}</small></span><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></div>`;
    }).join('');
    const date = order.created_at ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(order.created_at)) : 'Recently placed';
    const status = String(order.status || 'pending').toLowerCase();
    return `<article class="order-row"><div><div class="order-id">Order #${escapeHtml(order.id)}</div><div class="order-date">${escapeHtml(date)}</div></div><div class="order-items">${items || 'Order details unavailable'}</div><div class="order-total">${money(order.total_amount)}</div><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></article>`;
  }).join('');
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR YUMMY MOMENTS</p><h1>My orders</h1><p>Everything you've ordered, all in one place.</p></div><button class="table-action" data-action="refresh-orders">↻ Refresh</button></div>${orders.length ? `<div class="orders-list">${rows}</div>` : '<div class="empty-state">No orders just yet. Your first favorite is waiting in the menu.</div>'}`;
}

function renderStaffOrders() {
  const pendingCount = state.staffOrders.reduce((count, order) => count + (order.items || []).filter((item) => item.item_status === 'pending').length, 0);
  const rows = state.staffOrders.map((order) => {
    const items = (order.items || []).map((item) => {
      const status = String(item.item_status || order.status || 'pending').toLowerCase();
      const lineTotal = Number(item.price) * Number(item.quantity);
      // Admin actions target each dish line because sellers can decide independently in mixed carts.
      const actions = status === 'pending'
        ? `<button class="table-action approve-button" data-action="update-order-item" data-status="approved" data-id="${escapeHtml(item.order_item_id)}">Approve</button><button class="table-action reject-button" data-action="update-order-item" data-status="rejected" data-id="${escapeHtml(item.order_item_id)}">Reject</button>`
        : status === 'approved'
          ? `<button class="table-action" data-action="update-order-item" data-status="completed" data-id="${escapeHtml(item.order_item_id)}">Mark complete</button>`
          : '';
      const sellerName = item.seller_name || 'Yummy Food Hub';
      return `<div class="admin-order-line"><div class="admin-order-line-title"><strong>${item.quantity} × ${escapeHtml(item.title)}</strong><span>${escapeHtml(sellerName)}</span></div><div class="admin-order-line-money"><span>Dish total ${money(lineTotal)}</span><span>Commission ${money(item.commission_amount)}</span><span>Seller net ${money(item.seller_amount)}</span></div><div class="admin-order-line-actions"><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>${actions}</div></div>`;
    }).join('');
    const date = order.created_at ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.created_at)) : 'Recently placed';
    const status = String(order.status || 'pending').toLowerCase();
    return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.customer_email)} · ${escapeHtml(date)}</div></div><div><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status.replaceAll('_', ' '))}</span></div></div><div class="admin-order-lines">${items || '<div class="empty-state">No order lines</div>'}</div></article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">ORDER MANAGEMENT</p><h1>All orders</h1><p>${pendingCount} dish ${pendingCount === 1 ? 'request' : 'requests'} awaiting approval.</p></div><button class="table-action" data-action="refresh-staff-orders">↻ Refresh</button></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No orders have been placed yet.</div>'}`;
}

function renderInventory() {
  const rows = state.inventory.map((item) => {
    const count = Number(item.stock_quantity) || 0;
    const source = item.listing_type === 'community'
      ? `Community · ${item.seller_name || item.creator_name || 'Local cook'}`
      : item.creator_name
        ? `Hub menu · ${item.creator_name} (${item.creator_role || 'staff'})`
        : 'Hub menu · Yummy Food Hub';
    return `<div class="inventory-row"><div class="inventory-name">${escapeHtml(item.title)}<span class="inventory-meta">${escapeHtml(item.category || 'Uncategorized')} · ${escapeHtml(source)}</span></div><div class="inventory-category">${escapeHtml(item.listing_type === 'community' ? 'Community dish' : 'Hub dish')}</div><div class="inventory-qty"><span class="stock-number ${count <= 5 ? 'low' : ''}">${count}</span><span class="inventory-category">${count <= 5 ? 'Low stock' : 'In stock'}</span></div><button class="table-action" data-action="edit-stock" data-id="${escapeHtml(item.id)}">Adjust stock</button></div>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">KEEP THINGS FRESH</p><h1>Inventory</h1><p>Update availability as the day unfolds.</p></div><button class="table-action" data-action="refresh-inventory">↻ Refresh</button></div>
  <div class="content-table"><div class="table-head"><span>Menu item</span><span>Category</span><span>Availability</span><span></span></div>${rows || '<div class="empty-state">No inventory items available.</div>'}</div>`;
}

function renderAdminDashboard() {
  const { summary, recentOrders } = state.dashboard;
  const stats = [
    ['Orders placed', Number(summary.total_orders)],
    ['Awaiting review', Number(summary.pending_orders)],
    ['Approved sales', money(summary.total_sales)],
    ['Commission earned', money(summary.total_commission)],
    ['Available dishes', `${Number(summary.available_dishes)} / ${Number(summary.total_dishes)}`],
  ];
  const rows = recentOrders.map((order) => {
    const items = (order.items || []).map((item) => {
      const source = item.listing_type === 'community'
        ? `Community · ${item.seller_name || 'seller'}`
        : `Hub menu${item.creator_name ? ` · ${item.creator_name}` : ''}`;
      return `${item.quantity} × ${escapeHtml(item.title)} (${escapeHtml(source)} · ${escapeHtml(item.item_status)})`;
    }).join(', ');
    return `<article class="dashboard-order-row"><div><strong>Order #${escapeHtml(order.id)}</strong><span>${escapeHtml(order.customer_name)}</span></div><div>${items || 'Order details unavailable'}</div><strong>${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(order.status)}</span></article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">BUSINESS OVERVIEW</p><h1>Dashboard</h1><p>Orders, sales, and food availability at a glance.</p></div><div class="dashboard-actions"><button class="table-action" data-action="open-order-queue">View all orders</button><button class="table-action" data-action="refresh-dashboard">↻ Refresh</button></div></div>
  <div class="dashboard-stats">${stats.map(([label, value]) => `<article class="dashboard-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</div>
  <div class="section-title dashboard-section-title"><h2>Recent orders</h2><span>Newest first</span></div>
  ${rows ? `<div class="dashboard-order-list">${rows}</div>` : '<div class="empty-state">No orders have been placed yet.</div>'}`;
}

function renderSellerDashboard() {
  const summary = state.sellerDashboard.summary;
  const stats = [
    ['Orders received', Number(summary.orders_received)],
    ['Awaiting your decision', Number(summary.pending_dishes)],
    ['Your earnings', money(summary.seller_earnings)],
    ['Hub commission (5%)', money(summary.commission)],
  ];
  const rows = state.sellerOrders.map((line) => {
    const status = String(line.item_status || 'pending').toLowerCase();
    const gross = Number(line.price) * Number(line.quantity);
    const actions = status === 'pending'
      ? `<button class="table-action approve-button" data-action="update-order-item" data-status="approved" data-id="${escapeHtml(line.order_item_id)}">Approve</button><button class="table-action reject-button" data-action="update-order-item" data-status="rejected" data-id="${escapeHtml(line.order_item_id)}">Reject</button>`
      : status === 'approved'
        ? `<button class="table-action" data-action="update-order-item" data-status="completed" data-id="${escapeHtml(line.order_item_id)}">Mark complete</button>`
        : '';
    return `<article class="seller-sale-row"><div><strong>${escapeHtml(line.title)}</strong><span>Order #${escapeHtml(line.order_id)} · ${escapeHtml(line.created_at ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium' }).format(new Date(line.created_at)) : 'Recently')}</span></div><div class="seller-buyer"><strong>${escapeHtml(line.buyer_name)}</strong><span>${escapeHtml(line.buyer_email)}</span></div><span>${line.quantity} × ${money(line.price)}</span><div class="seller-payout"><span>Gross ${money(gross)}</span><span>Fee ${money(line.commission_amount)}</span><strong>Net ${money(line.seller_amount)}</strong></div><div class="seller-sale-actions"><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>${actions}</div></article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR ORDERS & EARNINGS</p><h1>My sales</h1><p>See each buyer, decide on your dish orders, and track your net earnings.</p></div><button class="table-action" data-action="refresh-my-sales">↻ Refresh</button></div>
  <div class="dashboard-stats seller-stats">${stats.map(([label, value]) => `<article class="dashboard-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</div>
  <div class="section-title dashboard-section-title"><h2>Orders for your dishes</h2><span>Only your listings</span></div>
  ${rows ? `<div class="seller-sale-list">${rows}</div>` : '<div class="empty-state">No one has ordered your dishes yet. Orders will show up here with the buyer details.</div>'}`;
}

function renderCreateRecipe() {
  const isBusinessDish = state.recipeSource === 'business';
  const pageTitle = isBusinessDish ? 'Add a house dish' : 'Create a dish';
  const pageDescription = isBusinessDish
    ? 'Publish a Yummy Food Hub dish created by staff or admin.'
    : 'Share your recipe with everyone browsing Yummy Food Hub.';
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">${isBusinessDish ? 'YUMMY FOOD HUB MENU' : 'FROM YOUR KITCHEN'}</p><h1>${pageTitle}</h1><p>${pageDescription}</p></div></div>
  <form id="recipe-form" class="recipe-form">
    <label class="field">Dish name<input name="title" maxlength="160" placeholder="e.g. Groundnut Luwombo" required></label>
    <label class="field">Category<input name="category" maxlength="80" placeholder="Traditional, Street Food..." required></label>
    <label class="field">Price in UGX<input name="price" type="number" min="1000" step="500" placeholder="12000" required></label>
    <label class="field">Available portions<input name="stock_quantity" type="number" min="0" step="1" value="5" required></label>
    <label class="field recipe-wide">Dish photo<input type="file" name="dish_image" accept="image/*"></label>
    <div id="recipe-image-preview" class="recipe-image-preview hidden"></div>
    <label class="field recipe-wide">Description<textarea name="description" maxlength="500" rows="3" placeholder="Tell people what makes this dish special."></textarea></label>
    <label class="field recipe-wide">Ingredients, one per line<textarea name="ingredients" rows="5" placeholder="2 eggs&#10;1 chapati&#10;1 tomato" required></textarea></label>
    <label class="field recipe-wide">Preparation steps<textarea name="preparation_steps" rows="5" placeholder="Explain how to prepare the dish, step by step." required></textarea></label>
    <p id="recipe-message" class="form-message recipe-wide" role="alert"></p>
    <div class="recipe-actions recipe-wide"><span>Set portions to 0 to mark the dish unavailable.</span><button class="button button-dark" type="submit">Publish dish</button></div>
  </form>`;
}

function renderMyDishes() {
  const rows = state.myDishes.map((item) => {
    const available = Number(item.stock_quantity) > 0;
    return `<div class="my-dish-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${money(item.price)}</span></div><span class="status-pill ${available ? 'approved' : 'rejected'}">${available ? `Available · ${item.stock_quantity}` : 'Unavailable'}</span><button class="table-action" data-action="edit-stock" data-id="${escapeHtml(item.id)}">Update availability</button></div>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR LISTINGS</p><h1>My food</h1><p>Manage portions and availability for your dishes.</p></div><button class="table-action" data-action="go-create-recipe">＋ Create dish</button></div>
  ${rows ? `<div class="my-dish-list">${rows}</div>` : '<div class="empty-state">You have not published a dish yet. Add your first recipe to the menu.</div>'}`;
}

function syncCart() {
  if (state.user) writeStorage(`yummy-cart-${state.user.id}`, state.cart);
  const count = state.cart.reduce((total, line) => total + Number(line.quantity), 0);
  document.querySelector('#cart-count').textContent = count;
}

function addToCart(itemId) {
  const item = state.menu.find((entry) => String(entry.id) === String(itemId));
  if (!item) return;
  const line = state.cart.find((entry) => String(entry.item.id) === String(itemId));
  if (line) line.quantity += 1;
  else state.cart.push({ item, quantity: 1 });
  syncCart();
  showToast(`${item.title} added to your bag`);
}

function renderCart() {
  const modal = document.querySelector('#modal-root');
  const total = state.cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);
  const lines = state.cart.map((line, index) => `<div class="cart-line"><div><h3>${escapeHtml(line.item.title)}</h3><p>${money(line.item.price)} each · ${money(Number(line.item.price) * line.quantity)}</p></div><div class="quantity-control"><button data-action="quantity" data-index="${index}" data-change="-1" aria-label="Remove one">−</button><span>${line.quantity}</span><button data-action="quantity" data-index="${index}" data-change="1" aria-label="Add one">+</button></div></div>`).join('');
  modal.innerHTML = `<div class="cart-overlay" data-action="overlay-close"><section class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="drawer-head"><div><p class="eyebrow">THE GOOD STUFF</p><h2 id="cart-title">Your bag <span class="brand-muted">(${state.cart.length})</span></h2></div><button class="close-button" data-action="close-cart" aria-label="Close bag">×</button></div>${state.cart.length ? `<div class="cart-lines">${lines}</div><div class="drawer-footer"><p id="cart-error" class="drawer-message"></p><p class="order-review-note">Available orders are approved automatically. Unavailable requests go to admin review.</p><div class="total-row"><span>Order total</span><strong>${money(total)}</strong></div><button class="button button-dark" data-action="checkout">Place order</button></div>` : '<div class="cart-empty">Your bag is taking a little breather.<br>Add something lovely from the menu.</div>'}</section></div>`;
}

function closeCart() {
  document.querySelector('#modal-root').innerHTML = '';
}

async function placeOrder(button) {
  button.disabled = true;
  button.innerHTML = 'Placing order…';
  const error = document.querySelector('#cart-error');
  error.textContent = '';
  try {
    // The API rechecks authoritative prices and stock inside its transaction.
    const result = await api('/order', {
      method: 'POST',
      body: JSON.stringify({
        items: state.cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
      }),
    });
    state.cart = [];
    syncCart();
    closeCart();
    showToast(result.status === 'approved'
      ? `Order #${result.orderId} approved automatically`
      : `Order #${result.orderId} sent for admin review`);
    if (state.page === 'menu') renderPage();
    if (state.page === 'orders') renderPage();
  } catch (requestError) {
    error.textContent = requestError.message;
    button.disabled = false;
    button.textContent = 'Place order';
  }
}

async function changeStock(itemId) {
  const item = [...state.inventory, ...state.myDishes].find((entry) => String(entry.id) === String(itemId));
  if (!item) return;
  const value = window.prompt(`Set available quantity for ${item.title}:`, item.stock_quantity);
  if (value === null) return;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    showToast('Enter a whole number of 0 or more');
    return;
  }
  try {
    await api(`/inventory/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      body: JSON.stringify({ stock_quantity: quantity }),
    });
    item.stock_quantity = quantity;
    if (state.page === 'my-dishes') await renderPage();
    else renderInventory();
    showToast('Stock updated');
  } catch (error) {
    showToast(error.message);
  }
}

async function updateOrderStatus(orderId, status, button) {
  button.disabled = true;
  button.textContent = status === 'approved' ? 'Approving...' : status === 'rejected' ? 'Rejecting...' : 'Updating...';
  try {
    await api(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Order #${orderId} ${status}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.textContent = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Mark complete';
  }
}

async function updateOrderItemStatus(lineId, status, button) {
  button.disabled = true;
  button.textContent = status === 'approved' ? 'Approving...' : status === 'rejected' ? 'Rejecting...' : 'Updating...';
  try {
    // Seller ownership is enforced by the API from the session, not this page state.
    await api(`/seller/order-items/${encodeURIComponent(lineId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Dish order ${status}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.textContent = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Mark complete';
  }
}

async function readImageFile(file) {
  if (!file) return '';
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Please choose an image smaller than 5MB.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image. Please try another photo.'));
    reader.readAsDataURL(file);
  });
}

function previewRecipeImage(file) {
  const preview = document.querySelector('#recipe-image-preview');
  if (!preview || !file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${String(reader.result || '')}" alt="Dish preview" />`;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function submitRecipe(event) {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  const ingredients = String(values.get('ingredients') || '')
    .split(/[\n,]/).map((ingredient) => ingredient.trim()).filter(Boolean);
  const message = document.querySelector('#recipe-message');
  if (ingredients.length === 0) {
    message.textContent = 'Add at least one ingredient.';
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  const imageFile = values.get('dish_image');
  submit.disabled = true;
  message.textContent = '';
  try {
    const imageUrl = await readImageFile(imageFile && imageFile instanceof File ? imageFile : null);
    // Only staff/admin navigation sets this flag; customer submissions always use the community endpoint.
    const isBusinessDish = state.recipeSource === 'business';
    await api(isBusinessDish ? '/staff/menu' : '/recipes', {
      method: 'POST',
      body: JSON.stringify({
        title: String(values.get('title') || '').trim(),
        category: String(values.get('category') || '').trim(),
        description: String(values.get('description') || '').trim(),
        preparation_steps: String(values.get('preparation_steps') || '').trim(),
        price: Number(values.get('price')),
        stock_quantity: Number(values.get('stock_quantity')),
        ingredients,
        image_url: imageUrl,
      }),
    });
    showToast(isBusinessDish ? 'House dish added to the Hub menu' : 'Your dish is now on the community menu');
    setPage(isBusinessDish ? 'inventory' : 'my-dishes');
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#auth-message');
  const submit = document.querySelector('#auth-submit');
  const values = new FormData(form);
  const payload = {
    name: String(values.get('name') || '').trim(),
    email: String(values.get('email') || '').trim(),
    password: String(values.get('password') || ''),
  };
  if (state.registering && !payload.name) {
    message.textContent = 'Please enter your name.';
    return;
  }
  message.textContent = '';
  submit.disabled = true;
  submit.textContent = state.registering ? 'Creating account…' : 'Signing in…';
  try {
    if (state.registering) {
      await api('/register', { method: 'POST', body: JSON.stringify(payload) });
      state.registering = false;
      updateAuthForm();
      form.reset();
      message.textContent = 'Account created. Sign in to get started.';
    } else {
      const { token, ...user } = await api('/login', { method: 'POST', body: JSON.stringify({ email: payload.email, password: payload.password }) });
      if (state.authMode === 'staff' && !['admin', 'staff'].includes(user.role)) {
        throw new Error('This account does not have staff or admin access. Choose Customer sign-in.');
      }
      state.user = user;
      writeStorage('yummy-token', token);
      writeStorage('yummy-user', state.user);
      state.cart = readStorage(`yummy-cart-${state.user.id}`) || [];
      syncCart();
      showApp();
    }
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = state.registering ? 'Create account' : 'Sign in';
  }
}

document.querySelector('#auth-form').addEventListener('submit', submitAuth);
document.querySelector('#auth-switch').addEventListener('click', () => {
  state.registering = !state.registering;
  updateAuthForm();
});
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => {
  state.authMode = button.dataset.authMode;
  state.registering = false;
  updateAuthForm();
}));
document.querySelector('#logout-button').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch {}
  if (state.user) writeStorage(`yummy-cart-${state.user.id}`, state.cart);
  state.user = null;
  state.cart = [];
  writeStorage('yummy-user', null);
  writeStorage('yummy-token', null);
  syncCart();
  closeCart();
  showAuth();
});
document.querySelector('#cart-open').addEventListener('click', renderCart);
document.querySelector('#back-button').addEventListener('click', goBack);
// Page content is replaced on navigation, so screen actions use stable delegated listeners.
document.querySelector('#page-content').addEventListener('change', (event) => {
  if (event.target && event.target.name === 'dish_image' && event.target.files && event.target.files[0]) {
    previewRecipeImage(event.target.files[0]);
  }
});
document.querySelector('#page-content').addEventListener('input', (event) => {
  if (event.target.id === 'menu-search') {
    state.search = event.target.value;
    const cursor = event.target.selectionStart;
    renderMenu();
    const input = document.querySelector('#menu-search');
    input.focus();
    input.setSelectionRange(cursor, cursor);
  }
});
document.querySelector('#page-content').addEventListener('submit', (event) => {
  if (event.target.id === 'recipe-form') submitRecipe(event);
});
document.querySelector('#page-content').addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'add') addToCart(id);
  if (action === 'category') { state.category = target.dataset.category; renderMenu(); }
  if (action === 'source') { state.menuSource = target.dataset.source; renderMenu(); }
  if (action === 'edit-stock') changeStock(id);
  if (action === 'approve-order') updateOrderStatus(id, 'approved', target);
  if (action === 'reject-order') updateOrderStatus(id, 'rejected', target);
  if (action === 'complete-order') updateOrderStatus(id, 'completed', target);
  if (action === 'update-order-item') updateOrderItemStatus(id, target.dataset.status, target);
  if (action === 'go-create-recipe') { state.recipeSource = 'community'; setPage('create-recipe'); }
  if (action === 'open-order-queue') setPage('staff-orders');
  if (action === 'refresh-inventory') renderPage();
  if (action === 'refresh-dashboard' || action === 'refresh-my-dishes' || action === 'refresh-my-sales') renderPage();
  if (action === 'refresh-orders' || action === 'refresh-staff-orders') renderPage();
  if (action === 'retry-menu' || action === 'retry-orders' || action === 'retry-inventory') renderPage();
});
document.querySelector('#modal-root').addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'close-cart' || (target.dataset.action === 'overlay-close' && event.target === target)) closeCart();
  if (target.dataset.action === 'quantity') {
    const index = Number(target.dataset.index);
    state.cart[index].quantity += Number(target.dataset.change);
    if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
    syncCart();
    renderCart();
  }
  if (target.dataset.action === 'checkout') placeOrder(target);
});
document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.page === 'create-recipe') state.recipeSource = button.dataset.source || 'community';
  setPage(button.dataset.page);
}));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCart(); });

// A cached profile alone is not a login; restore the app only with its server token.
if (state.user && state.user.id && readStorage('yummy-token')) {
  state.cart = readStorage(`yummy-cart-${state.user.id}`) || [];
  syncCart();
  showApp();
} else {
  showAuth();
}
