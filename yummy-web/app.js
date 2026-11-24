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
  myDishes: [],
  dashboard: null,
  sellerDashboard: null,
  sellerOrders: [],
  page: 'menu',
  pageHistory: [],
  category: 'All',
  search: '',
  orderTrackingError: '',
  availableDeliveriesError: '',
  liveRefreshInFlight: false,
  registering: false,
  authMode: 'customer',
  recipeSource: 'community',
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
    const source = item.listing_type || (item.seller_user_id ? 'community' : 'business');
    if (source === 'business' && allowedTitles.has(item.title) && !itemsByTitle.has(item.title)) {
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
    throw new Error(`The Ugandan menu is incomplete (${menu.length}/${defaultMenuTitles.length} dishes).`);
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
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
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
  title.textContent = state.registering ? 'Make yourself at home.' : staffMode ? 'Welcome, team.' : 'Come on in.';
  eyebrow.textContent = state.registering ? 'A SEAT IS WAITING' : staffMode ? 'STAFF, ADMIN & RIDER ACCESS' : 'WELCOME BACK';
  intro.textContent = state.registering
    ? 'Create an account and find your new favorite.'
    : staffMode
      ? 'Sign in with your staff, admin, or rider account.'
      : 'Sign in to pick up where your appetite left off.';
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
  const isRider = state.user.role === 'rider';
  document.querySelector('#customer-nav').classList.toggle('hidden', isAdmin || isStaff || isRider);
  document.querySelector('#staff-nav').classList.toggle('hidden', !isStaff);
  document.querySelector('#admin-nav').classList.toggle('hidden', !isAdmin);
  document.querySelector('#rider-nav').classList.toggle('hidden', !isRider);
  document.querySelector('#user-name').textContent = state.user.name;
  document.querySelector('#user-role').textContent = state.user.role;
  document.querySelector('#user-avatar').textContent = (state.user.name || 'Y').trim().charAt(0).toUpperCase();
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
  state.page = isAdmin ? 'dashboard' : isStaff ? 'inventory' : isRider ? 'available-deliveries' : 'menu';
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
    menu: 'Discover',
    orders: 'My orders',
    inventory: 'Inventory',
    'staff-orders': 'Orders',
    dashboard: 'Dashboard',
    'my-dishes': 'My food',
    'my-sales': 'My sales',
    'create-recipe': 'Create dish',
    'admin-deliveries': 'Deliveries',
    'available-deliveries': 'Available Deliveries',
    'rider-dashboard': 'My deliveries',
  };
  crumb.textContent = pages[state.page] || 'Discover';
  if (state.page === 'menu') {
    content.innerHTML = '<div class="empty-state">Loading today\'s menu...</div>';
    try {
      state.menu = getDefaultMenu(await api('/menu'));
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
    content.innerHTML = '<div class="empty-state">Loading deliveries and rider availability...</div>';
    try {
      [state.deliveryOrders, state.riders] = await Promise.all([api('/admin/deliveries'), api('/admin/riders')]);
      renderAdminDeliveries();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-deliveries">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'rider-dashboard') {
    content.innerHTML = '<div class="empty-state">Loading your assigned deliveries...</div>';
    try {
      state.riderDeliveries = await api('/rider/deliveries');
      renderRiderDashboard();
    } catch (error) {
      content.innerHTML = `<div class="error-panel">${escapeHtml(error.message)} <button data-action="refresh-rider-deliveries">Try again</button></div>`;
    }
    return;
  }
  if (state.page === 'available-deliveries') {
    content.innerHTML = '<div class="empty-state">Checking for available deliveries...</div>';
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
  const categories = ['All', ...new Set(state.menu.map((item) => item.category).filter(Boolean))];
  if (!categories.includes(state.category)) state.category = 'All';
  const filtered = state.menu.filter((item) => {
    const matchesCategory = state.category === 'All' || item.category === state.category;
    const query = state.search.trim().toLowerCase();
    const searchable = [
      item.title,
      item.category,
      item.description,
      item.seller_name,
      item.creator_name,
      item.creator_role,
      ...(item.ingredients || []).map((ingredient) => `${ingredient.quantity_text} ${ingredient.ingredient_name}`),
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
      const ingredients = (item.ingredients || [])
        .map((ingredient) => {
          const quantity = ingredient.quantity_text ? `${ingredient.quantity_text} ` : '';
          return `${quantity}${ingredient.ingredient_name}`;
        })
        .join(', ');
      // Older menu rows may not have a source value until they pass through the schema migration.
      const listingType = item.listing_type || (item.seller_user_id ? 'community' : 'business');
      const source =
        listingType === 'community'
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
    })
    .join('');
  document.querySelector('#page-content').innerHTML = `
    <div class="menu-banner"><div class="banner-copy"><p class="banner-kicker">A GOOD DAY STARTS HERE</p><h2>Something lovely<br>for your table.</h2><p>Fresh favorites, made to brighten your day.</p></div></div>
    <div class="page-heading"><div><p class="eyebrow">THE GOOD STUFF</p><h1>Today's menu</h1><p>Find a little delicious in every bite.</p></div></div>
    <div class="menu-tools"><div class="menu-filters"><div class="category-list">${categories.map((category) => `<button class="category-button ${category === state.category ? 'active' : ''}" data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}</div></div>
    <label class="search-box"><span class="search-icon" aria-hidden="true">⌕</span><input id="menu-search" type="search" value="${escapeHtml(state.search)}" placeholder="Find something good" aria-label="Search menu"></label></div>
    <div class="section-title"><h2>${state.category === 'All' ? 'Customer favorites' : escapeHtml(state.category)}</h2><span>${filtered.length} ${filtered.length === 1 ? 'dish' : 'dishes'}</span></div>
    ${filtered.length ? `<div class="menu-grid">${cards}</div>` : '<div class="empty-state">No dishes found. Try another search or category.</div>'}`;
}

function renderOrders() {
  const content = document.querySelector('#page-content');
  const orders = state.orders;
  const rows = orders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => {
          const status = String(item.item_status || order.status || 'pending').toLowerCase();
          const seller = item.seller_name || 'Yummy Food Hub';
          return `<div class="order-line"><span>${item.quantity} × ${escapeHtml(item.title)}<small>from ${escapeHtml(seller)}</small></span><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></div>`;
        })
        .join('');
      const date = order.created_at
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(order.created_at))
        : 'Recently placed';
      const status = String(order.status || 'pending').toLowerCase();
      const delivery = order.delivery || {};
      const history = (order.status_history || [])
        .map((entry) => `<li><span>${escapeHtml(statusLabel(entry.status))}</span><time>${escapeHtml(formatDateTime(entry.changed_at))}</time></li>`)
        .join('');
      const detail = order.delivery_type === 'delivery'
        ? `<p><strong>Address:</strong> ${escapeHtml(order.delivery_address || 'Not provided')}</p><p><strong>Rider:</strong> ${escapeHtml(delivery.rider_name || 'Being assigned')}</p>`
        : '<p><strong>Pickup:</strong> Collect your order when it is marked ready.</p>';
      return `<article class="tracked-order"><div class="tracked-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)}</div><div class="order-date">${escapeHtml(date)} · ${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</div></div><div class="tracked-order-total"><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div></div><div class="order-items">${items || 'Order details unavailable'}</div><section class="delivery-progress" aria-label="Order progress">${renderOrderProgress(order)}</section><div class="order-delivery-details">${detail}<p><strong>Contact:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p></div>${history ? `<details class="order-history"><summary>Order and delivery history</summary><ol>${history}</ol></details>` : ''}</article>`;
    })
    .join('');
  const liveStatus = state.orderTrackingError
    ? `<p class="tracking-refresh-status error-text" role="status">Live tracking refresh failed: ${escapeHtml(state.orderTrackingError)}</p>`
    : '<p class="tracking-refresh-status" role="status">Delivery updates refresh automatically every 10 seconds.</p>';
  content.innerHTML = `<div class="page-heading"><div><p class="eyebrow">YOUR YUMMY MOMENTS</p><h1>My orders</h1><p>Track progress from approval through delivery.</p>${liveStatus}</div><button class="table-action" data-action="refresh-orders">↻ Refresh</button></div>${orders.length ? `<div class="tracked-order-list">${rows}</div>` : '<div class="empty-state">No orders just yet. Your first favorite is waiting in the menu.</div>'}`;
}

