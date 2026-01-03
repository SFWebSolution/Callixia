import { auth, db } from "./firebase.js";
import {
  collection, getDocs, onSnapshot, query, where, doc, addDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    location.href = "login.html"; // redirect if not logged in
    return;
  }

  const usersList = document.getElementById("users");
  const historyList = document.getElementById("history");
  const popup = document.getElementById("incomingCall");
  const callerName = document.getElementById("callerName");
  const acceptBtn = document.getElementById("accept");
  const rejectBtn = document.getElementById("reject");

  if (!usersList || !historyList || !popup || !callerName || !acceptBtn || !rejectBtn) {
    console.error("Some required DOM elements are missing!");
    return;
  }

  // ================= SHOW USERNAME FROM AUTH =================
  const userDocRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userDocRef);
  const currentUsername = userSnap.exists() ? userSnap.data().username : "User";

  const h2 = document.querySelector(".sidebar h2");
  if (h2) h2.textContent = `Welcome, ${currentUsername}`;

  // ================= LOAD USERS =================
  async function loadUsers() {
    usersList.innerHTML = "";
    const allUsersSnap = await getDocs(collection(db, "users"));
    allUsersSnap.forEach(u => {
      if (u.id !== user.uid) {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${u.data().username}</span>
          <div>
            <button onclick="startCall('${u.id}','video')">📹</button>
            <button onclick="startCall('${u.id}','audio')">📞</button>
          </div>
        `;
        usersList.appendChild(li);
      }
    });
  }
  loadUsers();

  // ================= START CALL =================
  window.startCall = async (receiver, type) => {
    const callRef = await addDoc(collection(db, "calls"), {
      caller: user.uid,
      receiver,
      type,
      status: "ringing",
      createdAt: Date.now()
    });
    location.href = `call.html?callId=${callRef.id}&role=caller`;
  };

  // ================= INCOMING CALL POPUP =================
  let incomingCallId = null;
  const incomingQuery = query(
    collection(db, "calls"),
    where("receiver", "==", user.uid),
    where("status", "==", "ringing")
  );

  onSnapshot(incomingQuery, async (snap) => {
    snap.forEach(async docu => {
      const callData = docu.data();
      incomingCallId = docu.id;
      popup.classList.remove("hidden");

      const callerSnap = await getDocs(query(collection(db, "users"), where("uid", "==", callData.caller)));
      const callerUsername = callerSnap.docs[0]?.data().username || "Caller";
      callerName.innerText = `Incoming call from ${callerUsername}`;
    });
  });

  // ================= ACCEPT / REJECT =================
  acceptBtn.onclick = () => {
    location.href = `call.html?callId=${incomingCallId}&role=receiver`;
  };

  rejectBtn.onclick = async () => {
    if (incomingCallId) {
      await updateDoc(doc(db, "calls", incomingCallId), { status: "missed" });
      popup.classList.add("hidden");
    }
  };

  // ================= CALL HISTORY =================
  const historyQuery = query(
    collection(db, "calls"),
    where("caller", "==", user.uid)
  );

  onSnapshot(historyQuery, async (snap) => {
    historyList.innerHTML = "";
    for (const call of snap.docs) {
      const data = call.data();
      if (data.status === "ended" || data.status === "active") {
        const recvSnap = await getDocs(query(collection(db, "users"), where("uid", "==", data.receiver)));
        const receiverName = recvSnap.docs[0]?.data().username || "Receiver";

        const li = document.createElement("li");
        const durationText = data.duration ? `${data.duration} sec` : "-";
        li.textContent = `${data.type.toUpperCase()} with ${receiverName} | ${data.status} | ${durationText}`;
        historyList.appendChild(li);
      }
    }
  });
});