const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'sql7.freesqldatabase.com',
  user: process.env.DB_USER || 'sql7839427',
  password: process.env.DB_PASSWORD || 'p1mf1WJAyC',
  database: process.env.DB_NAME || 'sql7839427',
  port: Number(process.env.DB_PORT || 3306)
};
const PORT = Number(process.env.PORT || 3107);

const app = express();
app.use(cors());              // allows local development clients to talk to this server
app.use(express.json());      // lets us read JSON sent from the app

const pool = mysql.createPool(DB_CONFIG);
// Sessions are process-local and expire after 12 hours; restarting Express signs users out.
const sessions = new Map();

async function ensureMenuImageColumn() {
  try {
    await pool.query('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT NULL');
  } catch (err) {
    console.warn('IMAGE COLUMN CHECK WARNING:', err.message);
  }
}

ensureMenuImageColumn();

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Please sign in to continue' });
  }
  req.user = session.user;
  next();
}

// Apply authorization to the role stored in the authenticated server session.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}

async function attachIngredients(menuItems) {
  const itemIds = menuItems.map((item) => item.id);
  if (itemIds.length === 0) return menuItems.map((item) => ({ ...item, ingredients: [] }));

  const placeholders = itemIds.map(() => '?').join(', ');
  const [ingredients] = await pool.query(
    `SELECT menu_item_id, ingredient_name, quantity_text
     FROM recipe_ingredients WHERE menu_item_id IN (${placeholders})
     ORDER BY menu_item_id, ingredient_name`,
    itemIds
  );
  const ingredientsByItem = new Map(itemIds.map((id) => [id, []]));
  for (const ingredient of ingredients) {
    ingredientsByItem.get(ingredient.menu_item_id).push(ingredient);
  }
  return menuItems.map((item) => ({ ...item, ingredients: ingredientsByItem.get(item.id) || [] }));
}

