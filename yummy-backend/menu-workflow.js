const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const menuCategories = new Set([
  'Main Courses',
  'Local Favorites',
  'Breakfast',
  'Beverages',
  'Special Meals',
  'Side Dishes',
]);
const pendingStatuses = ['pending_create', 'pending_edit', 'pending_delete'];
const imageExtensions = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function workflowError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseProposedData(request) {
  return {
    ...request,
    proposed_data: typeof request.proposed_data === 'string'
      ? JSON.parse(request.proposed_data)
      : request.proposed_data,
  };
}

function validateMenuItem(body = {}) {
  const title = String(body.title || '').trim();
  if (!title || title.length > 150) {
    return { error: 'Dish name is required and must be 150 characters or fewer.' };
  }

  const category = String(body.category || '').trim();
  if (!menuCategories.has(category)) {
    return { error: 'Select a valid menu category.' };
  }

  const description = String(body.description || '').trim();
  if (description.length > 2000) {
    return { error: 'Description must be 2,000 characters or fewer.' };
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
    return { error: 'Enter a valid price greater than zero.' };
  }

  const imageUrl = body.image_url == null ? '' : String(body.image_url).trim();
  if (imageUrl) {
    const imagePath = imageUrl.slice('./images/'.length);
    if (
      !imageUrl.startsWith('./images/') ||
      imageUrl.length > 500 ||
      imageUrl.includes('\\') ||
      imagePath.split('/').some((part) => part === '.' || part === '..') ||
      imageUrl.includes('://')
    ) {
      return { error: 'Menu images must use a local path under ./images/.' };
    }
  }

  return {
    value: {
      title,
      category,
      description,
      price: Math.round(price * 100) / 100,
      image_url: imageUrl || null,
    },
  };
}

function isValidImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/gif') return buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

