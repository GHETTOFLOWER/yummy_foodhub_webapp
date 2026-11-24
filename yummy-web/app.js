const state = {
  user: readStorage('yummy-user'),
  cart: [],
  menu: [],
  inventory: [],
  orders: [],
  staffOrders: [],
  deliveryOrders: [],
  riders: [],
  availableDeliveries: [],
  riderDeliveries: [],
  dashboard: null,
  page: 'menu',
  pageHistory: [],
  category: 'All',
  search: '',
  orderTrackingError: '',
  availableDeliveriesError: '',
  liveRefreshInFlight: false,
  registering: false,
  authMode: 'customer',
  checkout: { deliveryType: 'pickup', address: '', phone: '' },
};

const defaultMenuTitles = [
  'Boiled Cassava & Beef-Pea Stew',
  'Flaky Ugandan Chapati',
  'Kalo, Cassava & Beef Stew',
  'Chicken Luwombo with Matooke & Sweet Potato',
  'Beef Luwombo with Matooke, Lumonde & Pumpkin',
  'Matooke Katogo with Beef & Butula',
  'Matooke Katogo with Tilapia Fish',
  'Matooke, Mayuni & Byenda',
  'Matooke, Rice & Byenda',
  'Matooke, Mayuni & Fish Stew',
  'Posho & Tilapia Fish Stew with Greens',
  'Posho, Beans & Okra Stew with Doodo',
  'Steamed Rice, Fish Stew & Fresh Fruit Juice',
  'Whole Fried Tilapia and Chips',
];

const menuCategories = [
  'Main Courses',
  'Local Favorites',
  'Breakfast',
  'Beverages',
  'Special Meals',
  'Side Dishes',
];

const imageChoices = [
  './images/Boiled Cassava & Beef-Pea Stew.jpeg',
  './images/Chapati.jpeg',
  './images/Kalo,Cassava&Beaf Stew.jpeg',
  './images/Luwombo Lwenkoko with Matooke and Sweet Potatoes.jpeg',
  './images/luwombo lwenyama with Matooke,Lumonde & Pumpkin.jpeg',
  './images/Matooke Katogo with Beef and Butula.jpeg',
  './images/Matooke Katogo with Tilapia fish.jpeg',
  './images/Matooke,Mayuni & Byenda.jpeg',
  './images/Matooke,Rice&Byenda.jpeg',
  './images/MatookeMayuuni and Fish Stew.jpeg',
  './images/Posho& Tilapia Fish Stew with Greens.jpeg',
  './images/Posho,Beans & Okra Stew with Doodo.jpeg',
  './images/Steamed Ric,Fish Stew & Fresh Fruit Juice.jpeg',
  './images/Whole Fried Tilapia and Chips.jpeg',
];

function getDefaultMenu(menuItems) {
  const allowedTitles = new Set(defaultMenuTitles);
  const itemsByTitle = new Map();
  for (const item of menuItems) {
    if (allowedTitles.has(item.title) && !itemsByTitle.has(item.title)) {
      itemsByTitle.set(item.title, item);
    }
  }
  const menu = defaultMenuTitles
    .map((title, index) => {
      const item = itemsByTitle.get(title);
      return item ? { ...item, image_url: imageChoices[index] } : null;
    })
    .filter(Boolean);
  if (menu.length !== defaultMenuTitles.length) {
    throw new Error(`The food menu is incomplete (${menu.length}/${defaultMenuTitles.length} items).`);
  }
  return menu;
}

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );
}

function money(value) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

const API_BASE = 'https://yummy-foodhub-webapp.onrender.com';

