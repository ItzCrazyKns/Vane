# User Management Implementation

## Overview

This document describes the user authentication and management system added to Perplexica. The implementation follows patterns from open-webui, adapted for Perplexica's Next.js architecture.

## Quick Start Commands

```bash
# Development
pnpm dev                           # Start dev server at http://localhost:3000

# Production
pnpm build                         # Build for production
node .next/standalone/server.js   # Start production server

# DON'T USE (doesn't work with standalone config):
# pnpm start  ❌
```

## Summary of Changes

**Before:** Perplexica had no authentication. All API routes were unprotected and all chat data was globally accessible.

**After:** Full JWT-based authentication with user registration, login, and per-user chat isolation.

---

## Architecture

### Authentication Flow

1. **Registration** (`/register`):
   - User provides email, password, optional name
   - Password hashed with bcrypt (12 rounds)
   - First registered user becomes admin, subsequent users are standard users
   - JWT token created and stored in HTTPOnly cookie
   - User redirected to home page

2. **Login** (`/login`):
   - User provides email and password
   - Password verified against bcrypt hash
   - JWT token created and stored in HTTPOnly cookie
   - User redirected to home page

3. **Middleware Protection** (`src/middleware.ts`):
   - Runs on all routes except public paths (`/login`, `/register`, `/api/auth/*`)
   - Verifies JWT token from cookie
   - Injects user info into request headers (`x-user-id`, `x-user-email`, `x-user-role`)
   - Returns 401 for API routes or redirects to `/login` for pages if unauthorized

4. **API Routes**:
   - Extract user info from headers (set by middleware)
   - Filter/verify chat ownership
   - Associate new chats with current user

---

## Database Schema

### New Tables

**`users` table:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'user',      -- 'user' or 'admin'
  settings TEXT DEFAULT '{}',    -- JSON object
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

**`auth` table:**
```sql
CREATE TABLE auth (
  id INTEGER PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,    -- bcrypt hash
  active INTEGER DEFAULT 1       -- boolean
);
```

**`audit_logs` table:**
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  eventType TEXT NOT NULL,        -- 'login_success', 'login_failure', 'logout', 'register', 'role_change', 'user_delete'
  userId TEXT REFERENCES users(id) ON DELETE SET NULL,
  targetUserId TEXT,              -- For admin actions on other users
  ipAddress TEXT,
  userAgent TEXT,
  details TEXT,                   -- JSON object with event-specific data
  createdAt TEXT NOT NULL
);
```

### Modified Tables

**`chats` table - added userId column:**
```sql
ALTER TABLE chats ADD COLUMN userId TEXT REFERENCES users(id) ON DELETE CASCADE;
```

---

## JWT Secret Configuration

### What is JWT_SECRET?

`JWT_SECRET` is a secret key used to sign and verify JWT (JSON Web Token) authentication tokens. Think of it as the "master password" that:
- **Signs tokens**: Creates a cryptographic signature when generating tokens
- **Verifies tokens**: Validates that tokens haven't been tampered with

### Security Importance

🔒 **Critical**: If someone obtains your JWT_SECRET, they can:
- Create valid tokens for any user
- Impersonate any account (including admin)
- Bypass authentication entirely

### How to Generate

Generate a secure random string (at least 32 characters):

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 32

# Option 3: Using /dev/urandom
head -c 32 /dev/urandom | base64
```

### How to Use

#### Development (Local)

Create a `.env.local` file in the Perplexica root directory:

```bash
# .env.local
JWT_SECRET=your-generated-secret-here-minimum-32-chars
```

#### Production (Docker)

Add to your `docker-compose.yaml`:

```yaml
services:
  perplexica:
    environment:
      - JWT_SECRET=your-generated-secret-here-minimum-32-chars
```

Or pass as environment variable:

```bash
docker run -e JWT_SECRET=your-secret-here perplexica
```

#### Production (Non-Docker)

Set environment variable, build, and start:

```bash
export JWT_SECRET=your-generated-secret-here
pnpm build
node .next/standalone/server.js
```

**Note**: Don't use `pnpm start` - it doesn't work with standalone build configuration.

### Default Behavior

