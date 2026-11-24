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
  port: Number(process.env.DB_PORT || 3306),
};
const PORT = Number(process.env.PORT || 3107);

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool(DB_CONFIG);
const sessions = new Map();
const defaultMenuSeedName = 'ugandan-dishes';
const defaultMenuSeedVersion = 4;
const defaultMenuDishes = [
  {
    title: 'Boiled Cassava & Beef-Pea Stew',
    category: 'Traditional',
    price: 13000,
    description:
      'Tender boiled cassava (muwogo) served with savory beef and green pea stew, sautéed greens, sliced avocado, and fresh tomatoes.',
    ingredients: [
      '2 cassava roots (muwogo)',
      '250g beef',
      '1/2 cup green peas (obukooli)',
      'doodo greens',
      '1/2 avocado',
      '1 tomato',
      'onion',
      'salt',
      'cooking oil',
    ],
    preparationSteps:
      'Peel cassava, remove the tough inner core, cut into strips, and boil in salted water until soft. Boil diced beef until tender, then simmer in a fried onion-tomato gravy with green peas. Serve with sautéed greens, avocado, and fresh tomato slices.',
    imageUrl: './images/Boiled Cassava & Beef-Pea Stew.jpeg',
  },
  {
    title: 'Flaky Ugandan Chapati',
    category: 'Street Food',
    price: 3000,
    description: 'Golden, multi-layered pan-fried Ugandan flatbread with a crisp outer layer and soft, flaky inside.',
    ingredients: ['2 cups wheat flour', '3/4 cup warm water', '3 tbsp cooking oil', '1/2 tsp salt'],
    preparationSteps:
      'Mix wheat flour, salt, warm water, and 1 tbsp oil into a soft dough and rest for 20 minutes. Roll thin, brush with oil, coil into a spiral, roll flat again, and fry on a hot pan with a little oil until golden brown on both sides.',
    imageUrl: './images/Chapati.jpeg',
  },
  {
    title: 'Kalo, Cassava & Beef Stew',
    category: 'Traditional',
    price: 14000,
    description:
      'Traditional millet bread (kalo) served in a woven basket alongside boiled cassava, steamed greens, and rich beef stew.',
    ingredients: [
      '1 cup millet flour',
      '1/4 cup cassava flour',
      '1 cassava root',
      '250g beef',
      'doodo greens',
      '2 tomatoes',
      '1 carrot',
      '1 onion',
      'salt',
      'oil',
    ],
    preparationSteps:
      'Stir millet and cassava flour into boiling water with a wooden mingling stick until smooth and firm, then cover briefly to steam. Serve in a woven basket with boiled cassava, steamed greens, and slow-simmered beef-carrot stew.',
    imageUrl: './images/Kalo,Cassava&Beaf Stew.jpeg',
  },
  {
    title: 'Chicken Luwombo with Matooke & Sweet Potato',
    category: 'Traditional',
    price: 22000,
    description:
      'Smoky chicken steamed in banana leaves, served with mashed matooke, steamed sweet potatoes, greens, and peas.',
    ingredients: [
      '2 chicken pieces',
      'banana leaves (endagala)',
      '4 green bananas (matooke)',
      '1 sweet potato (lumonde)',
      '1/2 cup green peas',
      'greens',
      'tomatoes',
      'onion',
      'salt',
    ],
    preparationSteps:
      'Lightly roast seasoned chicken for smoky flavor. Place on softened banana leaves with sautéed onions, tomatoes, and a little broth, tie into a bundle, and steam for 1 to 1.5 hours until tender. Serve with mashed matooke, steamed sweet potatoes, greens, and peas.',
    imageUrl: './images/Luwombo Lwenkoko with Matooke and Sweet Potatoes.jpeg',
  },
  {
    title: 'Beef Luwombo with Matooke, Lumonde & Pumpkin',
    category: 'Traditional',
    price: 20000,
    description:
      'Beef steamed in banana leaves served with mashed matooke, sweet potatoes, pumpkin, rice, greens, peas, and avocado.',
    ingredients: [
      '250g beef',
      'banana leaves',
      '3 green bananas',
      '1 sweet potato',
      '2 pumpkin slices (ensujju)',
      '1/2 cup rice',
      'peas',
      'greens',
      'avocado',
      'tomatoes',
      'onion',
    ],
    preparationSteps:
      'Sear seasoned beef and wrap in softened banana leaves with onions, tomatoes, and broth; steam for 1.5 to 2 hours until tender. Steam matooke, sweet potatoes, and pumpkin wedges until soft, and serve with rice, greens, peas, and avocado.',
    imageUrl: './images/luwombo lwenyama with Matooke,Lumonde & Pumpkin.jpeg',
  },
  {
    title: 'Matooke Katogo with Beef & Butula',
    category: 'Breakfast',
    price: 10000,
    description: 'Hearty one-pot matooke simmered in a rich beef and green pea gravy with a side of greens.',
    ingredients: [
      '5 green bananas (matooke)',
      '200g beef',
      '1/2 cup green peas',
      '2 tomatoes',
      '1 onion',
      'carrot',
      'greens',
      'salt',
      'cooking oil',
    ],
    preparationSteps:
      'Boil beef pieces until tender. Sauté onions, tomatoes, and carrots in oil, then add the beef, green peas, peeled whole green bananas, and broth. Cover and simmer on medium-low heat until the matooke is soft and the sauce thickens.',
    imageUrl: './images/Matooke Katogo with Beef and Butula.jpeg',
  },
  {
    title: 'Matooke Katogo with Tilapia Fish',
    category: 'Traditional',
    price: 17000,
    description:
      'Whole peeled green bananas simmered with tilapia fish and peas, topped with greens and sliced avocado.',
    ingredients: [
      '5 green bananas (matooke)',
      '1/2 tilapia fish',
      '1/2 cup peas/beans',
      'greens',
      '1/2 avocado',
      '2 tomatoes',
      'carrot',
      'onion',
      'salt',
      'oil',
    ],
    preparationSteps:
      'Lightly fry seasoned tilapia pieces. Sauté onions, tomatoes, and carrots, add peeled whole matooke, peas, and broth, then place the fish gently on top and simmer covered until the matooke is tender and the gravy is rich.',
    imageUrl: './images/Matooke Katogo with Tilapia fish.jpeg',
  },
  {
    title: 'Matooke, Mayuni & Byenda',
    category: 'Traditional',
    price: 13000,
    description:
      'Tender beef tripe stew served with steamed mashed matooke, steamed cocoyam (mayuni), green peas, and greens.',
    ingredients: [
      '300g beef tripe (byenda)',
      '4 green bananas',
      '3 slices cocoyam (mayuni)',
      '1/2 cup green peas',
      'greens',
      'tomatoes',
      'onion',
      'garlic',
      'ginger',
    ],
    preparationSteps:
      'Clean and boil tripe with garlic, ginger, and salt until tender, then simmer in a fried onion-tomato sauce. Steam matooke and cocoyam slices until tender, mash the matooke, and serve with boiled peas and sautéed greens.',
    imageUrl: './images/Matooke,Mayuni & Byenda.jpeg',
  },
  {
    title: 'Matooke, Rice & Byenda',
    category: 'Traditional',
    price: 12000,
    description: 'Steamed mashed matooke and fluffy white rice served with rich beef tripe stew.',
    ingredients: [
      '300g beef tripe (byenda)',
      '4 green bananas',
      '1 cup rice',
      '2 tomatoes',
      '1 onion',
      'carrot',
      'green pepper',
      'garlic',
      'ginger',
      'salt',
    ],
    preparationSteps:
      'Boil cleaned tripe with ginger and garlic until tender. Sauté onions, tomatoes, carrots, and green pepper, add the tripe and broth, and simmer until thick. Serve with steamed mashed matooke and boiled rice.',
    imageUrl: './images/Matooke,Rice&Byenda.jpeg',
  },
  {
    title: 'Matooke, Mayuni & Fish Stew',
    category: 'Traditional',
    price: 18000,
    description:
      'Steamed mashed matooke and cocoyam (mayuni) paired with tilapia fish stew, peas, greens, and avocado.',
    ingredients: [
      '1/2 tilapia fish',
      '4 green bananas',
      '2 slices cocoyam (mayuni)',
      '1/2 cup green peas',
      'greens',
      '1/2 avocado',
      'tomatoes',
      'carrot',
      'onion',
    ],
    preparationSteps:
      'Wrap peeled matooke and cocoyam in banana leaves and steam until tender, mashing the matooke. Lightly fry seasoned tilapia and simmer in a tomato-carrot gravy. Serve with peas, greens, and sliced avocado.',
    imageUrl: './images/MatookeMayuuni and Fish Stew.jpeg',
  },
  {
    title: 'Posho & Tilapia Fish Stew with Greens',
    category: 'Mains',
    price: 16000,
    description: 'Tilapia fish simmered in a rich vegetable gravy, served with firm posho and sautéed greens.',
    ingredients: [
      '1/2 tilapia fish',
      '1.5 cups maize flour',
      'greens',
      '2 tomatoes',
      '1 carrot',
      'green pepper',
      'onion',
      'salt',
      'cooking oil',
    ],
    preparationSteps:
      'Lightly fry seasoned tilapia pieces, then simmer in a fried onion, tomato, carrot, and green pepper gravy. Stir maize flour into boiling water until firm and smooth, then serve hot with sautéed greens.',
    imageUrl: './images/Posho& Tilapia Fish Stew with Greens.jpeg',
  },
  {
    title: 'Posho, Beans & Okra Stew with Doodo',
    category: 'Lunch',
    price: 7000,
    description: 'Firm posho served with spiced beans and okra stew alongside fresh sautéed doodo greens.',
    ingredients: [
      '1.5 cups maize flour',
      '1 cup beans',
      '4 okra pods',
      '1 bunch doodo greens',
      '2 tomatoes',
      '1 onion',
      'salt',
      'cooking oil',
    ],
    preparationSteps:
      'Boil beans until soft, then simmer with fried onions, tomatoes, and sliced okra until thick. Stir maize flour into boiling water until firm and smooth, and serve with quick-sautéed doodo greens.',
    imageUrl: './images/Posho,Beans & Okra Stew with Doodo.jpeg',
  },
  {
    title: 'Steamed Rice, Fish Stew & Fresh Fruit Juice',
    category: 'Mains',
    price: 19000,
    description:
      'Whole tilapia in vegetable gravy served with steamed white rice, greens, and a glass of fresh fruit juice.',
    ingredients: [
      '1 tilapia fish',
      '1 cup rice',
      'greens',
      '2 tomatoes',
      '1 carrot',
      'onion',
      'fresh fruit for juice',
      'sugar',
      'water',
      'salt',
      'oil',
    ],
    preparationSteps:
      'Fry and simmer whole scored tilapia in a spiced tomato-carrot sauce. Steam rinsed rice until fluffy, sauté greens, and blend fresh ripe fruit with water and a touch of sugar, straining before serving chilled.',
    imageUrl: './images/Steamed Ric,Fish Stew & Fresh Fruit Juice.jpeg',
  },
  {
    title: 'Whole Fried Tilapia and Chips',
    category: 'Mains',
    price: 25000,
    description:
      'Crispy deep-fried whole tilapia served with golden chips, stir-fried vegetables, and fresh lime slices.',
    ingredients: [
      '1 whole tilapia',
      '3 Irish potatoes',
      '1 carrot',
      '1 onion',
      'green pepper',
      '1 lime',
      'garlic',
      'ginger',
      'salt',
      'cooking oil',
    ],
    preparationSteps:
      'Clean and score the whole tilapia, rub with salt, garlic, ginger, and lime juice, and deep-fry until crispy and golden. Cut potatoes into strips and fry until golden. Serve with lightly stir-fried veggies and lime wedges.',
    imageUrl: './images/Whole Fried Tilapia and Chips.jpeg',
  },
];

