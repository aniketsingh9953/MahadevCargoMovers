# Mahadev Cargo Movers — LR Management System

A simple, free, self-hosted web app for **Mahadev Cargo Movers** to create,
store, and download Consignment Notes (Lorry Receipts / LR) — the same
layout as your printed LR format, but digital.

## What this does

- **Login-protected** — only you (single admin account) can access it.
- **Fill the LR form** — every field from your printed consignment note:
  origin/destination, consignor & consignee, vehicle & driver, invoice &
  e-way bill, goods description, loading details, GST & risk type, remarks.
- **Saves every entry to a database** (SQLite — a free, file-based
  database, no monthly cost, no separate database server to manage).
- **Download as PDF** — any saved entry can be downloaded as a
  professionally formatted PDF matching your LR layout, ready to print or
  email.
- **Search and browse** — every LR you've ever created stays in your
  dashboard; search by LR number, vehicle, consignor, consignee, or route.
- **Auto LR numbering** — suggests the next LR number in sequence
  (`MCM/2026/0001`, `MCM/2026/0002`, ...) — you can still edit it manually.

## Project structure

```
mahadev-cargo/
├── backend/          Node.js + Express API + SQLite database
│   ├── server.js
│   ├── package.json
│   ├── .env.example  Copy this to .env and fill in your own secret
│   ├── db/
│   │   ├── init.js        Run once to set up the database + admin login
│   │   └── connection.js
│   └── routes/
│       ├── auth.js          Login, change password
│       ├── consignments.js  Create/read/update/delete LR entries
│       └── pdf.js           Generates the downloadable PDF
└── frontend/         Plain HTML/CSS/JS (no build step needed)
    ├── index.html
    └── src/
        ├── app.js     All app logic (login, dashboard, form, list)
        ├── api.js     Talks to the backend
        ├── config.js  Backend URL — change this if you deploy separately
        ├── icons.js
        └── styles/main.css
```

---

## Run it on your own computer

You'll need [Node.js](https://nodejs.org) version **22.5 or newer** installed
(check with `node -v` in a terminal). This project uses Node's own built-in
SQLite support, so there's nothing to compile and no extra database
software to install — it just works out of the box on Windows, Mac, or
Linux.

1. **Open a terminal** in the `mahadev-cargo/backend` folder.

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Set up your secret key and admin password.**
   Copy `.env.example` to a new file named `.env` in the same folder, then
   open `.env` and:
   - Replace `JWT_SECRET` with a long random string. You can generate one
     by running:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to whatever you want your
     login to be.

4. **Create the database** (this also creates your admin login):
   ```
   npm run init-db
   ```
   This only needs to be run once. It's safe to run again later — it won't
   delete existing data, it just won't create a second admin account.

5. **Start the server:**
   ```
   npm start
   ```
   You should see: `Mahadev Cargo Movers server running on http://localhost:4000`

6. **Open your browser** to **http://localhost:4000** and log in with the
   username/password you set in step 3.

   You may see a yellow warning in the terminal that says
   `ExperimentalWarning: SQLite is an experimental feature`. This is
   normal and harmless — it's just Node telling you its built-in
   database support is relatively new. It doesn't affect anything.

That's it — you're running the full app locally. Every LR you save goes
into `backend/db/mahadev.db`, a single file. Back that file up (copy it
somewhere safe) and you have a backup of every consignment note.

---

## Deploy it for free so you can use it from anywhere

[Render](https://render.com) has a free tier that works well for this
project. (Railway, Fly.io, and Cyclic are similar alternatives.)

1. **Put this project on GitHub.**
   - Create a new repository on [github.com](https://github.com).
   - From inside the `mahadev-cargo` folder, run:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin <your-repo-url>
     git push -u origin main
     ```
   - The `.gitignore` file already makes sure your `.env` file and database
     are never uploaded — keep it that way, never commit your real `.env`.

2. **Create a free Render account** at render.com and connect your GitHub.

3. **Create a new Web Service** on Render, pointing at your repository.
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run init-db`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

4. **Add environment variables** in Render's dashboard (under
   "Environment"), matching your `.env` file:
   - `JWT_SECRET` — a long random string (generate one as shown above)
   - `ADMIN_USERNAME` — your chosen username
   - `ADMIN_PASSWORD` — your chosen password
   - `CORS_ORIGIN` — you can leave this as `*` for now

5. **Deploy.** Render will give you a URL like
   `https://mahadev-cargo.onrender.com`. Since the Express server also
   serves the frontend (see `server.js`), this one URL gives you the whole
   app — open it, log in, and you're live.

### A note on Render's free tier

Free web services on Render "spin down" after periods of no traffic and
take ~30-60 seconds to wake up on the next visit. For a personal/small
business tool that's used a few times a day, this is a fine trade-off for
$0/month. If that delay ever bothers you, Render's paid tier removes it
for a few dollars a month — but free works completely fine to start.

### Important: the free tier's disk is not permanent

Render's free web services use an ephemeral filesystem, which means the
SQLite database file can be wiped on redeploys. For a project you intend
to rely on long-term, you have two good options:
- Use Render's **persistent disk** add-on (small monthly cost, but keeps
  your `.db` file safe across deploys), or
- Periodically download/back up `backend/db/mahadev.db` (you could build
  a simple backup button later, or just download it manually via Render's
  shell access).

For now, while you're testing this as a project, the free tier is perfect.
When you're ready to depend on it for real business records, upgrading to
a persistent disk (or moving to a small paid Postgres database) is the
move — happy to help you with that step when you're ready.

---

## Changing your password

Once logged in, go to **Account Settings** in the sidebar to change your
password at any time.

## Customizing the company details

Your company's name, address, GSTIN, and PAN are currently hard-coded into
the PDF template (matching your printed LR) in
`backend/routes/pdf.js`, and into the login screen / sidebar in
`frontend/src/app.js`. If any of these details change, search for them in
those two files and update directly.

## Adding more fields later

If you want to add a new field to the form (e.g. "Number of Packages
Loaded" or anything else from a future LR redesign), you'll touch three
places:
1. `backend/db/init.js` — add the new column to the `consignment_notes` table
2. `backend/routes/consignments.js` — add the field name to the `FIELDS` array
3. `frontend/src/app.js` — add an input field in `renderFormView`
4. `backend/routes/pdf.js` — add it to the generated PDF layout

Feel free to come back and ask for help with any of this — the code is
intentionally kept simple (no frameworks, no build tools) so it's easy to
read and modify even if you're newer to coding.
