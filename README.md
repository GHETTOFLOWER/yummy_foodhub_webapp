# Yummy Food Hub

Yummy Food Hub is a food ordering app. Customers can browse dishes, add them to a cart, and place orders. Staff and admins can manage stock and orders.

The app uses:

- Frontend: HTML, CSS, and JavaScript in `yummy-web/`
- Backend: Node.js and Express in `yummy-backend/`
- Database: MySQL
- Sign-in: sessions stored in server memory

---

## Project structure

```text
yummy-food-hub-webapp/
├── README.md
├── yummy-backend/
│   ├── package.json
│   ├── server.js
│   └── node_modules/
└── yummy-web/
    ├── app.js
    ├── index.html
    └── styles.css
```

### What each folder does

- `yummy-web/`: the website
- `yummy-backend/server.js`: the API and database code
- `yummy-backend/package.json`: backend packages and start command

---

## Core app behavior

### Customers

Customers can create an account, browse and search the 14-dish menu, place orders, and view their own order history.

When a customer orders:

- Enough stock: the item is approved.
- Not enough stock: the item waits for staff or admin review.
- Stock is reduced when an item is approved.

### Sellers

Sellers can add dishes, update stock, review their orders, and see their sales. The customer menu and inventory show only the 14 default Ugandan dishes.

### Staff and admins

Staff and admins can update stock and review customer orders. Admins can also view sales and order summaries. The inventory screen shows the 14 default Ugandan dishes.

---

## User roles

| Role | Typical purpose |
| --- | --- |
| `customer` | browse, order, and view personal order history |
| `staff` | manage inventory and approve/reject orders |
| `admin` | full oversight of orders, sales, and platform dashboards |
| `rider` | view and update deliveries assigned to the linked rider profile |

New accounts are customers. To make an account staff or admin, change its role in MySQL.

---

## Business rules in the app

The backend checks that users manage only their own orders and dishes. Staff and admins can manage all order items. Stock and order totals update when items are approved.

### Commission logic

For an approved seller dish, the app records the platform fee and the seller's earnings.

---

## Database

The app connects to MySQL using the `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` environment variables. If these are not set, it uses the defaults in `yummy-backend/server.js`. The default database name is `sql7839427`.

The database must have these tables:

- `users`
- `menu_items`
- `recipe_ingredients`
- `orders`
- `order_items`
- `delivery_riders`
- `deliveries`

The server uses them for accounts, dishes, orders, stock, and reports.

### Enable delivery and rider accounts

Run [`yummy-backend/delivery-migration.sql`](./yummy-backend/delivery-migration.sql) once if the database has not already been migrated for delivery support. It widens role/order status values, links and backfills rider profiles to user accounts, automatically creates rider profiles when a user's role becomes `rider`, adds delivery-stage timestamps, and creates order status history without dropping existing records. Apply [`yummy-backend/delivery-claim-migration.sql`](./yummy-backend/delivery-claim-migration.sql) once for rider-claimed deliveries; it adds indexes for the ready-order lookup and claim-conflict check.

Create a rider's login through the normal registration flow, then grant the rider role in MySQL:

```sql
UPDATE users SET role = 'rider' WHERE email = 'rider@example.com';
```

The rider appears in the admin delivery roster without manually creating or linking a `delivery_riders` row. The roster displays the user's name and email, plus a phone number when one is recorded on the rider profile. When a delivery order is marked ready, it appears in the Available Deliveries page for available riders. The first rider to accept it is assigned atomically; the order disappears from the other riders' lists and the rider remains busy until all active deliveries are complete. Customers' My orders page refreshes delivery progress automatically. Staff/admin manage order stages; riders accept and update their assigned delivery stages.

---

## Run the app locally

You need Node.js and a MySQL database. The database must already have the core app tables. The server adds the 14 Ugandan dishes when it starts.

The server uses the database defaults in `yummy-backend/server.js`. To use different settings, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in your environment. Do not share your database password.

In PowerShell, run:

```powershell
cd yummy-backend
npm install
npm start
```

The app runs at:

```text
http://localhost:3107
```

Check that the server is running:

```text
http://localhost:3107/api/health
```

The server also serves the website, so open the app at `http://localhost:3107`.

## Deploy online with Render

The `render.yaml` file sets up the app on Render.

1. Create a MySQL database and load the core app tables.
2. Apply `yummy-backend/delivery-migration.sql` once if delivery support has not already been enabled.
3. Apply `yummy-backend/delivery-claim-migration.sql` once.
4. Push this project to GitHub.
5. In Render, create a Blueprint from this project.
6. Add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in Render's environment settings.
7. Deploy. Open `/api/health` to check the server, then open the service URL to use the app.

Login sessions are stored in server memory. Restarting the server signs users out. Multiple server copies are not supported.

---

## API routes

Main routes:

- `GET /api/health` — checks if the server is responding
- `POST /register` — register a new customer account
- `POST /login` — sign in and get a bearer token
- `POST /logout` — end the session
- `GET /menu` — get the 14 Ugandan dishes and their ingredients
- `POST /order` — place an order for one or more dishes
- `GET /orders/:userId` — view a customer’s order history
- `POST /recipes` — add a seller dish
- `GET /recipes/user/:userId` — view a seller's dishes
- `GET /inventory` — view the 14 dishes and stock (staff/admin)
- `PUT /inventory/:id` — update a dish’s stock quantity
- `GET /staff/orders` — review the full order queue
- `GET /admin/dashboard` — view admin totals and recent orders
- `GET /admin/deliveries` — view delivery orders, rider availability, and status history
- `GET /admin/riders` — list users with the rider role and their availability
- `GET /admin/riders/available` — list available riders with login accounts
- `PUT /admin/deliveries/:deliveryId/status` — administer a delivery stage
- `GET /rider/available-deliveries` — list ready delivery orders for an available rider
- `POST /rider/deliveries/:orderId/accept` — atomically accept and assign a ready delivery
- `GET /rider/deliveries` — view deliveries assigned to the signed-in rider
- `PUT /rider/deliveries/:deliveryId/status` — update an assigned delivery status
- `GET /orders/:orderId/delivery-history` — view authorized order and delivery status history
- `GET /seller/orders` — view sales tied to a seller
- `GET /seller/dashboard` — view seller earnings and stats

---

## Make a user staff or admin

Create the account in the app, then change its role in MySQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@yummy.com';
```

For a staff account:

```sql
UPDATE users SET role = 'staff' WHERE email = 'staff@yummy.com';
```

Sign out and back in. Choose Staff / Admin on the sign-in screen.

---

## Order flow

1. A customer signs in and chooses dishes.
2. The customer places an order.
3. Items with enough stock are approved.
4. Staff or admins review items that need attention.
5. The dashboard shows updated orders and sales.

---

## Troubleshooting

### Server fails to start

- Make sure MySQL is running.
- Check the database name, host, port, and login settings.
- Run `npm install` in `yummy-backend`.

### Login or registration fails

- Make sure the `users` table exists.
- Check that the app uses the right database.

### Menu does not load

- Make sure the server is running at `http://localhost:3107`.
- Open `http://localhost:3107/api/health` to check it.
- Make sure the core database tables exist. The server adds the 14 dishes when it starts.
- Old dishes with order history stay in the database, but do not appear in the menu or inventory.

### Access denied

- Customers can only use customer features.
- Sellers can manage their own dishes.
- Staff and admin roles must be set in MySQL.

---

## Notes

The frontend is plain HTML, CSS, and JavaScript. Express handles the API, and MySQL stores the app data.
