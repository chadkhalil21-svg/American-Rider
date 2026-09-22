// American Rider — Firebase project connection config.
//
// NOTE: unlike the Stripe secret key, these values are NOT secret. Firebase web config is
// designed to live inside the app's code — anyone can see it in any Firebase app. Security
// comes from Firebase Security Rules + Auth, not from hiding these values.

const firebaseConfig = {
  apiKey: "AIzaSyAPRoowtk41kbQRaPQ_v2jnIqvQZoXyA7M",
  authDomain: "american-rider.firebaseapp.com",
  projectId: "american-rider",
  storageBucket: "american-rider.firebasestorage.app",
  messagingSenderId: "777642740728",
  appId: "1:777642740728:web:e568ea27940aa1c24ae40d",
};

module.exports = { firebaseConfig };