async function api(path, options = {}) {
  const token = readStorage('yummy-token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed. Please try again.');
  return data;
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
  title.textContent = state.registering ? 'Create Account' : staffMode ? 'Staff Sign In' : 'Sign In';
  eyebrow.textContent = state.registering ? 'CUSTOMER REGISTRATION' : staffMode ? 'STAFF, ADMINISTRATOR & RIDER ACCESS' : 'CUSTOMER ACCOUNT';
  intro.textContent = state.registering
    ? 'Create a customer account to place orders and view order history.'
    : staffMode
      ? 'Sign in with your staff, administrator, or rider account.'
      : 'Sign in to place orders and view order history.';
  submit.textContent = state.registering ? 'Create account' : 'Sign in';
  switchCopy.textContent = state.registering ? 'Already registered?' : 'New customer?';
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
  const isRider = state.user.role === 'rider';
  document.querySelector('#customer-nav').classList.toggle('hidden', isAdmin || isStaff || isRider);
  document.querySelector('#staff-nav').classList.toggle('hidden', !isStaff);
  document.querySelector('#admin-nav').classList.toggle('hidden', !isAdmin);
  document.querySelector('#rider-nav').classList.toggle('hidden', !isRider);
  document.querySelector('#cart-open').classList.toggle('hidden', isAdmin || isStaff || isRider);
  document.querySelector('#user-name').textContent = state.user.name;
  document.querySelector('#user-role').textContent =
    { admin: 'Administrator', staff: 'Staff', rider: 'Rider', customer: 'Customer' }[state.user.role] || 'Customer';
  document.querySelector('#user-avatar').textContent = (state.user.name || 'H').trim().charAt(0).toUpperCase();
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
  state.page = isAdmin || isStaff ? 'dashboard' : isRider ? 'available-deliveries' : 'menu';
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

async function renderPage() {
  const content = document.querySelector('#page-content');
  const crumb = document.querySelector('#page-crumb');
  const pages = {
    menu: 'Menu',
    orders: 'Orders',
    inventory: 'Inventory',
    'staff-orders': 'Orders',
    dashboard: 'Dashboard',
    'admin-deliveries': 'Deliveries',
    'available-deliveries': 'Available Deliveries',
    'rider-dashboard': 'My Deliveries',
  };
  crumb.textContent = pages[state.page] || 'Menu';
  if (state.page === 'menu') {
    content.innerHTML = '<div class="empty-state">Loading food menu...</div>';
    try {
      state.menu = getDefaultMenu(await api('/menu'));
      renderMenu();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">Unable to load the food menu. ${escapeHtml(error.message)} <button data-action="retry-menu">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'dashboard') {
    content.innerHTML = '<div class="empty-state">Loading restaurant dashboard...</div>';
    try {
      state.dashboard = await api('/admin/dashboard');
      renderAdminDashboard();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-dashboard">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'orders') {
    content.innerHTML = '<div class="empty-state">Loading order history...</div>';
    try {
      state.orders = await api(`/orders/${encodeURIComponent(state.user.id)}`);
      state.orderTrackingError = '';
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
  if (state.page === 'admin-deliveries') {
    content.innerHTML = '<div class="empty-state">Loading delivery operations...</div>';
    try {
      [state.deliveryOrders, state.riders] = await Promise.all([api('/admin/deliveries'), api('/admin/riders')]);
      renderAdminDeliveries();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-deliveries">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'rider-dashboard') {
    content.innerHTML = '<div class="empty-state">Loading assigned deliveries...</div>';
    try {
      state.riderDeliveries = await api('/rider/deliveries');
      renderRiderDashboard();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-rider-deliveries">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'available-deliveries') {
    content.innerHTML = '<div class="empty-state">Loading available deliveries...</div>';
    try {
      state.availableDeliveries = await api('/rider/available-deliveries');
      state.availableDeliveriesError = '';
      renderAvailableDeliveries();
    } catch (error) {
      state.availableDeliveriesError = error.message;
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-available-deliveries">Try again</button></div>`;
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
  const categories = ['All', ...menuCategories];
  if (!categories.includes(state.category)) state.category = 'All';
  const filtered = state.menu.filter((item) => {
    const matchesCategory = state.category === 'All' || item.category === state.category;
    const query = state.search.trim().toLowerCase();
    const searchable = [
      item.title,
      item.category,
      item.description,
    ]
      .join(' ')
      .toLowerCase();
    return matchesCategory && (!query || searchable.includes(query));
  });
  const cards = filtered
    .map((item, index) => {
      const outOfStock = Number(item.stock_quantity) <= 0;
      const imageUrl = item.image_url || imageChoices[index % imageChoices.length];
      const safeImageUrl = String(imageUrl).replace(/['"]/g, '\\$&');
      const recipe = Array.isArray(item.recipe_steps) && item.recipe_steps.length
        ? `<details class="recipe-details"><summary>Recipe &amp; Preparation</summary><ol>${item.recipe_steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></details>`
        : '';
      return `<article class="food-card">
      <div class="food-photo" style="background-image:url('${safeImageUrl}')"><span class="food-tag">${escapeHtml(item.category || 'Menu Item')}</span></div>
      <div class="food-body"><div class="food-title-row"><h3 class="food-title">${escapeHtml(item.title)}</h3><span class="food-price">${money(item.price)}</span></div>
      <p class="food-description">${escapeHtml(item.description || 'Description unavailable.')}</p>
      ${recipe}
      <div class="food-footer"><span class="stock-label ${outOfStock ? 'out' : ''}">${outOfStock ? 'Out of stock' : `In stock · ${Number(item.stock_quantity)} available`}</span>
      <button class="add-button" data-action="add" data-id="${escapeHtml(item.id)}"><span aria-hidden="true">+</span> ${outOfStock ? 'Request order' : 'Add to Cart'}</button></div></div>
    </article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">HIGHER LEVEL RESTAURANT & TAKEAWAY UGANDA</p><h1>Menu</h1><p>Browse the current restaurant menu.</p></div></div>
    <div class="menu-tools"><div class="menu-filters"><div class="category-list">${categories.map((category) => `<button class="category-button ${category === state.category ? 'active' : ''}" data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}</div></div>
    <label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input id="menu-search" type="search" value="${escapeHtml(state.search)}" placeholder="Search the menu" aria-label="Search menu"></label></div>
    <div class="section-title"><h2>${state.category === 'All' ? 'All Menu Items' : escapeHtml(state.category)}</h2><span>${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}</span></div>
    ${filtered.length ? `<div class="menu-grid">${cards}</div>` : `<div class="empty-state">${state.search ? 'No menu items match your search.' : `No items are currently listed under ${escapeHtml(state.category)}.`}</div>`}`;
}

function renderOrders() {
  const content = document.querySelector('#page-content');
  const orders = state.orders;
  const rows = orders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => {
          const status = String(item.item_status || order.status || 'pending').toLowerCase();
          return `<div class="order-line"><span>${item.quantity} × ${escapeHtml(item.title)}</span><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></div>`;
        })
        .join('');
      const date = order.created_at
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(order.created_at))
        : 'Date unavailable';
      const status = String(order.status || 'pending').toLowerCase();
      const delivery = order.delivery || {};
      const history = (order.status_history || [])
        .map((entry) => `<li><span>${escapeHtml(statusLabel(entry.status))}</span><time>${escapeHtml(formatDateTime(entry.changed_at))}</time></li>`)
        .join('');
      const detail = order.delivery_type === 'delivery'
        ? `<p><strong>Address:</strong> ${escapeHtml(order.delivery_address || 'Not provided')}</p><p><strong>Rider:</strong> ${escapeHtml(delivery.rider_name || 'Awaiting rider acceptance')}</p>`
        : '<p><strong>Takeaway Order:</strong> Collect your order when it is ready.</p>';
      return `<article class="tracked-order"><div class="tracked-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)}</div><div class="order-date">${escapeHtml(date)} · ${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</div></div><div class="tracked-order-total"><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div></div><div class="order-items">${items || 'Order details unavailable'}</div><section class="delivery-progress" aria-label="Order progress">${renderOrderProgress(order)}</section><div class="order-delivery-details">${detail}<p><strong>Contact:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p></div>${history ? `<details class="order-history"><summary>Order and delivery history</summary><ol>${history}</ol></details>` : ''}</article>`;
    })
    .join('');
  const liveStatus = state.orderTrackingError
    ? `<p class="tracking-refresh-status error-text" role="status">Delivery tracking refresh failed: ${escapeHtml(state.orderTrackingError)}</p>`
    : '<p class="tracking-refresh-status" role="status">Delivery tracking updates automatically every 10 seconds.</p>';
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">ORDER HISTORY</p><h1>Orders</h1><p>Review your orders and delivery tracking.</p>${liveStatus}</div><button class="table-action" data-action="refresh-orders">↻ Refresh</button></div>${orders.length ? `<div class="tracked-order-list">${rows}</div>` : '<div class="empty-state">No orders have been placed. Browse the menu to place an order.</div>'}`;
}

function statusLabel(status) {
  const labels = {
    ready_for_delivery: 'Ready For Delivery',
    out_for_delivery: 'Out For Delivery',
    picked_up: 'Picked Up',
    assigned: 'Accepted By Rider',
    pickup: 'Takeaway',
    delivery: 'Delivery',
    partially_approved: 'Partially Approved',
    partially_completed: 'Partially Completed',
  };
  return labels[status] || String(status || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  return value
    ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Date unavailable';
}

function renderOrderProgress(order) {
  const pickupStages = ['pending', 'approved', 'preparing', 'ready_for_delivery', 'picked_up'];
  const deliveryStages = ['pending', 'approved', 'preparing', 'ready_for_delivery', 'assigned', 'picked_up', 'out_for_delivery', 'delivered'];
  const stages = order.delivery_type === 'delivery' ? deliveryStages : pickupStages;
  const isPreDeliveryCompletion = order.status === 'completed' && order.delivery_type === 'delivery' && !order.delivery;
  const currentStatus = ['partially_approved', 'partially_completed'].includes(order.status) || isPreDeliveryCompletion
    ? 'approved'
    : order.status;
  const currentIndex = stages.indexOf(currentStatus);
  if (currentStatus === 'cancelled' || currentIndex < 0) {
    const message = {
      cancelled: 'This order was cancelled.',
      rejected: 'This order was not approved.',
      completed: 'This order is complete.',
    }[currentStatus] || 'Staff are reviewing your order.';
    return `<p class="progress-current"><span class="status-pill ${escapeHtml(currentStatus)}">${escapeHtml(statusLabel(currentStatus))}</span>${message}</p>`;
  }
  return `<ol class="progress-steps">${stages.map((stage, index) => `<li class="${index < currentIndex ? 'complete' : index === currentIndex ? 'current' : ''}"><span class="progress-dot">${index < currentIndex ? '✓' : index + 1}</span><span>${escapeHtml(statusLabel(stage))}</span></li>`).join('')}</ol>`;
}

function renderOrderStageActions(order) {
  const actions = {
    pending: [['approved', 'Approve order'], ['cancelled', 'Cancel']],
    approved: [['preparing', 'Start preparing'], ['cancelled', 'Cancel']],
    partially_approved: [['preparing', 'Start preparing'], ['cancelled', 'Cancel']],
    partially_completed: [['preparing', 'Start preparing'], ['cancelled', 'Cancel']],
    preparing: [['ready_for_delivery', 'Mark ready'], ['cancelled', 'Cancel']],
  };
  let choices = actions[order.status] || [];
  if (order.status === 'completed' && order.delivery_type === 'delivery') {
    choices = [['preparing', 'Start preparing'], ['cancelled', 'Cancel']];
  }
  if (order.status === 'ready_for_delivery' && order.delivery_type === 'pickup') {
    choices = [['picked_up', 'Mark picked up']];
  }
  return choices.map(([status, title]) =>
    `<button class="table-action ${status === 'cancelled' ? 'reject-button' : 'approve-button'}" data-action="update-order-status" data-status="${status}" data-id="${escapeHtml(order.id)}">${title}</button>`,
  ).join('');
}

function renderStaffOrders() {
  const pendingCount = state.staffOrders.reduce(
    (count, order) => count + (order.items || []).filter((item) => item.item_status === 'pending').length,
    0,
  );
  const rows = state.staffOrders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => {
          const status = String(item.item_status || order.status || 'pending').toLowerCase();
          const lineTotal = Number(item.price) * Number(item.quantity);
          const actions =
            status === 'pending'
              ? `<button class="table-action approve-button" data-action="update-order-item" data-status="approved" data-id="${escapeHtml(item.order_item_id)}">Approve</button><button class="table-action reject-button" data-action="update-order-item" data-status="rejected" data-id="${escapeHtml(item.order_item_id)}">Reject</button>`
              : status === 'approved'
                ? `<button class="table-action" data-action="update-order-item" data-status="completed" data-id="${escapeHtml(item.order_item_id)}">Mark complete</button>`
                : '';
          return `<div class="admin-order-line"><div class="admin-order-line-title"><strong>${item.quantity} × ${escapeHtml(item.title)}</strong></div><div class="admin-order-line-money"><span>Line total ${money(lineTotal)}</span></div><div class="admin-order-line-actions"><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>${actions}</div></div>`;
        })
        .join('');
      const date = order.created_at
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(order.created_at),
          )
        : 'Date unavailable';
      const status = String(order.status || 'pending').toLowerCase();
      return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.customer_email)} · ${escapeHtml(date)}</div></div><div><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div></div><div class="order-delivery-details"><p><strong>${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</strong>${order.delivery_type === 'delivery' ? ` · ${escapeHtml(order.delivery_address || 'Address missing')} · ${escapeHtml(order.contact_phone || 'Phone missing')}` : ''}</p><p><strong>Rider:</strong> ${escapeHtml(order.delivery?.rider_name || 'Not assigned')}</p></div><div class="admin-order-lines">${items || '<div class="empty-state">No order lines</div>'}</div><div class="order-management-actions">${renderOrderStageActions(order)}</div></article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">ORDER MANAGEMENT</p><h1>Customer Orders</h1><p>${pendingCount} order ${pendingCount === 1 ? 'item is' : 'items are'} awaiting staff review.</p></div><button class="table-action" data-action="refresh-staff-orders">↻ Refresh</button></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No customer orders have been placed.</div>'}`;
}

function renderAdminDeliveries() {
  const availableRiders = state.riders;
  const riderCards = state.riders.map((rider) =>
    `<article class="rider-card"><strong>${escapeHtml(rider.rider_name)}</strong><span>${escapeHtml(rider.rider_email)}</span><span>${escapeHtml(rider.rider_phone || 'No phone')}</span><span class="status-pill ${rider.status === 'available' ? 'approved' : 'preparing'}">${escapeHtml(statusLabel(rider.status))}</span></article>`,
  ).join('');
  const rows = state.deliveryOrders.map((order) => {
    const delivery = order.delivery || {};
    const items = (order.items || []).map((item) => `${item.quantity} × ${escapeHtml(item.title)}`).join(', ');
    const nextDeliveryStatus = {
      assigned: 'picked_up',
      picked_up: 'out_for_delivery',
      out_for_delivery: 'delivered',
    }[delivery.delivery_status];
    const stageLabel = {
      picked_up: 'Mark picked up',
      out_for_delivery: 'Mark out for delivery',
      delivered: 'Mark delivered',
    }[nextDeliveryStatus];
    const stageAction = nextDeliveryStatus
      ? `<button class="table-action approve-button" data-action="update-admin-delivery" data-status="${nextDeliveryStatus}" data-id="${escapeHtml(delivery.id)}">${stageLabel}</button>`
      : '';
    const timeline = (order.status_history || []).map((entry) => `<li><span>${escapeHtml(statusLabel(entry.status))}</span><time>${escapeHtml(formatDateTime(entry.changed_at))}</time></li>`).join('');
    return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.customer_email)} · ${escapeHtml(formatDateTime(order.created_at))}</div></div><div><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span></div></div><div class="order-delivery-details"><p><strong>Address:</strong> ${escapeHtml(order.delivery_address || 'Not provided')} · <strong>Phone:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p><p><strong>Rider:</strong> ${escapeHtml(delivery.rider_name || (order.status === 'ready_for_delivery' ? 'Awaiting rider acceptance' : 'Not assigned'))} ${delivery.rider_phone ? `· ${escapeHtml(delivery.rider_phone)}` : ''} ${delivery.rider_availability ? `· ${escapeHtml(statusLabel(delivery.rider_availability))}` : ''}</p><p><strong>ETA:</strong> ${escapeHtml(delivery.estimated_arrival ? formatDateTime(delivery.estimated_arrival) : 'Not available')}</p><p><strong>Items:</strong> ${items || 'Order details unavailable'}</p></div><div class="order-management-actions">${stageAction}<button class="table-action" data-action="view-delivery-history" data-id="${escapeHtml(order.id)}">View history</button></div>${timeline ? `<details class="order-history"><summary>Status timeline</summary><ol>${timeline}</ol></details>` : ''}</article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">DELIVERY OPERATIONS</p><h1>Delivery Operations</h1><p>Monitor delivery status and rider availability. Riders accept orders marked ready.</p></div><button class="table-action" data-action="refresh-deliveries">↻ Refresh</button></div><section class="rider-roster"><div class="section-title"><h2>Rider Availability</h2><span>${availableRiders.filter((rider) => rider.status === 'available').length} available · ${availableRiders.filter((rider) => rider.status === 'busy').length} busy</span></div>${riderCards ? `<div class="rider-grid">${riderCards}</div>` : '<div class="empty-state">No riders are registered.</div>'}</section><div class="section-title delivery-orders-title"><h2>Delivery Orders</h2><span>${state.deliveryOrders.length} total</span></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No delivery orders have been placed.</div>'}`;
}

function renderAvailableDeliveries() {
  const rows = state.availableDeliveries.map((order) => {
    const items = (order.items || []).map((item) => `${item.quantity} × ${escapeHtml(item.title)}`).join(', ');
    return `<article class="admin-order-card available-delivery-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(formatDateTime(order.created_at))}</div></div><strong class="order-total">${money(order.total_amount)}</strong></div><div class="order-delivery-details"><p><strong>Deliver to:</strong> ${escapeHtml(order.delivery_address || 'Address missing')}</p><p><strong>Customer phone:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p><p><strong>Order value:</strong> ${money(order.total_amount)}</p><p><strong>Items:</strong> ${items || 'Order details unavailable'}</p></div><div class="order-management-actions"><button class="table-action approve-button" data-action="accept-delivery" data-id="${escapeHtml(order.id)}">Accept Delivery</button></div></article>`;
  }).join('');
  const error = state.availableDeliveriesError
    ? `<p class="tracking-refresh-status error-text" role="status">Delivery refresh failed: ${escapeHtml(state.availableDeliveriesError)}</p>`
    : '<p class="tracking-refresh-status" role="status">Available deliveries refresh automatically every 10 seconds.</p>';
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">RIDER OPERATIONS</p><h1>Available Deliveries</h1><p>Review delivery details and accept an available order.</p>${error}</div><button class="table-action" data-action="refresh-available-deliveries">↻ Refresh</button></div>${rows ? `<div class="available-delivery-list">${rows}</div>` : '<div class="empty-state">No deliveries are currently available.</div>'}`;
}

function renderRiderDashboard() {
  const active = state.riderDeliveries.filter((order) => order.status !== 'delivered');
  const rows = state.riderDeliveries.map((order) => {
    const delivery = order.delivery || {};
    const next = { assigned: 'picked_up', picked_up: 'out_for_delivery', out_for_delivery: 'delivered' }[delivery.delivery_status];
    const label = { picked_up: 'Mark picked up', out_for_delivery: 'Mark out for delivery', delivered: 'Mark delivered' }[next];
    const items = (order.items || []).map((item) => `${item.quantity} × ${escapeHtml(item.title)}`).join(', ');
    const action = next ? `<button class="table-action approve-button" data-action="update-rider-status" data-status="${next}" data-id="${escapeHtml(delivery.id)}">${label}</button>` : '';
    return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.contact_phone || '')}</div></div><span class="status-pill ${escapeHtml(delivery.delivery_status || order.status)}">${escapeHtml(statusLabel(delivery.delivery_status || order.status))}</span></div><div class="order-delivery-details"><p><strong>Deliver to:</strong> ${escapeHtml(order.delivery_address || 'Address missing')}</p><p><strong>Items:</strong> ${items}</p><p><strong>Assigned:</strong> ${escapeHtml(formatDateTime(delivery.assigned_at))}</p></div><div class="order-management-actions">${action}</div></article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">RIDER OPERATIONS</p><h1>My Deliveries</h1><p>${active.length} active ${active.length === 1 ? 'delivery is' : 'deliveries are'} assigned to you.</p></div><button class="table-action" data-action="refresh-rider-deliveries">↻ Refresh</button></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No deliveries are assigned to your rider account.</div>'}`;
}

function renderInventory() {
  const rows = state.inventory
    .map((item) => {
      const count = Number(item.stock_quantity) || 0;
      return `<div class="inventory-row"><div class="inventory-name">${escapeHtml(item.title)}<span class="inventory-meta">${escapeHtml(item.description || '')}</span></div><div class="inventory-category">${escapeHtml(item.category || 'Menu item')}</div><div class="inventory-qty"><span class="stock-number ${count <= 5 ? 'low' : ''}">${count}</span><span class="inventory-category">${count <= 5 ? 'Low stock' : 'In stock'}</span></div><button class="table-action" data-action="edit-stock" data-id="${escapeHtml(item.id)}">Adjust stock</button></div>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">INVENTORY MANAGEMENT</p><h1>Inventory Management</h1><p>Review stock levels and update available quantities.</p></div><button class="table-action" data-action="refresh-inventory">↻ Refresh</button></div>
  <div class="content-table"><div class="table-head"><span>Menu item</span><span>Category</span><span>Availability</span><span></span></div>${rows || '<div class="empty-state">No inventory items available.</div>'}</div>`;
}

function renderAdminDashboard() {
  const { summary, recentOrders } = state.dashboard;
  const stats = [
    ['Orders placed', Number(summary.total_orders)],
    ['Pending staff review', Number(summary.pending_orders)],
    ['Home deliveries', Number(summary.delivery_orders)],
    ['Active deliveries', Number(summary.active_deliveries)],
    ['Unassigned', Number(summary.unassigned_deliveries)],
    ['Approved order value', money(summary.total_sales)],
    ['Available menu items', `${Number(summary.available_dishes)} / ${Number(summary.total_dishes)}`],
  ];
  const rows = recentOrders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => `${item.quantity} × ${escapeHtml(item.title)} (${escapeHtml(item.item_status)})`)
        .join(', ');
      return `<article class="dashboard-order-row"><div><strong>Order #${escapeHtml(order.id)}</strong><span>${escapeHtml(order.customer_name)}</span></div><div>${items || 'Order details unavailable'}<small>${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</small></div><strong>${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span></article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">RESTAURANT DASHBOARD</p><h1>Restaurant Dashboard</h1><p>Review order activity, inventory levels, and delivery operations.</p></div><div class="dashboard-actions"><button class="table-action" data-action="open-deliveries">Delivery Operations</button><button class="table-action" data-action="open-order-queue">Customer Orders</button><button class="table-action" data-action="refresh-dashboard">↻ Refresh</button></div></div>
  <div class="dashboard-stats">${stats.map(([label, value]) => `<article class="dashboard-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</div>
  <div class="section-title dashboard-section-title"><h2>Recent orders</h2><span>Newest first</span></div>
  ${rows ? `<div class="dashboard-order-list">${rows}</div>` : '<div class="empty-state">No orders have been placed yet.</div>'}`;
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
  showToast(`${item.title} added to your order`);
}

function renderCart() {
  const modal = document.querySelector('#modal-root');
  const total = state.cart.reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0);
  const lines = state.cart
    .map(
      (line, index) =>
        `<div class="cart-line"><div><h3>${escapeHtml(line.item.title)}</h3><p>${money(line.item.price)} each · ${money(Number(line.item.price) * line.quantity)}</p></div><div class="quantity-control"><button data-action="quantity" data-index="${index}" data-change="-1" aria-label="Remove one">−</button><span>${line.quantity}</span><button data-action="quantity" data-index="${index}" data-change="1" aria-label="Add one">+</button></div></div>`,
    )
    .join('');
  const checkout = state.checkout;
  modal.innerHTML = `<div class="cart-overlay" data-action="overlay-close"><section class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="drawer-head"><div><p class="eyebrow">CART</p><h2 id="cart-title">Cart <span class="brand-muted">(${state.cart.length})</span></h2></div><button class="close-button" data-action="close-cart" aria-label="Close cart">×</button></div>${state.cart.length ? `<div class="cart-lines">${lines}</div><div class="checkout-details"><fieldset><legend>Order Type</legend><label><input type="radio" name="delivery_type" value="pickup" ${checkout.deliveryType === 'pickup' ? 'checked' : ''}> Takeaway</label><label><input type="radio" name="delivery_type" value="delivery" ${checkout.deliveryType === 'delivery' ? 'checked' : ''}> Delivery</label></fieldset>${checkout.deliveryType === 'delivery' ? `<label class="checkout-field">Delivery address<textarea name="delivery_address" maxlength="255" rows="2" placeholder="Street, area, and directions" required>${escapeHtml(checkout.address)}</textarea></label><label class="checkout-field">Contact phone<input name="contact_phone" type="tel" maxlength="20" autocomplete="tel" placeholder="+256 700 000 000" value="${escapeHtml(checkout.phone)}" required></label>` : ''}</div><div class="drawer-footer"><p id="cart-error" class="drawer-message"></p><p class="order-review-note">In-stock items are confirmed automatically. Items requiring staff review remain pending.</p><div class="total-row"><span>Order total</span><strong>${money(total)}</strong></div><button class="button button-dark" data-action="checkout">Place Order</button></div>` : '<div class="cart-empty">Your cart is empty. Add menu items to continue.</div>'}</section></div>`;
}

function closeCart() {
  document.querySelector('#modal-root').innerHTML = '';
}

async function placeOrder(button) {
  button.disabled = true;
  button.innerHTML = 'Placing order…';
  const error = document.querySelector('#cart-error');
  error.textContent = '';
  if (state.checkout.deliveryType === 'delivery' &&
      (!state.checkout.address.trim() || !state.checkout.phone.trim())) {
    error.textContent = 'Enter a delivery address and contact phone number.';
    button.disabled = false;
    button.textContent = 'Place Order';
    return;
  }
  try {
    // The API rechecks authoritative prices and stock inside its transaction.
    const result = await api('/order', {
      method: 'POST',
      body: JSON.stringify({
        items: state.cart.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
        delivery_type: state.checkout.deliveryType,
        delivery_address: state.checkout.address,
        contact_phone: state.checkout.phone,
      }),
    });
    state.cart = [];
    state.checkout = { deliveryType: 'pickup', address: '', phone: '' };
    syncCart();
    closeCart();
    showToast(
      result.status === 'approved'
        ? `Order #${result.orderId} confirmed`
        : `Order #${result.orderId} submitted for staff review`,
    );
    if (state.page === 'menu') renderPage();
    if (state.page === 'orders') renderPage();
  } catch (requestError) {
    error.textContent = requestError.message;
    button.disabled = false;
    button.textContent = 'Place Order';
  }
}

async function updateOrderStage(orderId, status, button) {
  button.disabled = true;
  try {
    await api(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Order updated: ${statusLabel(status)}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
}

async function updateRiderDelivery(deliveryId, status, button) {
  button.disabled = true;
  try {
    await api(`/rider/deliveries/${encodeURIComponent(deliveryId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Delivery updated: ${statusLabel(status)}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
}

async function acceptDelivery(orderId, button) {
  button.disabled = true;
  try {
    await api(`/rider/deliveries/${encodeURIComponent(orderId)}/accept`, { method: 'POST' });
    showToast('Delivery accepted');
    setPage('rider-dashboard');
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
}

async function updateAdminDelivery(deliveryId, status, button) {
  button.disabled = true;
  try {
    await api(`/admin/deliveries/${encodeURIComponent(deliveryId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Delivery updated: ${statusLabel(status)}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
}

async function viewDeliveryHistory(orderId) {
  try {
    const history = await api(`/orders/${encodeURIComponent(orderId)}/delivery-history`);
    const entries = history.map((entry) =>
      `<li><span><strong>${escapeHtml(statusLabel(entry.status))}</strong><small>${escapeHtml(entry.changed_by || 'System')}</small></span><time>${escapeHtml(formatDateTime(entry.changed_at))}</time></li>`,
    ).join('');
    document.querySelector('#modal-root').innerHTML = `<div class="cart-overlay" data-action="overlay-close"><section class="cart-drawer history-drawer" role="dialog" aria-modal="true" aria-labelledby="history-title"><div class="drawer-head"><div><p class="eyebrow">DELIVERY HISTORY</p><h2 id="history-title">Order #${escapeHtml(orderId)}</h2></div><button class="close-button" data-action="close-cart" aria-label="Close history">×</button></div><ol class="history-list">${entries || '<li>No status history available.</li>'}</ol></section></div>`;
  } catch (error) {
    showToast(error.message);
  }
}

async function changeStock(itemId) {
  const item = state.inventory.find((entry) => String(entry.id) === String(itemId));
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
    renderInventory();
    showToast('Inventory quantity updated');
  } catch (error) {
    showToast(error.message);
  }
}

async function updateOrderItemStatus(lineId, status, button) {
  button.disabled = true;
  button.textContent = status === 'approved' ? 'Approving...' : status === 'rejected' ? 'Rejecting...' : 'Updating...';
  try {
    await api(`/staff/order-items/${encodeURIComponent(lineId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    showToast(`Order item ${status}`);
    await renderPage();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
    button.textContent = status === 'approved' ? 'Approve' : status === 'rejected' ? 'Reject' : 'Mark complete';
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
      const { token, ...user } = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email: payload.email, password: payload.password }),
      });
      if (state.authMode === 'staff' && !['admin', 'staff', 'rider'].includes(user.role)) {
        throw new Error('This account does not have staff, administrator, or rider access. Select Customer sign-in.');
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
document.querySelectorAll('[data-auth-mode]').forEach((button) =>
  button.addEventListener('click', () => {
    state.authMode = button.dataset.authMode;
    state.registering = false;
    updateAuthForm();
  }),
);
document.querySelector('#logout-button').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
  } catch {}
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
document.querySelector('#page-content').addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id } = target.dataset;
  if (action === 'add') addToCart(id);
  if (action === 'category') {
    state.category = target.dataset.category;
    renderMenu();
  }
  if (action === 'edit-stock') changeStock(id);
  if (action === 'update-order-item') updateOrderItemStatus(id, target.dataset.status, target);
  if (action === 'update-order-status') updateOrderStage(id, target.dataset.status, target);
  if (action === 'accept-delivery') acceptDelivery(id, target);
  if (action === 'update-rider-status') updateRiderDelivery(id, target.dataset.status, target);
  if (action === 'update-admin-delivery') updateAdminDelivery(id, target.dataset.status, target);
  if (action === 'view-delivery-history') viewDeliveryHistory(id);
  if (action === 'open-order-queue') setPage('staff-orders');
  if (action === 'open-deliveries') setPage('admin-deliveries');
  if (action === 'refresh-inventory') renderPage();
  if (action === 'refresh-dashboard') renderPage();
  if (action === 'refresh-orders' || action === 'refresh-staff-orders') renderPage();
  if (action === 'refresh-deliveries' || action === 'refresh-rider-deliveries') renderPage();
  if (action === 'refresh-available-deliveries') renderPage();
  if (action === 'retry-menu' || action === 'retry-orders' || action === 'retry-inventory') renderPage();
});
document.querySelector('#modal-root').addEventListener('input', (event) => {
  if (event.target.name === 'delivery_address') state.checkout.address = event.target.value;
  if (event.target.name === 'contact_phone') state.checkout.phone = event.target.value;
});
document.querySelector('#modal-root').addEventListener('change', (event) => {
  if (event.target.name === 'delivery_type') {
    const drawer = event.target.closest('.cart-drawer');
    state.checkout.address = drawer.querySelector('[name="delivery_address"]')?.value || state.checkout.address;
    state.checkout.phone = drawer.querySelector('[name="contact_phone"]')?.value || state.checkout.phone;
    state.checkout.deliveryType = event.target.value;
    renderCart();
  }
});
document.querySelector('#modal-root').addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'close-cart' || (target.dataset.action === 'overlay-close' && event.target === target))
    closeCart();
  if (target.dataset.action === 'quantity') {
    const index = Number(target.dataset.index);
    state.cart[index].quantity += Number(target.dataset.change);
    if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
    syncCart();
    renderCart();
  }
  if (target.dataset.action === 'checkout') placeOrder(target);
});
document.querySelectorAll('.nav-link').forEach((button) =>
  button.addEventListener('click', () => {
    setPage(button.dataset.page);
  }),
);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCart();
});

async function refreshLivePageData() {
  if (state.liveRefreshInFlight) return;
  const page = state.page;
  if (page !== 'orders' && page !== 'available-deliveries') return;
  if (!state.user || (page === 'available-deliveries' && state.user.role !== 'rider')) return;
  state.liveRefreshInFlight = true;
  try {
    if (page === 'orders') {
      state.orders = await api(`/orders/${encodeURIComponent(state.user.id)}`);
      state.orderTrackingError = '';
      if (state.page === page) renderOrders();
    } else {
      state.availableDeliveries = await api('/rider/available-deliveries');
      state.availableDeliveriesError = '';
      if (state.page === page) renderAvailableDeliveries();
    }
  } catch (error) {
    console.error('LIVE DELIVERY REFRESH ERROR:', error.message);
    if (page === 'orders') {
      state.orderTrackingError = error.message;
      if (state.page === page) renderOrders();
    } else {
      state.availableDeliveriesError = error.message;
      if (state.page === page) renderAvailableDeliveries();
    }
  } finally {
    state.liveRefreshInFlight = false;
  }
}

window.setInterval(refreshLivePageData, 10000);

if (state.user && state.user.id && readStorage('yummy-token')) {
  state.cart = readStorage(`yummy-cart-${state.user.id}`) || [];
  syncCart();
  showApp();
} else {
  showAuth();
}
