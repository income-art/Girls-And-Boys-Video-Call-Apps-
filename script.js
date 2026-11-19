
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
  onValue,
  push
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
provider.setCustomParameters({ prompt: "select_account" });


// HTML Elements
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const message = document.getElementById("message");

const userInfo = document.getElementById("userInfo");
const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");

const activeUsersSection = document.getElementById("activeUsersSection");
const activeUsersList = document.getElementById("activeUsersList");

const chatSection = document.getElementById("chatSection");
const chatUserPhoto = document.getElementById("chatUserPhoto");
const chatUserName = document.getElementById("chatUserName");
const chatUserStatus = document.getElementById("chatUserStatus");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const backToUsersBtn = document.getElementById("backToUsersBtn");

let stopUsersListener = null;
let stopChatListener = null;
let currentChatId = null;
let currentChatUser = null;


// Show Message
function showMessage(text) {
  message.textContent = text;
}


// Show Profile
function showUser(user) {
  userInfo.hidden = false;
  googleLoginBtn.style.display = "none";

  userPhoto.src = user.photoURL || "";
  userName.textContent = user.displayName || "User";
  userEmail.textContent = user.email || "";

  showMessage("Login successful!");
}


// Save User
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


// Open Personal Chat
async function openChat(otherUser) {
  const currentUser = auth.currentUser;

  if (!currentUser || !otherUser.uid) return;

  currentChatUser = otherUser;

  const ids = [currentUser.uid, otherUser.uid].sort();
  currentChatId = ids.join("_");

  activeUsersSection.hidden = true;
  chatSection.hidden = false;

  chatUserPhoto.src = otherUser.photoURL || "";
  chatUserName.textContent = otherUser.name || "User";
  chatUserStatus.textContent =
    otherUser.status === "online" ? "● Online" : "Offline";

  chatMessages.innerHTML = "<p>Loading messages...</p>";

  const chatRef = ref(db, "chats/" + currentChatId);

  try {
    // Register both chat participants
    await update(chatRef, {
      members: {
        [currentUser.uid]: true,
        [otherUser.uid]: true
      }
    });

    // Stop previous chat listener
    if (stopChatListener) {
      stopChatListener();
      stopChatListener = null;
    }

    const messagesRef = ref(
      db,
      "chats/" + currentChatId + "/messages"
    );

    stopChatListener = onValue(messagesRef, (snapshot) => {
      chatMessages.innerHTML = "";

      if (!snapshot.exists()) {
        chatMessages.innerHTML =
          "<p style='text-align:center;color:#cbd5e1;'>No messages yet. Say hello!</p>";
        return;
      }

      snapshot.forEach((child) => {
        const data = child.val();

        const bubble = document.createElement("div");

        bubble.className =
          "chat-message " +
          (data.senderId === currentUser.uid
            ? "my-message"
            : "other-message");

        const text = document.createElement("span");
        text.textContent = data.text || "";

        const time = document.createElement("small");
        time.className = "chat-time";

        if (data.timestamp) {
          time.textContent = new Date(
            data.timestamp
          ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          });
        } else {
          time.textContent = "Sending...";
        }

        bubble.appendChild(text);
        bubble.appendChild(time);

        chatMessages.appendChild(bubble);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;

    }, (error) => {
      console.error("Chat Error:", error);
      chatMessages.textContent = error.message;
    });

  } catch (error) {
    console.error("Open Chat Error:", error);
    showMessage("Chat Error: " + error.message);
  }
}


// Send Message
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  const text = chatInput.value.trim();

  if (!user || !currentChatId || !text) return;

  const sendButton = document.getElementById("sendMessageBtn");
  sendButton.disabled = true;

  try {
    const messagesRef = ref(
      db,
      "chats/" + currentChatId + "/messages"
    );

    await push(messagesRef, {
      senderId: user.uid,
      text: text,
      timestamp: serverTimestamp()
    });

    chatInput.value = "";

  } catch (error) {
    console.error("Send Message Error:", error);
    showMessage("Message Error: " + error.message);

  } finally {
    sendButton.disabled = false;
  }
});


// Back to Active Users
backToUsersBtn.addEventListener("click", () => {
  if (stopChatListener) {
    stopChatListener();
    stopChatListener = null;
  }

  currentChatId = null;
  currentChatUser = null;

  chatSection.hidden = true;
  activeUsersSection.hidden = false;
});


// Load Active Users
function loadActiveUsers(currentUser) {
  if (stopUsersListener) {
    stopUsersListener();
  }

  activeUsersSection.hidden = false;
  const usersRef = ref(db, "users");

  stopUsersListener = onValue(usersRef, (snapshot) => {
    activeUsersList.innerHTML = "";

    let onlineCount = 0;

    snapshot.forEach((child) => {
      const user = child.val();

      if (
        !user ||
        child.key === currentUser.uid ||
        user.status !== "online"
      ) return;

      onlineCount++;

      const card = document.createElement("div");
      card.className = "active-user";

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

      const button = document.createElement("button");
      button.className = "message-btn";
      button.textContent = "Message";

      button.addEventListener("click", () => {
        openChat({
          uid: child.key,
          name: user.name || "User",
          photoURL: user.photoURL || "",
          status: user.status
        });
      });

      card.appendChild(photo);
      card.appendChild(info);
      card.appendChild(button);

      activeUsersList.appendChild(card);
    });

    if (onlineCount === 0) {
      activeUsersList.innerHTML =
        "<p style='text-align:center;color:#cbd5e1;'>No other users online yet.</p>";
    }

  }, (error) => {
    console.error("Users Error:", error);
    activeUsersList.textContent = error.message;
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

    if (stopChatListener) {
      stopChatListener();
      stopChatListener = null;
    }

    currentChatId = null;
    currentChatUser = null;

    chatSection.hidden = true;
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