⚠️ **Warning**: If `JWT_SECRET` is not set, the application uses a fallback value:
```
"perplexica-default-secret-change-in-production"
```

**This is insecure for production!** Always set a custom secret in production environments.

---

## File Structure

### New Files

#### Authentication Library (`src/lib/auth/`)

**`src/lib/auth/index.ts`**
- `hashPassword(password)` - Bcrypt hash generation
- `verifyPassword(password, hash)` - Bcrypt verification
- `createToken(userId, email, role)` - JWT token creation (7 day expiry)
- `verifyToken(token)` - JWT token verification
- `getCurrentUser()` - Extract user from cookie
- `setAuthCookie(token)` - Set auth cookie
- `clearAuthCookie()` - Clear auth cookie

**`src/lib/auth/types.ts`**
- TypeScript interfaces: `AuthUser`, `SessionUser`, `JWTPayload`, `UserSettings`

**`src/lib/auth/helpers.ts`**
- `AuthError` class - Custom error with HTTP status
- `isAuthError()` - Type guard for AuthError
- `getRequestUser()` - Extract user from request headers
- `requireUser()` - Extract user or throw AuthError
- `requireAdmin()` - Ensure user is admin or throw AuthError
- `handleAuthRouteError()` - Standardized error response handler

**`src/lib/auth/constants.ts`**
- `AUTH_COOKIE_NAME` - Cookie name for auth token
- `TOKEN_EXPIRY` - JWT expiry duration
- `PUBLIC_API_ROUTES` - Routes that don't require auth
- `PUBLIC_PAGES` - Pages accessible without login
- `getJwtSecret()` - Get JWT secret with production validation

**`src/lib/auth/validation.ts`**
- `validatePassword()` - Password complexity validation
- `validateEmail()` - Email format validation

**`src/lib/auth/rateLimiter.ts`**
- `checkRateLimit()` - Check and record rate limit attempt
- `resetRateLimit()` - Clear rate limit for a key
- `getClientIp()` - Extract client IP from headers

**`src/lib/auth/audit.ts`**
- `logAuditEvent()` - Generic audit logging
- `logLoginSuccess()` - Log successful login
- `logLoginFailure()` - Log failed login
- `logLogout()` - Log user logout
- `logRegistration()` - Log new user registration
- `logRoleChange()` - Log admin role changes
- `logUserDelete()` - Log admin user deletion

**`src/lib/contexts/UserSettingsContext.tsx`**
- `UserSettingsProvider` - React context provider for user settings
- `useUserSettings()` - Hook for accessing user settings with loading state

**`src/lib/migrations/migrate-legacy-data.ts`**
- `migrateLegacyData()` - Assign orphaned chats/files to admin
- `hasLegacyData()` - Check if migration is needed

#### Middleware

**`src/middleware.ts`**
- Intercepts all requests
- Public routes defined in `constants.ts`
- `validateJwtPayload()` - Runtime type validation of JWT claims
- `verifyTokenFromRequest()` - Verify JWT and extract user
- Injects user info into headers (`x-user-id`, `x-user-email`, `x-user-role`)
- Redirects unauthenticated users to `/login`
- Returns 401 for unauthenticated API requests

#### API Routes (`src/app/api/auth/`)

**`register/route.ts`**
- POST `/api/auth/register`
- Body: `{ email, password, name? }`
- First user becomes admin
- Returns user object

**`login/route.ts`**
- POST `/api/auth/login`
- Body: `{ email, password }`
- Verifies credentials
- Returns user object

**`logout/route.ts`**
- POST `/api/auth/logout`
- Clears auth cookie

**`me/route.ts`**
- GET `/api/auth/me`
- Returns current user profile

#### Frontend Components

**`src/app/login/page.tsx`**
- Login form with email/password
- Error handling
- Link to registration

**`src/app/register/page.tsx`**
- Registration form with email/password/name
- Password validation (min 8 chars)
- Link to login

**`src/lib/hooks/useAuth.tsx`**
- React context provider for authentication state
- `useAuth()` hook returning:
  - `user` - Current user object or null
  - `loading` - Boolean loading state
  - `logout()` - Logout function
  - `refresh()` - Refresh user data

