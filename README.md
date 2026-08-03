# Bgain Mobile App 

This is the mobile companion application for the Bgain Secure Storage Management System, supporting both Android and iOS devices.

## Chosen Technologies
- **React Native (Expo SDK 54)**: Cross-platform mobile development framework optimized with the New Architecture.
- **React Navigation**: Native stack and bottom-tab routing logic.
- **Axios**: HTTP requests with intelligent interceptors for token management.
- **Expo File System & Sharing**: Securely downloading blobs from the network and passing them to native platform share/view sheets (e.g., Android SAF).
- **React Native Webview & PDF.js**: Used in conjunction to render high-fidelity file previews directly inside the app, avoiding the need to immediately trigger OS-level downloads for basic viewing.
- **AsyncStorage**: Secure local device storage for offline session caching.

## Setup Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Expo bundler:
   ```bash
   npx expo start
   ```
3. Use the Expo Go app on your physical device to scan the generated QR code, or press `a` to open in an Android Emulator.
*(Note: To build standalone APKs or iOS equivalents, we use EAS Build `eas build --platform android`)*.

## Environment Variables / Configuration
By default, the Mobile SDK points the API path based on platform and environment. This logic lives in `src/service/api.js`:
```javascript
export const BASE_URL = Platform.OS === 'android'
    ? 'https://bgain-backend-1.onrender.com/api/' 
    : 'http://localhost:8000/api/';
```
If you test locally on a physical Android device, ensure the URL points to your local machine network IP (e.g. `192.168.x.x`).

## Folder Structure
- `src/components/`: Reusable native UI views (buttons, loading spinners, custom alerts).
- `src/context/`: Authentication context (maintaining login tokens in memory and securely persisting via AsyncStorage).
- `src/navigation/`: AuthNavigator (login screens) vs AppNavigator (authenticated bottom tabs).
- `src/screens/`: App views corresponding to the native tabs (`Dashboard`, `Files`, `Users`, `Profile`).
- `src/service/`: Network wrappers and API interceptors.
- `src/theme/`: Centralized `colors.js` standardizing all RGB values mapping to the premium web platform's CSS structure.

## Database Design & Storage Approach
- **Local Storage**: The mobile app is entirely stateless besides the current user's JSON Web Token globally vaulted in `AsyncStorage`.
- **Remote Approach**: Complex file hierarchies (folders inside folders) are requested dynamically. The `FilesScreen` manages recursive state by tracking a `currentId` and a breadcrumb trail.
- **File Previews**: To display files on mobile seamlessly, the app utilizes embedded `<WebView>` tags injecting Mozilla's `pdf.js` for documents and native `<Image>` components for recognized picture types. Video is handled via platform configurations.
