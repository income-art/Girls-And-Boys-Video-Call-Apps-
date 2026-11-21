
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  push,
  set,
  get,
  update,
  onValue,
  onChildAdded,
  remove
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUcoGR66IPc0OWfh-HrHa_XqIGSqCenc",
  authDomain: "girls-and-boys-video-call-apps.firebaseapp.com",
  databaseURL: "https://girls-and-boys-video-call-apps-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "girls-and-boys-video-call-apps",
  storageBucket: "girls-and-boys-video-call-apps.firebasestorage.app",
  messagingSenderId: "1042514082811",
  appId: "1:1042514082811:web:89560a99d8f6e2e59f295e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// HTML Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const callStatus = document.getElementById("callStatus");

const incomingCall = document.getElementById("incomingCall");
const acceptCallBtn = document.getElementById("acceptCallBtn");
const rejectCallBtn = document.getElementById("rejectCallBtn");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const endCallBtn = document.getElementById("endCallBtn");

// Global Variables
let currentUser = null;
let peerConnection = null;
let localStream = null;
let currentCallId = null;
let isCaller = false;

let callListener = null;
let candidateListener = null;
let incomingListener = null;

let remoteDescriptionReady = false;
let pendingCandidates = [];

const params = new URLSearchParams(location.search);
const targetUid = params.get("to");

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// Start Camera and Microphone
async function startMedia() {
  if (localStream) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera requires HTTPS and browser permission.");
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;
}

// Create Peer Connection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(servers);

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection) {
      callStatus.textContent = peerConnection.connectionState;
    }
  };

  return peerConnection;
}

// Add Remote ICE Candidate
async function addRemoteCandidate(candidate) {
  if (!peerConnection) return;

  if (!remoteDescriptionReady) {
    pendingCandidates.push(candidate);
    return;
  }

  try {
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  } catch (error) {
    console.error("ICE candidate error:", error);
  }
}

// Listen for ICE Candidates
function listenForCandidates() {
  const localPath = isCaller
    ? "callerCandidates"
    : "calleeCandidates";

  const remotePath = isCaller
    ? "calleeCandidates"
    : "callerCandidates";

  candidateListener = onChildAdded(
    ref(db, `calls/${currentCallId}/${remotePath}`),
    snapshot => {
      if (snapshot.val()) {
        addRemoteCandidate(snapshot.val());
      }
    }
  );

  peerConnection.onicecandidate = event => {
    if (event.candidate && currentCallId) {
      push(
        ref(db, `calls/${currentCallId}/${localPath}`),
        event.candidate.toJSON()
      ).catch(console.error);
    }
  };
}

// Apply Remote Description and Queued Candidates
async function setRemoteDescription(description) {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(description)
  );

  remoteDescriptionReady = true;

  for (const candidate of pendingCandidates) {
    await addRemoteCandidate(candidate);
  }

  pendingCandidates = [];
}

// Listen for Call Status
function listenForCallStatus() {
  if (callListener) callListener();

  const callRef = ref(db, `calls/${currentCallId}`);

  callListener = onValue(callRef, async snapshot => {
    const data = snapshot.val();

    if (!data) return;

    if (
      isCaller &&
      data.answer &&
      peerConnection &&
      !peerConnection.currentRemoteDescription
    ) {
      try {
        await setRemoteDescription(data.answer);
        callStatus.textContent = "Connected";
      } catch (error) {
        console.error(error);
        callStatus.textContent = error.message;
      }
    }

    if (data.status === "rejected") {
      await cleanupCall();
      callStatus.textContent = "Call Rejected";
    }

    if (data.status === "ended") {
      await cleanupCall();
      callStatus.textContent = "Call Ended";
    }
  });
}

// Start Video Call
async function startCall() {
  if (!targetUid || targetUid === currentUser.uid) {
    callStatus.textContent = "Invalid user selected";
    return;
  }

  try {
    callStatus.textContent = "Opening camera...";

    await startMedia();

    isCaller = true;
    remoteDescriptionReady = false;
    pendingCandidates = [];

    createPeerConnection();

    const callRef = push(ref(db, "calls"));
    currentCallId = callRef.key;

    await set(callRef, {
      callerId: currentUser.uid,
      calleeId: targetUid,
      status: "ringing"
    });

    listenForCandidates();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await update(callRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    });

    // Notify the selected user
    await set(
      ref(db, `incomingCalls/${targetUid}/${currentCallId}`),
      {
        callerId: currentUser.uid,
        callId: currentCallId
      }
    );

    listenForCallStatus();

    callStatus.textContent = "Calling...";

  } catch (error) {
    console.error(error);
    callStatus.textContent = error.message;
  }
}

