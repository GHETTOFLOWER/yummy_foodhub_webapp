# Higher Level Restaurant & Takeaway Uganda

Higher Level is a restaurant ordering and operations website built with Node.js, Express, MySQL, HTML, CSS, and vanilla JavaScript.

## Current features

- Customer registration and login
- Menu browsing, search, categories, cart, and food ordering
- Pickup, delivery, scheduled orders, and delivery tracking
- Catering services and request management
- Rider management and delivery assignment
- Inventory management
- Food ratings and reviews (1–5 stars, optional comments, limited to fulfilled purchases)
- Average menu-item ratings and review counts
- Beverages menu with local product images
- Responsive Contact Us section, WhatsApp actions, and Google Maps directions
- Restaurant dashboard
- Staff menu-change approval workflow
- Local menu-image upload with separate gallery/files and camera selection, plus image preview

## User roles

| Role | Main capabilities |
| --- | --- |
| Customer | Register, sign in, browse the menu, order, track orders, request catering, and review fulfilled purchases |
| Staff | Manage orders, inventory, catering, and deliveries; create or edit menu items and submit deletion requests for administrator review |
| Administrator | Staff capabilities plus immediate menu creation, editing, and deletion; review and approve or reject staff menu requests |
| Rider | View available deliveries, accept assigned work, and update delivery progress |

Newly registered accounts are customers. An administrator can assign staff, administrator, or rider roles in MySQL:

```sql
UPDATE users SET role = 'staff' WHERE email = 'staff@example.com';
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
UPDATE users SET role = 'rider' WHERE email = 'rider@example.com';
```

### Customer features

Customers can register, sign in, browse and search menu categories, manage a cart, place pickup or delivery orders, schedule orders, track order status, submit catering requests, and review fulfilled meals.

### Admin features

Administrators can manage orders, inventory, catering, and deliveries; create, edit, and delete menu items immediately; and approve or reject staff menu-change requests.

### Staff features

Staff can manage restaurant operations and inventory, and create or edit dishes and beverages or request deletion. Staff menu changes stay pending until an administrator reviews them.

### Rider features

Riders can view available delivery orders, accept a delivery, and update its progress through pickup, transit, and completion.

## Installation instructions

Requirements:

- Node.js 18 or newer
- MySQL with the application's existing core schema (`users`, `menu_items`, `orders`, and `order_items`)

Install the backend dependencies:

```powershell
cd yummy-backend
npm install
```

Configure the database connection in the current PowerShell session, then start the server:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_USER = "your_mysql_user"
$env:DB_PASSWORD = "your_mysql_password"
$env:DB_NAME = "your_database"
npm start
```

The Express server serves both the API and website at `http://localhost:3107` by default. Set `PORT` to change the listening port.

## Database setup

The repository expects the existing application schema, including the user, menu, order, catering, delivery, rider, and order-history data used by the server. Apply these included SQL migrations after the core tables exist:

1. `yummy-backend/food-reviews-migration.sql`
2. `yummy-backend/menu-approval-migration.sql`

For example, from the repository root:

```powershell
mysql -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -p $env:DB_NAME < .\yummy-backend\food-reviews-migration.sql
mysql -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -p $env:DB_NAME < .\yummy-backend\menu-approval-migration.sql
```

The food-review migration creates `food_reviews`. The menu-approval migration creates `menu_change_requests` and `menu_change_request_history` for request and reviewer audit history. It expects `menu_items.is_active` to exist already; this column is present in the current database. Workflow foreign-key IDs use `INT UNSIGNED` to match the existing `menu_items` and `users` IDs. Run each migration once against the intended database; back up existing data before schema changes.

The server seeds its standard menu and beverages on startup. Menu items added through menu management are stored in MySQL and are not restricted to the standard seed list. Approved deletions deactivate items rather than removing records, preserving order references and history.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `DB_HOST` | MySQL host | Existing server configuration |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL user | Existing server configuration |
| `DB_PASSWORD` | MySQL password | Existing server configuration |
| `DB_NAME` | Database name | Existing server configuration |
| `PORT` | Express listening port | `3107` |