**`src/components/UserMenu.tsx`**
- User avatar with initials
- Dropdown menu showing:
  - User name and email
  - Admin badge (if applicable)
  - Sign out button

### Modified Files

**`src/lib/db/schema.ts`**
- Added `users` table definition
- Added `auth` table definition
- Added `UserSettings` interface
- Added `userId` foreign key to `chats` table (nullable for migration)

**`src/app/api/chat/route.ts`**
- Modified `ensureChatExists()` to accept `userId` parameter
- Extracts `userId` from request headers
- Associates new chats with current user

**`src/app/api/chats/route.ts`**
- Filters chats by `userId` from request headers
- Includes chats without `userId` (legacy data from before migration)

**`src/app/api/chats/[id]/route.ts`**
- Added `userOwnsChat()` helper function
- Verifies chat ownership before GET/DELETE
- Returns 403 Forbidden if user doesn't own chat

**`src/app/layout.tsx`**
- Wrapped app with `<AuthProvider>`
- All routes now have access to auth context

**`src/components/Sidebar.tsx`**
- Added `<UserMenu>` component to sidebar
- Displays user avatar and logout option

**`package.json`**
- Added `jose` (^6.1.3) - JWT library
- Added `bcryptjs` (^3.0.3) - Password hashing
- Added `framer-motion` (^12.25.0) - Animations

---

## Migration Strategy

### For Fresh Installs

1. Install dependencies: `pnpm install`
2. Generate and apply migration: `pnpm drizzle-kit push`
3. Start app:
   - **Development**: `pnpm dev`
   - **Production**: `pnpm build && node .next/standalone/server.js`
4. First registered user becomes admin

**Note**: `pnpm start` does NOT work because Perplexica uses Next.js standalone output mode (for Docker). Use the commands above instead.

### For Existing Deployments

**⚠️ Data Migration Considerations:**

1. **Backup database** before migration:
   ```bash
   cp data/db.sqlite data/db.sqlite.backup
   ```

2. **Apply migration**:
   ```bash
   pnpm drizzle-kit push
   ```
   - Creates `users` and `auth` tables
   - Adds nullable `userId` column to `chats`
   - Existing chats will have `userId = NULL`

3. **Register first admin user**:
   - Navigate to `/register`
   - Create first account (becomes admin)

4. **Handle existing chats**:
   - Existing chats (with `userId = NULL`) are visible to all users
   - To assign ownership, manually update database:
     ```sql
     UPDATE chats SET userId = 'admin-user-id' WHERE userId IS NULL;
     ```

5. **Optional: Make userId NOT NULL** (after assigning all chats):
   - This prevents orphaned chats
   - Requires custom migration

---

## Security Features

### Password Security
- **Hashing**: Bcrypt with cost factor 12 (2^12 iterations)
- **Validation**: Minimum 8 characters
- **Storage**: Only hash stored, never plaintext

### Token Security
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiration**: 7 days
- **Storage**: HTTPOnly cookie (JavaScript cannot access)
- **SameSite**: Lax (CSRF protection)
- **Secure**: HTTPS only in production

### Cookie Configuration
```javascript
{
  httpOnly: true,                              // No JavaScript access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax',                            // CSRF protection
  maxAge: 60 * 60 * 24 * 7,                   // 7 days
  path: '/'
}
```

### Authorization
- **Middleware**: Protects all routes except public paths
- **Ownership**: Users can only access their own chats
- **Role-based**: Admin role available for future features

---

## API Reference

### Authentication Endpoints

#### POST `/api/auth/register`

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"  // optional
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"  // "admin" for first user
  }
}
```

**Errors:**
- 400: Missing email/password or password too short
- 409: User already exists

---

#### POST `/api/auth/login`

Login with credentials.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

**Errors:**
- 400: Missing credentials
- 401: Invalid credentials

---

#### POST `/api/auth/logout`

Logout current user.

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET `/api/auth/me`

Get current user profile.

**Response (200):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "settings": {}
  }
}
```

**Errors:**
- 401: Not authenticated
- 404: User not found

---

## Testing

### Manual Testing Checklist

