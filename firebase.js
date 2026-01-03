import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBx-A9UuKY9hjiRtLUzHA1j5oGQEw8lwIg",
  authDomain: "callixia.firebaseapp.com",
  projectId: "callixia",
  storageBucket: "callixia.firebasestorage.app",
  messagingSenderId: "890427843494",
  appId: "1:890427843494:web:e2d756fe151ad73fb3e567"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
