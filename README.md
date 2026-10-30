# Memorial website for Nze Dr. Louis Chukwukadibia Akah

This folder is the whole site, ready to publish on Cloudflare (free). It includes:

- **The book**: `public/index.html`
- **Lay a rose**: up to ten roses per phone or computer, counted live for everyone
- **Write to the family**: each message is saved privately for the family (and emailed, once email is set up). Nothing appears on the site until you add it yourself.
- **The family page**: `https://your-address/admin.html`, to read every message that has been sent

Your web address will be **https://louis-akah.pages.dev** (you can add your own domain later).

You need a computer with internet access, about 30 minutes, and a free Cloudflare account. Every step is copy and paste.

---

## 1. Install Node.js (once)

Download the **LTS** version from https://nodejs.org and install it like any other app.

## 2. Open a terminal in this folder

- **Mac:** open the **Terminal** app, type `cd ` (with a space), drag this folder onto the window, and press Enter.
- **Windows:** open this folder, click the address bar, type `powershell` and press Enter.

## 3. Sign in to Cloudflare

```
npx wrangler login
```

Your browser opens. Sign in (or create a free account) and click **Allow**.

## 4. Create the database

```
npx wrangler d1 create memorial-db
```

It prints a line like `database_id = "a1b2c3d4-…"`. Open `wrangler.toml` in any text editor (TextEdit, Notepad) and paste that id in place of `PASTE-YOUR-DATABASE-ID-HERE`. Save the file.

Then create the tables:

```
npx wrangler d1 execute memorial-db --remote --file=schema.sql
```

## 5. Publish

```
npx wrangler pages deploy
```

The first time it asks you to create a project: press Enter to accept `louis-akah`, and choose `main` as the branch. When it finishes, it prints your link. **Share that link.**

Run the same command again whenever anything in the folder changes.

## 6. Set the family password

Choose a long password the family will share, then run:

```
npx wrangler pages secret put ADMIN_KEY --project-name louis-akah
```

Paste the password when asked, then publish again (step 5). Open `https://louis-akah.pages.dev/admin.html` and enter the password to read the messages people have sent.

---

## Optional: receive messages by email

1. Create a free account at https://resend.com and create an **API key**.
2. Save it to Cloudflare:
   ```
   npx wrangler pages secret put RESEND_API_KEY --project-name louis-akah
   ```
3. In `wrangler.toml`, put your email between the quotes: `FAMILY_EMAIL = "you@example.com"`.
4. Publish again (step 5).

Until your own domain is verified in Resend, Resend only sends to the email address you signed up with, so use that address.

## Optional: your own domain

In the Cloudflare dashboard open **Workers & Pages → louis-akah → Custom domains → Set up a custom domain** and follow the steps.

## Optional: spam protection

In the Cloudflare dashboard open **Turnstile → Add widget**, add your site address, and choose **Managed**. Put the **site key** in `public/index.html` (search for `turnstileSiteKey: ""`), save the **secret key** with `npx wrangler pages secret put TURNSTILE_SECRET --project-name louis-akah`, and publish again.

---

## Photos

Photos live in `public/photos/` and are matched by file name. A missing photo shows its soft placeholder.

| File name | Where it appears |
|---|---|
| `cover.jpg` | Front cover and the centre of the rose wreath |
| `back-cover.jpg` | Back cover |
| `share.jpg` | The preview image when the link is shared on WhatsApp |
| `portrait-70th.jpg`, `garden-2022.jpg`, `desk-1995.jpg`, `wedding-1976.jpg`, `grandchildren-2023.jpg`, `townhall-2010.jpg`, `church-2019.jpg` | The full-screen photos between sections |
| `story-ckc-1964.jpg` | Beside his story |
| `album-….jpg` (12 files) | His life in photos; the exact names are in `index.html` |

Scanned condolence letters go in `public/letters/`.

## How the limits work

- Up to ten roses per phone or computer, and one message per phone or computer.
- No web links are allowed in messages.
- Visitors' IP addresses are never stored; only a scrambled version is kept, used for rate limits.

## Keeping a copy of every message

```
npx wrangler d1 execute memorial-db --remote --command "SELECT name, place, message, created_at FROM condolences ORDER BY id" --json > messages.json
```