function statusLabel(status) {
  const labels = {
    ready_for_delivery: 'Ready For Delivery',
    out_for_delivery: 'Out For Delivery',
    picked_up: 'Picked Up',
    assigned: 'Accepted By Rider',
    pickup: 'Pickup',
    delivery: 'Delivery',
    partially_approved: 'Partially Approved',
    partially_completed: 'Partially Completed',
  };
  return labels[status] || String(status || '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value) {
  return value
    ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Recently';
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
    }[currentStatus] || 'The team is reviewing your order.';
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
          // Admin actions target each dish line because sellers can decide independently in mixed carts.
          const actions =
            status === 'pending'
              ? `<button class="table-action approve-button" data-action="update-order-item" data-status="approved" data-id="${escapeHtml(item.order_item_id)}">Approve</button><button class="table-action reject-button" data-action="update-order-item" data-status="rejected" data-id="${escapeHtml(item.order_item_id)}">Reject</button>`
              : status === 'approved'
                ? `<button class="table-action" data-action="update-order-item" data-status="completed" data-id="${escapeHtml(item.order_item_id)}">Mark complete</button>`
                : '';
          const sellerName = item.seller_name || 'Yummy Food Hub';
          return `<div class="admin-order-line"><div class="admin-order-line-title"><strong>${item.quantity} × ${escapeHtml(item.title)}</strong><span>${escapeHtml(sellerName)}</span></div><div class="admin-order-line-money"><span>Dish total ${money(lineTotal)}</span><span>Commission ${money(item.commission_amount)}</span><span>Seller net ${money(item.seller_amount)}</span></div><div class="admin-order-line-actions"><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>${actions}</div></div>`;
        })
        .join('');
      const date = order.created_at
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(order.created_at),
          )
        : 'Recently placed';
      const status = String(order.status || 'pending').toLowerCase();
      return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.customer_email)} · ${escapeHtml(date)}</div></div><div><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div></div><div class="order-delivery-details"><p><strong>${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</strong>${order.delivery_type === 'delivery' ? ` · ${escapeHtml(order.delivery_address || 'Address missing')} · ${escapeHtml(order.contact_phone || 'Phone missing')}` : ''}</p><p><strong>Rider:</strong> ${escapeHtml(order.delivery?.rider_name || 'Not assigned')}</p></div><div class="admin-order-lines">${items || '<div class="empty-state">No order lines</div>'}</div><div class="order-management-actions">${renderOrderStageActions(order)}</div></article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">ORDER MANAGEMENT</p><h1>All orders</h1><p>${pendingCount} dish ${pendingCount === 1 ? 'request' : 'requests'} awaiting approval.</p></div><button class="table-action" data-action="refresh-staff-orders">↻ Refresh</button></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No orders have been placed yet.</div>'}`;
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
    return `<article class="admin-order-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(order.customer_email)} · ${escapeHtml(formatDateTime(order.created_at))}</div></div><div><strong class="order-total">${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span></div></div><div class="order-delivery-details"><p><strong>Address:</strong> ${escapeHtml(order.delivery_address || 'Not provided')} · <strong>Phone:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p><p><strong>Rider:</strong> ${escapeHtml(delivery.rider_name || (order.status === 'ready_for_delivery' ? 'Waiting for a rider to accept' : 'Not assigned'))} ${delivery.rider_phone ? `· ${escapeHtml(delivery.rider_phone)}` : ''} ${delivery.rider_availability ? `· ${escapeHtml(statusLabel(delivery.rider_availability))}` : ''}</p><p><strong>ETA:</strong> ${escapeHtml(delivery.estimated_arrival ? formatDateTime(delivery.estimated_arrival) : 'Not set')}</p><p><strong>Items:</strong> ${items || 'Order details unavailable'}</p></div><div class="order-management-actions">${stageAction}<button class="table-action" data-action="view-delivery-history" data-id="${escapeHtml(order.id)}">View history</button></div>${timeline ? `<details class="order-history"><summary>Status timeline</summary><ol>${timeline}</ol></details>` : ''}</article>`;
  }).join('');
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">DELIVERY OPERATIONS</p><h1>Deliveries</h1><p>Monitor delivery status and rider availability. Riders accept ready orders from Available Deliveries.</p></div><button class="table-action" data-action="refresh-deliveries">↻ Refresh</button></div><section class="rider-roster"><div class="section-title"><h2>Rider availability</h2><span>${availableRiders.filter((rider) => rider.status === 'available').length} available · ${availableRiders.filter((rider) => rider.status === 'busy').length} busy</span></div>${riderCards ? `<div class="rider-grid">${riderCards}</div>` : '<div class="empty-state">No rider profiles are configured.</div>'}</section><div class="section-title delivery-orders-title"><h2>Home delivery orders</h2><span>${state.deliveryOrders.length} total</span></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No delivery orders yet.</div>'}`;
}