- [ ] Register first user (should become admin)
- [ ] Verify admin badge shows in user menu
- [ ] Create a chat, verify it's saved
- [ ] Logout and verify redirect to `/login`
- [ ] Login with correct credentials
- [ ] Verify previous chat is visible
- [ ] Register second user (should be standard user)
- [ ] Verify second user cannot see first user's chats
- [ ] Create chat as second user
- [ ] Logout and login as first user
- [ ] Verify first user cannot see second user's chat
- [ ] Test invalid login credentials (should show error)
- [ ] Test registering with existing email (should show error)
- [ ] Test password too short (should show error)
- [ ] Verify middleware redirects unauthenticated access

### Automated Testing (Future)

Consider adding:
- Unit tests for auth utilities
- Integration tests for auth API routes
- E2E tests for login/register flows

---

## Troubleshooting

### Issue: Node.js version warning (yahoo-finance2)

**Warning:**
```
[yahoo-finance2] Unsupported environment: Requires Node >= 22.0.0, found 20.19.6
```

**Cause**: The `yahoo-finance2` package (used for weather widget) requires Node.js 22+.

**Impact**:
- Authentication and core chat functionality work fine
- Weather widget may have issues

**Solution**:
```bash
# Upgrade to Node.js 22
nvm install 22 && nvm use 22
# or
sudo n 22

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

### Issue: "Unauthorized" errors on all routes

**Cause**: JWT_SECRET mismatch between token creation and verification.

**Solution**:
- Ensure JWT_SECRET is set consistently
- Restart the application after changing JWT_SECRET
- Clear cookies and re-login

---

### Issue: Build fails with better-sqlite3 errors

**Cause**: Native module not compiled for current platform.

**Solution**:
```bash
npm rebuild better-sqlite3
# or
pnpm rebuild better-sqlite3
```

---

### Issue: Migration fails with "no such column"

**Cause**: Database in inconsistent state.

**Solution**:
```bash
# Backup database
cp data/db.sqlite data/db.sqlite.backup

# Push schema directly (recommended for development)
pnpm drizzle-kit push

# Or start fresh (only in development!)
rm data/db.sqlite
pnpm drizzle-kit push
```

---

### Issue: Migration fails with "no such column: type" on startup

**Cause**: Schema was pushed with `drizzle-kit push` but migrations 0001-0003 aren't marked as applied.

**Solution**:
```bash
# Mark migrations as applied
node -e "const Database = require('better-sqlite3'); \
const db = new Database('./data/db.sqlite'); \
db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run('0001'); \
db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run('0002'); \
db.prepare('INSERT OR IGNORE INTO ran_migrations (name) VALUES (?)').run('0003'); \
console.log('Migrations marked as applied');"
```

**Why this happens**:
- Perplexica has a custom migration runner at `src/lib/db/migrate.ts`
- Migrations 0001 and 0002 have hardcoded data transformation logic
- When you use `drizzle-kit push`, it updates the schema but doesn't mark migrations as run
- On startup, the app tries to run the migration logic which expects the old schema

---

## Admin Panel

### Accessing the Admin Panel

**URL:** `/admin`

**Access:** Admin users only (first registered user is automatically admin)

### Features

1. **User List**
   - View all registered users
   - See user details (name, email, role, registration date)
   - User count statistics

2. **Role Management**
   - Click on role badge to toggle between User/Admin
   - Prevents demoting the last admin
   - Confirmation dialog before changes

3. **User Deletion**
   - Delete user accounts
   - Cascade deletes all user's chats
   - Cannot delete yourself
   - Confirmation dialog

### Accessing as Admin

1. Click your avatar in the sidebar
2. Click "Admin Panel" (only visible to admins)
3. Or navigate directly to `/admin`

---

## Concurrency and Multi-User Safety

### Overview

This section analyzes how well the authentication system handles multiple concurrent users and identifies potential issues.

### ✅ Safe for Concurrent Users

1. **Request Isolation**
   - Each HTTP request gets its own `userId` from middleware headers (`x-user-id`)
   - Headers are set per-request based on JWT cookie
   - Different users have different cookies → properly isolated requests
   - **Code:** `src/middleware.ts:96-98`, `src/app/api/chat/route.ts:230`

2. **Session Management**
   - Each chat request creates a unique session with UUID
   - Sessions stored in Map with automatic 30-minute expiration
   - No cross-user session contamination possible
   - **Code:** `src/lib/session.ts:35-38`

3. **Database Isolation**
   - Chats filtered by `userId` when fetching
   - Chat ownership verified before access/deletion
   - Primary key on `chats.id` prevents duplicates
   - **Code:** `src/app/api/chats/route.ts`, `src/app/api/chats/[id]/route.ts`

### ⚠️ ~~Minor Issues~~ ✅ FIXED

#### ~~Race Condition in Chat Creation~~ ✅ FIXED

**Location:** `src/app/api/chat/route.ts:71-100` (`ensureChatExists()`)

**Issue (RESOLVED):** Two simultaneous requests with the same `chatId` could both try to insert.

**Previous Code:**
```typescript
// 1. Check if chat exists
const exists = await db.query.chats.findFirst({ where: eq(chats.id, input.id) });

