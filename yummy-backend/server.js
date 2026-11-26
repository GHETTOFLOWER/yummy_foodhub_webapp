const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { createMenuWorkflowRouter } = require('./menu-workflow');
const {
  createNotificationRouter,
  notifyApproachingScheduledOrders,
  notifyLowStock,
  notifyOrderStatus,
  notifyRoles,
  notifyUser,
} = require('./notification-system');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'sql7.freesqldatabase.com',
  user: process.env.DB_USER || 'sql7839427',
  password: process.env.DB_PASSWORD || 'p1mf1WJAyC',
  database: process.env.DB_NAME || 'sql7839427',
  port: Number(process.env.DB_PORT || 3306),
};
const PORT = Number(process.env.PORT || 3107);

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool(DB_CONFIG);
const sessions = new Map();
const cateringEventTypes = new Set([
  'wedding',
  'birthday_party',
  'graduation_party',
  'corporate_meeting',
  'conference',
  'school_event',
  'religious_event',
  'custom_event',
]);
const defaultMenuSeedName = 'ugandan-dishes';
const defaultMenuSeedVersion = 9;
const defaultMenuDishes = [
  { title: 'Boiled Cassava & Beef-Pea Stew', category: 'Local Favorites', price: 13000, description: 'Boiled cassava with beef and green pea stew, served with seasonal greens.', recipeSteps: ['Boil cassava until tender.', 'Simmer beef and green peas in a seasoned stew; serve with greens.'], imageUrl: './images/Boiled Cassava & Beef-Pea Stew.jpeg' },
  { title: 'Flaky Ugandan Chapati', category: 'Side Dishes', price: 3000, description: 'Ugandan chapati, crisp outside and soft inside.', recipeSteps: ['Prepare and rest a soft wheat dough.', 'Roll into layers and pan-fry until golden.'], imageUrl: './images/Chapati.jpeg' },
  { title: 'Kalo, Cassava & Beef Stew', category: 'Local Favorites', price: 14000, description: 'Millet bread and cassava served with beef stew and steamed greens.', recipeSteps: ['Prepare millet bread and boil cassava until tender.', 'Serve with beef stew and steamed greens.'], imageUrl: './images/Kalo,Cassava&Beaf Stew.jpeg' },
  { title: 'Chicken Luwombo with Matooke & Sweet Potato', category: 'Special Meals', price: 22000, description: 'Chicken luwombo served with matooke, sweet potatoes, peas, and greens.', recipeSteps: ['Season chicken and cook in banana leaves with sauce.', 'Serve with matooke, sweet potato, peas, and greens.'], imageUrl: './images/Luwombo Lwenkoko with Matooke and Sweet Potatoes.jpeg' },
  { title: 'Beef Luwombo with Matooke, Lumonde & Pumpkin', category: 'Special Meals', price: 20000, description: 'Beef luwombo served with matooke, pumpkin, rice, greens, and avocado.', recipeSteps: ['Season beef and slow-cook in banana leaves with sauce.', 'Serve with matooke, pumpkin, rice, greens, and avocado.'], imageUrl: './images/luwombo lwenyama with Matooke,Lumonde & Pumpkin.jpeg' },
  { title: 'Matooke Katogo with Beef & Butula', category: 'Breakfast', price: 10000, description: 'Matooke katogo simmered with beef and served alongside green pea gravy.', recipeSteps: ['Simmer matooke and beef together until tender.', 'Serve with green pea gravy.'], imageUrl: './images/Matooke Katogo with Beef and Butula.jpeg' },
  { title: 'Matooke Katogo with Tilapia Fish', category: 'Breakfast', price: 17000, description: 'Matooke katogo served with tilapia fish, green peas, and fresh avocado.', recipeSteps: ['Cook matooke until tender and prepare tilapia separately.', 'Serve with green peas and fresh avocado.'], imageUrl: './images/Matooke Katogo with Tilapia fish.jpeg' },
  { title: 'Matooke, Mayuni & Byenda', category: 'Local Favorites', price: 13000, description: 'Matooke and cocoyam served with Ugandan beef tripe stew and greens.', recipeSteps: ['Cook beef tripe until tender and prepare seasoned stew.', 'Serve with matooke, cocoyam, and greens.'], imageUrl: './images/Matooke,Mayuni & Byenda.jpeg' },
  { title: 'Matooke, Rice & Byenda', category: 'Local Favorites', price: 12000, description: 'Steamed matooke and rice served with Ugandan beef tripe stew.', recipeSteps: ['Steam matooke and rice until cooked.', 'Serve with seasoned beef tripe stew.'], imageUrl: './images/Matooke,Rice&Byenda.jpeg' },
  { title: 'Matooke, Mayuni & Fish Stew', category: 'Local Favorites', price: 18000, description: 'Matooke and cocoyam served with tilapia stew, green peas, and greens.', recipeSteps: ['Prepare tilapia in a seasoned stew.', 'Serve with matooke, cocoyam, green peas, and greens.'], imageUrl: './images/MatookeMayuuni and Fish Stew.jpeg' },
  { title: 'Posho & Tilapia Fish Stew with Greens', category: 'Main Courses', price: 16000, description: 'Ugandan tilapia fish stew served with posho and steamed seasonal greens.', recipeSteps: ['Prepare tilapia stew with vegetables and seasoning.', 'Serve with posho and steamed greens.'], imageUrl: './images/Posho& Tilapia Fish Stew with Greens.jpeg' },
  { title: 'Posho, Beans & Okra Stew with Doodo', category: 'Main Courses', price: 7000, description: 'Posho served with seasoned beans, okra stew, and steamed doodo greens.', recipeSteps: ['Simmer beans and okra with seasoning until tender.', 'Serve with posho and steamed doodo.'], imageUrl: './images/Posho,Beans & Okra Stew with Doodo.jpeg' },
  { title: 'Steamed Rice, Fish Stew & Fresh Fruit Juice', category: 'Main Courses', price: 19000, description: 'Steamed rice served with tilapia stew, greens, and fresh fruit juice.', recipeSteps: ['Steam rice and prepare tilapia stew with greens.', 'Serve with fresh fruit juice.'], imageUrl: './images/Steamed Ric,Fish Stew & Fresh Fruit Juice.jpeg' },
  { title: 'Whole Fried Tilapia and Chips', category: 'Special Meals', price: 25000, description: 'Whole fried tilapia served with golden chips, fresh vegetables, and lime.', recipeSteps: ['Season and fry tilapia until cooked through.', 'Serve with chips, fresh vegetables, and lime.'], imageUrl: './images/Whole Fried Tilapia and Chips.jpeg' },
  { title: 'Coca-Cola', category: 'Beverages', price: 3000, description: 'Chilled Coca-Cola.', imageUrl: './images/beverages/coca-cola.jpg' },
  { title: 'Fanta Orange', category: 'Beverages', price: 3000, description: 'Chilled Fanta Orange.', imageUrl: './images/beverages/fanta.jpg' },
  { title: 'Sprite', category: 'Beverages', price: 3000, description: 'Chilled Sprite.', imageUrl: './images/beverages/sprite.jpg' },
  { title: 'Stoney Tangawizi', category: 'Beverages', price: 3000, description: 'Chilled ginger-flavoured Stoney Tangawizi.', imageUrl: './images/beverages/stoney.jpg' },
  { title: 'Pepsi', category: 'Beverages', price: 3000, description: 'Chilled Pepsi.', imageUrl: './images/beverages/pepsi.jpg' },
  { title: 'Mountain Dew', category: 'Beverages', price: 3000, description: 'Chilled Mountain Dew.', imageUrl: './images/beverages/mountain-dew.jpg' },
  { title: 'Fresh Mango Juice', category: 'Beverages', price: 5000, description: 'Freshly prepared mango juice.', imageUrl: './images/beverages/mango-juice.jpg' },
  { title: 'Fresh Orange Juice', category: 'Beverages', price: 5000, description: 'Freshly prepared orange juice.', imageUrl: './images/beverages/orange-juice.jpg' },
  { title: 'Passion Fruit Juice', category: 'Beverages', price: 5000, description: 'Fresh passion fruit juice.', imageUrl: './images/beverages/passion-fruit.jpg' },
  { title: 'Watermelon Juice', category: 'Beverages', price: 5000, description: 'Fresh watermelon juice.', imageUrl: './images/beverages/watermelon-juice.jpg' },
  { title: 'Pineapple Juice', category: 'Beverages', price: 5000, description: 'Fresh pineapple juice.', imageUrl: './images/beverages/pineapple-juice.jpg' },
  { title: 'Mixed Tropical Juice', category: 'Beverages', price: 6000, description: 'A refreshing blend of tropical fruit juices.', imageUrl: './images/beverages/tropical-juice.jpg' },
  { title: 'African Tea', category: 'Beverages', price: 3000, description: 'Traditional African tea.', imageUrl: './images/beverages/african-tea.jpg' },
  { title: 'Black Coffee', category: 'Beverages', price: 4000, description: 'Freshly brewed black coffee.', imageUrl: './images/beverages/coffee.jpg' },
  { title: 'Mineral Water', category: 'Beverages', price: 2000, description: 'Bottled mineral water.', imageUrl: './images/beverages/water.jpg' },
];

