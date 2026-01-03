// js/call.js
import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ------------------ URL PARAMS ------------------
const params = new URLSearchParams(location.search);
const callId = params.get("callId");
const role = params.get("role"); // "caller" or "receiver"

// ------------------ DOM ELEMENTS ------------------
const localVideo = document.getElementById("local");
const remoteVideo = document.getElementById("remote");
const muteBtn = document.getElementById("mute");
const videoBtn = document.getElementById("video");
const endBtn = document.getElementById("end");
const timeEl = document.getElementById("time");
const incomingPopup = document.querySelector(".incoming");
const acceptBtn = document.querySelector(".incoming .accept");
const rejectBtn = document.querySelector(".incoming .reject");
const callerNameEl = document.getElementById("caller-name");

// Ringtone setup
const ringtone = new Audio(".ringtone.mp3");
ringtone.loop = true;

let localStream, pc, callTimer, seconds = 0;
let muted = false, videoOff = false;

// ------------------ TIMER ------------------
function startTimer() {
  callTimer = setInterval(() => {
    seconds++;
    timeEl.textContent =
      String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
      String(seconds % 60).padStart(2, "0");
  }, 1000);
}

// ------------------ INIT LOCAL STREAM ------------------
async function initLocalStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// ------------------ CREATE PEER CONNECTION ------------------
function createPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  // Remote stream
  pc.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  // ICE candidates
  const iceRef = collection(db, "signals", callId, "candidates");
  pc.onicecandidate = e => {
    if (e.candidate) addDoc(iceRef, e.candidate.toJSON());
  };

  onSnapshot(iceRef, snap => {
    snap.docChanges().forEach(change => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

// ------------------ INCOMING CALL POPUP ------------------
async function showIncomingCallPopup(callerId) {
  // Fetch caller info
  const callerSnap = await getDoc(doc(db, "users", callerId));
  callerNameEl.textContent = callerSnap.exists() ? callerSnap.data().username : "Unknown";

  incomingPopup.classList.remove("hidden");
  ringtone.play();

  acceptBtn.onclick = async () => {
    ringtone.pause();
    incomingPopup.classList.add("hidden");
    startReceiverCall();
  };

  rejectBtn.onclick = async () => {
    ringtone.pause();
    incomingPopup.classList.add("hidden");
    await updateDoc(doc(db, "calls", callId), { status: "rejected" });
    location.href = "dashboard.html";
  };
}

// ------------------ CALL FLOWS ------------------
async function startCallerCall() {
  await initLocalStream();
  createPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const callRef = doc(db, "calls", callId);

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await updateDoc(callRef, { offer, callerId: auth.currentUser.uid, status: "calling" });

  // Listen for answer
  onSnapshot(callRef, snap => {
    const data = snap.data();
    if (!data) return;
    if (data.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(data.answer);
      if (!callTimer) startTimer();
    }

    // If receiver rejects
    if (data.status === "rejected") {
      alert("Call rejected by user");
      pc.close();
      location.href = "dashboard.html";
    }
  });
}

async function startReceiverCall() {
  await initLocalStream();
  createPeerConnection();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const callRef = doc(db, "calls", callId);
  const snap = await getDoc(callRef);
  if (!snap.exists()) return alert("Call not found");

  const offer = snap.data().offer;
  const callerId = snap.data().callerId;
  await pc.setRemoteDescription(offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await updateDoc(callRef, { answer, status: "active", receiverId: auth.currentUser.uid });

  startTimer();
}

// ------------------ CONTROLS ------------------
muteBtn.onclick = () => {
  muted = !muted;
  localStream.getAudioTracks()[0].enabled = !muted;
  muteBtn.style.background = muted ? "rgba(255,0,0,.5)" : "rgba(255,255,255,.15)";
};

videoBtn.onclick = () => {
  videoOff = !videoOff;
  localStream.getVideoTracks()[0].enabled = !videoOff;
  videoBtn.style.background = videoOff ? "rgba(255,0,0,.5)" : "rgba(255,255,255,.15)";
};

endBtn.onclick = async () => {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (pc) pc.close();
  clearInterval(callTimer);

  await updateDoc(doc(db, "calls", callId), { status: "ended" });
  location.href = "dashboard.html";
};

// ------------------ START ------------------
(async () => {
  if (role === "caller") {
    startCallerCall();
  } else {
    const callRef = doc(db, "calls", callId);
    const snap = await getDoc(callRef);
    if (!snap.exists()) return alert("Call not found");
    const callerId = snap.data().callerId;
    showIncomingCallPopup(callerId);
  }
})();



