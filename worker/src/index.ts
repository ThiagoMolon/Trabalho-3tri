import postgres from "postgres";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  AUTH_TOKEN_SECRET: string;
}

const cookieName = "origin_beans_session";
const tokenLifetimeSeconds = 7 * 24 * 60 * 60;
const tasteProfileDimensions = ["acidity", "bitterness", "sweetness"];

// ── Cookie helpers ──────────────────────────────────────────
function setSessionCookie(headers: Headers, token: string) {
  headers.set(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${tokenLifetimeSeconds}`
  );
}

function clearSessionCookie(headers: Headers) {
  headers.set(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
  );
}

function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${cookieName}=`));
  return sessionCookie ? sessionCookie.slice(cookieName.length + 1) : null;
}

// ── Auth middleware ─────────────────────────────────────────
async function getUserFromToken(
  request: Request,
  sql: ReturnType<typeof postgres>,
  secret: string
): Promise<any | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  let payload: any;
  try {
    payload = jwt.verify(token, secret);
  } catch {
    return null;
  }
  try {
    const result = await sql`
      SELECT id, name, email, phone, role, auth_version
      FROM users WHERE id = ${Number(payload.sub)}
    `;
    if (result.length === 0) return null;
    if (Number(payload.ver || 0) !== result[0].auth_version) return null;
    return result[0];
  } catch {
    return null;
  }
}