// 2. If not, insert it
if (!exists) {
  await db.insert(chats).values({...});
}
```

**Problem:** Check-then-insert is not atomic.

**Impact:**
- Low severity (database rejects duplicate)
- One request succeeds, other fails silently

**Fix Applied:**
```typescript
// ✅ Use INSERT OR IGNORE - atomic operation
await db.insert(chats).values({...}).onConflictDoNothing();
```

**Result:** No more race condition. Multiple simultaneous requests with the same chatId are handled gracefully.

### 🔴 ~~Critical Security Issue: File Upload Isolation~~ ✅ FIXED

**Location:** `src/lib/uploads/manager.ts`

**Issue (RESOLVED):** Files were stored globally without user association.

**Previous Problem:**
- Files stored in `data/uploads/uploaded_files.json` without userId
- Any user who knew a `fileId` could access any uploaded file
- No ownership verification

**Example Attack (NOW PREVENTED):**
1. User A uploads sensitive document → gets `fileId: "abc123"`
2. User B guesses or intercepts `fileId: "abc123"`
3. User B tries to access file → **NOW DENIED** ✅

**Impact:** Privacy breach prevented

**Fix Applied:**
```typescript
// 1. ✅ Added userId to RecordedFile type (manager.ts:18-25)
type RecordedFile = {
  id: string;
  userId: string | null;  // NEW - nullable for legacy files
  name: string;
  filePath: string;
  contentPath: string;
  uploadedAt: string;
}

// 2. ✅ Store userId when uploading (manager.ts:211-217, uploads/route.ts:8,32)
const fileRecord: RecordedFile = {
  id: fileId,
  userId: userId || null,  // NEW - from auth headers
  name: file.name,
  // ...
}

// 3. ✅ Verify ownership when accessing (manager.ts:67-83)
static getFile(fileId: string, userId?: string | null): RecordedFile | null {
  const recordedFiles = this.getRecordedFiles();
  const file = recordedFiles.find(f => f.id === fileId);

  if (!file) return null;

  // If userId is provided, verify ownership
  // Allow access if file has no owner (legacy) or if userId matches
  if (userId !== undefined && file.userId !== null && file.userId !== userId) {
    console.warn(`Access denied: User ${userId} attempted to access file ${fileId} owned by ${file.userId}`);
    return null;  // Access denied
  }

  return file;
}

// 4. ✅ Updated all call sites:
// - chat/route.ts:92 - passes userId when creating chat
// - uploads/route.ts:32 - passes userId when uploading
// - uploadsSearch.ts:55 - passes userId to UploadStore
// - researcher.ts:330 - passes userId to getFileData
// - store.ts:36,87,107 - passes userId to getFile/getFileChunks
```

**Files Modified:**
- `src/lib/uploads/manager.ts` - Added userId to type and methods
- `src/lib/uploads/store.ts` - Pass userId through UploadStore
- `src/app/api/uploads/route.ts` - Extract and pass userId
- `src/app/api/chat/route.ts` - Pass userId to file access
- `src/lib/agents/search/types.ts` - Added userId to SearchAgentConfig
- `src/lib/agents/search/researcher/index.ts` - Pass userId to actions
- `src/lib/agents/search/researcher/actions/uploadsSearch.ts` - Pass userId to UploadStore
- `src/lib/prompts/search/researcher.ts` - Pass userId to getFileData

### Testing Concurrency

A test script is provided: `test-concurrent-users.sh`

**Usage:**
```bash
# Make sure dev server is running
pnpm dev

