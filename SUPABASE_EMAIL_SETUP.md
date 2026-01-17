# Supabase Email Verification Setup

If you're not receiving verification emails, you need to configure Supabase email settings.

## Quick Fix Options:

### Option 1: Configure Supabase Email (Recommended for Production)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Email Templates**
4. Make sure email templates are enabled
5. Go to **Authentication** → **Settings** → **Email Auth**
6. Configure your email provider:
   - **Option A**: Use Supabase's built-in email (limited, for development)
   - **Option B**: Use a custom SMTP provider (Gmail, SendGrid, etc.) - Recommended for production

### Option 2: Disable Email Confirmation (For Development Only)

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Find **"Enable email confirmations"**
3. **Turn it OFF** (only for development/testing)
4. Users can now sign up and login without email verification

### Option 3: Check Email Settings

1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
2. Make sure **Site URL** is set to your app URL (e.g., `http://localhost:3000` for development)
3. Add your redirect URLs to **Redirect URLs** list

## Troubleshooting:

- **Check spam folder** - Verification emails often go to spam
- **Check Supabase logs** - Go to Dashboard → Logs → Auth to see if emails are being sent
- **Verify email address** - Make sure you're using a valid email
- **Wait a few minutes** - Sometimes emails are delayed

## For Development:

If you just want to test the app without email verification, you can:
1. Disable email confirmation in Supabase settings (Option 2 above)
2. Or manually confirm the user in Supabase Dashboard → Authentication → Users

