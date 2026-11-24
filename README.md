# Yummy Food Hub

Yummy Food Hub is a food ordering and delivery platform built with HTML, CSS, vanilla JavaScript, Node.js, Express, and MySQL.

## Features

- Customers can register, sign in, browse and search the menu, place pickup or delivery orders, and track order history.
- Staff and admins manage inventory, order stages, delivery operations, rider availability, and the dashboard.
- Riders view ready deliveries, accept a delivery, and update it through pickup, in-transit, and completion stages.
- Delivery claims are serialized so only one rider can accept an order. Riders become unavailable while they have active deliveries and available again when all active deliveries are complete.
- Orders and rider delivery status refresh automatically on the customer and rider pages.

## Project structure

```text
yummy-food-hub-webapp/
├── README.md
├── yummy-backend/
│   ├── package.json
│   ├── server.js
│   ├── delivery-migration.sql
│   ├── delivery-claim-migration.sql
│   └── legacy-data-cleanup-migration.sql
└── yummy-web/
    ├── app.js
    ├── index.html
    └── styles.css
```

## Database setup

The database must already contain the core `users`, `menu_items`, `orders`, and `order_items` tables. Delivery support uses `delivery_riders`, `deliveries`, and `order_status_history`.

Apply the migrations in order:

1. `yummy-backend/delivery-migration.sql`
2. `yummy-backend/delivery-claim-migration.sql`
3. `yummy-backend/legacy-data-cleanup-migration.sql`

The cleanup migration removes legacy menu and order fields and an unused table. Back up the database before applying it.

The server seeds the standard 14-item menu and preserves existing stock and order history. It also creates a missing `image_url` column when needed.

### Accounts and roles

New accounts are customers. To grant staff or admin access, update the user's role in MySQL:

```sql
UPDATE users SET role = 'staff' WHERE email = 'staff@example.com';
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

To grant rider access:

```sql
UPDATE users SET role = 'rider' WHERE email = 'rider@example.com';
```

Rider profiles are automatically synchronized from users with the `rider` role. No manual delivery-rider record is required. The rider roster displays the user's name and email, a profile phone number when present, and availability.

## Run locally

Requirements: Node.js and a MySQL database with the core tables.

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for your database. Then run:

```powershell
cd yummy-backend
npm install
npm start
```

Open `http://localhost:3107`. The health endpoint is `http://localhost:3107/api/health`.

## Main API routes

- `GET /api/health` — service health
- `POST /register`, `POST /login`, `POST /logout` — account access
- `GET /menu` — standard menu
- `POST /order` — place an order
- `GET /orders/:userId` — signed-in customer's order history and tracking
- `GET /staff/orders` — staff order queue
- `PUT /orders/:id/status` — staff order-stage update
- `PUT /staff/order-items/:lineId/status` — staff order-item decision
- `GET /inventory`, `PUT /inventory/:id` — staff inventory operations
- `GET /admin/dashboard` — staff/admin summary and recent orders
- `GET /admin/deliveries` — delivery operations and rider roster
- `GET /admin/riders` — users with the rider role and availability
- `GET /rider/available-deliveries` — ready delivery orders open for claims
- `POST /rider/deliveries/:orderId/accept` — claim a delivery
- `GET /rider/deliveries` — deliveries assigned to the signed-in rider
- `PUT /rider/deliveries/:deliveryId/status` — rider delivery-stage update
- `GET /orders/:orderId/delivery-history` — authorized order and delivery history

## Deployment

The included `render.yaml` configures deployment on Render. Create a MySQL database, apply the migrations above, configure the database environment variables, and deploy the repository. Sessions are held in server memory, so a server restart signs users out and multiple server instances are not supported.