async function attachOrderItems(orders) {
  for (const order of orders) {
    const [items] = await pool.query(
      `SELECT oi.id AS order_item_id, oi.quantity, oi.price, oi.status AS item_status,
         oi.seller_user_id, oi.commission_amount, oi.seller_amount,
         mi.title, mi.listing_type, creator.name AS creator_name, creator.role AS creator_role,
         seller.name AS seller_name
       FROM order_items oi JOIN menu_items mi ON mi.id = oi.item_id
       LEFT JOIN users seller ON seller.id = oi.seller_user_id
       LEFT JOIN users creator ON creator.id = mi.creator_user_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id]
    );
    order.items = items;
  }
  return orders;
}

// Keep the parent order pending while any dish still needs a seller/admin decision.
async function refreshOrderStatus(connection, orderId) {
  const [rows] = await connection.query('SELECT status FROM order_items WHERE order_id = ?', [orderId]);
  const statuses = rows.map((row) => row.status);
  const hasPending = statuses.includes('pending');
  const hasApproved = statuses.includes('approved');
  const hasCompleted = statuses.includes('completed');
  const hasRejected = statuses.includes('rejected');
  let status = 'approved';

  if (hasPending) status = 'pending';
  else if (statuses.every((itemStatus) => itemStatus === 'rejected')) status = 'rejected';
  else if (hasRejected && (hasApproved || hasCompleted)) status = 'partially_approved';
  else if (hasCompleted && hasApproved) status = 'partially_completed';
  else if (hasCompleted) status = 'completed';

  await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  return status;
}

// Lock the line and its stock row together so concurrent approvals cannot oversell a dish.
async function setOrderLineStatus(connection, lineId, status, user) {
  const [rows] = await connection.query(
    `SELECT oi.id, oi.order_id, oi.item_id, oi.quantity, oi.price, oi.status, oi.seller_user_id,
       mi.stock_quantity
     FROM order_items oi JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.id = ? FOR UPDATE`,
    [lineId]
  );
  if (rows.length === 0) {
    const error = new Error('Order item not found');
    error.statusCode = 404;
    throw error;
  }

  const line = rows[0];
  const canManageAll = ['admin', 'staff'].includes(user.role);
  if (!canManageAll && Number(line.seller_user_id) !== Number(user.id)) {
    const error = new Error('You can only manage orders for your own dishes');
    error.statusCode = 403;
    throw error;
  }

  if (status === 'approved' && line.status === 'pending') {
    if (Number(line.stock_quantity) < Number(line.quantity)) {
      const error = new Error('This dish is still unavailable. Update stock before approving.');
      error.statusCode = 409;
      throw error;
    }
    const lineTotal = Number(line.price) * Number(line.quantity);
    // Commission and seller earnings are booked only when this user-owned dish is approved.
    const commission = line.seller_user_id ? Math.round(lineTotal * 0.10) : 0;
    const sellerAmount = line.seller_user_id ? lineTotal - commission : 0;
    await connection.query(
      'UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?',
      [line.quantity, line.item_id]
    );
    await connection.query(
      `UPDATE order_items SET status = 'approved', commission_amount = ?, seller_amount = ? WHERE id = ?`,
      [commission, sellerAmount, line.id]
    );
  } else if (status === 'rejected' && line.status === 'pending') {
    await connection.query(
      `UPDATE order_items SET status = 'rejected', commission_amount = 0, seller_amount = 0 WHERE id = ?`,
      [line.id]
    );
  } else if (status === 'completed' && line.status === 'approved') {
    await connection.query('UPDATE order_items SET status = ? WHERE id = ?', [status, line.id]);
  } else {
    const error = new Error(`Cannot change dish order from ${line.status} to ${status}`);
    error.statusCode = 409;
    throw error;
  }

  const orderStatus = await refreshOrderStatus(connection, line.order_id);
  return { orderId: line.order_id, lineId: line.id, itemStatus: status, orderStatus };
}

// Prints every request in this terminal — handy for seeing what's happening
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// TEST ROUTE  http://localhost:3107/api/health

app.get('/api/health', (req, res) => {
  res.json({ message: 'Yummy Food Hub API is running' });
});


app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are all required' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = 'customer';

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, userRole]
    );
    res.json({ id: result.insertId, name, email, role: userRole });
  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user: sessionUser, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    res.json({ ...sessionUser, token });
  } catch (err) {
    console.error('LOGIN ERROR:', err.message);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

app.post('/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  sessions.delete(token);
  res.json({ message: 'Signed out' });
});

app.get('/menu', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mi.*, seller.name AS seller_name, creator.name AS creator_name,
         creator.role AS creator_role
       FROM menu_items mi
       LEFT JOIN users seller ON seller.id = mi.seller_user_id
       LEFT JOIN users creator ON creator.id = mi.creator_user_id
       ORDER BY mi.category, mi.title`
    );
    res.json(await attachIngredients(rows));
  } catch (err) {
    console.error('MENU ERROR:', err.message);
    res.status(500).json({ error: 'Could not load menu: ' + err.message });
  }
});