# In another terminal, run the test
./test-concurrent-users.sh
```

**What it tests:**
- Register two users simultaneously
- Verify authentication works for both
- Fetch chats from both users concurrently
- Send 5 simultaneous requests per user
- Verify no session confusion
- Verify chats are properly isolated

**Expected output:**
```
✓ User 1 registered successfully
✓ User 2 registered successfully
✓ User 1 authenticated
✓ User 2 authenticated
✓ Chats are properly isolated between users
✓ All concurrent requests successful
✓ User 1 cookie correctly returns User 1's data
=== All tests passed! ===
```

**Note:** Test creates temporary users with timestamped emails. Delete them via admin panel after testing.

### Recommendations

**Immediate (Critical):**
1. ✅ **FIXED** - File upload isolation bug (userId added to all file operations)
2. ✅ **FIXED** - userId added to RecordedFile type
3. ✅ **FIXED** - File ownership verified in chat creation

**Short-term (Nice to have):**
1. ✅ **FIXED** - Use `INSERT OR IGNORE` in `ensureChatExists()`
2. Add integration tests for concurrent access
3. Add file upload ownership tests

**Long-term:**
1. Consider moving files to database (blob storage)
2. Add file upload quotas per user
3. Add audit logging for file access
4. Implement proper transaction handling

---

## Future Enhancements

### Local LLM Concurrency Management

**Current State:**
- Perplexica forwards all requests directly to local LLM server (Ollama/LM Studio)
- Local LLM servers queue requests internally (won't crash)
- Requests processed sequentially - one at a time per GPU
- No visibility into queue state or wait times

**When This Becomes a Problem:**
- Multiple concurrent users submitting queries
- Long inference times (20-60+ seconds per query)
- User 2 waits for User 1 to finish
- User 3 waits for Users 1 & 2 to finish
- Poor UX with no feedback on wait time

**Potential Approaches (Future Upgrades):**

#### 1. Hybrid Local + Cloud LLM Setup

**Strategy A: Complexity-Based Routing**
```typescript
// Pseudocode
if (isComplexQuery(query) || requiresLongContext(query)) {
  // Route to cloud LLM (faster, more capable)
  return cloudProvider.generateText(query);
} else {
  // Route to local LLM (free, private)
  return localProvider.generateText(query);
}
```

**Strategy B: Contention-Based Offloading**
```typescript
// Pseudocode
const queueSize = await ollama.getQueueSize();
const estimatedWait = queueSize * avgInferenceTime;

if (estimatedWait > threshold) {
  // Too much contention - offload to cloud
  return cloudProvider.generateText(query);
} else {
  return localProvider.generateText(query);
}
```

**Implementation Considerations:**
- Add queue monitoring endpoint to Ollama wrapper
- Track average inference times per model
- User preference: "always local" vs "smart routing" vs "always cloud"
- Cost tracking for cloud API usage
- Fallback chain: local → cloud → error

**Files to Modify:**
- `src/lib/models/registry.ts` - Add routing logic
- `src/lib/agents/search/types.ts` - Add routing strategy to config
- `src/app/api/chat/route.ts` - Implement fallback logic
- New: `src/lib/models/router.ts` - Smart routing service

#### 2. Multi-Instance Load Balancing

**Setup:**
```bash
# Terminal 1 - GPU 0
CUDA_VISIBLE_DEVICES=0 ollama serve --port 11434

# Terminal 2 - GPU 1
CUDA_VISIBLE_DEVICES=1 ollama serve --port 11435

# Terminal 3 - GPU 2
CUDA_VISIBLE_DEVICES=2 ollama serve --port 11436
```

**Implementation:**
```typescript
// Round-robin or least-connections load balancing
class OllamaLoadBalancer {
  private instances = [
    { url: 'http://localhost:11434', activeRequests: 0 },
    { url: 'http://localhost:11435', activeRequests: 0 },
    { url: 'http://localhost:11436', activeRequests: 0 },
  ];

