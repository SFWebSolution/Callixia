import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc, setDoc, getDocs, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const showMessage = (msg, success=true) => {
  const existing = document.getElementById("message-box");
  if (existing) existing.remove();
  const div = document.createElement("div");
  div.id = "message-box";
  div.textContent = msg;
  div.style.color = success ? "#0ff" : "#ff3333";
  div.style.marginTop = "10px";
  div.style.textAlign = "center";
  div.style.fontWeight = "600";
  document.querySelector(".glass-box").appendChild(div);
}

window.signup = async () => {
  try {
    const uname = username.value.trim();
    const q = query(collection(db, "users"), where("username", "==", uname));
    const snap = await getDocs(q);
    if (!snap.empty) return showMessage("Username already taken", false);

    const res = await createUserWithEmailAndPassword(auth, email.value, password.value);
    await setDoc(doc(db, "users", res.user.uid), {
      username: uname,
      online: true,
      createdAt: Date.now()
    });

    showMessage("Signup successful!", true);
    setTimeout(() => { location.href = "index.html"; }, 1200);
  } catch (err) {
    showMessage(err.message, false);
  }
};

window.login = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    showMessage("Login successful!", true);
    setTimeout(() => { location.href = "index.html"; }, 800);
  } catch (err) {
    showMessage("Invalid email or password", false);
  }
};

