import postgres from "postgres";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export interface Env {
  HYPERDRIVE: Hyperdrive;
  AUTH_TOKEN_SECRET: string;
  RESEND_API_KEY?: string;
  FRONTEND_URL?: string;
}

const cookieName = "origin_beans_session";
const tokenLifetimeSeconds = 7 * 24 * 60 * 60;
const passwordResetLifetimeMs = 30 * 60 * 1000;
const tasteProfileDimensions = ["acidity", "bitterness", "sweetness"];

function readQuizQuestion(body: any) {
  const { text, sort_order, options } = body || {};
  if (typeof text !== "string" || !text.trim() || text.trim().length > 300) {
    throw Object.assign(new Error("Informe uma pergunta com até 300 caracteres."), { statusCode: 400 });
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
    throw Object.assign(new Error("Cada pergunta deve ter de 2 a 8 opções."), { statusCode: 400 });
  }

  const sortOrder = sort_order === undefined ? null : Number(sort_order);
  if (sortOrder !== null && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
    throw Object.assign(new Error("A ordem deve ser um número inteiro igual ou maior que zero."), { statusCode: 400 });
  }

  const normalizedOptions = options.map((option: any) => {
    if (typeof option?.text !== "string" || !option.text.trim() || option.text.trim().length > 300) {
      throw Object.assign(new Error("Todas as opções devem ter um texto com até 300 caracteres."), { statusCode: 400 });
    }
    const weights = tasteProfileDimensions.map((dimension) => Number(option[`${dimension}_weight`] ?? 0));
    if (weights.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 10)) {
      throw Object.assign(new Error("Os pesos de acidez, amargor e doçura devem ser inteiros entre 0 e 10."), { statusCode: 400 });
    }
    return { text: option.text.trim(), weights };
  });

  return { text: text.trim(), sortOrder, options: normalizedOptions };
}

