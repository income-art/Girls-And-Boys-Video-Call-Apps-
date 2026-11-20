import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  update,
  set,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging.js";

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

let messaging = null;

try {
  messaging = getMessaging(app);
} catch (error) {
  console.error("Messaging Error:", error);
}

const vapidKey = "BBy_LuhYDcEJDvx2T82u91iyc3IHCd4C7HozBTJOPw09XayhqnF2o4mLS1BOEKq3pAV39wkEYvCI-yimZXLHheU";

// HTML Elements
const loginSection = document.getElementById("loginSection");
const homeSection = document.getElementById("homeSection");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");

const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const usersList = document.getElementById("usersList");

// Global Variables
let currentUser = null;
let usersListener = null;
let presenceListener = null;
let messagesListener = null;
let currentChatUser = null;
let chatNotificationsListener = null;
let chatMessageListeners = {};
let knownMessageIds = {};

// Notification Button
const profileSection = document.getElementById("profileSection");

const notificationBtn = document.createElement("button");
notificationBtn.textContent = "🔔 Enable Notifications";
notificationBtn.style.cssText =
  "display:block;width:100%;padding:14px;margin:15px 0;background:#1877f2;color:white;border:0;border-radius:10px;font-size:16px;";

if (profileSection) {
  profileSection.appendChild(notificationBtn);
}

// Enable Notifications
notificationBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please login first.");
    return;
  }

  try {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Notification permission not granted.");
      return;
    }

    const swRegistration = await navigator.serviceWorker.register(
      "/Girls-And-Boys-Video-Call-Apps-/firebase-messaging-sw.js",
      {
        scope: "/Girls-And-Boys-Video-Call-Apps-/"
      }
    );

    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swRegistration
    });

    if (!token) {
      alert("Notification token পাওয়া যায়নি।");
      return;
    }

    await update(ref(db, "users/" + currentUser.uid), {
      fcmToken: token
    });

    notificationBtn.textContent = "✅ Notifications Enabled";
    alert("Notifications enabled successfully!");

  } catch (error) {
    console.error("Notification Error:", error);
    alert("Notification Error: " + error.message);
  }
});

// Foreground Notifications
if (messaging) {
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "New Message";
    const body = payload.notification?.body || "You received a new message!";

    if (Notification.permission === "granted") {
      new Notification(title, { body: body });
    }
  });
}



// Listen for New Chat Messages
function startChatNotifications() {
  if (!currentUser) return;

  if (chatNotificationsListener) {
    chatNotificationsListener();
  }

  const userChatsRef = ref(db, "users/" + currentUser.uid + "/chats");

  chatNotificationsListener = onValue(userChatsRef, (snapshot) => {
    snapshot.forEach((child) => {
      const chatId = child.key;

      if (chatMessageListeners[chatId]) return;

      const messagesRef = ref(db, "chats/" + chatId + "/messages");

      chatMessageListeners[chatId] = onValue(messagesRef, (messageSnapshot) => {
        if (!knownMessageIds[chatId]) {
          knownMessageIds[chatId] = {};
          messageSnapshot.forEach((msg) => {
            knownMessageIds[chatId][msg.key] = true;
          });
          return;
        }

        messageSnapshot.forEach((msg) => {
          if (knownMessageIds[chatId][msg.key]) return;

          knownMessageIds[chatId][msg.key] = true;

          const message = msg.val();

          if (message.senderId === currentUser.uid) return;
          if (Notification.permission !== "granted") return;

          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(
              message.senderName || "New Message",
              {
                body: message.text || "You received a new message!",
                icon: "/Girls-And-Boys-Video-Call-Apps-/favicon.png"
              }
            );
          }).catch(console.error);
        });
      });
    });
  });
}



