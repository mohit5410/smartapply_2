# SmartApply — Production Deployment Guide

## What's Inside

```
smartapply-prod/
├── server.js              ← Main Express server
├── package.json           ← Dependencies
├── .env.example           ← Environment config template
├── .gitignore
├── Dockerfile             ← For Docker/Railway deployment
├── models/
│   ├── User.js            ← User schema (admin, students, staff)
│   └── Application.js     ← Application schema
├── middleware/
│   ├── auth.js            ← JWT authentication
│   └── email.js           ← Email notifications (Nodemailer)
├── routes/
│   ├── auth.js            ← Login, change password
│   ├── admin.js           ← Manage students, staff
│   ├── applications.js    ← Submit, approve, reject
│   └── ai.js              ← AI proxy (keeps API key secure)
└── public/
    └── index.html         ← Production frontend
```

## Tech Stack
- **Backend:** Node.js + Express
- **Database:** MongoDB (with Mongoose ODM)
- **Auth:** JWT tokens + bcrypt password hashing
- **Email:** Nodemailer (supports Gmail, SMTP)
- **AI:** Anthropic Claude API (server-side proxy)
- **Frontend:** Vanilla HTML/CSS/JS (no build step needed)


---
## OPTION A: Deploy on Railway (Recommended — Easiest)
---

Railway gives you a server + database in one click. Free trial, then ~$5/month.

### Step 1: Create accounts
1. Go to https://railway.app and sign up with GitHub
2. Go to https://www.mongodb.com/atlas and create a free account

### Step 2: Create MongoDB Atlas database (Free)
1. In MongoDB Atlas, click "Build a Database"
2. Choose FREE Shared cluster
3. Select any region close to you
4. Create a database user (save the username/password!)
5. In Network Access, click "Allow Access from Anywhere" (0.0.0.0/0)
6. Click "Connect" → "Drivers" → Copy the connection string
7. It looks like: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/smartapply

### Step 3: Push code to GitHub
```bash
cd smartapply-prod
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/smartapply.git
git push -u origin main
```

### Step 4: Deploy on Railway
1. Go to https://railway.app/new
2. Click "Deploy from GitHub Repo"
3. Select your smartapply repo
4. Railway will detect Node.js automatically
5. Go to your service → Settings → Variables, and add:

```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/smartapply
JWT_SECRET=any-random-long-string-here-make-it-unique
PORT=3000
ADMIN_USER=admin
ADMIN_PASSWORD=admin123
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

6. Railway will auto-deploy. Click "Generate Domain" to get your URL.
7. Your app is live at https://smartapply-production.up.railway.app


---
## OPTION B: Deploy on Render (Free Tier Available)
---

### Step 1: Same as Railway — create MongoDB Atlas + push to GitHub

### Step 2: Deploy on Render
1. Go to https://render.com and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. Add environment variables (same as Railway above)
6. Click "Create Web Service"
7. Your app is live at https://smartapply.onrender.com


---
## OPTION C: Deploy with Docker (VPS / DigitalOcean)
---

### On any Linux server (Ubuntu):
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone your repo
git clone https://github.com/YOUR_USERNAME/smartapply.git
cd smartapply

# Create .env file
cp .env.example .env
nano .env  # Fill in your values

# Build and run
docker build -t smartapply .
docker run -d -p 3000:3000 --env-file .env --name smartapply smartapply

# Your app is now running on port 3000
```

### With Nginx reverse proxy (for domain + HTTPS):
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/smartapply
```

```nginx
server {
    server_name smartapply.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/smartapply /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d smartapply.yourdomain.com
```


---
## OPTION D: Run Locally (For Testing)
---

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- MongoDB running locally OR MongoDB Atlas connection string

```bash
cd smartapply-prod

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and set your MONGODB_URI

# Start the server
npm run dev

# Open http://localhost:3000
```


---
## Email Setup (Gmail)
---

To send real email notifications:

1. Go to https://myaccount.google.com
2. Security → 2-Step Verification → Turn ON
3. Security → App Passwords → Generate one for "Mail"
4. Copy the 16-character password
5. In your .env:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx  (the app password)
```


---
## AI Setup (Anthropic API)
---

1. Go to https://console.anthropic.com
2. Create an API key
3. Add to .env:
```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
```

The AI key is stored server-side only — never exposed to the frontend.


---
## Custom Domain
---

After deploying on Railway/Render:

1. Buy a domain (Namecheap, GoDaddy, etc.)
2. In Railway/Render: Settings → Custom Domain → Add your domain
3. Update DNS records as instructed (CNAME record)
4. HTTPS is automatic


---
## First-Time Setup After Deployment
---

1. Open your app URL
2. Login as Admin: **admin** / **admin123**
3. **Change the admin password immediately!** (click 🔒)
4. Upload Student Excel file (Students tab)
5. Add HODs (one per department)
6. Add Coordinators
7. Add Program Leaders
8. Share credentials with each person
9. Each person logs in and changes their password


---
## API Endpoints Reference
---

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | Login |
| POST | /api/auth/change-password | Yes | Change password |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/admin/students | Admin | List students |
| POST | /api/admin/students/upload | Admin | Upload Excel |
| GET | /api/admin/staff | Admin | List staff |
| POST | /api/admin/staff | Admin | Create staff |
| DELETE | /api/admin/staff/:id | Admin | Remove staff |
| GET | /api/applications | Yes | List my applications |
| POST | /api/applications | Student | Submit application |
| POST | /api/applications/:id/action | Staff | Approve/reject |
| POST | /api/ai/generate | Yes | AI writing |
| GET | /api/health | No | Health check |
