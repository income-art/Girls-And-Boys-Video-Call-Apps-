
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  update,
  onDisconnect,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";


// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUcoGR66IPpC0OWfh-HrHa_XqIGSqCEnc",
  authDomain: "girls-and-boys-video-call-apps.firebaseapp.com",
  databaseURL: "https://girls-and-boys-video-call-apps-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "girls-and-boys-video-call-apps",
  storageBucket: "girls-and-boys-video-call-apps.firebasestorage.app",
  messagingSenderId: "1042514082811",
  appId: "1:1042514082811:web:89560a99d8f6e2e59f295e",
  measurementId: "G-7ZH64G5T9T"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account"
});


// HTML Elements
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const message = document.getElementById("message");
const userInfo = document.getElementById("userInfo");
const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");


// Show Message
function showMessage(text) {
  message.textContent = text;
}


// Show User Profile
function showUser(user) {
  userInfo.hidden = false;
  googleLoginBtn.style.display = "none";

  userPhoto.src = user.photoURL || "";
  userName.textContent = user.displayName || "User";
  userEmail.textContent = user.email || "";

  showMessage("Login successful!");
}


// Save User in Database
async function saveUser(user) {
  const userRef = ref(db, "users/" + user.uid);

  // Set Offline when connection closes
  await onDisconnect(userRef).update({
    status: "offline",
    lastSeen: serverTimestamp()
  });

  // Save User Information
  await update(userRef, {
    uid: user.uid,
    name: user.displayName || "User",
    email: user.email || "",
    photoURL: user.photoURL || "",
    status: "online",
    lastSeen: serverTimestamp()
  });
}


// Google Login
googleLoginBtn.addEventListener("click", async () => {
  showMessage("Connecting to Google...");
  googleLoginBtn.disabled = true;

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    showMessage(error.message);
    googleLoginBtn.disabled = false;
  }
});


// Keep Login Session and Save User
onAuthStateChanged(auth, async (user) => {
  if (user) {
    showUser(user);

    try {
      await saveUser(user);
      showMessage("Login successful! User saved.");
    } catch (error) {
      console.error("Database Error:", error);
      showMessage("Login successful, Database Error: " + error.message);
    }

  } else {
    userInfo.hidden = true;
    googleLoginBtn.style.display = "";
    googleLoginBtn.hidden = false;
    googleLoginBtn.disabled = false;

    showMessage("");
  }
});


// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;

    if (user) {
      const userRef = ref(db, "users/" + user.uid);

      await update(userRef, {
        status: "offline",
        lastSeen: serverTimestamp()
      });
    }

    await signOut(auth);

    showMessage("Logged out successfully.");

  } catch (error) {
    console.error(error);
    showMessage(error.message);
  }
});
