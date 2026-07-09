# Custom Domain Multi-Tenant POC

A proof of concept that demonstrates how a single application can serve different tenants based on the custom domain used to access it.

## Problem Statement

SaaS applications need to support custom domains (e.g. `portal.abc.com`, `app.xyz.io`) so that each customer can white-label the product under their own brand. The core question this POC answers:

> If someone visits `abc.com`, can the application automatically know "this belongs to Tenant ABC"?

## Architecture

```
Browser → HTTP Request (Host: portal.abc.com)
              │
              ▼
       Express Middleware
              │
      Reads req.headers.host
              │
              ▼
     MongoDB — Domain Lookup
              │
    Domain.findOne({ domain, status: 'verified' })
              │
         .populate('tenantId')
              │
              ▼
     Returns Tenant — "ABC Pvt Ltd"
              │
              ▼
     HTML Response — "Welcome ABC Pvt Ltd"
```

### Actors

| Role | Description |
|---|---|
| **Super Admin** | Creates tenants and assigns domains (via admin UI) |
| **Tenant (Customer)** | Configures DNS — points their domain to the server |
| **End User** | Visits the custom domain — sees the tenant-specific page |

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Express (Node.js) |
| Database | MongoDB (Atlas) |
| ODM | Mongoose |
| Admin UI | Static HTML + Vanilla JS + CSS |

## Database Schema

### Tenants

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `tenantName` | String | e.g. "ABC Pvt Ltd" |
| `status` | String | `active` or `inactive` |

### Domains

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `domain` | String | Normalized, unique, lowercase |
| `tenantId` | ObjectId (ref: Tenant) | The tenant this domain belongs to |
| `status` | String | `pending` → `verified` → `inactive` |

## Project Structure

```
custom-domain-poc/
├── admin/                   # Super Admin UI
│   ├── index.html           # Tenant list page
│   ├── tenant.html          # Tenant detail / domain management
│   ├── admin.js             # Tenant CRUD logic
│   ├── tenant.js            # Domain CRUD logic
│   └── style.css            # Shared styles
├── middleware/
│   └── tenantLookup.js      # Core logic: Host header → Tenant
├── models/
│   ├── Tenant.js            # Mongoose schema
│   └── Domain.js            # Mongoose schema
├── routes/
│   ├── tenants.js           # API: list, create, delete tenants
│   └── domains.js           # API: list, create, update, delete domains
├── utils/
│   └── normalizeDomain.js   # Strip protocol/path, lowercase
├── server.js                # Entry point
├── .env                     # Environment variables
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)

### Installation

```bash
git clone <repo-url>
cd custom-domain-poc
npm install
```

### Configuration

Create a `.env` file (or edit the existing one):

```
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/poc-dns?retryWrites=true&w=majority
```

### Run

```bash
node server.js
```

## Local Testing with Custom Domains

Since you can't use real DNS locally, edit your `/etc/hosts` file to map test domains to `127.0.0.1`:

```
127.0.0.1 portal.abc.local
127.0.0.1 xyz.local
127.0.0.1 company.local
```

Then open `http://localhost:3000/admin` to manage tenants and domains.

## Demo Steps

### 1. Create a Tenant

- Open `http://localhost:3000/admin`
- Enter "ABC Pvt Ltd" and click **Create Tenant**
- The tenant appears in the list

### 2. Add a Domain

- Click **View Domains** next to "ABC Pvt Ltd"
- Enter `portal.abc.local` and click **Add Domain**
- The domain appears with status **Pending**

### 3. Verify the Domain

- Click **Verify** — status changes to **Verified**

### 4. Visit the Domain

- Open `http://portal.abc.local:3000` in your browser
- You should see: **Welcome ABC Pvt Ltd**

### 5. Visit an Unknown Domain

- Open `http://xyz.local:3000`
- You should see: **Unknown Domain**

### 6. Deactivate the Domain

- Go back to the admin UI
- Click **Deactivate** on the domain
- Refresh `http://portal.abc.local:3000`
- You should see: **Domain Disabled**

### 7. Test via JSON API

```bash
curl http://portal.abc.local:3000/api/tenant
```

Response:
```json
{ "tenant": "ABC Pvt Ltd", "domain": "portal.abc.local", "status": "verified" }
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tenants` | List all tenants |
| `POST` | `/api/tenants` | Create tenant `{ tenantName }` |
| `DELETE` | `/api/tenants/:id` | Delete tenant + its domains |
| `GET` | `/api/domains/:tenantId` | List domains for a tenant |
| `POST` | `/api/domains` | Add domain `{ domain, tenantId }` |
| `PATCH` | `/api/domains/:id` | Update status `{ status }` |
| `DELETE` | `/api/domains/:id` | Delete domain |
| `GET` | `/api/tenant` | JSON info for current Host header |

## What This POC Proves

✅ A single Express application can read the `Host` header from an incoming request

✅ It can look up the domain in a database and identify the tenant

✅ It can return a tenant-specific response — HTML or JSON

✅ Multiple domains can point to the same tenant

✅ Domain lifecycle (pending → verified → inactive) works at runtime

✅ Unknown or disabled domains are handled gracefully

## What Is NOT Included

- Authentication / login / signup / JWT
- User roles and permissions
- Payments / billing
- Analytics / dashboards
- Automatic SSL certificate provisioning
- DNS verification (TXT records)
- Wildcard subdomain support
- CDN / caching layer

## Future Scope

- **Auto SSL** — Let's Encrypt + Certbot per custom domain
- **DNS Verification** — TXT record check before auto-verifying
- **Wildcard Subdomains** — `*.abc.com` → Tenant ABC
- **Production Deployment** — Hostinger VPS + Coolify
- **Rate Limiting** — Per-tenant rate limits
- **Caching** — In-memory domain → tenant cache for performance
