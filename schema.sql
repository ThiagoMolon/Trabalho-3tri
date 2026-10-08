-- =====================================================================
-- Origin & Beans - Banco simplificado (PostgreSQL 12+)
-- pgAdmin: crie o banco (CREATE DATABASE origin_beans;), abra a
-- Query Tool nele, carregue este arquivo e execute (F5).
-- =====================================================================

-- 1. USUÁRIOS -----------------------------------------------------------
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(20),
    role           VARCHAR(10) NOT NULL DEFAULT 'customer'
                   CHECK (role IN ('customer', 'admin')),
    taste_profile  JSONB,   -- resultado do Taste Finder, ex: {"acidity":7,"bitterness":3,"sweetness":8}
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE addresses (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cep           CHAR(8) NOT NULL,
    street        VARCHAR(200) NOT NULL,
    number        VARCHAR(20) NOT NULL,
    complement    VARCHAR(100),
    neighborhood  VARCHAR(100) NOT NULL,
    city          VARCHAR(100) NOT NULL,
    state         CHAR(2) NOT NULL
);

-- 2. PRODUTOS -----------------------------------------------------------
CREATE TABLE products (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    category       VARCHAR(20) NOT NULL
                   CHECK (category IN ('graos', 'moidos', 'acessorios', 'kits')),
    description    TEXT,
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    weight_grams   INT,
    image_url      VARCHAR(500),
    -- detalhes do café (nulos para acessórios e kits)
    origin         VARCHAR(150),
    producer       VARCHAR(150),
    altitude       INT,
    variety        VARCHAR(100),
    score          NUMERIC(4,1),
    sensory_notes  TEXT[],   -- ex: {'chocolate','caramelo','cítrico'}
    stock          INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE roast_batches (
    id           SERIAL PRIMARY KEY,
    product_id   INT NOT NULL REFERENCES products(id),
    batch_code   VARCHAR(50) NOT NULL UNIQUE,
    roast_date   DATE NOT NULL,
    quantity_kg  NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0)
);

-- 3. ASSINATURAS --------------------------------------------------------
CREATE TABLE subscription_plans (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    weight_grams  INT NOT NULL,
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),   -- por entrega
    active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE subscriptions (
    id                       SERIAL PRIMARY KEY,
    user_id                  INT NOT NULL REFERENCES users(id),
    plan_id                  INT NOT NULL REFERENCES subscription_plans(id),
    product_id               INT REFERENCES products(id),      -- café escolhido
    address_id               INT NOT NULL REFERENCES addresses(id),
    grind                    VARCHAR(50) NOT NULL,             -- grãos inteiros, espresso, filtro...
    frequency                VARCHAR(10) NOT NULL
                             CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    status                   VARCHAR(10) NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'paused', 'canceled')),
    next_renewal_date        DATE,
    gateway_subscription_id  VARCHAR(100),                     -- id no Stripe/Mercado Pago
    started_at               TIMESTAMP NOT NULL DEFAULT NOW(),
    canceled_at              TIMESTAMP                         -- base do cálculo de churn
);

-- 4. PEDIDOS ------------------------------------------------------------
CREATE TABLE orders (
    id                  SERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(id),
    shipping_address    JSONB NOT NULL,        -- cópia do endereço no momento da compra
    subtotal            NUMERIC(10,2) NOT NULL,
    shipping_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
    total               NUMERIC(10,2) NOT NULL,
    status              VARCHAR(15) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'canceled')),
    payment_gateway     VARCHAR(15) CHECK (payment_gateway IN ('stripe', 'mercadopago')),
    gateway_payment_id  VARCHAR(100) UNIQUE,   -- também evita processar webhook duplicado
    tracking_code       VARCHAR(60),
    label_url           VARCHAR(500),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id               SERIAL PRIMARY KEY,
    order_id         INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       INT REFERENCES products(id),
    subscription_id  INT REFERENCES subscriptions(id),   -- preenchido se for assinatura
    batch_id         INT REFERENCES roast_batches(id),
    grind            VARCHAR(50),
    quantity         INT NOT NULL CHECK (quantity > 0),
    unit_price       NUMERIC(10,2) NOT NULL,
    is_recurring     BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. TASTE FINDER -------------------------------------------------------
CREATE TABLE quiz_questions (
    id          SERIAL PRIMARY KEY,
    text        VARCHAR(300) NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE quiz_options (
    id                 SERIAL PRIMARY KEY,
    question_id        INT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    text               VARCHAR(300) NOT NULL,
    acidity_weight     INT NOT NULL DEFAULT 0,
    bitterness_weight  INT NOT NULL DEFAULT 0,
    sweetness_weight   INT NOT NULL DEFAULT 0
);

-- ÍNDICES ---------------------------------------------------------------
CREATE INDEX idx_addresses_user      ON addresses(user_id);
CREATE INDEX idx_products_category   ON products(category);
CREATE INDEX idx_subs_user           ON subscriptions(user_id);
CREATE INDEX idx_subs_status         ON subscriptions(status);
CREATE INDEX idx_orders_user         ON orders(user_id);
CREATE INDEX idx_order_items_order   ON order_items(order_id);

-- CONSULTAS ÚTEIS PARA O PAINEL DO LOJISTA ------------------------------

-- MRR (assinaturas ativas, normalizado para mensal):
-- SELECT ROUND(SUM(p.price * CASE s.frequency
--          WHEN 'weekly' THEN 4.33 WHEN 'biweekly' THEN 2.17 ELSE 1 END), 2) AS mrr
-- FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
-- WHERE s.status = 'active';

-- Moagem necessária (pedidos pagos, ainda não enviados):
-- SELECT oi.grind, SUM(oi.quantity) AS unidades
-- FROM order_items oi JOIN orders o ON o.id = oi.order_id
-- WHERE o.status = 'paid'
-- GROUP BY oi.grind;

-- Churn do mês atual:
-- SELECT COUNT(*) FILTER (WHERE canceled_at >= date_trunc('month', NOW())) * 100.0
--        / NULLIF(COUNT(*) FILTER (WHERE started_at < date_trunc('month', NOW())
--            AND (canceled_at IS NULL OR canceled_at >= date_trunc('month', NOW()))), 0) AS churn_pct
-- FROM subscriptions;