function createSqlMenuWorkflowRepository(pool) {
  async function insertRequest(connection, request) {
    const [result] = await connection.query(
      `INSERT INTO menu_change_requests
       (menu_item_id, action_type, proposed_data, status, requested_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        request.menu_item_id,
        request.action_type,
        JSON.stringify(request.proposed_data),
        request.status,
        request.requested_by,
      ],
    );
    await connection.query(
      `INSERT INTO menu_change_request_history
       (request_id, previous_status, new_status, changed_by, notes)
       VALUES (?, NULL, ?, ?, ?)`,
      [result.insertId, request.status, request.requested_by, 'Request submitted'],
    );
    return { ...request, id: result.insertId };
  }

  async function finishTransaction(connection, operation) {
    let started = false;
    try {
      await connection.beginTransaction();
      started = true;
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      if (started) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    async listActiveMenuItems() {
      const [rows] = await pool.query(
        'SELECT mi.* FROM menu_items mi WHERE mi.is_active = 1 ORDER BY mi.category, mi.title, mi.id',
      );
      return rows;
    },

    async listOwnRequests(userId) {
      const [rows] = await pool.query(
        `SELECT * FROM menu_change_requests
         WHERE requested_by = ? ORDER BY created_at DESC, id DESC`,
        [userId],
      );
      return rows.map(parseProposedData);
    },

    async listPendingRequests() {
      const [rows] = await pool.query(
        `SELECT mcr.*, u.name AS requested_by_name, u.email AS requested_by_email
         FROM menu_change_requests mcr
         JOIN users u ON u.id = mcr.requested_by
         WHERE mcr.status IN ('pending_create', 'pending_edit', 'pending_delete')
         ORDER BY mcr.created_at ASC, mcr.id ASC`,
      );
      return rows.map(parseProposedData);
    },

    async createMenuItem(data) {
      const [result] = await pool.query(
        `INSERT INTO menu_items
         (title, description, category, price, stock_quantity, image_url, is_active)
         VALUES (?, ?, ?, ?, 10, ?, 1)`,
        [data.title, data.description, data.category, data.price, data.image_url],
      );
      return { id: result.insertId, ...data, stock_quantity: 10, is_active: 1 };
    },

    async getActiveMenuItem(id) {
      const [rows] = await pool.query(
        'SELECT * FROM menu_items WHERE id = ? AND is_active = 1 LIMIT 1',
        [id],
      );
      return rows[0] || null;
    },

    async updateMenuItem(id, data) {
      const [result] = await pool.query(
        `UPDATE menu_items
         SET title = ?, description = ?, category = ?, price = ?, image_url = ?
         WHERE id = ? AND is_active = 1`,
        [data.title, data.description, data.category, data.price, data.image_url, id],
      );
      if (result.affectedRows > 0) return true;
      return Boolean(await this.getActiveMenuItem(id));
    },

    async deactivateMenuItem(id) {
      const [result] = await pool.query(
        'UPDATE menu_items SET is_active = 0 WHERE id = ? AND is_active = 1',
        [id],
      );
      return result.affectedRows > 0;
    },

    async requestCreate(userId, data) {
      const connection = await pool.getConnection();
      return finishTransaction(connection, (transaction) => insertRequest(transaction, {
        menu_item_id: null,
        action_type: 'create',
        proposed_data: data,
        status: 'pending_create',
        requested_by: userId,
      }));
    },

    async requestChange(userId, itemId, actionType, data) {
      const connection = await pool.getConnection();
      return finishTransaction(connection, async (transaction) => {
        const [items] = await transaction.query(
          'SELECT * FROM menu_items WHERE id = ? AND is_active = 1 FOR UPDATE',
          [itemId],
        );
        if (!items.length) throw workflowError(404, 'Menu item not found.');

        const [pending] = await transaction.query(
          `SELECT id FROM menu_change_requests
           WHERE menu_item_id = ? AND status IN ('pending_create', 'pending_edit', 'pending_delete')
           LIMIT 1 FOR UPDATE`,
          [itemId],
        );
        if (pending.length) throw workflowError(409, 'This menu item already has a pending change request.');

        const proposedData = actionType === 'delete'
          ? {
              title: items[0].title,
              description: items[0].description,
              category: items[0].category,
              price: Number(items[0].price),
              image_url: items[0].image_url || null,
            }
          : data;
        return insertRequest(transaction, {
          menu_item_id: itemId,
          action_type: actionType,
          proposed_data: proposedData,
          status: actionType === 'edit' ? 'pending_edit' : 'pending_delete',
          requested_by: userId,
        });
      });
    },

    async reviewRequest(id, reviewerId, decision) {
      const connection = await pool.getConnection();
      return finishTransaction(connection, async (transaction) => {
        const [requests] = await transaction.query(
          'SELECT * FROM menu_change_requests WHERE id = ? FOR UPDATE',
          [id],
        );
        if (!requests.length) throw workflowError(404, 'Menu change request not found.');
        const request = requests[0];
        if (!pendingStatuses.includes(request.status)) {
          throw workflowError(409, 'This menu change request has already been reviewed.');
        }

        const proposedData = parseProposedData(request).proposed_data;
        let menuItemId = request.menu_item_id;
        if (decision === 'approve') {
          if (request.action_type === 'create') {
            const [result] = await transaction.query(
              `INSERT INTO menu_items
               (title, description, category, price, stock_quantity, image_url, is_active)
               VALUES (?, ?, ?, ?, 10, ?, 1)`,
              [proposedData.title, proposedData.description, proposedData.category, proposedData.price, proposedData.image_url],
            );
            menuItemId = result.insertId;
          } else if (request.action_type === 'edit') {
            const [result] = await transaction.query(
              `UPDATE menu_items
               SET title = ?, description = ?, category = ?, price = ?, image_url = ?
               WHERE id = ? AND is_active = 1`,
              [proposedData.title, proposedData.description, proposedData.category, proposedData.price, proposedData.image_url, menuItemId],
            );
            if (!result.affectedRows) {
              const [activeItems] = await transaction.query(
                'SELECT id FROM menu_items WHERE id = ? AND is_active = 1',
                [menuItemId],
              );
              if (!activeItems.length) throw workflowError(409, 'The menu item is no longer active.');
            }
          } else if (request.action_type === 'delete') {
            const [result] = await transaction.query(
              'UPDATE menu_items SET is_active = 0 WHERE id = ? AND is_active = 1',
              [menuItemId],
            );
            if (!result.affectedRows) throw workflowError(409, 'The menu item is no longer active.');
          } else {
            throw workflowError(409, 'This request has an unsupported action.');
          }
        }

        const status = decision === 'approve' ? 'approved' : 'rejected';
        await transaction.query(
          `UPDATE menu_change_requests
           SET menu_item_id = ?, status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [menuItemId, status, reviewerId, id],
        );
        await transaction.query(
          `INSERT INTO menu_change_request_history
           (request_id, previous_status, new_status, changed_by, notes)
           VALUES (?, ?, ?, ?, ?)`,
          [id, request.status, status, reviewerId, decision === 'approve' ? 'Approved by administrator' : 'Rejected by administrator'],
        );
        return { id: request.id, menu_item_id: menuItemId, action_type: request.action_type, status };
      });
    },
  };
}