function getDefaultMenuRows(rows) {
  const defaultDishesByTitle = new Map(defaultMenuDishes.map((dish) => [dish.title, dish]));
  return rows.map((row) => {
    const seededDish = defaultDishesByTitle.get(row.title);
    return seededDish ? { ...row, recipe_steps: seededDish.recipeSteps } : row;
  });
}

async function removeDishIfUnordered(connection, menuItemId) {
  const [[orderItem]] = await connection.query('SELECT id FROM order_items WHERE item_id = ? LIMIT 1', [menuItemId]);
  if (orderItem) return;
  await connection.query('DELETE FROM menu_items WHERE id = ?', [menuItemId]);
}

async function ensureMenuImageColumn() {
  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM menu_items LIKE 'image_url'");
    if (columns.length === 0) {
      await pool.query('ALTER TABLE menu_items ADD COLUMN image_url TEXT NULL');
    }
  } catch (err) {
    console.warn('IMAGE COLUMN CHECK WARNING:', err.message);
  }
}

async function seedDefaultMenu() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_seed_versions (
      seed_name VARCHAR(80) PRIMARY KEY,
      version INT NOT NULL
    ) ENGINE=InnoDB`,
  );
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT IGNORE INTO app_seed_versions (seed_name, version) VALUES (?, 0)', [
      defaultMenuSeedName,
    ]);
    const [[seedState]] = await connection.query(
      'SELECT version FROM app_seed_versions WHERE seed_name = ? FOR UPDATE',
      [defaultMenuSeedName],
    );
    if (Number(seedState.version) >= defaultMenuSeedVersion) {
      await connection.commit();
      return;
    }

    for (const dish of defaultMenuDishes) {
      const [[existing]] = await connection.query(
        'SELECT id FROM menu_items WHERE title = ? ORDER BY id LIMIT 1',
        [dish.title],
      );
      let menuItemId = existing && existing.id;
      if (menuItemId) {
        await connection.query(
          `UPDATE menu_items
           SET description = ?, category = ?,
             image_url = CASE WHEN ? = 'Beverages' THEN ? ELSE image_url END
           WHERE id = ?`,
          [dish.description, dish.category, dish.category, dish.imageUrl, menuItemId],
        );
      } else {
        const [result] = await connection.query(
          `INSERT INTO menu_items
           (title, description, category, price, stock_quantity, image_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [dish.title, dish.description, dish.category, dish.price, 10, dish.imageUrl],
        );
        menuItemId = result.insertId;
      }

      const [duplicates] = await connection.query(
        'SELECT id FROM menu_items WHERE title = ? ORDER BY id',
        [dish.title],
      );
      for (const duplicate of duplicates.slice(1)) {
        await removeDishIfUnordered(connection, duplicate.id);
      }
    }

    const defaultTitles = defaultMenuDishes.map((dish) => dish.title);
    const defaultTitlePlaceholders = defaultTitles.map(() => '?').join(', ');
    const [obsoleteRows] = await connection.query(
      `SELECT id FROM menu_items
       WHERE title IS NULL OR title NOT IN (${defaultTitlePlaceholders})`,
      defaultTitles,
    );
    for (const row of obsoleteRows) {
      await removeDishIfUnordered(connection, row.id);
    }

    await connection.query('UPDATE app_seed_versions SET version = ? WHERE seed_name = ?', [
      defaultMenuSeedVersion,
      defaultMenuSeedName,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

let menuSeedPromise;
function ensureDefaultMenuSeeded() {
  if (!menuSeedPromise) {
    menuSeedPromise = ensureMenuImageColumn()
      .then(seedDefaultMenu)
      .catch((error) => {
        menuSeedPromise = null;
        throw error;
      });
  }
  return menuSeedPromise;
}

ensureDefaultMenuSeeded().catch((error) => console.error('MENU SEED ERROR:', error.message));

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  req.user = session.user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    next();
  };
}

