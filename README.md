# 🛒 E-Commerce Microservices

A minimal but complete microservices-based e-commerce backend built with **Node.js (Express)**, **FastAPI (Python)**, **PostgreSQL**, and **Docker Compose**. Designed as a learning project for Microservice Architecture.

---

## 🏗️ Architecture

```text
Client
  -> API Gateway (3000)
      -> User Service (3001) -> users-db (PostgreSQL)
      -> Product Service (3002) -> products-db (PostgreSQL)
      -> Order Service (3003) -> orders-db (PostgreSQL)

Internal service-to-service calls:
- Order Service -> Product Service (stock checks/reduction)
- Order Service -> User Service (user email lookup)
- Order Service -> Notification Service (FastAPI, 3004) for order completion emails
```

### Key Concepts Demonstrated
- **Database per service** — each service owns its data
- **Custom API Gateway** — single entry point for all clients
- **Inter-service communication** — Order Service calls Product Service via HTTP (synchronous)
- **Order completion notification** — Order Service calls Notification Service when an order is delivered/completed
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

For Gmail SMTP delivery, set values in `notification-service/.env.example` (or replace with your own private `.env` file and point `env_file` to it):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your-gmail-address@gmail.com
```

Use a **Gmail App Password** (16 chars), not your regular Gmail account password.

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

{ "status": "completed" }  # pending | confirmed | shipped | delivered | completed | cancelled
```

Use `completed` (or `delivered`) to trigger order completion email notifications.

#### Internal Notification Endpoint (service-to-service)

```bash
POST http://notification-service:3004/notify/order-completed
Content-Type: application/json

{
  "to_email": "customer@example.com",
  "customer_name": "Alice",
  "order_id": 123,
  "total_price": 59.99
}
```

---

## 🏥 Health Checks

```bash
GET http://localhost:3000/health          # Gateway
GET http://localhost:3000/api/users/health     # (via gateway)
GET http://localhost:3000/api/products/health  # (via gateway)
GET http://localhost:3000/api/orders/health    # (via gateway)

# Internal only (Docker network)
GET http://notification-service:3004/health
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
├── order-service/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── models/db.js
        ├── controllers/orderController.js
        └── routes/orderRoutes.js
└── notification-service/
│   ├── Dockerfile
│   ├── .env.example
│   ├── requirements.txt
│   └── app/
│       └── main.py
```

---

## 🔧 Useful Commands

```bash
# View logs for a specific service
docker compose logs -f api-gateway
docker compose logs -f order-service
docker compose logs -f notification-service

# Rebuild a single service after code change
docker compose up --build product-service

# Rebuild notification service only
docker compose up --build notification-service

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

# 6. (Admin) Mark order as completed to trigger email
curl -s -X PUT http://localhost:3000/api/orders/1/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' | jq
```

---

## 📚 What to Learn Next

1. **Message Queue** — Replace sync HTTP calls with RabbitMQ/Kafka for async communication
2. **Service Discovery** — Use Consul or Kubernetes DNS instead of hardcoded URLs
3. **Circuit Breaker** — Add resilience with a library like `opossum`
4. **Centralized Logging** — Ship logs to ELK Stack or Loki
5. **Distributed Tracing** — Add request tracing with OpenTelemetry
6. **API Gateway v2** — Swap custom gateway for Kong or AWS API Gateway