app.post('/recipes', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { title, description, preparation_steps, category, price, stock_quantity, ingredients, image_url } = req.body;
  const cleanTitle = String(title || '').trim();
  const cleanPreparationSteps = String(preparation_steps || '').trim();
  const cleanIngredients = Array.isArray(ingredients)
    ? [...new Set(ingredients.map((ingredient) => String(ingredient).trim()).filter(Boolean))]
    : [];
  const normalizedImageUrl = typeof image_url === 'string' ? image_url.trim() : '';
  const numericPrice = Number(price);
  const stock = Number(stock_quantity);

  if (!userId || !cleanTitle || !cleanPreparationSteps || cleanPreparationSteps.length > 4000
    || !category || !Number.isFinite(numericPrice) || numericPrice < 1000
    || !Number.isInteger(stock) || stock < 0 || cleanIngredients.length === 0 || cleanIngredients.length > 40) {
    return res.status(400).json({ error: 'Add a title, category, preparation steps, valid UGX price, stock quantity, and 1 to 40 ingredients' });
  }
  if (normalizedImageUrl && normalizedImageUrl.length > 200000) {
    return res.status(400).json({ error: 'Image is too large. Please choose a smaller photo.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO menu_items
       (title, description, preparation_steps, category, price, stock_quantity, listing_type, creator_user_id, seller_user_id, image_url)
       VALUES (?, ?, ?, ?, ?, ?, 'community', ?, ?, ?)`,
      [cleanTitle, String(description || '').trim().slice(0, 500), cleanPreparationSteps, String(category).trim(), numericPrice, stock, userId, userId, normalizedImageUrl || null]
    );
    for (const ingredient of cleanIngredients) {
      await connection.query(
        'INSERT INTO recipe_ingredients (menu_item_id, ingredient_name) VALUES (?, ?)',
        [result.insertId, ingredient.slice(0, 160)]
      );
    }
    await connection.commit();
    res.status(201).json({ id: result.insertId, title: cleanTitle, stock_quantity: stock });
  } catch (err) {
    await connection.rollback();
    console.error('PUBLISH RECIPE ERROR:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You already have a dish with that name' });
    }
    res.status(500).json({ error: 'Could not publish recipe: ' + err.message });
  } finally {
    connection.release();
  }
});

// House dishes record their staff/admin creator but deliberately have no seller payout owner.
app.post('/staff/menu', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { title, description, preparation_steps, category, price, stock_quantity, ingredients, image_url } = req.body;
  const cleanTitle = String(title || '').trim();
  const cleanPreparationSteps = String(preparation_steps || '').trim();
  const cleanIngredients = Array.isArray(ingredients)
    ? [...new Set(ingredients.map((ingredient) => String(ingredient).trim()).filter(Boolean))]
    : [];
  const normalizedImageUrl = typeof image_url === 'string' ? image_url.trim() : '';
  const numericPrice = Number(price);
  const stock = Number(stock_quantity);
  if (!cleanTitle || !cleanPreparationSteps || cleanPreparationSteps.length > 4000
    || !category || !Number.isFinite(numericPrice) || numericPrice < 1000
    || !Number.isInteger(stock) || stock < 0 || cleanIngredients.length === 0 || cleanIngredients.length > 40) {
    return res.status(400).json({ error: 'Add a title, category, preparation steps, valid UGX price, stock quantity, and 1 to 40 ingredients' });
  }
  if (normalizedImageUrl && normalizedImageUrl.length > 200000) {
    return res.status(400).json({ error: 'Image is too large. Please choose a smaller photo.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO menu_items
       (title, description, preparation_steps, category, price, stock_quantity, listing_type, creator_user_id, seller_user_id, image_url)
       VALUES (?, ?, ?, ?, ?, ?, 'business', ?, NULL, ?)`,
      [cleanTitle, String(description || '').trim().slice(0, 500), cleanPreparationSteps, String(category).trim(), numericPrice, stock, req.user.id, normalizedImageUrl || null]
    );
    for (const ingredient of cleanIngredients) {
      await connection.query(
        'INSERT INTO recipe_ingredients (menu_item_id, ingredient_name) VALUES (?, ?)',
        [result.insertId, ingredient.slice(0, 160)]
      );
    }
    await connection.commit();
    res.status(201).json({ id: result.insertId, title: cleanTitle, listing_type: 'business', stock_quantity: stock });
  } catch (err) {
    await connection.rollback();
    console.error('PUBLISH HOUSE DISH ERROR:', err.message);
    res.status(500).json({ error: 'Could not add house dish: ' + err.message });
  } finally {
    connection.release();
  }
});

app.get('/recipes/user/:userId', requireAuth, async (req, res) => {
  if (Number(req.params.userId) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'You can only manage your own dishes' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM menu_items WHERE seller_user_id = ? ORDER BY title',
      [req.params.userId]
    );
    res.json(await attachIngredients(rows));
  } catch (err) {
    console.error('MY RECIPES ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your dishes: ' + err.message });
  }
});