app.use(createMenuWorkflowRouter({
  pool,
  requireAuth,
  requireRole,
  onRequestSubmitted: (connection, request) => notifyRoles(connection, ['admin', 'staff'], {
    type: 'menu_change_request',
    title: 'New menu change request',
    message: `A staff member submitted a menu ${request.action_type} request.`,
    entityType: 'menu_change_request',
    entityId: request.id,
    dedupeKey: `menu-change-request-${request.id}`,
  }),
}));
app.use(createNotificationRouter({ pool, requireAuth }));

function validateCateringRequest(body) {
  const eventType = String(body.event_type || '').trim();
  if (!cateringEventTypes.has(eventType)) {
    return { error: 'Select a valid event type.' };
  }

  const eventDate = String(body.event_date || '').trim();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ? new Date(`${eventDate}T00:00:00.000Z`)
    : null;
  if (
    !parsedDate ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== eventDate ||
    eventDate < new Date().toISOString().slice(0, 10)
  ) {
    return { error: 'Choose a valid event date that is today or later.' };
  }

  const guestCount = Number(body.guest_count);
  if (!Number.isSafeInteger(guestCount) || guestCount < 1 || guestCount > 4294967295) {
    return { error: 'Guest count must be a positive whole number.' };
  }

  const venue = String(body.venue || '').trim();
  if (!venue || venue.length > 255) {
    return { error: 'Venue is required and must be 255 characters or fewer.' };
  }

  const phoneNumber = String(body.phone_number || '').trim();
  if (!/^\+?[0-9\s()-]{7,20}$/.test(phoneNumber)) {
    return { error: 'Enter a valid phone number between 7 and 20 characters.' };
  }

  const budgetInput = String(body.budget ?? '').trim();
  let budget = null;
  if (budgetInput) {
    budget = Number(budgetInput);
    if (!Number.isFinite(budget) || budget < 0 || budget > 9999999999.99) {
      return { error: 'Budget must be a non-negative amount within the supported range.' };
    }
  }

  const specialRequests = String(body.special_requests || '').trim();
  if (specialRequests.length > 2000) {
    return { error: 'Special requests must be 2,000 characters or fewer.' };
  }

  return {
    value: {
      event_type: eventType,
      event_date: eventDate,
      guest_count: guestCount,
      venue,
      phone_number: phoneNumber,
      budget,
      special_requests: specialRequests || null,
    },
  };
}

async function attachOrderItems(orders) {
  for (const order of orders) {
    const [items] = await pool.query(
      `SELECT oi.id AS order_item_id, oi.quantity, oi.price, oi.status AS item_status,
         oi.item_id, mi.title
       FROM order_items oi JOIN menu_items mi ON mi.id = oi.item_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id],
    );
    order.items = items;
  }
  return orders;
}

async function attachRiderOrderItems(orders) {
  for (const order of orders) {
    const [items] = await pool.query(
      `SELECT oi.quantity, mi.title
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.item_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [order.id],
    );
    order.items = items;
  }
  return orders;
}

async function attachDeliveryProgress(orders) {
  if (!orders.length) return orders;
  // Delivery lifecycle stays on orders/deliveries; item approval statuses remain separate.
  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  const [deliveries] = await pool.query(
    `SELECT d.*, r.rider_name, r.rider_phone, r.status AS rider_availability
     FROM deliveries d
     LEFT JOIN delivery_riders r ON r.id = d.rider_id
     WHERE d.order_id IN (${placeholders})
     ORDER BY d.id DESC`,
    orderIds,
  );
  const [history] = await pool.query(
    `SELECT order_id, status, changed_at
     FROM order_status_history
     WHERE order_id IN (${placeholders})
     ORDER BY changed_at, id`,
    orderIds,
  );
  const deliveryByOrder = new Map();
  for (const delivery of deliveries) {
    if (!deliveryByOrder.has(delivery.order_id)) deliveryByOrder.set(delivery.order_id, delivery);
  }
  const historyByOrder = new Map(orderIds.map((id) => [id, []]));
  for (const entry of history) historyByOrder.get(entry.order_id).push(entry);
  return orders.map((order) => ({
    ...order,
    delivery: deliveryByOrder.get(order.id) || null,
    status_history: historyByOrder.get(order.id) || [],
  }));
}

async function refreshOrderStatus(connection, orderId, changedBy = null) {
  const [[order]] = await connection.query('SELECT status, order_type FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  if (
    ['preparing', 'ready_for_delivery', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'].includes(
      order.status,
    )
  ) {
    return order.status;
  }
  const [rows] = await connection.query('SELECT status FROM order_items WHERE order_id = ?', [orderId]);
  const statuses = rows.map((row) => row.status);
  if (order.status === 'scheduled' && !statuses.every((itemStatus) => itemStatus === 'rejected')) {
    return order.status;
  }
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

  if (status !== order.status) {
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    await connection.query(
      'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
      [orderId, status, changedBy],
    );
    await notifyOrderStatus(connection, orderId, status);
  }
  return status;
}

async function setOrderLineStatus(connection, lineId, status, changedBy) {
  const [rows] = await connection.query(
    `SELECT oi.id, oi.order_id, oi.item_id, oi.quantity, oi.status,
       mi.title, mi.stock_quantity
     FROM order_items oi JOIN menu_items mi ON mi.id = oi.item_id
     WHERE oi.id = ? FOR UPDATE`,
    [lineId],
  );
  if (rows.length === 0) {
    const error = new Error('Order item not found');
    error.statusCode = 404;
    throw error;
  }

  const line = rows[0];
  if (status === 'approved' && line.status === 'pending') {
    if (Number(line.stock_quantity) < Number(line.quantity)) {
      const error = new Error('Insufficient stock. Update inventory before approving this order item.');
      error.statusCode = 409;
      throw error;
    }
    await connection.query('UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?', [
      line.quantity,
      line.item_id,
    ]);
    await notifyLowStock(
      connection,
      line.item_id,
      rows[0].title,
      line.stock_quantity,
      Number(line.stock_quantity) - Number(line.quantity),
    );
    await connection.query(`UPDATE order_items SET status = 'approved' WHERE id = ?`, [line.id]);
  } else if (status === 'rejected' && line.status === 'pending') {
    await connection.query(`UPDATE order_items SET status = 'rejected' WHERE id = ?`, [line.id]);
  } else if (status === 'completed' && line.status === 'approved') {
    await connection.query('UPDATE order_items SET status = ? WHERE id = ?', [status, line.id]);
  } else {
    const error = new Error(`Cannot change order item status from ${line.status} to ${status}`);
    error.statusCode = 409;
    throw error;
  }

  const orderStatus = await refreshOrderStatus(connection, line.order_id, changedBy);
  return { orderId: line.order_id, lineId: line.id, itemStatus: status, orderStatus };
}

function getScheduledOrderTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return null;
  }
  const scheduledFor = new Date(value);
  if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.toISOString() !== value) return null;
  if (scheduledFor.getTime() <= Date.now()) return null;
  return {
    date: scheduledFor,
    sql: scheduledFor.toISOString().slice(0, 19).replace('T', ' '),
  };
}

async function writeOrderStatus(connection, orderId, status, userId) {
  await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  await connection.query(
    'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
    [orderId, status, userId],
  );
  await notifyOrderStatus(connection, orderId, status);
}

async function syncRiderAvailability(connection, riderId) {
  if (!riderId) return;
  // Availability reflects all live assignments, not just the delivery being updated.
  const [[active]] = await connection.query(
    `SELECT COUNT(*) AS active_count
     FROM deliveries
     WHERE rider_id = ? AND delivery_status IN ('assigned', 'picked_up', 'out_for_delivery')`,
    [riderId],
  );
  const status = Number(active.active_count) > 0 ? 'busy' : 'available';
  await connection.query('UPDATE delivery_riders SET status = ? WHERE id = ?', [status, riderId]);
  return status;
}

async function syncRiderProfiles(connection = pool) {
  await connection.query(
    `INSERT INTO delivery_riders (user_id, rider_name, status)
     SELECT u.id, u.name, 'available'
     FROM users u
     WHERE u.role = 'rider'
     ON DUPLICATE KEY UPDATE rider_name = VALUES(rider_name)`,
  );
}

async function syncRiderProfile(connection, userId) {
  await connection.query(
    `INSERT INTO delivery_riders (user_id, rider_name, status)
     SELECT u.id, u.name, 'available'
     FROM users u
     WHERE u.id = ? AND u.role = 'rider'
     ON DUPLICATE KEY UPDATE rider_name = VALUES(rider_name)`,
    [userId],
  );
}

async function advanceDelivery(connection, delivery, nextStatus, userId) {
  const transitions = {
    assigned: 'picked_up',
    picked_up: 'out_for_delivery',
    out_for_delivery: 'delivered',
  };
  if (transitions[delivery.delivery_status] !== nextStatus) {
    const error = new Error(`Cannot change delivery from ${delivery.delivery_status} to ${nextStatus}`);
    error.statusCode = 409;
    throw error;
  }
  const timestampColumn = {
    picked_up: 'picked_up_at',
    out_for_delivery: 'out_for_delivery_at',
    delivered: 'delivered_at',
  }[nextStatus];
  await connection.query(
    `UPDATE deliveries SET delivery_status = ?, ${timestampColumn} = CURRENT_TIMESTAMP WHERE id = ?`,
    [nextStatus, delivery.id],
  );
  await writeOrderStatus(connection, delivery.order_id, nextStatus, userId);
  if (nextStatus === 'delivered') {
    await syncRiderAvailability(connection, delivery.rider_id);
    const [[rider]] = await connection.query('SELECT user_id FROM delivery_riders WHERE id = ?', [delivery.rider_id]);
    if (rider) {
      await notifyUser(connection, rider.user_id, {
        type: 'delivery_completed',
        title: 'Delivery completed',
        message: `Delivery for order #${delivery.order_id} is complete.`,
        entityType: 'order',
        entityId: delivery.order_id,
        dedupeKey: `delivery-completed-${delivery.id}`,
      });
    }
  }
}

async function updateOrderLifecycle(connection, order, nextStatus, user) {
  if (nextStatus === 'approved' && order.status === 'pending') {
    const [lines] = await connection.query(
      'SELECT id, status FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE',
      [order.id],
    );
    for (const line of lines.filter((item) => item.status === 'pending')) {
      await setOrderLineStatus(connection, line.id, 'approved', user.id);
    }
    const [[updated]] = await connection.query('SELECT status FROM orders WHERE id = ?', [order.id]);
    if (!['approved', 'partially_approved', 'partially_completed'].includes(updated.status)) {
      const error = new Error('All available order items must be approved before preparing this order');
      error.statusCode = 409;
      throw error;
    }
    return updated.status;
  }

  const allowedTransitions = {
    pending: ['cancelled'],
    approved: ['preparing', 'cancelled'],
    partially_approved: ['preparing', 'cancelled'],
    partially_completed: ['preparing', 'cancelled'],
    completed: order.delivery_type === 'delivery' ? ['preparing', 'cancelled'] : [],
    scheduled: ['preparing', 'cancelled'],
    preparing: ['ready_for_delivery', 'cancelled'],
    ready_for_delivery: order.delivery_type === 'pickup' ? ['picked_up', 'cancelled'] : ['cancelled'],
  };
  if (!(allowedTransitions[order.status] || []).includes(nextStatus)) {
    const error = new Error(`Cannot change order from ${order.status} to ${nextStatus}`);
    error.statusCode = 409;
    throw error;
  }

  if (order.status === 'scheduled' && nextStatus === 'preparing') {
    const [[items]] = await connection.query(
      `SELECT COUNT(*) AS pending_count
       FROM order_items
       WHERE order_id = ? AND status = 'pending'`,
      [order.id],
    );
    if (Number(items.pending_count) > 0) {
      const error = new Error('Review all pending order items before preparing this scheduled order.');
      error.statusCode = 409;
      throw error;
    }
  }

  if (nextStatus === 'cancelled') {
    const [lines] = await connection.query(
      'SELECT id, item_id, quantity, status FROM order_items WHERE order_id = ? FOR UPDATE',
      [order.id],
    );
    for (const line of lines) {
      if (['approved', 'completed'].includes(line.status)) {
        await connection.query('UPDATE menu_items SET stock_quantity = stock_quantity + ? WHERE id = ?', [
          line.quantity,
          line.item_id,
        ]);
      }
    }
    await connection.query(
      `UPDATE order_items SET status = 'rejected'
       WHERE order_id = ? AND status != 'rejected'`,
      [order.id],
    );
  }
  if (order.order_type === 'scheduled' && order.delivery_type === 'pickup' && nextStatus === 'picked_up') {
    await writeOrderStatus(connection, order.id, 'picked_up', user.id);
    await writeOrderStatus(connection, order.id, 'completed', user.id);
    return 'completed';
  }
  await writeOrderStatus(connection, order.id, nextStatus, user.id);
  return nextStatus;
}

