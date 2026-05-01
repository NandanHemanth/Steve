import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env } from "./env";

const config = env.firebaseConfigOrNull();

export const firebaseReady = Boolean(config);
export const auth = config ? getAuth(initializeApp(config)) : null;
export const googleProvider = config ? new GoogleAuthProvider() : null;