// ── CORS ────────────────────────────────────────────────────
function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin") || "*";
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const sql = postgres(env.HYPERDRIVE.connectionString, {
      max: 5, fetch_types: false, prepare: true,
    });

    const responseHeaders = corsHeaders(request);

    try {
      // ── AUTH ROUTES ──────────────────────────────────────
      if (pathname === "/auth/login" && request.method === "POST") {
        const { email, password } = await request.json();
        const result = await sql`SELECT id, name, email, phone, role, auth_version, password_hash FROM users WHERE LOWER(email) = ${email.trim().toLowerCase()}`;
        const user = result[0];
        const passwordMatches = user && await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) return Response.json({ message: "E-mail ou senha incorretos." }, { status: 401, headers: responseHeaders });
        const token = jwt.sign({ sub: String(user.id), ver: user.auth_version }, env.AUTH_TOKEN_SECRET, { expiresIn: tokenLifetimeSeconds });
        setSessionCookie(responseHeaders, token);
        return Response.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { headers: responseHeaders });
      }

      if (pathname === "/auth/register" && request.method === "POST") {
        const { name, email, password, phone } = await request.json();
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await sql`INSERT INTO users (name, email, password_hash, phone) VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${passwordHash}, ${phone?.trim() || null}) RETURNING id, name, email, phone, role, auth_version`;
        const user = result[0];
        const token = jwt.sign({ sub: String(user.id), ver: user.auth_version }, env.AUTH_TOKEN_SECRET, { expiresIn: tokenLifetimeSeconds });
        setSessionCookie(responseHeaders, token);
        return Response.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { status: 201, headers: responseHeaders });
      }

      if (pathname === "/auth/me" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) { clearSessionCookie(responseHeaders); return Response.json({ message: "Sessão expirada." }, { status: 401, headers: responseHeaders }); }
        return Response.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { headers: responseHeaders });
      }

      if (pathname === "/auth/logout" && request.method === "POST") {
        clearSessionCookie(responseHeaders);
        return new Response(null, { status: 204, headers: responseHeaders });
      }

      // ── ADMIN / STOREFRONT ROUTES ─────────────────────────

      // GET /planos (Admin)
      if (pathname === "/planos" && request.method === "GET") {
        const rows = await sql`SELECT id, name, description, price, frequency FROM subscription_plans WHERE active = TRUE ORDER BY price ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) })), { headers: responseHeaders });
      }

      // GET /assinaturas (Admin)
      if (pathname === "/assinaturas" && request.method === "GET") {
        const rows = await sql`SELECT id, customer_name, customer_email, plan_id, status, started_at, next_renewal FROM customer_subscriptions ORDER BY started_at DESC`;
        return Response.json(rows, { headers: responseHeaders });
      }

      // GET /produtos (Admin)
      if (pathname === "/produtos" && request.method === "GET") {
        const rows = await sql`SELECT * FROM products ORDER BY name ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0 })), { headers: responseHeaders });
      }

      // GET /vitrine/planos (Cliente)
      if (pathname === "/vitrine/planos" && request.method === "GET") {
        const rows = await sql`
          SELECT plan.id, plan.name, plan.description, plan.price, plan.frequency,
            COALESCE(json_agg(json_build_object('id', product.id, 'name', product.name)) FILTER (WHERE product.id IS NOT NULL), '[]'::JSON) AS products
          FROM subscription_plans AS plan
          LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id
          LEFT JOIN products AS product ON product.id = link.product_id AND product.active = TRUE
          WHERE plan.active = TRUE GROUP BY plan.id ORDER BY plan.price ASC
        `;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) })), { headers: responseHeaders });
      }

      // GET /vitrine/produtos (Cliente)
      if (pathname === "/vitrine/produtos" && request.method === "GET") {
        const rows = await sql`SELECT id, name, category, description, price, weight_grams, image_url, origin, producer, altitude, variety, score, sensory_notes, acidity, bitterness, sweetness, (stock > 0) AS in_stock FROM products WHERE active = TRUE ORDER BY name ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0, score: parseFloat(r.score) || 0 })), { headers: responseHeaders });
      }

      // ── OTHER ROUTES ──────────────────────────────────────
      if (pathname === "/customers" && request.method === "GET") {
        const rows = await sql`SELECT u.id, u.name, u.email, a.city, a.cep, COUNT(o.id) AS orders, u.taste_profile, u.created_at FROM users u LEFT JOIN addresses a ON a.user_id = u.id LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id, a.city, a.cep ORDER BY u.created_at DESC LIMIT 100`;
        const customers = rows.map((r: any) => {
          let taste = "—";
          if (r.taste_profile) {
            const tp = typeof r.taste_profile === "string" ? JSON.parse(r.taste_profile) : r.taste_profile;
            const parts = [];
            if (tp.sweetness >= 5) parts.push("doce");
            if (tp.acidity >= 5) parts.push("ácido");
            if (tp.bitterness >= 5) parts.push("amargo");
            taste = parts.length > 0 ? parts.join("/") : "neutro";
          }
          return { id: r.id, name: r.name, email: r.email, city: r.city || "—", cep: r.cep || "—", orders: parseInt(r.orders, 10) || 0, taste, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null };
        });
        return Response.json({ count: customers.length, rows: customers }, { headers: responseHeaders });
      }

      if (pathname === "/payments" && request.method === "GET") {
        const rows = await sql`SELECT o.id, o.created_at AS date, CONCAT('Pedido #', o.id) AS reference, u.name AS customer, COALESCE(o.payment_gateway, '—') AS method, CAST(o.total AS FLOAT) AS amount, o.status FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 100`;
        return Response.json({ count: rows.length, rows: rows.map((r: any) => ({ ...r, amount: parseFloat(r.amount) || 0 })) }, { headers: responseHeaders });
      }

      if (pathname === "/quiz/perguntas" && request.method === "GET") {
        const rows = await sql`SELECT question.id, question.text, question.sort_order, COALESCE(json_agg(json_build_object('id', option.id, 'text', option.text) ORDER BY option.id) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options FROM quiz_questions AS question LEFT JOIN quiz_options AS option ON option.question_id = question.id GROUP BY question.id ORDER BY question.sort_order ASC, question.id ASC`;
        return Response.json(rows, { headers: responseHeaders });
      }

      if (pathname === "/quiz/resultado" && request.method === "POST") {
        const { option_ids } = await request.json();
        const answers = await sql`SELECT question_id, acidity_weight, bitterness_weight, sweetness_weight FROM quiz_options WHERE id = ANY(${sql.array(option_ids)}::int[])`;
        const profile: Record<string, number> = {};
        for (const dim of tasteProfileDimensions) {
          profile[dim] = Math.round(answers.reduce((total: number, a: any) => total + Number(a[`${dim}_weight`]), 0) / answers.length * 10) / 10;
        }
        return Response.json({ profile }, { headers: responseHeaders });
      }

      if (pathname === "/data/customers" && request.method === "GET") {
         const rows = await sql`SELECT * FROM users WHERE role = 'customer'`;
         return Response.json({ rows }, { headers: responseHeaders });
      }

      // 404
      return Response.json({ error: "Rota não encontrada" }, { status: 404, headers: responseHeaders });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500, headers: responseHeaders });
    } finally {
      await sql.end();
    }
  },
};
