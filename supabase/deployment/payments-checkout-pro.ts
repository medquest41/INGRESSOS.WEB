import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function pixExpiration(value: string) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('A validade do Pix está inválida. Volte ao pedido e tente novamente.')
  return new Date(value).toISOString().replace(/Z$/,'+00:00')
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function verifyWebhook(req: Request, secret: string) {
  const url = new URL(req.url);

  const xSignature = req.headers.get("x-signature") || "";
  const xRequestId = req.headers.get("x-request-id") || "";
  const dataId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    "";

  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  let ts = "";
  let v1 = "";

  for (const part of xSignature.split(",")) {
    const [key, value] = part.split("=");
    if (key?.trim() === "ts") ts = value?.trim() || "";
    if (key?.trim() === "v1") v1 = value?.trim() || "";
  }

  if (!ts || !v1) return false;

  const manifest =
    `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;

  const calculated = await hmacSha256(secret, manifest);

  return timingSafeEqual(calculated, v1);
}

async function mercadoPagoRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {},
) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Mercado Pago:", response.status, { message: data?.message, error: data?.error });
    throw new Error(
      data?.message ||
        data?.error ||
        `Mercado Pago respondeu HTTP ${response.status}`,
    );
  }

  return data;
}


// Room-specific reconciliation. Existing ordinary checkout remains unchanged.
async function reconcileRoom(supabase: any, payment: any, accessToken: string) {
 const reference=String(payment.external_reference||'');
 if(!/^[0-9a-f-]{36}$/i.test(reference))return null;
 const found=await supabase.from('orders').select('*').eq('id',reference).maybeSingle();
 if(found.error)throw Error('Não foi possível conferir o pedido.');
 const order=found.data;if(!order?.snapshot?.wristbands)return null;
 const seller=await mercadoPagoRequest('/users/me',accessToken);
 const expectedLive=!accessToken.startsWith('TEST-');
 if(String(payment.collector_id)!==String(seller.id)||payment.live_mode!==expectedLive||payment.currency_id!=='BRL'||Math.round(Number(payment.transaction_amount)*100)!==order.total_cents)throw Error('Pagamento incompatível com o camarote.');
 const result=await supabase.rpc('reconcile_camarote_payment',{purchase_id:order.id,provider_payment:payment});
 if(result.error)throw Error('Pagamento recebido aguardando conferência. Não pague novamente.');
 return result.data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get(
    "MERCADOPAGO_ACCESS_TOKEN",
  );
  const WEBHOOK_SECRET = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") || "";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !MERCADOPAGO_ACCESS_TOKEN) {
    return json({ error: "Configuração do servidor incompleta." }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const url = new URL(req.url);

    const isWebhook =
      req.headers.has("x-signature") ||
      url.searchParams.get("type") === "payment";

    /*
     * WEBHOOK MERCADO PAGO
     */
    if (isWebhook) {
      if (!WEBHOOK_SECRET) {
        return json({ error: "Webhook ainda não configurado." }, 401);
      }

      const valid = await verifyWebhook(req, WEBHOOK_SECRET);

      if (!valid) {
        return json({ error: "Assinatura inválida." }, 401);
      }

      const paymentId =
        url.searchParams.get("data.id") ||
        url.searchParams.get("id");

      if (!paymentId) {
        return json({ received: true });
      }

      const payment = await mercadoPagoRequest(
        `/v1/payments/${encodeURIComponent(paymentId)}`,
        MERCADOPAGO_ACCESS_TOKEN,
      );

      const roomStatus = await reconcileRoom(supabase,payment,MERCADOPAGO_ACCESS_TOKEN);
      if(roomStatus!==null) return json(isWebhook ? {received:true,status:roomStatus} : {status:roomStatus,orderStatus:roomStatus,paymentId:String(payment.id),qrCode:payment.point_of_interaction?.transaction_data?.qr_code||null,qrCodeBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||null,expiresAt:payment.date_of_expiration||null});
      if (payment.status === "approved") {
        const orderId = String(payment.external_reference || "");
        const amountCents = Math.round(
          Number(payment.transaction_amount || 0) * 100,
        );

        if (!orderId || !amountCents) {
          return json({ error: "Pagamento sem referência válida." }, 400);
        }

        const { error } = await supabase.rpc("settle_payment", {
          purchase_id: orderId,
          external_payment_id: String(payment.id),
          paid_cents: amountCents,
          currency_code: "BRL",
        });

        if (error) {
          console.error("settle_payment:", error);
          return json({ error: "Falha ao confirmar pedido." }, 500);
        }
      }

      return json({ received: true });
    }

    /*
     * CHAMADAS DO SITE
     */
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado." }, 401);
    }

    const token = authHeader.slice(7);
    // Read private orders with the same authenticated context as the site.
    // Keep the privileged client separate for settlement and webhook operations.
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const orderId = body?.orderId;
    if (action === "capabilities") {
      return json({ status: "ready", cardEnabled: Boolean(WEBHOOK_SECRET), mode: "checkout_pro", version: "17.2", cancelEnabled: true, cardUnavailableReason: WEBHOOK_SECRET ? null : "Configure MERCADOPAGO_WEBHOOK_SECRET nos Secrets da função payments." });
    }

    if (typeof orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
      return json({ error: "Pedido obrigatório." }, 400);
    }

    const { data: order, error: orderError } = await userClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("payments.order_read", { code: orderError.code, message: orderError.message });
      return json({ error: "Falha ao consultar o pedido. Confira os Logs da função payments.", code: orderError.code }, 500);
    }
    if (!order) {
      return json({ error: "Pedido não encontrado." }, 404);
    }

    if (order.user_id !== user.id) {
      return json({ error: "Sem permissão." }, 403);
    }



    if(order.snapshot?.wristbands&&['create_pix','create_checkout'].includes(action)){
      const prepared=await supabase.rpc('prepare_camarote_payment',{purchase_id:order.id,buyer_id:user.id});
      if(prepared.error)return json({error:'Reserva indisponível. Consulte seus ingressos.'},409);
      Object.assign(order,prepared.data);
    }
    if(order.snapshot?.wristbands&&order.payment_review)return json({status:"review",orderStatus:order.status});
    if (action === "cancel") {
      if (order.status === "cancelled") return json({ status: "cancelled" });
      if (order.status !== "pending" || order.payment_review) return json({ error: "Este pedido não pode ser cancelado por aqui. Consulte o status do pagamento." }, 409);
      const reference = String(order.payment_id || "");
      if (reference.startsWith("checkout:creating:")) return json({ error: "Checkout em preparação. Aguarde e consulte o pedido antes de cancelar." }, 409);
      let payments: any[] = [];
      if (reference.startsWith("checkout:")) {
        const preference = await mercadoPagoRequest("/checkout/preferences/" + encodeURIComponent(reference.slice(9)), MERCADOPAGO_ACCESS_TOKEN);
        const ended = await mercadoPagoRequest("/checkout/preferences/" + encodeURIComponent(reference.slice(9)), MERCADOPAGO_ACCESS_TOKEN, { method: "PUT", body: JSON.stringify({ expires: true, expiration_date_from: preference.expiration_date_from || order.created_at, expiration_date_to: new Date(Date.now() - 1000).toISOString() }) });
        if (!ended.expires || new Date(ended.expiration_date_to).getTime() > Date.now()) return json({ error: "Não foi possível encerrar o checkout. O pedido continua ativo." }, 409);
      }
      // Search also recovers a Pix created before saving payment_id failed.
      const search = await mercadoPagoRequest("/v1/payments/search?external_reference=" + encodeURIComponent(order.id) + "&sort=date_created&criteria=desc&limit=100", MERCADOPAGO_ACCESS_TOKEN);
      if (Number(search.paging?.total || 0) > 100) return json({ error: "Pedido com muitas tentativas. Solicite atendimento para cancelar." }, 409);
      payments = (search.results || []).filter((p: any) => String(p.external_reference) === order.id);
      if (reference && !reference.startsWith("checkout:") && !payments.some((p: any) => String(p.id) === reference)) payments.push(await mercadoPagoRequest("/v1/payments/" + encodeURIComponent(reference), MERCADOPAGO_ACCESS_TOKEN));
      if (payments.some((p: any) => ["approved", "refunded", "charged_back", "authorized", "in_process"].includes(p.status))) return json({ error: "Pagamento aprovado ou em análise. Não é possível cancelar a reserva; confira seus pedidos." }, 409);
      for (const payment of payments) {
        if (String(payment.external_reference) !== order.id) return json({ error: "Referência do pagamento incompatível." }, 409);
        if (payment.status === "pending") {
          const cancelled = await mercadoPagoRequest("/v1/payments/" + encodeURIComponent(payment.id), MERCADOPAGO_ACCESS_TOKEN, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
          if (cancelled.status !== "cancelled") return json({ error: "O provedor ainda não confirmou o cancelamento. O pedido continua ativo." }, 409);
        } else if (!["cancelled", "rejected"].includes(payment.status)) return json({ error: "Status de pagamento não permite cancelamento." }, 409);
      }
      const stopped = await userClient.rpc("cancel_order", { purchase_id: order.id });
      if (stopped.error) { console.error("payments.cancel", {code: stopped.error.code, message: stopped.error.message}); return json({ error: "Pagamento encerrado, mas a reserva não foi atualizada. Consulte seus pedidos." }, 409); }
      return json({ status: "cancelled" });
    }

    // One-time hosted checkout. Card details never pass through this function.
    if (action === "create_checkout") {
      if (!WEBHOOK_SECRET) return json({ error: "Cartão ainda não configurado. Configure o webhook do Mercado Pago no servidor." }, 503);
      if (order.status === "approved") return json({ status: "approved" });
      if (order.status !== "pending" || order.payment_review) return json({ error: "Pedido indisponível." }, 409);
      if (!order.expires_at || new Date(order.expires_at).getTime() <= Date.now()) return json({ error: "A reserva expirou." }, 409);
      if (!Number.isInteger(order.total_cents) || order.total_cents <= 0) return json({ error: "Valor inválido." }, 400);
      const existing = String(order.payment_id || "");
      if (existing && !existing.startsWith("checkout:")) return json({ error: "Este pedido já tem um pagamento Pix. Confira o status antes de mudar de forma de pagamento." }, 409);
      let preference;
      if (existing.startsWith("checkout:") && !existing.startsWith("checkout:creating:")) {
        preference = await mercadoPagoRequest("/checkout/preferences/" + encodeURIComponent(existing.slice(9)), MERCADOPAGO_ACCESS_TOKEN);
      } else {
        if (existing) return json({ error: "Checkout em preparação. Confira seus pedidos antes de tentar novamente." }, 409);
        const marker = "checkout:creating:" + crypto.randomUUID();
        const claimed = await supabase.from("orders").update({ payment_id: marker }).eq("id", order.id).eq("user_id", user.id).eq("status", "pending").is("payment_id", null).select("id").maybeSingle();
        if (claimed.error || !claimed.data) return json({ error: "Não foi possível reservar o checkout. Consulte o pedido antes de tentar novamente." }, 409);
        const returnUrl = "https://ingressos-experiences.onrender.com/ingressos?payment=" + encodeURIComponent(order.id);
        preference = await mercadoPagoRequest("/checkout/preferences", MERCADOPAGO_ACCESS_TOKEN, {
          method: "POST", headers: { "X-Idempotency-Key": "checkout-" + order.id },
          body: JSON.stringify({
            external_reference: order.id,
            items: [{ id: order.id, title: "Ingressos Experiences", quantity: 1, currency_id: "BRL", unit_price: order.total_cents / 100 }],
            back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
            auto_return: "approved", notification_url: SUPABASE_URL + "/functions/v1/payments",
            expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: order.expires_at,
            payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }], installments: 1 },
          }),
        });
        if (!preference.id) throw new Error("Checkout sem referência. Consulte o pedido antes de tentar novamente.");
        const saved = await supabase.from("orders").update({ payment_id: "checkout:" + preference.id }).eq("id", order.id).eq("payment_id", marker);
        if (saved.error) throw new Error("Checkout criado, mas o pedido não foi atualizado. Confira os Logs antes de repetir.");
      }
      const destination = new URL(preference.init_point);
      if (destination.protocol !== "https:" || !["www.mercadopago.com.br", "www.mercadopago.com"].includes(destination.hostname)) throw new Error("Destino de pagamento inválido.");
      return json({ status: "pending", checkoutUrl: destination.href });
    }
    if (action === "status" && ["cancelled", "refunded", "expired", "rejected", "charged_back"].includes(order.status)) return json({ status: order.status });
    // After returning from Checkout Pro, look up the provider by the authoritative order ID.
    if (String(order.payment_id || "").startsWith("checkout:") && action === "status") {
      const search = await mercadoPagoRequest("/v1/payments/search?external_reference=" + encodeURIComponent(order.id) + "&sort=date_created&criteria=desc&limit=100", MERCADOPAGO_ACCESS_TOKEN);
      const candidates = (search.results || []).filter((p: any) => String(p.external_reference) === order.id);
      const payment = candidates.find((p: any) => p.status === "approved") || candidates[0];
      if (!payment) return json({ status: new Date(order.expires_at).getTime() <= Date.now() ? "expired" : "pending" });
      if (payment.currency_id !== "BRL" || Math.round(Number(payment.transaction_amount) * 100) !== order.total_cents) throw new Error("Pagamento incompatível com o pedido.");
      const roomStatus = await reconcileRoom(supabase,payment,MERCADOPAGO_ACCESS_TOKEN);
      if(roomStatus!==null) return json(isWebhook ? {received:true,status:roomStatus} : {status:roomStatus,orderStatus:roomStatus,paymentId:String(payment.id),qrCode:payment.point_of_interaction?.transaction_data?.qr_code||null,qrCodeBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||null,expiresAt:payment.date_of_expiration||null});
      if (payment.status === "approved") {
        const settled = await supabase.rpc("settle_payment", { purchase_id: order.id, external_payment_id: String(payment.id), paid_cents: order.total_cents, currency_code: "BRL" });
        if (settled.error) { console.error("payments.settlement", { code: settled.error.code, message: settled.error.message }); return json({ status: "confirming", error: "Pagamento recebido; confirmação do pedido pendente. Não pague novamente." }, 503); }
      }
      return json({ status: payment.status, orderStatus: payment.status === "approved" ? "approved" : order.status });
    }
    if (String(order.payment_id || "").startsWith("checkout:") && action === "create_pix") return json({ error: "Este pedido já tem checkout Mercado Pago. Confira o status antes de mudar de forma de pagamento." }, 409);

    /*
     * CONSULTAR PAGAMENTO
     */
    if (action === "status") {
      if (order.status === "approved") {
        return json({
          status: "approved",
          orderStatus: "approved",
        });
      }

      if (!order.payment_id) {
        return json({
          status: "pending",
          orderStatus: order.status,
        });
      }

      const payment = await mercadoPagoRequest(
        `/v1/payments/${encodeURIComponent(order.payment_id)}`,
        MERCADOPAGO_ACCESS_TOKEN,
      );

      const roomStatus = await reconcileRoom(supabase,payment,MERCADOPAGO_ACCESS_TOKEN);
      if(roomStatus!==null) return json(isWebhook ? {received:true,status:roomStatus} : {status:roomStatus,orderStatus:roomStatus,paymentId:String(payment.id),qrCode:payment.point_of_interaction?.transaction_data?.qr_code||null,qrCodeBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||null,expiresAt:payment.date_of_expiration||null});
      if (payment.status === "approved") {
        const amountCents = Math.round(
          Number(payment.transaction_amount || 0) * 100,
        );

        const { error } = await supabase.rpc("settle_payment", {
          purchase_id: order.id,
          external_payment_id: String(payment.id),
          paid_cents: amountCents,
          currency_code: "BRL",
        });

        if (error) throw error;
      }

      return json({
        status: payment.status,
        statusDetail: payment.status_detail,
        orderStatus:
          payment.status === "approved" ? "approved" : order.status,
      });
    }

    /*
     * CRIAR PIX
     */
    if (action === "create_pix") {
      if (order.status === "approved") {
        return json({ status: "approved" });
      }

      if (order.status !== "pending") {
        return json({ error: "Pedido indisponível." }, 400);
      }

      if (
        order.expires_at &&
        new Date(order.expires_at).getTime() <= Date.now()
      ) {
        return json({ error: "A reserva expirou." }, 400);
      }

      if (
        !Number.isInteger(order.total_cents) ||
        order.total_cents <= 0
      ) {
        return json({ error: "Valor do pedido inválido." }, 400);
      }

      const payerEmail =
        order.buyer?.email ||
        user.email;

      if (!payerEmail) {
        return json({ error: "E-mail do comprador ausente." }, 400);
      }

      const notificationUrl =
        `${SUPABASE_URL}/functions/v1/payments`;

      const idempotencyKey = `pix-${order.id}`;

      const payment = await mercadoPagoRequest(
        "/v1/payments",
        MERCADOPAGO_ACCESS_TOKEN,
        {
          method: "POST",
          headers: {
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            ...(order.snapshot?.wristbands?{date_of_expiration:pixExpiration(order.expires_at)}:{}),
            transaction_amount: order.total_cents / 100,
            description: `Ingressos Experiences - Pedido ${order.id}`,
            payment_method_id: "pix",
            external_reference: order.id,
            notification_url: notificationUrl,
            payer: {
              email: payerEmail,
              first_name:
                String(order.buyer?.name || "").split(" ")[0] ||
                undefined,
              identification: order.buyer?.cpf
                ? {
                    type: "CPF",
                    number: String(order.buyer.cpf).replace(/\D/g, ""),
                  }
                : undefined,
            },
          }),
        },
      );

      const roomStatus = await reconcileRoom(supabase,payment,MERCADOPAGO_ACCESS_TOKEN);
      if(roomStatus!==null) return json(isWebhook ? {received:true,status:roomStatus} : {status:roomStatus,orderStatus:roomStatus,paymentId:String(payment.id),qrCode:payment.point_of_interaction?.transaction_data?.qr_code||null,qrCodeBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||null,expiresAt:payment.date_of_expiration||null});
      if (payment.status === "approved") {
        const settled = await supabase.rpc("settle_payment", { purchase_id: order.id, external_payment_id: String(payment.id), paid_cents: order.total_cents, currency_code: "BRL" });
        if (settled.error) { console.error("payments.settlement", { code: settled.error.code, message: settled.error.message }); return json({ error: "Pagamento recebido; confirmação pendente. Não pague novamente." }, 503); }
      }
      const transaction = payment?.point_of_interaction?.transaction_data || {};

      /*
       * Se sua tabela orders já tiver payment_id,
       * salvamos o ID do pagamento criado.
       */
      const paymentSaved = await supabase
        .from("orders")
        .update({
          payment_id: String(payment.id),
        })
        .eq("id", order.id)
        .eq("user_id", user.id);

      if (paymentSaved.error) {
        console.error("payments.save_payment", { code: paymentSaved.error.code, message: paymentSaved.error.message });
        return json({ error: "Não foi possível salvar o pagamento. Consulte seus pedidos antes de tentar novamente." }, 500);
      }
      return json({
        paymentId: String(payment.id),
        status: payment.status,
        statusDetail: payment.status_detail,
        qrCode: transaction.qr_code || null,
        qrCodeBase64: transaction.qr_code_base64 || null,
        ticketUrl: transaction.ticket_url || null,
        expiresAt:
          payment.date_of_expiration ||
          order.expires_at ||
          null,
      });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error(error);

    return json(
      {
        error:
          error instanceof Error
            ? /date_of_expiration/.test(error.message) ? 'Não foi possível gerar o Pix porque o provedor recusou o prazo de pagamento. Volte ao pedido e tente novamente. Se já pagou, não pague de novo.' : error.message
            : "Erro interno no pagamento.",
      },
      500,
    );
  }
});