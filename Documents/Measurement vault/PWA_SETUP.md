# PWA Setup Guide

## Icons Required

The PWA requires two icon files in the `public` folder:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

## Generating Icons

1. Open `public/generate-icons.html` in your browser
2. Click the buttons to generate and download the icons
3. Save the downloaded files to the `public` folder as:
   - `icon-192.png`
   - `icon-512.png`

Alternatively, you can create your own icons using any image editor:
- Use the app's theme colors (background: #0a0f1f, accent: #FFD700)
- Include the lightning bolt logo or app branding
- Ensure icons are square and properly sized

## Verification

After adding the icons, verify the PWA setup:

1. Open the app in Chrome/Edge
2. Open DevTools → Application tab
3. Check "Manifest" section - should show "Tailor's Vault"
4. Check "Service Workers" section - should show "activated and running"
5. Look for "Install" button in browser address bar

## Testing Offline

1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Reload the page
4. App shell should load from cache (no data sync, just UI)

## Notes

- Service Worker does NOT cache Supabase API requests
- Authentication flows remain unchanged
- Data sync requires internet connection
- Offline mode shows app shell only

