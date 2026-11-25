const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { test } = require('node:test');
const { createMenuWorkflowRouter } = require('../menu-workflow');

class MemoryMenuRepository {
  constructor() {
    this.items = new Map();
    this.requests = new Map();
    this.history = [];
    this.nextItemId = 1;
    this.nextRequestId = 1;
  }

  async listActiveMenuItems() {
    return [...this.items.values()].filter((item) => item.is_active);
  }

  async listOwnRequests(userId) {
    return [...this.requests.values()].filter((request) => request.requested_by === userId);
  }

  async listPendingRequests() {
    return [...this.requests.values()].filter((request) => request.status.startsWith('pending_'));
  }

  async createMenuItem(data) {
    const item = { id: this.nextItemId++, ...data, stock_quantity: 10, is_active: 1 };
    this.items.set(item.id, item);
    return item;
  }

  async updateMenuItem(id, data) {
    const item = this.items.get(id);
    if (!item || !item.is_active) return false;
    this.items.set(id, { ...item, ...data });
    return true;
  }

  async deactivateMenuItem(id) {
    const item = this.items.get(id);
    if (!item || !item.is_active) return false;
    this.items.set(id, { ...item, is_active: 0 });
    return true;
  }

  async requestCreate(userId, data) {
    return this.addRequest(userId, null, 'create', data, 'pending_create');
  }

  async requestChange(userId, itemId, actionType, data) {
    const item = this.items.get(itemId);
    if (!item || !item.is_active) {
      const error = new Error('Menu item not found.');
      error.statusCode = 404;
      throw error;
    }
    if ([...this.requests.values()].some((request) =>
      request.menu_item_id === itemId && request.status.startsWith('pending_'))) {
      const error = new Error('This menu item already has a pending change request.');
      error.statusCode = 409;
      throw error;
    }
    const proposedData = actionType === 'delete'
      ? {
          title: item.title,
          description: item.description,
          category: item.category,
          price: item.price,
          image_url: item.image_url,
        }
      : data;
    const status = actionType === 'edit' ? 'pending_edit' : 'pending_delete';
    return this.addRequest(userId, itemId, actionType, proposedData, status);
  }

  async reviewRequest(id, reviewerId, decision) {
    const request = this.requests.get(id);
    if (!request) {
      const error = new Error('Menu change request not found.');
      error.statusCode = 404;
      throw error;
    }
    if (!request.status.startsWith('pending_')) {
      const error = new Error('This menu change request has already been reviewed.');
      error.statusCode = 409;
      throw error;
    }
    let itemId = request.menu_item_id;
    if (decision === 'approve') {
      if (request.action_type === 'create') {
        itemId = (await this.createMenuItem(request.proposed_data)).id;
      } else if (request.action_type === 'edit') {
        await this.updateMenuItem(itemId, request.proposed_data);
      } else {
        await this.deactivateMenuItem(itemId);
      }
    }
    const status = decision === 'approve' ? 'approved' : 'rejected';
    this.requests.set(id, { ...request, menu_item_id: itemId, status, reviewed_by: reviewerId });
    this.history.push({ request_id: id, previous_status: request.status, new_status: status, changed_by: reviewerId });
    return { id, menu_item_id: itemId, action_type: request.action_type, status };
  }

  addRequest(userId, itemId, actionType, proposedData, status) {
    const request = {
      id: this.nextRequestId++,
      menu_item_id: itemId,
      action_type: actionType,
      proposed_data: proposedData,
      status,
      requested_by: userId,
      created_at: new Date().toISOString(),
    };
    this.requests.set(request.id, request);
    this.history.push({ request_id: request.id, previous_status: null, new_status: status, changed_by: userId });
    return request;
  }
}

