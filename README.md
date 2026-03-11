# 🛒 E-Commerce Microservices

A minimal but complete microservices-based e-commerce backend built with **Node.js (Express)**, **PostgreSQL**, and **Docker Compose**. Designed as a learning project for Microservice Architecture.

---

## 🏗️ Architecture

```
                         ┌─────────────────────────────────┐
  Client (curl/Postman)  │         API Gateway :3000        │
  ──────────────────────►│  • Rate limiting                 │
                         │  • JWT Auth middleware           │
                         │  • Request routing / proxying    │
                         └────────┬──────────┬─────────┬───┘
                                  │          │         │
                    ┌─────────────▼─┐ ┌──────▼────┐ ┌─▼───────────┐
                    │ User Service  │ │  Product  │ │    Order    │
                    │    :3001      │ │  Service  │ │   Service   │
                    │               │ │   :3002   │ │    :3003    │
                    └──────┬────────┘ └─────┬─────┘ └──────┬──────┘
                           │               │               │
                    ┌──────▼──────┐ ┌──────▼─────┐ ┌──────▼──────┐
                    │  users-db   │ │ products-db│ │  orders-db  │
                    │ PostgreSQL  │ │ PostgreSQL │ │  PostgreSQL │
                    └─────────────┘ └────────────┘ └─────────────┘
```

### Key Concepts Demonstrated
- **Database per service** — each service owns its data
- **Custom API Gateway** — single entry point for all clients
- **Inter-service communication** — Order Service calls Product Service via HTTP (synchronous)
- **JWT propagation** — gateway validates token and passes user context as headers
- **Docker networking** — services communicate via internal Docker network

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

### Run everything
```bash
git clone <repo>
cd ecommerce
docker compose up --build
```

All services start automatically. The gateway is available at **http://localhost:3000**.

---

## 📡 API Reference

All requests go through the gateway at `http://localhost:3000`.

### 🔓 Public Routes (no token needed)

#### Register
```bash
POST /api/users/register
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "secret123",
  "role": "user"          # or "admin"
}
```

#### Login
```bash
POST /api/users/login
Content-Type: application/json

{ "email": "alice@example.com", "password": "secret123" }

# Response includes: { "token": "eyJ..." }
```

#### List Products
```bash
GET /api/products
GET /api/products?category=Electronics
GET /api/products?search=keyboard&page=1&limit=5
GET /api/products/:id
```

---

### 🔒 Protected Routes (send `Authorization: Bearer <token>`)

#### User Profile
```bash
GET /api/users/profile
Authorization: Bearer <token>
```

#### Place an Order
```bash
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

#### My Orders
```bash
GET /api/orders
Authorization: Bearer <token>

GET /api/orders/:id
Authorization: Bearer <token>
```

---

### 🔑 Admin Only Routes

#### Create Product
```bash
POST /api/products
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Gaming Mouse",
  "description": "High-DPI gaming mouse",
  "price": 45.99,
  "stock": 100,
  "category": "Electronics"
}
```

#### Update / Delete Product
```bash
PUT    /api/products/:id    # Authorization: Bearer <admin_token>
DELETE /api/products/:id    # Authorization: Bearer <admin_token>
```

#### Update Order Status
```bash
PUT /api/orders/:id/status
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "status": "shipped" }  # pending | confirmed | shipped | delivered | cancelled
```

---

## 🏥 Health Checks

```bash
GET http://localhost:3000/health          # Gateway
GET http://localhost:3000/api/users/health     # (via gateway)
```

---

## 📁 Project Structure

```
ecommerce/
├── docker-compose.yml
├── api-gateway/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                 # Entry point, rate limiting, CORS
│       ├── middleware/
│       │   └── auth.js              # JWT validation, public route whitelist
│       ├── routes/
│       │   └── proxy.js             # http-proxy-middleware setup
│       └── utils/
│           └── logger.js
├── user-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── models/db.js             # PG pool + table init
│       ├── controllers/authController.js
│       └── routes/userRoutes.js
├── product-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── models/db.js             # PG pool + seeded products
│       ├── controllers/productController.js
│       └── routes/productRoutes.js
└── order-service/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── models/db.js
        ├── controllers/orderController.js
        └── routes/orderRoutes.js
```

---

## 🔧 Useful Commands

```bash
# View logs for a specific service
docker compose logs -f api-gateway
docker compose logs -f order-service

# Rebuild a single service after code change
docker compose up --build product-service

# Stop everything and remove volumes (fresh start)
docker compose down -v

# Connect to a database
docker exec -it users-db psql -U postgres -d users_db
docker exec -it products-db psql -U postgres -d products_db
docker exec -it orders-db psql -U postgres -d orders_db
```

---

## 🧪 Quick Test with curl

```bash
# 1. Register
curl -s -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"pass123"}' | jq

# 2. Login → grab token
TOKEN=$(curl -s -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"pass123"}' | jq -r '.token')

# 3. Browse products
curl -s http://localhost:3000/api/products | jq

# 4. Place an order
curl -s -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":1}]}' | jq

# 5. View orders
curl -s http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 📚 What to Learn Next

1. **Message Queue** — Replace sync HTTP calls with RabbitMQ/Kafka for async communication
2. **Service Discovery** — Use Consul or Kubernetes DNS instead of hardcoded URLs
3. **Circuit Breaker** — Add resilience with a library like `opossum`
4. **Centralized Logging** — Ship logs to ELK Stack or Loki
5. **Distributed Tracing** — Add request tracing with OpenTelemetry
6. **API Gateway v2** — Swap custom gateway for Kong or AWS API Gateway
