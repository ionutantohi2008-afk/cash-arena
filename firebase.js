;const firebaseConfig = {
  apiKey: "AIzaSyDRfE4V50JwNWA4EaejEIp-VbD2wwutA_M",
  authDomain: "cash-arena-c2f31.firebaseapp.com",
  projectId: "cash-arena-c2f31",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();