// Listen for Incoming Calls
function listenForIncomingCalls() {
  if (incomingListener) incomingListener();

  incomingListener = onChildAdded(
    ref(db, `incomingCalls/${currentUser.uid}`),
    async snapshot => {
      if (currentCallId) return;

      const pointer = snapshot.val();

      if (!pointer?.callId) return;

      try {
        const callSnapshot = await get(
          ref(db, `calls/${pointer.callId}`)
        );

        const data = callSnapshot.val();

        if (
          !data ||
          data.calleeId !== currentUser.uid ||
          data.status !== "ringing" ||
          !data.offer
        ) {
          return;
        }

        currentCallId = pointer.callId;
        isCaller = false;

        incomingCall.hidden = false;
        callStatus.textContent = "Incoming Video Call";
      } catch (error) {
        console.error(error);
      }
    }
  );
}

// Accept Call
acceptCallBtn.addEventListener("click", async () => {
  if (!currentCallId) return;

  try {
    await startMedia();

    remoteDescriptionReady = false;
    pendingCandidates = [];

    createPeerConnection();

    const callRef = ref(db, `calls/${currentCallId}`);
    const snapshot = await get(callRef);
    const data = snapshot.val();

    if (!data || !data.offer || data.status !== "ringing") {
      throw new Error("This call is no longer available.");
    }

    await setRemoteDescription(data.offer);

    listenForCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await update(callRef, {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      },
      status: "accepted"
    });

    await remove(
      ref(db, `incomingCalls/${currentUser.uid}/${currentCallId}`)
    );

    incomingCall.hidden = true;

    listenForCallStatus();

    callStatus.textContent = "Connecting...";

  } catch (error) {
    console.error(error);
    callStatus.textContent = error.message;
  }
});

// Reject Call
rejectCallBtn.addEventListener("click", async () => {
  if (!currentCallId) return;

  try {
    await update(ref(db, `calls/${currentCallId}`), {
      status: "rejected"
    });

    await remove(
      ref(db, `incomingCalls/${currentUser.uid}/${currentCallId}`)
    );

    await cleanupCall();
    callStatus.textContent = "Call Rejected";

  } catch (error) {
    console.error(error);
    callStatus.textContent = error.message;
  }
});

// Mute / Unmute Microphone
muteBtn.addEventListener("click", () => {
  if (!localStream) return;

  const track = localStream.getAudioTracks()[0];

  if (track) {
    track.enabled = !track.enabled;
    muteBtn.textContent = track.enabled
      ? "🎤 Mute"
      : "🔇 Unmute";
  }
});

// Camera On / Off
cameraBtn.addEventListener("click", () => {
  if (!localStream) return;

  const track = localStream.getVideoTracks()[0];

  if (track) {
    track.enabled = !track.enabled;
    cameraBtn.textContent = track.enabled
      ? "📷 Camera Off"
      : "📷 Camera On";
  }
});

// Cleanup Call
async function cleanupCall() {
  if (callListener) {
    callListener();
    callListener = null;
  }

  if (candidateListener) {
    candidateListener();
    candidateListener = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  currentCallId = null;
  remoteDescriptionReady = false;
  pendingCandidates = [];

  incomingCall.hidden = true;

  muteBtn.textContent = "🎤 Mute";
  cameraBtn.textContent = "📷 Camera Off";
}

// End Call
endCallBtn.addEventListener("click", async () => {
  if (currentCallId) {
    const callId = currentCallId;

    try {
      await update(ref(db, `calls/${callId}`), {
        status: "ended"
      });

      await remove(
        ref(db, `incomingCalls/${currentUser.uid}/${callId}`)
      );
    } catch (error) {
      console.error(error);
    }
  }

  await cleanupCall();
  callStatus.textContent = "Call Ended";
});

// Authentication
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    callStatus.textContent = "Please login first";
    return;
  }

  callStatus.textContent = "Ready";

  listenForIncomingCalls();

  if (targetUid) {
    await startCall();
  }
});

console.log("Video Call System Ready!");