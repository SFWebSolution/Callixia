// js/call.js
import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Get URL params
const params = new URLSearchParams(location.search);
const callId = params.get("callId");
const role = params.get("role");

// Elements
const localVideo = document.getElementById("local");
const remoteVideo = document.getElementById("remote");
const muteBtn = document.getElementById("mute");
const videoBtn = document.getElementById("video");
const endBtn = document.getElementById("end");
const timeEl = document.getElementById("time");

let localStream;
let muted = false;
let videoOff = false;
let seconds = 0;
let callTimer;

// --- Start Call Timer ---
function startTimer() {
  callTimer = setInterval(() => {
    seconds++;
    timeEl.textContent =
      String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
      String(seconds % 60).padStart(2, "0");
  }, 1000);
}

// --- Initialize Local Stream ---
async function initStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// --- Setup WebRTC PeerConnection ---
const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

pc.ontrack = e => {
  remoteVideo.srcObject = e.streams[0];
};

// Add local tracks
await initStream();
localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

// References
const callRef = doc(db, "calls", callId);
const iceRef = collection(db, "signals", callId, "candidates");

// --- ICE Candidate Handling ---
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

// --- Caller vs Receiver Logic ---
if (role === "caller") {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await updateDoc(callRef, { offer });

  // Listen for answer (call picked)
  onSnapshot(callRef, snap => {
    const data = snap.data();
    if (data.answer) {
      pc.setRemoteDescription(data.answer);
      if (!callTimer) startTimer(); // Start timer only after pick
    }
  });

} else {
  const snap = await getDoc(callRef);
  await pc.setRemoteDescription(snap.data().offer);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await updateDoc(callRef, { answer, status: "active" });

  startTimer(); // Start timer immediately after picking call
}

// --- Controls ---
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
  // Stop all tracks
  localStream.getTracks().forEach(t => t.stop());
  pc.close();

  // Update call status
  await updateDoc(callRef, { status: "ended" });

  // Stop timer
  clearInterval(callTimer);

  // Redirect back to dashboard
  location.href = "index.html";
};
