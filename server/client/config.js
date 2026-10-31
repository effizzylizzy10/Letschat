// Point these at your deployed server (see server/README section in the
// repo README). For local testing with the server running on your machine,
// the localhost defaults work as long as your phone and computer are on the
// same Wi-Fi and you swap "localhost" for your computer's LAN IP.
window.LETSCHAT_CONFIG = {
  // Paste these from Firebase console > Project settings > Your apps > Web app
  FIREBASE: {
    apiKey: "AIzaSyBclbDUzqSszcj205NKxczMCNJ2qPi6Q3g",
    authDomain: "letschatafrica-1df0c.firebaseapp.com",
    projectId: "letschatafrica-1df0c",
    appId: "1:94043215929:web:bd78737d35864a578f95e8",
  },
  API_URL: "https://letschat-9tw4.onrender.com",
  SOCKET_URL: "https://letschat-9tw4.onrender.com",
  // Help screen > Contact us. Fill in at least one so people can reach you (WhatsApp number with country code, digits only).
  // The "Click Here" button on the Update Available screen opens this link (it is never shown on screen).
  // Put your APK / Play Store / website link here. Before opening it the app clears its saved copy so the newest version loads.
  UPDATE_URL: "https://letschatafrican.netlify.app/",
  SUPPORT_WHATSAPP: "",
  SUPPORT_EMAIL: "",
  // Video/voice calls and Letschat Live: ICE servers. STUN is free and always on. TURN helps people on strict mobile networks connect.
  // Fill in the three TURN fields (from Metered Open Relay or any TURN provider); leave them empty to use STUN only.
  TURN_URLS: [],       // example: ["turn:YOUR-HOST:80", "turn:YOUR-HOST:443", "turns:YOUR-HOST:443?transport=tcp"]
  TURN_USERNAME: "",
  TURN_CREDENTIAL: "",
};
// Builds ICE_SERVERS from the fields above (app.js and live.js read window.LETSCHAT_CONFIG.ICE_SERVERS).
(function (c) {
  var ice = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
  if (c.TURN_URLS && c.TURN_URLS.length && c.TURN_USERNAME && c.TURN_CREDENTIAL) ice.push({ urls: c.TURN_URLS, username: c.TURN_USERNAME, credential: c.TURN_CREDENTIAL });
  if (!c.ICE_SERVERS) c.ICE_SERVERS = ice;
})(window.LETSCHAT_CONFIG);
// Password manager support on the login / sign-up screens (autofill + "Save password?"): loads autofill.js next to this file.
(function () {
  try {
    var s = document.createElement("script");
    s.src = "autofill.js";
    s.defer = true;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {}
})();
