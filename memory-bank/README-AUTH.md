# Authentication Setup

This application now uses **better-auth** for authentication with a default admin user system.

## Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```bash
# Authentication
DEFAULT_ADMIN_EMAIL="admin@example.com"
DEFAULT_ADMIN_PASSWORD="admin123"

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Next.js
NEXTAUTH_URL="http://localhost:3000"
```

## Features

### 🔐 Authentication System
- **Better-auth** integration with Drizzle ORM
- Email/password authentication
- Session management with 7-day expiration
- Admin role support

### 👤 Default Admin User
- Automatically created on app startup
- Uses environment variables for credentials
- Admin role assigned automatically
- Only created if user doesn't already exist

### 🛡️ Protected Routes
- All pages are protected by authentication
- Login form shown for unauthenticated users
- User menu with logout functionality
- Middleware protection for API routes

### 🎨 UI Components
- `LoginForm` - Clean login interface
- `UserMenu` - User avatar dropdown with logout
- `ProtectedRoute` - Wrapper component for auth protection

### 📄 Pages
- `/login` - Dedicated login page
- `/users` - User management page (admin only)
- All other pages are protected and require authentication

## Database Schema

The authentication system includes these tables:
- `user` - User accounts with role field
- `session` - Active user sessions
- `account` - Account provider information
- `verification` - Email verification tokens

## Usage

1. **First Run**: The default admin user will be created automatically
2. **Login**: Navigate to any protected page to see the login form
3. **Access**: Use the credentials from your environment variables
4. **Logout**: Click the user avatar in the top-right corner

## Security Features

- Password hashing via better-auth
- Session token validation
- CSRF protection
- Secure cookie handling
- API route protection via middleware

## Development

To run the application:

```bash
npm run dev
```

The default admin user will be created on startup if it doesn't exist.
