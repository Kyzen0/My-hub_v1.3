# My Hub - Progressive Web App

A personal organization hub for tracking anime, projects, bookmarks, and secure vault data. Built as a Progressive Web App (PWA) that works offline and can be installed on mobile/desktop devices.

## Features

### 🎯 Core Features
- **Anime Tracker**: Track watching, completed, and upcoming anime
- **Projects Vault**: Manage ongoing and future projects
- **Bookmarks Manager**: Organize tools and entertainment links
- **Secure Vault**: Password-protected storage for sensitive data
- **User Authentication**: Firebase Auth with email verification
- **Cloud Sync**: Automatic data backup to Firebase Firestore

### 📱 Progressive Web App (PWA)
- **Offline Support**: Works without internet connection
- **Installable**: Add to home screen on mobile/desktop
- **Background Sync**: Data syncs when connection returns
- **App-like Experience**: Full-screen, standalone mode

### 🔐 Security & Privacy
- **Email Verification**: Required for cloud sync
- **Vault Protection**: Password-protected sensitive data
- **Data Export/Import**: Full data portability
- **Account Management**: Profile, password change, account deletion

## Setup Instructions

### 1. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Update Firestore Security Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, create: if request.auth.uid == userId;
    }
    
    // Allow access to all subcollections under user document
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

5. Add your domain to Authorized Domains in Authentication settings

### 2. App Icons

1. Open `create-icons.html` in your browser
2. Download the generated 192x192 and 512x512 icons
3. Save them as `img/icon-192.png` and `img/icon-512.png`

### 3. Firebase Config

Update the Firebase configuration in all HTML files with your project details:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id",
    measurementId: "your-measurement-id"
};
```

## Deployment

### Option 1: Firebase Hosting (Recommended)

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase project:
```bash
firebase init hosting
```

4. Deploy:
```bash
firebase deploy
```

### Option 2: GitHub Pages

1. Push code to GitHub repository
2. Enable GitHub Pages in repository settings
3. Set source to main branch

### Option 3: Netlify/Vercel

1. Connect your GitHub repository
2. Deploy automatically on push

## File Structure

```
My-hub/
├── index.html          # Home page with auth modal
├── anime.html          # Anime tracking page
├── projects.html       # Projects management
├── bookmarks.html      # Bookmarks organizer
├── vault.html          # Secure vault
├── profile.html        # User profile & settings
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── styles.css         # Global styles
├── profile.css        # Profile page styles
├── script.js          # Core logic & Firestore sync
├── navbar.js          # Navigation & auth
├── vault.js           # Vault security
├── profile.js         # Profile management
├── img/               # Images and icons
└── README.md          # This file
```

## Usage

### First Time Setup
1. Visit the app in a modern browser
2. Click the settings gear icon to sign up/login
3. Verify your email address
4. Start adding your data!

### Installing as App
- **Mobile**: Tap "Add to Home Screen" in browser menu
- **Desktop**: Click the install icon in browser address bar
- **Chrome**: Look for the install prompt or use menu → "Install My Hub"

### Offline Usage
- App works offline after first visit
- Data is stored locally and syncs when online
- Vault remains accessible offline
- Changes queue for sync when connection returns

## Browser Support

- Chrome 67+ (Full PWA support)
- Firefox 67+ (Full PWA support)
- Safari 11.1+ (Limited PWA support)
- Edge 79+ (Full PWA support)

## Development

### Local Development
1. Serve files with a local server (required for service worker):
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

2. Open `http://localhost:8000`

### Testing PWA Features
- Use Chrome DevTools → Application tab
- Test offline functionality
- Verify service worker registration
- Check manifest validation

## Troubleshooting

### Service Worker Issues
- Clear browser cache and reload
- Check browser console for errors
- Verify HTTPS/SSL for production

### Firebase Issues
- Check Firebase console for errors
- Verify security rules
- Ensure domain is authorized

### Offline Sync Issues
- Check network connectivity
- Verify Firebase configuration
- Clear browser data if needed

## License

Built by Zain. All rights reserved.

## Support

For issues or questions, check the browser console for detailed error messages and ensure all Firebase configuration is correct.