function getDefaultMenuRows(rows) {
  const allowedTitles = new Set(defaultMenuDishes.map((dish) => dish.title));
  const dishesByTitle = new Map();
  for (const row of rows) {
    if (row.listing_type === 'business' && allowedTitles.has(row.title) && !dishesByTitle.has(row.title)) {
      dishesByTitle.set(row.title, row);
    }
  }
  const menu = defaultMenuDishes.map((dish) => dishesByTitle.get(dish.title)).filter(Boolean);
  if (menu.length !== defaultMenuDishes.length) {
    throw new Error(`The default menu seed is incomplete (${menu.length}/${defaultMenuDishes.length} dishes)`);
  }
  return menu;
}

async function removeDishIfUnordered(connection, menuItemId) {
  const [[orderItem]] = await connection.query('SELECT id FROM order_items WHERE item_id = ? LIMIT 1', [menuItemId]);
  if (orderItem) return;
  await connection.query('DELETE FROM recipe_ingredients WHERE menu_item_id = ?', [menuItemId]);
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
        'SELECT id FROM menu_items WHERE title = ? AND listing_type = ? ORDER BY id LIMIT 1',
        [dish.title, 'business'],
      );
      let menuItemId = existing && existing.id;
      if (menuItemId) {
        await connection.query(
          `UPDATE menu_items
           SET description = ?, preparation_steps = ?, category = ?, price = ?,
               stock_quantity = ?, image_url = ?
           WHERE id = ?`,
          [dish.description, dish.preparationSteps, dish.category, dish.price, 10, dish.imageUrl, menuItemId],
        );
        await connection.query('DELETE FROM recipe_ingredients WHERE menu_item_id = ?', [menuItemId]);
      } else {
        const [result] = await connection.query(
          `INSERT INTO menu_items
           (title, description, preparation_steps, category, price, stock_quantity,
            listing_type, creator_user_id, seller_user_id, image_url)
           VALUES (?, ?, ?, ?, ?, ?, 'business', NULL, NULL, ?)`,
          [dish.title, dish.description, dish.preparationSteps, dish.category, dish.price, 10, dish.imageUrl],
        );
        menuItemId = result.insertId;
      }
      for (const ingredient of dish.ingredients) {
        await connection.query('INSERT INTO recipe_ingredients (menu_item_id, ingredient_name) VALUES (?, ?)', [
          menuItemId,
          ingredient,
        ]);
      }

      const [duplicates] = await connection.query(
        'SELECT id FROM menu_items WHERE title = ? AND listing_type = ? ORDER BY id',
        [dish.title, 'business'],
      );
      for (const duplicate of duplicates.slice(1)) {
        await removeDishIfUnordered(connection, duplicate.id);
      }
    }

    const defaultTitles = defaultMenuDishes.map((dish) => dish.title);
    const defaultTitlePlaceholders = defaultTitles.map(() => '?').join(', ');
    const [obsoleteRows] = await connection.query(
      `SELECT id FROM menu_items
       WHERE COALESCE(listing_type, '') <> 'business'
          OR title IS NULL
          OR title NOT IN (${defaultTitlePlaceholders})`,
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
    return res.status(401).json({ error: 'Please sign in to continue' });
  }
  req.user = session.user;
  next();
}

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
    itemIds,
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
      [order.id],
    );
    order.items = items;
  }
  return orders;
}