app.get('/api/health', (req, res) => {
  res.json({ message: 'HIGHER LEVEL Restaurant & Takeaway Uganda API is running' });
});

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = 'customer';

    const [result] = await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
      name,
      email,
      passwordHash,
      userRole,
    ]);
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
    await ensureDefaultMenuSeeded();
    const [rows] = await pool.query(
      `SELECT mi.*, COALESCE(review_summary.average_rating, 0) AS average_rating,
         COALESCE(review_summary.review_count, 0) AS review_count
       FROM menu_items mi
       LEFT JOIN (
         SELECT menu_item_id, ROUND(AVG(rating), 1) AS average_rating, COUNT(*) AS review_count
         FROM food_reviews
         GROUP BY menu_item_id
       ) review_summary ON review_summary.menu_item_id = mi.id
       WHERE mi.is_active = 1
       ORDER BY mi.category, mi.title, mi.id`,
    );
    res.json(getDefaultMenuRows(rows));
  } catch (err) {
    console.error('MENU ERROR:', err.message);
    res.status(500).json({ error: 'Could not load the food menu: ' + err.message });
  }
});

app.post('/food-reviews', requireAuth, requireRole('customer'), async (req, res) => {
  const menuItemId = Number(req.body.menu_item_id);
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  if (!Number.isSafeInteger(menuItemId) || menuItemId < 1) {
    return res.status(400).json({ error: 'Select a valid menu item to review.' });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars.' });
  }
  if (comment.length > 2000) {
    return res.status(400).json({ error: 'Review comments must be 2,000 characters or fewer.' });
  }

  try {
    const [[purchase]] = await pool.query(
      `SELECT oi.id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND oi.item_id = ?
         AND oi.status IN ('approved', 'completed')
         AND (
           (o.delivery_type = 'delivery' AND o.status = 'delivered')
           OR (
             o.delivery_type = 'pickup'
             AND (
               o.status = 'picked_up'
               OR (
                 o.status = 'completed'
                 AND EXISTS (
                   SELECT 1 FROM order_status_history osh
                   WHERE osh.order_id = o.id AND osh.status = 'picked_up'
                 )
               )
             )
           )
         )
       LIMIT 1`,
      [req.user.id, menuItemId],
    );
    if (!purchase) {
      return res.status(403).json({ error: 'You can review a meal after it has been purchased and fulfilled.' });
    }

    const [result] = await pool.query(
      `INSERT INTO food_reviews (user_id, menu_item_id, rating, comment)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, menuItemId, rating, comment || null],
    );
    res.status(201).json({ id: result.insertId, menu_item_id: menuItemId, rating, comment: comment || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You have already reviewed this menu item.' });
    }
    console.error('FOOD REVIEW ERROR:', err.message);
    res.status(500).json({ error: 'Could not save your review: ' + err.message });
  }
});

app.post('/order', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body;
  const deliveryType = String(req.body.delivery_type || 'pickup').trim();
  const orderType = String(req.body.order_type || 'instant').trim();
  const deliveryAddress = String(req.body.delivery_address || '').trim();
  const contactPhone = String(req.body.contact_phone || '').trim();
  if (!['instant', 'scheduled'].includes(orderType)) {
    return res.status(400).json({ error: 'Select Order Now or Schedule Order.' });
  }
  const scheduledFor = orderType === 'scheduled'
    ? getScheduledOrderTimestamp(req.body.scheduled_for)
    : null;
  if (orderType === 'scheduled' && !scheduledFor) {
    return res.status(400).json({ error: 'Select a valid future date and time for your scheduled order.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one order item is required.' });
  }
  if (!['pickup', 'delivery'].includes(deliveryType)) {
    return res.status(400).json({ error: 'Select pickup or delivery.' });
  }
  if (
    deliveryType === 'delivery' &&
    (!deliveryAddress || deliveryAddress.length > 255 || !/^[+0-9()\-\s]{7,20}$/.test(contactPhone) ||
      contactPhone.replace(/\D/g, '').length < 7)
  ) {
    return res.status(400).json({ error: 'Delivery orders require a valid address and contact phone number.' });
  }

  const quantities = new Map();
  for (const line of items) {
    const itemId = Number(line.itemId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(itemId) || itemId < 1 || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Each order item requires a valid item ID and positive quantity.' });
    }
    quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
  }
  const orderLines = [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (scheduledFor) {
      const [[scheduleCheck]] = await connection.query(
        'SELECT CAST(? AS DATETIME) > UTC_TIMESTAMP() AS is_future',
        [scheduledFor.sql],
      );
      if (!Number(scheduleCheck.is_future)) {
        const error = new Error('Select a future date and time for your scheduled order.');
        error.statusCode = 400;
        throw error;
      }
    }

    let total = 0;

    for (const line of orderLines) {
      const [rows] = await connection.query(
        'SELECT price, stock_quantity FROM menu_items WHERE id = ? AND is_active = 1 FOR UPDATE',
        [line.itemId],
      );
      if (rows.length === 0) {
        const error = new Error('Item not found: ' + line.itemId);
        error.statusCode = 404;
        throw error;
      }
      const item = rows[0];
      const lineTotal = Number(item.price) * line.quantity;
      line.price = Number(item.price);
      line.status = Number(item.stock_quantity) >= line.quantity ? 'approved' : 'pending';
      total += lineTotal;
    }

    const status = orderType === 'scheduled'
      ? 'scheduled'
      : (orderLines.some((line) => line.status === 'pending') ? 'pending' : 'approved');
    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (user_id, status, total_amount, delivery_type, delivery_address, contact_phone, order_type, scheduled_for)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        status,
        total,
        deliveryType,
        deliveryType === 'delivery' ? deliveryAddress : null,
        deliveryType === 'delivery' ? contactPhone : null,
        orderType,
        scheduledFor ? scheduledFor.sql : null,
      ],
    );
    const orderId = orderResult.insertId;
    await connection.query(
      'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
      [orderId, status, userId],
    );

    for (const line of orderLines) {
      await connection.query(
        `INSERT INTO order_items
         (order_id, item_id, quantity, price, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          line.itemId,
          line.quantity,
          line.price,
          line.status,
        ],
      );
      if (line.status === 'approved') {
        await connection.query('UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?', [
          line.quantity,
          line.itemId,
        ]);
        const [menuItems] = await connection.query('SELECT title FROM menu_items WHERE id = ?', [line.itemId]);
        await notifyLowStock(
          connection,
          line.itemId,
          menuItems[0].title,
          line.stock_quantity,
          Number(line.stock_quantity) - Number(line.quantity),
        );
      }
    }

    await refreshOrderStatus(connection, orderId);
    await notifyUser(connection, userId, {
      type: 'order_received',
      title: 'Order received',
      message: `We received your order #${orderId}.`,
      entityType: 'order',
      entityId: orderId,
      dedupeKey: `order-${orderId}-received`,
    });
    await notifyRoles(connection, ['admin', 'staff'], {
      type: 'new_order',
      title: 'New order arrives',
      message: `A new order (#${orderId}) has been placed.`,
      entityType: 'order',
      entityId: orderId,
      dedupeKey: `new-order-${orderId}`,
    });
    if (status === 'approved') await notifyOrderStatus(connection, orderId, status);
    await connection.commit();
    res.status(201).json({
      orderId,
      total,
      status,
      order_type: orderType,
      scheduled_for: scheduledFor ? scheduledFor.date.toISOString() : null,
    });
  } catch (err) {
    await connection.rollback();
    console.error('ORDER ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/orders/:userId', requireAuth, async (req, res) => {
  if (Number(req.params.userId) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'You can only view your own orders' });
  }
  try {
    const [orders] = await pool.query(
      `SELECT o.*, DATE_FORMAT(o.scheduled_for, '%Y-%m-%dT%H:%i:%sZ') AS scheduled_for_utc
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.params.userId],
    );
    const attachedOrders = await attachOrderItems(orders);
    const [reviews] = await pool.query(
      'SELECT menu_item_id, rating, comment FROM food_reviews WHERE user_id = ?',
      [req.user.id],
    );
    const reviewByItem = new Map(reviews.map((review) => [Number(review.menu_item_id), review]));
    for (const order of attachedOrders) {
      for (const item of order.items) {
        item.review = reviewByItem.get(Number(item.item_id)) || null;
      }
    }
    res.json(await attachDeliveryProgress(attachedOrders));
  } catch (err) {
    console.error('ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load orders: ' + err.message });
  }
});

app.get('/staff/orders', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, DATE_FORMAT(o.scheduled_for, '%Y-%m-%dT%H:%i:%sZ') AS scheduled_for_utc,
         u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY (o.status = 'pending') DESC, o.created_at DESC`,
    );
    res.json(await attachDeliveryProgress(await attachOrderItems(orders)));
  } catch (err) {
    console.error('STAFF ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load staff orders: ' + err.message });
  }
});

