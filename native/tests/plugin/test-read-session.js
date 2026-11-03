// Checks READ_SESSION_JS, the little script ChatBubblePlugin.java runs inside the Letschat page to read the saved sign-in.
// It must answer a JSON text with the token, the server address, the user id and the two notification switches,
// and an empty text when nobody is signed in. A mistake in that script would stop the background checker from ever starting.
// Usage: node test-read-session.js path/to/ChatBubblePlugin.java
const fs = require("fs");
const vm = require("vm");

const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
const found = /READ_SESSION_JS\s*=\s*((?:\s*(?:\+\s*)?"(?:[^"\\]|\\.)*")+)\s*;/.exec(src);
if (!found) { console.log("FAIL  could not find READ_SESSION_JS in " + file); process.exit(1); }
const pieces = [...found[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse('"' + m[1] + '"')); // Java string pieces, escapes decoded
const js = pieces.join("");

let failures = 0;
function check(name, ok) { console.log((ok ? "PASS  " : "FAIL  ") + name); if (!ok) failures++; }

// runs the script the way the page would: localStorage and window are the page's
function run(store, config) {
  const sandbox = {
    localStorage: { getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null) },
    window: config === undefined ? {} : { LETSCHAT_CONFIG: config },
  };
  return vm.runInNewContext(js, sandbox);
}
const session = (o) => JSON.stringify(o);
const SESSION = "letschat-africa:session";
const NOTIFS = "letschat-africa:notifs";
const API = { API_URL: "https://api.example.test" };

let r = run({ [SESSION]: session({ token: "T1", user: { id: "u1", name: "Me" } }) }, API);
check("the answer is a text", typeof r === "string");
let o = JSON.parse(r);
check("token, server address and user id are reported", o.t === "T1" && o.a === "https://api.example.test" && o.u === "u1");
check("both switches are on when the person never changed them", o.p === true && o.g === true);

o = JSON.parse(run({ [SESSION]: session({ token: "T2", user: { _id: "mongo1" } }) }, API));
check("user id from user._id", o.u === "mongo1");
o = JSON.parse(run({ [SESSION]: session({ token: "T3", userId: "flat1" }) }, API));
check("user id from userId", o.u === "flat1");
o = JSON.parse(run({ [SESSION]: session({ token: "T4", id: "id1" }) }, API));
check("user id from id", o.u === "id1");
o = JSON.parse(run({ [SESSION]: session({ token: "T5" }) }, API));
check("no user id: reported as an empty text (the checker then cannot tell which messages are mine)", o.t === "T5" && o.u === "");
o = JSON.parse(run({ [SESSION]: session({ token: "T6" }) }));
check("no server address on the page: reported empty (the app then uses its built-in address)", o.a === "");

check("nobody signed in (nothing saved): empty answer", run({}, API) === "");
check("saved sign-in without a token: empty answer", run({ [SESSION]: session({ user: { id: "u1" } }) }, API) === "");
check("saved sign-in is damaged: empty answer, no error", run({ [SESSION]: "{not json" }, API) === "");
check("saved sign-in is the text null: empty answer", run({ [SESSION]: "null" }, API) === "");

const withNotifs = (n) => JSON.parse(run({ [SESSION]: session({ token: "T", user: { id: "u" } }), [NOTIFS]: n }, API));
o = withNotifs(JSON.stringify({ preview: false }));
check("Show message preview off: p is false, g stays true", o.p === false && o.g === true);
o = withNotifs(JSON.stringify({ groups: false }));
check("Group messages off: g is false, p stays true", o.g === false && o.p === true);
o = withNotifs(JSON.stringify({ preview: false, groups: false }));
check("both off", o.p === false && o.g === false);
o = withNotifs(JSON.stringify({ preview: true, groups: true, sound: false }));
check("both explicitly on", o.p === true && o.g === true);
o = withNotifs("{broken");
check("damaged switches: treated as on, the sign-in is still reported", o.t === "T" && o.p === true && o.g === true);
o = withNotifs("null");
check("switches saved as null: treated as on", o.p === true && o.g === true);

o = JSON.parse(run({ [SESSION]: session({ token: 'tok"en\\with"quotes', user: { id: "u" } }) }, API));
check("a token with quotes and backslashes survives the round trip", o.t === 'tok"en\\with"quotes');

console.log(failures === 0 ? "\nALL READ-SESSION CHECKS PASSED" : "\n" + failures + " READ-SESSION CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
