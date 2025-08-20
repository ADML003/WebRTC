# 🚀 Deployment Troubleshooting Guide

## Railway 502 Error Fixes Applied:

### 1. **Enhanced Server Configuration**

- ✅ Fixed hostname binding to `0.0.0.0` (required for Railway)
- ✅ Added proper error handling and timeouts
- ✅ Improved graceful shutdown process
- ✅ Added comprehensive logging

### 2. **Railway Configuration**

- ✅ Simplified `railway.toml` configuration
- ✅ Proper health check endpoint at `/api/health`
- ✅ Removed conflicting PORT environment variable (Railway sets this automatically)

### 3. **Build Process**

- ✅ Ensured Next.js builds properly with `npm run build`
- ✅ Added startup diagnostics script
- ✅ Fixed package.json scripts

## Vercel Deployment Fixes Applied:

### 1. **Configuration Location**

- ✅ Moved `vercel.json` to the correct location (`/webrtc-nextjs/vercel.json`)
- ✅ Simplified configuration removing conflicting builds section
- ✅ Added proper function timeouts for signaling APIs

### 2. **Function Configuration**

- ✅ Set 10-second timeout for signaling functions
- ✅ Set 5-second timeout for health check
- ✅ Added proper CORS headers

## 📊 How to Monitor Deployments:

### Railway:

1. Check Railway logs for startup messages:

   - `🚀 Starting server in production mode`
   - `✅ Server successfully started!`
   - `🔍 Health: http://0.0.0.0:PORT/api/health`

2. Test health endpoint: `https://your-railway-domain/api/health`

### Vercel:

1. Check Vercel deployment logs
2. Test functions individually:
   - `/api/health`
   - `/api/signaling`

## 🔧 If Still Having Issues:

### Railway 502 Errors:

1. Check Railway logs for startup errors
2. Ensure PORT environment variable is not manually set
3. Verify health check responds within 60 seconds
4. Test locally with: `NODE_ENV=production npm start`

### Vercel Not Deploying:

1. Check GitHub integration is active
2. Verify build command succeeds
3. Check function timeouts aren't too short
4. Review Vercel deployment logs

## 🏃‍♂️ Quick Tests:

```bash
# Test local build
npm run build

# Test local server
NODE_ENV=production npm start

# Test health endpoint
curl http://localhost:3000/api/health

# Test WebRTC signaling
curl -X POST http://localhost:3000/api/signaling \
  -H "Content-Type: application/json" \
  -d '{"type":"register","deviceId":"test","data":{"deviceType":"browser"}}'
```

## 📈 Expected Results:

### Railway:

- No more 502 errors
- Server starts within 30 seconds
- Health check returns 200 status

### Vercel:

- Automatic deployment on git push
- Function cold starts under 10 seconds
- WebRTC signaling works correctly

---

**Next Steps After Deployment:**

1. Test video feed connection between phone and browser
2. Monitor performance and connection stability
3. Consider upgrading to Vercel KV for production if needed
