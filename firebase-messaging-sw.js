importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBUcoGR66IPpC0OWfh-HrHa_XqIGSqCEnc",
  authDomain: "girls-and-boys-video-call-apps.firebaseapp.com",
  databaseURL: "https://girls-and-boys-video-call-apps-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "girls-and-boys-video-call-apps",
  storageBucket: "girls-and-boys-video-call-apps.firebasestorage.app",
  messagingSenderId: "1042514082811",
  appId: "1:1042514082811:web:89560a99d8f6e2e59f295e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Message";

  self.registration.showNotification(title, {
    body: payload.notification?.body || "You received a new message!",
    icon: "/Girls-And-Boys-Video-Call-Apps-/favicon.png"
  });
});