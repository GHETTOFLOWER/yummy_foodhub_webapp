const express = require('express');

const LOW_STOCK_THRESHOLD = 5;

async function insertNotification(connection, userId, notification) {
  const dedupeKey = notification.dedupeKey
    ? `${notification.dedupeKey}:${userId}`
    : null;
  await connection.query(
    `INSERT ${dedupeKey ? 'IGNORE ' : ''}INTO notifications
       (user_id, type, title, message, entity_type, entity_id, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      notification.type,
      notification.title,
      notification.message,
      notification.entityType || 'system',
      notification.entityId || null,
      dedupeKey,
    ],
  );
}

async function notifyUser(connection, userId, notification) {
  await insertNotification(connection, userId, notification);
}

async function notifyRoles(connection, roles, notification) {
  const placeholders = roles.map(() => '?').join(', ');
  const [users] = await connection.query(
    `SELECT id FROM users WHERE role IN (${placeholders})`,
    roles,
  );
  for (const user of users) {
    await insertNotification(connection, user.id, notification);
  }
}

async function notifyOrderStatus(connection, orderId, status) {
  const messages = {
    approved: ['order_approved', 'Order approved', `Your order #${orderId} has been approved.`],
    rejected: ['order_rejected', 'Order rejected', `Your order #${orderId} was rejected.`],
    partially_approved: ['order_rejected', 'Order update', `Some items in order #${orderId} were rejected.`],
    preparing: ['order_preparing', 'Order being prepared', `Your order #${orderId} is being prepared.`],
    ready_for_delivery: ['order_ready', 'Order ready', `Your order #${orderId} is ready.`],
    assigned: ['rider_accepted', 'Rider accepted delivery', `A rider accepted delivery for order #${orderId}.`],
    out_for_delivery: ['out_for_delivery', 'Out for delivery', `Your order #${orderId} is out for delivery.`],
    delivered: ['order_delivered', 'Order delivered', `Your order #${orderId} has been delivered.`],
  };
  const message = messages[status];
  if (!message) return;
  const [[order]] = await connection.query('SELECT user_id FROM orders WHERE id = ?', [orderId]);
  if (!order) return;
  await notifyUser(connection, order.user_id, {
    type: message[0],
    title: message[1],
    message: message[2],
    entityType: 'order',
    entityId: orderId,
    dedupeKey: `order-${orderId}-${message[0]}`,
  });
  if (status === 'ready_for_delivery') {
    const [[deliveryOrder]] = await connection.query(
      'SELECT delivery_type FROM orders WHERE id = ?',
      [orderId],
    );
    if (deliveryOrder.delivery_type === 'delivery') {
      await notifyRoles(connection, ['rider'], {
        type: 'new_delivery_available',
        title: 'New delivery available',
        message: `Order #${orderId} is ready for delivery.`,
        entityType: 'order',
        entityId: orderId,
        dedupeKey: `new-delivery-${orderId}`,
      });
    }
  }
}

async function notifyLowStock(connection, itemId, itemTitle, previousQuantity, nextQuantity) {
  if (
    Number(previousQuantity) <= LOW_STOCK_THRESHOLD ||
    Number(nextQuantity) > LOW_STOCK_THRESHOLD
  ) return;
  await notifyRoles(connection, ['admin', 'staff'], {
    type: 'low_stock',
    title: 'Low stock detected',
    message: `${itemTitle} is low on stock (${nextQuantity} remaining).`,
    entityType: 'menu_item',
    entityId: itemId,
  });
}

function createSqlNotificationRepository(pool) {
  return {
    async listForUser(userId) {
      const [[summary]] = await pool.query(
        'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [userId],
      );
      const [notifications] = await pool.query(
        `SELECT id, type, title, message, entity_type, entity_id, created_at, read_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 50`,
        [userId],
      );
      return { notifications, unreadCount: Number(summary.unread_count) };
    },

    async markRead(userId, notificationId) {
      const [result] = await pool.query(
        `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND read_at IS NULL`,
        [notificationId, userId],
      );
      if (result.affectedRows) return true;
      const [[existing]] = await pool.query(
        'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
        [notificationId, userId],
      );
      return Boolean(existing);
    },

    async markAllRead(userId) {
      const [result] = await pool.query(
        `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND read_at IS NULL`,
        [userId],
      );
      return result.affectedRows;
    },
  };
}

function createNotificationRouter({ pool, repository, requireAuth }) {
  if (!repository && !pool) throw new Error('A notification repository or database pool is required.');
  if (typeof requireAuth !== 'function') throw new Error('Notification authentication middleware is required.');
  const data = repository || createSqlNotificationRepository(pool);
  const router = express.Router();

  router.get('/notifications', requireAuth, async (req, res) => {
    try {
      res.json(await data.listForUser(req.user.id));
    } catch (error) {
      console.error('NOTIFICATION LIST ERROR:', error.message);
      res.status(503).json({
        error: 'Notification database setup is incomplete. Apply yummy-backend/notifications-migration.sql and retry.',
      });
    }
  });

  router.put('/notifications/:id/read', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: 'A valid notification ID is required.' });
    }
    try {
      if (!(await data.markRead(req.user.id, id))) {
        return res.status(404).json({ error: 'Notification not found.' });
      }
      res.json({ id, read: true });
    } catch (error) {
      console.error('NOTIFICATION READ ERROR:', error.message);
      res.status(503).json({
        error: 'Notification database setup is incomplete. Apply yummy-backend/notifications-migration.sql and retry.',
      });
    }
  });

  router.put('/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const updated = await data.markAllRead(req.user.id);
      res.json({ updated });
    } catch (error) {
      console.error('NOTIFICATION READ-ALL ERROR:', error.message);
      res.status(503).json({
        error: 'Notification database setup is incomplete. Apply yummy-backend/notifications-migration.sql and retry.',
      });
    }
  });
  return router;
}

async function notifyApproachingScheduledOrders(pool) {
  const [orders] = await pool.query(
    `SELECT id, scheduled_for
     FROM orders
     WHERE order_type = 'scheduled'
       AND status = 'scheduled'
       AND scheduled_for > UTC_TIMESTAMP()
       AND scheduled_for <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE)`,
  );
  for (const order of orders) {
    await notifyRoles(pool, ['admin', 'staff'], {
      type: 'scheduled_order_approaching',
      title: 'Scheduled order approaching',
      message: `Scheduled order #${order.id} is due soon.`,
      entityType: 'order',
      entityId: order.id,
      dedupeKey: `scheduled-order-${order.id}`,
    });
  }
}

module.exports = {
  LOW_STOCK_THRESHOLD,
  createNotificationRouter,
  createSqlNotificationRepository,
  insertNotification,
  notifyApproachingScheduledOrders,
  notifyLowStock,
  notifyOrderStatus,
  notifyRoles,
  notifyUser,
};