async function attachDeliveryProgress(orders) {
  if (!orders.length) return orders;
  // Delivery lifecycle stays on orders/deliveries; item-level approval and seller payout statuses remain separate.
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

function normalizeDish(body) {
  const ingredients = Array.isArray(body.ingredients)
    ? [...new Set(body.ingredients.map((ingredient) => String(ingredient).trim()).filter(Boolean))]
    : [];
  const dish = {
    title: String(body.title || '').trim(),
    description: String(body.description || '')
      .trim()
      .slice(0, 500),
    preparationSteps: String(body.preparation_steps || '').trim(),
    category: String(body.category || '').trim(),
    price: Number(body.price),
    stock: Number(body.stock_quantity),
    ingredients,
    imageUrl: typeof body.image_url === 'string' ? body.image_url.trim() : '',
  };
  const valid =
    dish.title &&
    dish.preparationSteps &&
    dish.preparationSteps.length <= 4000 &&
    dish.category &&
    Number.isFinite(dish.price) &&
    dish.price >= 1000 &&
    Number.isInteger(dish.stock) &&
    dish.stock >= 0 &&
    dish.ingredients.length > 0 &&
    dish.ingredients.length <= 40 &&
    dish.imageUrl.length <= 200000;
  return { dish, valid, imageTooLarge: dish.imageUrl.length > 200000 };
}

async function insertDish(connection, dish, listingType, creatorId) {
  const sellerId = listingType === 'community' ? creatorId : null;
  const [result] = await connection.query(
    `INSERT INTO menu_items
     (title, description, preparation_steps, category, price, stock_quantity, listing_type, creator_user_id, seller_user_id, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dish.title,
      dish.description,
      dish.preparationSteps,
      dish.category,
      dish.price,
      dish.stock,
      listingType,
      creatorId,
      sellerId,
      dish.imageUrl || null,
    ],
  );
  for (const ingredient of dish.ingredients) {
    await connection.query('INSERT INTO recipe_ingredients (menu_item_id, ingredient_name) VALUES (?, ?)', [
      result.insertId,
      ingredient.slice(0, 160),
    ]);
  }
  return result.insertId;
}

async function refreshOrderStatus(connection, orderId, changedBy = null) {
  const [[order]] = await connection.query('SELECT status FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;
  if (
    ['preparing', 'ready_for_delivery', 'assigned', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'].includes(
      order.status,
    )
  ) {
    // Seller item decisions must not move an order backward after kitchen or delivery work has started.
    return order.status;
  }
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

  if (status !== order.status) {
    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
    await connection.query(
      'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
      [orderId, status, changedBy],
    );
  }
  return status;
}

async function setOrderLineStatus(connection, lineId, status, user) {
  const [rows] = await connection.query(
    `SELECT oi.id, oi.order_id, oi.item_id, oi.quantity, oi.price, oi.status, oi.seller_user_id,
       mi.stock_quantity
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
    const commission = line.seller_user_id ? Math.round(lineTotal * 0.1) : 0;
    const sellerAmount = line.seller_user_id ? lineTotal - commission : 0;
    await connection.query('UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?', [
      line.quantity,
      line.item_id,
    ]);
    await connection.query(
      `UPDATE order_items SET status = 'approved', commission_amount = ?, seller_amount = ? WHERE id = ?`,
      [commission, sellerAmount, line.id],
    );
  } else if (status === 'rejected' && line.status === 'pending') {
    await connection.query(
      `UPDATE order_items SET status = 'rejected', commission_amount = 0, seller_amount = 0 WHERE id = ?`,
      [line.id],
    );
  } else if (status === 'completed' && line.status === 'approved') {
    await connection.query('UPDATE order_items SET status = ? WHERE id = ?', [status, line.id]);
  } else {
    const error = new Error(`Cannot change dish order from ${line.status} to ${status}`);
    error.statusCode = 409;
    throw error;
  }

  const orderStatus = await refreshOrderStatus(connection, line.order_id, user.id);
  return { orderId: line.order_id, lineId: line.id, itemStatus: status, orderStatus };
}

async function writeOrderStatus(connection, orderId, status, userId) {
  await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
  await connection.query(
    'INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)',
    [orderId, status, userId],
  );
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
  await connection.query('UPDATE delivery_riders SET status = ? WHERE id = ?', [
    Number(active.active_count) > 0 ? 'busy' : 'available',
    riderId,
  ]);
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
  if (nextStatus === 'delivered') await syncRiderAvailability(connection, delivery.rider_id);
}

async function updateOrderLifecycle(connection, order, nextStatus, user) {
  if (nextStatus === 'approved' && order.status === 'pending') {
    const [lines] = await connection.query(
      'SELECT id, status FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE',
      [order.id],
    );
    for (const line of lines.filter((item) => item.status === 'pending')) {
      await setOrderLineStatus(connection, line.id, 'approved', user);
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
    preparing: ['ready_for_delivery', 'cancelled'],
    ready_for_delivery: order.delivery_type === 'pickup' ? ['picked_up', 'cancelled'] : ['cancelled'],
  };
  if (!(allowedTransitions[order.status] || []).includes(nextStatus)) {
    const error = new Error(`Cannot change order from ${order.status} to ${nextStatus}`);
    error.statusCode = 409;
    throw error;
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
      `UPDATE order_items SET status = 'rejected', commission_amount = 0, seller_amount = 0
       WHERE order_id = ? AND status != 'rejected'`,
      [order.id],
    );
  }
  await writeOrderStatus(connection, order.id, nextStatus, user.id);
  return nextStatus;
}

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
      `SELECT mi.*, seller.name AS seller_name, creator.name AS creator_name,
         creator.role AS creator_role
       FROM menu_items mi
       LEFT JOIN users seller ON seller.id = mi.seller_user_id
       LEFT JOIN users creator ON creator.id = mi.creator_user_id
       ORDER BY mi.category, mi.title, mi.id`,
    );
    res.json(await attachIngredients(getDefaultMenuRows(rows)));
  } catch (err) {
    console.error('MENU ERROR:', err.message);
    res.status(500).json({ error: 'Could not load menu: ' + err.message });
  }
});