  getNextInstance() {
    // Return instance with least active requests
    return this.instances.sort((a, b) => a.activeRequests - b.activeRequests)[0];
  }
}
```

**Pros:**
- True parallel processing
- Linear scaling with GPU count
- No external dependencies

**Cons:**
- Requires multiple GPUs
- Higher power consumption
- More complex deployment

#### 3. Request Queue with User Feedback

**Show users their position:**
```typescript
// API response
{
  status: 'queued',
  position: 2,
  estimatedWait: 45, // seconds
  message: 'Your request is #2 in queue. Estimated wait: 45s'
}

// Frontend updates every 5 seconds
setInterval(async () => {
  const status = await fetch('/api/queue-status/' + requestId);
  updateUI(status);
}, 5000);
```

**Implementation:**
- Track all pending requests in Map
- Estimate wait time based on avg inference time
- WebSocket or polling for real-time updates
- Show progress bar instead of spinner

#### 4. vLLM or Text Generation Inference (TGI)

**Replace Ollama with more concurrent-friendly server:**

**vLLM:**
- Continuous batching (process multiple requests simultaneously)
- PagedAttention (efficient memory usage)
- Better throughput for concurrent users

**Text Generation Inference (TGI):**
- HuggingFace's production server
- Dynamic batching
- Optimized for throughput

**Migration Effort:** Medium
- Create new provider class extending BaseLLM
- Update provider configuration
- Keep Ollama as fallback option

#### 5. Timeout Handling & Graceful Degradation

**Add to Next.js config:**
```typescript
// next.config.js
module.exports = {
  experimental: {
    proxyTimeout: 300000, // 5 minutes for local LLM
  },
};
```

**Implement retry logic:**
```typescript
async function generateWithRetry(query, maxRetries = 2) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await localLLM.generate(query);
    } catch (error) {
      if (error.code === 'TIMEOUT' && i < maxRetries - 1) {
        // Try cloud on timeout
        return await cloudLLM.generate(query);
      }
      throw error;
    }
  }
}
```

#### 6. User-Level Quotas & Priority Queue

**Prevent single user monopolizing resources:**
```typescript
// Track per-user request counts
const userQuotas = new Map<string, { count: number, resetAt: Date }>();

// Priority queue: admin > paid > free
class PriorityRequestQueue {
  queues = {
    high: [], // admins
    medium: [], // regular users
    low: [], // anonymous/limited users
  };

  enqueue(request, priority) {
    this.queues[priority].push(request);
  }

  dequeue() {
    return this.queues.high.shift() ||
           this.queues.medium.shift() ||
           this.queues.low.shift();
  }
}
```

---

### Recommended Approach (When Scaling Needed)

**Phase 1: Monitoring & Feedback**
1. Add queue position visibility
2. Track average inference times
3. Implement timeout handling

**Phase 2: Hybrid Setup**
1. Add cloud provider as fallback
2. Route based on contention
3. User preference for "always local"

**Phase 3: Scale Local (if budget allows)**
1. Multiple Ollama instances
2. Load balancing
3. Or migrate to vLLM for better concurrency

---

### Testing Concurrent Load

**Simple test with multiple users:**
```bash
# Terminal 1
curl -X POST http://localhost:3000/api/chat -H "Cookie: auth-token=USER1_TOKEN" -d '{...}'

# Terminal 2 (immediately after)
curl -X POST http://localhost:3000/api/chat -H "Cookie: auth-token=USER2_TOKEN" -d '{...}'

