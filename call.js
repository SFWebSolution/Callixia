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

// -----------------------
// GET URL PARAMETERS
// -----------------------
const params = new URLSearchParams(location.search);
const callId = params.get("callId");
const role = params.get("role"); // "caller" or "receiver"

// -----------------------
// ELEMENTS
// -----------------------
const localVideo = document.getElementById("local");
const remoteVideo = document.getElementById("remote");
const muteBtn = document.getElementById("mute");
const videoBtn = document.getElementById("video");
const endBtn = document.getElementById("end");
const timeEl = document.getElementById("time");
const ringtone = document.getElementById("ringtone");

let localStream;
let muted = false;
let videoOff = false;
let seconds = 0;
let callTimer;

// -----------------------
// TIMER
// -----------------------
function startTimer() {
  callTimer = setInterval(() => {
    seconds++;
    timeEl.textContent =
      String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
      String(seconds % 60).padStart(2, "0");
  }, 1000);
}

// -----------------------
// INIT LOCAL STREAM
// -----------------------
async function initStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

// -----------------------
// SETUP PEER CONNECTION
// -----------------------
const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

// Display remote stream
pc.ontrack = e => {
  remoteVideo.srcObject = e.streams[0];
};

// ICE Candidate handling
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

// -----------------------
// CALL LOGIC
// -----------------------
const callRef = doc(db, "calls", callId);

if (role === "caller") {
  // Caller creates offer
  await initStream();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await updateDoc(callRef, { offer, status: "calling" });

  // Listen for answer
  onSnapshot(callRef, snap => {
    const data = snap.data();
    if (data.answer) {
      pc.setRemoteDescription(data.answer);
      if (!callTimer) startTimer(); // start timer after receiver picks
    }
  });

} else {
  // Receiver logic
  // Play ringtone until call is answered
  ringtone.play().catch(() => console.log("Ringtone blocked"));

  const snap = await getDoc(callRef);
  const offer = snap.data().offer;

  // Init local stream first
  await initStream();
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // Set remote description (caller offer)
  await pc.setRemoteDescription(offer);

  // Create answer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // Update Firestore with answer
  await updateDoc(callRef, { answer, status: "active" });

  // Stop ringtone after pick
  ringtone.pause();

  // Start timer
  startTimer();
}

// -----------------------
// CONTROLS
// -----------------------
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

  // Redirect
  location.href = "dashboard.html";
};