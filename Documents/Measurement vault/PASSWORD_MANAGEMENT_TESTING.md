# Password Management Testing Guide

This guide explains how to test the password management features in the Tailors Vault app.

## Features Implemented

### 1. Change Password (Account Settings)
- Location: Settings Screen → "Change Password" section
- Allows logged-in users to update their password
- Requires current password verification
- Validates new password requirements

### 2. Forgot Password (Login Page)
- Location: Login Screen → "Forgot Password?" link
- Allows users to request a password reset email
- Sends reset link via Supabase Auth

---

## Testing: Change Password Flow

### Prerequisites
1. You must be logged in to your account
2. Know your current password

### Steps

1. **Navigate to Settings**
   - Click the Settings button (gear icon) from the home screen
   - Or use the mobile footer menu

2. **Find Change Password Section**
   - Scroll to the "Change Password" section (between "Email Linking" and "Session")
   - You should see:
     - Current Password field
     - New Password field
     - Confirm New Password field
     - Update Password button

3. **Test Validation**
   
   **Test 1: Empty Fields**
   - Leave all fields empty
   - Click "Update Password"
   - **Expected**: Error message "Please enter your current password"

   **Test 2: Short Password**
   - Enter current password
   - Enter new password with less than 6 characters (e.g., "12345")
   - **Expected**: Error message "New password must be at least 6 characters"

   **Test 3: Password Mismatch**
   - Enter current password
   - Enter new password: "newpass123"
   - Enter confirm password: "different123"
   - **Expected**: Error message "New passwords do not match"

   **Test 4: Same Password**
   - Enter current password: "oldpass123"
   - Enter new password: "oldpass123"
   - **Expected**: Error message "New password must be different from current password"

   **Test 5: Wrong Current Password**
   - Enter incorrect current password
   - Enter valid new password
   - **Expected**: Error message "Current password is incorrect"

4. **Test Successful Password Change**
   - Enter correct current password
   - Enter new password (minimum 6 characters): "newpass123"
   - Enter confirm password: "newpass123"
   - Click "Update Password"
   - **Expected**: 
     - Green success message: "Password updated successfully!"
     - Form clears
     - You can now log in with the new password

5. **Verify Password Change**
   - Log out
   - Try logging in with old password → Should fail
   - Try logging in with new password → Should succeed

---

## Testing: Forgot Password Flow

### Prerequisites
1. You must have an account registered with an email
2. Access to the email inbox for that account

### Steps

1. **Navigate to Login Screen**
   - If logged in, log out first
   - You should see the login form

2. **Click "Forgot Password?" Link**
   - Located below the Login button
   - Click the "Forgot Password?" link
   - **Expected**: 
     - A form appears below the login form
     - Form has:
       - Email input field
       - "Send Reset Link" button
       - "Cancel" button

3. **Test Validation**
   
   **Test 1: Empty Email**
   - Leave email field empty
   - Click "Send Reset Link"
   - **Expected**: Error message "Please enter your email address"

   **Test 2: Invalid Email Format**
   - Enter invalid email: "notanemail"
   - Click "Send Reset Link"
   - **Expected**: Error message "Please enter a valid email address"

   **Test 3: Non-existent Email**
   - Enter email that doesn't exist in system: "nonexistent@example.com"
   - Click "Send Reset Link"
   - **Expected**: Error message "No account found with this email address"

4. **Test Successful Reset Request**
   - Enter your registered email address
   - Click "Send Reset Link"
   - **Expected**:
     - Green success message appears
     - Message shows: "Password reset email sent!"
     - Your email address is displayed
     - Form clears and hides after 5 seconds

5. **Check Email**
   - Open your email inbox
   - Look for email from Supabase (or your configured email service)
   - **Expected**:
     - Subject: "Reset Your Password" (or similar)
     - Contains a reset link
     - Link expires in 1 hour

6. **Click Reset Link**
   - Click the reset link in the email
   - **Expected**: 
     - Redirects to your app
     - Shows password reset form (if implemented)
     - Or redirects to Supabase hosted reset page

7. **Reset Password via Link**
   - Follow the instructions in the email
   - Enter new password
   - Confirm new password
   - Submit
   - **Expected**: Password is reset successfully

8. **Verify Reset**
   - Return to login screen
   - Try logging in with old password → Should fail
   - Try logging in with new password → Should succeed

---

## Troubleshooting

### Change Password Issues

**Issue**: "Current password is incorrect" even though it's correct
- **Solution**: Make sure you're using the exact password (case-sensitive)
- Check if Caps Lock is on
- Try logging out and logging back in first

**Issue**: Password update succeeds but can't log in with new password
- **Solution**: Wait a few seconds for Supabase to sync
- Clear browser cache and try again
- Check browser console for errors

### Forgot Password Issues

**Issue**: Reset email not received
- **Solution**: 
  - Check spam/junk folder
  - Wait up to 5 minutes (email delivery can be delayed)
  - Verify email address is correct
  - Check Supabase dashboard for email logs

**Issue**: Reset link expired or invalid
- **Solution**: 
  - Request a new reset link (links expire in 1 hour)
  - Make sure you're clicking the link within the expiration time
  - Check if the link was partially copied (some email clients break links)

**Issue**: "No account found" for existing email
- **Solution**: 
  - Verify the email is exactly as registered (case-insensitive but check for typos)
  - Make sure the account was created with email/password (not OAuth)
  - Check Supabase dashboard to verify user exists

---

## Supabase Configuration

### Required Settings

1. **Email Templates**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Ensure "Reset Password" template is configured
   - Customize the template if needed

2. **Email Provider**
   - Go to Supabase Dashboard → Settings → Auth
   - Configure SMTP settings or use Supabase's default email service
   - For production, use a custom SMTP provider

3. **Redirect URLs**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your app's URL to "Redirect URLs"
   - Format: `https://yourdomain.com` or `http://localhost:3000` for development

### Testing Email in Development

If using Supabase's default email service:
- Emails may go to spam
- Check Supabase Dashboard → Authentication → Users → Email Logs
- For local development, consider using a service like Mailtrap or MailHog

---

## Security Notes

1. **Password Requirements**
   - Minimum 6 characters (Supabase default)
   - Can be customized in Supabase settings

2. **Rate Limiting**
   - Supabase automatically rate limits password reset requests
   - Too many requests may temporarily block the email

3. **Session Management**
   - After password change, user remains logged in
   - After password reset via email, user needs to log in again

4. **Email Verification**
   - Password reset emails are sent regardless of email verification status
   - Consider requiring email verification before allowing password changes

---

## Code Locations

- **Change Password Form**: `app/page.tsx` (Settings Screen)
- **Forgot Password Form**: `app/page.tsx` (Login Screen)
- **Handlers**: `public/app.js` (setupAuthForms function)
- **Styles**: `app/styles.css` (uses existing form styles)

---

## Additional Features to Consider

1. **Password Strength Indicator**
   - Add visual feedback for password strength
   - Show requirements checklist

2. **Password Reset Confirmation Page**
   - Create a dedicated page for password reset
   - Handle the reset token from email link

3. **Two-Factor Authentication**
   - Add 2FA for additional security
   - Require 2FA before password changes

4. **Password History**
   - Prevent reusing recent passwords
   - Store password hashes (not plain text)

5. **Account Lockout**
   - Lock account after multiple failed password attempts
   - Send security alert email