// PLACE ORDER — each available line auto-approves; unavailable lines stay pending without reserving stock.
app.post('/order', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }

  const quantities = new Map();
  for (const line of items) {
    const itemId = Number(line.itemId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(itemId) || itemId < 1 || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Each order item needs a valid itemId and positive quantity' });
    }
    quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
  }
  const orderLines = [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let total = 0;

    for (const line of orderLines) {
      const [rows] = await connection.query(
        'SELECT price, stock_quantity, seller_user_id FROM menu_items WHERE id = ? FOR UPDATE',
        [line.itemId]
      );
      if (rows.length === 0) {
        const error = new Error('Item not found: ' + line.itemId);
        error.statusCode = 404;
        throw error;
      }
      const item = rows[0];
      const lineTotal = Number(item.price) * line.quantity;
      line.price = Number(item.price);
      line.sellerUserId = item.seller_user_id;
      line.status = Number(item.stock_quantity) >= line.quantity ? 'approved' : 'pending';
      line.commissionAmount = line.sellerUserId && line.status === 'approved'
        ? Math.round(lineTotal * 0.05)
        : 0;
      line.sellerAmount = line.sellerUserId && line.status === 'approved'
        ? lineTotal - line.commissionAmount
        : 0;
      total += lineTotal;
    }

    const status = orderLines.some((line) => line.status === 'pending') ? 'pending' : 'approved';
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, status, total_amount) VALUES (?, ?, ?)',
      [userId, status, total]
    );
    const orderId = orderResult.insertId;

    for (const line of orderLines) {
      await connection.query(
        `INSERT INTO order_items
         (order_id, item_id, quantity, price, seller_user_id, status, commission_amount, seller_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, line.itemId, line.quantity, line.price, line.sellerUserId, line.status, line.commissionAmount, line.sellerAmount]
      );
      if (line.status === 'approved') {
        await connection.query(
          'UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [line.quantity, line.itemId]
        );
      }
    }

    await refreshOrderStatus(connection, orderId);
    await connection.commit();
    res.status(201).json({ orderId, total, status });
  } catch (err) {
    await connection.rollback();
    console.error('ORDER ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// order history for one customer

app.get('/orders/:userId', requireAuth, async (req, res) => {
  if (Number(req.params.userId) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'You can only view your own orders' });
  }
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(await attachOrderItems(orders));
  } catch (err) {
    console.error('ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load orders: ' + err.message });
  }
});

// Seller views are always scoped to the authenticated creator ID.
app.get('/seller/orders', requireAuth, async (req, res) => {
  try {
    const [lines] = await pool.query(
      `SELECT oi.id AS order_item_id, oi.order_id, oi.item_id, oi.quantity, oi.price,
         oi.status AS item_status, oi.commission_amount, oi.seller_amount,
         o.status AS order_status, o.created_at,
         buyer.name AS buyer_name, buyer.email AS buyer_email, mi.title
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN users buyer ON buyer.id = o.user_id
       JOIN menu_items mi ON mi.id = oi.item_id
       WHERE oi.seller_user_id = ?
       ORDER BY o.created_at DESC, oi.id`,
      [req.user.id]
    );
    res.json(lines);
  } catch (err) {
    console.error('SELLER ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your sales: ' + err.message });
  }
});

app.get('/seller/dashboard', requireAuth, async (req, res) => {
  try {
    const [[listings]] = await pool.query(
      `SELECT COUNT(*) AS total_dishes,
         COALESCE(SUM(stock_quantity > 0), 0) AS available_dishes
       FROM menu_items WHERE seller_user_id = ?`,
      [req.user.id]
    );
    const [[sales]] = await pool.query(
      `SELECT COUNT(DISTINCT order_id) AS orders_received,
         COALESCE(SUM(status = 'pending'), 0) AS pending_dishes,
         COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN price * quantity ELSE 0 END), 0) AS gross_sales,
         COALESCE(SUM(commission_amount), 0) AS commission,
         COALESCE(SUM(seller_amount), 0) AS seller_earnings
       FROM order_items WHERE seller_user_id = ?`,
      [req.user.id]
    );
    res.json({ summary: { ...listings, ...sales } });
  } catch (err) {
    console.error('SELLER DASHBOARD ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your earnings: ' + err.message });
  }
});

// STAFF ORDERS — pending orders appear first in the staff queue.
app.get('/staff/orders', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY (o.status = 'pending') DESC, o.created_at DESC`
    );
    res.json(await attachOrderItems(orders));
  } catch (err) {
    console.error('STAFF ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load staff orders: ' + err.message });
  }
});