async function createFixture(t, repository = new MemoryMenuRepository()) {
  const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-workflow-test-'));
  const app = express();
  app.use(express.json());
  app.use(createMenuWorkflowRouter({
    repository,
    uploadDirectory,
    logger: { error() {} },
    requireAuth(req, res, next) {
      const role = req.headers['x-test-role'];
      if (!role) return res.status(401).json({ error: 'Sign in to continue.' });
      req.user = { id: role === 'admin' ? 1 : 2, role };
      next();
    },
    requireRole(...roles) {
      return (req, res, next) => roles.includes(req.user.role)
        ? next()
        : res.status(403).json({ error: 'You are not authorized.' });
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(uploadDirectory, { recursive: true, force: true });
  });
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    repository,
    uploadDirectory,
  };
}

async function request(baseUrl, route, { role, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(role ? { 'x-test-role': role } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

const menuItem = (overrides = {}) => ({
  title: 'Test Matooke',
  category: 'Local Favorites',
  description: 'A locally prepared dish.',
  price: 12000,
  image_url: null,
  ...overrides,
});

test('staff create stays pending until an administrator approves it and persists on refresh', async (t) => {
  const { baseUrl } = await createFixture(t);
  const created = await request(baseUrl, '/menu-management/items', {
    role: 'staff',
    method: 'POST',
    body: menuItem(),
  });
  assert.equal(created.status, 202);
  assert.equal(created.data.status, 'pending_create');

  const staffVisibleItems = await request(baseUrl, '/menu-management/items', { role: 'staff' });
  assert.equal(staffVisibleItems.data.length, 0);
  const pending = await request(baseUrl, '/admin/menu-change-requests', { role: 'admin' });
  assert.equal(pending.status, 200);
  assert.equal(pending.data.length, 1);
  assert.equal(pending.data[0].proposed_data.title, 'Test Matooke');

  const approved = await request(baseUrl, `/admin/menu-change-requests/${created.data.request.id}`, {
    role: 'admin',
    method: 'PUT',
    body: { decision: 'approve' },
  });
  assert.equal(approved.data.status, 'approved');
  const refreshedItems = await request(baseUrl, '/menu-management/items', { role: 'staff' });
  assert.equal(refreshedItems.data.length, 1);
  assert.equal(refreshedItems.data[0].title, 'Test Matooke');
});

test('staff edits and deletes remain pending until approval', async (t) => {
  const { baseUrl, repository } = await createFixture(t);
  const item = await repository.createMenuItem(menuItem());
  const edit = await request(baseUrl, `/menu-management/items/${item.id}`, {
    role: 'staff',
    method: 'PUT',
    body: menuItem({ title: 'Updated Matooke', price: 14000 }),
  });
  assert.equal(edit.status, 202);
  assert.equal(edit.data.status, 'pending_edit');

  const unchanged = await request(baseUrl, '/menu-management/items', { role: 'staff' });
  assert.equal(unchanged.data[0].title, 'Test Matooke');
  await request(baseUrl, `/admin/menu-change-requests/${edit.data.request.id}`, {
    role: 'admin',
    method: 'PUT',
    body: { decision: 'approve' },
  });
  assert.equal((await request(baseUrl, '/menu-management/items', { role: 'staff' })).data[0].title, 'Updated Matooke');

  const deletion = await request(baseUrl, `/menu-management/items/${item.id}`, {
    role: 'staff',
    method: 'DELETE',
  });
  assert.equal(deletion.status, 202);
  assert.equal(deletion.data.status, 'pending_delete');
  assert.equal((await request(baseUrl, '/menu-management/items', { role: 'staff' })).data.length, 1);
  await request(baseUrl, `/admin/menu-change-requests/${deletion.data.request.id}`, {
    role: 'admin',
    method: 'PUT',
    body: { decision: 'approve' },
  });
  assert.equal((await request(baseUrl, '/menu-management/items', { role: 'staff' })).data.length, 0);
  assert.equal(repository.history.length, 4);
});

test('administrator menu changes publish immediately and staff cannot review requests', async (t) => {
  const { baseUrl } = await createFixture(t);
  const created = await request(baseUrl, '/menu-management/items', {
    role: 'admin',
    method: 'POST',
    body: menuItem(),
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, 'approved');

  const updated = await request(baseUrl, `/menu-management/items/${created.data.item.id}`, {
    role: 'admin',
    method: 'PUT',
    body: menuItem({ title: 'Admin Edit' }),
  });
  assert.equal(updated.data.status, 'approved');
  const deleted = await request(baseUrl, `/menu-management/items/${created.data.item.id}`, {
    role: 'admin',
    method: 'DELETE',
  });
  assert.equal(deleted.data.status, 'approved');

  const forbidden = await request(baseUrl, '/admin/menu-change-requests', { role: 'staff' });
  assert.equal(forbidden.status, 403);
});

test('administrator rejection records the decision without publishing the proposed item', async (t) => {
  const { baseUrl, repository } = await createFixture(t);
  const submitted = await request(baseUrl, '/menu-management/items', {
    role: 'staff',
    method: 'POST',
    body: menuItem({ title: 'Unapproved Dish' }),
  });
  const rejected = await request(baseUrl, `/admin/menu-change-requests/${submitted.data.request.id}`, {
    role: 'admin',
    method: 'PUT',
    body: { decision: 'reject' },
  });
  assert.equal(rejected.data.status, 'rejected');
  assert.equal((await request(baseUrl, '/menu-management/items', { role: 'staff' })).data.length, 0);
  assert.equal(repository.history.at(-1).changed_by, 1);
});

test('device and camera image uploads are stored locally and reject invalid image data', async (t) => {
  const { baseUrl, uploadDirectory } = await createFixture(t);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rWQAAAAASUVORK5CYII=',
    'base64',
  );
  const uploadBody = new FormData();
  uploadBody.append('image', new Blob([png], { type: 'image/png' }), 'menu.png');
  const uploaded = await request(baseUrl, '/menu-management/images', {
    role: 'staff',
    method: 'POST',
    body: uploadBody,
  });
  assert.equal(uploaded.status, 201);
  assert.match(uploaded.data.image_url, /^\.\/images\/uploads\/menu_\d+_[a-f0-9]+\.png$/);
  assert.equal(fs.existsSync(path.join(uploadDirectory, path.basename(uploaded.data.image_url))), true);

  const cameraBody = new FormData();
  cameraBody.append('image', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }), 'camera.jpg');
  const cameraUpload = await request(baseUrl, '/menu-management/images', {
    role: 'staff',
    method: 'POST',
    body: cameraBody,
  });
  assert.equal(cameraUpload.status, 201);
  assert.match(cameraUpload.data.image_url, /^\.\/images\/uploads\/menu_\d+_[a-f0-9]+\.jpg$/);

  const spoofedBody = new FormData();
  spoofedBody.append('image', new Blob(['not a PNG'], { type: 'image/png' }), 'bad.png');
  const rejected = await request(baseUrl, '/menu-management/images', {
    role: 'staff',
    method: 'POST',
    body: spoofedBody,
  });
  assert.equal(rejected.status, 400);
});

test('invalid menu values and unauthenticated requests are rejected', async (t) => {
  const { baseUrl } = await createFixture(t);
  const unauthorized = await request(baseUrl, '/menu-management/items');
  assert.equal(unauthorized.status, 401);
  const invalid = await request(baseUrl, '/menu-management/items', {
    role: 'staff',
    method: 'POST',
    body: menuItem({ category: 'Unlisted', price: -1 }),
  });
  assert.equal(invalid.status, 400);
  const missingBody = await request(baseUrl, '/menu-management/items', {
    role: 'staff',
    method: 'POST',
  });
  assert.equal(missingBody.status, 400);
});

test('missing workflow database tables return an actionable migration error', async (t) => {
  const repository = new MemoryMenuRepository();
  repository.requestChange = async () => {
    const error = new Error('Table menu_change_requests does not exist');
    error.code = 'ER_NO_SUCH_TABLE';
    throw error;
  };
  const { baseUrl } = await createFixture(t, repository);
  const response = await request(baseUrl, '/menu-management/items/70', {
    role: 'staff',
    method: 'PUT',
    body: menuItem(),
  });
  assert.equal(response.status, 503);
  assert.match(response.data.error, /menu-approval-migration\.sql/);
});
