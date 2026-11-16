/* Kash Avenue: Supabase connector.
   Replaces the old Google Apps Script link. The shop and admin pages call kaFetch()
   exactly the way they used to call the Google script, so their design is unchanged. */
(function () {
  var SB_URL = "https://spcwowkkmyqkwrhfykhl.supabase.co";
  var SB_KEY = "sb_publishable_NSJkM6romoXID9WKMoiZIA_tX1C02Gl";   // public key: safe in the browser
  var BIZ = { name: "Kash Avenue", whatsapp: "+94 74 169 8089", instagram: "@kash.avenue", address: "", cur: "Rs" };  // shown on invoices
  var BUCKET = "product-images";
  var sb = window.supabase.createClient(SB_URL, SB_KEY);

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(t) { return parseInt(String(t || "0").replace(/[^0-9]/g, ""), 10) || 0; }
  function money(n) { var p = (Number(n) || 0).toFixed(2).split("."); return BIZ.cur + " " + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + p[1]; }
  function phone(p) { var d = String(p || "").replace(/\D/g, ""); if (d.indexOf("94") === 0 && d.length === 11) return d; if (d.charAt(0) === "0" && d.length === 10) return "94" + d.slice(1); if (d.length === 9) return "94" + d; return d; }
  function stObj(t) { var m = {}, has = false; String(t || "").split(";").forEach(function (x) { var i = x.lastIndexOf("="); if (i > 0) { m[x.slice(0, i).trim()] = Math.max(0, parseInt(x.slice(i + 1), 10) || 0); has = true; } }); return has ? m : null; }
  function stStr(m) { return m && typeof m === "object" ? Object.keys(m).map(function (k) { return k + "=" + m[k]; }).join(";") : ""; }
  function fail(e) { return { ok: false, error: (e && e.message) ? e.message : String(e) }; }

  function ordOld(o) {
    return { ref: o.ref, created: o.created, status: o.status, name: o.name || "", phone: o.phone || "", address: o.address || "",
      items: o.items || [], total: String(o.total || 0), paid: o.paid ? "yes" : "", note: o.note || "", deducted: o.deducted ? "yes" : "",
      email: o.email || "", cid: o.customer_id || "", shipping: o.shipping > 0 ? String(o.shipping) : "", invoiceNo: o.invoice_no || "", invoiceSent: o.invoice_sent || "" };
  }
  function invoiceHtml(o) {
    var sum = o.items.reduce(function (a, x) { return a + x.price * x.qty; }, 0), ship = num(o.shipping), tot = sum + ship, d = new Date(o.created);
    var rows = o.items.map(function (i) {
      return "<tr><td style='padding:8px;border-bottom:1px solid #eadfc2'>" + esc(i.name) + "<br><span style='color:#777;font-size:12px'>Size " + esc(i.size) + "</span></td>" +
        "<td style='padding:8px;border-bottom:1px solid #eadfc2;text-align:center'>" + i.qty + "</td>" +
        "<td style='padding:8px;border-bottom:1px solid #eadfc2;text-align:right'>" + money(i.price) + "</td>" +
        "<td style='padding:8px;border-bottom:1px solid #eadfc2;text-align:right'>" + money(i.price * i.qty) + "</td></tr>";
    }).join("");
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Invoice " + esc(o.invoiceNo) + "</title></head><body style='margin:0;background:#f6f1e7;font-family:Arial,Helvetica,sans-serif;color:#1a1405'>" +
      "<div style='max-width:680px;margin:0 auto;background:#fff;padding:32px;border-top:6px solid #c9a24d'>" +
      "<table width='100%'><tr><td><div style='font-size:28px;letter-spacing:4px'><b>" + esc(BIZ.name).toUpperCase() + "</b></div><div style='color:#9a7420;font-size:12px;letter-spacing:3px'>WEAR YOUR STORY</div></td>" +
      "<td style='text-align:right'><div style='font-size:22px;color:#9a7420'><b>INVOICE</b></div><div style='font-size:13px'>No: " + esc(o.invoiceNo) + "<br>Order: " + esc(o.ref) + "<br>Date: " + esc(isNaN(d) ? "" : d.toDateString()) + "</div></td></tr></table>" +
      "<table width='100%' style='margin:22px 0;font-size:14px'><tr><td valign='top'><b>Bill to</b><br>" + esc(o.name) + "<br>" + esc(o.phone) + "<br>" + esc(o.email) + "<br>" + esc(o.address) + "</td>" +
      "<td valign='top' style='text-align:right'><b>From</b><br>" + esc(BIZ.name) + "<br>WhatsApp " + esc(BIZ.whatsapp) + "<br>Instagram " + esc(BIZ.instagram) + (BIZ.address ? "<br>" + esc(BIZ.address) : "") + "</td></tr></table>" +
      "<table width='100%' style='border-collapse:collapse;font-size:14px'><tr style='background:#faf6ea'><th style='padding:8px;text-align:left'>Item</th><th style='padding:8px'>Qty</th><th style='padding:8px;text-align:right'>Price</th><th style='padding:8px;text-align:right'>Amount</th></tr>" + rows + "</table>" +
      "<table width='100%' style='margin-top:14px;font-size:14px'><tr><td style='text-align:right'>Subtotal</td><td style='text-align:right;width:130px'>" + money(sum) + "</td></tr>" +
      "<tr><td style='text-align:right'>Delivery</td><td style='text-align:right'>" + (ship ? money(ship) : "As confirmed") + "</td></tr>" +
      "<tr><td style='text-align:right;font-size:17px'><b>Total</b></td><td style='text-align:right;font-size:17px'><b>" + money(tot) + "</b></td></tr></table>" +
      "<p style='margin-top:18px;font-size:14px'><b>Payment status:</b> " + (o.paid === "yes" ? "PAID" : "NOT YET PAID. We will send payment details on WhatsApp.") + "</p>" +
      "<p style='margin-top:22px;font-size:12px;color:#777'>Thank you for shopping with " + esc(BIZ.name) + ". Questions? Message us on WhatsApp " + esc(BIZ.whatsapp) + ".</p></div></body></html>";
  }

  async function session() { var r = await sb.auth.getSession(); return r.data && r.data.session; }
  async function profile() {
    var s = await session(); if (!s) return null;
    var r = await sb.from("customers").select("id,name,phone,email,verified").eq("id", s.user.id).maybeSingle();
    return r.data ? { id: r.data.id, name: r.data.name, phone: r.data.phone, email: r.data.email } : null;
  }

  // ---------- public shop data ----------
  async function get() {
    var res = await Promise.all([sb.from("products").select("*").order("sort_order"), sb.from("settings").select("*")]);
    if (res[0].error) throw res[0].error;
    var st = {}; (res[1].data || []).forEach(function (r) { st[r.key] = r.value; });
    return { v: 3, settings: st, products: res[0].data.map(function (p) {
      return { name: p.name, category: p.category, price: String(p.price), sizes: p.sizes, colour: p.colour, image: p.image, status: p.status, badge: p.badge, stock: stStr(p.stock) };
    }) };
  }

  // ---------- everything else ----------
  async function post(b) {
    var a = b.action, r;
    try {
      // customers
      if (a === "register") {
        var name = String(b.name || "").trim().slice(0, 80), email = String(b.email || "").trim().toLowerCase(), ph = phone(b.phone), pw = String(b.password || "");
        if (name.length < 2) return { ok: false, error: "Please enter your name." };
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
        if (!/^\d{9,15}$/.test(ph)) return { ok: false, error: "Please enter a valid phone number." };
        if (pw.length < 8) return { ok: false, error: "Your password must be at least 8 characters." };
        r = await sb.auth.signUp({ email: email, password: pw, options: { data: { name: name, phone: ph } } });
        if (r.error) return { ok: false, error: r.error.message };
        if (r.data.user && r.data.user.identities && !r.data.user.identities.length) return { ok: false, error: "This email is already registered. Please sign in." };
        return { ok: true, verify: true };
      }
      if (a === "verify") {
        r = await sb.auth.verifyOtp({ email: String(b.email || "").trim().toLowerCase(), token: String(b.code || "").trim(), type: "signup" });
        if (r.error) return { ok: false, error: "That code is wrong or has expired." };
        return { ok: true, token: "session", profile: await profile() };
      }
      if (a === "resend") {
        r = await sb.auth.resend({ type: "signup", email: String(b.email || "").trim().toLowerCase() });
        return r.error ? { ok: false, error: "We could not send the email. Please wait a minute and try again." } : { ok: true };
      }
      if (a === "forgot") {
        await sb.auth.signInWithOtp({ email: String(b.email || "").trim().toLowerCase(), options: { shouldCreateUser: false } });
        return { ok: true };
      }
      if (a === "reset") {
        var pw2 = String(b.password || "");
        if (pw2.length < 8) return { ok: false, error: "Your password must be at least 8 characters." };
        r = await sb.auth.verifyOtp({ email: String(b.email || "").trim().toLowerCase(), token: String(b.code || "").trim(), type: "email" });
        if (r.error) return { ok: false, error: "That code is wrong or has expired." };
        var u = await sb.auth.updateUser({ password: pw2 }); await sb.auth.signOut();
        return u.error ? { ok: false, error: u.error.message } : { ok: true };
      }
      if (a === "login") {
        var id = String(b.ident || "").trim().toLowerCase();
        if (id.indexOf("@") < 1) return { ok: false, error: "Please sign in with your email address." };
        r = await sb.auth.signInWithPassword({ email: id, password: String(b.password || "") });
        if (r.error) {
          if (/not confirmed/i.test(r.error.message)) { await sb.auth.resend({ type: "signup", email: id }); return { ok: false, error: "verify", email: id }; }
          return { ok: false, error: "Wrong email or password." };
        }
        return { ok: true, token: "session", profile: await profile() };
      }
      if (a === "order") {
        r = await sb.rpc("place_order", { p_ref: b.ref || null, p_address: b.address || "", p_items: b.items || [] });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "me") {
        var s = await session(), p = s && await profile(); if (!p) return { ok: false, error: "auth" };
        var q = await sb.from("orders").select("*").eq("customer_id", s.user.id).order("created", { ascending: false });
        return { ok: true, profile: p, orders: (q.data || []).map(function (o) {
          var x = ordOld(o); return { ref: x.ref, created: x.created, status: x.status, items: x.items, total: x.total, shipping: x.shipping, paid: x.paid, invoiceNo: x.invoiceNo, invoice: x.invoiceNo ? invoiceHtml(x) : "" };
        }) };
      }

      // admin (must be signed in as an admin: the database enforces this)
      if (a === "ping") { r = await sb.rpc("is_admin"); return r.data === true ? { ok: true } : { ok: false, error: "This account is not an admin." }; }
      if (a === "save") {
        r = await sb.rpc("admin_save_products", { p_products: (b.products || []).map(function (p) {
          return { name: p.name, category: p.category, price: p.price, sizes: p.sizes, colour: p.colour, image: p.image, status: p.status, badge: p.badge, stock: stObj(p.stock) };
        }) });
        return r.error ? fail(r.error) : { ok: true };
      }
      if (a === "stockSet") {
        r = await sb.rpc("admin_set_stock", { p_updates: (b.updates || []).map(function (x) { return { name: x.name, stock: stObj(x.stock) }; }) });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "saveSettings") {
        r = await sb.rpc("admin_save_settings", { p_settings: b.settings || {} });
        return r.error ? fail(r.error) : { ok: true };
      }
      if (a === "orders") {
        r = await sb.from("orders").select("*").order("created", { ascending: true });
        return r.error ? fail(r.error) : { ok: true, orders: r.data.map(ordOld) };
      }
      if (a === "customers") {
        var cs = await sb.from("customers").select("*").order("created", { ascending: true }), os = await sb.from("orders").select("customer_id");
        if (cs.error) return fail(cs.error);
        var cnt = {}; (os.data || []).forEach(function (o) { if (o.customer_id) cnt[o.customer_id] = (cnt[o.customer_id] || 0) + 1; });
        return { ok: true, customers: cs.data.map(function (c) { return { id: c.id, created: c.created, name: c.name, phone: c.phone, email: c.email, verified: !!c.verified, orders: cnt[c.id] || 0 }; }) };
      }
      if (a === "orderUpdate") {
        r = await sb.rpc("admin_update_order", { p_ref: b.ref, p_status: b.status, p_paid: !!b.paid, p_note: b.note || "", p_shipping: b.shipping === "" || b.shipping == null ? 0 : num(b.shipping) });
        if (r.error) return fail(r.error);
        if (!r.data.ok) return r.data;
        var stock = {}; Object.keys(r.data.stock || {}).forEach(function (k) { stock[k] = stStr(r.data.stock[k]); });
        return { ok: true, order: ordOld(r.data.order), stock: stock, mail: "" };
      }
      if (a === "invoice" || a === "invoiceResend") {
        if (a === "invoiceResend") return { ok: false, error: "Emailing invoices is not switched on yet. Open the invoice and send it to the customer on WhatsApp." };
        r = await sb.from("orders").select("*").eq("ref", b.ref).maybeSingle();
        if (!r.data) return { ok: false, error: "Order not found" };
        var o = ordOld(r.data); if (!o.invoiceNo) return { ok: false, error: "Approve the order first to create an invoice." };
        return { ok: true, html: invoiceHtml(o) };
      }
      if (a === "upload") {
        var bin = atob(String(b.data || "").replace(/^data:[^,]*,/, "")), bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var path = Date.now() + "-" + String(b.name || "photo.jpg").replace(/[^\w.-]+/g, "-");
        var up = await sb.storage.from(BUCKET).upload(path, new Blob([bytes], { type: b.mime || "image/jpeg" }), { contentType: b.mime || "image/jpeg" });
        if (up.error) return fail(up.error);
        return { ok: true, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
      }
      return { ok: false, error: "Unknown action" };
    } catch (e) { return fail(e); }
  }

  function reply(o) { return new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } }); }
  window.kaFetch = function (url, opts) {
    if (opts && opts.body) return post(JSON.parse(opts.body)).then(reply);
    return get().then(reply);                    // a failed read rejects, so pages fall back safely
  };
  window.kaAdminLogin = async function (email, password) {
    var r = await sb.auth.signInWithPassword({ email: String(email || "").trim(), password: String(password || "") });
    if (r.error) return { ok: false, error: "Wrong email or password." };
    var p = await post({ action: "ping" }); if (!p.ok) await sb.auth.signOut(); return p;
  };
  window.kaAdminResume = async function () { return (await session()) ? post({ action: "ping" }) : { ok: false }; };
  window.kaSignOut = function () { return sb.auth.signOut(); };
})();