// Google Login
googleLoginBtn.addEventListener("click", async () => {
  try {
    googleLoginBtn.disabled = true;
    loginMessage.textContent = "Connecting to Google...";

    await signInWithPopup(auth, provider);

    loginMessage.textContent = "Login successful!";

  } catch (error) {
    console.error(error);
    loginMessage.textContent = error.message;
  } finally {
    googleLoginBtn.disabled = false;
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    if (currentUser) {
      const userRef = ref(db, "users/" + currentUser.uid);

      await onDisconnect(userRef).cancel();

      await update(userRef, {
        online: false,
        lastSeen: serverTimestamp()
      });
    }

    await signOut(auth);

  } catch (error) {
    console.error(error);
    alert("Logout Error: " + error.message);
  }
});

// Authentication State
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (presenceListener) {
    presenceListener();
    presenceListener = null;
  }

  if (usersListener) {
    usersListener();
    usersListener = null;
  }

  if (messagesListener) {
    messagesListener();
    messagesListener = null;
  }

  currentChatUser = null;

  if (user) {
    loginSection.hidden = true;
    homeSection.hidden = false;

    userPhoto.src = user.photoURL || "";
    userName.textContent = user.displayName || "User";
    userEmail.textContent = user.email || "";

    try {
      await saveUser(user);
      startPresence(user);
      loadActiveUsers();
startChatNotifications();

    } catch (error) {
      console.error(error);
      alert("Database Error: " + error.message);
    }

  } else {
    loginSection.hidden = false;
    homeSection.hidden = true;
  }
});

// Save User Profile
async function saveUser(user) {
  const userRef = ref(db, "users/" + user.uid);

  await update(userRef, {
    uid: user.uid,
    name: user.displayName || "User",
    email: user.email || "",
    photo: user.photoURL || "",
    online: false,
    lastSeen: serverTimestamp()
  });
}

// Online / Offline System
function startPresence(user) {
  const userRef = ref(db, "users/" + user.uid);
  const connectedRef = ref(db, ".info/connected");

  presenceListener = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) return;

    try {
      await onDisconnect(userRef).update({
        online: false,
        lastSeen: serverTimestamp()
      });

      await update(userRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

    } catch (error) {
      console.error("Presence Error:", error);
    }
  });
}

// Load All Users
function loadActiveUsers() {
  if (usersListener) usersListener();

  const usersRef = ref(db, "users");

  usersListener = onValue(usersRef, (snapshot) => {
    usersList.innerHTML = "";

    if (!snapshot.exists()) {
      usersList.textContent = "No users found.";
      return;
    }

    snapshot.forEach((child) => {
      const user = child.val();

      if (!user.uid) return;

      const card = document.createElement("div");

      card.style.cssText =
        "display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:10px;background:#f0f2f5;border-radius:10px;";

      const photo = document.createElement("img");
      photo.src = user.photo || "";
      photo.alt = "User";
      photo.style.cssText =
        "width:48px;height:48px;border-radius:50%;object-fit:cover;";

      const info = document.createElement("div");
      info.style.flex = "1";

      const name = document.createElement("strong");
      name.textContent =
        (user.name || "User") +
        (user.uid === currentUser?.uid ? " (You)" : "");

      const status = document.createElement("p");
      status.textContent = user.online ? "🟢 Online" : "⚫ Offline";
      status.style.cssText = "font-size:12px;margin-top:5px;";

      info.append(name, status);
      card.append(photo, info);

      // Click Other Users to Open Chat
      if (user.uid !== currentUser?.uid) {
        card.style.cursor = "pointer";

        card.addEventListener("click", () => {
          openChat(user);
        });
      }

      usersList.appendChild(card);
    });
  });
}