app.get('/catering-requests', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT id, event_type, event_date, guest_count, venue, phone_number, budget,
         special_requests, status, created_at, updated_at
       FROM catering_requests
       WHERE customer_id = ?
       ORDER BY created_at DESC, id DESC`,
      [req.user.id],
    );
    res.json(requests);
  } catch (err) {
    console.error('CUSTOMER CATERING REQUESTS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load catering requests: ' + err.message });
  }
});

app.post('/catering-requests', requireAuth, requireRole('customer'), async (req, res) => {
  const validation = validateCateringRequest(req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const request = validation.value;
    const [result] = await pool.query(
      `INSERT INTO catering_requests
        (customer_id, event_type, event_date, guest_count, venue, phone_number, budget, special_requests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        request.event_type,
        request.event_date,
        request.guest_count,
        request.venue,
        request.phone_number,
        request.budget,
        request.special_requests,
      ],
    );
    await notifyRoles(pool, ['admin', 'staff'], {
      type: 'new_catering_request',
      title: 'New catering request',
      message: 'A customer submitted a catering request for review.',
      entityType: 'catering_request',
      entityId: result.insertId,
      dedupeKey: `catering-request-${result.insertId}`,
    });
    res.status(201).json({
      message: 'Catering request submitted for review.',
      request: { id: result.insertId, ...request, status: 'pending' },
    });
  } catch (err) {
    console.error('CREATE CATERING REQUEST ERROR:', err.message);
    res.status(500).json({ error: 'Could not submit the catering request: ' + err.message });
  }
});

app.get('/admin/catering-requests', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT cr.*, customer.name AS customer_name, customer.email AS customer_email
       FROM catering_requests cr
       LEFT JOIN users customer ON customer.id = cr.customer_id
       ORDER BY (cr.status = 'pending') DESC, cr.event_date ASC, cr.created_at DESC`,
    );
    res.json(requests);
  } catch (err) {
    console.error('ADMIN CATERING REQUESTS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load catering requests: ' + err.message });
  }
});

app.put('/admin/catering-requests/:id/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const requestId = Number(req.params.id);
  const status = String(req.body?.status || '').trim();
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: 'A valid catering request ID is required.' });
  }
  const transitions = {
    pending: ['approved', 'rejected'],
    approved: ['completed'],
  };
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Select a valid catering request status.' });
  }

  try {
    const [[request]] = await pool.query('SELECT status FROM catering_requests WHERE id = ?', [requestId]);
    if (!request) return res.status(404).json({ error: 'Catering request not found.' });
    if (!(transitions[request.status] || []).includes(status)) {
      return res.status(409).json({ error: `A ${request.status} request cannot be changed to ${status}.` });
    }

    const [result] = await pool.query(
      `UPDATE catering_requests
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = ?`,
      [status, requestId, request.status],
    );
    if (result.affectedRows !== 1) {
      return res.status(409).json({ error: 'The catering request changed before this update. Refresh and try again.' });
    }
    res.json({ message: `Catering request ${status}.`, id: requestId, status });
  } catch (err) {
    console.error('UPDATE CATERING REQUEST ERROR:', err.message);
    res.status(500).json({ error: 'Could not update the catering request: ' + err.message });
  }
});

app.get('/admin/dashboard', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [[sales]] = await pool.query(
      `SELECT COUNT(DISTINCT order_id) AS total_orders,
         COUNT(DISTINCT CASE WHEN status = 'pending' THEN order_id END) AS pending_orders,
         COUNT(DISTINCT CASE WHEN status IN ('approved', 'completed') THEN order_id END) AS approved_orders,
         COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN price * quantity ELSE 0 END), 0) AS total_sales
       FROM order_items`,
    );
    const [[listings]] = await pool.query(
      `SELECT COUNT(*) AS total_dishes,
         COALESCE(SUM(stock_quantity > 0), 0) AS available_dishes
       FROM menu_items WHERE is_active = 1`,
    );
    const [[deliveries]] = await pool.query(
      `SELECT COUNT(*) AS delivery_orders,
         COALESCE(SUM(status IN ('pending', 'approved', 'preparing', 'ready_for_delivery', 'assigned',
           'picked_up', 'out_for_delivery')), 0) AS active_deliveries,
         COALESCE(SUM(status = 'ready_for_delivery' AND id NOT IN
           (SELECT order_id FROM deliveries WHERE rider_id IS NOT NULL)), 0) AS unassigned_deliveries
       FROM orders WHERE delivery_type = 'delivery'`,
    );
    const [[catering]] = await pool.query(
      `SELECT COUNT(*) AS catering_total_requests,
         COALESCE(SUM(status = 'pending'), 0) AS catering_pending_requests,
         COALESCE(SUM(status = 'approved'), 0) AS catering_approved_requests,
         COALESCE(SUM(status = 'completed'), 0) AS catering_completed_requests
       FROM catering_requests`,
    );
    const [[scheduled]] = await pool.query(
      `SELECT
         COUNT(CASE
           WHEN scheduled_for >= UTC_TIMESTAMP()
             AND status NOT IN ('cancelled', 'rejected', 'delivered', 'completed')
           THEN 1
         END) AS upcoming_scheduled_orders,
         COALESCE(SUM(
           DATE(DATE_ADD(scheduled_for, INTERVAL 3 HOUR)) =
           DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 HOUR))
           AND status NOT IN ('cancelled', 'rejected')
         ), 0) AS scheduled_orders_today,
         COALESCE(SUM(
           YEARWEEK(DATE_ADD(scheduled_for, INTERVAL 3 HOUR), 1) =
           YEARWEEK(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 3 HOUR), 1)
           AND status NOT IN ('cancelled', 'rejected')
         ), 0) AS scheduled_orders_this_week
       FROM orders
       WHERE order_type = 'scheduled'`,
    );
    const [recentOrders] = await pool.query(
      `SELECT o.*, DATE_FORMAT(o.scheduled_for, '%Y-%m-%dT%H:%i:%sZ') AS scheduled_for_utc,
         u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 8`,
    );
    res.json({
      summary: { ...sales, ...listings, ...deliveries, ...catering, ...scheduled },
      recentOrders: await attachDeliveryProgress(await attachOrderItems(recentOrders)),
    });
  } catch (err) {
    console.error('ADMIN DASHBOARD ERROR:', err.message);
    res.status(500).json({ error: 'Could not load dashboard: ' + err.message });
  }
});

app.get('/admin/deliveries', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, customer.name AS customer_name, customer.email AS customer_email,
         d.id AS delivery_id, d.delivery_status, d.rider_id, d.assigned_at, d.picked_up_at,
         d.out_for_delivery_at, d.delivered_at, d.notes,
         rider.rider_name, rider.rider_phone, rider.status AS rider_availability
       FROM orders o
       JOIN users customer ON customer.id = o.user_id
       LEFT JOIN deliveries d ON d.id = (
         SELECT MAX(latest.id) FROM deliveries latest WHERE latest.order_id = o.id
       )
       LEFT JOIN delivery_riders rider ON rider.id = d.rider_id
       WHERE o.delivery_type = 'delivery'
       ORDER BY o.created_at DESC`,
    );
    res.json(await attachDeliveryProgress(await attachOrderItems(orders)));
  } catch (err) {
    console.error('ADMIN DELIVERIES ERROR:', err.message);
    res.status(500).json({ error: 'Could not load deliveries: ' + err.message });
  }
});