function renderAvailableDeliveries() {
  const rows = state.availableDeliveries.map((order) => {
    const items = (order.items || []).map((item) => `${item.quantity} × ${escapeHtml(item.title)}`).join(', ');
    return `<article class="admin-order-card available-delivery-card"><div class="admin-order-heading"><div><div class="order-id">Order #${escapeHtml(order.id)} · ${escapeHtml(order.customer_name)}</div><div class="staff-customer">${escapeHtml(formatDateTime(order.created_at))}</div></div><strong class="order-total">${money(order.total_amount)}</strong></div><div class="order-delivery-details"><p><strong>Deliver to:</strong> ${escapeHtml(order.delivery_address || 'Address missing')}</p><p><strong>Customer phone:</strong> ${escapeHtml(order.contact_phone || 'Not provided')}</p><p><strong>Order value:</strong> ${money(order.total_amount)}</p><p><strong>Items:</strong> ${items || 'Order details unavailable'}</p></div><div class="order-management-actions"><button class="table-action approve-button" data-action="accept-delivery" data-id="${escapeHtml(order.id)}">Accept Delivery</button></div></article>`;
  }).join('');
  const error = state.availableDeliveriesError
    ? `<p class="tracking-refresh-status error-text" role="status">Live refresh failed: ${escapeHtml(state.availableDeliveriesError)}</p>`
    : '<p class="tracking-refresh-status" role="status">New ready orders appear automatically every 10 seconds.</p>';
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">RIDER DASHBOARD</p><h1>Available Deliveries</h1><p>Review delivery details and accept an order to begin your route.</p>${error}</div><button class="table-action" data-action="refresh-available-deliveries">↻ Refresh</button></div>${rows ? `<div class="available-delivery-list">${rows}</div>` : '<div class="empty-state">No deliveries are available right now. New ready orders will appear here.</div>'}`;
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
  document.querySelector('#page-content').innerHTML = `<div class="page-heading"><div><p class="eyebrow">RIDER DASHBOARD</p><h1>My deliveries</h1><p>${active.length} active delivery${active.length === 1 ? '' : 'ies'} assigned to you.</p></div><button class="table-action" data-action="refresh-rider-deliveries">↻ Refresh</button></div>${rows ? `<div class="admin-order-list">${rows}</div>` : '<div class="empty-state">No deliveries are assigned to your rider account.</div>'}`;
}

