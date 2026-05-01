export const env = {
  apiBase: import.meta.env.VITE_API_BASE ?? "http://localhost:8787",
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  },
  hasFirebase:
    Boolean(import.meta.env.VITE_FIREBASE_API_KEY) &&
    Boolean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
    Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
    Boolean(import.meta.env.VITE_FIREBASE_APP_ID),
  firebaseConfigOrNull() {
    if (!this.hasFirebase) return null;
    return {
      apiKey: this.firebase.apiKey!,
      authDomain: this.firebase.authDomain!,
      projectId: this.firebase.projectId!,
      appId: this.firebase.appId!
    };
  }
};

