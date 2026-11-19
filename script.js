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
  serverTimestamp,
  onValue
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

const activeUsersSection =
  document.getElementById("activeUsersSection");

const activeUsersList =
  document.getElementById("activeUsersList");

let stopUsersListener = null;


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

  await onDisconnect(userRef).update({
    status: "offline",
    lastSeen: serverTimestamp()
  });

  await update(userRef, {
    uid: user.uid,
    name: user.displayName || "User",
    photoURL: user.photoURL || "",
    email: null,
    status: "online",
    lastSeen: serverTimestamp()
  });
}


// Show Active Users
function loadActiveUsers(currentUser) {
  if (stopUsersListener) {
    stopUsersListener();
  }

  activeUsersSection.hidden = false;
  activeUsersList.innerHTML = "<p>Loading users...</p>";

  const usersRef = ref(db, "users");

  stopUsersListener = onValue(usersRef, (snapshot) => {
    activeUsersList.innerHTML = "";

    if (!snapshot.exists()) {
      activeUsersList.innerHTML =
        "<p>No users found.</p>";
      return;
    }

    let onlineCount = 0;

    snapshot.forEach((childSnapshot) => {
      const user = childSnapshot.val();

      if (
        !user ||
        childSnapshot.key === currentUser.uid ||
        user.status !== "online"
      ) {
        return;
      }

      onlineCount++;

      const userCard = document.createElement("div");
      userCard.className = "active-user";

      const photo = document.createElement("img");
      photo.src = user.photoURL || "";
      photo.alt = "User";

      const info = document.createElement("div");
      info.className = "active-user-info";

      const name = document.createElement("h3");
      name.textContent = user.name || "User";

      const status = document.createElement("p");
      status.textContent = "● Online";

      info.appendChild(name);
      info.appendChild(status);

      const messageBtn = document.createElement("button");
      messageBtn.className = "message-btn";
      messageBtn.textContent = "Message";

      messageBtn.addEventListener("click", () => {
        showMessage(
          "Chat feature will be added in the next step."
        );
      });

      userCard.appendChild(photo);
      userCard.appendChild(info);
      userCard.appendChild(messageBtn);

      activeUsersList.appendChild(userCard);
    });

    if (onlineCount === 0) {
      activeUsersList.innerHTML =
        "<p style='text-align:center;color:#cbd5e1;'>No other users online yet.</p>";
    }

  }, (error) => {
    console.error("Users Error:", error);
    activeUsersList.innerHTML =
      "<p>Unable to load users: " + error.message + "</p>";
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


// Login Session
onAuthStateChanged(auth, async (user) => {
  if (user) {
    showUser(user);

    try {
      await saveUser(user);
      loadActiveUsers(user);
      showMessage("Login successful! User saved.");

    } catch (error) {
      console.error("Database Error:", error);
      showMessage("Database Error: " + error.message);
    }

  } else {
    if (stopUsersListener) {
      stopUsersListener();
      stopUsersListener = null;
    }

    activeUsersSection.hidden = true;
    activeUsersList.innerHTML = "";

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