app.post('/recipes', requireAuth, async (req, res) => {
  const { dish, valid, imageTooLarge } = normalizeDish(req.body);
  if (imageTooLarge) {
    return res.status(400).json({ error: 'Image is too large. Please choose a smaller photo.' });
  }
  if (!valid) {
    return res.status(400).json({
      error: 'Add a title, category, preparation steps, valid UGX price, stock quantity, and 1 to 40 ingredients',
    });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = await insertDish(connection, dish, 'community', req.user.id);
    await connection.commit();
    res.status(201).json({ id, title: dish.title, stock_quantity: dish.stock });
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

app.post('/staff/menu', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { dish, valid, imageTooLarge } = normalizeDish(req.body);
  if (imageTooLarge) {
    return res.status(400).json({ error: 'Image is too large. Please choose a smaller photo.' });
  }
  if (!valid) {
    return res.status(400).json({
      error: 'Add a title, category, preparation steps, valid UGX price, stock quantity, and 1 to 40 ingredients',
    });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const id = await insertDish(connection, dish, 'business', req.user.id);
    await connection.commit();
    res.status(201).json({ id, title: dish.title, listing_type: 'business', stock_quantity: dish.stock });
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
    const [rows] = await pool.query('SELECT * FROM menu_items WHERE seller_user_id = ? ORDER BY title', [
      req.params.userId,
    ]);
    res.json(await attachIngredients(rows));
  } catch (err) {
    console.error('MY RECIPES ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your dishes: ' + err.message });
  }
});

app.post('/order', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { items } = req.body;
  const deliveryType = String(req.body.delivery_type || 'pickup').trim();
  const deliveryAddress = String(req.body.delivery_address || '').trim();
  const contactPhone = String(req.body.contact_phone || '').trim();
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }
  if (!['pickup', 'delivery'].includes(deliveryType)) {
    return res.status(400).json({ error: 'Choose pickup or delivery' });
  }
  if (
    deliveryType === 'delivery' &&
    (!deliveryAddress || deliveryAddress.length > 255 || !/^[+0-9()\-\s]{7,20}$/.test(contactPhone) ||
      contactPhone.replace(/\D/g, '').length < 7)
  ) {
    return res.status(400).json({ error: 'Delivery requires a valid address and contact phone number' });
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
      line.sellerUserId = item.seller_user_id;
      line.status = Number(item.stock_quantity) >= line.quantity ? 'approved' : 'pending';
      line.commissionAmount = line.sellerUserId && line.status === 'approved' ? Math.round(lineTotal * 0.05) : 0;
      line.sellerAmount = line.sellerUserId && line.status === 'approved' ? lineTotal - line.commissionAmount : 0;
      total += lineTotal;
    }

    const status = orderLines.some((line) => line.status === 'pending') ? 'pending' : 'approved';
    const [orderResult] = await connection.query(
      `INSERT INTO orders (user_id, status, total_amount, delivery_type, delivery_address, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        status,
        total,
        deliveryType,
        deliveryType === 'delivery' ? deliveryAddress : null,
        deliveryType === 'delivery' ? contactPhone : null,
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
         (order_id, item_id, quantity, price, seller_user_id, status, commission_amount, seller_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          line.itemId,
          line.quantity,
          line.price,
          line.sellerUserId,
          line.status,
          line.commissionAmount,
          line.sellerAmount,
        ],
      );
      if (line.status === 'approved') {
        await connection.query('UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?', [
          line.quantity,
          line.itemId,
        ]);
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

app.get('/orders/:userId', requireAuth, async (req, res) => {
  if (Number(req.params.userId) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'You can only view your own orders' });
  }
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [
      req.params.userId,
    ]);
    res.json(await attachDeliveryProgress(await attachOrderItems(orders)));
  } catch (err) {
    console.error('ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load orders: ' + err.message });
  }
});

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
      [req.user.id],
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
      [req.user.id],
    );
    const [[sales]] = await pool.query(
      `SELECT COUNT(DISTINCT order_id) AS orders_received,
         COALESCE(SUM(status = 'pending'), 0) AS pending_dishes,
         COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN price * quantity ELSE 0 END), 0) AS gross_sales,
         COALESCE(SUM(commission_amount), 0) AS commission,
         COALESCE(SUM(seller_amount), 0) AS seller_earnings
       FROM order_items WHERE seller_user_id = ?`,
      [req.user.id],
    );
    res.json({ summary: { ...listings, ...sales } });
  } catch (err) {
    console.error('SELLER DASHBOARD ERROR:', err.message);
    res.status(500).json({ error: 'Could not load your earnings: ' + err.message });
  }
});

app.get('/staff/orders', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY (o.status = 'pending') DESC, o.created_at DESC`,
    );
    res.json(await attachDeliveryProgress(await attachOrderItems(orders)));
  } catch (err) {
    console.error('STAFF ORDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load staff orders: ' + err.message });
  }
});