app.get('/admin/riders', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    await syncRiderProfiles();
    const [riders] = await pool.query(
      `SELECT rider.id, u.name AS rider_name, u.email AS rider_email,
         rider.rider_phone, rider.status, rider.user_id
       FROM delivery_riders rider
       JOIN users u ON u.id = rider.user_id
       WHERE u.role = 'rider'
       ORDER BY u.name`,
    );
    res.json(riders);
  } catch (err) {
    console.error('ADMIN RIDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load riders: ' + err.message });
  }
});

app.get('/rider/available-deliveries', requireAuth, requireRole('rider'), async (req, res) => {
  try {
    await syncRiderProfile(pool, req.user.id);
    const [riders] = await pool.query(
      `SELECT rider.id, rider.status
       FROM delivery_riders rider
       JOIN users u ON u.id = rider.user_id
       WHERE rider.user_id = ? AND u.role = 'rider'`,
      [req.user.id],
    );
    if (!riders.length) {
      return res.status(403).json({ error: 'Rider access is not active for this account.' });
    }
    if (await syncRiderAvailability(pool, riders[0].id) !== 'available') return res.json([]);
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.total_amount, o.delivery_type,
         o.delivery_address, o.contact_phone, o.created_at,
         customer.name AS customer_name
       FROM orders o
       JOIN users customer ON customer.id = o.user_id
       WHERE o.delivery_type = 'delivery'
         AND o.status = 'ready_for_delivery'
         AND NOT EXISTS (
           SELECT 1 FROM deliveries d
           WHERE d.order_id = o.id
             AND d.delivery_status IN ('assigned', 'picked_up', 'out_for_delivery')
         )
       ORDER BY o.created_at`,
    );
    res.json(await attachRiderOrderItems(orders));
  } catch (err) {
    console.error('AVAILABLE DELIVERIES ERROR:', err.message);
    res.status(500).json({ error: 'Could not load available deliveries: ' + err.message });
  }
});

app.post('/rider/deliveries/:orderId/accept', requireAuth, requireRole('rider'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Locking the order serializes claims so only one rider can accept it.
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.orderId],
    );
    if (!orders.length) {
      const error = new Error('Delivery order not found');
      error.statusCode = 404;
      throw error;
    }
    const order = orders[0];
    if (order.delivery_type !== 'delivery' || order.status !== 'ready_for_delivery') {
      const error = new Error('This delivery is no longer available');
      error.statusCode = 409;
      throw error;
    }

    await syncRiderProfile(connection, req.user.id);
    const [riders] = await connection.query(
      `SELECT rider.id, rider.status
       FROM delivery_riders rider
       JOIN users u ON u.id = rider.user_id
       WHERE rider.user_id = ? AND u.role = 'rider'
       FOR UPDATE`,
      [req.user.id],
    );
    if (!riders.length) {
      const error = new Error('Rider access is not active for this account.');
      error.statusCode = 403;
      throw error;
    }
    if (await syncRiderAvailability(connection, riders[0].id) !== 'available') {
      const error = new Error('You are already assigned to an active delivery');
      error.statusCode = 409;
      throw error;
    }

    const [activeDeliveries] = await connection.query(
      `SELECT id FROM deliveries
       WHERE order_id = ? AND delivery_status IN ('assigned', 'picked_up', 'out_for_delivery')
       LIMIT 1 FOR UPDATE`,
      [order.id],
    );
    if (activeDeliveries.length) {
      const error = new Error('This delivery has already been accepted');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await connection.query(
      `INSERT INTO deliveries (order_id, rider_id, delivery_status, assigned_at)
       VALUES (?, ?, 'assigned', CURRENT_TIMESTAMP)`,
      [order.id, riders[0].id],
    );
    await writeOrderStatus(connection, order.id, 'assigned', req.user.id);
    await notifyUser(connection, req.user.id, {
      type: 'delivery_assigned',
      title: 'Delivery assigned',
      message: `You accepted delivery for order #${order.id}.`,
      entityType: 'order',
      entityId: order.id,
      dedupeKey: `delivery-assigned-${result.insertId}`,
    });
    await syncRiderAvailability(connection, riders[0].id);
    await connection.commit();
    res.status(201).json({
      order_id: order.id,
      delivery_id: result.insertId,
      status: 'assigned',
    });
  } catch (err) {
    await connection.rollback();
    console.error('ACCEPT DELIVERY ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.put('/admin/deliveries/:deliveryId/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!['picked_up', 'out_for_delivery', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Choose picked_up, out_for_delivery, or delivered' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [deliveries] = await connection.query('SELECT * FROM deliveries WHERE id = ? FOR UPDATE', [
      req.params.deliveryId,
    ]);
    if (!deliveries.length) {
      const error = new Error('Delivery not found');
      error.statusCode = 404;
      throw error;
    }
    await advanceDelivery(connection, deliveries[0], status, req.user.id);
    await connection.commit();
    res.json({ delivery_id: req.params.deliveryId, status });
  } catch (err) {
    await connection.rollback();
    console.error('ADMIN DELIVERY UPDATE ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/rider/deliveries', requireAuth, requireRole('rider'), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.total_amount, o.delivery_address, o.contact_phone,
         o.created_at, customer.name AS customer_name
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN delivery_riders rider ON rider.id = d.rider_id
       JOIN users customer ON customer.id = o.user_id
       WHERE rider.user_id = ?
       ORDER BY (d.delivery_status = 'delivered') ASC, d.assigned_at DESC`,
      [req.user.id],
    );
    res.json(await attachDeliveryProgress(await attachRiderOrderItems(orders)));
  } catch (err) {
    console.error('RIDER DELIVERIES ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your deliveries: ' + err.message });
  }
});

app.put('/rider/deliveries/:deliveryId/status', requireAuth, requireRole('rider'), async (req, res) => {
  const { status } = req.body;
  if (!['picked_up', 'out_for_delivery', 'delivered'].includes(status)) {
    return res.status(400).json({ error: 'Choose picked_up, out_for_delivery, or delivered' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [deliveries] = await connection.query(
      `SELECT d.*, o.id AS order_id, o.status AS order_status, rider.id AS rider_profile_id
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN delivery_riders rider ON rider.id = d.rider_id
       WHERE d.id = ? AND rider.user_id = ? FOR UPDATE`,
      [req.params.deliveryId, req.user.id],
    );
    if (!deliveries.length) {
      const error = new Error('Delivery not found or not assigned to you');
      error.statusCode = 404;
      throw error;
    }
    const delivery = deliveries[0];
    await advanceDelivery(connection, delivery, status, req.user.id);
    await connection.commit();
    res.json({ delivery_id: delivery.id, order_id: delivery.order_id, status });
  } catch (err) {
    await connection.rollback();
    console.error('RIDER UPDATE ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.get('/orders/:orderId/delivery-history', requireAuth, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT id, user_id FROM orders WHERE id = ?', [req.params.orderId]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];
    if (req.user.role === 'customer' && Number(order.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only view your own delivery history' });
    }
    if (req.user.role === 'rider') {
      const [assigned] = await pool.query(
        `SELECT d.id FROM deliveries d
         JOIN delivery_riders rider ON rider.id = d.rider_id
         WHERE d.order_id = ? AND rider.user_id = ? LIMIT 1`,
        [order.id, req.user.id],
      );
      if (!assigned.length) return res.status(403).json({ error: 'This delivery is not assigned to you' });
    } else if (!['customer', 'admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this delivery history' });
    }
    const [history] = await pool.query(
      `SELECT history.status, history.changed_at, u.name AS changed_by
       FROM order_status_history history
       LEFT JOIN users u ON u.id = history.changed_by
       WHERE history.order_id = ? ORDER BY history.changed_at, history.id`,
      [order.id],
    );
    res.json(history);
  } catch (err) {
    console.error('DELIVERY HISTORY ERROR:', err.message);
    res.status(500).json({ error: 'Could not load delivery history: ' + err.message });
  }
});

app.get('/inventory', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    await ensureDefaultMenuSeeded();
    const [rows] = await pool.query('SELECT mi.* FROM menu_items mi WHERE mi.is_active = 1 ORDER BY mi.id');
    res.json(getDefaultMenuRows(rows));
  } catch (err) {
    console.error('INVENTORY ERROR:', err.message);
    res.status(500).json({ error: 'Could not load inventory: ' + err.message });
  }
});

app.put('/inventory/:id', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const { stock_quantity } = req.body;
    const quantity = Number(stock_quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'Stock quantity must be a non-negative whole number' });
    }
    const [[item]] = await pool.query(
      'SELECT title, stock_quantity FROM menu_items WHERE id = ? AND is_active = 1',
      [req.params.id],
    );
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    const [result] = await pool.query('UPDATE menu_items SET stock_quantity = ? WHERE id = ? AND is_active = 1', [
      quantity,
      req.params.id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Menu item not found' });
    await notifyLowStock(pool, req.params.id, item.title, item.stock_quantity, quantity);
    res.json({ id: req.params.id, stock_quantity: quantity });
  } catch (err) {
    console.error('UPDATE STOCK ERROR:', err.message);
    res.status(500).json({ error: 'Could not update stock: ' + err.message });
  }
});

app.put('/staff/order-items/:lineId/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected or completed' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await setOrderLineStatus(connection, req.params.lineId, status, req.user.id);
    await connection.commit();
    res.json(result);
  } catch (err) {
    await connection.rollback();
    console.error('UPDATE ORDER ITEM ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.put('/orders/:id/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed', 'preparing', 'ready_for_delivery', 'picked_up', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Select a supported order status.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    if (['approved', 'preparing', 'ready_for_delivery', 'picked_up', 'cancelled'].includes(status)) {
      const orderStatus = await updateOrderLifecycle(connection, orders[0], status, req.user);
      await connection.commit();
      return res.json({ id: req.params.id, status: orderStatus });
    }
    const [lines] = await connection.query(
      'SELECT id, status FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE',
      [req.params.id],
    );
    const actionableStatus = status === 'completed' ? 'approved' : 'pending';
    for (const line of lines.filter((orderLine) => orderLine.status === actionableStatus)) {
      await setOrderLineStatus(connection, line.id, status, req.user.id);
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

app.use(express.static(path.join(__dirname, '..', 'yummy-web')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});

let scheduledOrderJobRunning = false;
setInterval(async () => {
  if (scheduledOrderJobRunning) return;
  scheduledOrderJobRunning = true;
  try {
    await notifyApproachingScheduledOrders(pool);
  } catch (error) {
    console.error('SCHEDULED ORDER NOTIFICATION JOB ERROR:', error.message);
  } finally {
    scheduledOrderJobRunning = false;
  }
}, 60 * 1000);
