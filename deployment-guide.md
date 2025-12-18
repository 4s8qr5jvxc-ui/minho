# MINHE Messaging App - Deployment Guide

This guide explains how to deploy your MINHE messaging application to various hosting platforms.

## 📋 Prerequisites

- Node.js installed (v14 or higher)
- Git repository (for most hosting platforms)
- Basic understanding of environment variables

## 🚀 Quick Deploy Options

### Option 1: Render.com (Recommended - Free Tier Available)

Render automatically deploys both frontend and backend from a single repository.

#### Steps:

1. **Create a Render account** at [render.com](https://render.com)

2. **Create a new Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub/GitLab repository
   - Configure:
     - **Name:** `minhe-server` (or your choice)
     - **Environment:** Node
     - **Build Command:** `cd server && npm install && cd ../client && npm install && npm run build`
     - **Start Command:** `cd server && npm start`
     - **Branch:** main (or your branch name)

3. **Set Environment Variables**
   - Go to "Environment" tab
   - Add:
     ```
     PORT=10000
     CORS_ORIGIN=*
     NODE_ENV=production
     ```

4. **Deploy!**
   - Render will automatically build and deploy
   - Your app will be available at `https://your-app-name.onrender.com`

5. **Test the deployment**
   - Open the URL
   - Create two accounts (use two different browsers)
   - Test friend requests, messaging, and calls

---

### Option 2: Railway.app

Railway offers a simple deployment process with excellent WebSocket support.

#### Steps:

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Create a new Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your MINHE repository

3. **Configure the Service**
   - Railway auto-detects Node.js
   - Add environment variables:
     ```
     PORT=${{PORT}}
     CORS_ORIGIN=*
     NODE_ENV=production
     ```
   - Set build command: `cd server && npm install && cd ../client && npm install && npm run build`
   - Set start command: `cd server && npm start`

4. **Generate Domain**
   - Go to Settings → Enable "Generate Domain"
   - Your app will be available at `https://your-app.up.railway.app`

---

### Option 3: Heroku

Traditional platform with proven reliability.

#### Steps:

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create a Heroku app**
   ```bash
   heroku create your-app-name
   ```

4. **Add Procfile** to project root:
   ```
   web: cd server && npm start
   ```

5. **Configure build**
   Set buildpacks:
   ```bash
   heroku buildpacks:set heroku/nodejs
   ```

6. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CORS_ORIGIN=*
   ```

7. **Add `heroku-postbuild` script** to `server/package.json`:
   ```json
   "scripts": {
     "start": "node index.js",
     "dev": "nodemon index.js",
     "heroku-postbuild": "cd ../client && npm install && npm run build"
   }
   ```

8. **Deploy**
   ```bash
   git push heroku main
   ```

9. **Open your app**
   ```bash
   heroku open
   ```

---

### Option 4: VPS / Custom Server (DigitalOcean, Linode, AWS EC2, etc.)

For maximum control and scalability.

#### Steps:

1. **SSH into your server**
   ```bash
   ssh user@your-server-ip
   ```

2. **Install Node.js and npm**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone your repository**
   ```bash
   git clone https://github.com/yourusername/minhe.git
   cd minhe
   ```

4. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install && npm run build
   cd ../server
   ```

5. **Create environment file**
   ```bash
   nano .env
   ```
   Add:
   ```
   PORT=3001
   CORS_ORIGIN=*
   NODE_ENV=production
   ```

6. **Install PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   ```

7. **Start the server with PM2**
   ```bash
   pm2 start index.js --name minhe-server
   pm2 save
   pm2 startup
   ```

8. **Configure Nginx as reverse proxy** (optional but recommended)
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/minhe
   ```

   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/minhe /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Setup SSL with Let's Encrypt** (for HTTPS)
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## 🔧 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3001 | No |
| `NODE_ENV` | Environment mode | development | No |
| `CORS_ORIGIN` | Allowed CORS origins | * | No |
| `VITE_SERVER_URL` | Override server URL (client) | Auto-detected | No |

### CORS_ORIGIN Examples:
- Development: `*` (allow all)
- Production (single domain): `https://yourdomain.com`
- Production (multiple): `https://app1.com,https://app2.com`

---

## ✅ Post-Deployment Checklist

After deploying, verify these features work:

- [ ] ✅ User registration creates new accounts
- [ ] ✅ Login works with existing credentials
- [ ] ✅ Friend search finds users
- [ ] ✅ Friend requests send and receive in real-time
- [ ] ✅ Messages send and appear instantly
- [ ] ✅ Typing indicators work
- [ ] ✅ Status changes (Online, DND, Invisible) broadcast to friends
- [ ] ✅ Voice/video calls connect (if using HTTPS)
- [ ] ✅ Profile pictures upload and display
- [ ] ✅ Bio updates reflect in user profiles

---

## 🐛 Troubleshooting

### Issue: "WebSocket connection failed"
**Solution:** Ensure your hosting platform supports WebSocket connections. Some platforms require enabling WebSockets in settings.

### Issue: "Cannot connect to server"
**Solution:** 
- Check that `PORT` environment variable matches your hosting platform's requirements
- Verify CORS_ORIGIN is set correctly
- Check server logs for errors

### Issue: "Friend requests/messages don't work"
**Solution:**
- Ensure Socket.IO is properly initialized (check server logs for "Socket.IO ready")
- Verify WebSocket connections are allowed through firewall
- Test with browser console open to see connection errors

### Issue: "Calls don't connect"
**Solution:**
- PeerJS requires WebRTC which needs HTTPS in production
- Ensure you have SSL certificate installed
- Check that browser permissions for camera/microphone are granted

### Issue: "App shows but features are broken"
**Solution:**
- Build the client properly: `cd client && npm run build`
- Ensure built files are in `server/public` directory
- Check browser console for API errors

---

## 🔒 Security Recommendations

### For Production:

1. **Use HTTPS** - Essential for WebRTC calls and security
2. **Restrict CORS** - Set `CORS_ORIGIN` to your specific domain
3. **Add authentication** - Consider adding JWT tokens for API security
4. **Database** - Move from in-memory DB to PostgreSQL/MongoDB
5. **Rate limiting** - Add rate limiting to prevent abuse
6. **Input validation** - Validate all user inputs server-side

---

## 📞 Support

If you encounter issues:
1. Check server logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Ensure all dependencies are installed

## 🎉 Success!

Once deployed and tested, your MINHE messaging app is ready for users worldwide!

**Default Local URLs:**
- Client (dev): http://localhost:3000
- Server (dev): http://localhost:3001

**Production:**
- Everything served from: `https://your-domain.com`