function setSessionCookie(headers: Headers, token: string) {
  headers.set("Set-Cookie", `${cookieName}=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${tokenLifetimeSeconds}`);
}
function clearSessionCookie(headers: Headers) {
  headers.set("Set-Cookie", `${cookieName}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`);
}
function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${cookieName}=`));
  return sessionCookie ? sessionCookie.slice(cookieName.length + 1) : null;
}

async function getUserFromToken(request: Request, sql: ReturnType<typeof postgres>, secret: string): Promise<any | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  let payload: any;
  try { payload = jwt.verify(token, secret); } catch { return null; }
  try {
    const result = await sql`SELECT id, name, email, phone, role, auth_version FROM users WHERE id = ${Number(payload.sub)}`;
    if (result.length === 0) return null;
    if (Number(payload.ver || 0) !== result[0].auth_version) return null;
    return result[0];
  } catch { return null; }
}

function normalizeCep(value: any): string { return typeof value === "string" ? value.replace(/\D/g, "") : ""; }
function roundCurrency(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function readGrind(value: any): string { const g = typeof value === "string" ? value.trim() : ""; if (!g || g.length > 50) throw new Error("Moagem inválida."); return g; }
function readFrequency(value: any): string { const f = value || "mensal"; if (!["semanal","quinzenal","mensal","bimestral"].includes(f)) throw new Error("Frequência inválida."); return f; }
function readItems(items: any) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) throw new Error("Adicione itens válidos.");
  return items.map((item: any) => {
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Quantidade inválida.");
    if (item?.item_type === "subscription" || item?.itemType === "subscription" || item?.plan_id !== undefined || item?.planId !== undefined) {
      const planId = Number(item.plan_id ?? item.planId);
      if (!Number.isInteger(planId) || planId < 1) throw new Error("Plano inválido.");
      return { itemType: "subscription", planId, quantity, grind: readGrind(item.grind), frequency: readFrequency(item.frequency) };
    }
    const productId = Number(item?.product_id ?? item?.productId);
    if (!Number.isInteger(productId) || productId < 1) throw new Error("Produto inválido.");
    return { itemType: "product", productId, quantity, grind: readGrind(item.grind), frequency: null };
  });
}
function validateAddress(address: any) {
  if (!address || typeof address !== "object" || Array.isArray(address)) throw new Error("Endereço inválido.");
  const limits: Record<string, number> = { street: 200, number: 20, neighborhood: 100, city: 100, state: 2 };
  const n: any = {};
  for (const [f, max] of Object.entries(limits)) { const v = typeof address[f] === "string" ? address[f].trim() : ""; if (!v || v.length > max) throw new Error(`Campo ${f} inválido.`); n[f] = v; }
  const cep = normalizeCep(address.cep || address.postalCode);
  if (!/^\d{8}$/.test(cep)) throw new Error("CEP inválido.");
  n.cep = cep; n.state = n.state.toUpperCase();
  n.complement = typeof address.complement === "string" ? address.complement.trim().slice(0, 100) : "";
  n.recipient = typeof address.recipient === "string" ? address.recipient.trim().slice(0, 150) : "";
  n.phone = typeof address.phone === "string" ? address.phone.trim().slice(0, 20) : "";
  return n;
}
function shippingZone(cep: string): string { const d = Number(cep[0]); return (d <= 3 || d >= 8) ? "south-southeast" : "other"; }

async function getShippingOptions(sql: ReturnType<typeof postgres>, cepValue: any, itemsValue: any) {
  const cep = normalizeCep(cepValue);
  if (!/^\d{8}$/.test(cep)) throw new Error("CEP inválido.");
  const items = readItems(itemsValue);
  let totalWeight = 0;
  for (const item of items) {
    if (item.itemType === "product") {
      const r = await sql`SELECT weight_grams FROM products WHERE id = ${item.productId} AND active = TRUE`;
      if (r.length === 0) throw new Error("Produto indisponível.");
      totalWeight += Math.max(1, Number(r[0].weight_grams) || 250) * item.quantity;
    } else {
      const r = await sql`SELECT plan.id, COALESCE(SUM(COALESCE(product.weight_grams, 250)), 0)::INT AS weight_grams FROM subscription_plans AS plan LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id LEFT JOIN products AS product ON product.id = link.product_id AND product.active = TRUE WHERE plan.id = ${item.planId} AND plan.active = TRUE GROUP BY plan.id`;
      if (r.length === 0) throw new Error("Plano indisponível.");
      totalWeight += Math.max(250, Number(r[0].weight_grams) || 250) * item.quantity;
    }
  }
  const weightKg = Math.max(1, Math.ceil(totalWeight / 1000));
  const isNear = shippingZone(cep) === "south-southeast";
  return { cep, weight_grams: totalWeight, options: [
    { id: "pac", label: "PAC", cost: roundCurrency((isNear ? 17.9 : 27.9) + (weightKg - 1) * 3.5), min_days: 7, max_days: 10 },
    { id: "sedex", label: "SEDEX", cost: roundCurrency((isNear ? 29.9 : 42.9) + (weightKg - 1) * 6), min_days: 2, max_days: 4 },
  ]};
}

async function loadOrder(sql: ReturnType<typeof postgres>, id: number, userId: number) {
  const orders = await sql`SELECT id, status, shipping_address, subtotal, shipping_cost, total, payment_gateway, gateway_payment_id, gateway_preference_id, gateway_checkout_url, tracking_code, created_at FROM orders WHERE id = ${id} AND user_id = ${userId}`;
  if (orders.length === 0) return null;
  const items = await sql`SELECT item.id, item.product_id, item.plan_id, item.grind, item.frequency, item.quantity, item.unit_price, item.is_recurring, COALESCE(product.name, plan.name, 'Item') AS name FROM order_items AS item LEFT JOIN products AS product ON product.id = item.product_id LEFT JOIN subscription_plans AS plan ON plan.id = item.plan_id WHERE item.order_id = ${id} ORDER BY item.id`;
  return { ...orders[0], items };
}

function corsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin") || "*";
  return new Headers({ "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Credentials": "true", "Vary": "Origin" });
}

async function sendResetEmail(apiKey: string, to: string, name: string, resetUrl: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Origin Beans <noreply@originbeans.shop>",
      to, subject: "Redefina sua senha | Origin & Beans",
      text: `Olá, ${name}.\n\nUse este link para redefinir sua senha (válido por 30 minutos):\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail.`,
      html: `<p>Olá, ${name}.</p><p>Use o link abaixo para redefinir sua senha (válido por 30 minutos):</p><p><a href="${resetUrl}">Redefinir minha senha</a></p><p>Se você não solicitou, ignore este e-mail.</p>`,
    }),
  });
  if (!resp.ok) throw new Error("Falha ao enviar e-mail.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false, prepare: true });
    const responseHeaders = corsHeaders(request);
    try {
      if (pathname === "/" || pathname === "/health") {
        const [{ now }] = await sql`SELECT NOW() as now`;
        return Response.json({ status: "ok", database_time: now }, { headers: responseHeaders });
      }
      if (pathname === "/tables" && request.method === "GET") {
        const tables = await sql`SELECT tablename as name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
        return Response.json({ tables: tables.map((t: any) => t.name) }, { headers: responseHeaders });
      }

      // ── AUTH ──
      if (pathname === "/auth/login" && request.method === "POST") {
        const { email, password } = await request.json();
        if (!email || !password) return Response.json({ message: "Informe e-mail e senha." }, { status: 400, headers: responseHeaders });
        const result = await sql`SELECT id, name, email, phone, role, auth_version, password_hash FROM users WHERE LOWER(email) = ${email.trim().toLowerCase()}`;
        const user = result[0];
        const ok = user && await bcrypt.compare(password, user.password_hash);
        if (!ok) return Response.json({ message: "E-mail ou senha incorretos." }, { status: 401, headers: responseHeaders });
        const token = jwt.sign({ sub: String(user.id), ver: user.auth_version }, env.AUTH_TOKEN_SECRET, { expiresIn: tokenLifetimeSeconds });
        setSessionCookie(responseHeaders, token);
        return Response.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { headers: responseHeaders });
      }

      if (pathname === "/auth/register" && request.method === "POST") {
        const { name, email, password, phone } = await request.json();
        if (!name?.trim()) return Response.json({ message: "Informe seu nome." }, { status: 400, headers: responseHeaders });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Response.json({ message: "E-mail inválido." }, { status: 400, headers: responseHeaders });
        if (!password || password.length < 8) return Response.json({ message: "Senha mínima 8 caracteres." }, { status: 400, headers: responseHeaders });
        const hash = await bcrypt.hash(password, 12);
        try {
          const result = await sql`INSERT INTO users (name, email, password_hash, phone) VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${hash}, ${phone?.trim() || null}) RETURNING id, name, email, phone, role, auth_version`;
          const user = result[0];
          const token = jwt.sign({ sub: String(user.id), ver: user.auth_version }, env.AUTH_TOKEN_SECRET, { expiresIn: tokenLifetimeSeconds });
          setSessionCookie(responseHeaders, token);
          return Response.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { status: 201, headers: responseHeaders });
        } catch (e: any) {
          if (e.code === "23505") return Response.json({ message: "E-mail já cadastrado." }, { status: 409, headers: responseHeaders });
          return Response.json({ message: "Erro ao criar conta." }, { status: 500, headers: responseHeaders });
        }
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

      if (pathname === "/auth/taste-profile" && request.method === "PUT") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const { profile } = await request.json();
        if (!profile || typeof profile !== "object") return Response.json({ message: "Perfil inválido." }, { status: 400, headers: responseHeaders });
        const np: Record<string, number> = {};
        for (const d of tasteProfileDimensions) {
          if (typeof profile[d] !== "number" || profile[d] < 0 || profile[d] > 10) return Response.json({ message: "Perfil inválido." }, { status: 400, headers: responseHeaders });
          np[d] = Math.round(profile[d] * 10) / 10;
        }
        await sql`UPDATE users SET taste_profile = ${JSON.stringify(np)}::jsonb WHERE id = ${user.id}`;
        return Response.json({ taste_profile: np }, { headers: responseHeaders });
      }

      // ── PASSWORD RESET ──
      if (pathname === "/auth/password-reset/request" && request.method === "POST") {
        const { email } = await request.json();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Response.json({ message: "E-mail inválido." }, { status: 400, headers: responseHeaders });
        if (!env.RESEND_API_KEY) return Response.json({ message: "Envio de e-mails não configurado." }, { status: 503, headers: responseHeaders });
        const userResult = await sql`SELECT id, name, email FROM users WHERE LOWER(email) = ${email.trim().toLowerCase()}`;
        const user = userResult[0];
        if (!user) return Response.json({ message: "Se o e-mail estiver cadastrado, você receberá instruções." }, { headers: responseHeaders });
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;
        await sql`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (${user.id}, ${tokenHash}, ${new Date(Date.now() + passwordResetLifetimeMs)})`;
        const frontendUrl = env.FRONTEND_URL || "https://originbeans.shop";
        const resetUrl = `${frontendUrl}/redefinir-senha?token=${token}`;
        try { await sendResetEmail(env.RESEND_API_KEY, user.email, user.name, resetUrl); }
        catch { await sql`DELETE FROM password_reset_tokens WHERE token_hash = ${tokenHash}`; return Response.json({ message: "Não foi possível enviar o e-mail." }, { status: 500, headers: responseHeaders }); }
        return Response.json({ message: "Se o e-mail estiver cadastrado, você receberá instruções." }, { headers: responseHeaders });
      }

      if (pathname === "/auth/password-reset/confirm" && request.method === "POST") {
        const { token, password } = await request.json();
        if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return Response.json({ message: "Link inválido ou expirado." }, { status: 400, headers: responseHeaders });
        if (typeof password !== "string" || password.length < 8) return Response.json({ message: "Senha mínima 8 caracteres." }, { status: 400, headers: responseHeaders });
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const resetResult = await sql`SELECT user_id FROM password_reset_tokens WHERE token_hash = ${tokenHash} AND expires_at > NOW()`;
        if (resetResult.length === 0) return Response.json({ message: "Link inválido ou expirado." }, { status: 400, headers: responseHeaders });
        const userId = resetResult[0].user_id;
        const hash = await bcrypt.hash(password, 12);
        await sql`UPDATE users SET password_hash = ${hash}, auth_version = auth_version + 1 WHERE id = ${userId}`;
        await sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}`;
        return Response.json({ message: "Senha redefinida com sucesso." }, { headers: responseHeaders });
      }

      // ── STOREFRONT ──
      if (pathname === "/vitrine/produtos" && request.method === "GET") {
        const rows = await sql`SELECT id, name, category, description, price, weight_grams, image_url, origin, producer, altitude, variety, score, sensory_notes, acidity, bitterness, sweetness, (stock > 0) AS in_stock FROM products WHERE active = TRUE ORDER BY name ASC, id ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0, score: parseFloat(r.score) || 0 })), { headers: responseHeaders });
      }
      if (pathname === "/vitrine/planos" && request.method === "GET") {
        const rows = await sql`SELECT plan.id, plan.name, plan.description, plan.price, plan.frequency, COALESCE(json_agg(json_build_object('id', product.id, 'name', product.name)) FILTER (WHERE product.id IS NOT NULL), '[]'::JSON) AS products FROM subscription_plans AS plan LEFT JOIN subscription_plan_products AS link ON link.plan_id = plan.id LEFT JOIN products AS product ON product.id = link.product_id AND product.active = TRUE WHERE plan.active = TRUE GROUP BY plan.id ORDER BY plan.price ASC, plan.id ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0 })), { headers: responseHeaders });
      }

      // ── QUIZ ──
      if (pathname === "/quiz/perguntas" && request.method === "GET") {
        const rows = await sql`SELECT question.id, question.text, question.sort_order, COALESCE(json_agg(json_build_object('id', option.id, 'text', option.text) ORDER BY option.id) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options FROM quiz_questions AS question LEFT JOIN quiz_options AS option ON option.question_id = question.id GROUP BY question.id ORDER BY question.sort_order ASC, question.id ASC`;
        return Response.json(rows, { headers: responseHeaders });
      }
      if (pathname === "/quiz/admin/perguntas" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Esta área é exclusiva para administradores." }, { status: 403, headers: responseHeaders });
        const rows = await sql`SELECT question.id, question.text, question.sort_order, COALESCE(json_agg(json_build_object('id', option.id, 'text', option.text, 'acidity_weight', option.acidity_weight, 'bitterness_weight', option.bitterness_weight, 'sweetness_weight', option.sweetness_weight) ORDER BY option.id) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options FROM quiz_questions AS question LEFT JOIN quiz_options AS option ON option.question_id = question.id GROUP BY question.id ORDER BY question.sort_order ASC, question.id ASC`;
        return Response.json(rows, { headers: responseHeaders });
      }
      if (pathname === "/quiz/admin/perguntas" && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Esta área é exclusiva para administradores." }, { status: 403, headers: responseHeaders });
        try {
          const question = readQuizQuestion(await request.json());
          const result = await sql.begin(async (tx) => {
            const sortOrder = question.sortOrder === null
              ? (await tx`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM quiz_questions`)[0].next_order
              : question.sortOrder;
            const inserted = await tx`INSERT INTO quiz_questions (text, sort_order) VALUES (${question.text}, ${sortOrder}) RETURNING id`;
            const questionId = inserted[0].id;
            for (const option of question.options) {
              await tx`INSERT INTO quiz_options (question_id, text, acidity_weight, bitterness_weight, sweetness_weight) VALUES (${questionId}, ${option.text}, ${option.weights[0]}, ${option.weights[1]}, ${option.weights[2]})`;
            }
            return { id: questionId, text: question.text, sort_order: sortOrder };
          });
          return Response.json(result, { status: 201, headers: responseHeaders });
        } catch (e: any) {
          return Response.json({ message: e.statusCode ? e.message : "Não foi possível salvar a pergunta." }, { status: e.statusCode || 500, headers: responseHeaders });
        }
      }
      const quizQuestionMatch = pathname.match(/^\/quiz\/admin\/perguntas\/(\d+)$/);
      if (quizQuestionMatch && request.method === "PUT") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Esta área é exclusiva para administradores." }, { status: 403, headers: responseHeaders });
        const id = Number(quizQuestionMatch[1]);
        try {
          const question = readQuizQuestion(await request.json());
          const result = await sql.begin(async (tx) => {
            const existing = await tx`SELECT sort_order FROM quiz_questions WHERE id = ${id}`;
            if (existing.length === 0) throw Object.assign(new Error("Pergunta não encontrada."), { statusCode: 404 });
            const sortOrder = question.sortOrder === null ? existing[0].sort_order : question.sortOrder;
            await tx`UPDATE quiz_questions SET text = ${question.text}, sort_order = ${sortOrder} WHERE id = ${id}`;
            await tx`DELETE FROM quiz_options WHERE question_id = ${id}`;
            for (const option of question.options) {
              await tx`INSERT INTO quiz_options (question_id, text, acidity_weight, bitterness_weight, sweetness_weight) VALUES (${id}, ${option.text}, ${option.weights[0]}, ${option.weights[1]}, ${option.weights[2]})`;
            }
            return { id, text: question.text, sort_order: sortOrder };
          });
          return Response.json(result, { headers: responseHeaders });
        } catch (e: any) {
          return Response.json({ message: e.statusCode ? e.message : "Não foi possível atualizar a pergunta." }, { status: e.statusCode || 500, headers: responseHeaders });
        }
      }
      if (quizQuestionMatch && request.method === "DELETE") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Esta área é exclusiva para administradores." }, { status: 403, headers: responseHeaders });
        const result = await sql`DELETE FROM quiz_questions WHERE id = ${Number(quizQuestionMatch[1])} RETURNING id`;
        if (result.length === 0) return Response.json({ message: "Pergunta não encontrada." }, { status: 404, headers: responseHeaders });
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      if (pathname === "/quiz/resultado" && request.method === "POST") {
        const { option_ids } = await request.json();
        if (!Array.isArray(option_ids) || option_ids.length < 1 || option_ids.length > 50 || option_ids.some((id: any) => !Number.isInteger(id) || id < 1) || new Set(option_ids).size !== option_ids.length) return Response.json({ message: "Opções inválidas." }, { status: 400, headers: responseHeaders });
        const answers = await sql`SELECT question_id, acidity_weight, bitterness_weight, sweetness_weight FROM quiz_options WHERE id IN ${sql(option_ids)}`;
        if (answers.length !== option_ids.length || new Set(answers.map((a: any) => a.question_id)).size !== answers.length) return Response.json({ message: "Respostas inválidas." }, { status: 400, headers: responseHeaders });
        const profile: Record<string, number> = {};
        for (const dim of tasteProfileDimensions) profile[dim] = Math.round(answers.reduce((t: number, a: any) => t + Number(a[`${dim}_weight`]), 0) / answers.length * 10) / 10;
        return Response.json({ profile }, { headers: responseHeaders });
      }

      // ── SHIPPING ──
      if (pathname === "/shipping/calculate" && request.method === "POST") {
        try { const body = await request.json(); const result = await getShippingOptions(sql, body?.cep, body?.items); return Response.json(result, { headers: responseHeaders }); }
        catch (e: any) { return Response.json({ message: e.message || "Erro ao calcular frete." }, { status: 400, headers: responseHeaders }); }
      }

      // ── ADDRESSES ──
      if (pathname === "/addresses" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const rows = await sql`SELECT id, cep, street, number, complement, neighborhood, city, state FROM addresses WHERE user_id = ${user.id} ORDER BY id DESC`;
        return Response.json(rows, { headers: responseHeaders });
      }
      if (pathname === "/addresses" && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        try {
          const body = await request.json();
          const cep = normalizeCep(body.cep || body.postalCode);
          if (!/^\d{8}$/.test(cep)) return Response.json({ message: "CEP inválido." }, { status: 400, headers: responseHeaders });
          const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
          if (!/^[A-Z]{2}$/.test(state)) return Response.json({ message: "Estado inválido." }, { status: 400, headers: responseHeaders });
          if (!body.street?.trim() || !body.number?.trim() || !body.neighborhood?.trim() || !body.city?.trim()) return Response.json({ message: "Preencha todos os campos." }, { status: 400, headers: responseHeaders });
          const result = await sql`INSERT INTO addresses (user_id, cep, street, number, complement, neighborhood, city, state) VALUES (${user.id}, ${cep}, ${body.street.trim()}, ${body.number.trim()}, ${typeof body.complement === "string" ? body.complement.trim().slice(0,100) : null}, ${body.neighborhood.trim()}, ${body.city.trim()}, ${state}) RETURNING id, cep, street, number, complement, neighborhood, city, state`;
          return Response.json(result[0], { status: 201, headers: responseHeaders });
        } catch { return Response.json({ message: "Erro ao salvar endereço." }, { status: 500, headers: responseHeaders }); }
      }
      const addrDeleteMatch = pathname.match(/^\/addresses\/(\d+)$/);
      if (addrDeleteMatch && request.method === "DELETE") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const result = await sql`DELETE FROM addresses WHERE id = ${Number(addrDeleteMatch[1])} AND user_id = ${user.id} RETURNING id`;
        if (result.length === 0) return Response.json({ message: "Endereço não encontrado." }, { status: 404, headers: responseHeaders });
        return new Response(null, { status: 204, headers: responseHeaders });
      }

      // ── ORDERS ──
      if (pathname === "/orders/me" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const orderRows = await sql`SELECT id FROM orders WHERE user_id = ${user.id} ORDER BY created_at DESC, id DESC`;
        const orders = [];
        for (const row of orderRows) orders.push(await loadOrder(sql, row.id, user.id));
        return Response.json(orders, { headers: responseHeaders });
      }
      if (pathname === "/orders/admin/payments" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const rows = await sql`SELECT 'order' AS kind, o.id, o.created_at AS date, u.name AS customer, CASE WHEN o.status = 'paid' THEN 'aprovado' WHEN o.status = 'canceled' THEN 'recusado' ELSE 'pendente' END AS status, o.total AS amount, COALESCE(o.payment_gateway, 'demonstrativo') AS method FROM orders o JOIN users u ON u.id = o.user_id UNION ALL SELECT 'subscription' AS kind, cs.id, cs.created_at AS date, cs.customer_name AS customer, CASE WHEN cs.status = 'ativa' THEN 'aprovado' WHEN cs.status = 'cancelada' THEN 'recusado' ELSE 'pendente' END AS status, COALESCE(cs.billing_amount, sp.price) AS amount, 'recorrente' AS method FROM customer_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id = cs.plan_id ORDER BY date DESC, kind, id DESC`;
        return Response.json(rows.map((r: any) => ({ ...r, amount: parseFloat(r.amount) || 0 })), { headers: responseHeaders });
      }
      if (pathname === "/orders" && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        try {
          const body = await request.json();
          const items = readItems(body?.items);
          if (items.some((i: any) => i.itemType !== "product")) return Response.json({ message: "Assinaturas separadas." }, { status: 400, headers: responseHeaders });
          const shippingMethod = body?.shipping_method;
          if (!["pac","sedex"].includes(shippingMethod)) return Response.json({ message: "Frete inválido." }, { status: 400, headers: responseHeaders });
          const order = await sql.begin(async (tx) => {
            let addressId = null; let address: any;
            if (body?.address_id) {
              const ar = await tx`SELECT id, cep, street, number, complement, neighborhood, city, state FROM addresses WHERE id = ${Number(body.address_id)} AND user_id = ${user.id}`;
              if (ar.length === 0) throw { statusCode: 400, message: "Endereço inválido." };
              address = validateAddress({ ...ar[0], recipient: body?.shipping_address?.recipient, phone: body?.shipping_address?.phone });
            } else { address = validateAddress(body?.shipping_address); }
            const sq = await getShippingOptions(tx, address.cep, items);
            const sel = sq.options.find((o: any) => o.id === shippingMethod);
            let subtotal = 0; const ri: any[] = [];
            for (const item of items) {
              if (item.itemType === "product") {
                const r = await tx`SELECT id, name, price, stock, active FROM products WHERE id = ${item.productId} FOR UPDATE`;
                const p = r[0];
                if (!p || !p.active) throw { statusCode: 409, message: "Produto indisponível." };
                if (p.stock < item.quantity) throw { statusCode: 409, message: `Estoque insuficiente: ${p.name}.` };
                await tx`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${p.id}`;
                ri.push({ productId: p.id, planId: null, quantity: item.quantity, grind: item.grind, frequency: null, price: Number(p.price), recurring: false });
                subtotal = roundCurrency(subtotal + Number(p.price) * item.quantity);
              } else {
                const r = await tx`SELECT id, name, price FROM subscription_plans WHERE id = ${item.planId} AND active = TRUE FOR UPDATE`;
                const p = r[0];
                if (!p) throw { statusCode: 409, message: "Plano indisponível." };
                const inc = await tx`SELECT product.id, product.name, product.stock FROM subscription_plan_products AS link JOIN products AS product ON product.id = link.product_id WHERE link.plan_id = ${p.id} AND product.active = TRUE ORDER BY product.id FOR UPDATE OF product`;
                for (const prod of inc) { if (prod.stock < item.quantity) throw { statusCode: 409, message: `Estoque insuficiente: ${prod.name}.` }; await tx`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${prod.id}`; }
                for (let i = 0; i < item.quantity; i++) ri.push({ productId: null, planId: p.id, quantity: 1, grind: item.grind, frequency: item.frequency, price: Number(p.price), recurring: true });
                subtotal = roundCurrency(subtotal + Number(p.price) * item.quantity);
              }
            }
            const total = roundCurrency(subtotal + sel.cost);
            const snapshot = { ...address, address_id: addressId, shipping_method: sel.id, shipping_label: sel.label, shipping_min_days: sel.min_days, shipping_max_days: sel.max_days };
            const ins = await tx`INSERT INTO orders (user_id, address_id, shipping_address, subtotal, shipping_cost, total, status) VALUES (${user.id}, ${addressId}, ${JSON.stringify(snapshot)}::jsonb, ${subtotal}, ${sel.cost}, ${total}, 'pending') RETURNING id`;
            const orderId = ins[0].id;
            for (const item of ri) await tx`INSERT INTO order_items (order_id, product_id, plan_id, grind, frequency, quantity, unit_price, is_recurring) VALUES (${orderId}, ${item.productId}, ${item.planId}, ${item.grind}, ${item.frequency}, ${item.quantity}, ${item.price}, ${item.recurring})`;
            return await loadOrder(tx, orderId, user.id);
          });
          return Response.json(order, { status: 201, headers: responseHeaders });
        } catch (e: any) { if (e.statusCode) return Response.json({ message: e.message }, { status: e.statusCode, headers: responseHeaders }); return Response.json({ message: "Erro ao criar pedido." }, { status: 500, headers: responseHeaders }); }
      }
      const demoConfirmMatch = pathname.match(/^\/orders\/(\d+)\/demo-confirm$/);
      if (demoConfirmMatch && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const id = Number(demoConfirmMatch[1]);
        try {
          const result = await sql.begin(async (tx) => {
            const order = await loadOrder(tx, id, user.id);
            if (!order) throw { statusCode: 404, message: "Pedido não encontrado." };
            if (order.status !== "pending") throw { statusCode: 409, message: "Pedido já finalizado." };
            await tx`UPDATE orders SET status = 'paid', payment_gateway = 'simulation', gateway_payment_id = ${`demo-${Date.now()}-${id}`} WHERE id = ${id} AND user_id = ${user.id} AND status = 'pending'`;
            return { ...order, status: "paid", payment_gateway: "simulation" };
          });
          return Response.json(result, { headers: responseHeaders });
        } catch (e: any) { if (e.statusCode) return Response.json({ message: e.message }, { status: e.statusCode, headers: responseHeaders }); return Response.json({ message: "Erro ao confirmar." }, { status: 500, headers: responseHeaders }); }
      }
      const orderGetMatch = pathname.match(/^\/orders\/(\d+)$/);
      if (orderGetMatch && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const order = await loadOrder(sql, Number(orderGetMatch[1]), user.id);
        if (!order) return Response.json({ message: "Pedido não encontrado." }, { status: 404, headers: responseHeaders });
        return Response.json(order, { headers: responseHeaders });
      }

      // ── PRODUCTS ADMIN ──
      if (pathname === "/produtos" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const rows = await sql`SELECT * FROM products ORDER BY name ASC, id ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0, score: parseFloat(r.score) || 0 })), { headers: responseHeaders });
      }
      if (pathname === "/produtos" && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        try {
          const b = await request.json();
          const result = await sql`INSERT INTO products (name, category, description, price, weight_grams, image_url, origin, producer, altitude, variety, score, sensory_notes, acidity, bitterness, sweetness, stock, active) VALUES (${b.name?.trim()}, ${b.category}, ${b.description || null}, ${Number(b.price)}, ${b.weight_grams || null}, ${b.image_url || null}, ${b.origin || null}, ${b.producer || null}, ${b.altitude || null}, ${b.variety || null}, ${b.score || null}, ${JSON.stringify(b.sensory_notes || [])}::jsonb, ${b.acidity || null}, ${b.bitterness || null}, ${b.sweetness || null}, ${Number(b.stock) || 0}, ${b.active !== false}) RETURNING id, name, category, price, stock, active`;
          return Response.json({ ...result[0], price: parseFloat(result[0].price) || 0 }, { status: 201, headers: responseHeaders });
        } catch { return Response.json({ message: "Erro ao salvar produto." }, { status: 500, headers: responseHeaders }); }
      }
      const prodMatch = pathname.match(/^\/produtos\/(\d+)$/);
      if (prodMatch && request.method === "PUT") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        try {
          const b = await request.json();
          const result = await sql`UPDATE products SET name = ${b.name?.trim()}, category = ${b.category}, description = ${b.description || null}, price = ${Number(b.price)}, weight_grams = ${b.weight_grams || null}, image_url = ${b.image_url || null}, origin = ${b.origin || null}, producer = ${b.producer || null}, altitude = ${b.altitude || null}, variety = ${b.variety || null}, score = ${b.score || null}, sensory_notes = ${JSON.stringify(b.sensory_notes || [])}::jsonb, acidity = ${b.acidity || null}, bitterness = ${b.bitterness || null}, sweetness = ${b.sweetness || null}, stock = ${Number(b.stock) || 0}, active = ${b.active !== false} WHERE id = ${Number(prodMatch[1])} RETURNING id, name, category, price, stock, active`;
          if (result.length === 0) return Response.json({ message: "Produto não encontrado." }, { status: 404, headers: responseHeaders });
          return Response.json({ ...result[0], price: parseFloat(result[0].price) || 0 }, { headers: responseHeaders });
        } catch { return Response.json({ message: "Erro ao atualizar." }, { status: 500, headers: responseHeaders }); }
      }
      if (prodMatch && request.method === "DELETE") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const result = await sql`DELETE FROM products WHERE id = ${Number(prodMatch[1])} RETURNING id`;
        if (result.length === 0) return Response.json({ message: "Produto não encontrado." }, { status: 404, headers: responseHeaders });
        return new Response(null, { status: 204, headers: responseHeaders });
      }

      // ── PLANOS / ASSINATURAS ADMIN ──
      if (pathname === "/planos" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const rows = await sql`SELECT id, name, description, price, frequency, active FROM subscription_plans ORDER BY price ASC, id ASC`;
        return Response.json(rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0 })), { headers: responseHeaders });
      }
      if (pathname === "/planos" && request.method === "POST") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const b = await request.json();
        const result = await sql`INSERT INTO subscription_plans (name, description, price, frequency, active) VALUES (${b.name?.trim()}, ${b.description || null}, ${Number(b.price)}, ${b.frequency || "mensal"}, ${b.active !== false}) RETURNING id, name, description, price, frequency, active`;
        return Response.json({ ...result[0], price: parseFloat(result[0].price) || 0 }, { status: 201, headers: responseHeaders });
      }
      const planMatch = pathname.match(/^\/planos\/(\d+)$/);
      if (planMatch && request.method === "PUT") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const b = await request.json();
        const result = await sql`UPDATE subscription_plans SET name = ${b.name?.trim()}, description = ${b.description || null}, price = ${Number(b.price)}, frequency = ${b.frequency || "mensal"}, active = ${b.active !== false} WHERE id = ${Number(planMatch[1])} RETURNING id, name, description, price, frequency, active`;
        if (result.length === 0) return Response.json({ message: "Plano não encontrado." }, { status: 404, headers: responseHeaders });
        return Response.json({ ...result[0], price: parseFloat(result[0].price) || 0 }, { headers: responseHeaders });
      }
      if (planMatch && request.method === "DELETE") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user || user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const result = await sql`DELETE FROM subscription_plans WHERE id = ${Number(planMatch[1])} RETURNING id`;
        if (result.length === 0) return Response.json({ message: "Plano não encontrado." }, { status: 404, headers: responseHeaders });
        return new Response(null, { status: 204, headers: responseHeaders });
      }
      if (pathname === "/assinaturas" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        if (user.role !== "admin") return Response.json({ message: "Acesso negado." }, { status: 403, headers: responseHeaders });
        const rows = await sql`SELECT cs.id, cs.customer_name, cs.customer_email, cs.status, cs.frequency, cs.grind, cs.started_at, cs.next_renewal, cs.created_at, sp.name AS plan_name, sp.price AS plan_price FROM customer_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id = cs.plan_id ORDER BY cs.created_at DESC LIMIT 100`;
        return Response.json(rows.map((r: any) => ({ ...r, plan_price: parseFloat(r.plan_price) || 0 })), { headers: responseHeaders });
      }
      if (pathname === "/subscriptions" && request.method === "GET") {
        const user = await getUserFromToken(request, sql, env.AUTH_TOKEN_SECRET);
        if (!user) return Response.json({ message: "Entre na sua conta." }, { status: 401, headers: responseHeaders });
        const rows = await sql`SELECT cs.id, cs.status, cs.frequency, cs.grind, cs.started_at, cs.next_renewal, sp.name AS plan_name, sp.price AS plan_price FROM customer_subscriptions cs LEFT JOIN subscription_plans sp ON sp.id = cs.plan_id WHERE cs.user_id = ${user.id} ORDER BY cs.created_at DESC`;
        return Response.json(rows.map((r: any) => ({ ...r, plan_price: parseFloat(r.plan_price) || 0 })), { headers: responseHeaders });
      }

      // ── DASHBOARD ──
      if (pathname === "/customers" && request.method === "GET") {
        const rows = await sql`SELECT u.id, u.name, u.email, a.city, a.cep, COUNT(o.id) AS orders, u.taste_profile, u.created_at FROM users u LEFT JOIN addresses a ON a.user_id = u.id LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id, a.city, a.cep ORDER BY u.created_at DESC LIMIT 100`;
        const customers = rows.map((r: any) => {
          let taste = "—";
          if (r.taste_profile) { const tp = typeof r.taste_profile === "string" ? JSON.parse(r.taste_profile) : r.taste_profile; const parts = []; if (tp.sweetness >= 5) parts.push("doce"); if (tp.acidity >= 5) parts.push("ácido"); if (tp.bitterness >= 5) parts.push("amargo"); taste = parts.length > 0 ? parts.join("/") : "neutro"; }
          return { id: r.id, name: r.name, email: r.email, city: r.city || "—", cep: r.cep || "—", orders: parseInt(r.orders, 10) || 0, taste, createdAt: r.created_at ? new Date(r.created_at).toISOString() : null };
        });
        return Response.json({ count: customers.length, rows: customers }, { headers: responseHeaders });
      }
      if (pathname === "/payments" && request.method === "GET") {
        const rows = await sql`SELECT o.id, o.created_at AS date, CONCAT('Pedido #', o.id) AS reference, u.name AS customer, COALESCE(o.payment_gateway, '—') AS method, CAST(o.total AS FLOAT) AS amount, o.status FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 100`;
        return Response.json({ count: rows.length, rows: rows.map((r: any) => ({ id: r.id, date: r.date ? new Date(r.date).toISOString().slice(0,10) : null, reference: r.reference, customer: r.customer, method: r.method, amount: parseFloat(r.amount) || 0, status: r.status })) }, { headers: responseHeaders });
      }
      if (pathname === "/products" && request.method === "GET") {
        const rows = await sql`SELECT id, name, category, price, weight_grams, image_url, origin, producer, score, stock, active FROM products ORDER BY id LIMIT 100`;
        return Response.json({ count: rows.length, rows: rows.map((r: any) => ({ ...r, price: parseFloat(r.price) || 0, score: parseFloat(r.score) || 0 })) }, { headers: responseHeaders });
      }

      // ── GENERIC DATA ──
      const dataMatch = pathname.match(/^\/data\/(\w+)$/);
      if (dataMatch && request.method === "GET") {
        const tableName = dataMatch[1];
        const rows = await sql`SELECT * FROM ${sql(tableName)} LIMIT 100`;
        return Response.json({ table: tableName, count: rows.length, rows }, { headers: responseHeaders });
      }

      // ── 404 ──
      return Response.json({ error: "Rota não encontrada" }, { status: 404, headers: responseHeaders });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500, headers: responseHeaders });
    } finally {
      await sql.end();
    }
  },
};