// Open Personal Chat
async function openChat(user) {
  if (!currentUser || user.uid === currentUser.uid) return;

  currentChatUser = user;

// Video Call Button
const chatHeader = document.querySelector("#chatSection .chat-header");

let videoCallBtn = document.getElementById("videoCallBtn");

if (!videoCallBtn && chatHeader) {
  videoCallBtn = document.createElement("button");

  videoCallBtn.id = "videoCallBtn";
  videoCallBtn.textContent = "📹 Video Call";

  videoCallBtn.style.cssText =
    "background:#16a34a;color:white;border:0;border-radius:10px;padding:10px 14px;font-size:14px;margin:8px;";

  videoCallBtn.addEventListener("click", () => {
    if (!currentChatUser) return;

    location.href =
      "video-call.html?to=" +
      encodeURIComponent(currentChatUser.uid);
  });

  chatHeader.appendChild(videoCallBtn);
}

  document.getElementById("activeSection").hidden = true;
  document.getElementById("profileSection").hidden = true;
  document.getElementById("chatSection").hidden = false;

  document.getElementById("chatUserName").textContent =
    user.name || user.displayName || user.username || user.email || "User";

  document.getElementById("chatUserPhoto").src =
    user.photo || "";

  document.getElementById("chatUserStatus").textContent =
    user.online ? "🟢 Online" : "⚫ Offline";

  const chatId = [currentUser.uid, user.uid].sort().join("_");

  const chatRef = ref(db, "chats/" + chatId);

  try {
    await update(ref(db, "chats/" + chatId + "/members"), {
      [currentUser.uid]: true,
      [user.uid]: true
    });

await update(ref(db, "users/" + currentUser.uid + "/chats"), {
  [chatId]: true
});

  } catch (error) {
    console.error(error);
    alert("Chat Error: " + error.message);
    return;
  }

  if (messagesListener) {
    messagesListener();
    messagesListener = null;
  }

  const messagesRef = query(
    ref(db, "chats/" + chatId + "/messages"),
    orderByChild("timestamp")
  );

  messagesListener = onValue(messagesRef, (snapshot) => {
    const chatList = document.getElementById("chatList");
    chatList.innerHTML = "";

    if (!snapshot.exists()) {
      chatList.textContent = "No messages yet. Say Hello!";
      return;
    }

    snapshot.forEach((child) => {
      const message = child.val();

      const bubble = document.createElement("div");

      bubble.className =
        "message " +
        (message.senderId === currentUser.uid
          ? "my-message"
          : "other-message");

      bubble.textContent = message.text || "";

      chatList.appendChild(bubble);
    });

    chatList.scrollTop = chatList.scrollHeight;
  });
}

// Send Message
async function sendMessage() {
  if (!currentUser || !currentChatUser) {
    alert("Please select a user first.");
    return;
  }

  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  const chatId = [
    currentUser.uid,
    currentChatUser.uid
  ].sort().join("_");

  try {
    const messagesRef = ref(
      db,
      "chats/" + chatId + "/messages"
    );

    const newMessage = push(messagesRef);

    await set(newMessage, {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || "User",
      text: text,
      timestamp: Date.now()
    });

    input.value = "";
    input.focus();

  } catch (error) {
    console.error(error);
    alert("Message Error: " + error.message);
  }
}

// Send Button
document.getElementById("sendMessageBtn").addEventListener(
  "click",
  sendMessage
);

// Enter to Send
document.getElementById("messageInput").addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  }
);

// Back to Active Users
document.getElementById("backToUsers").addEventListener(
  "click",
  () => {
    if (messagesListener) {
      messagesListener();
      messagesListener = null;
    }

    currentChatUser = null;

    document.getElementById("chatSection").hidden = true;
    document.getElementById("activeSection").hidden = false;
  }
);

// Navigation
function showSection(section) {
  if (messagesListener) {
    messagesListener();
    messagesListener = null;
  }

  currentChatUser = null;

  document.getElementById("activeSection").hidden =
    section !== "active";

  document.getElementById("chatSection").hidden =
    section !== "chat";

  document.getElementById("profileSection").hidden =
    section !== "profile";
}

document.getElementById("activeTab").addEventListener("click", () => {
  showSection("active");
});

document.getElementById("chatTab").addEventListener("click", () => {
  showSection("chat");
});

document.getElementById("profileTab").addEventListener("click", () => {
  showSection("profile");
});

console.log("Girls And Boys Video Call Apps Ready!");