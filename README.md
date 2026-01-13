# Perplexica-mu

Fork of [Perplexica](https://github.com/ItzCrazyKns/Perplexica) with prototype modifications for user management.

## Original Project
- **Repository**: [ItzCrazyKns/Perplexica](https://github.com/ItzCrazyKns/Perplexica)
- **Description**: Original Perplexica project: "Perplexica is an AI-powered answering engine. It is an Open source alternative to Perplexity AI". **Use the original project for any use-case except if you want to test my prototype user management.**

## Changes in this fork

### Multi-User Support
This fork adds multi-user support to Perplexica:

**Authentication & Authorization**
- JWT-based authentication with secure httpOnly cookies
- Role-based access control (user/admin roles)
- First registered user automatically becomes admin
- Password complexity requirements (uppercase, lowercase, numbers, special chars)
- Email format validation
- Rate limiting on login/registration (5 attempts per 15 minutes)

**User Data Isolation**
- Chats are associated with user accounts
- Uploaded files are owned by the uploading user
- Per-user settings stored in database (theme, preferences, system instructions)

**Admin Features**
- User management panel (list, delete, change roles)
- Audit logging for authentication events and admin actions

**Security**
- JWT secret required in production (fails to start without it)
- Runtime validation of JWT payloads
- Zod schema validation on settings updates
- Transaction-based registration to prevent race conditions
- Standardized error handling with proper HTTP status codes

### Configuration

**Required Environment Variables (Production)**
```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-secure-random-secret
```

### Migration from Single-User
If upgrading from an existing Perplexica installation:
1. Existing chats with no userId will be accessible to all users initially
2. Run the legacy data migration to assign orphaned data to an admin
3. See [development.md](development.md) for migration details

### Known Limitations
- No password reset flow (forgot password)
- No MFA/2FA support
- 7-day token expiry without refresh mechanism
- No server-side session revocation (logout clears cookie only)

See [development.md](development.md) for technical details and future enhancement plans.
