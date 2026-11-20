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
      email: o.email || "", cid: o.customer_id || "", shipping: o.shipping > 0 ? String(o.shipping) : "", invoiceNo: o.invoice_no || "", invoiceSent: o.invoice_sent || "", discType: o.discount_type || "", discValue: o.discount_value || 0, deleted: !!o.deleted_at, deletedAt: o.deleted_at || "" };
  }
  // Same maths as the database: line discounts, then order discount, then delivery.
  function calcOrder(o) {
    var lines = (o.items || []).map(function (i) {
      var gross = i.qty * i.price, t = i.dtype || "", v = Math.max(0, Number(i.dval) || 0), d = 0;
      if (t === "pct") d = Math.round(gross * Math.min(v, 100) / 100); else if (t === "amt") d = Math.min(Math.floor(v), gross); else t = "";
      return { gross: gross, disc: d, net: gross - d, type: t, val: v };
    });
    var sub = lines.reduce(function (a, l) { return a + l.net; }, 0), t = o.discType || "", v = Math.max(0, Number(o.discValue) || 0), od = 0;
    if (t === "pct") od = Math.round(sub * Math.min(v, 100) / 100); else if (t === "amt") od = Math.min(Math.floor(v), sub);
    var ship = Math.max(0, num(o.shipping));
    return { lines: lines, sub: sub, orderDisc: od, ship: ship, total: sub - od + ship };
  }
  function invoiceHtml(o) {
    var c = calcOrder(o), d = new Date(o.created), anyLine = c.lines.some(function (l) { return l.disc > 0; });
    var cell = "padding:8px;border-bottom:1px solid #eadfc2";
    var rows = o.items.map(function (i, n) {
      var l = c.lines[n];
      return "<tr><td style='" + cell + "'>" + esc(i.name) + "<br><span style='color:#777;font-size:12px'>" + (i.code ? esc(i.code) + " · " : "") + "Size " + esc(i.size) + "</span></td>" +
        "<td style='" + cell + ";text-align:center'>" + i.qty + "</td>" +
        "<td style='" + cell + ";text-align:right'>" + money(i.price) + "</td>" +
        (anyLine ? "<td style='" + cell + ";text-align:right;color:#a33'>" + (l.disc > 0 ? "&minus;" + money(l.disc) + (l.type === "pct" ? "<br><span style='font-size:12px'>(" + l.val + "%)</span>" : "") : "") + "</td>" : "") +
        "<td style='" + cell + ";text-align:right'>" + money(l.net) + "</td></tr>";
    }).join("");
    var odLabel = "Order discount" + (o.discType === "pct" ? " (" + Math.min(o.discValue, 100) + "%)" : "");
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Invoice " + esc(o.invoiceNo) + "</title><style>" +
      "@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e9e4d8}" +
      ".sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 15mm;font-family:Arial,Helvetica,sans-serif;color:#1a1405;border-top:2mm solid #c9a24d;box-shadow:0 0 8px rgba(0,0,0,.25)}" +
      ".sheet table{width:100%}tr{page-break-inside:avoid}.noprint{text-align:center;padding:12px}.noprint button{padding:10px 22px;font-size:15px;cursor:pointer}" +
      "@media print{html,body{background:#fff}.sheet{margin:0;box-shadow:none}.noprint{display:none}}" +
      "@media screen and (max-width:820px){.sheet{width:100%;min-height:0;padding:20px}}" +
      "</style></head><body><div class='noprint'><button onclick='window.print()'>Print or save as PDF (A4)</button></div><div class='sheet'>" +
      "<table width='100%'><tr><td><div style='font-size:28px;letter-spacing:4px'><b>" + esc(BIZ.name).toUpperCase() + "</b></div><div style='color:#9a7420;font-size:12px;letter-spacing:3px'>WEAR YOUR STORY</div></td>" +
      "<td style='text-align:right'><div style='font-size:22px;color:#9a7420'><b>INVOICE</b></div><div style='font-size:13px'>No: " + esc(o.invoiceNo) + "<br>Order: " + esc(o.ref) + "<br>Date: " + esc(isNaN(d) ? "" : d.toDateString()) + "</div></td></tr></table>" +
      "<table width='100%' style='margin:22px 0;font-size:14px'><tr><td valign='top'><b>Bill to</b><br>" + esc(o.name) + "<br>" + esc(o.phone) + "<br>" + esc(o.email) + "<br>" + esc(o.address) + "</td>" +
      "<td valign='top' style='text-align:right'><b>From</b><br>" + esc(BIZ.name) + "<br>WhatsApp " + esc(BIZ.whatsapp) + "<br>Instagram " + esc(BIZ.instagram) + (BIZ.address ? "<br>" + esc(BIZ.address) : "") + "</td></tr></table>" +
      "<table width='100%' style='border-collapse:collapse;font-size:14px'><tr style='background:#faf6ea'><th style='padding:8px;text-align:left'>Item</th><th style='padding:8px'>Qty</th><th style='padding:8px;text-align:right'>Price</th>" + (anyLine ? "<th style='padding:8px;text-align:right'>Discount</th>" : "") + "<th style='padding:8px;text-align:right'>Amount</th></tr>" + rows + "</table>" +
      "<table width='100%' style='margin-top:14px;font-size:14px'><tr><td style='text-align:right'>Subtotal</td><td style='text-align:right;width:130px'>" + money(c.sub) + "</td></tr>" +
      (c.orderDisc > 0 ? "<tr><td style='text-align:right;color:#a33'>" + esc(odLabel) + "</td><td style='text-align:right;color:#a33'>&minus;" + money(c.orderDisc) + "</td></tr>" : "") +
      "<tr><td style='text-align:right'>Delivery</td><td style='text-align:right'>" + (c.ship ? money(c.ship) : "As confirmed") + "</td></tr>" +
      "<tr><td style='text-align:right;font-size:17px'><b>Total</b></td><td style='text-align:right;font-size:17px'><b>" + money(c.total) + "</b></td></tr></table>" +
      "<p style='margin-top:18px;font-size:14px'><b>Payment status:</b> " + (o.paid === "yes" ? "PAID" : "NOT YET PAID. We will send payment details on WhatsApp.") + "</p>" +
      "<p style='margin-top:22px;font-size:12px;color:#777'>Thank you for shopping with " + esc(BIZ.name) + ". Questions? Message us on WhatsApp " + esc(BIZ.whatsapp) + ".</p></div></body></html>";
  }

  var HOLDS = ["Confirmed", "Packed", "Shipped", "Delivered"];
  async function sendInvoice(ref, force) {
    try {
      var r = await sb.functions.invoke("send-invoice", { body: { ref: ref, force: !!force } });
      if (r.error) {
        var msg = r.error.message || "Could not send";
        if (r.error.name === "FunctionsFetchError") msg = "The email function could not be reached. In Supabase, check that an Edge Function named exactly send-invoice is deployed and active.";
        try { var j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
        return { ok: false, error: msg };
      }
      return r.data && r.data.ok ? { ok: true } : { ok: false, error: (r.data && r.data.error) || "Could not send" };
    } catch (e) { return fail(e); }
  }
  async function session() { var r = await sb.auth.getSession(); return r.data && r.data.session; }
  async function isRemoved(uid) {
    var r = await sb.from("customers").select("deleted_at").eq("id", uid).maybeSingle();
    return !!(r.data && r.data.deleted_at);
  }
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
      return { id: p.id, name: p.name, code: p.code || "", category: p.category, price: String(p.price), sizes: p.sizes, colour: p.colour, image: p.image, status: p.status, badge: p.badge, stock: stStr(p.stock) };
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
        if (await isRemoved(r.data.user.id)) { await sb.auth.signOut(); return { ok: false, error: "This account has been removed. Please contact us on WhatsApp." }; }
        return { ok: true, token: "session", profile: await profile() };
      }
      if (a === "order") {
        if (b.account) { var ss = await session(); if (!ss || await isRemoved(ss.user.id)) return { ok: false, error: "auth" }; }
        r = await sb.rpc("place_order", { p_ref: b.ref || null, p_name: b.name || "", p_phone: phone(b.phone), p_email: String(b.email || "").trim(), p_address: b.address || "", p_items: b.items || [] });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "profile") {
        r = await sb.rpc("update_my_profile", { p_name: String(b.name || ""), p_phone: phone(b.phone) });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "me") {
        var s = await session(), p = s && await profile(); if (!p || await isRemoved(s.user.id)) return { ok: false, error: "auth" };
        var q = await sb.from("orders").select("*").eq("customer_id", s.user.id).is("deleted_at", null).order("created", { ascending: false });
        return { ok: true, profile: p, orders: (q.data || []).map(function (o) {
          var x = ordOld(o); return { ref: x.ref, created: x.created, status: x.status, items: x.items, total: x.total, shipping: x.shipping, paid: x.paid, discType: x.discType, discValue: x.discValue, invoiceNo: x.invoiceNo, invoice: x.invoiceNo ? invoiceHtml(x) : "" };
        }) };
      }

      // admin (must be signed in as an admin: the database enforces this)
      if (a === "ping") { r = await sb.rpc("is_admin"); return r.data === true ? { ok: true } : { ok: false, error: "This account is not an admin." }; }
      if (a === "save") {
        r = await sb.rpc("admin_save_products", { p_products: (b.products || []).map(function (p) {
          return { id: p.id || null, name: p.name, code: p.code, category: p.category, price: p.price, sizes: p.sizes, colour: p.colour, image: p.image, status: p.status, badge: p.badge, stock: stObj(p.stock) };
        }) });
        return r.error ? fail(r.error) : { ok: true };
      }
      if (a === "stockSet") {
        r = await sb.rpc("admin_set_stock", { p_updates: (b.updates || []).map(function (x) { return { code: x.code || "", name: x.name, stock: stObj(x.stock) }; }) });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "saveSettings") {
        r = await sb.rpc("admin_save_settings", { p_settings: b.settings || {} });
        return r.error ? fail(r.error) : { ok: true };
      }
      if (a === "orders") {
        r = await sb.from("orders").select("*").order("created", { ascending: false }).limit(1000);
        return r.error ? fail(r.error) : { ok: true, orders: r.data.slice().reverse().map(ordOld) };
      }
      if (a === "customers") {
        var cs = await sb.from("customers").select("*").order("created", { ascending: true }), os = await sb.from("orders").select("customer_id");
        if (cs.error) return fail(cs.error);
        var cnt = {}; (os.data || []).forEach(function (o) { if (o.customer_id) cnt[o.customer_id] = (cnt[o.customer_id] || 0) + 1; });
        return { ok: true, customers: cs.data.map(function (c) { return { id: c.id, created: c.created, name: c.name, phone: c.phone, email: c.email, verified: !!c.verified, orders: cnt[c.id] || 0, deleted: !!c.deleted_at, deletedAt: c.deleted_at || "" }; }) };
      }
      if (a === "customerDelete" || a === "customerRestore") {
        r = await sb.rpc("admin_set_customer_deleted", { p_id: b.id, p_deleted: a === "customerDelete" });
        return r.error ? fail(r.error) : r.data;
      }
      if (a === "orderDelete" || a === "orderRestore") {
        r = await sb.rpc("admin_set_order_deleted", { p_ref: b.ref, p_deleted: a === "orderDelete" });
        if (r.error) return fail(r.error);
        if (!r.data.ok) return r.data;
        var st2 = {}; Object.keys(r.data.stock || {}).forEach(function (k) { st2[k] = stStr(r.data.stock[k]); });
        return { ok: true, stock: st2, deletedAt: r.data.deletedAt || "" };
      }
      if (a === "orderUpdate") {
        r = await sb.rpc("admin_update_order", { p_ref: b.ref, p_status: b.status, p_paid: !!b.paid, p_note: b.note || "", p_shipping: b.shipping === "" || b.shipping == null ? 0 : num(b.shipping), p_line_disc: b.lineDisc || null, p_disc_type: b.discType == null ? null : b.discType, p_disc_value: b.discType == null ? null : Math.max(0, parseInt(b.discValue, 10) || 0) });
        if (r.error) return fail(r.error);
        if (!r.data.ok) return r.data;
        var stock = {}; Object.keys(r.data.stock || {}).forEach(function (k) { stock[k] = stStr(r.data.stock[k]); });
        var ord = ordOld(r.data.order), mail = "";
        if (ord.invoiceNo && !ord.invoiceSent && HOLDS.indexOf(ord.status) > -1) {
          if (!ord.email) mail = "No email on this order. Use View invoice and send it on WhatsApp.";
          else { var em = await sendInvoice(ord.ref, false); if (em.ok) { mail = "sent"; ord.invoiceSent = new Date().toISOString(); } else mail = "Invoice email failed: " + em.error; }
        }
        return { ok: true, order: ord, stock: stock, mail: mail };
      }
      if (a === "invoice" || a === "invoiceResend") {
        if (a === "invoiceResend") return await sendInvoice(b.ref, true);
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
  window.kaUploadFile = async function (file) {      // videos and other big files go straight to storage
    try {
      var path = Date.now() + "-" + String(file.name || "video.mp4").replace(/[^\w.-]+/g, "-");
      var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "video/mp4", cacheControl: "31536000" });
      if (up.error) return fail(up.error);
      return { ok: true, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
    } catch (e) { return fail(e); }
  };
  window.kaSignOut = function () { return sb.auth.signOut(); };
})();