# Terminal 3 (immediately after)
curl -X POST http://localhost:3000/api/chat -H "Cookie: auth-token=USER3_TOKEN" -d '{...}'
```

**Measure:**
- Time to first token for each user
- Total response time
- Memory usage during queue

**Expected behavior (with single Ollama instance):**
- User 1: ~30s total
- User 2: ~60s total (waits for User 1)
- User 3: ~90s total (waits for Users 1 & 2)

---

### Potential Future Enhancements

This section documents features identified during code review that could improve security and functionality.

#### Security Enhancements

1. ~~**Rate Limiting**~~ ✅ **IMPLEMENTED**
   - ~~Protect login/register endpoints from brute force attacks~~
   - ~~Implement per-IP throttling (5 attempts per 15 minutes)~~
   - In-memory rate limiter at `src/lib/auth/rateLimiter.ts`

2. **Account Lockout**
   - Temporary account lockout after multiple failed login attempts
   - Configurable lockout duration and attempt threshold
   - Admin ability to unlock accounts

3. **CSRF Protection**
   - Add CSRF tokens to state-changing operations
   - Validate Origin/Referer headers on POST requests

4. ~~**Stronger Password Policy**~~ ✅ **IMPLEMENTED**
   - ~~Character variety requirements (uppercase, lowercase, numbers, symbols)~~
   - Validation at `src/lib/auth/validation.ts`

5. ~~**Email Validation**~~ ✅ **IMPLEMENTED**
   - ~~Validate email format on registration~~
   - Format validation at `src/lib/auth/validation.ts`

6. **Refresh Token Rotation**
   - Shorter-lived access tokens (1 hour instead of 7 days)
   - Separate refresh tokens for session extension
   - Token refresh endpoint

7. **Session Revocation**
   - Server-side token blacklist/revocation list
   - Immediate logout invalidation (currently only clears cookie)
   - Admin ability to revoke all user sessions

8. ~~**Audit Logging**~~ ✅ **IMPLEMENTED**
   - ~~Log authentication events (login, logout, failed attempts)~~
   - ~~Track admin actions (user management, role changes)~~
   - Audit system at `src/lib/auth/audit.ts`
   - Events: login_success, login_failure, logout, register, role_change, user_delete

#### Feature Enhancements (Medium Priority)

9. **Password Reset Flow**
   - Email-based password reset
   - Secure, short-lived reset tokens
   - Password reset UI

10. **Email Verification**
    - Verify email on registration
    - Resend verification email option

11. **Multi-Factor Authentication (MFA/2FA)**
    - TOTP-based second factor (Google Authenticator, etc.)
    - Optional per-user enablement
    - Recovery codes

12. **OAuth Integration** (Google, GitHub)
    - Add OAuth providers
    - Link social accounts to existing users

13. **Session Management UI**
    - View active sessions across devices
    - Revoke individual sessions
    - Device/location tracking

14. **Chat Sharing**
    - Share chats via link
    - Granular permissions (read/write)
    - Public/private sharing options

#### Nice-to-Have (Lower Priority)

15. **Group Permissions**
    - Create user groups
    - Group-based chat sharing
    - Team workspaces

16. **API Keys**
    - Personal API keys for programmatic access
    - Key rotation and revocation

17. **User Profile Enhancements**
    - Avatar upload
    - Display name editing
    - Timezone preferences

18. ~~**User Settings Sync**~~ ✅ **IMPLEMENTED**
    - ~~Move localStorage preferences to database~~
    - ~~Sync settings across devices~~
    - Per-user preferences (theme, widgets, etc.) now stored in database
    - Settings context at `src/lib/contexts/UserSettingsContext.tsx`

---

## Comparison with Open-WebUI

### What Was Adopted

- JWT authentication pattern
- User/auth table separation
- Password hashing with bcrypt
- HTTPOnly cookie storage
- Middleware-based route protection
- userId foreign key on user data

### What Was Adapted

- **Framework**: Open-WebUI uses Python/FastAPI, Perplexica uses Next.js
- **Libraries**:
  - `jose` instead of PyJWT
  - `bcryptjs` instead of bcrypt (Python)
  - Next.js middleware instead of FastAPI dependencies
- **Session handling**: Server components pattern instead of FastAPI sessions
- **No OAuth/LDAP**: Simplified to password-only auth for MVP

### What Was Simplified

- **No groups**: Single-tenant user isolation only
- **No permissions system**: Basic user/admin roles only
- **No API keys**: JWT tokens only
- **No password reset**: To be added later
- **No MFA/2FA**: Single factor authentication only
- **No OAuth**: Password-based auth only (no Google/GitHub login)

---

## References

- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Jose JWT Library](https://github.com/panva/jose)
- [bcrypt.js](https://github.com/dcodeIO/bcrypt.js)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Open-WebUI](https://github.com/open-webui/open-webui)

---

## License

Same as parent project (MIT).