// Sales and commission totals are derived from approved dish lines, not pending requests.
app.get('/admin/dashboard', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [[sales]] = await pool.query(
      `SELECT COUNT(DISTINCT order_id) AS total_orders,
         COUNT(DISTINCT CASE WHEN status = 'pending' THEN order_id END) AS pending_orders,
         COUNT(DISTINCT CASE WHEN status IN ('approved', 'completed') THEN order_id END) AS approved_orders,
         COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN price * quantity ELSE 0 END), 0) AS total_sales,
         COALESCE(SUM(commission_amount), 0) AS total_commission
       FROM order_items`
    );
    const [[listings]] = await pool.query(
      `SELECT COUNT(*) AS total_dishes,
         COALESCE(SUM(stock_quantity > 0), 0) AS available_dishes
       FROM menu_items`
    );
    const [recentOrders] = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 8`
    );
    res.json({
      summary: { ...sales, ...listings },
      recentOrders: await attachOrderItems(recentOrders),
    });
  } catch (err) {
    console.error('ADMIN DASHBOARD ERROR:', err.message);
    res.status(500).json({ error: 'Could not load dashboard: ' + err.message });
  }
});

// ============================================================
// INVENTORY — staff/admin screens
// ============================================================
app.get('/inventory', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mi.*, creator.name AS creator_name, creator.role AS creator_role,
         seller.name AS seller_name
       FROM menu_items mi
       LEFT JOIN users creator ON creator.id = mi.creator_user_id
       LEFT JOIN users seller ON seller.id = mi.seller_user_id
       ORDER BY mi.listing_type, mi.category, mi.title`
    );
    res.json(rows);
  } catch (err) {
    console.error('INVENTORY ERROR:', err.message);
    res.status(500).json({ error: 'Could not load inventory: ' + err.message });
  }
});

// Dish owners may change their own stock; staff/admin can manage any dish.
app.put('/inventory/:id', requireAuth, async (req, res) => {
  try {
    const { stock_quantity } = req.body;
    const quantity = Number(stock_quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Stock quantity must be a non-negative whole number' });
    }
    const [items] = await pool.query('SELECT seller_user_id FROM menu_items WHERE id = ?', [req.params.id]);
    if (items.length === 0) return res.status(404).json({ error: 'Dish not found' });
    const isStaff = ['admin', 'staff'].includes(req.user.role);
    const isOwner = items[0].seller_user_id && Number(items[0].seller_user_id) === Number(req.user.id);
    if (!isStaff && !isOwner) {
      return res.status(403).json({ error: 'Only the dish owner or staff/admin can update stock' });
    }
    await pool.query('UPDATE menu_items SET stock_quantity = ? WHERE id = ?', [quantity, req.params.id]);
    res.json({ id: req.params.id, stock_quantity: quantity });
  } catch (err) {
    console.error('UPDATE STOCK ERROR:', err.message);
    res.status(500).json({ error: 'Could not update stock: ' + err.message });
  }
});

// Sellers can decide only on their own lines; admins/staff may manage any line.
app.put('/seller/order-items/:lineId/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected or completed' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await setOrderLineStatus(connection, req.params.lineId, status, req.user);
    await connection.commit();
    res.json(result);
  } catch (err) {
    await connection.rollback();
    console.error('UPDATE SELLER ORDER ITEM ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Admin/staff can update all eligible dish lines in a whole order.
app.put('/orders/:id/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected or completed' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT id FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    const [lines] = await connection.query(
      'SELECT id, status FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE',
      [req.params.id]
    );
    const actionableStatus = status === 'completed' ? 'approved' : 'pending';
    for (const line of lines.filter((orderLine) => orderLine.status === actionableStatus)) {
      await setOrderLineStatus(connection, line.id, status, req.user);
    }
    const orderStatus = await refreshOrderStatus(connection, req.params.id);
    await connection.commit();
    res.json({ id: req.params.id, status: orderStatus });
  } catch (err) {
    await connection.rollback();
    console.error('UPDATE ORDER ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Serve the browser app from the same origin as the REST API.
app.use(express.static(path.join(__dirname, '..', 'yummy-web')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});