function createMenuWorkflowRouter({
  repository,
  pool,
  requireAuth,
  requireRole,
  uploadDirectory = path.resolve(__dirname, '..', 'yummy-web', 'images', 'uploads'),
  logger = console,
}) {
  if (!repository && !pool) throw new Error('A menu workflow repository or database pool is required.');
  if (typeof requireAuth !== 'function' || typeof requireRole !== 'function') {
    throw new Error('Menu workflow authentication middleware is required.');
  }
  const data = repository || createSqlMenuWorkflowRepository(pool);
  fs.mkdirSync(uploadDirectory, { recursive: true });

  const storage = multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, uploadDirectory);
    },
    filename(_req, file, callback) {
      const extension = imageExtensions[file.mimetype];
      if (!extension) return callback(workflowError(400, 'Upload a JPEG, PNG, GIF, or WebP image.'));
      callback(null, `menu_${Date.now()}_${crypto.randomBytes(12).toString('hex')}${extension}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter(_req, file, callback) {
      if (!imageExtensions[file.mimetype]) {
        return callback(workflowError(400, 'Upload a JPEG, PNG, GIF, or WebP image.'));
      }
      callback(null, true);
    },
  });
  const router = express.Router();
  const menuManagers = [requireAuth, requireRole('admin', 'staff')];
  const admins = [requireAuth, requireRole('admin')];

  function handleError(res, error, context) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    logger.error(`${context}:`, error.message);
    return res.status(500).json({ error: 'The menu operation could not be completed.' });
  }

  router.get('/menu-management/items', ...menuManagers, async (_req, res) => {
    try {
      res.json(await data.listActiveMenuItems());
    } catch (error) {
      handleError(res, error, 'MENU MANAGEMENT LIST ERROR');
    }
  });

  router.get('/menu-change-requests/mine', ...menuManagers, async (req, res) => {
    try {
      res.json(await data.listOwnRequests(req.user.id));
    } catch (error) {
      handleError(res, error, 'MENU REQUEST HISTORY ERROR');
    }
  });

  router.get('/admin/menu-change-requests', ...admins, async (_req, res) => {
    try {
      res.json(await data.listPendingRequests());
    } catch (error) {
      handleError(res, error, 'ADMIN MENU REQUEST LIST ERROR');
    }
  });

  router.post('/menu-management/images', ...menuManagers, (req, res) => {
    upload.single('image')(req, res, async (error) => {
      if (error) {
        const status = error.statusCode ||
          (error.code === 'LIMIT_FILE_SIZE' ? 413 : error instanceof multer.MulterError ? 400 : 500);
        if (status >= 500) logger.error('MENU IMAGE UPLOAD ERROR:', error.message);
        return res.status(status).json({
          error: status === 413
            ? 'Image must be 8 MB or smaller.'
            : status >= 500
              ? 'The uploaded image could not be stored.'
              : error.message,
        });
      }
      if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });

      try {
        const image = await fs.promises.readFile(req.file.path);
        if (!isValidImage(image, req.file.mimetype)) {
          await fs.promises.unlink(req.file.path);
          return res.status(400).json({ error: 'The uploaded file is not a valid supported image.' });
        }
        return res.status(201).json({ image_url: `./images/uploads/${req.file.filename}` });
      } catch (uploadError) {
        logger.error('MENU IMAGE STORAGE ERROR:', uploadError.message);
        return res.status(500).json({ error: 'The uploaded image could not be stored.' });
      }
    });
  });

  router.post('/menu-management/items', ...menuManagers, async (req, res) => {
    const parsed = validateMenuItem(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      if (req.user.role === 'admin') {
        const item = await data.createMenuItem(parsed.value);
        return res.status(201).json({ item, status: 'approved' });
      }
      const request = await data.requestCreate(req.user.id, parsed.value);
      return res.status(202).json({ request, status: request.status });
    } catch (error) {
      return handleError(res, error, 'MENU ITEM CREATE ERROR');
    }
  });

  router.put('/menu-management/items/:id', ...menuManagers, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Select a valid menu item.' });
    const parsed = validateMenuItem(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    try {
      if (req.user.role === 'admin') {
        if (!(await data.updateMenuItem(id, parsed.value))) {
          return res.status(404).json({ error: 'Menu item not found.' });
        }
        return res.json({ id, status: 'approved' });
      }else{
      const request = await data.requestChange(req.user.id, id, 'edit', parsed.value);
      return res.status(202).json({ request, status: request.status });}
    } catch (error) {
      return handleError(res, error, 'MENU ITEM UPDATE ERROR');
    }
  });

  router.delete('/menu-management/items/:id', ...menuManagers, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Select a valid menu item.' });
    try {
      if (req.user.role === 'admin') {
        if (!(await data.deactivateMenuItem(id))) {
          return res.status(404).json({ error: 'Menu item not found.' });
        }
        return res.json({ id, status: 'approved' });
      }
      const request = await data.requestChange(req.user.id, id, 'delete');
      return res.status(202).json({ request, status: request.status });
    } catch (error) {
      return handleError(res, error, 'MENU ITEM DELETE ERROR');
    }
  });

  router.put('/admin/menu-change-requests/:id', ...admins, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Select a valid menu change request.' });
    const decision = String((req.body || {}).decision || '').trim();
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Choose approve or reject.' });
    }
    try {
      res.json(await data.reviewRequest(id, req.user.id, decision));
    } catch (error) {
      handleError(res, error, 'MENU REQUEST REVIEW ERROR');
    }
  });

  return router;
}

module.exports = {
  createMenuWorkflowRouter,
  createSqlMenuWorkflowRepository,
};