app.get('/admin/dashboard', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [[sales]] = await pool.query(
      `SELECT COUNT(DISTINCT order_id) AS total_orders,
         COUNT(DISTINCT CASE WHEN status = 'pending' THEN order_id END) AS pending_orders,
         COUNT(DISTINCT CASE WHEN status IN ('approved', 'completed') THEN order_id END) AS approved_orders,
         COALESCE(SUM(CASE WHEN status IN ('approved', 'completed') THEN price * quantity ELSE 0 END), 0) AS total_sales,
         COALESCE(SUM(commission_amount), 0) AS total_commission
       FROM order_items`,
    );
    const [[listings]] = await pool.query(
      `SELECT COUNT(*) AS total_dishes,
         COALESCE(SUM(stock_quantity > 0), 0) AS available_dishes
       FROM menu_items`,
    );
    const [[deliveries]] = await pool.query(
      `SELECT COUNT(*) AS delivery_orders,
         COALESCE(SUM(status IN ('pending', 'approved', 'preparing', 'ready_for_delivery', 'assigned',
           'picked_up', 'out_for_delivery')), 0) AS active_deliveries,
         COALESCE(SUM(status = 'ready_for_delivery' AND id NOT IN
           (SELECT order_id FROM deliveries WHERE rider_id IS NOT NULL)), 0) AS unassigned_deliveries
       FROM orders WHERE delivery_type = 'delivery'`,
    );
    const [recentOrders] = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 8`,
    );
    res.json({
      summary: { ...sales, ...listings, ...deliveries },
      recentOrders: await attachDeliveryProgress(await attachOrderItems(recentOrders)),
    });
  } catch (err) {
    console.error('ADMIN DASHBOARD ERROR:', err.message);
    res.status(500).json({ error: 'Could not load dashboard: ' + err.message });
  }
});

app.get('/admin/deliveries', requireAuth, requireRole('admin'), async (req, res) => {
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

app.get('/admin/riders/available', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [riders] = await pool.query(
      `SELECT rider.id, rider.rider_name, rider.rider_phone, rider.status
       FROM delivery_riders rider
       JOIN users u ON u.id = rider.user_id
       WHERE rider.status = 'available' AND u.role = 'rider'
       ORDER BY rider.rider_name`,
    );
    res.json(riders);
  } catch (err) {
    console.error('AVAILABLE RIDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load available riders: ' + err.message });
  }
});

app.get('/admin/riders', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [riders] = await pool.query(
      `SELECT rider.id, rider.rider_name, rider.rider_phone, rider.status, rider.user_id,
         (u.id IS NOT NULL AND u.role = 'rider') AS login_enabled
       FROM delivery_riders rider
       LEFT JOIN users u ON u.id = rider.user_id
       ORDER BY rider.rider_name`,
    );
    res.json(riders);
  } catch (err) {
    console.error('ADMIN RIDERS ERROR:', err.message);
    res.status(500).json({ error: 'Could not load riders: ' + err.message });
  }
});

app.put('/admin/orders/:id/assign-rider', requireAuth, requireRole('admin'), async (req, res) => {
  const riderId = Number(req.body.rider_id);
  if (!Number.isInteger(riderId) || riderId < 1) {
    return res.status(400).json({ error: 'Select a valid rider' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!orders.length) {
      const error = new Error('Order not found');
      error.statusCode = 404;
      throw error;
    }
    const order = orders[0];
    if (order.delivery_type !== 'delivery' || !['ready_for_delivery', 'assigned'].includes(order.status)) {
      const error = new Error('Riders can only be assigned to delivery orders that are ready');
      error.statusCode = 409;
      throw error;
    }
    const [riders] = await connection.query(
      `SELECT rider.id, rider.status FROM delivery_riders rider
       JOIN users u ON u.id = rider.user_id
       WHERE rider.id = ? AND u.role = 'rider' FOR UPDATE`,
      [riderId],
    );
    if (!riders.length) {
      const error = new Error('The selected rider does not have a linked rider account');
      error.statusCode = 400;
      throw error;
    }
    const [existingDeliveries] = await connection.query(
      'SELECT id, rider_id, delivery_status FROM deliveries WHERE order_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [order.id],
    );
    const existing = existingDeliveries[0];
    if (existing && existing.delivery_status !== 'assigned') {
      const error = new Error('A rider cannot be changed after pickup');
      error.statusCode = 409;
      throw error;
    }
    const oldRiderId = existing && existing.rider_id;
    if (riders[0].status !== 'available' && Number(oldRiderId) !== riderId) {
      const error = new Error('The selected rider is currently busy');
      error.statusCode = 409;
      throw error;
    }
    if (existing) {
      await connection.query(
        `UPDATE deliveries SET rider_id = ?, delivery_status = 'assigned',
           assigned_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [riderId, existing.id],
      );
    } else {
      await connection.query(
        `INSERT INTO deliveries (order_id, rider_id, delivery_status, assigned_at)
         VALUES (?, ?, 'assigned', CURRENT_TIMESTAMP)`,
        [order.id, riderId],
      );
    }
    await writeOrderStatus(connection, order.id, 'assigned', req.user.id);
    await syncRiderAvailability(connection, oldRiderId);
    await syncRiderAvailability(connection, riderId);
    await connection.commit();
    res.json({ order_id: order.id, rider_id: riderId, status: 'assigned' });
  } catch (err) {
    await connection.rollback();
    console.error('ASSIGN RIDER ERROR:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

app.put('/admin/deliveries/:deliveryId/status', requireAuth, requireRole('admin'), async (req, res) => {
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
      `SELECT o.*, customer.name AS customer_name, customer.email AS customer_email,
         d.id AS delivery_id, d.delivery_status, d.rider_id, d.assigned_at,
         d.picked_up_at, d.out_for_delivery_at, d.delivered_at, d.notes,
         rider.rider_name, rider.rider_phone
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN delivery_riders rider ON rider.id = d.rider_id
       JOIN users customer ON customer.id = o.user_id
       WHERE rider.user_id = ?
       ORDER BY (d.delivery_status = 'delivered') ASC, d.assigned_at DESC`,
      [req.user.id],
    );
    res.json(await attachDeliveryProgress(await attachOrderItems(orders)));
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
    const [rows] = await pool.query(
      `SELECT mi.*, creator.name AS creator_name, creator.role AS creator_role,
         seller.name AS seller_name
       FROM menu_items mi
       LEFT JOIN users creator ON creator.id = mi.creator_user_id
       LEFT JOIN users seller ON seller.id = mi.seller_user_id
       ORDER BY mi.id`,
    );
    res.json(getDefaultMenuRows(rows));
  } catch (err) {
    console.error('INVENTORY ERROR:', err.message);
    res.status(500).json({ error: 'Could not load inventory: ' + err.message });
  }
});

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

app.put('/orders/:id/status', requireAuth, requireRole('admin', 'staff'), async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'completed', 'preparing', 'ready_for_delivery', 'picked_up', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Choose a supported order stage' });
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

app.use(express.static(path.join(__dirname, '..', 'yummy-web')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}/`);
});
