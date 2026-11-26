const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { test } = require('node:test');
const {
  createNotificationRouter,
  notifyApproachingScheduledOrders,
  notifyLowStock,
  notifyOrderStatus,
  notifyRoles,
  notifyUser,
} = require('../notification-system');

class MemoryNotificationRepository {
  constructor() {
    this.notifications = [];
    this.nextId = 1;
  }

  async listForUser(userId) {
    const notifications = this.notifications
      .filter((notification) => notification.user_id === userId)
      .sort((left, right) => right.id - left.id);
    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read_at).length,
    };
  }

  async markRead(userId, id) {
    const notification = this.notifications.find((item) => item.id === id && item.user_id === userId);
    if (!notification) return false;
    notification.read_at = notification.read_at || new Date().toISOString();
    return true;
  }

  async markAllRead(userId) {
    let updated = 0;
    for (const notification of this.notifications) {
      if (notification.user_id === userId && !notification.read_at) {
        notification.read_at = new Date().toISOString();
        updated += 1;
      }
    }
    return updated;
  }
}

async function createFixture(t, repository = new MemoryNotificationRepository()) {
  const app = express();
  app.use(express.json());
  app.use(createNotificationRouter({
    repository,
    requireAuth(req, res, next) {
      const userId = Number(req.headers['x-test-user']);
      if (!userId) return res.status(401).json({ error: 'Sign in to continue.' });
      req.user = { id: userId, role: 'customer' };
      next();
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return {
    repository,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function request(baseUrl, route, { userId, method = 'GET' } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: userId ? { 'x-test-user': String(userId) } : {},
  });
  return { status: response.status, data: await response.json() };
}

function createRecordingConnection() {
  const inserted = [];
  const connection = {
    async query(sql, params = []) {
      if (sql.includes('SELECT user_id FROM orders')) return [[{ user_id: 7 }], []];
      if (sql.includes('SELECT delivery_type FROM orders')) return [[{ delivery_type: 'delivery' }], []];
      if (sql.includes('SELECT id FROM users WHERE role IN')) {
        const users = params.includes('rider')
          ? [{ id: 31 }]
          : [{ id: 11 }, { id: 12 }];
        return [users, []];
      }
      if (sql.includes('INSERT') && sql.includes('notifications')) {
        inserted.push({
          sql,
          user_id: params[0],
          type: params[1],
          title: params[2],
          message: params[3],
          entity_type: params[4],
          entity_id: params[5],
          dedupe_key: params[6],
        });
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('SELECT id, scheduled_for')) {
        return [[{ id: 42, scheduled_for: '2030-01-01 10:00:00' }], []];
      }
      throw new Error(`Unexpected SQL in notification test: ${sql}`);
    },
  };
  return { connection, inserted };
}

test('notification endpoints return unread counts and only update the signed-in user’s notifications', async (t) => {
  const repository = new MemoryNotificationRepository();
  repository.notifications.push(
    { id: 1, user_id: 5, title: 'Order received', message: 'Order #1', read_at: null },
    { id: 2, user_id: 5, title: 'Order ready', message: 'Order #1', read_at: null },
    { id: 3, user_id: 6, title: 'Private', message: 'Other user', read_at: null },
  );
  const { baseUrl } = await createFixture(t, repository);

  assert.equal((await request(baseUrl, '/notifications')).status, 401);
  const list = await request(baseUrl, '/notifications', { userId: 5 });
  assert.equal(list.status, 200);
  assert.equal(list.data.unreadCount, 2);
  assert.deepEqual(list.data.notifications.map(({ id }) => id), [2, 1]);

  assert.equal((await request(baseUrl, '/notifications/3/read', { userId: 5, method: 'PUT' })).status, 404);
  assert.equal((await request(baseUrl, '/notifications/1/read', { userId: 5, method: 'PUT' })).data.read, true);
  assert.equal((await request(baseUrl, '/notifications/read-all', { userId: 5, method: 'PUT' })).data.updated, 1);
  assert.equal((await request(baseUrl, '/notifications', { userId: 5 })).data.unreadCount, 0);
  assert.equal((await request(baseUrl, '/notifications', { userId: 6 })).data.unreadCount, 1);
});

test('order lifecycle, rider, operational, stock, catering/menu, and scheduled events persist typed notifications', async () => {
  const { connection, inserted } = createRecordingConnection();
  for (const status of [
    'approved',
    'rejected',
    'partially_approved',
    'preparing',
    'ready_for_delivery',
    'assigned',
    'out_for_delivery',
    'delivered',
  ]) {
    await notifyOrderStatus(connection, 20, status);
  }
  await notifyUser(connection, 7, {
    type: 'order_received',
    title: 'Order received',
    message: 'We received the order.',
    entityType: 'order',
    entityId: 20,
  });
  await notifyRoles(connection, ['admin', 'staff'], {
    type: 'new_order',
    title: 'New order arrives',
    message: 'A new order was placed.',
    entityType: 'order',
    entityId: 20,
  });
  await notifyRoles(connection, ['admin', 'staff'], {
    type: 'new_catering_request',
    title: 'New catering request',
    message: 'A catering request was submitted.',
    entityType: 'catering_request',
    entityId: 21,
  });
  await notifyRoles(connection, ['admin', 'staff'], {
    type: 'menu_change_request',
    title: 'New menu change request',
    message: 'A menu request was submitted.',
    entityType: 'menu_change_request',
    entityId: 22,
  });
  await notifyRoles(connection, ['rider'], {
    type: 'delivery_assigned',
    title: 'Delivery assigned',
    message: 'A delivery was assigned.',
    entityType: 'order',
    entityId: 20,
  });
  await notifyRoles(connection, ['rider'], {
    type: 'delivery_completed',
    title: 'Delivery completed',
    message: 'A delivery was completed.',
    entityType: 'order',
    entityId: 20,
  });
  await notifyLowStock(connection, 30, 'Matooke', 6, 5);
  await notifyLowStock(connection, 30, 'Matooke', 5, 4);
  await notifyApproachingScheduledOrders(connection);

  const types = inserted.map(({ type }) => type);
  for (const type of [
    'order_received',
    'order_approved',
    'order_rejected',
    'order_preparing',
    'order_ready',
    'rider_accepted',
    'out_for_delivery',
    'order_delivered',
    'new_delivery_available',
    'new_order',
    'new_catering_request',
    'menu_change_request',
    'delivery_assigned',
    'delivery_completed',
    'low_stock',
    'scheduled_order_approaching',
  ]) {
    assert.ok(types.includes(type), `expected persisted notification type ${type}`);
  }
  assert.equal(types.filter((type) => type === 'low_stock').length, 2);
  assert.ok(inserted.every((notification) => notification.user_id && notification.title && notification.message));
});
