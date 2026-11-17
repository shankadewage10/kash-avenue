// Supabase Edge Function: send-invoice
// Emails an approved order's invoice to the customer through your Gmail account.
// Needs two secrets: GMAIL_USER and GMAIL_APP_PASSWORD (see SETUP.md).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const BIZ = { name: "Kash Avenue", whatsapp: "+94 74 169 8089", instagram: "@kash.avenue", address: "", cur: "Rs" };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (t: unknown) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const money = (n: number) => {
  const p = (Number(n) || 0).toFixed(2).split(".");
  return `${BIZ.cur} ${p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${p[1]}`;
};

function invoiceHtml(o: any): string {
  const items: any[] = o.items || [];
  const sum = items.reduce((a, x) => a + x.price * x.qty, 0);
  const ship = Number(o.shipping) || 0;
  const tot = sum + ship;
  const d = new Date(o.created);
  const cell = "padding:8px;border-bottom:1px solid #eadfc2";
  const rows = items.map((i) =>
    `<tr><td style="${cell}">${esc(i.name)}<br><span style="color:#777;font-size:12px">Size ${esc(i.size)}</span></td>` +
    `<td style="${cell};text-align:center">${i.qty}</td>` +
    `<td style="${cell};text-align:right">${money(i.price)}</td>` +
    `<td style="${cell};text-align:right">${money(i.price * i.qty)}</td></tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.invoice_no)}</title></head>` +
    `<body style="margin:0;background:#f6f1e7;font-family:Arial,Helvetica,sans-serif;color:#1a1405">` +
    `<div style="max-width:680px;margin:0 auto;background:#fff;padding:32px;border-top:6px solid #c9a24d">` +
    `<table width="100%"><tr><td><div style="font-size:28px;letter-spacing:4px"><b>${esc(BIZ.name).toUpperCase()}</b></div>` +
    `<div style="color:#9a7420;font-size:12px;letter-spacing:3px">WEAR YOUR STORY</div></td>` +
    `<td style="text-align:right"><div style="font-size:22px;color:#9a7420"><b>INVOICE</b></div>` +
    `<div style="font-size:13px">No: ${esc(o.invoice_no)}<br>Order: ${esc(o.ref)}<br>Date: ${esc(isNaN(d.getTime()) ? "" : d.toDateString())}</div></td></tr></table>` +
    `<table width="100%" style="margin:22px 0;font-size:14px"><tr><td valign="top"><b>Bill to</b><br>${esc(o.name)}<br>${esc(o.phone)}<br>${esc(o.email)}<br>${esc(o.address)}</td>` +
    `<td valign="top" style="text-align:right"><b>From</b><br>${esc(BIZ.name)}<br>WhatsApp ${esc(BIZ.whatsapp)}<br>Instagram ${esc(BIZ.instagram)}${BIZ.address ? "<br>" + esc(BIZ.address) : ""}</td></tr></table>` +
    `<table width="100%" style="border-collapse:collapse;font-size:14px"><tr style="background:#faf6ea"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th><th style="padding:8px;text-align:right">Price</th><th style="padding:8px;text-align:right">Amount</th></tr>${rows}</table>` +
    `<table width="100%" style="margin-top:14px;font-size:14px"><tr><td style="text-align:right">Subtotal</td><td style="text-align:right;width:130px">${money(sum)}</td></tr>` +
    `<tr><td style="text-align:right">Delivery</td><td style="text-align:right">${ship ? money(ship) : "As confirmed"}</td></tr>` +
    `<tr><td style="text-align:right;font-size:17px"><b>Total</b></td><td style="text-align:right;font-size:17px"><b>${money(tot)}</b></td></tr></table>` +
    `<p style="margin-top:18px;font-size:14px"><b>Payment status:</b> ${o.paid ? "PAID" : "NOT YET PAID. We will send payment details on WhatsApp."}</p>` +
    `<p style="margin-top:22px;font-size:12px;color:#777">Thank you for shopping with ${esc(BIZ.name)}. Questions? Message us on WhatsApp ${esc(BIZ.whatsapp)}.</p></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) only a signed-in admin may call this
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ ok: false, error: "Please sign in again." }, 401);
    const { data: isAdmin } = await admin.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    if (!isAdmin) return json({ ok: false, error: "Not allowed" }, 403);

    // 2) load the order
    const { ref, force } = await req.json();
    const { data: o } = await admin.from("orders").select("*").eq("ref", String(ref || "")).maybeSingle();
    if (!o) return json({ ok: false, error: "Order not found" }, 404);
    if (!o.invoice_no) return json({ ok: false, error: "Approve the order first to create an invoice." }, 400);
    if (!o.email) return json({ ok: false, error: "This order has no email address." }, 400);
    if (o.invoice_sent && !force) return json({ ok: true, skipped: true });

    // 3) send through Gmail
    const user = Deno.env.get("GMAIL_USER"), pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass) return json({ ok: false, error: "Email is not set up yet (missing GMAIL_USER / GMAIL_APP_PASSWORD secrets)." }, 500);
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
    });
    try {
      await client.send({
        from: `${BIZ.name} <${user}>`,
        to: o.email,
        subject: `Your ${BIZ.name} invoice ${o.invoice_no}`,
        content: `Hi ${o.name}, your order ${o.ref} is approved. Please view this email in HTML to see your invoice.`,
        html: invoiceHtml(o),
      });
    } finally {
      try { await client.close(); } catch (_) { /* ignore */ }
    }

    await admin.from("orders").update({ invoice_sent: new Date().toISOString() }).eq("ref", o.ref);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
