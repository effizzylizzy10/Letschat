// ---- Built-in icons (replaces the lucide-react import; no external icon library needed) ----
const { useState, useRef, useEffect, useCallback } = React;

function makeIcon(nodes) {
  return function Icon({ size = 24, color = "currentColor", strokeWidth = 2, style }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}>
        {nodes.map((n, i) => {
          if (n[0] === "p") return <path key={i} d={n[1]} />;
          if (n[0] === "c") return <circle key={i} cx={n[1]} cy={n[2]} r={n[3]} />;
          if (n[0] === "r") return <rect key={i} x={n[1]} y={n[2]} width={n[3]} height={n[4]} rx={n[5]} />;
          if (n[0] === "g") return <polygon key={i} points={n[1]} />;
          return null;
        })}
      </svg>
    );
  };
}
const PHONE = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";
const Search = makeIcon([["c", 11, 11, 8], ["p", "m21 21-4.3-4.3"]]);
const Phone = makeIcon([["p", PHONE]]);
const Video = makeIcon([["g", "23 7 16 12 23 17 23 7"], ["r", 1, 5, 15, 14, 2]]);
const MoreVertical = makeIcon([["c", 12, 12, 1], ["c", 12, 5, 1], ["c", 12, 19, 1]]);
const ArrowLeft = makeIcon([["p", "m12 19-7-7 7-7"], ["p", "M19 12H5"]]);
const Camera = makeIcon([["p", "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"], ["c", 12, 13, 3]]);
const Send = makeIcon([["p", "m22 2-7 20-4-9-9-4Z"], ["p", "M22 2 11 13"]]);
const Smile = makeIcon([["c", 12, 12, 10], ["p", "M8 14s1.5 2 4 2 4-2 4-2"], ["p", "M9 9h.01"], ["p", "M15 9h.01"]]);
const Paperclip = makeIcon([["p", "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"]]);
const Mic = makeIcon([["p", "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"], ["p", "M19 10v2a7 7 0 0 1-14 0v-2"], ["p", "M12 19v3"]]);
const MessageCircle = makeIcon([["p", "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"]]);
const PhoneCall = makeIcon([["p", PHONE], ["p", "M14.05 2a9 9 0 0 1 8 7.94"], ["p", "M14.05 6A5 5 0 0 1 18 10"]]);
const Radio = makeIcon([["c", 12, 12, 2], ["p", "M4.93 19.07a10 10 0 0 1 0-14.14"], ["p", "M7.76 16.24a6 6 0 0 1 0-8.48"], ["p", "M16.24 7.76a6 6 0 0 1 0 8.48"], ["p", "M19.07 4.93a10 10 0 0 1 0 14.14"]]);
const Grid3x3 = makeIcon([["r", 3, 3, 18, 18, 2], ["p", "M3 9h18"], ["p", "M3 15h18"], ["p", "M9 3v18"], ["p", "M15 3v18"]]);
const Check = makeIcon([["p", "M20 6 9 17l-5-5"]]);
const CheckCheck = makeIcon([["p", "M18 6 7 17l-5-5"], ["p", "m22 10-7.5 7.5L13 16"]]);
const Plus = makeIcon([["p", "M5 12h14"], ["p", "M12 5v14"]]);
const Edit3 = makeIcon([["p", "M12 20h9"], ["p", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"]]);
const ChevronRight = makeIcon([["p", "m9 18 6-6-6-6"]]);
const Bell = makeIcon([["p", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"], ["p", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]]);
const Lock = makeIcon([["r", 3, 11, 18, 11, 2], ["p", "M7 11V7a5 5 0 0 1 10 0v4"]]);
const HelpCircle = makeIcon([["c", 12, 12, 10], ["p", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"], ["p", "M12 17h.01"]]);
const Users = makeIcon([["p", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"], ["c", 9, 7, 4], ["p", "M22 21v-2a4 4 0 0 0-3-3.87"], ["p", "M16 3.13a4 4 0 0 1 0 7.75"]]);
const Star = makeIcon([["g", "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"]]);
const LogOut = makeIcon([["p", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"], ["p", "m16 17 5-5-5-5"], ["p", "M21 12H9"]]);
const User = makeIcon([["p", "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"], ["c", 12, 7, 4]]);
const Pencil = makeIcon([["p", "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"]]);
const X = makeIcon([["p", "M18 6 6 18"], ["p", "m6 6 12 12"]]);
const AlertCircle = makeIcon([["c", 12, 12, 10], ["p", "M12 8v4"], ["p", "M12 16h.01"]]);
const ShoppingBag = makeIcon([["p", "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"], ["p", "M3 6h18"], ["p", "M16 10a4 4 0 0 1-8 0"]]);


/* ============================================================
   LETSCHAT AFRICA — realtime chat client
   Talks to the Letschat Africa server (Express + Socket.io) configured in config.js.
   Color: --ink #0E1116 --panel #161B22 --accent #35D0BA --amber #F2B84B
          --coral #FF6B5D  --ink-0 #F5F7FA --ink-1 #9BA7B4 --ink-2 #5B6673
   Type: Display 'Sora' / Body 'Inter'
   ============================================================ */

const { API_URL, SOCKET_URL, FIREBASE } = window.LETSCHAT_CONFIG;
const FIREBASE_READY = !!(FIREBASE && FIREBASE.apiKey && !String(FIREBASE.apiKey).startsWith("PASTE"));
if (FIREBASE_READY) firebase.initializeApp(FIREBASE);
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap";

// ---- local persistence (device-only: session token, cached profile) ----
function loadJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem("letschat-africa:" + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function saveJSON(key, value) {
  try { window.localStorage.setItem("letschat-africa:" + key, JSON.stringify(value)); }
  catch (e) { console.error("Storage save failed", e); }
}
function clearJSON(key) {
  try { window.localStorage.removeItem("letschat-africa:" + key); } catch {}
}

// ---- API helper ----
async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
    // expired / rejected login: sign out so the person lands on the login screen instead of seeing errors
    if (res.status === 401 && token && /invalid token|unknown user|missing token/i.test((payload.error && payload.error.message) || "")) {
        clearJSON("session");
        window.location.reload();
        return new Promise(() => { });
    }
  if (!res.ok || payload.success === false) throw new Error((payload.error && payload.error.message) || `Request failed (${res.status})`);
  return payload.data;
}

function timeLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ---- attachments: read a file, shrink photos, format sizes ----
const MAX_FILE = 3 * 1024 * 1024;
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).replace(/^data:;base64,/, "data:application/octet-stream;base64,"));
    fr.onerror = () => reject(new Error("Could not read that file"));
    fr.readAsDataURL(file);
  });
}
function compressImage(file, max = 1280) { // keeps the whole picture, just smaller (JPEG)
  return new Promise((resolve, reject) => {
    readAsDataURL(file).then((url) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = url;
    }, reject);
  });
}

// ---- crop an image file to a centered square and shrink it, returns a base64 data URL ----
function resizeImageToDataURL(file, maxSize = 512) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not read that image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

// photos from our own server come back as a path ("/api/v1/users/ID/avatar?v=..."): add the server address
const photoSrc = (p) => (p && p.startsWith("/") ? API_URL + p : p);

function Ring({ size = 52, color, initials, online, ring, photo, onClick }) {
  photo = photoSrc(photo);
  return (
    <div onClick={onClick} style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: onClick ? "pointer" : "default" }}>
      {ring && (
        <div style={{ position: "absolute", inset: -3, borderRadius: "50%", background: `conic-gradient(from 90deg, ${color}, #F2B84B, ${color})` }} />
      )}
      {photo ? (
        <img
          src={photo}
          alt=""
          onContextMenu={e => e.preventDefault()}
          draggable={false}
          style={{
            position: "absolute", inset: ring ? 3 : 0, borderRadius: "50%",
            width: `calc(100% - ${ring ? 6 : 0}px)`, height: `calc(100% - ${ring ? 6 : 0}px)`,
            objectFit: "cover", border: `1px solid ${color}55`,
            userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          }}
        />
      ) : (
        <div style={{
          position: "absolute", inset: ring ? 3 : 0, borderRadius: "50%",
          background: color + "26", color, display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "Sora", fontWeight: 700,
          fontSize: size * 0.34, border: `1px solid ${color}55`,
        }}>{initials}</div>
      )}
      {online !== undefined && (
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: "50%", background: online ? "#35D0BA" : "#5B6673", border: "3px solid #0E1116" }} />
      )}
    </div>
  );
}

// ---- fullscreen photo viewer: pinch, double-tap or scroll to zoom, drag to move ----
function ImageZoomModal({ photo, initials, color, onClose }) {
  photo = photoSrc(photo);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const box = useRef(null);
  const ptrs = useRef(new Map());
  const base = useRef(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  const clamp = (n) => {
    const s = Math.min(5, Math.max(1, n.s));
    const W = box.current ? box.current.offsetWidth : 340;
    const m = ((s - 1) * W) / 2;
    return { s, x: s === 1 ? 0 : Math.min(m, Math.max(-m, n.x)), y: s === 1 ? 0 : Math.min(m, Math.max(-m, n.y)) };
  };
  const snap = () => { base.current = { t, p: [...ptrs.current.values()].map((q) => ({ ...q })) }; };

  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) moved.current = false;
    snap();
  };
  const move = (e) => {
    if (!ptrs.current.has(e.pointerId) || !base.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = [...ptrs.current.values()];
    const b = base.current;
    if (p.length >= 2 && b.p.length >= 2) {
      moved.current = true;
      const d0 = Math.hypot(b.p[0].x - b.p[1].x, b.p[0].y - b.p[1].y) || 1;
      const d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      setT(clamp({
        s: (b.t.s * d1) / d0,
        x: b.t.x + (p[0].x + p[1].x) / 2 - (b.p[0].x + b.p[1].x) / 2,
        y: b.t.y + (p[0].y + p[1].y) / 2 - (b.p[0].y + b.p[1].y) / 2,
      }));
    } else if (p.length === 1 && b.p.length === 1) {
      const dx = p[0].x - b.p[0].x, dy = p[0].y - b.p[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved.current = true;
      if (b.t.s > 1) setT(clamp({ s: b.t.s, x: b.t.x + dx, y: b.t.y + dy }));
    }
  };
  const up = (e) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 0 && !moved.current) {
      const now = Date.now();
      if (now - lastTap.current < 300) { setT((c) => clamp(c.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })); lastTap.current = 0; }
      else lastTap.current = now;
    }
    snap();
  };

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000000F2", zIndex: 30,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
    }}>
      <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", zIndex: 2 }}>
        <X size={26} />
      </button>
      {photo ? (
        <>
          <div
            ref={box}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            onWheel={(e) => setT((c) => clamp({ ...c, s: c.s - e.deltaY * 0.003 }))}
            style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", touchAction: "none", cursor: t.s > 1 ? "grab" : "zoom-in" }}
          >
            <img
              src={photo}
              alt=""
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
              style={{
                width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none",
                transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transformOrigin: "center",
                userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
              }}
            />
          </div>
          <div style={{ marginTop: 14, fontFamily: "Inter", fontSize: 12.5, color: "#8891A0" }}>Pinch or double-tap to zoom</div>
        </>
      ) : (
        <div style={{ width: 220, height: 220, borderRadius: "50%", background: color + "26", color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sora", fontWeight: 700, fontSize: 70, border: `1px solid ${color}55` }}>{initials}</div>
      )}
    </div>
  );
}

// ---- shared: photo type check, bottom sheet menu, camera badge ----
const PHOTO_ACCEPT = "image/jpeg,image/png";
const isJpgOrPng = (file) => /^image\/(jpe?g|png)$/i.test(file.type);

function PhotoMenu({ hasPhoto, onGallery, onCamera, onRemove, onClose }) {
  const items = [["Choose from gallery", onGallery, false], ["Take a photo", onCamera, false], hasPhoto ? ["Remove photo", onRemove, true] : null].filter(Boolean);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#161B22", borderRadius: "18px 18px 0 0", padding: "14px 16px 22px" }}>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: "#F5F7FA", textAlign: "center", marginBottom: 2 }}>Profile photo</div>
        <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", textAlign: "center", marginBottom: 12 }}>JPG or PNG</div>
        {items.map(([label, fn, danger]) => (
          <button key={label} onClick={() => { onClose(); fn(); }} style={{ display: "block", width: "100%", padding: "14px", marginBottom: 8, borderRadius: 12, border: "none", background: "#1E2530", color: danger ? "#FF6B5D" : "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{label}</button>
        ))}
        <button onClick={onClose} style={{ display: "block", width: "100%", padding: "12px", border: "none", background: "none", color: "#8891A0", fontFamily: "Inter", fontSize: 14, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function CameraBadge({ onClick, busy }) {
  return (
    <button onClick={onClick} disabled={busy} aria-label="Change profile photo" style={{
      position: "absolute", bottom: 2, right: 2, width: 34, height: 34, borderRadius: "50%",
      background: "#35D0BA", border: "2px solid #0E1116", display: "flex", alignItems: "center",
      justifyContent: "center", cursor: busy ? "default" : "pointer", padding: 0, opacity: busy ? 0.6 : 1,
    }}>
      <Camera size={16} color="#0E1116" />
    </button>
  );
}

function TabBar({ active, setActive }) {
  const tabs = [
    { id: "chats", icon: MessageCircle, label: "Chats" },
    { id: "calls", icon: PhoneCall, label: "Calls" },
    { id: "status", icon: Radio, label: "Status" },
    { id: "market", icon: ShoppingBag, label: "Market" },
    { id: "tools", icon: Grid3x3, label: "Tools" },
  ];
  return (
    <div style={{ display: "flex", borderTop: "1px solid #262E3A", background: "#161B22", paddingBottom: 6, paddingTop: 8, flexShrink: 0 }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4, cursor: "pointer", color: isActive ? "#35D0BA" : "#5B6673", padding: "4px 0",
          }}>
            <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            <span style={{ fontSize: 11, fontFamily: "Inter", fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 14px", gap: 14, flexShrink: 0, background: "#0E1116" }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} />
        </button>
      )}
      <div style={{ flex: 1, fontFamily: "Sora", fontWeight: 700, fontSize: 24, color: "#F5F7FA" }}>{title}</div>
      {right}
    </div>
  );
}

function Banner({ text, tone = "error", onClose }) {
  const colors = tone === "error" ? { bg: "#FF6B5D18", border: "#FF6B5D55", fg: "#FF6B5D" } : { bg: "#35D0BA18", border: "#35D0BA55", fg: "#35D0BA" };
  return (
    <div style={{
      margin: "0 16px 10px", padding: "10px 12px", borderRadius: 10, background: colors.bg,
      border: `1px solid ${colors.border}`, color: colors.fg, fontFamily: "Inter", fontSize: 13,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{text}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", color: colors.fg, cursor: "pointer", padding: 0 }}><X size={15} /></button>}
    </div>
  );
}

// ---- New chat modal: look up a phone number and start / open a conversation ----
// ---- phonebook: find which of the person's contacts are on Letschat Africa ----
function toIntl(raw) { // digits with country code, using the country picked at login for local numbers
  const t = String(raw || "").trim();
  const d = t.replace(/\D/g, "");
  if (t.startsWith("+")) return d;
  if (d.startsWith("00")) return d.slice(2);
  let dial = "234";
  try { const c = COUNTRIES.find((x) => x[0] === (localStorage.getItem("lc-country") || "NG")); if (c) dial = c[2]; } catch (e) {}
  if (d.startsWith("0")) return dial + d.slice(1);
  if (d.startsWith(dial) && d.length >= dial.length + 8) return d;
  return dial + d;
}
function parseVcf(text) {
  const out = [];
  for (const card of String(text).split(/BEGIN:VCARD/i).slice(1)) {
    const fn = /^FN[^:\r\n]*:(.+)$/im.exec(card);
    const name = fn ? fn[1].trim() : "";
    const re = /^TEL[^:\r\n]*:(.+)$/gim; let m;
    while ((m = re.exec(card))) out.push({ name, tel: m[1].trim() });
  }
  return out;
}
const canPickContacts = () => typeof navigator !== "undefined" && !!(navigator.contacts && navigator.contacts.select);
const initialsOf = (n) => (String(n).trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");

function PhonebookView({ token, onBack, onStarted }) {
  const [book, setBook] = useState(() => loadJSON("phonebook", [])); // [{ name, phone }] kept on this device only
  const [matches, setMatches] = useState({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const vcfRef = useRef(null);

  const sync = async (entries) => {
    if (!entries.length) { setMatches({}); return; }
    setBusy(true); setError("");
    try {
      const d = await api("/api/v1/users/match", { method: "POST", token, body: { phones: entries.map((e) => e.phone) } });
      setMatches(d.matches || {});
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { sync(book); }, []);

  const addEntries = (raw) => { // raw: [{ name, tel }]
    const seen = new Set(); const next = [];
    for (const r of raw.concat(book.map((b) => ({ name: b.name, tel: "+" + b.phone })))) {
      const phone = toIntl(r.tel);
      if (phone.length < 8 || phone.length > 15 || seen.has(phone)) continue;
      seen.add(phone); next.push({ name: r.name || "+" + phone, phone });
    }
    setBook(next); saveJSON("phonebook", next); sync(next);
  };
  const pick = async () => {
    try {
      const picked = await navigator.contacts.select(["name", "tel"], { multiple: true });
      const raw = [];
      for (const c of picked) for (const t of c.tel || []) raw.push({ name: (c.name && c.name[0]) || "", tel: t });
      if (!raw.length) return;
      addEntries(raw);
    } catch (e) { setError("Could not open your contacts. Allow contacts access and try again."); }
  };
  const onVcf = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    const raw = parseVcf(await f.text());
    if (!raw.length) return setError("No phone numbers found in that file");
    addEntries(raw);
  };
  const clearBook = () => { setBook([]); setMatches({}); clearJSON("phonebook"); };
  const start = async (u) => {
    setBusy(true); setError("");
    try { const { conversation } = await api("/api/v1/conversations", { method: "POST", token, body: { phone: u.phone } }); onStarted(conversation); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  const invite = (e) => {
    const link = window.location.origin + window.location.pathname;
    const msg = link + "\n\nHey " + (e.name.split(" ")[0] || "there") + ", I'm on Letschat Africa. Join me here!";
    window.open("https://wa.me/" + e.phone + "?text=" + encodeURIComponent(msg), "_blank");
  };

  const needle = q.trim().toLowerCase(); const needleDigits = q.replace(/\D/g, "");
  const shown = book.filter((e) => !needle || e.name.toLowerCase().includes(needle) || (needleDigits && e.phone.includes(needleDigits)));
  const onApp = shown.filter((e) => matches[e.phone]);
  const notOn = shown.filter((e) => !matches[e.phone]);

  return (
    <div style={{ ...card, height: "88%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0, display: "flex" }}><ArrowLeft size={22} /></button>
        <div style={{ flex: 1, fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA" }}>From your phonebook</div>
        {book.length > 0 && <button onClick={clearBook} style={{ ...smallBtn, color: "#FF6B5D" }}>Remove</button>}
      </div>
      {error && <Banner text={error} onClose={() => setError("")} />}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {canPickContacts() && <button onClick={pick} style={{ ...primaryBtn(false), flex: 1, padding: 11, fontSize: 14 }}>{book.length ? "Add more contacts" : "Choose contacts"}</button>}
        <button onClick={() => vcfRef.current && vcfRef.current.click()} style={{ ...(canPickContacts() ? smallBtn : { ...primaryBtn(false), flex: 1, padding: 11, fontSize: 14 }) }}>Import .vcf</button>
        <input ref={vcfRef} type="file" accept=".vcf,text/vcard,text/x-vcard" onChange={onVcf} style={{ display: "none" }} />
      </div>
      {!canPickContacts() && <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginBottom: 10 }}>This browser cannot open your phonebook directly. Export your contacts as a .vcf file from your Contacts app and import it here.</div>}
      {book.length > 0 && (
        <div style={{ ...inputBox, marginBottom: 6 }}>
          <Search size={17} color="#8891A0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" style={inputEl} />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {busy && <div style={{ color: "#5B6673", fontFamily: "Inter", fontSize: 13, padding: "10px 0" }}>Checking who is on Letschat Africa…</div>}
        {!book.length && !busy && <div style={{ color: "#5B6673", fontFamily: "Inter", fontSize: 13, textAlign: "center", padding: "30px 10px" }}>Pick the contacts you want to check. Only the numbers you choose are sent, and your list stays on this device.</div>}
        {onApp.length > 0 && <div style={sectionTitle}>On Letschat Africa · {onApp.length}</div>}
        {onApp.map((e) => {
          const u = matches[e.phone];
          return <PersonRow key={e.phone} u={{ ...u, name: e.name }} status={u.name && u.name !== e.name ? u.name : "+" + e.phone} onClick={() => start(u)} right={<span style={{ ...smallBtn, padding: "5px 10px" }}>Chat</span>} />;
        })}
        {notOn.length > 0 && <div style={sectionTitle}>Invite · {notOn.length}</div>}
        {notOn.slice(0, 200).map((e) => (
          <PersonRow key={e.phone} u={{ name: e.name, initials: initialsOf(e.name), color: "#5B6673", avatar: null }} status={"+" + e.phone}
            right={<button onClick={() => invite(e)} style={{ ...smallBtn, color: "#F2B84B" }}>Invite</button>} />
        ))}
        {book.length > 0 && !shown.length && <div style={{ color: "#5B6673", fontFamily: "Inter", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No contacts match your search</div>}
      </div>
    </div>
  );
}

function NewChatModal({ token, onClose, onStarted }) {
  const [view, setView] = useState("main");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (!phone.trim()) return;
    setBusy(true); setError("");
    try {
      const { conversation } = await api("/api/v1/conversations", { method: "POST", token, body: { phone } });
      onStarted(conversation);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (view === "book") return (
    <div style={sheet} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", display: "flex", alignItems: "flex-end", height: "100%" }}>
        <PhonebookView token={token} onBack={() => setView("main")} onStarted={onStarted} />
      </div>
    </div>
  );

  return (
    <div style={{
      position: "absolute", inset: 0, background: "#000000B0", display: "flex",
      alignItems: "flex-end", zIndex: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", background: "#161B22", borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: "20px 20px 28px", borderTop: "1px solid #262E3A",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#262E3A", margin: "0 auto 18px" }} />
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", marginBottom: 6 }}>Start a new chat</div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0", marginBottom: 16 }}>
          Enter the phone number (with country code) or Google email of the person you want to message. They need to have signed in to Letschat Africa at least once.
        </div>
        {error && <Banner text={error} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid #262E3A", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <input value={phone} onChange={e => { const v = e.target.value.trim(); setPhone(v.includes("@") || /[a-zA-Z]/.test(v) ? v : v.replace(/\D/g, "")); }}
            placeholder="Phone (234801234567) or email" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 15 }} />
        </div>
        <button onClick={start} disabled={busy || !phone.trim()} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer",
          background: "#35D0BA", color: "#0E1116", fontFamily: "Sora", fontWeight: 700, fontSize: 15, opacity: busy ? 0.7 : 1,
        }}>{busy ? "Looking up…" : "Start chat"}</button>
        <button onClick={() => setView("book")} style={{
          width: "100%", marginTop: 10, padding: "12px", borderRadius: 12, border: "1px solid #2B3544", cursor: "pointer",
          background: "#1E2530", color: "#35D0BA", fontFamily: "Sora", fontWeight: 600, fontSize: 14,
        }}>Find friends from my phonebook</button>
      </div>
    </div>
  );
}

// ---- group chats ----
const GROUP_COLOR = "#8B7CF6";
const normalizeConvo = (c, myId) => ({
  ...c, myId,
  ...(c.isGroup ? { other: { id: c.id, name: c.name, initials: c.name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "G", color: GROUP_COLOR, avatar: c.avatar || null } } : {}),
});
const statusText = (online, ts) => (online ? "online" : ts ? "last seen " + timeLabel(ts) : "offline");
const senderPrefix = (c) => {
  const m = c.lastMessage;
  if (!m) return "";
  if (m.senderId === c.myId) return "You: ";
  const who = c.isGroup && c.members.find(x => x.id === m.senderId);
  return who ? who.name.split(" ")[0] + ": " : "";
};
const sheet = { position: "absolute", inset: 0, background: "#000000B0", display: "flex", alignItems: "flex-end", zIndex: 20 };
const card = { width: "100%", background: "#161B22", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px 28px", borderTop: "1px solid #262E3A", maxHeight: "88%", display: "flex", flexDirection: "column" };
const inputBox = { display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid #262E3A", borderRadius: 12, padding: "12px 14px", marginBottom: 14 };
const inputEl = { flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 15 };
const primaryBtn = (busy) => ({ width: "100%", padding: 13, borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer", background: "#35D0BA", color: "#0E1116", fontFamily: "Sora", fontWeight: 700, fontSize: 15, opacity: busy ? 0.7 : 1 });
const smallBtn = { background: "#1E2530", border: "1px solid #262E3A", color: "#35D0BA", borderRadius: 10, padding: "7px 12px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer", flexShrink: 0 };
const sectionTitle = { fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "#8891A0", textTransform: "uppercase", letterSpacing: 0.6, margin: "18px 0 6px" };

function VerifiedBadge({ size = 15 }) {
    return (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", role: "img", "aria-label": "Verified", style: { flexShrink: 0, marginLeft: 4, verticalAlign: "middle", display: "inline-block" } },
        React.createElement("circle", { cx: 12, cy: 12, r: 11, fill: "#1D9BF0" }),
        React.createElement("path", { d: "M7.5 12.4l3 3 6-6.4", fill: "none", stroke: "#fff", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" })));
}
function PersonRow({ u, online, status, right, onClick }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", cursor: onClick ? "pointer" : "default" }}>
      <Ring size={40} color={u.color} initials={u.initials} photo={u.avatar} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 14.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}{u.verified && <VerifiedBadge />}</div>
        <div style={{ fontFamily: "Inter", fontSize: 12, color: online ? "#35D0BA" : "#5B6673" }}>{status}</div>
      </div>
      {right}
    </div>
  );
}

function NewGroupModal({ token, contacts, presence, lastSeen, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (id) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const create = async () => {
    if (!name.trim()) return setError("Give the group a name");
    setBusy(true); setError("");
    try {
      const { conversation } = await api("/api/v1/conversations/group", { method: "POST", token, body: { name: name.trim(), memberIds: picked } });
      onCreated(conversation);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  const sorted = [...contacts].sort((a, b) => !!presence[b.id] - !!presence[a.id]);
  return (
    <div style={sheet} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", marginBottom: 12 }}>New group</div>
        {error && <Banner text={error} />}
        <div style={inputBox}><input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Group name" style={inputEl} /></div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginBottom: 4 }}>Add people from your contacts, or skip and share the group link after.</div>
        <div style={{ overflowY: "auto", flex: 1, marginBottom: 14, minHeight: 60 }}>
          {sorted.length === 0 && <div style={{ padding: "16px 0", fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>No contacts yet. You can still create the group and invite people with its link.</div>}
          {sorted.map(u => {
            const on = picked.includes(u.id);
            return (
              <PersonRow key={u.id} u={u} online={!!presence[u.id]} status={statusText(!!presence[u.id], lastSeen[u.id])} onClick={() => toggle(u.id)}
                right={<div style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid " + (on ? "#35D0BA" : "#262E3A"), background: on ? "#35D0BA" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Check size={14} color="#0E1116" strokeWidth={3} />}</div>} />
            );
          })}
        </div>
        <button onClick={create} disabled={busy} style={primaryBtn(busy)}>{busy ? "Creating…" : "Create group" + (picked.length ? " (" + (picked.length + 1) + ")" : "")}</button>
      </div>
    </div>
  );
}

function GroupInfoScreen({ conversation: c, myId, token, contacts, presence, lastSeen, onBack, onChanged }) {
  const isAdmin = c.adminId === myId;
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [profile, setProfile] = useState(null);
  const [desc, setDesc] = useState(c.description || "");
  const link = c.inviteCode ? window.location.origin + window.location.pathname + "?join=" + c.inviteCode : "";
  const memberIds = c.members.map(m => m.id);
  const addable = contacts.filter(u => !memberIds.includes(u.id));
  const call = async (key, path, body, method = "POST") => {
    setBusy(key); setError("");
    try {
      const { conversation } = await api("/api/v1/conversations/" + c.id + "/" + path, { method, token, body });
      onChanged(conversation);
      return true;
    } catch (e) { setError(e.message); return false; } finally { setBusy(""); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch (e) { window.prompt("Copy this group link", link); }
  };
  const share = () => (navigator.share ? navigator.share({ title: c.name, text: "Join \"" + c.name + "\" on Letschat Africa", url: link }).catch(() => {}) : copy());
  const pickPhoto = async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!isJpgOrPng(f)) return setError("Group photo must be a JPG or PNG image");
    try { call("photo", "", { avatar: await resizeImageToDataURL(f, 512) }, "PATCH"); } catch (err) { setError(err.message); }
  };
  const saveDesc = () => call("desc", "", { description: desc }, "PATCH");
  const addByPhone = async () => { if (phone.trim() && await call("phone", "members", { phone: phone.trim() })) setPhone(""); };
  const members = [...c.members].sort((a, b) => (b.id === c.adminId) - (a.id === c.adminId));
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0E1116", zIndex: 20, display: "flex", flexDirection: "column" }}>
      <TopBar title="Group info" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ display: "inline-block", position: "relative" }}>
            <Ring size={84} color={GROUP_COLOR} initials={c.other.initials} photo={c.avatar} onClick={c.avatar ? () => setZoom(true) : undefined} />
            {isAdmin && <label style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, background: "#35D0BA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Camera size={14} color="#0E1116" /><input type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={pickPhoto} /></label>}
          </div>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 20, color: "#F5F7FA", marginTop: 10 }}>{c.name}</div>
          <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0" }}>Group · {c.members.length} members</div>
        </div>
        {error && <div style={{ marginTop: 12 }}><Banner text={error} onClose={() => setError("")} /></div>}
        {isAdmin ? (
          <>
            <div style={sectionTitle}>Description</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ ...inputBox, marginBottom: 0, flex: 1, padding: "9px 12px" }}>
                <textarea value={desc} maxLength={300} rows={3} onChange={e => setDesc(e.target.value)} placeholder="What is this group about?" style={{ ...inputEl, fontFamily: "Inter", fontWeight: 400, fontSize: 13.5, resize: "none" }} />
              </div>
              <button onClick={saveDesc} disabled={busy === "desc" || desc === (c.description || "")} style={smallBtn}>{busy === "desc" ? "…" : "Save"}</button>
            </div>
          </>
        ) : c.description ? <div style={{ marginTop: 12, fontFamily: "Inter", fontSize: 13.5, color: "#9BA7B4", textAlign: "center", whiteSpace: "pre-wrap" }}>{c.description}</div> : null}

        {isAdmin ? (
          <>
            <div style={sectionTitle}>Invite link</div>
            <div style={{ ...inputBox, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0, fontFamily: "Inter", fontSize: 12.5, color: "#9BA7B4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copy} style={smallBtn}>{copied ? "Copied ✓" : "Copy link"}</button>
              <button onClick={share} style={smallBtn}>Share link</button>
              <button onClick={() => window.confirm("Reset the link? The old link will stop working.") && call("reset", "invite/reset", {})} disabled={busy === "reset"} style={{ ...smallBtn, color: "#FF6B5D" }}>Reset</button>
            </div>
            <div style={sectionTitle}>Add people</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <div style={{ ...inputBox, marginBottom: 0, flex: 1, padding: "9px 12px" }}>
                <input value={phone} onChange={e => { const v = e.target.value.trim(); setPhone(v.includes("@") || /[a-zA-Z]/.test(v) ? v : v.replace(/\D/g, "")); }} placeholder="Phone (234801234567) or email" style={{ ...inputEl, fontSize: 13.5 }} />
              </div>
              <button onClick={addByPhone} disabled={busy === "phone" || !phone.trim()} style={smallBtn}>{busy === "phone" ? "…" : "Add"}</button>
            </div>
            {addable.map(u => (
              <PersonRow key={u.id} u={u} online={!!presence[u.id]} status={statusText(!!presence[u.id], lastSeen[u.id])}
                right={<button onClick={() => call(u.id, "members", { userIds: [u.id] })} disabled={busy === u.id} style={smallBtn}>{busy === u.id ? "…" : "Add"}</button>} />
            ))}
            {addable.length === 0 && <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#5B6673" }}>All your contacts are already in this group.</div>}
          </>
        ) : (
          <div style={{ marginTop: 14, fontFamily: "Inter", fontSize: 12.5, color: "#5B6673", textAlign: "center" }}>Only the group admin can add people or share the invite link.</div>
        )}

        {isAdmin && c.dmRequests.length > 0 && (
          <>
            <div style={sectionTitle}>Private chat requests</div>
            {c.dmRequests.map(r => {
              const f = c.members.find(m => m.id === r.from), t = c.members.find(m => m.id === r.to);
              return (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontFamily: "Inter", fontSize: 13.5, color: "#F5F7FA" }}>
                  <div style={{ flex: 1 }}>{f ? f.name : "?"} <span style={{ color: "#5B6673" }}>wants to chat with</span> {t ? t.name : "?"}</div>
                  <button onClick={() => call(r.id, "dm-requests/" + r.id, { approve: true })} style={smallBtn}>Approve</button>
                  <button onClick={() => call(r.id, "dm-requests/" + r.id, { approve: false })} style={{ ...smallBtn, color: "#FF6B5D" }}>Decline</button>
                </div>
              );
            })}
          </>
        )}
        <div style={sectionTitle}>Members ({c.members.length})</div>
        {members.map(m => {
          const online = m.id === myId || !!presence[m.id];
          return (
            <PersonRow key={m.id} u={m} online={online} onClick={() => setProfile(m)} status={m.id === myId ? "You" : statusText(online, lastSeen[m.id]) + (isAdmin ? [m.phone && " · +" + m.phone, m.email && " · " + m.email].filter(Boolean).join("") : "")}
              right={m.id === c.adminId ? <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "#35D0BA", border: "1px solid #35D0BA55", background: "#35D0BA18", borderRadius: 8, padding: "2px 8px" }}>Admin</span> : null} />
          );
        })}
      </div>
      {profile && <MemberProfileSheet m={profile} c={c} myId={myId} isAdmin={isAdmin} presence={presence} lastSeen={lastSeen} call={call} onClose={() => setProfile(null)} />}
      {zoom && <ImageZoomModal photo={c.avatar} initials={c.other.initials} color={GROUP_COLOR} onClose={() => setZoom(false)} />}
    </div>
  );
}

function MemberProfileSheet({ m, c, myId, isAdmin, presence, lastSeen, call, onClose }) {
  const [zoom, setZoom] = useState(false);
  const [sent, setSent] = useState(false);
  const mine = m.id === myId;
  const online = mine || !!presence[m.id];
  const rq = (c.dmRequests || []).filter(r => r.from === myId && r.to === m.id).slice(-1)[0];
  const direct = isAdmin || c.adminId === m.id; // admin chats need no approval
  const done = (sent && !rq) || (rq && (rq.status === "pending" || rq.status === "approved"));
  const label = sent && !rq ? "Chat added to your Chats ✓" : rq && rq.status === "pending" ? "Request sent, waiting for the admin" : rq && rq.status === "approved" ? "Approved: it's in your Chats" : rq && rq.status === "declined" ? "Declined. Ask again" : direct ? "Message privately" : "Request private chat";
  return (
    <div style={{ ...sheet, zIndex: 30 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, alignItems: "center", textAlign: "center" }}>
        <Ring size={110} color={m.color} initials={m.initials} photo={m.avatar} online={online} onClick={m.avatar ? () => setZoom(true) : undefined} />
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 19, color: "#F5F7FA", marginTop: 12 }}>{m.name}{mine ? " (you)" : ""}</div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: online ? "#35D0BA" : "#5B6673", marginBottom: 8 }}>{mine ? "online" : statusText(online, lastSeen[m.id])}</div>
        {m.about && <div style={{ fontFamily: "Inter", fontSize: 14, color: "#9BA7B4", marginBottom: 10 }}>{m.about}</div>}
        {isAdmin && (m.phone || m.email) && <div style={{ fontFamily: "Inter", fontSize: 13, color: "#F5F7FA", marginBottom: 10 }}>{m.phone && <div>+{m.phone}</div>}{m.email && <div>{m.email}</div>}</div>}
        {!mine && <button onClick={async () => { if (await call(m.id, "dm-requests", { toId: m.id })) setSent(true); }} disabled={!!done} style={{ ...primaryBtn(!!done), marginTop: 6 }}>{label}</button>}
        {zoom && <ImageZoomModal photo={m.avatar} initials={m.initials} color={m.color} onClose={() => setZoom(false)} />}
      </div>
    </div>
  );
}

function JoinGroupModal({ code, token, onClose, onJoined }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/v1/groups/invite/" + encodeURIComponent(code), { token }).then(setInfo).catch(e => setError(e.message));
  }, [code]);
  const join = async () => {
    setBusy(true); setError("");
    try { const { conversation } = await api("/api/v1/groups/join", { method: "POST", token, body: { code } }); onJoined(conversation); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div style={sheet} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", marginBottom: 6 }}>Join group</div>
        {info && <div style={{ fontFamily: "Inter", fontSize: 14, color: "#9BA7B4", marginBottom: 16 }}>You were invited to <b style={{ color: "#F5F7FA" }}>{info.name}</b> · {info.memberCount} members</div>}
        {!info && !error && <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673", marginBottom: 16 }}>Checking invite link…</div>}
        {error && <Banner text={error} />}
        {info && <button onClick={join} disabled={busy} style={primaryBtn(busy)}>{busy ? "Joining…" : info.joined ? "Open group" : "Join group"}</button>}
        <button onClick={onClose} style={{ ...primaryBtn(false), background: "none", color: "#8891A0", marginTop: 6 }}>{info ? "Not now" : "Close"}</button>
      </div>
    </div>
  );
}

function ChatsScreen({ token, profile, conversations, loading, error, onOpenChat, onProfile, onNewChat, onNewGroup, presence, favorites = [] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title={<span>Lets<span style={{ color: "#35D0BA" }}>chat</span></span>}
        right={
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div onClick={onNewGroup} title="New group" style={{ cursor: "pointer", display: "flex" }}><Users size={21} color="#9BA7B4" /></div>
            <Search size={20} color="#9BA7B4" />
            <div onClick={onProfile} style={{ cursor: "pointer" }}>
              <Ring size={30} color="#35D0BA" initials={profile.initials} photo={profile.avatar} online />
            </div>
          </div>
        }
      />
      {error && <Banner text={error} />}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: 30, textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>Loading chats…</div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: "50px 30px", textAlign: "center" }}>
            <MessageCircle size={34} color="#262E3A" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#8891A0", marginBottom: 6 }}>No chats yet</div>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>Tap the pencil to message someone by their phone number.</div>
          </div>
        )}
        {conversations.map(c => (
          <div key={c.id} onClick={() => onOpenChat(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", cursor: "pointer" }}>
            <Ring size={52} color={c.other.color} initials={c.other.initials} photo={c.other.avatar} online={c.isGroup ? undefined : !!presence[c.other.id]} />
            <div style={{ flex: 1, minWidth: 0, borderBottom: "1px solid #1B212B", paddingBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 16, color: "#F5F7FA", display: "flex", alignItems: "center", gap: 6 }}>{c.other.name}{c.other.verified && <VerifiedBadge />}{favorites.includes(c.id) && <Star size={13} color="#F2B84B" style={{ fill: "#F2B84B" }} />}</span>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: c.unread ? "#35D0BA" : "#5B6673" }}>{c.lastMessage ? timeLabel(c.lastMessage.time) : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Inter", fontSize: 13.5, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                  {c.lastMessage ? senderPrefix(c) + c.lastMessage.text : "Say hello 👋"}
                </span>
                {c.unread > 0 && (
                  <span style={{ background: "#35D0BA", color: "#0E1116", fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter", padding: "0 5px" }}>{c.unread}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNewChat} style={{
        position: "absolute", bottom: 78, right: 20, width: 54, height: 54, borderRadius: 27,
        background: "#35D0BA", border: "none", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 20px #35D0BA44", cursor: "pointer",
      }}>
        <Edit3 size={22} color="#0E1116" />
      </button>
    </div>
  );
}

function PostProductModal({ token, onClose, onPosted }) {
  const [f, setF] = useState({ title: "", price: "", description: "" });
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pick = async (e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (!isJpgOrPng(file)) return setError("Photo must be a JPG or PNG image");
    try { setPhoto(await resizeImageToDataURL(file, 640)); setError(""); } catch (err) { setError(err.message); }
  };
  const post = async () => {
    setBusy(true); setError("");
    try { await api("/api/v1/market", { method: "POST", token, body: { ...f, photo } }); onPosted(); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div style={sheet} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", marginBottom: 6 }}>Post a product</div>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginBottom: 12 }}>Posts are removed automatically after 24 hours.</div>
        {error && <Banner text={error} />}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <label style={{ ...inputBox, cursor: "pointer", justifyContent: "center", color: "#35D0BA", fontFamily: "Inter", fontSize: 13.5, fontWeight: 600 }}>
            {photo ? <img src={photo} alt="" style={{ width: 90, height: 90, borderRadius: 10, objectFit: "cover" }} /> : <><Camera size={18} /> Add a photo</>}
            <input type="file" accept={PHOTO_ACCEPT} style={{ display: "none" }} onChange={pick} />
          </label>
          <div style={inputBox}><input value={f.title} maxLength={80} onChange={set("title")} placeholder="Product name" style={inputEl} /></div>
          <div style={inputBox}><input value={f.price} maxLength={30} onChange={set("price")} placeholder="Price (e.g. ₦5,000)" style={inputEl} /></div>
          <div style={inputBox}><textarea value={f.description} maxLength={1000} rows={4} onChange={set("description")} placeholder="Describe it: condition, size, location…" style={{ ...inputEl, fontFamily: "Inter", fontWeight: 400, fontSize: 14, resize: "none" }} /></div>
        </div>
        <button onClick={post} disabled={busy || !f.title.trim() || !f.price.trim()} style={primaryBtn(busy)}>{busy ? "Posting…" : "Post"}</button>
      </div>
    </div>
  );
}

// ---- market: seller ratings + product comments with emoji ----
const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤩", "😢", "😭", "😡", "😮", "🤔", "🙄", "😴", "😅", "🤗", "🤝", "👍", "👎", "👏", "🙏", "💪", "🙌", "👌", "❤️", "💔", "🔥", "✨", "🎉", "💯", "✅", "❌", "⭐", "🛍️", "💰", "📦", "🚚", "🏷️"];
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s)+$/u;
const ratingText = (r) => (r && r.count ? "\u2605 " + r.avg.toFixed(1) + " (" + r.count + ")" : "No ratings yet");
function StarRow({ value, onChange, size = 28 }) {
    return (React.createElement("div", { style: { display: "flex", gap: 6 } }, [1, 2, 3, 4, 5].map(n => (React.createElement("button", { key: n, "aria-label": n + (n === 1 ? " star" : " stars"), onClick: onChange ? () => onChange(n) : undefined, style: { background: "none", border: "none", padding: 0, cursor: onChange ? "pointer" : "default", display: "flex" } },
        React.createElement(Star, { size: size, color: n <= value ? "#F2B84B" : "#3A4452", style: { fill: n <= value ? "#F2B84B" : "none" } }))))));
}
function SheetFrame({ title, onClose, tall, children }) {
    return (React.createElement("div", { onClick: onClose, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" } },
        React.createElement("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 640, height: tall ? "82%" : "auto", maxHeight: "88%", background: "#12161C", borderTop: "1px solid #262E3A", borderTopLeftRadius: 20, borderTopRightRadius: 20, display: "flex", flexDirection: "column" } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", padding: "16px 16px 10px", flexShrink: 0 } },
                React.createElement("div", { style: { flex: 1, fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA" } }, title),
                React.createElement("button", { onClick: onClose, "aria-label": "Close", style: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 } },
                    React.createElement(X, { size: 22, color: "#8891A0" }))),
            children)));
}
function RateSellerSheet({ seller, token, onClose, onDone }) {
    const [info, setInfo] = useState(null);
    const [pick, setPick] = useState(0);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    useEffect(() => {
        api("/api/v1/market/seller/" + seller.id + "/rating", { token }).then(d => { setInfo(d); setPick(d.mine || 0); }).catch(e => setErr(e.message));
    }, [seller.id, token]);
    const submit = async () => {
        if (!pick) return;
        setBusy(true);
        try {
            await api("/api/v1/market/seller/" + seller.id + "/rate", { method: "POST", token, body: { stars: pick } });
            onDone();
        }
        catch (e) {
            setErr(e.message);
            setBusy(false);
        }
    };
    return (React.createElement(SheetFrame, { title: "Rate " + seller.name, onClose: onClose },
        React.createElement("div", { style: { padding: "6px 16px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 } },
            React.createElement("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#8891A0", textAlign: "center" } }, info ? ratingText(info) + (info.mine ? " \u00B7 you rated " + info.mine : "") : "Loading\u2026"),
            React.createElement(StarRow, { value: pick, onChange: setPick, size: 38 }),
            err && React.createElement("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#FF6B5D", textAlign: "center" } }, err),
            React.createElement("button", { onClick: submit, disabled: busy || !pick, style: { ...primaryBtn(busy || !pick), marginTop: 4 } }, busy ? "Saving\u2026" : info && info.mine ? "Update rating" : "Submit rating"))));
}
function CommentsSheet({ listing, token, onClose, onChanged }) {
    const [comments, setComments] = useState(null);
    const [text, setText] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const listRef = useRef(null);
    const base = "/api/v1/market/" + listing.id + "/comments";
    useEffect(() => { api(base, { token }).then(d => setComments(d.comments)).catch(e => setErr(e.message)); }, [base, token]);
    useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [comments && comments.length]);
    const send = async (t) => {
        const body = (t === undefined ? text : t).trim();
        if (!body || busy) return;
        setBusy(true);
        try {
            const d = await api(base, { method: "POST", token, body: { text: body } });
            setComments(d.comments);
            if (t === undefined) { setText(""); setShowEmoji(false); }
            setErr("");
            onChanged();
        }
        catch (e) { setErr(e.message); }
        setBusy(false);
    };
    const remove = async (id) => {
        try {
            const d = await api(base + "/" + id, { method: "DELETE", token });
            setComments(d.comments);
            onChanged();
        }
        catch (e) { setErr(e.message); }
    };
    return (React.createElement(SheetFrame, { title: "Comments" + (comments ? " \u00B7 " + comments.length : ""), onClose: onClose, tall: true },
        React.createElement("div", { ref: listRef, style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "0 16px" } },
            comments === null && !err && React.createElement("div", { style: { padding: 30, textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 } }, "Loading\u2026"),
            comments && comments.length === 0 && React.createElement("div", { style: { padding: 30, textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 } }, "No comments yet. Ask a question or say something nice."),
            (comments || []).map(c => (React.createElement("div", { key: c.id, style: { display: "flex", gap: 10, padding: "9px 0", borderBottom: "1px solid #1B212B" } },
                React.createElement(Ring, { size: 32, color: c.author ? c.author.color : "#5B6673", initials: c.author ? c.author.initials : "?", photo: c.author ? c.author.avatar : null }),
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
                        React.createElement("span", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 13.5, color: "#F5F7FA" } }, c.mine ? "You" : c.author ? c.author.name : "Former member", c.author && c.author.verified && React.createElement(VerifiedBadge, { size: 13 })),
                        React.createElement("span", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#5B6673" } }, timeLabel(c.time)),
                        c.canDelete && React.createElement("button", { onClick: () => window.confirm("Delete this comment?") && remove(c.id), style: { marginLeft: "auto", background: "none", border: "none", color: "#FF6B5D", fontFamily: "Inter", fontSize: 12, cursor: "pointer", padding: 0 } }, "Delete")),
                    React.createElement("div", { style: { fontFamily: "Inter", fontSize: EMOJI_ONLY.test(c.text) ? 28 : 14, color: "#C9D1DB", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 } }, c.text)))))),
        err && React.createElement("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#FF6B5D", padding: "6px 16px 0" } }, err),
        React.createElement("div", { style: { display: "flex", gap: 6, padding: "8px 16px 0", flexShrink: 0 } }, QUICK_EMOJIS.map(e => (React.createElement("button", { key: e, onClick: () => send(e), disabled: busy, "aria-label": "Send " + e, style: { flex: 1, background: "#1E2530", border: "1px solid #262E3A", borderRadius: 10, padding: "6px 0", fontSize: 20, cursor: "pointer" } }, e)))),
        showEmoji && React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 2, padding: "8px 12px 0", maxHeight: 130, overflowY: "auto", flexShrink: 0 } }, EMOJIS.map(e => (React.createElement("button", { key: e, onClick: () => setText(t => (t + e).slice(0, 500)), style: { background: "none", border: "none", fontSize: 24, padding: 5, cursor: "pointer" } }, e)))),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px 16px", flexShrink: 0 } },
            React.createElement("button", { onClick: () => setShowEmoji(v => !v), "aria-label": "Emoji", style: { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 } },
                React.createElement(Smile, { size: 24, color: showEmoji ? "#35D0BA" : "#8891A0" })),
            React.createElement("div", { style: { ...inputBox, marginBottom: 0, flex: 1, padding: "9px 12px" } },
                React.createElement("input", { value: text, maxLength: 500, onChange: e => setText(e.target.value), onKeyDown: e => { if (e.key === "Enter") send(); }, placeholder: "Add a comment\u2026", style: { ...inputEl, fontFamily: "Inter", fontWeight: 400, fontSize: 14 } })),
            React.createElement("button", { onClick: () => send(), disabled: busy || !text.trim(), "aria-label": "Send comment", style: { width: 42, height: 42, borderRadius: 21, border: "none", background: "#35D0BA", opacity: busy || !text.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 } },
                React.createElement(Send, { size: 19, color: "#0E1116" })))));
}
function MarketScreen({ token, myId, onMessageSeller }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null);
  const [ratingFor, setRatingFor] = useState(null);
  const load = useCallback(() => api("/api/v1/market?q=" + encodeURIComponent(q), { token }).then(d => { setItems(d.listings); setError(""); }).catch(e => setError(e.message)), [q, token]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const act = (id, path, method = "POST") => api("/api/v1/market/" + id + path, { method, token }).then(load).catch(e => setError(e.message));
  const note = { padding: "40px 20px", textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Market" />
      <div style={{ padding: "0 16px 10px" }}>
        <div style={{ ...inputBox, marginBottom: 0, padding: "9px 12px" }}>
          <Search size={17} color="#8891A0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" style={{ ...inputEl, fontFamily: "Inter", fontWeight: 400, fontSize: 14 }} />
        </div>
      </div>
      {error && <Banner text={error} onClose={() => setError("")} />}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 90px" }}>
        {items === null && !error && <div style={note}>Loading…</div>}
        {items && items.length === 0 && <div style={note}>Nothing here yet. Tap + to post the first product.</div>}
        {(items || []).map(l => {
          const mine = l.seller && l.seller.id === myId;
          return (
            <div key={l.id} style={{ background: "#161B22", border: "1px solid #262E3A", borderRadius: 16, marginBottom: 12, overflow: "hidden", opacity: l.sold ? 0.6 : 1 }}>
              {l.photo && <img src={photoSrc(l.photo)} alt="" onClick={() => setZoom(l)} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block", cursor: "pointer" }} />}
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: "#F5F7FA" }}>{l.title}</span>
                  <span style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: "#35D0BA", whiteSpace: "nowrap" }}>{l.sold ? "SOLD" : l.price}</span>
                </div>
                {l.description && <div style={{ fontFamily: "Inter", fontSize: 13.5, color: "#9BA7B4", margin: "6px 0 10px", whiteSpace: "pre-wrap" }}>{l.description}</div>}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, margin: l.description ? "0 0 10px" : "8px 0 10px" }}>
                  <button onClick={() => setCommentsFor(l)} style={smallBtn}>{"\u{1F4AC} Comments" + (l.commentCount ? " (" + l.commentCount + ")" : "")}</button>
                  {l.seller && <span style={{ fontFamily: "Inter", fontSize: 12.5, color: l.seller.rating && l.seller.rating.count ? "#F2B84B" : "#5B6673" }}>{ratingText(l.seller.rating)}</span>}
                  {!mine && l.seller && <button onClick={() => setRatingFor(l.seller)} style={smallBtn}>Rate seller</button>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: l.description ? 0 : 10 }}>
                  {l.seller && <Ring size={26} color={l.seller.color} initials={l.seller.initials} photo={l.seller.avatar} />}
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "Inter", fontSize: 12.5, color: "#8891A0" }}>{mine ? "You" : l.seller ? l.seller.name : "Unknown"}{l.seller && l.seller.verified && <VerifiedBadge size={13} />} · {timeLabel(l.time)}</span>
                  {mine ? (
                    <>
                      <button onClick={() => act(l.id, "/sold")} style={smallBtn}>{l.sold ? "Relist" : "Mark sold"}</button>
                      <button onClick={() => window.confirm("Remove this listing?") && act(l.id, "", "DELETE")} style={{ ...smallBtn, color: "#FF6B5D" }}>Remove</button>
                    </>
                  ) : l.seller && <button onClick={() => onMessageSeller(l.seller).catch(e => setError(e.message))} style={smallBtn}>Message seller</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setPosting(true)} style={{ position: "absolute", bottom: 78, right: 20, width: 54, height: 54, borderRadius: 27, background: "#35D0BA", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px #35D0BA44", cursor: "pointer" }}><Plus size={24} color="#0E1116" /></button>
      {posting && <PostProductModal token={token} onClose={() => setPosting(false)} onPosted={() => { setPosting(false); load(); }} />}
      {zoom && <ImageZoomModal photo={zoom.photo} initials="" color="#35D0BA" onClose={() => setZoom(null)} />}
      {commentsFor && <CommentsSheet listing={commentsFor} token={token} onClose={() => setCommentsFor(null)} onChanged={load} />}
      {ratingFor && <RateSellerSheet seller={ratingFor} token={token} onClose={() => setRatingFor(null)} onDone={() => { setRatingFor(null); load(); }} />}
    </div>
  );
}

function CallsScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Calls" />
      <div style={{ padding: "50px 30px", textAlign: "center" }}>
        <PhoneCall size={34} color="#262E3A" style={{ marginBottom: 12 }} />
        <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#8891A0", marginBottom: 6 }}>No calls yet</div>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>Voice &amp; video calling isn't wired up yet — chat works over the internet right now.</div>
      </div>
    </div>
  );
}

function StatusScreen({ profile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Status" />
      <div style={{ padding: "4px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
          <div style={{ position: "relative" }}>
            <Ring size={52} color="#35D0BA" initials={profile.initials} photo={profile.avatar} />
            <div style={{ position: "absolute", bottom: -1, right: -1, width: 19, height: 19, borderRadius: "50%", background: "#35D0BA", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0E1116" }}>
              <Plus size={12} color="#0E1116" />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15.5, color: "#F5F7FA" }}>My status</div>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0" }}>Not available yet — coming soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SUPPORT = {
  whatsapp: String((window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.SUPPORT_WHATSAPP) || "").replace(/\D/g, ""),
  email: String((window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.SUPPORT_EMAIL) || "").trim(),
};
const DEFAULT_SETTINGS = { favorites: [], privacy: { readReceipts: true, lastSeen: "everyone" }, blocked: [] };

function ToolsScreen({ onProfile, onOpen = () => {}, settings = DEFAULT_SETTINGS }) {
  const nFav = settings.favorites.length, nBlocked = settings.blocked.length;
  const items = [
    { icon: User, label: "Profile", sub: "Edit your details" },
    { icon: Star, label: "Favourites", sub: nFav ? nFav + (nFav === 1 ? " chat" : " chats") + " pinned for quick access" : "Quick access chats", view: "favs" },
    { icon: Users, label: "Communities", sub: "Manage your groups", view: "communities" },
    { icon: Bell, label: "Notifications", sub: "Sound & alerts", view: "notifs" },
    { icon: Lock, label: "Privacy", sub: nBlocked ? nBlocked + " blocked · read receipts, last seen" : "Blocked, read receipts", view: "privacy" },
    { icon: HelpCircle, label: "Help", sub: "FAQ, contact us", view: "help" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Tools" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.map(it => {
          const Icon = it.icon;
          return (
            <div key={it.label} onClick={it.label === "Profile" ? onProfile : it.view ? () => onOpen(it.view) : undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer", borderBottom: "1px solid #1B212B" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1E2530", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={19} color="#35D0BA" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" }}>{it.label}</div>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0" }}>{it.sub}</div>
              </div>
              <ChevronRight size={17} color="#5B6673" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} style={{ width: 46, height: 27, borderRadius: 14, border: "none", padding: 0, position: "relative", cursor: disabled ? "default" : "pointer", background: on ? "#35D0BA" : "#2B3544", transition: "background .15s", flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: "50%", background: "#F5F7FA", transition: "left .15s" }} />
    </button>
  );
}
const settingRow = { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderBottom: "1px solid #1B212B" };

function FavouritesScreen({ conversations, settings, presence, onBack, onOpenChat, onToggleFavorite }) {
  const favs = conversations.filter(c => settings.favorites.includes(c.id));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Favourites" onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {favs.length === 0 && (
          <div style={{ padding: "50px 30px", textAlign: "center" }}>
            <Star size={34} color="#262E3A" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#8891A0", marginBottom: 6 }}>No favourites yet</div>
            <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>Open a chat, tap the three dots at the top and choose “Add to favourites”. They will show up here for quick access.</div>
          </div>
        )}
        {favs.map(c => (
          <div key={c.id} onClick={() => onOpenChat(c)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid #1B212B" }}>
            <Ring size={46} color={c.other.color} initials={c.other.initials} photo={c.other.avatar} online={c.isGroup ? undefined : !!presence[c.other.id]} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.other.name}{c.other.verified && <VerifiedBadge />}</div>
              <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage ? senderPrefix(c) + c.lastMessage.text : "No messages yet"}</div>
            </div>
            {c.unread > 0 && <span style={{ background: "#35D0BA", color: "#0E1116", fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter" }}>{c.unread}</span>}
            <button aria-label="Remove from favourites" onClick={(e) => { e.stopPropagation(); onToggleFavorite(c.id); }} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex" }}><Star size={20} color="#F2B84B" style={{ fill: "#F2B84B" }} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacyScreen({ settings, onBack, onPrivacy, onBlock }) {
  const p = settings.privacy;
  const seg = (val, label) => (
    <button onClick={() => onPrivacy({ lastSeen: val })} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "Inter", fontWeight: 600, fontSize: 13, background: p.lastSeen === val ? "#35D0BA" : "transparent", color: p.lastSeen === val ? "#0E1116" : "#9BA7B4" }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Privacy" onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={settingRow}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" }}>Read receipts</div>
            <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginTop: 2 }}>If you turn this off, you won’t send or receive blue ticks. Voice notes and groups are covered too.</div>
          </div>
          <Toggle on={p.readReceipts} onChange={(v) => onPrivacy({ readReceipts: v })} />
        </div>
        <div style={{ ...settingRow, display: "block" }}>
          <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" }}>Last seen & online</div>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", margin: "2px 0 10px" }}>Choose who can see when you are online or were last active.</div>
          <div style={{ display: "flex", gap: 4, background: "#1E2530", borderRadius: 12, padding: 4 }}>{seg("everyone", "Everyone")}{seg("nobody", "Nobody")}</div>
        </div>
        <div style={{ ...sectionTitle, margin: "20px 16px 6px" }}>Blocked contacts · {settings.blocked.length}</div>
        {settings.blocked.length === 0 && <div style={{ padding: "6px 16px 24px", fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>You haven’t blocked anyone. To block someone, open their chat, tap the three dots and choose Block.</div>}
        <div style={{ padding: "0 16px 24px" }}>
          {settings.blocked.map(u => (
            <PersonRow key={u.id} u={u} status={u.phone ? "+" + String(u.phone).replace(/\D/g, "") : "Blocked"} right={<button onClick={() => onBlock(u.id, false)} style={smallBtn}>Unblock</button>} />
          ))}
        </div>
      </div>
    </div>
  );
}


// ---- notification preferences (kept on this device) + alerts for incoming messages ----
const DEFAULT_NOTIFS = { sound: true, vibrate: true, banner: true, preview: true, groups: true };
const getNotifs = () => ({ ...DEFAULT_NOTIFS, ...loadJSON("notifs", {}) });
let _audioCtx = null;
function playPing() {
    try {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) return;
        _audioCtx = _audioCtx || new A();
        const ctx = _audioCtx;
        if (ctx.state === "suspended") ctx.resume();
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(880, t);
        o.frequency.setValueAtTime(1175, t + 0.12);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.36);
    } catch { }
}
function alertIncoming(m, convo, viewingThis) {
    const n = getNotifs();
    if (convo && convo.isGroup && !n.groups) return;
    const hidden = document.hidden;
    if (viewingThis && !hidden) return;
    if (n.sound) playPing();
    if (n.vibrate) { try { navigator.vibrate && navigator.vibrate(200); } catch { } }
    if (n.banner && hidden && "Notification" in window && Notification.permission === "granted") {
        try {
            const title = convo ? convo.other.name : "Letschat Africa";
            const body = n.preview ? (m.text || "New message") : "New message";
            new Notification(title, { body, tag: "conv-" + m.conversationId });
        } catch { }
    }
}
function NotificationsScreen({ onBack }) {
    const [prefs, setPrefs] = useState(getNotifs);
    const [perm, setPerm] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
    const set = (patch) => { const next = { ...prefs, ...patch }; setPrefs(next); saveJSON("notifs", next); };
    const askBanner = async (v) => {
        if (!v) return set({ banner: false });
        if (!("Notification" in window)) { setPerm("unsupported"); return; }
        let p = Notification.permission;
        if (p === "default") { try { p = await Notification.requestPermission(); } catch { } }
        setPerm(p);
        set({ banner: p === "granted" });
    };
    const row = (title, sub, on, onChange, disabled) => (React.createElement("div", { style: settingRow },
        React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" } }, title),
            React.createElement("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginTop: 2 } }, sub)),
        React.createElement(Toggle, { on: on, onChange: onChange, disabled: disabled })));
    const bannerNote = perm === "unsupported" ? "Not supported in this browser." : perm === "denied" ? "Blocked in your browser settings. Allow notifications for this site to use this." : "Show an alert when a message arrives while the app is in the background.";
    return (React.createElement("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
        React.createElement(TopBar, { title: "Notifications", onBack: onBack }),
        React.createElement("div", { style: { flex: 1, minHeight: 0, overflowY: "auto" } },
            row("Message sound", "Play a tone when a new message arrives.", prefs.sound, (v) => { set({ sound: v }); if (v) playPing(); }),
            row("Vibration", "Vibrate on new messages (supported phones only).", prefs.vibrate, (v) => { set({ vibrate: v }); if (v) { try { navigator.vibrate && navigator.vibrate(200); } catch { } } }),
            row("Group messages", "Get alerts for messages in groups.", prefs.groups, (v) => set({ groups: v })),
            row("Background alerts", bannerNote, prefs.banner && perm === "granted", askBanner, perm === "unsupported" || perm === "denied"),
            row("Show message preview", "Include the message text in background alerts.", prefs.preview, (v) => set({ preview: v })),
            React.createElement("div", { style: { padding: "18px 16px" } },
                React.createElement("button", { onClick: playPing, style: smallBtn }, "Play test sound")))));
}
function CommunitiesScreen({ conversations, myId, presence, onBack, onOpenChat, onNewGroup }) {
    const groups = conversations.filter(c => c.isGroup);
    const mine = groups.filter(c => c.adminId === myId);
    const others = groups.filter(c => c.adminId !== myId);
    const rowFor = (c) => (React.createElement("div", { key: c.id, onClick: () => onOpenChat(c), style: { display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", cursor: "pointer", borderBottom: "1px solid #1B212B" } },
        React.createElement(Ring, { size: 46, color: c.other.color, initials: c.other.initials, photo: c.other.avatar }),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.other.name),
            React.createElement("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#8891A0" } }, (c.members ? c.members.length : 0) + " members \u00B7 " + (c.members ? c.members.filter(m => m.id === myId || presence[m.id]).length : 0) + " online")),
        c.adminId === myId && React.createElement("span", { style: { fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: "#35D0BA", border: "1px solid #35D0BA55", background: "#35D0BA18", borderRadius: 8, padding: "2px 8px" } }, "Admin"),
        c.unread > 0 && React.createElement("span", { style: { background: "#35D0BA", color: "#0E1116", fontSize: 11, fontWeight: 700, borderRadius: 10, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter" } }, c.unread)));
    return (React.createElement("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
        React.createElement(TopBar, { title: "Communities", onBack: onBack, right: React.createElement("button", { onClick: onNewGroup, style: smallBtn }, "New group") }),
        React.createElement("div", { style: { flex: 1, minHeight: 0, overflowY: "auto" } },
            groups.length === 0 && (React.createElement("div", { style: { padding: "50px 30px", textAlign: "center" } },
                React.createElement(Users, { size: 34, color: "#262E3A", style: { marginBottom: 12 } }),
                React.createElement("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#8891A0", marginBottom: 6 } }, "No groups yet"),
                React.createElement("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#5B6673" } }, "Tap \u201CNew group\u201D to create one, or open an invite link from a friend to join theirs."))),
            mine.length > 0 && React.createElement("div", { style: { ...sectionTitle, margin: "16px 16px 6px" } }, "Groups you manage \u00B7 " + mine.length),
            mine.map(rowFor),
            others.length > 0 && React.createElement("div", { style: { ...sectionTitle, margin: "16px 16px 6px" } }, "Groups you\u2019re in \u00B7 " + others.length),
            others.map(rowFor))));
}
const FAQ = [
  ["How do I start a chat?", "Tap the pencil button on the Chats tab. Type a phone number with country code or an email, or choose “Find friends from my phonebook” to see which of your contacts are already on Letschat Africa."],
  ["How do I invite a friend who isn’t on the app?", "In the phonebook list, tap Invite next to their name. WhatsApp opens with a message that has the app link, ready to send."],
  ["How do I send a photo, file or voice note?", "Use the paperclip for files (up to 3 MB), the camera to take a photo and the microphone to record. Tap the mic again, or the send button, to send the voice note."],
  ["How do I create a group?", "On the Chats tab tap the group icon at the top, pick your contacts and name the group. The admin can add members and share an invite link from Group info."],
  ["How do I share my profile link?", "Go to Tools → Profile → Profile link. Anyone who opens your link can start a direct message with you. Tap Reset to make the old link stop working."],
  ["How do favourites work?", "Open a chat, tap the three dots and choose Add to favourites. Find all of them in Tools → Favourites."],
  ["How do I block someone?", "Open their chat, tap the three dots and choose Block. They can no longer message you. You can unblock them in Tools → Privacy."],
  ["What do read receipts and last seen do?", "In Tools → Privacy you can switch off blue ticks and hide when you were last online. If you hide yours, you won’t see receipts from others either."],
  ["I changed my photo but it hasn’t updated.", "Pull the app fresh by closing and reopening it. New photos show for everyone after a moment."],
  ["Messages are slow or not sending.", "Check your internet connection. The server can take up to a minute to wake up after a quiet period, then everything speeds up."],
];

function HelpScreen({ onBack, user }) {
  const [open, setOpen] = useState(-1);
  const [copied, setCopied] = useState(false);
  const info = [
    "Letschat Africa support info",
    "User: " + (user && user.name) + " (" + (user && user.phone ? "+" + String(user.phone).replace(/\D/g, "") : "no phone") + ")",
    "App: " + window.location.origin,
    "Browser: " + navigator.userAgent,
    "Time: " + new Date().toISOString(),
  ].join("\n");
  const copyInfo = async () => { try { await navigator.clipboard.writeText(info); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} };
  const wa = () => window.open("https://wa.me/" + SUPPORT.whatsapp + "?text=" + encodeURIComponent("Hi Letschat Africa support, I need help with:\n\n\n" + info), "_blank");
  const mail = () => { window.location.href = "mailto:" + SUPPORT.email + "?subject=" + encodeURIComponent("Letschat Africa support") + "&body=" + encodeURIComponent("Hi, I need help with:\n\n\n" + info); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Help" onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 24 }}>
        <div style={{ ...sectionTitle, margin: "6px 16px" }}>Frequently asked questions</div>
        {FAQ.map(([q, ans], i) => (
          <div key={i} style={{ borderBottom: "1px solid #1B212B" }}>
            <div onClick={() => setOpen(open === i ? -1 : i)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ flex: 1, fontFamily: "Sora", fontWeight: 600, fontSize: 14.5, color: "#F5F7FA" }}>{q}</div>
              <ChevronRight size={17} color="#5B6673" style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </div>
            {open === i && <div style={{ padding: "0 16px 16px", fontFamily: "Inter", fontSize: 13.5, lineHeight: 1.5, color: "#9BA7B4" }}>{ans}</div>}
          </div>
        ))}
        <div style={{ ...sectionTitle, margin: "22px 16px 8px" }}>Contact us</div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {SUPPORT.whatsapp && <button onClick={wa} style={primaryBtn(false)}>Chat with support on WhatsApp</button>}
          {SUPPORT.email && <button onClick={mail} style={{ ...primaryBtn(false), background: "#1E2530", color: "#35D0BA", border: "1px solid #2B3544" }}>Email support</button>}
          <button onClick={copyInfo} style={{ ...primaryBtn(false), background: "#1E2530", color: "#35D0BA", border: "1px solid #2B3544" }}>{copied ? "Copied ✓" : "Copy my support info"}</button>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", textAlign: "center", marginTop: 4 }}>Letschat Africa · secure chat for everyone</div>
        </div>
      </div>
    </div>
  );
}

function ChatDetail({ conversation, myId, socket, token, onBack, onLocalUpdate, presence, lastSeen = {}, contacts = [], onGroupChanged = () => {}, settings = DEFAULT_SETTINGS, onToggleFavorite = () => {}, onBlock = () => {} }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [info, setInfo] = useState(false);
  const [rec, setRec] = useState(null);
  const [recSec, setRecSec] = useState(0);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [viewer, setViewer] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/api/v1/conversations/${conversation.id}/messages`, { token })
      .then(({ messages }) => { if (!cancelled) setMsgs(messages); })
      .catch(e => setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (m) => {
      if (m.conversationId !== conversation.id) return;
      setMsgs(prev => [...prev, m]);
    };
    const onTyping = ({ conversationId, userId, typing }) => {
      if (conversationId === conversation.id && userId !== myId) setPeerTyping(typing);
    };
    socket.on("message:new", onNew);
    socket.on("typing", onTyping);
    return () => { socket.off("message:new", onNew); socket.off("typing", onTyping); };
  }, [socket, conversation.id, myId]);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [msgs, peerTyping]);
  useEffect(() => { onLocalUpdate(conversation.id, msgs); }, [msgs]);

  const notifyTyping = (isTyping) => {
    if (!socket) return;
    socket.emit("typing", { conversationId: conversation.id, typing: isTyping });
    clearTimeout(typingTimeout.current);
    if (isTyping) typingTimeout.current = setTimeout(() => socket.emit("typing", { conversationId: conversation.id, typing: false }), 1500);
  };

  const send = () => {
    if (!draft.trim() || !socket) return;
    const text = draft.trim();
    setDraft("");
    notifyTyping(false);
    socket.emit("message:send", { conversationId: conversation.id, text }, (ack) => {
      if (ack?.error) setError(ack.error);
    });
  };

  const sendFile = async (file) => {
    if (!file) return;
    if (!socket) return setError("Not connected yet. Try again in a moment.");
    setSending(true);
    const done = setTimeout(() => setSending(false), 20000);
    try {
      let data, mime = file.type || "application/octet-stream", name = file.name || "file";
      if (/^image\/(jpeg|png|webp)$/.test(mime)) { data = await compressImage(file); mime = "image/jpeg"; name = name.replace(/\.\w+$/, "") + ".jpg"; }
      else { if (file.size > MAX_FILE) throw new Error("File is too large (max 3 MB)"); data = await readAsDataURL(file); }
      if (data.length > 4000000) throw new Error("File is too large (max 3 MB)");
      socket.emit("message:send", { conversationId: conversation.id, file: { name, mime, size: Math.round(data.length * 0.75), data } }, (ack) => {
        clearTimeout(done); setSending(false);
        if (ack && ack.error) setError(ack.error);
      });
    } catch (e) { clearTimeout(done); setSending(false); setError(e.message || "Could not send that file"); }
  };
  const pickFile = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; sendFile(f); };

  const startRec = async () => {
    if (!socket || !navigator.mediaDevices || !window.MediaRecorder) return setError("Voice notes are not supported on this device");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      const r = { mr, chunks: [], t0: Date.now(), cancel: false };
      mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (r.cancel) return;
        const fr = new FileReader();
        fr.onload = () => socket.emit("message:send", { conversationId: conversation.id, audio: fr.result, duration: Math.round((Date.now() - r.t0) / 1000) }, (ack) => { if (ack && ack.error) setError(ack.error); });
        fr.readAsDataURL(new Blob(r.chunks, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      setRecSec(0); setRec(r);
    } catch (e) { setError("Allow microphone access to record voice notes"); }
  };
  const stopRec = (cancel) => { if (!rec) return; rec.cancel = !!cancel; if (rec.mr.state !== "inactive") rec.mr.stop(); setRec(null); };
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSec(x => { if (x >= 59) stopRec(false); return x + 1; }), 1000);
    return () => clearInterval(t);
  }, [rec]);

  const isGroup = !!conversation.isGroup;
  const online = !!presence[conversation.other.id];
  const isFav = settings.favorites.includes(conversation.id);
  const iBlocked = !isGroup && settings.blocked.some(b => b.id === conversation.other.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px", borderBottom: "1px solid #1B212B", position: "relative", flexShrink: 0 }}>
        {menu && (
          <>
            <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{ position: "absolute", top: 50, right: 10, zIndex: 41, minWidth: 210, background: "#1E2530", border: "1px solid #2B3544", borderRadius: 14, padding: 6, boxShadow: "0 14px 36px rgba(0,0,0,0.5)" }}>
              {[
                { label: isFav ? "Remove from favourites" : "Add to favourites", color: "#F5F7FA", run: () => onToggleFavorite(conversation.id) },
                ...(isGroup ? [{ label: "Group info", color: "#F5F7FA", run: () => setInfo(true) }]
                  : [{ label: iBlocked ? "Unblock " + conversation.other.name.split(" ")[0] : "Block " + conversation.other.name.split(" ")[0], color: iBlocked ? "#35D0BA" : "#FF6B5D",
                    run: () => { if (iBlocked || window.confirm("Block " + conversation.other.name + "? They won't be able to message you.")) onBlock(conversation.other.id, !iBlocked); } }]),
              ].map(it => (
                <div key={it.label} onClick={() => { setMenu(false); it.run(); }} style={{ padding: "11px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "Inter", fontWeight: 500, fontSize: 14.5, color: it.color }}>{it.label}</div>
              ))}
            </div>
          </>
        )}
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0 }}><ArrowLeft size={22} /></button>
        <Ring size={38} color={conversation.other.color} initials={conversation.other.initials} photo={conversation.other.avatar} online={isGroup ? undefined : online} onClick={conversation.other.avatar ? () => setZoomed(true) : undefined} />
        <div onClick={isGroup ? () => setInfo(true) : undefined} style={{ flex: 1, minWidth: 0, cursor: isGroup ? "pointer" : "default" }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conversation.other.name}{conversation.other.verified && <VerifiedBadge />}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: peerTyping || (!isGroup && online) ? "#35D0BA" : isGroup ? "#8891A0" : "#5B6673" }}>
            {peerTyping ? "typing…" : isGroup ? conversation.members.length + " members · " + conversation.members.filter(m => m.id === myId || presence[m.id]).length + " online" : statusText(online, lastSeen[conversation.other.id])}
          </div>
        </div>
        <Video size={19} color="#5B6673" style={{ marginRight: 16, opacity: 0.5 }} />
        <Phone size={18} color="#5B6673" style={{ marginRight: 16, opacity: 0.5 }} />
        <div onClick={() => setMenu(m => !m)} style={{ display: "flex", cursor: "pointer", padding: 4 }}><MoreVertical size={19} color="#9BA7B4" /></div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8, background: "#0B0E13" }}>
        {loading && <div style={{ margin: "auto", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>Loading conversation…</div>}
        {error && <Banner text={error} onClose={() => setError("")} />}
        {!loading && msgs.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>
            No messages yet.<br />Say hello to {isGroup ? "the group" : conversation.other.name.split(" ")[0]} 👋
          </div>
        )}
        {msgs.map(m => {
          const mine = m.senderId === myId;
          const sender = isGroup && !mine ? conversation.members.find(x => x.id === m.senderId) : null;
          return (
            <div key={m.id} style={{
              alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "76%",
              background: mine ? "#1E8677" : "#1E2530", borderRadius: 14,
              borderBottomRightRadius: mine ? 3 : 14, borderBottomLeftRadius: mine ? 14 : 3,
              padding: "8px 11px", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5,
            }}>
              {isGroup && !mine && <div style={{ fontSize: 12, fontWeight: 600, color: sender ? sender.color : "#8891A0", marginBottom: 2 }}>{sender ? sender.name : "Former member"}</div>}
              {m.audio ? <audio controls preload="none" src={m.audio} style={{ height: 36, width: 210, maxWidth: "100%" }} />
                : m.file && m.file.data && /^data:image\//.test(m.file.data) ? <img src={m.file.data} alt={m.file.name} onClick={() => setViewer(m.file.data)} style={{ display: "block", width: 230, maxWidth: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 10, cursor: "zoom-in" }} />
                : m.file && m.file.data ? (
                  <a href={m.file.data} download={m.file.name} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#F5F7FA", minWidth: 150 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#0E1116", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Paperclip size={17} color="#35D0BA" /></span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, wordBreak: "break-all" }}>{m.file.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "#B9C2CC" }}>{fmtSize(m.file.size)} · tap to download</span>
                    </span>
                  </a>
                ) : <div>{m.text}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 10.5, color: "#B9C2CC" }}>{timeLabel(m.time)}</span>
                {mine && (m.read || (m.readBy && m.readBy.length) ? <CheckCheck size={13} color="#35D0BA" /> : <Check size={13} color="#B9C2CC" />)}
              </div>
            </div>
          );
        })}
        {peerTyping && (
          <div style={{ alignSelf: "flex-start", background: "#1E2530", borderRadius: 14, borderBottomLeftRadius: 3, padding: "9px 13px", color: "#8891A0", fontFamily: "Inter", fontSize: 13 }}>
            typing…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {(rec || sending) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "#161B22", borderTop: "1px solid #262E3A", fontFamily: "Inter", fontSize: 13.5, color: "#F5F7FA", flexShrink: 0 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: rec ? "#FF6B5D" : "#35D0BA" }} />
          <span style={{ flex: 1 }}>{rec ? "Recording " + Math.floor(recSec / 60) + ":" + String(recSec % 60).padStart(2, "0") + " · tap send to finish" : "Sending file…"}</span>
          {rec && <button onClick={() => stopRec(true)} style={{ ...smallBtn, color: "#FF6B5D" }}>Cancel</button>}
        </div>
      )}
      {iBlocked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#0E1116", borderTop: "1px solid #1B212B", flexShrink: 0, fontFamily: "Inter", fontSize: 13.5, color: "#9BA7B4" }}>
          <span style={{ flex: 1 }}>You blocked this contact.</span>
          <button onClick={() => onBlock(conversation.other.id, false)} style={smallBtn}>Unblock</button>
        </div>
      ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px", background: "#0E1116", borderTop: "1px solid #1B212B", flexShrink: 0 }}>
        <input ref={fileRef} type="file" onChange={pickFile} style={{ display: "none" }} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={pickFile} style={{ display: "none" }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "#1E2530", borderRadius: 24, padding: "8px 12px" }}>
          <Smile size={19} color="#8891A0" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); notifyTyping(true); }}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Message" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5 }} />
          <button aria-label="Attach file" onClick={() => fileRef.current && fileRef.current.click()} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}><Paperclip size={19} color="#8891A0" /></button>
          <button aria-label="Take photo" onClick={() => camRef.current && camRef.current.click()} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}><Camera size={19} color="#8891A0" /></button>
        </div>
        <button aria-label={rec ? "Stop and send voice note" : "Record voice note"} onClick={rec ? () => stopRec(false) : startRec}
          style={{ width: 42, height: 42, borderRadius: "50%", border: rec ? "none" : "1px solid #2B3544", background: rec ? "#FF6B5D" : "#1E2530", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Mic size={18} color={rec ? "#0E1116" : "#35D0BA"} />
        </button>
        <button aria-label="Send" onClick={() => { if (rec) stopRec(false); else if (draft.trim()) send(); else if (inputRef.current) inputRef.current.focus(); }}
          style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#35D0BA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px #35D0BA33" }}>
          <Send size={17} color="#0E1116" />
        </button>
      </div>
      )}
      {viewer && (
        <div onClick={() => setViewer(null)} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.94)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={viewer} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <div style={{ position: "absolute", top: 14, right: 14, color: "#F5F7FA" }}><X size={26} /></div>
        </div>
      )}
      {info && isGroup && <GroupInfoScreen conversation={conversation} myId={myId} token={token} contacts={contacts} presence={presence} lastSeen={lastSeen} onBack={() => setInfo(false)} onChanged={onGroupChanged} />}
      {zoomed && (
        <ImageZoomModal photo={conversation.other.avatar} initials={conversation.other.initials} color={conversation.other.color} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}

// ---- shareable profile link: anyone who opens it can message you directly ----
const profileLinkFor = (code) => window.location.origin + window.location.pathname + "?chat=" + code;
function ProfileLinkRow({ token }) {
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/v1/me/profile-link", { token }).then(d => setCode(d.code)).catch(e => setError(e.message)); }, [token]);
  const link = code ? profileLinkFor(code) : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch (e) { window.prompt("Copy your profile link", link); }
  };
  const share = () => (navigator.share ? navigator.share({ title: "Message me on Letschat Africa", text: "Message me on Letschat Africa", url: link }).catch(() => {}) : copy());
  const reset = async () => {
    if (!window.confirm("Reset your profile link? The old link will stop working.")) return;
    try { const d = await api("/api/v1/me/profile-link/reset", { method: "POST", token }); setCode(d.code); setError(""); } catch (e) { setError(e.message); }
  };
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid #1B212B" }}>
      <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Profile link</div>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginBottom: 10 }}>Anyone with this link can open a direct message with you.</div>
      {error && <Banner text={error} onClose={() => setError("")} />}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} disabled={!code} style={smallBtn}>{copied ? "Copied ✓" : "Copy link"}</button>
        <button onClick={share} disabled={!code} style={smallBtn}>Share link</button>
        <button onClick={reset} disabled={!code} style={{ ...smallBtn, color: "#FF6B5D" }}>Reset</button>
      </div>
    </div>
  );
}

// Opened from someone's profile link: show who it is and start the DM
function ChatLinkModal({ code, token, onClose, onStarted }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/v1/users/profile/" + encodeURIComponent(code), { token }).then(setInfo).catch(e => setError(e.message));
  }, [code]);
  const start = async () => {
    setBusy(true); setError("");
    try { const { conversation } = await api("/api/v1/conversations", { method: "POST", token, body: { profileCode: code } }); onStarted(conversation); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div style={sheet} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", marginBottom: 12 }}>Start a chat</div>
        {info && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Ring size={52} color={info.user.color} initials={info.user.initials} photo={info.user.avatar} />
            <div>
              <div style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 16, color: "#F5F7FA" }}>{info.user.name}</div>
              {info.user.about && <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0" }}>{info.user.about}</div>}
            </div>
          </div>
        )}
        {!info && !error && <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673", marginBottom: 16 }}>Checking profile link…</div>}
        {info && info.self && <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0", marginBottom: 16 }}>This is your own profile link. Share it so others can message you.</div>}
        {error && <Banner text={error} />}
        {info && !info.self && <button onClick={start} disabled={busy} style={primaryBtn(busy)}>{busy ? "Opening…" : "Message " + info.user.name.split(" ")[0]}</button>}
        <button onClick={onClose} style={{ ...primaryBtn(false), background: "none", color: "#8891A0", marginTop: 6 }}>{info && !info.self ? "Not now" : "Close"}</button>
      </div>
    </div>
  );
}

function ProfileScreen({ onBack, onEdit, profile, token, onUserUpdate, onLogOut }) {
  const [zoomed, setZoomed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const rows = [
    { label: "Name", value: profile.name },
    { label: "About", value: profile.about },
    profile.phone ? { label: "Phone", value: "+" + profile.phone, ro: true } : { label: "Email", value: profile.email || "", ro: true },
  ];

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!isJpgOrPng(file)) { setError("Please choose a JPG or PNG image."); return; }
    setError("");
    setCropFile(file);
  };
  const savePhoto = async (avatar) => {
    setBusy(true); setError("");
    try {
      const { user } = await api("/api/v1/me", { method: "PATCH", token, body: { avatar } });
      onUserUpdate(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={e => e.preventDefault()}
    >
      <TopBar title="Profile" onBack={onBack} />
      {menu && <PhotoMenu hasPhoto={!!profile.avatar} onClose={() => setMenu(false)} onGallery={() => galleryRef.current && galleryRef.current.click()} onCamera={() => cameraRef.current && cameraRef.current.click()} onRemove={() => savePhoto(null)} />}
      {cropFile && <CropModal file={cropFile} onCancel={() => setCropFile(null)} onDone={(d) => { setCropFile(null); savePhoto(d); }} />}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 26px" }}>
          <div style={{ position: "relative" }}>
            <Ring size={110} color="#35D0BA" initials={profile.initials} photo={profile.avatar} ring onClick={() => setZoomed(true)} />
            <CameraBadge onClick={() => setMenu(true)} busy={busy} />
            <input ref={galleryRef} type="file" accept={PHOTO_ACCEPT} onChange={onFileChange} style={{ display: "none" }} />
            <input ref={cameraRef} type="file" accept={PHOTO_ACCEPT} capture="user" onChange={onFileChange} style={{ display: "none" }} />
          </div>
          {busy && <div style={{ marginTop: 12, fontFamily: "Inter", fontSize: 12.5, color: "#35D0BA" }}>Saving photo…</div>}
        </div>
        {error && <Banner text={error} onClose={() => setError("")} />}
        {rows.map(r => (
          <div key={r.label} onClick={!r.ro ? onEdit : undefined} style={{ padding: "14px 20px", borderBottom: "1px solid #1B212B", cursor: !r.ro ? "pointer" : "default" }}>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 16, color: "#F5F7FA" }}>{r.value}{r.label === "Name" && profile.verified && <VerifiedBadge size={16} />}</span>
              {!r.ro && <Pencil size={15} color="#5B6673" />}
            </div>
          </div>
        ))}
        <ProfileLinkRow token={token} />
        <div style={{ padding: "24px 20px" }}>
          <button onClick={onLogOut} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "1px solid #FF6B5D55", background: "#FF6B5D15", color: "#FF6B5D", fontFamily: "Sora", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>
      {zoomed && (
        <ImageZoomModal photo={profile.avatar} initials={profile.initials} color="#35D0BA" onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}

// Move + zoom + crop a chosen photo to a square, then export 512x512 JPEG
function CropModal({ file, onCancel, onDone }) {
  const VIEW = Math.min(300, Math.max(220, (typeof window !== "undefined" ? window.innerWidth : 360) - 80));
  const OUT = 512;
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [err, setErr] = useState("");
  const drag = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setErr("Couldn't open that image. Try a different one.");
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const nw = img ? img.naturalWidth : 1;
  const nh = img ? img.naturalHeight : 1;
  const cover = VIEW / Math.min(nw, nh); // scale at which the image just covers the square
  const scale = cover * zoom;
  const clamp = (o, s) => {
    const mx = Math.max(0, (nw * s - VIEW) / 2), my = Math.max(0, (nh * s - VIEW) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };
  const changeZoom = (z) => { setZoom(z); setOff((o) => clamp(o, cover * z)); };

  const confirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUT, OUT);
    const sw = VIEW / scale;
    const sx = (nw * scale / 2 - VIEW / 2 - off.x) / scale;
    const sy = (nh * scale / 2 - VIEW / 2 - off.y) / scale;
    ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT);
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  };

  const pill = { padding: "13px 0", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "Sora", fontWeight: 700, fontSize: 14, flex: 1 };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#05070A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 17, color: "#F5F7FA", marginBottom: 6 }}>Move and zoom</div>
      <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0", marginBottom: 18 }}>Drag the photo to fit it inside the circle</div>
      {err && <Banner text={err} />}
      <div
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, o: off }; }}
        onPointerMove={(e) => { if (drag.current) setOff(clamp({ x: drag.current.o.x + e.clientX - drag.current.x, y: drag.current.o.y + e.clientY - drag.current.y }, scale)); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => changeZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
        style={{ position: "relative", width: VIEW, height: VIEW, overflow: "hidden", background: "#161B22", touchAction: "none", cursor: "grab", borderRadius: 4 }}
      >
        {img && (
          <img src={img.src} alt="" draggable={false} style={{ position: "absolute", left: VIEW / 2 + off.x - nw * scale / 2, top: VIEW / 2 + off.y - nh * scale / 2, width: nw * scale, height: nh * scale, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
        )}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(5,7,10,0.62)", border: "2px solid #35D0BA", pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, width: VIEW, marginTop: 20 }}>
        <span style={{ color: "#8891A0", fontSize: 12, fontFamily: "Inter" }}>-</span>
        <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => changeZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: "#35D0BA" }} aria-label="Zoom" />
        <span style={{ color: "#8891A0", fontSize: 12, fontFamily: "Inter" }}>+</span>
      </div>
      <div style={{ display: "flex", gap: 10, width: VIEW, marginTop: 24 }}>
        <button onClick={onCancel} style={{ ...pill, background: "#1E2530", color: "#F5F7FA" }}>Cancel</button>
        <button onClick={confirm} disabled={!img} style={{ ...pill, background: img ? "#35D0BA" : "#1E2530", color: img ? "#0E1116" : "#5B6673" }}>Use photo</button>
      </div>
    </div>
  );
}

function EditProfileScreen({ onBack, profile, token, onSave }) {
  const [name, setName] = useState(profile.name);
  const [about, setAbout] = useState(profile.about);
  const [avatar, setAvatar] = useState(profile.avatar || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [menu, setMenu] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  const onFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!isJpgOrPng(file)) { setError("Please choose a JPG or PNG image."); return; }
    setError("");
    setCropFile(file);
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const { user } = await api("/api/v1/me", { method: "PATCH", token, body: { name, about, ...(avatarChanged ? { avatar } : {}) } });
      onSave(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Edit profile" onBack={onBack} />
      {menu && <PhotoMenu hasPhoto={!!avatar} onClose={() => setMenu(false)} onGallery={() => galleryRef.current && galleryRef.current.click()} onCamera={() => cameraRef.current && cameraRef.current.click()} onRemove={() => { setAvatar(null); setAvatarChanged(true); }} />}
      {cropFile && <CropModal file={cropFile} onCancel={() => setCropFile(null)} onDone={(d) => { setAvatar(d); setAvatarChanged(true); setCropFile(null); }} />}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 24px" }}>
          <div style={{ position: "relative" }}>
            <Ring size={100} color="#35D0BA" initials={profile.initials} photo={avatar} ring onClick={() => setMenu(true)} />
            <CameraBadge onClick={() => setMenu(true)} />
            <input ref={galleryRef} type="file" accept={PHOTO_ACCEPT} onChange={onFileChange} style={{ display: "none" }} />
            <input ref={cameraRef} type="file" accept={PHOTO_ACCEPT} capture="user" onChange={onFileChange} style={{ display: "none" }} />
          </div>
        </div>
        {error && <Banner text={error} />}
        <div style={{ padding: "0 20px 20px" }}>
          <label style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", textTransform: "uppercase", letterSpacing: 0.5 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #262E3A", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 18, padding: "8px 0", outline: "none", marginTop: 4 }} />
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <label style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", textTransform: "uppercase", letterSpacing: 0.5 }}>About</label>
          <input value={about} onChange={e => setAbout(e.target.value)} style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid #262E3A", color: "#F5F7FA", fontFamily: "Inter", fontSize: 15, padding: "8px 0", outline: "none", marginTop: 4 }} />
        </div>
        <button onClick={save} disabled={saving} style={{ margin: "10px 20px", padding: "13px", borderRadius: 12, border: "none", background: "#35D0BA", color: "#0E1116", fontFamily: "Sora", fontWeight: 700, fontSize: 14.5, cursor: saving ? "default" : "pointer", width: "calc(100% - 40px)", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// [ISO code, name, dial code]; the first four are shown first
const COUNTRIES = [
  ["NG","Nigeria","234"],["GH","Ghana","233"],["KE","Kenya","254"],["ZA","South Africa","27"],
  ["DZ","Algeria","213"],["AO","Angola","244"],["BJ","Benin","229"],["BW","Botswana","267"],["BF","Burkina Faso","226"],
  ["BI","Burundi","257"],["CM","Cameroon","237"],["CV","Cape Verde","238"],["CF","Central African Republic","236"],
  ["TD","Chad","235"],["KM","Comoros","269"],["CG","Congo","242"],["CD","DR Congo","243"],["CI","Côte d'Ivoire","225"],
  ["DJ","Djibouti","253"],["EG","Egypt","20"],["GQ","Equatorial Guinea","240"],["ER","Eritrea","291"],["SZ","Eswatini","268"],
  ["ET","Ethiopia","251"],["GA","Gabon","241"],["GM","Gambia","220"],["GN","Guinea","224"],["GW","Guinea-Bissau","245"],
  ["LS","Lesotho","266"],["LR","Liberia","231"],["LY","Libya","218"],["MG","Madagascar","261"],["MW","Malawi","265"],
  ["ML","Mali","223"],["MR","Mauritania","222"],["MU","Mauritius","230"],["MA","Morocco","212"],["MZ","Mozambique","258"],
  ["NA","Namibia","264"],["NE","Niger","227"],["RW","Rwanda","250"],["ST","São Tomé and Príncipe","239"],["SN","Senegal","221"],
  ["SC","Seychelles","248"],["SL","Sierra Leone","232"],["SO","Somalia","252"],["SS","South Sudan","211"],["SD","Sudan","249"],
  ["TZ","Tanzania","255"],["TG","Togo","228"],["TN","Tunisia","216"],["UG","Uganda","256"],["ZM","Zambia","260"],["ZW","Zimbabwe","263"],
  ["GB","United Kingdom","44"],["US","United States","1"],["CA","Canada","1"],["AE","United Arab Emirates","971"],
  ["FR","France","33"],["DE","Germany","49"],["IN","India","91"],
];
// 8135351804 -> "81 3535 1804" (2 digits, space, 4 digits, space, the rest)
const formatNational = (d) => [d.slice(0, 2), d.slice(2, 6), d.slice(6)].filter(Boolean).join(" ");
const flagOf = (iso) => String.fromCodePoint(...[...iso].map((c) => 127397 + c.charCodeAt(0)));

function friendlyAuthError(e) {
  const map = {
    "auth/invalid-phone-number": "Enter the number with its country code, digits only (e.g. 234801234567).",
    "auth/invalid-verification-code": "That code is wrong. Check it and try again.",
    "auth/code-expired": "That code has expired. Go back and request a new one.",
    "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Your browser blocked the Google pop-up. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain": "This website is not authorized in Firebase (Authentication > Settings > Authorized domains).",
    "auth/email-already-in-use": "That email is already registered. Log in instead, or use Google if you signed up with Google.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Tap Create account.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/captcha-check-failed": "Security check failed. Refresh the page and try again.",
    "auth/network-request-failed": "Network problem. Check your connection and try again.",
  };
  if (e && /region/i.test(e.message || "")) return "Text messages to this country are not enabled yet. In Firebase: Authentication > Settings > SMS region policy, allow Nigeria.";
  if (e && /already been rendered/i.test(e.message || "")) return "Please refresh the page and try again.";
  return map[e && e.code] || (e && e.message) || "Something went wrong.";
}

function LoginScreen({ onContinue }) {
  const [phone, setPhone] = useState(""); // national number only, without the country code
  const [iso, setIso] = useState(() => { try { return localStorage.getItem("lc-country") || "NG"; } catch (e) { return "NG"; } });
  const country = COUNTRIES.find((c) => c[0] === iso) || COUNTRIES[0];
  const dial = country[2];
  const cleanPhone = (v) => {
    let d = String(v).replace(/\D/g, "");
    if (d.startsWith(dial) && d.length >= dial.length + 8) d = d.slice(dial.length); // pasted with country code
    return d.replace(/^0+/, ""); // drop the local leading 0 (0813... -> 813...)
  };
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [pendingToken, setPendingToken] = useState(null); // signed in with Firebase, still needs a name
  const [emailStage, setEmailStage] = useState(null); // null | "form" | "verify"
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emailUser, setEmailUser] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(FIREBASE_READY ? "" : "Firebase is not set up yet: paste your Firebase keys into index.html.");

  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(friendlyAuthError(e)); } finally { setBusy(false); }
  };
  const resetCaptcha = () => { try { window.__rv && window.__rv.clear(); } catch (e) {} window.__rv = null; };
  const finish = async (idToken, nm) => {
    try { await onContinue(idToken, nm); }
    catch (e) { if (/Name required/.test(e.message)) setPendingToken(idToken); else throw e; }
  };

  // A fresh reCAPTCHA element for every attempt (re-using one causes "already been rendered")
  const makeVerifier = () => {
    resetCaptcha();
    const wrap = document.getElementById("recaptcha-wrap");
    wrap.innerHTML = "";
    const el = document.createElement("div");
    wrap.appendChild(el);
    window.__rv = new firebase.auth.RecaptchaVerifier(el, { size: "invisible" });
    return window.__rv;
  };
  const sendCode = () => run(async () => {
    try {
      setConfirmation(await firebase.auth().signInWithPhoneNumber("+" + dial + phone, makeVerifier()));
    } catch (e) { resetCaptcha(); throw e; }
  });
  const verify = () => run(async () => {
    const cred = await confirmation.confirm(code.trim());
    await finish(await cred.user.getIdToken(), "");
  });
  const google = () => run(async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" }); // always show Google's account chooser (never silently reuse the signed-in account)
    const cred = await firebase.auth().signInWithPopup(provider);
    await finish(await cred.user.getIdToken(), "");
  });
  const createAccount = () => run(() => finish(pendingToken, name.trim()));

  // ---- email + password ----
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const emailReady = emailOk && password.length >= 6 && (!isNew || !!emailName.trim());
  const submitEmail = () => run(async () => {
    setNotice("");
    const auth = firebase.auth();
    if (isNew) {
      const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
      await cred.user.updateProfile({ displayName: emailName.trim() });
      await cred.user.sendEmailVerification();
      setEmailUser(cred.user); setEmailStage("verify");
      setNotice("Verification email sent. Check your inbox and spam folder.");
      return;
    }
    const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
    if (!cred.user.emailVerified) {
      try { await cred.user.sendEmailVerification(); } catch (e) {}
      setEmailUser(cred.user); setEmailStage("verify");
      setNotice("Please verify your email first. We sent you a link.");
      return;
    }
    await finish(await cred.user.getIdToken(), "");
  });
  const checkVerified = () => run(async () => {
    await emailUser.reload();
    const u = firebase.auth().currentUser;
    if (!u || !u.emailVerified) throw new Error("Not verified yet. Open the link in the email, then tap the button again.");
    await finish(await u.getIdToken(true), isNew ? emailName.trim() : "");
  });
  const resendVerification = () => run(async () => {
    await firebase.auth().currentUser.sendEmailVerification();
    setNotice("Verification email sent again.");
  });
  const forgotPassword = () => run(async () => {
    if (!emailOk) throw new Error("Type your email address first.");
    await firebase.auth().sendPasswordResetEmail(email.trim());
    setNotice("Password reset link sent to " + email.trim() + ".");
  });
  const linkBtn = { background: "none", border: "none", color: "#8891A0", fontFamily: "Inter", fontSize: 13, marginTop: 14, cursor: "pointer", width: "100%" };

  const box = { display: "flex", alignItems: "center", gap: 10, background: "#161B22", border: "1px solid #262E3A", borderRadius: 14, padding: "14px 16px", marginBottom: 16 };
  const inputStyle = { flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 16, letterSpacing: 0.5 };
  const btn = (on) => ({ padding: "15px", borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer", background: on ? "#35D0BA" : "#1E2530", color: on ? "#0E1116" : "#5B6673", fontFamily: "Sora", fontWeight: 700, fontSize: 15, width: "100%" });

  const stage = pendingToken ? "name" : confirmation ? "code" : emailStage === "verify" ? "verify" : emailStage === "form" ? "email" : "phone";
  const titles = { phone: "Log in or sign up", code: "Enter the code", name: "What's your name?", email: isNew ? "Create your account" : "Log in with email", verify: "Verify your email" };
  const subs = {
    phone: "We'll text you a verification code. Or continue with Google.",
    code: "We sent a code to +" + dial + " " + formatNational(phone) + ".",
    name: "This is what people you chat with will see.",
    email: "Use your email and a password (6 or more characters).",
    verify: "We sent a link to " + email.trim() + ". Open it, then tap the button below.",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "safe center", padding: "0 28px", background: "radial-gradient(circle at 50% 0%, #12251F 0%, #0E1116 62%)", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, margin: "0 auto 20px", background: "conic-gradient(from 120deg, #35D0BA, #F2B84B, #35D0BA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 66, height: 66, borderRadius: 18, background: "#0E1116", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 24, color: "#35D0BA" }}>L<span style={{ color: "#F2B84B" }}>A</span></span>
          </div>
        </div>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13, letterSpacing: 1, color: "#35D0BA", textTransform: "uppercase", marginBottom: 10 }}>Letschat Africa</div>
        <h1 style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 24, color: "#F5F7FA", margin: "0 0 8px" }}>{titles[stage]}</h1>
        <p style={{ fontFamily: "Inter", fontSize: 14, color: "#8891A0", margin: 0, lineHeight: 1.5 }}>{subs[stage]}</p>
      </div>

      {error && <Banner text={error} onClose={() => setError("")} />}
      {notice && <Banner text={notice} tone="info" onClose={() => setNotice("")} />}

      {stage === "phone" && (
        <>
          <div style={box}>
            <div style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 6, paddingRight: 10, borderRight: "1px solid #262E3A" }}>
              <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA", whiteSpace: "nowrap" }}>{flagOf(country[0])} +{dial} <span style={{ color: "#8891A0", fontSize: 11 }}>&#9662;</span></span>
              <select value={iso} onChange={e => { setIso(e.target.value); setPhone(""); try { localStorage.setItem("lc-country", e.target.value); } catch (err) {} }} aria-label="Country code" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 16 }}>
                {COUNTRIES.map((c) => <option key={c[0]} value={c[0]}>{flagOf(c[0])} {c[1]} (+{c[2]})</option>)}
              </select>
            </div>
            <input value={formatNational(phone)} onChange={e => setPhone(cleanPhone(e.target.value))} onKeyDown={e => e.key === "Enter" && phone.length >= 6 && !busy && sendCode()} placeholder="81 3535 1804" inputMode="numeric" autoComplete="tel-national" style={inputStyle} />
          </div>
          <button disabled={busy || phone.length < 6 || !FIREBASE_READY} onClick={sendCode} style={btn(phone.length >= 6 && FIREBASE_READY)}>{busy ? "Please wait…" : "Send code"}</button>
          <div style={{ textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 12, margin: "16px 0" }}>or</div>
          <button disabled={busy || !FIREBASE_READY} onClick={google} style={{ ...btn(false), background: "#F5F7FA", color: "#0E1116" }}>Continue with Google</button>
          <button onClick={() => { setEmailStage("form"); setError(""); setNotice(""); }} style={linkBtn}>Use email and password instead</button>
        </>
      )}

      {stage === "email" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["Log in", false], ["Create account", true]].map(([label, v]) => (
              <button key={label} onClick={() => { setIsNew(v); setError(""); setNotice(""); }} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid " + (isNew === v ? "#35D0BA" : "#262E3A"), background: isNew === v ? "#35D0BA22" : "none", color: isNew === v ? "#35D0BA" : "#8891A0", fontFamily: "Sora", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {isNew && (
            <div style={box}><input value={emailName} onChange={e => setEmailName(e.target.value)} placeholder="Your name" autoComplete="name" style={inputStyle} /></div>
          )}
          <div style={box}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" inputMode="email" style={inputStyle} /></div>
          <div style={box}><input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && emailReady && !busy && submitEmail()} placeholder="Password (6+ characters)" autoComplete={isNew ? "new-password" : "current-password"} style={inputStyle} /></div>
          <button disabled={busy || !emailReady} onClick={submitEmail} style={btn(emailReady)}>{busy ? "Please wait…" : isNew ? "Create account" : "Log in"}</button>
          {!isNew && <button onClick={forgotPassword} style={linkBtn}>Forgot password?</button>}
          <button onClick={() => { setEmailStage(null); setError(""); setNotice(""); }} style={linkBtn}>Back to phone or Google</button>
        </>
      )}

      {stage === "verify" && (
        <>
          <button disabled={busy} onClick={checkVerified} style={btn(true)}>{busy ? "Please wait…" : "I've verified my email"}</button>
          <button onClick={resendVerification} style={linkBtn}>Resend email</button>
          <button onClick={() => { setEmailStage("form"); setEmailUser(null); setNotice(""); try { firebase.auth().signOut(); } catch (e) {} }} style={linkBtn}>Use a different email</button>
        </>
      )}

      {stage === "code" && (
        <>
          <div style={box}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && code.length >= 6 && !busy && verify()} placeholder="123456" inputMode="numeric" autoFocus style={{ ...inputStyle, letterSpacing: 6, textAlign: "center" }} />
          </div>
          <button disabled={busy || code.length < 6} onClick={verify} style={btn(code.length >= 6)}>{busy ? "Please wait…" : "Verify code"}</button>
          <button onClick={() => { setConfirmation(null); setCode(""); resetCaptcha(); }} style={{ background: "none", border: "none", color: "#8891A0", fontFamily: "Inter", fontSize: 13, marginTop: 14, cursor: "pointer" }}>Use a different number</button>
        </>
      )}

      {stage === "name" && (
        <>
          <div style={box}>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && name.trim() && !busy && createAccount()} placeholder="Your name" autoFocus style={inputStyle} />
          </div>
          <button disabled={busy || !name.trim()} onClick={createAccount} style={btn(!!name.trim())}>{busy ? "Please wait…" : "Create account"}</button>
        </>
      )}

      <div id="recaptcha-wrap" />
      <p style={{ textAlign: "center", fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginTop: 22, lineHeight: 1.6 }}>
        Your phone number or Google email is your Letschat Africa ID, so others can find and message you.
      </p>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => loadJSON("session", null)); // { token, user }
  const [conversations, setConversations] = useState([]);
  const [convError, setConvError] = useState("");
  const [convLoading, setConvLoading] = useState(false);
  const [presence, setPresence] = useState({});
  const [tab, setTab] = useState("chats");
  const [activeConvo, setActiveConvo] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [lastSeen, setLastSeen] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [toolsView, setToolsView] = useState(null); // "favs" | "privacy" | "help"
  const [toast, setToast] = useState("");
  // group invite link: ?join=CODE is kept until the user is signed in and confirms
  const [joinCode, setJoinCode] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("join");
      if (c) { saveJSON("pendingJoin", c); window.history.replaceState(null, "", window.location.pathname); }
    } catch (e) {}
    return loadJSON("pendingJoin", null);
  });
  // profile link: ?chat=CODE is kept until the user is signed in and confirms
  const [chatCode, setChatCode] = useState(() => {
    try {
      const c = new URLSearchParams(window.location.search).get("chat");
      if (c) { saveJSON("pendingChat", c); window.history.replaceState(null, "", window.location.pathname); }
    } catch (e) {}
    return loadJSON("pendingChat", null);
  });
  const closeChatLink = () => { clearJSON("pendingChat"); setChatCode(null); };
  const socketRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = FONT_LINK;
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const applyPresence = useCallback(({ online, lastSeen: seen }) => {
    setPresence(Object.fromEntries(online.map(id => [id, true])));
    setLastSeen(prev => ({ ...prev, ...seen }));
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!session) return;
    try {
      const { conversations } = await api("/api/v1/conversations", { token: session.token });
      setConversations(conversations.map(c => normalizeConvo(c, session.user.id)));
      if (socketRef.current) socketRef.current.emit("presence:get", applyPresence);
      setConvError("");
    } catch (e) {
      setConvError(e.message);
    }
  }, [session]);

  // connect socket once logged in
  useEffect(() => {
    if (!session) return;
    const socket = io(SOCKET_URL, { auth: { token: session.token } });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("presence:get", applyPresence)); // who is online right now (also after reconnects)
    socket.on("presence:update", ({ userId, online, lastSeen: ts }) => {
      setPresence(prev => ({ ...prev, [userId]: online }));
      if (ts) setLastSeen(prev => ({ ...prev, [userId]: ts }));
    });
    socket.on("message:new", (m) => { refreshConversations(); if (m && m.senderId !== session.user.id) alertIncoming(m, convosRef.current.find(c => c.id === m.conversationId), !!(activeRef.current && activeRef.current.id === m.conversationId)); });
    socket.on("conversation:added", () => refreshConversations());
    socket.on("conversation:update", () => refreshConversations());
    socket.on("user:update", (u) => {
      // someone changed their photo or name: update chat list, open chat and (if it's me) my profile
      setConversations(prev => prev.map(c => c.isGroup
        ? { ...c, members: c.members.map(m => (m.id === u.id ? { ...m, name: u.name, initials: u.initials, avatar: u.avatar, about: u.about } : m)) }
        : c.other.id === u.id ? { ...c, other: u } : c));
      setActiveConvo(prev => (prev && prev.other.id === u.id ? { ...prev, other: u } : prev));
    });
    socket.on("connect_error", (err) => { if (/^(unauthorized|unknown user)$/i.test(err.message)) { clearJSON("session"); window.location.reload(); return; } setConvError("Can't reach the Letschat Africa server: " + err.message); });
    return () => socket.disconnect();
  }, [session, refreshConversations]);

  useEffect(() => {
    if (!session) return;
    setConvLoading(true);
    refreshConversations().finally(() => setConvLoading(false));
  }, [session, refreshConversations]);

  useEffect(() => {
    if (!session) { setSettings(DEFAULT_SETTINGS); setToolsView(null); return; }
    api("/api/v1/me/settings", { token: session.token }).then(setSettings).catch(() => {});
        api("/api/v1/me", { token: session.token }).then(({ user }) => { if (user && !!user.verified !== !!session.user.verified) { const next = { ...session, user: { ...session.user, verified: !!user.verified } }; setSession(next); saveJSON("session", next); } }).catch(() => { });
  }, [session && session.token]);
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };
  const activeRef = useRef(null), convosRef = useRef([]);
  activeRef.current = activeConvo;
  convosRef.current = conversations;
  const settingsCall = async (path, method, body, okMsg) => {
    try { const s = await api("/api/v1/me/" + path, { method, token: session.token, body }); setSettings(s); if (okMsg) flash(okMsg); return true; }
    catch (e) { flash(e.message); return false; }
  };
  const toggleFavorite = (id) => { const on = !settings.favorites.includes(id); return settingsCall("favorites", "POST", { conversationId: id, favorite: on }, on ? "Added to favourites" : "Removed from favourites"); };
  const savePrivacy = (patch) => settingsCall("settings", "PATCH", { privacy: patch });
  const setBlocked = (userId, blocked) => settingsCall("blocked", "POST", { userId, blocked }, blocked ? "Contact blocked" : "Contact unblocked");

  const handleLogin = async (idToken, name) => {
    const { token, user } = await api("/api/v1/auth/firebase", { method: "POST", body: { idToken, name } });
    saveJSON("session", { token, user });
    setSession({ token, user });
  };

  const handleLogOut = () => {
    socketRef.current?.disconnect();
    try { firebase.auth().signOut(); } catch (e) {}
    clearJSON("session");
    setSession(null);
    setConversations([]);
    setActiveConvo(null);
    setShowProfile(false);
  };

  const updateUser = (user) => {
    const next = { ...session, user };
    setSession(next);
    saveJSON("session", next);
  };

  const handleNewChatStarted = (conversation) => {
    setShowNewChat(false);
    refreshConversations();
    setActiveConvo({ id: conversation.id, other: conversation.other });
  };

  const contacts = conversations.filter(c => !c.isGroup).map(c => c.other);
  const messageSeller = async (seller) => {
    const { conversation } = await api("/api/v1/conversations", { method: "POST", token: session.token, body: { userId: seller.id } });
    setTab("chats");
    handleNewChatStarted(conversation);
  };
  const openGroup = (conversation) => {
    const c = normalizeConvo(conversation, session.user.id);
    setConversations(prev => [c, ...prev.filter(x => x.id !== c.id)]);
    setActiveConvo(c);
  };
  const closeJoin = () => { clearJSON("pendingJoin"); setJoinCode(null); };

  // The app fills the whole screen; a footer bar below it carries the host's badge so it never covers the composer.
  const frame = {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 640, margin: "0 auto",
    background: "#0E1116", overflow: "hidden", display: "flex",
    flexDirection: "column", fontFamily: "Inter, sans-serif",
  };

  let body;
  if (!session) {
    body = <LoginScreen onContinue={handleLogin} />;
  } else if (activeConvo) {
    body = (
      <ChatDetail
        conversation={conversations.find(c => c.id === activeConvo.id) || activeConvo}
        myId={session.user.id}
        lastSeen={lastSeen}
        contacts={contacts}
        onGroupChanged={(conv) => setConversations(prev => prev.map(x => (x.id === conv.id ? { ...x, ...normalizeConvo(conv, session.user.id) } : x)))}
        socket={socketRef.current}
        token={session.token}
        presence={presence}
        onBack={() => { setActiveConvo(null); refreshConversations(); }}
        onLocalUpdate={() => {}}
        settings={settings}
        onToggleFavorite={toggleFavorite}
        onBlock={setBlocked}
      />
    );
  } else if (toolsView === "favs") {
    body = <FavouritesScreen conversations={conversations} settings={settings} presence={presence} onBack={() => setToolsView(null)} onOpenChat={setActiveConvo} onToggleFavorite={toggleFavorite} />;
  } else if (toolsView === "privacy") {
    body = <PrivacyScreen settings={settings} onBack={() => setToolsView(null)} onPrivacy={savePrivacy} onBlock={setBlocked} />;
  } else if (toolsView === "communities") {
    body = <CommunitiesScreen conversations={conversations} myId={session.user.id} presence={presence} onBack={() => setToolsView(null)} onOpenChat={setActiveConvo} onNewGroup={() => { setToolsView(null); setShowNewGroup(true); }} />;
  } else if (toolsView === "notifs") {
    body = <NotificationsScreen onBack={() => setToolsView(null)} />;
  } else if (toolsView === "help") {
    body = <HelpScreen user={session.user} onBack={() => setToolsView(null)} />;
  } else if (showEdit) {
    body = <EditProfileScreen profile={session.user} token={session.token} onBack={() => setShowEdit(false)} onSave={(user) => { const next = { ...session, user }; setSession(next); saveJSON("session", next); setShowEdit(false); }} />;
  } else if (showProfile) {
    body = <ProfileScreen profile={session.user} token={session.token} onUserUpdate={updateUser} onBack={() => setShowProfile(false)} onEdit={() => setShowEdit(true)} onLogOut={handleLogOut} />;
  } else {
    body = (
      <>
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {tab === "chats" && (
            <ChatsScreen
              token={session.token}
              profile={session.user}
              conversations={conversations}
              loading={convLoading}
              error={convError}
              presence={presence}
              onOpenChat={setActiveConvo}
              onProfile={() => setShowProfile(true)}
              onNewChat={() => setShowNewChat(true)}
              onNewGroup={() => setShowNewGroup(true)}
              favorites={settings.favorites}
            />
          )}
          {tab === "calls" && <CallsScreen />}
          {tab === "market" && <MarketScreen token={session.token} myId={session.user.id} onMessageSeller={messageSeller} />}
          {tab === "status" && <StatusScreen profile={session.user} />}
          {tab === "tools" && <ToolsScreen onProfile={() => setShowProfile(true)} onOpen={setToolsView} settings={settings} />}
          {showNewGroup && <NewGroupModal token={session.token} contacts={contacts} presence={presence} lastSeen={lastSeen} onClose={() => setShowNewGroup(false)} onCreated={(conv) => { setShowNewGroup(false); openGroup(conv); }} />}
          {showNewChat && <NewChatModal token={session.token} onClose={() => setShowNewChat(false)} onStarted={handleNewChatStarted} />}
        </div>
        <TabBar active={tab} setActive={setTab} />
      </>
    );
  }

  return (
    <div className="app-shell" style={{ background: "#05070A", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div style={frame}>
          {body}
          {toast && <div style={{ position: "absolute", left: 16, right: 16, bottom: 86, zIndex: 80, background: "#1E2530", border: "1px solid #2B3544", color: "#F5F7FA", borderRadius: 12, padding: "11px 14px", fontFamily: "Inter", fontSize: 13.5, textAlign: "center", boxShadow: "0 10px 28px rgba(0,0,0,.45)" }}>{toast}</div>}
          {session && chatCode && <ChatLinkModal code={chatCode} token={session.token} onClose={closeChatLink} onStarted={(conv) => { closeChatLink(); handleNewChatStarted(conv); }} />}
          {session && joinCode && <JoinGroupModal code={joinCode} token={session.token} onClose={closeJoin} onJoined={(conv) => { closeJoin(); openGroup(conv); }} />}
        </div>
      </div>
      <div className="app-footer" aria-hidden="true">
        <span className="app-footer-dot" />
        <span className="app-footer-text">Letschat Africa</span>
      </div>
    </div>
  );
}

// ---- mount ----
const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(React.createElement(App));