function renderInventory() {
  const rows = state.inventory
    .map((item) => {
      const count = Number(item.stock_quantity) || 0;
      const source =
        item.listing_type === 'community'
          ? `Community · ${item.seller_name || item.creator_name || 'Local cook'}`
          : item.creator_name
            ? `Hub menu · ${item.creator_name} (${item.creator_role || 'staff'})`
            : 'Hub menu · Yummy Food Hub';
      return `<div class="inventory-row"><div class="inventory-name">${escapeHtml(item.title)}<span class="inventory-meta">${escapeHtml(item.category || 'Uncategorized')} · ${escapeHtml(source)}</span></div><div class="inventory-category">${escapeHtml(item.listing_type === 'community' ? 'Community dish' : 'Hub dish')}</div><div class="inventory-qty"><span class="stock-number ${count <= 5 ? 'low' : ''}">${count}</span><span class="inventory-category">${count <= 5 ? 'Low stock' : 'In stock'}</span></div><button class="table-action" data-action="edit-stock" data-id="${escapeHtml(item.id)}">Adjust stock</button></div>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">KEEP THINGS FRESH</p><h1>Inventory</h1><p>Update availability as the day unfolds.</p></div><button class="table-action" data-action="refresh-inventory">↻ Refresh</button></div>
  <div class="content-table"><div class="table-head"><span>Menu item</span><span>Category</span><span>Availability</span><span></span></div>${rows || '<div class="empty-state">No inventory items available.</div>'}</div>`;
}

function renderAdminDashboard() {
  const { summary, recentOrders } = state.dashboard;
  const stats = [
    ['Orders placed', Number(summary.total_orders)],
    ['Awaiting review', Number(summary.pending_orders)],
    ['Home deliveries', Number(summary.delivery_orders)],
    ['Active deliveries', Number(summary.active_deliveries)],
    ['Unassigned', Number(summary.unassigned_deliveries)],
    ['Approved sales', money(summary.total_sales)],
    ['Commission earned', money(summary.total_commission)],
    ['Available dishes', `${Number(summary.available_dishes)} / ${Number(summary.total_dishes)}`],
  ];
  const rows = recentOrders
    .map((order) => {
      const items = (order.items || [])
        .map((item) => {
          const source =
            item.listing_type === 'community'
              ? `Community · ${item.seller_name || 'seller'}`
              : `Hub menu${item.creator_name ? ` · ${item.creator_name}` : ''}`;
          return `${item.quantity} × ${escapeHtml(item.title)} (${escapeHtml(source)} · ${escapeHtml(item.item_status)})`;
        })
        .join(', ');
      return `<article class="dashboard-order-row"><div><strong>Order #${escapeHtml(order.id)}</strong><span>${escapeHtml(order.customer_name)}</span></div><div>${items || 'Order details unavailable'}<small>${escapeHtml(statusLabel(order.delivery_type || 'pickup'))}</small></div><strong>${money(order.total_amount)}</strong><span class="status-pill ${escapeHtml(order.status)}">${escapeHtml(statusLabel(order.status))}</span></article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">BUSINESS OVERVIEW</p><h1>Dashboard</h1><p>Orders, sales, rider availability, and delivery activity at a glance.</p></div><div class="dashboard-actions"><button class="table-action" data-action="open-deliveries">Manage deliveries</button><button class="table-action" data-action="open-order-queue">View all orders</button><button class="table-action" data-action="refresh-dashboard">↻ Refresh</button></div></div>
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
  const rows = state.sellerOrders
    .map((line) => {
      const status = String(line.item_status || 'pending').toLowerCase();
      const gross = Number(line.price) * Number(line.quantity);
      const actions =
        status === 'pending'
          ? `<button class="table-action approve-button" data-action="update-order-item" data-status="approved" data-id="${escapeHtml(line.order_item_id)}">Approve</button><button class="table-action reject-button" data-action="update-order-item" data-status="rejected" data-id="${escapeHtml(line.order_item_id)}">Reject</button>`
          : status === 'approved'
            ? `<button class="table-action" data-action="update-order-item" data-status="completed" data-id="${escapeHtml(line.order_item_id)}">Mark complete</button>`
            : '';
      return `<article class="seller-sale-row"><div><strong>${escapeHtml(line.title)}</strong><span>Order #${escapeHtml(line.order_id)} · ${escapeHtml(line.created_at ? new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium' }).format(new Date(line.created_at)) : 'Recently')}</span></div><div class="seller-buyer"><strong>${escapeHtml(line.buyer_name)}</strong><span>${escapeHtml(line.buyer_email)}</span></div><span>${line.quantity} × ${money(line.price)}</span><div class="seller-payout"><span>Gross ${money(gross)}</span><span>Fee ${money(line.commission_amount)}</span><strong>Net ${money(line.seller_amount)}</strong></div><div class="seller-sale-actions"><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>${actions}</div></article>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">YOUR ORDERS & EARNINGS</p><h1>My sales</h1><p>See each buyer, decide on your dish orders, and track your net earnings.</p></div><button class="table-action" data-action="refresh-my-sales">↻ Refresh</button></div>
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
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">${isBusinessDish ? 'YUMMY FOOD HUB MENU' : 'FROM YOUR KITCHEN'}</p><h1>${pageTitle}</h1><p>${pageDescription}</p></div></div>
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
  const rows = state.myDishes
    .map((item) => {
      const available = Number(item.stock_quantity) > 0;
      return `<div class="my-dish-row"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${money(item.price)}</span></div><span class="status-pill ${available ? 'approved' : 'rejected'}">${available ? `Available · ${item.stock_quantity}` : 'Unavailable'}</span><button class="table-action" data-action="edit-stock" data-id="${escapeHtml(item.id)}">Update availability</button></div>`;
    })
    .join('');
  document.querySelector('#page-content').innerHTML =
    `<div class="page-heading"><div><p class="eyebrow">YOUR LISTINGS</p><h1>My food</h1><p>Manage portions and availability for your dishes.</p></div><button class="table-action" data-action="go-create-recipe">＋ Create dish</button></div>
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
  const lines = state.cart
    .map(
      (line, index) =>
        `<div class="cart-line"><div><h3>${escapeHtml(line.item.title)}</h3><p>${money(line.item.price)} each · ${money(Number(line.item.price) * line.quantity)}</p></div><div class="quantity-control"><button data-action="quantity" data-index="${index}" data-change="-1" aria-label="Remove one">−</button><span>${line.quantity}</span><button data-action="quantity" data-index="${index}" data-change="1" aria-label="Add one">+</button></div></div>`,
    )
    .join('');
  const checkout = state.checkout;
  modal.innerHTML = `<div class="cart-overlay" data-action="overlay-close"><section class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title"><div class="drawer-head"><div><p class="eyebrow">THE GOOD STUFF</p><h2 id="cart-title">Your bag <span class="brand-muted">(${state.cart.length})</span></h2></div><button class="close-button" data-action="close-cart" aria-label="Close bag">×</button></div>${state.cart.length ? `<div class="cart-lines">${lines}</div><div class="checkout-details"><fieldset><legend>Pickup or delivery?</legend><label><input type="radio" name="delivery_type" value="pickup" ${checkout.deliveryType === 'pickup' ? 'checked' : ''}> Pickup</label><label><input type="radio" name="delivery_type" value="delivery" ${checkout.deliveryType === 'delivery' ? 'checked' : ''}> Delivery</label></fieldset>${checkout.deliveryType === 'delivery' ? `<label class="checkout-field">Delivery address<textarea name="delivery_address" maxlength="255" rows="2" placeholder="Street, area, and directions" required>${escapeHtml(checkout.address)}</textarea></label><label class="checkout-field">Contact phone<input name="contact_phone" type="tel" maxlength="20" autocomplete="tel" placeholder="+256 700 000 000" value="${escapeHtml(checkout.phone)}" required></label>` : ''}</div><div class="drawer-footer"><p id="cart-error" class="drawer-message"></p><p class="order-review-note">Available items are approved automatically. Items needing review remain pending.</p><div class="total-row"><span>Order total</span><strong>${money(total)}</strong></div><button class="button button-dark" data-action="checkout">Place order</button></div>` : '<div class="cart-empty">Your bag is taking a little breather.<br>Add something lovely from the menu.</div>'}</section></div>`;
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
    button.textContent = 'Place order';
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
        ? `Order #${result.orderId} approved automatically`
        : `Order #${result.orderId} sent for admin review`,
    );
    if (state.page === 'menu') renderPage();
    if (state.page === 'orders') renderPage();
  } catch (requestError) {
    error.textContent = requestError.message;
    button.disabled = false;
    button.textContent = 'Place order';
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
    .split(/[\n,]/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
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
      const { token, ...user } = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email: payload.email, password: payload.password }),
      });
      if (state.authMode === 'staff' && !['admin', 'staff', 'rider'].includes(user.role)) {
        throw new Error('This account does not have staff, admin, or rider access. Choose Customer sign-in.');
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
  if (action === 'go-create-recipe') {
    state.recipeSource = 'community';
    setPage('create-recipe');
  }
  if (action === 'open-order-queue') setPage('staff-orders');
  if (action === 'open-deliveries') setPage('admin-deliveries');
  if (action === 'refresh-inventory') renderPage();
  if (action === 'refresh-dashboard' || action === 'refresh-my-dishes' || action === 'refresh-my-sales') renderPage();
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
    if (button.dataset.page === 'create-recipe') state.recipeSource = button.dataset.source || 'community';
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
