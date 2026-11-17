# Kash Avenue on Supabase: setup (about 15 minutes)

## 1. Database
Supabase > **SQL Editor** > New query > paste all of `schema.sql` > **Run**. It should say "Success".

## 2. Admin login
1. **Authentication > Users > Add user > Create new user.** Use your email and a strong password. Tick "Auto Confirm User".
2. New SQL query, with your real email:
   `insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL-HERE';`

## 3. Customer emails (needed for sign-up codes)
**Authentication > Email Templates**: edit BOTH "Confirm signup" and "Magic Link" so the body contains the code, e.g.

    <p>Hi,</p>
    <p>Your Kash Avenue code is:</p>
    <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
    <p>It works for a short time. If you did not ask for it, ignore this email.</p>

Leave **Authentication > Sign In / Providers > Email > "Confirm email"** switched ON.

Supabase's built-in email sender only allows a few emails per hour. Before real customers use it, connect your own sender under **Authentication > SMTP Settings** (Resend has a free plan).

## 4. Site address
**Authentication > URL Configuration**: set **Site URL** to your website address.

## 5. Photos
Your 18 product photos are in `images/` and go up with the site. New photos you upload in the admin page are stored in the `product-images` bucket (created by schema.sql).

## 6. Test before going live
Open `admin.html`, sign in, add a product. Open `index.html`, register a test customer, place an order, approve it in admin, and check the stock count drops.

## What is different from the Google version
- Customers sign in with **email** (phone sign-in is gone).
- Admin signs in with email and password, not the shared password.
- Invoices open in the admin page for printing. **Emailing invoices is not switched on yet.**
- Existing customers' passwords can't be copied across, so they reset on first login.

---

# Update 1: guest orders and invoice emails

## A. Database (once)
Supabase > SQL Editor > New query > paste all of `update-1-guest-orders.sql` > Run.
(If you are setting up a brand-new project, `schema.sql` already includes this.)

## B. Invoice email function (once)
1. Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Name it exactly `send-invoice`. Delete the sample code and paste all of `supabase-functions/send-invoice/index.ts`. Click **Deploy**.
3. **Project Settings > Edge Functions > Secrets** (or the Secrets tab on the Edge Functions page). Add two secrets:
   - `GMAIL_USER` = your Gmail address
   - `GMAIL_APP_PASSWORD` = the 16-letter Gmail app password (the same one used for sign-up emails)
4. Leave **Verify JWT** switched on.

## C. Website files
Replace `index.html` and `supabase-api.js` in GitHub (new branch + pull request, then Merge).

## How it works now
- Anyone can order without an account. Name, phone and delivery address are required. Email is optional.
- When you approve an order (status Confirmed or later) and the order has an email, the invoice is emailed automatically.
- No email on the order? Use **View invoice** and send it on WhatsApp.
- **Resend invoice** sends it again. A failed send shows the reason in the admin status line.
- Each phone number can place up to 5 orders per hour (spam guard).