Set database values in the environment rather than adding credentials to source files.

## Menu approval workflow

- Administrators' create, edit, and delete actions take effect immediately.
- Staff create and edit actions are saved as `pending_create` and `pending_edit` requests; staff deletion is saved as `pending_delete`.
- Pending staff changes do not alter the customer menu.
- Administrators can review each request, inspect the proposed values and image, then approve or reject it.
- Approved requests are marked `approved`; rejected requests are marked `rejected`. Requester, reviewer, submission, review, and status history are stored in MySQL.
- An administrator's approved deletion deactivates the menu item; order history remains intact.
- Menu images are limited to JPEG, PNG, GIF, or WebP files up to 8 MB. Uploaded files receive unique names and are stored under `yummy-web/images/uploads/`. The regular image chooser has `accept="image/*"` without a camera-capture hint so mobile browsers can offer gallery and device files. A separate **Take a photo** control uses `capture="environment"` on supported devices. Either selection shows a preview and uploads through the same endpoint.
- Administrators can verify the required workflow schema against the configured database with `GET /admin/menu-change-requests/health`. It checks the workflow request and history tables and `menu_items.is_active`; a missing table or column returns an actionable migration error.
- Menu workflow server logs include a request ID, route, HTTP status, duration, and signed-in user role/ID. Browser-console diagnostics use the `[menu-workflow]` prefix and report API, upload, form, delete, and review outcomes without logging credentials or image contents.

## Testing instructions

Run the backend tests from the repository root:

```powershell
npm --prefix yummy-backend test
```

The tests exercise the HTTP workflow for staff dish and beverage edits/deletions, administrator review and approval, immediate administrator dish and beverage changes, authorization, input validation, schema-health reporting, image uploads from gallery/files/camera sources, served image bytes, and re-fetching saved menu state. They use an in-memory repository and do not require a MySQL service; the SQL schema-health query shape is also checked with a test pool. For a live database check, apply the migrations to a dedicated test database and call `GET /admin/menu-change-requests/health` while signed in as an administrator.

On a real phone or tablet, verify both image controls separately: select an image using the gallery/files chooser, then select **Take a photo** and grant camera access. Confirm the preview before saving and verify the resulting image appears after an administrator approves the menu change. Browser automation can verify upload handling but cannot substitute for device camera permission and hardware testing.

## Main API routes

- `GET /menu` — active customer menu with average ratings and review counts
- `POST /food-reviews` — submit a review for a fulfilled purchase
- `POST /order`; `GET /orders/:userId` — create and view orders
- `GET /menu-management/items` — active items for staff and administrators
- `POST /menu-management/items`, `PUT /menu-management/items/:id`, `DELETE /menu-management/items/:id` — create, edit, and remove menu items according to the signed-in role
- `POST /menu-management/images` — upload a menu image
- `GET /menu-change-requests/mine` — current user's submitted menu requests
- `GET /admin/menu-change-requests` — administrator list of pending menu requests
- `GET /admin/menu-change-requests/health` — administrator-only workflow schema check
- `PUT /admin/menu-change-requests/:id` — approve or reject a pending request
- `GET /inventory`, `PUT /inventory/:id` — inventory operations
- `GET /admin/dashboard` — restaurant operations summary
- Catering, staff order, rider, delivery, and tracking routes are available in `yummy-backend/server.js`.

## Recent system enhancements

- Added beverage menu items and local beverage image paths.
- Added purchase-verified food ratings and review summaries.
- Added the restaurant Contact Us section, phone and WhatsApp actions, and responsive map.
- Added the staff menu approval workflow, administrator review page, audit history, and local image upload with distinct gallery/files and camera controls.
- Added staff-facing form and API diagnostics, server request/error logs, and an administrator-only workflow schema health endpoint.
