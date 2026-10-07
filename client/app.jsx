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
const Trash2 = makeIcon([["p", "M3 6h18"], ["p", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"], ["p", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"], ["p", "M10 11v6"], ["p", "M14 11v6"]]);
const ChevronDown = makeIcon([["p", "m6 9 6 6 6-6"]]);
const Gamepad2 = makeIcon([["p", "M6 11h4"], ["p", "M8 9v4"], ["p", "M15 12h.01"], ["p", "M18 10h.01"], ["p", "M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"]]);
const RotateCcw = makeIcon([["p", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"], ["p", "M3 3v5h5"]]);
const Pencil = makeIcon([["p", "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"]]);
const X = makeIcon([["p", "M18 6 6 18"], ["p", "m6 6 12 12"]]);
const AlertCircle = makeIcon([["c", 12, 12, 10], ["p", "M12 8v4"], ["p", "M12 16h.01"]]);
const Volume2 = makeIcon([["g", "11 5 6 9 2 9 2 15 6 15 11 19 11 5"], ["p", "M15.54 8.46a5 5 0 0 1 0 7.07"], ["p", "M19.07 4.93a10 10 0 0 1 0 14.14"]]);
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
    { id: "games", icon: Gamepad2, label: "Games" },
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
          Enter the username, email or phone number (with country code) of the person you want to message. They need to have signed in to Letschat Africa at least once.
        </div>
        {error && <Banner text={error} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid #262E3A", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <input value={phone} onChange={e => { const v = e.target.value.trim(); setPhone(v.includes("@") || /[a-zA-Z]/.test(v) ? v : v.replace(/\D/g, "")); }}
            placeholder="@username, email or phone" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 15 }} />
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
                <input value={phone} onChange={e => { const v = e.target.value.trim(); setPhone(v.includes("@") || /[a-zA-Z]/.test(v) ? v : v.replace(/\D/g, "")); }} placeholder="@username, email or phone" style={{ ...inputEl, fontSize: 13.5 }} />
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

// ---- games: single-player games that run on the phone (no server needed). Best scores are kept on this device. ----
const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gameBtn = { background: "#1E2530", border: "1px solid #2B3544", color: "#F5F7FA", borderRadius: 12, padding: "10px 16px", fontFamily: "Inter", fontWeight: 600, fontSize: 14, cursor: "pointer" };

// swipe on an element -> "left" | "right" | "up" | "down" (the element also stops the page from scrolling while you play)
function useSwipe(ref, onSwipe) {
  const cb = useRef(onSwipe); cb.current = onSwipe;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let sx = 0, sy = 0, on = false;
    const ts = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; on = true; };
    const te = (e) => {
      if (!on) return; on = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    };
    const tm = (e) => e.preventDefault();
    el.addEventListener("touchstart", ts, { passive: true });
    el.addEventListener("touchend", te, { passive: true });
    el.addEventListener("touchmove", tm, { passive: false });
    return () => { el.removeEventListener("touchstart", ts); el.removeEventListener("touchend", te); el.removeEventListener("touchmove", tm); };
  }, []);
}
const ARROWS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
function useArrowKeys(onDir) {
  const cb = useRef(onDir); cb.current = onDir;
  useEffect(() => {
    const h = (e) => { const d = ARROWS[e.key]; if (!d || /^(input|textarea)$/i.test((e.target && e.target.tagName) || "")) return; e.preventDefault(); cb.current(d); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
}

// ---------- Tic-Tac-Toe (you are X, the computer is O) ----------
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) {
  for (const [x, y, z] of TTT_LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return { who: b[x], line: [x, y, z] };
  return b.every(Boolean) ? { who: "draw", line: [] } : null;
}
function tttScore(b, turn, depth) {
  const w = tttWinner(b);
  if (w) return w.who === "O" ? 10 - depth : w.who === "X" ? depth - 10 : 0;
  let best = turn === "O" ? -99 : 99;
  for (let i = 0; i < 9; i++) if (!b[i]) {
    b[i] = turn;
    const s = tttScore(b, turn === "O" ? "X" : "O", depth + 1);
    b[i] = null;
    best = turn === "O" ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}
function tttPick(board, level) {
  const b = board.slice();
  const free = [];
  b.forEach((v, i) => { if (!v) free.push(i); });
  if (!free.length) return -1;
  const rnd = () => free[Math.floor(Math.random() * free.length)];
  if (level === "easy") return rnd();
  if (level === "normal") { // win if it can, block you if it must, otherwise take the centre or anything
    for (const who of ["O", "X"]) for (const i of free) { b[i] = who; const w = tttWinner(b); b[i] = null; if (w && w.who === who) return i; }
    return b[4] ? rnd() : 4;
  }
  if (free.length === 9) return [0, 2, 4, 6, 8][Math.floor(Math.random() * 5)];
  let best = -99, pick = free[0];
  for (const i of free) { b[i] = "O"; const s = tttScore(b, "X", 1); b[i] = null; if (s > best || (s === best && Math.random() < 0.3)) { best = s; pick = i; } }
  return pick;
}
function TicTacToeGame({ stats, onResult }) {
  const [level, setLevel] = useState("normal");
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [youStart, setYouStart] = useState(true);
  const reported = useRef(false);
  const result = tttWinner(board);
  useEffect(() => {
    if (result) { if (!reported.current) { reported.current = true; onResult(result.who === "X" ? "w" : result.who === "O" ? "l" : "d"); } return; }
    if (turn !== "O") return;
    const t = setTimeout(() => {
      setBoard(b => { const i = tttPick(b, level); if (i < 0) return b; const nb = b.slice(); nb[i] = "O"; return nb; });
      setTurn("X");
    }, 380);
    return () => clearTimeout(t);
  }, [board, turn, level]);
  const play = (i) => { if (result || turn !== "X" || board[i]) return; const nb = board.slice(); nb[i] = "X"; setBoard(nb); setTurn("O"); };
  const again = () => { const ys = !youStart; setYouStart(ys); setBoard(Array(9).fill(null)); reported.current = false; setTurn(ys ? "X" : "O"); };
  const msg = result ? (result.who === "X" ? "You win! 🎉" : result.who === "O" ? "Computer wins" : "It's a draw") : turn === "X" ? "Your turn (X)" : "Computer is thinking…";
  const s = stats || { w: 0, d: 0, l: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "10px 20px 24px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {[["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]].map(([id, label]) => (
          <button key={id} onClick={() => setLevel(id)} style={{ ...gameBtn, padding: "7px 14px", fontSize: 13, background: level === id ? "#35D0BA" : "#1E2530", color: level === id ? "#0E1116" : "#F5F7FA" }}>{label}</button>
        ))}
      </div>
      <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#F5F7FA", minHeight: 24 }}>{msg}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "100%", maxWidth: 300 }}>
        {board.map((v, i) => {
          const win = result && result.line.includes(i);
          return (
            <button key={i} aria-label={"Square " + (i + 1)} onClick={() => play(i)} style={{ aspectRatio: "1 / 1", borderRadius: 14, border: win ? "2px solid #35D0BA" : "1px solid #2B3544", background: win ? "#35D0BA22" : "#161B22", fontFamily: "Sora", fontWeight: 800, fontSize: 42, color: v === "X" ? "#35D0BA" : "#F2B84B", cursor: v || result ? "default" : "pointer", padding: 0 }}>{v}</button>
          );
        })}
      </div>
      {result && <button onClick={again} style={{ ...gameBtn, background: "#35D0BA", color: "#0E1116", border: "none" }}>Play again</button>}
      <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0" }}>Wins {s.w} · Draws {s.d} · Losses {s.l}</div>
    </div>
  );
}

// ---------- Memory Match ----------
const MEM_EMOJI = ["🦁", "🐘", "🦒", "🦓", "🐆", "🦛", "🦜", "🐒", "🦩", "🐊", "🦏", "🐍"];
function MemoryGame({ best, onScore }) {
  const [cards] = useState(() => { const p = shuffled(MEM_EMOJI).slice(0, 8); return shuffled([...p, ...p]); });
  const [open, setOpen] = useState([]);
  const [done, setDone] = useState([]);
  const [moves, setMoves] = useState(0);
  const [secs, setSecs] = useState(0);
  const [started, setStarted] = useState(false);
  const won = done.length === cards.length;
  useEffect(() => { if (!started || won) return; const t = setInterval(() => setSecs(x => x + 1), 1000); return () => clearInterval(t); }, [started, won]);
  useEffect(() => { if (won) onScore(moves); }, [won]);
  const flip = (i) => {
    if (open.length >= 2 || open.includes(i) || done.includes(i)) return;
    setStarted(true);
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = next;
      if (cards[a] === cards[b]) setTimeout(() => { setDone(d => [...d, a, b]); setOpen([]); }, 350);
      else setTimeout(() => setOpen([]), 800);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "10px 20px 24px" }}>
      <div style={{ display: "flex", gap: 22, fontFamily: "Inter", fontSize: 14, color: "#B9C2CC" }}>
        <span>Moves <b style={{ color: "#F5F7FA" }}>{moves}</b></span>
        <span>Time <b style={{ color: "#F5F7FA" }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</b></span>
        <span>Best <b style={{ color: "#F2B84B" }}>{best || "–"}</b></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%", maxWidth: 340 }}>
        {cards.map((e, i) => {
          const up = open.includes(i) || done.includes(i);
          return (
            <button key={i} aria-label={up ? e : "Hidden card"} onClick={() => flip(i)} style={{ aspectRatio: "1 / 1", borderRadius: 12, border: done.includes(i) ? "2px solid #35D0BA" : "1px solid #2B3544", background: up ? "#161B22" : "#1E8677", fontSize: 32, padding: 0, cursor: up ? "default" : "pointer", opacity: done.includes(i) ? 0.75 : 1 }}>{up ? e : ""}</button>
          );
        })}
      </div>
      {won && <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 18, color: "#35D0BA", textAlign: "center" }}>You found them all in {moves} moves! 🎉<div style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 13, color: "#8891A0", marginTop: 4 }}>Tap ↻ at the top to play again.</div></div>}
    </div>
  );
}

// ---------- Snake ----------
const SNAKE_N = 16, SNAKE_CELL = 20;
const SNAKE_DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
function SnakeGame({ best, onScore }) {
  const canvasRef = useRef(null);
  const g = useRef(null);
  const timer = useRef(null);
  const scoreCb = useRef(onScore); scoreCb.current = onScore;
  const [status, setStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const stop = () => { clearInterval(timer.current); timer.current = null; };
  useEffect(() => { draw(); return stop; }, []);
  const placeFood = (snake) => {
    const free = [];
    for (let x = 0; x < SNAKE_N; x++) for (let y = 0; y < SNAKE_N; y++) if (!snake.some(p => p.x === x && p.y === y)) free.push({ x, y });
    return free[Math.floor(Math.random() * free.length)];
  };
  const draw = () => {
    const cv = canvasRef.current; if (!cv) return;
    const c = cv.getContext("2d"), s = g.current, C = SNAKE_CELL;
    c.fillStyle = "#0B0E13"; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#121821";
    for (let x = 0; x < SNAKE_N; x++) for (let y = 0; y < SNAKE_N; y++) if ((x + y) % 2) c.fillRect(x * C, y * C, C, C);
    if (!s) return;
    c.fillStyle = "#FF6B5D"; c.beginPath(); c.arc(s.food.x * C + C / 2, s.food.y * C + C / 2, C / 2 - 3, 0, Math.PI * 2); c.fill();
    s.snake.forEach((p, i) => { c.fillStyle = i === 0 ? "#7CF0DE" : "#35D0BA"; c.fillRect(p.x * C + 1, p.y * C + 1, C - 2, C - 2); });
  };
  const speed = (sc) => Math.max(70, 140 - Math.floor(sc / 10) * 4);
  const tick = () => {
    const s = g.current; if (!s) return;
    s.dir = s.next;
    const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
    const eat = head.x === s.food.x && head.y === s.food.y;
    const body = eat ? s.snake : s.snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= SNAKE_N || head.y >= SNAKE_N || body.some(p => p.x === head.x && p.y === head.y)) {
      stop(); setStatus("over"); scoreCb.current(s.score); draw(); return;
    }
    s.snake = [head, ...body];
    if (eat) { s.score += 10; setScore(s.score); s.food = placeFood(s.snake); stop(); timer.current = setInterval(tick, speed(s.score)); }
    draw();
  };
  const start = () => {
    stop();
    const snake = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }];
    g.current = { snake, dir: SNAKE_DIRS.right, next: SNAKE_DIRS.right, food: placeFood(snake), score: 0 };
    setScore(0); setStatus("playing"); draw();
    timer.current = setInterval(tick, speed(0));
  };
  const turn = (name) => {
    const s = g.current, v = SNAKE_DIRS[name];
    if (!s || !timer.current || (v.x === -s.dir.x && v.y === -s.dir.y)) return;
    s.next = v;
  };
  useSwipe(canvasRef, turn);
  useArrowKeys(turn);
  const pad = { width: 62, height: 52, borderRadius: 14, border: "1px solid #2B3544", background: "#1E2530", color: "#F5F7FA", fontSize: 22, cursor: "pointer", padding: 0 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "10px 20px 24px" }}>
      <div style={{ display: "flex", gap: 24, fontFamily: "Inter", fontSize: 14, color: "#B9C2CC" }}>
        <span>Score <b style={{ color: "#F5F7FA" }}>{score}</b></span>
        <span>Best <b style={{ color: "#F2B84B" }}>{Math.max(best || 0, status === "over" ? score : 0)}</b></span>
      </div>
      <div style={{ position: "relative", width: "100%", maxWidth: 340 }}>
        <canvas ref={canvasRef} width={SNAKE_N * SNAKE_CELL} height={SNAKE_N * SNAKE_CELL} style={{ width: "100%", aspectRatio: "1 / 1", display: "block", borderRadius: 14, border: "1px solid #2B3544", touchAction: "none" }} />
        {status !== "playing" && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "rgba(11,14,19,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 20, color: "#F5F7FA" }}>{status === "over" ? "Game over · " + score : "Snake 🐍"}</div>
            <button onClick={start} style={{ ...gameBtn, background: "#35D0BA", color: "#0E1116", border: "none" }}>{status === "over" ? "Try again" : "Start"}</button>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: "#8891A0" }}>Swipe or use the arrows to steer</div>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 62px)", gap: 6, justifyContent: "center" }}>
        <span /><button aria-label="Up" onClick={() => turn("up")} style={pad}>▲</button><span />
        <button aria-label="Left" onClick={() => turn("left")} style={pad}>◀</button>
        <button aria-label="Down" onClick={() => turn("down")} style={pad}>▼</button>
        <button aria-label="Right" onClick={() => turn("right")} style={pad}>▶</button>
      </div>
    </div>
  );
}

// ---------- 2048 ----------
function g2048Slide(row) {
  const a = row.filter(Boolean); let gained = 0;
  for (let i = 0; i < a.length - 1; i++) if (a[i] === a[i + 1]) { a[i] *= 2; gained += a[i]; a.splice(i + 1, 1); }
  while (a.length < 4) a.push(0);
  return [a, gained];
}
function g2048Move(grid, dir) {
  const out = grid.map(r => r.slice());
  let gained = 0, moved = false;
  const at = (i, j) => (dir === "left" ? [i, j] : dir === "right" ? [i, 3 - j] : dir === "up" ? [j, i] : [3 - j, i]);
  for (let i = 0; i < 4; i++) {
    const line = [];
    for (let j = 0; j < 4; j++) { const [r, c] = at(i, j); line.push(grid[r][c]); }
    const [res, gain] = g2048Slide(line);
    gained += gain;
    for (let j = 0; j < 4; j++) { const [r, c] = at(i, j); if (out[r][c] !== res[j]) moved = true; out[r][c] = res[j]; }
  }
  return { grid: out, gained, moved };
}
function g2048Add(grid) {
  const empty = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (!v) empty.push([r, c]); }));
  if (!empty.length) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const out = grid.map(x => x.slice());
  out[r][c] = Math.random() < 0.9 ? 2 : 4;
  return out;
}
const g2048CanMove = (grid) => ["left", "right", "up", "down"].some(d => g2048Move(grid, d).moved);
const TILE_COLORS = { 0: ["#1B222D", "#1B222D"], 2: ["#2B3544", "#F5F7FA"], 4: ["#34445A", "#F5F7FA"], 8: ["#F2B84B", "#0E1116"], 16: ["#F29A4B", "#0E1116"], 32: ["#FF8A5D", "#0E1116"], 64: ["#FF6B5D", "#0E1116"], 128: ["#35D0BA", "#0E1116"], 256: ["#2BB8A3", "#0E1116"], 512: ["#4FA8E0", "#0E1116"], 1024: ["#8B7CF6", "#0E1116"], 2048: ["#F5F7FA", "#0E1116"] };
function Game2048({ best, onScore }) {
  const [grid, setGrid] = useState(() => g2048Add(g2048Add(Array.from({ length: 4 }, () => Array(4).fill(0)))));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const boardRef = useRef(null);
  const cur = useRef({}); cur.current = { grid, score, over };
  const move = (dir) => {
    const s = cur.current; if (s.over) return;
    const r = g2048Move(s.grid, dir); if (!r.moved) return;
    const next = g2048Add(r.grid), sc = s.score + r.gained;
    setGrid(next); setScore(sc); onScore(sc);
    if (next.some(row => row.includes(2048))) setWon(true);
    if (!g2048CanMove(next)) setOver(true);
  };
  useSwipe(boardRef, move);
  useArrowKeys(move);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "10px 20px 24px" }}>
      <div style={{ display: "flex", gap: 24, fontFamily: "Inter", fontSize: 14, color: "#B9C2CC" }}>
        <span>Score <b style={{ color: "#F5F7FA" }}>{score}</b></span>
        <span>Best <b style={{ color: "#F2B84B" }}>{Math.max(best || 0, score)}</b></span>
      </div>
      <div ref={boardRef} style={{ position: "relative", width: "100%", maxWidth: 340, touchAction: "none", background: "#10151C", borderRadius: 14, padding: 8, border: "1px solid #2B3544", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {grid.flat().map((v, i) => {
            const [bg, fg] = TILE_COLORS[v] || ["#F5F7FA", "#0E1116"];
            return <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: 10, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sora", fontWeight: 800, fontSize: v >= 1024 ? 20 : v >= 128 ? 24 : 28 }}>{v || ""}</div>;
          })}
        </div>
        {(over || won) && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "rgba(11,14,19,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 20, color: "#F5F7FA" }}>{over ? "No more moves" : "You made 2048! 🎉"}</div>
            {over ? <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0" }}>Score {score} · tap ↻ for a new game</div> : <button onClick={() => setWon(false)} style={{ ...gameBtn, background: "#35D0BA", color: "#0E1116", border: "none" }}>Keep going</button>}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", textAlign: "center" }}>Swipe to slide the tiles. Matching numbers merge.</div>
    </div>
  );
}

// ---------- the Games tab ----------
const GAME_LIST = [
  { id: "ttt", name: "Tic-Tac-Toe", emoji: "❌", blurb: "Beat the computer", color: "#8B7CF6" },
  { id: "memory", name: "Memory Match", emoji: "🧠", blurb: "Find all the pairs", color: "#35D0BA" },
  { id: "snake", name: "Snake", emoji: "🐍", blurb: "Eat, grow, don't crash", color: "#4FA8E0" },
  { id: "g2048", name: "2048", emoji: "🔢", blurb: "Slide and merge tiles", color: "#F2B84B" },
];
function GamesScreen({ myId }) {
  const [scores, setScores] = useState(() => loadJSON("games:" + myId, {}));
  const [playing, setPlaying] = useState(null);
  const [round, setRound] = useState(0);
  const record = (id, v) => setScores(prev => {
    const cur = prev[id];
    let next;
    if (id === "ttt") { const t = cur || { w: 0, d: 0, l: 0 }; next = { ...t, [v]: t[v] + 1 }; }
    else if (id === "memory") next = { best: cur && cur.best ? Math.min(cur.best, v) : v };
    else next = { best: Math.max((cur && cur.best) || 0, v) };
    const all = { ...prev, [id]: next };
    saveJSON("games:" + myId, all);
    return all;
  });
  const line = (id) => {
    const s = scores[id];
    if (id === "ttt") return s ? "W " + s.w + " · D " + s.d + " · L " + s.l : "Not played yet";
    return s && s.best ? "Best: " + s.best + (id === "memory" ? " moves" : "") : "Not played yet";
  };
  if (playing) {
    const game = GAME_LIST.find(x => x.id === playing);
    const best = scores[playing] && scores[playing].best;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexShrink: 0 }}>
          <button aria-label="Back to games" onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0, display: "flex" }}><ArrowLeft size={22} /></button>
          <div style={{ flex: 1, fontFamily: "Sora", fontWeight: 700, fontSize: 19, color: "#F5F7FA" }}>{game.emoji} {game.name}</div>
          <button aria-label="Restart" onClick={() => setRound(r => r + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}><RotateCcw size={20} color="#9BA7B4" /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {playing === "ttt" && <TicTacToeGame key={round} stats={scores.ttt} onResult={(r) => record("ttt", r)} />}
          {playing === "memory" && <MemoryGame key={round} best={best} onScore={(v) => record("memory", v)} />}
          {playing === "snake" && <SnakeGame key={round} best={best} onScore={(v) => v > 0 && record("snake", v)} />}
          {playing === "g2048" && <Game2048 key={round} best={best} onScore={(v) => record("g2048", v)} />}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Games" />
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 20px" }}>
        <div style={{ fontFamily: "Inter", fontSize: 13, color: "#8891A0", marginBottom: 14 }}>Pick a game. Your best scores are saved on this device.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {GAME_LIST.map(gm => (
            <div key={gm.id} onClick={() => { setRound(0); setPlaying(gm.id); }} style={{ background: "#161B22", border: "1px solid #262E3A", borderRadius: 18, padding: "16px 14px", cursor: "pointer" }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: gm.color + "26", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 12 }}>{gm.emoji}</div>
              <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15.5, color: "#F5F7FA" }}>{gm.name}</div>
              <div style={{ fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", margin: "3px 0 8px" }}>{gm.blurb}</div>
              <div style={{ fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: gm.color }}>{line(gm.id)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================== GAMES HUB =====================
// Plain JS on purpose (no JSX): the same block is used in app.jsx and the compiled index.html.
const gh = React.createElement;
const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
const SNL_JUMPS = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100, 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const GAME_RULES = {
  ttt: {
    init: () => Array(9).fill(null),
    moves: (s) => s.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0),
    play: (s, m, p) => { const n = s.slice(); n[m] = p; return n; },
    win: (s) => {
      for (const l of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])
        if (s[l[0]] != null && s[l[0]] === s[l[1]] && s[l[1]] === s[l[2]]) return { p: s[l[0]], line: l };
      return null;
    },
  },
  c4: {
    init: () => Array(42).fill(null),
    moves: (s) => [0,1,2,3,4,5,6].filter((c) => s[c] == null),
    play: (s, c, p) => { const n = s.slice(); for (let r = 5; r >= 0; r--) if (n[r * 7 + c] == null) { n[r * 7 + c] = p; break; } return n; },
    win: (s) => {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const p = s[r * 7 + c]; if (p == null) continue;
        for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
          const line = [];
          for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || s[rr * 7 + cc] !== p) break; line.push(rr * 7 + cc); }
          if (line.length === 4) return { p, line };
        }
      }
      return null;
    },
  },
  ludo: {
    // 2 players, 4 pieces each. Piece position: -1 base, 0..50 ring, 51..55 home column, 56 finished.
    init: () => ({ t: [[-1,-1,-1,-1],[-1,-1,-1,-1]], d: null, last: 0, nx: 0 }),
    can: (s, p, i) => { const r = s.t[p][i], d = s.d; if (r === 56 || d == null) return false; if (r === -1) return d === 6; return r + d <= 56; },
    moves: (s, p) => (s.nx !== p ? [] : s.d == null ? [-1] : [0,1,2,3].filter((i) => GAME_RULES.ludo.can(s, p, i))),
    play: (s, m, p, rnd) => {
      const t = s.t.map((a) => a.slice());
      if (m === -1) {
        const d = 1 + Math.floor(rnd() * 6), ns = { t, d, last: d, nx: p };
        if (![0,1,2,3].some((i) => GAME_RULES.ludo.can(ns, p, i))) { ns.d = null; ns.nx = 1 - p; }
        return ns;
      }
      const d = s.d, r = t[p][m], nr = r === -1 ? 0 : r + d; let extra = d === 6; t[p][m] = nr;
      if (nr <= 50) { const a = (p * 26 + nr) % 52; if (!LUDO_SAFE.includes(a)) { const q = 1 - p; t[q].forEach((qr, j) => { if (qr >= 0 && qr <= 50 && (q * 26 + qr) % 52 === a) { t[q][j] = -1; extra = true; } }); } }
      if (nr === 56) extra = true;
      return { t, d: null, last: d, nx: extra ? p : 1 - p };
    },
    win: (s) => { for (const p of [0, 1]) if (s.t[p].every((r) => r === 56)) return { p, line: null }; return null; },
    next: (s) => s.nx,
    draw: () => false,
  },
  snl: {
    // Snakes & Ladders, 2 players, squares 1..100 (0 = not started). Exact roll needed to finish on 100.
    init: () => ({ p: [0, 0], last: 0, nx: 0, ev: 0 }),
    moves: (s, p) => (s.nx === p ? [-1] : []),
    play: (s, m, p, rnd) => {
      const d = 1 + Math.floor(rnd() * 6), pos = s.p.slice(); let np = pos[p] + d; if (np > 100) np = pos[p];
      const jump = SNL_JUMPS[np], ev = jump ? (jump > np ? 1 : -1) : 0; if (jump) np = jump; pos[p] = np;
      return { p: pos, last: d, nx: d === 6 && np !== 100 ? p : 1 - p, ev };
    },
    win: (s) => { for (const p of [0, 1]) if (s.p[p] === 100) return { p, line: null }; return null; },
    next: (s) => s.nx,
    draw: () => false,
  },
};
const HUB_GAMES = [
  { id: "ttt", name: "Tic-Tac-Toe", emoji: "✖️", color: "#35D0BA", blurb: "Three in a row", ready: true },
  { id: "c4", name: "Connect 4", emoji: "🔴", color: "#FF4FA3", blurb: "Drop discs, link four", ready: true },
  { id: "snl", name: "Snakes & Ladders", emoji: "🐍", color: "#2DD4A0", blurb: "Climb up, slide down", ready: true },
  { id: "whot", name: "Smart Whot", emoji: "🃏", color: "#F5B83D", blurb: "Card game" },
  { id: "chess", name: "Chess", emoji: "♟️", color: "#8B5CF6", blurb: "Classic strategy" },
  { id: "checkers", name: "Checkers", emoji: "🏁", color: "#4C8DFF", blurb: "Jump and capture" },
  { id: "ludo", name: "Ludo", emoji: "🎲", color: "#FF7A45", blurb: "Roll, race, capture", ready: true },
  { id: "dominoes", name: "Dominoes", emoji: "🧩", color: "#2DD4A0", blurb: "Match the tiles" },
];
const hubName = (id) => (HUB_GAMES.find((g) => g.id === id) || { name: id }).name;
const LEVELS = ["Easy", "Medium", "Hard", "Expert"];
const PCOL = ["#35D0BA", "#FF4FA3"];
const ROBOT = { id: "robot", name: "Robot", initials: "🤖", color: "#8B5CF6", level: 0, robot: true };
const GLASS = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.11)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderRadius: 20 };
const rankName = (lv) => (lv >= 10 ? "Legend" : lv >= 6 ? "Pro" : lv >= 3 ? "Challenger" : "Rookie");
const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "🌍");
const hubPing = () => { try { if (typeof playPing === "function") playPing(); } catch (e) {} };

// ---- robot brain: negamax with alpha-beta; lower levels also blunder on purpose ----
function robotNega(game, s, p, d, a, b) {
  const R = GAME_RULES[game], w = R.win(s);
  if (w) return w.p === p ? 1000 + d : -1000 - d;
  const mv = R.moves(s);
  if (!mv.length) return 0;
  if (d === 0) { if (game !== "c4") return 0; let v = 0; for (let r = 0; r < 6; r++) { const x = s[r * 7 + 3]; if (x != null) v += x === p ? 3 : -3; } return v; }
  let best = -1e9;
  for (const m of mv.slice().sort((x, y) => Math.abs(x - 3) - Math.abs(y - 3))) {
    const v = -robotNega(game, R.play(s, m, p), 1 - p, d - 1, -b, -a);
    if (v > best) best = v; if (best > a) a = best; if (a >= b) break;
  }
  return best;
}
function robotPick(game, s, me, level) {
  if (game === "ludo") return ludoPick(s, me, level);
  if (game === "snl") return -1;
  const R = GAME_RULES[game], mv = R.moves(s);
  if (Math.random() < [0.7, 0.35, 0.1, 0][level]) return mv[Math.floor(Math.random() * mv.length)];
  const depth = game === "ttt" ? 9 : [1, 3, 5, 6][level];
  let best = -1e9, picks = [];
  for (const m of mv) {
    const v = -robotNega(game, R.play(s, m, me), 1 - me, depth - 1, -1e9, 1e9);
    if (v > best) { best = v; picks = [m]; } else if (v === best) picks.push(m);
  }
  return picks[Math.floor(Math.random() * picks.length)];
}

// ---- Ludo: robot brain and board ----
function ludoPick(s, me, level) {
  const R = GAME_RULES.ludo, mv = R.moves(s, me);
  if (mv[0] === -1) return -1;
  if (Math.random() < [0.8, 0.4, 0.1, 0][level]) return mv[Math.floor(Math.random() * mv.length)];
  let best = -1e9, pick = mv[0];
  for (const m of mv) {
    const ns = R.play(s, m, me, () => 0.5), r0 = s.t[me][m], r1 = ns.t[me][m];
    let v = (r1 === 56 ? 40 : 0) + (r0 === -1 ? 25 : 0) + r1 * 0.3 + Math.random();
    ns.t[1 - me].forEach((q, j) => { if (q === -1 && s.t[1 - me][j] !== -1) v += 50; });
    if (r1 <= 50) {
      const a = (me * 26 + r1) % 52;
      if (LUDO_SAFE.includes(a)) v += 12;
      else if (level >= 2) s.t[1 - me].forEach((q) => { if (q >= 0 && q <= 50) { const gap = (a - ((1 - me) * 26 + q) + 52) % 52; if (gap >= 1 && gap <= 6) v -= level === 3 ? 30 : 18; } });
    }
    if (v > best) { best = v; pick = m; }
  }
  return pick;
}
const LUDO_RING = [[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
function ludoXY(p, r, i) {
  if (r === -1) return [[[1.5,1.5],[3.5,1.5],[1.5,3.5],[3.5,3.5]], [[10.5,10.5],[12.5,10.5],[10.5,12.5],[12.5,12.5]]][p][i];
  if (r === 56) return [7.5 + (p ? 1 : -1) * 0.95, 7.5 + (i - 1.5) * 0.3];
  const c = r > 50 ? [7, p ? 64 - r : r - 50] : LUDO_RING[(p * 26 + r) % 52];
  return [c[1] + 0.5, c[0] + 0.5];
}
function LudoBoard({ s, you, myTurn, onTap }) {
  const R = GAME_RULES.ludo, canRoll = myTurn && s.d == null, legal = myTurn && s.d != null ? R.moves(s, you) : [];
  const kids = [gh("rect", { key: "bg", x: 0, y: 0, width: 15, height: 15, rx: 0.6, fill: "#0F141C" }),
    gh("rect", { key: "b0", x: 0, y: 0, width: 6, height: 6, rx: 0.5, fill: PCOL[0] + "22" }), gh("rect", { key: "b1", x: 9, y: 9, width: 6, height: 6, rx: 0.5, fill: PCOL[1] + "22" }),
    gh("rect", { key: "b2", x: 9, y: 0, width: 6, height: 6, rx: 0.5, fill: "#ffffff08" }), gh("rect", { key: "b3", x: 0, y: 9, width: 6, height: 6, rx: 0.5, fill: "#ffffff08" }),
    gh("rect", { key: "ct", x: 6, y: 6, width: 3, height: 3, fill: "#1B1440", stroke: "#8B5CF6", strokeWidth: 0.06 })];
  LUDO_RING.forEach((c, i) => kids.push(gh("rect", { key: "r" + i, x: c[1] + 0.04, y: c[0] + 0.04, width: 0.92, height: 0.92, rx: 0.15, fill: i === 0 ? PCOL[0] + "77" : i === 26 ? PCOL[1] + "77" : "#1B2330" }),
    LUDO_SAFE.includes(i) ? gh("text", { key: "s" + i, x: c[1] + 0.5, y: c[0] + 0.75, fontSize: 0.6, textAnchor: "middle", fill: "#8891A0" }, "★") : null));
  for (let k = 1; k <= 5; k++) kids.push(gh("rect", { key: "h0" + k, x: k + 0.04, y: 7.04, width: 0.92, height: 0.92, rx: 0.15, fill: PCOL[0] + "55" }), gh("rect", { key: "h1" + k, x: 14 - k + 0.04, y: 7.04, width: 0.92, height: 0.92, rx: 0.15, fill: PCOL[1] + "55" }));
  const seen = {};
  [0, 1].forEach((p) => s.t[p].forEach((r, i) => {
    let [x, y] = ludoXY(p, r, i); const key = x + "," + y, n = seen[key] || 0; seen[key] = n + 1; x += n * 0.14; y -= n * 0.14;
    const can = p === you && legal.includes(i);
    kids.push(gh("circle", { key: "t" + p + i, cx: x, cy: y, r: 0.36, fill: PCOL[p], stroke: can ? "#fff" : "#0B0F16", strokeWidth: can ? 0.14 : 0.07, style: { cursor: can ? "pointer" : "default", filter: can ? "drop-shadow(0 0 0.35px #fff)" : "none" }, onClick: can ? () => onTap(i) : undefined, role: can ? "button" : undefined, "aria-label": can ? "Move piece " + (i + 1) : undefined }));
  }));
  return gh("div", { style: { width: "100%", maxWidth: 360 } },
    gh("svg", { viewBox: "0 0 15 15", style: { width: "100%", display: "block", borderRadius: 16, boxShadow: "0 0 24px rgba(139,92,246,.3)" } }, kids),
    gh("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "12px 0 4px" } },
      gh("button", { onClick: () => onTap(-1), disabled: !canRoll, "aria-label": "Roll the dice", style: { width: 64, height: 64, borderRadius: 18, border: "1px solid " + (canRoll ? "#F5B83D" : "rgba(255,255,255,.14)"), background: canRoll ? "rgba(245,184,61,.18)" : "rgba(255,255,255,.05)", boxShadow: canRoll ? "0 0 20px rgba(245,184,61,.55)" : "none", fontSize: 40, cursor: canRoll ? "pointer" : "default", color: "#F5F7FA" } }, s.last ? String.fromCodePoint(0x267F + s.last) : "🎲"),
      gh("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#C9D1DC", maxWidth: 190 } }, myTurn ? (s.d == null ? "Tap the dice to roll." : legal.length > 1 ? "Tap a glowing piece to move it." : "Moving…") : "Waiting for the other player.")),
    gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#8891A0", textAlign: "center", paddingBottom: 6 } }, "Roll a 6 to leave base. A 6 or a capture gives another roll."));
}

// ---- Snakes & Ladders: board ----
function snlXY(n) { const r = Math.floor((n - 1) / 10), c = r % 2 ? 9 - ((n - 1) % 10) : (n - 1) % 10; return [c + 0.5, 9 - r + 0.5]; }
function SnlBoard({ s, you, myTurn, onTap }) {
  const canRoll = myTurn;
  const kids = [];
  for (let n = 1; n <= 100; n++) { const [x, y] = snlXY(n); kids.push(gh("rect", { key: "c" + n, x: x - 0.5 + 0.02, y: y - 0.5 + 0.02, width: 0.96, height: 0.96, rx: 0.12, fill: (Math.floor((n - 1) / 10) + n) % 2 ? "#1B2330" : "#141B26" }), gh("text", { key: "n" + n, x: x - 0.4, y: y - 0.26, fontSize: 0.3, fill: "#5B6673" }, n)); }
  Object.keys(SNL_JUMPS).forEach((k) => {
    const a = +k, b = SNL_JUMPS[k], [x1, y1] = snlXY(a), [x2, y2] = snlXY(b), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
    if (b > a) {
      kids.push(gh("g", { key: "L" + a, stroke: "#F5B83D", strokeLinecap: "round", opacity: 0.9 }, gh("line", { x1: x1 + px * 0.12, y1: y1 + py * 0.12, x2: x2 + px * 0.12, y2: y2 + py * 0.12, strokeWidth: 0.07 }), gh("line", { x1: x1 - px * 0.12, y1: y1 - py * 0.12, x2: x2 - px * 0.12, y2: y2 - py * 0.12, strokeWidth: 0.07 }),
        [0.2, 0.4, 0.6, 0.8].map((t) => gh("line", { key: t, x1: x1 + dx * t + px * 0.12, y1: y1 + dy * t + py * 0.12, x2: x1 + dx * t - px * 0.12, y2: y1 + dy * t - py * 0.12, strokeWidth: 0.05 }))));
    } else {
      kids.push(gh("g", { key: "S" + a, opacity: 0.9 }, gh("path", { d: "M" + x1 + " " + y1 + " Q" + ((x1 + x2) / 2 + px * 1.1) + " " + ((y1 + y2) / 2 + py * 1.1) + " " + x2 + " " + y2, fill: "none", stroke: "#FF4FA3", strokeWidth: 0.17, strokeLinecap: "round" }), gh("circle", { cx: x1, cy: y1, r: 0.2, fill: "#FF4FA3" }), gh("circle", { cx: x1 - 0.06, cy: y1 - 0.05, r: 0.04, fill: "#fff" }), gh("circle", { cx: x1 + 0.06, cy: y1 - 0.05, r: 0.04, fill: "#fff" })));
    }
  });
  [0, 1].forEach((p) => { const n = s.p[p], [x, y] = n === 0 ? [p ? 9.6 : 0.4, 10.35] : snlXY(n), off = n > 0 && s.p[0] === s.p[1] ? (p ? 0.18 : -0.18) : 0; kids.push(gh("circle", { key: "t" + p, cx: x + off, cy: y, r: 0.3, fill: PCOL[p], stroke: "#0B0F16", strokeWidth: 0.07, style: { filter: "drop-shadow(0 0 0.25px " + PCOL[p] + ")", transition: "all .35s" } })); });
  return gh("div", { style: { width: "100%", maxWidth: 360 } },
    gh("svg", { viewBox: "0 0 10 10.8", style: { width: "100%", display: "block", borderRadius: 16, background: "#0F141C", boxShadow: "0 0 24px rgba(45,212,160,.25)" } }, kids),
    gh("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "12px 0 4px" } },
      gh("button", { onClick: () => onTap(-1), disabled: !canRoll, "aria-label": "Roll the dice", style: { width: 64, height: 64, borderRadius: 18, border: "1px solid " + (canRoll ? "#F5B83D" : "rgba(255,255,255,.14)"), background: canRoll ? "rgba(245,184,61,.18)" : "rgba(255,255,255,.05)", boxShadow: canRoll ? "0 0 20px rgba(245,184,61,.55)" : "none", fontSize: 40, cursor: canRoll ? "pointer" : "default", color: "#F5F7FA" } }, s.last ? String.fromCodePoint(0x267F + s.last) : "🎲"),
      gh("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#C9D1DC", maxWidth: 190 } }, (s.ev === 1 ? "🪜 Ladder! Climbed up. " : s.ev === -1 ? "🐍 Snake! Slid down. " : "") + (myTurn ? "Tap the dice to roll." : "Waiting for the other player."))),
    gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#8891A0", textAlign: "center", paddingBottom: 6 } }, "Reach 100 with an exact roll. A 6 gives another roll."));
}

function hubBtn(label, onClick, o = {}) {
  return gh("button", { onClick, disabled: o.disabled, "aria-label": o.aria || label, style: { border: o.ghost ? "1px solid rgba(255,255,255,0.18)" : "none", cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.45 : 1, borderRadius: 999, padding: o.small ? "7px 14px" : "12px 20px", fontFamily: "Sora", fontWeight: 700, fontSize: o.small ? 12.5 : 14.5, color: o.ghost ? "#E8ECF2" : "#04110F", background: o.ghost ? "transparent" : (o.bg || "linear-gradient(135deg,#35D0BA,#6EE7D2)"), boxShadow: o.ghost || o.disabled ? "none" : "0 0 18px " + (o.glow || "rgba(53,208,186,0.45)"), ...(o.style || {}) } }, label);
}

function PlayerCard({ p, onPlay, onChallenge }) {
  const dot = { online: "#35D0BA", looking: "#F5B83D", playing: "#FF4FA3" }[p.status] || "#5B6673";
  const label = { online: "Online", looking: "Wants a game", playing: "In a game", offline: "Offline" }[p.status];
  return gh("div", { style: { ...GLASS, padding: 12, display: "flex", alignItems: "center", gap: 12 } },
    gh(Ring, { size: 48, color: p.color, initials: p.initials, photo: p.avatar, online: p.status !== "offline" }),
    gh("div", { style: { flex: 1, minWidth: 0 } },
      gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, flag(p.country) + " " + (p.username || p.name)),
      gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 2 } }, "Lv " + p.level + " " + rankName(p.level) + " · " + p.w + "W " + p.l + "L"),
      gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, marginTop: 3, color: dot, display: "flex", alignItems: "center", gap: 5 } },
        gh("span", { style: { width: 7, height: 7, borderRadius: 4, background: dot, boxShadow: "0 0 8px " + dot } }), label + (p.fav ? " · Likes " + hubName(p.fav) : ""))),
    p.status === "playing" ? null : gh("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      hubBtn("Play", onPlay, { small: true, aria: "Invite " + p.name + " to play" }),
      hubBtn("Challenge", onChallenge, { small: true, ghost: true, aria: "Challenge " + p.name })));
}

// ---- the game room: board, avatars, score, turn, live chat, reactions, rematch, exit ----
function GameRoom({ cfg, socket, myId, onExit, onCall, convo }) {
  const R = GAME_RULES[cfg.game], robot = cfg.mode === "robot";
  const [g, setG] = useState({ you: cfg.you, players: cfg.players, state: cfg.state || R.init(), turn: cfg.turn || 0, over: false, winner: null, line: null, score: cfg.score || [0, 0], reward: null, note: "", asked: false, theyAsked: false });
  const [msgs, setMsgs] = useState([]); const [text, setText] = useState(""); const [floats, setFloats] = useState([]);
  const gRef = useRef(g); gRef.current = g;
  const robotIdx = 1 - g.you;
  const float = (e) => { const id = Math.random(); setFloats((f) => [...f, { id, e, x: 15 + Math.random() * 70 }]); setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800); };
  const finish = (state, w, idx) => {
    const cur = gRef.current, full = R.draw ? R.draw(state) : R.moves(state).length === 0;
    if (!w && !full) { setG((p) => ({ ...p, state, turn: R.next ? R.next(state) : 1 - idx })); return; }
    const result = !w ? "d" : w.p === cur.you ? "w" : "l";
    const score = cur.score.slice(); if (w) score[w.p] += 1;
    setG((p) => ({ ...p, state, turn: -1, over: true, winner: w ? w.p : -1, line: w ? w.line : null, score, reward: null }));
    if (socket) socket.emit("game:solo", { game: cfg.game, level: cfg.level, result }, (r) => r && setG((p) => ({ ...p, reward: r })));
  };
  const place = (m, idx) => { const state = R.play(gRef.current.state, m, idx, Math.random); finish(state, R.win(state), idx); };
  const tap = (m) => {
    if (g.over || g.turn !== g.you || !R.moves(g.state, g.you).includes(m)) return;
    if (robot) place(m, g.you); else socket.emit("game:move", { room: cfg.room, move: m });
  };
  useEffect(() => {
    if (!robot || g.over || g.turn !== robotIdx) return;
    const t = setTimeout(() => { const m = robotPick(cfg.game, gRef.current.state, robotIdx, cfg.level); if (m != null) place(m, robotIdx); }, 550 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [g.turn, g.over, g.state]);
  useEffect(() => { if (!robot && !g.over && g.turn === g.you) hubPing(); }, [g.turn]);
  useEffect(() => {
    if (robot || !socket) return;
    const mine = (d) => d.room === cfg.room;
    const hs = {
      "game:move": (d) => mine(d) && setG((p) => ({ ...p, state: d.state, turn: d.turn })),
      "game:over": (d) => mine(d) && setG((p) => ({ ...p, over: true, turn: -1, winner: d.winner, line: d.line, score: d.score, reward: d.reward, note: d.forfeit ? "Your opponent left, so you win." : "" })),
      "game:chat": (d) => mine(d) && setMsgs((m) => [...m.slice(-40), d]),
      "game:react": (d) => mine(d) && float(d.emoji),
      "game:rematch-request": (d) => mine(d) && setG((p) => ({ ...p, theyAsked: true })),
      "game:start": (d) => { if (d.room === cfg.room && d.rematch) setG({ you: d.you, players: d.players, state: d.state, turn: d.turn, over: false, winner: null, line: null, score: d.score, reward: null, note: "", asked: false, theyAsked: false }); },
      "game:left": (d) => mine(d) && setG((p) => ({ ...p, gone: true })),
    };
    for (const k in hs) socket.on(k, hs[k]);
    return () => { for (const k in hs) socket.off(k, hs[k]); };
  }, []);
  const rematch = () => {
    if (robot) { const you = 1 - g.you; setG({ you, players: [g.players[1], g.players[0]], state: R.init(), turn: 0, over: false, winner: null, line: null, score: [g.score[1], g.score[0]], reward: null, note: "", asked: false, theyAsked: false }); return; }
    setG((p) => ({ ...p, asked: true })); socket.emit("game:rematch", { room: cfg.room });
  };
  const send = () => { const t = text.trim(); if (!t) return; socket.emit("game:chat", { room: cfg.room, text: t }); setText(""); };
  const react = (e) => (robot ? float(e) : socket.emit("game:react", { room: cfg.room, emoji: e }));
  const myTurn = !g.over && g.turn === g.you;
  const chip = (i) => {
    const p = g.players[i], on = !g.over && g.turn === i;
    return gh("div", { style: { flex: 1, display: "flex", alignItems: "center", gap: 8, flexDirection: i ? "row-reverse" : "row", padding: 8, borderRadius: 18, border: "1px solid " + (on ? PCOL[i] : "rgba(255,255,255,0.1)"), boxShadow: on ? "0 0 18px " + PCOL[i] + "88" : "none", transition: "box-shadow .25s, border-color .25s", background: "rgba(255,255,255,0.05)" } },
      gh(Ring, { size: 40, color: p.color, initials: p.initials, photo: p.avatar, online: true }),
      gh("div", { style: { minWidth: 0, textAlign: i ? "right" : "left", flex: 1 } },
        gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 13, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (i === g.you ? "You" : p.name)),
        gh("div", { style: { fontFamily: "Inter", fontSize: 11, color: PCOL[i] } }, (cfg.game === "ttt" ? (i ? "O" : "X") : (i ? "Pink" : "Teal")) + (p.robot ? " · " + LEVELS[cfg.level] : " · Lv " + p.level))),
      gh("div", { style: { fontFamily: "Sora", fontWeight: 800, fontSize: 24, color: "#F5F7FA" } }, g.score[i]));
  };
  const hit = (i) => g.line && g.line.includes(i);
  const cells = !Array.isArray(g.state) ? null : g.state.map((v, i) => {
    const col = v == null ? null : PCOL[v];
    if (cfg.game === "ttt") return gh("button", { key: i, onClick: () => tap(i), "aria-label": "Cell " + (i + 1), style: { aspectRatio: "1", borderRadius: 16, border: "1px solid " + (hit(i) ? col : "rgba(255,255,255,0.12)"), background: hit(i) ? col + "30" : "rgba(255,255,255,0.05)", color: col, fontFamily: "Sora", fontWeight: 800, fontSize: 44, cursor: myTurn && v == null ? "pointer" : "default", textShadow: v == null ? "none" : "0 0 14px " + col } }, v == null ? "" : v === 0 ? "X" : "O");
    return gh("button", { key: i, onClick: () => tap(i % 7), "aria-label": "Column " + ((i % 7) + 1), style: { aspectRatio: "1", padding: 0, border: "none", background: "transparent", cursor: myTurn ? "pointer" : "default" } },
      gh("div", { style: { width: "84%", height: "84%", margin: "8%", borderRadius: "50%", background: col || "#0A0E14", boxShadow: col ? "0 0 " + (hit(i) ? 16 : 8) + "px " + col : "inset 0 2px 6px rgba(0,0,0,.7)", border: hit(i) ? "2px solid #fff" : "none" } }));
  });
  const verdict = !g.over ? null : g.winner === -1 ? "It's a draw" : g.winner === g.you ? "You won!" : (robot ? "Robot won" : g.players[g.winner].name + " won");
  return gh("div", { style: { display: "flex", flexDirection: "column", height: "100%", background: "radial-gradient(120% 60% at 50% 0%, #1B1440 0%, #0B0F16 60%)" } },
    gh("div", { style: { display: "flex", gap: 8, padding: "12px 12px 6px", alignItems: "center" } }, chip(0), gh("div", { style: { fontFamily: "Sora", fontSize: 12, color: "#8891A0" } }, "vs"), chip(1)),
    gh("div", { role: "status", style: { textAlign: "center", fontFamily: "Sora", fontWeight: 700, fontSize: 14, padding: "4px 0 8px", color: g.over ? "#F5B83D" : myTurn ? PCOL[g.you] : "#9BA7B4" } }, g.over ? (verdict + (g.reward ? "  +" + g.reward.gain + " XP" : "")) : myTurn ? "Your turn" : (robot ? "Robot is thinking…" : g.players[g.turn].name + " is playing…")),
    g.note || g.gone ? gh("div", { style: { textAlign: "center", fontFamily: "Inter", fontSize: 12.5, color: "#F5B83D", paddingBottom: 6 } }, g.note || "Your opponent left the room.") : null,
    gh("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 14px", position: "relative" } },
      cfg.game === "ludo" ? gh(LudoBoard, { s: g.state, you: g.you, myTurn, onTap: tap }) : cfg.game === "snl" ? gh(SnlBoard, { s: g.state, you: g.you, myTurn, onTap: tap }) : gh("div", { style: { width: "100%", maxWidth: cfg.game === "c4" ? 380 : 320, display: "grid", gridTemplateColumns: "repeat(" + (cfg.game === "c4" ? 7 : 3) + ",1fr)", gap: cfg.game === "c4" ? 0 : 10, padding: cfg.game === "c4" ? 6 : 0, borderRadius: 20, background: cfg.game === "c4" ? "linear-gradient(160deg,#2A2D6B,#171A45)" : "none", boxShadow: cfg.game === "c4" ? "0 0 26px rgba(139,92,246,.35)" : "none" } }, cells),
      floats.map((f) => gh("div", { key: f.id, style: { position: "absolute", bottom: 8, left: f.x + "%", fontSize: 34, animation: "hubFloat 1.8s ease-out forwards", pointerEvents: "none" } }, f.e))),
    gh("div", { style: { ...GLASS, borderRadius: 0, borderLeft: "none", borderRight: "none", padding: "8px 12px 10px", flexShrink: 0 } },
      gh("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8 } },
        ["👍", "😂", "😮", "🔥", "👏", "😡"].map((e) => gh("button", { key: e, onClick: () => react(e), "aria-label": "React " + e, style: { background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 12, padding: "5px 9px", fontSize: 18, cursor: "pointer" } }, e)),
        gh("div", { style: { flex: 1 } }),
        !robot && convo ? hubBtn("🎙 Voice", () => onCall(convo, false), { small: true, ghost: true, aria: "Start voice call" }) : null),
      robot ? gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#8891A0", padding: "2px 2px 8px" } }, "Chat opens when you play a real person.") : gh("div", null,
        gh("div", { style: { maxHeight: 74, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 } }, msgs.length ? msgs.map((m, i) => gh("div", { key: i, style: { fontFamily: "Inter", fontSize: 13, color: m.from === myId ? "#35D0BA" : "#FF8FC4" } }, (m.from === myId ? "You: " : "Them: ") + m.text)) : gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#8891A0" } }, "Say hi while you play.")),
        gh("div", { style: { display: "flex", gap: 8, marginBottom: 8 } },
          gh("input", { value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => e.key === "Enter" && send(), placeholder: "Type a message", "aria-label": "Game chat", style: { flex: 1, minWidth: 0, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "9px 14px", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14, outline: "none" } }),
          hubBtn("Send", send, { small: true }))),
      gh("div", { style: { display: "flex", gap: 10 } },
        hubBtn(g.theyAsked ? "Accept rematch" : g.asked ? "Waiting…" : "Rematch", rematch, { disabled: !g.over || g.asked || g.gone, style: { flex: 1 }, bg: "linear-gradient(135deg,#8B5CF6,#FF4FA3)", glow: "rgba(139,92,246,.5)" }),
        hubBtn("Exit game", onExit, { ghost: true, style: { flex: 1 } }))));
}

// ---- hub: tabs, setup sheet, lobby, rankings, notifications, challenge pop-ups ----
function GamesHub({ active, myId, me, socketRef, conversations = [], onCall, goGames }) {
  const [sub, setSub] = useState("play"); const [sk, setSk] = useState(null);
  const [lobby, setLobby] = useState({ players: [], recent: [], me: null });
  const [setup, setSetup] = useState(null); const [room, setRoom] = useState(null); const [searching, setSearching] = useState(null);
  const [invites, setInvites] = useState([]); const [alerts, setAlerts] = useState([]); const [unread, setUnread] = useState(0); const [bell, setBell] = useState(false);
  const [arcade, setArcade] = useState(false); const [period, setPeriod] = useState("day"); const [board, setBoard] = useState({ rows: [], me: null });
  const [toast, setToast] = useState("");
  const roomRef = useRef(room); roomRef.current = room; const activeRef = useRef(active); activeRef.current = active;
  const sock = () => socketRef.current;
  const alertNow = (icon, text) => { setAlerts((a) => [{ id: Math.random(), icon, text, at: Date.now() }, ...a].slice(0, 30)); setUnread((n) => n + 1); setToast(icon + " " + text); setTimeout(() => setToast(""), 3500); };
  const refresh = () => { const s = sock(); if (s) s.emit("game:lobby", setLobby); };
  useEffect(() => { const t = setInterval(() => { if (socketRef.current !== sk) setSk(socketRef.current); }, 700); return () => clearInterval(t); }, [sk]);
  useEffect(() => { if (!sk) return; refresh(); const t = setInterval(() => activeRef.current && refresh(), 8000); return () => clearInterval(t); }, [sk]);
  useEffect(() => { if (active) { refresh(); setUnread(0); } }, [active]);
  useEffect(() => { if (sk && active && sub === "ranks") sk.emit("game:board", { period }, setBoard); }, [sk, active, sub, period, room]);
  useEffect(() => {
    if (!sk) return;
    const hs = {
      "game:invite": (d) => { setInvites((v) => [...v, d]); alertNow("⚔️", d.from.name + (d.kind === "challenge" ? " challenged you to " : " invited you to play ") + hubName(d.game)); hubPing(); },
      "game:invite-expired": (d) => setInvites((v) => v.filter((i) => i.id !== d.id)),
      "game:accepted": (d) => alertNow("✅", d.by.name + " accepted your game"),
      "game:declined": (d) => alertNow("🙈", d.by.name + " declined your invite"),
      "game:start": (d) => { if (d.rematch) return; setSearching(null); setSetup(null); setInvites([]); setArcade(false); setRoom({ mode: "online", room: d.room, game: d.game, you: d.you, players: d.players, state: d.state, turn: d.turn, score: d.score }); goGames(); refresh(); },
      "game:over": (d) => alertNow(d.result === "w" ? "🏆" : d.result === "l" ? "💔" : "🤝", d.result === "w" ? "You won! +" + (d.reward ? d.reward.gain : 0) + " XP" : d.result === "l" ? "You lost this one. Rematch?" : "It was a draw"),
      "game:rematch-request": (d) => alertNow("🔁", d.from.name + " wants a rematch"),
      "game:move": (d) => { if (d.next === myId && !activeRef.current) { alertNow("⏰", "Your turn"); hubPing(); } },
    };
    for (const k in hs) sk.on(k, hs[k]);
    return () => { for (const k in hs) sk.off(k, hs[k]); };
  }, [sk]);
  const meCard = lobby.me || { id: myId, name: me.name, initials: me.initials, color: me.color, avatar: me.avatar, level: 1, xp: 0, w: 0, l: 0, d: 0, streak: 0, best: 0 };
  const startRobot = (game, level) => setRoom({ mode: "robot", game, level, you: 0, players: [meCard, ROBOT], score: [0, 0] });
  const findRandom = (game) => { const s = sock(); if (!s) return; setSearching({ game }); s.emit("game:find", { game }, (r) => r && !r.ok && setSearching(null)); };
  const invite = (p, game, kind) => {
    const s = sock(); if (!s) return;
    s.emit("game:invite", { to: p.id, game, kind }, (r) => {
      if (!r || !r.ok) return alertNow("⚠️", p.name + (r && r.reason === "busy" ? " is in a game" : " is not available"));
      alertNow("📨", "Invite sent to " + p.name);
      const c = conversations.find((x) => !x.isGroup && x.other && x.other.id === p.id);
      if (c) s.emit("message:send", { conversationId: c.id, text: "🎮 " + (kind === "challenge" ? "I challenge you to " : "Let's play ") + hubName(game) + "! Open the Games tab to accept." });
    });
  };
  const go = (patch) => {
    const s = { ...(setup || {}), ...patch };
    if (s.mode === "random" && s.game) { setSetup(null); return findRandom(s.game); }
    if (s.mode === "friend" && s.game && s.player) { setSetup(null); return invite(s.player, s.game, s.kind || "invite"); }
    if (s.mode === "robot" && s.game && s.level != null) { setSetup(null); return startRobot(s.game, s.level); }
    setSetup(s);
  };
  const respond = (iv, accept) => { sock().emit("game:respond", { id: iv.id, accept }); setInvites((v) => v.filter((i) => i.id !== iv.id)); };
  const exitRoom = () => { const r = roomRef.current; if (r && r.mode === "online" && sock()) sock().emit("game:leave"); setRoom(null); refresh(); };
  const dmOf = (id) => conversations.find((x) => !x.isGroup && x.other && x.other.id === id);
  const others = lobby.players;
  const section = (title, list, empty) => gh("div", { style: { marginBottom: 18 } },
    gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: "#F5F7FA", margin: "0 2px 8px" } }, title + " (" + list.length + ")"),
    list.length ? gh("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, list.map((p) => gh(PlayerCard, { key: p.id, p, onPlay: () => go({ mode: "friend", player: p, kind: "invite" }), onChallenge: () => go({ mode: "friend", player: p, kind: "challenge" }) }))) : gh("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#8891A0", padding: "2px 2px" } }, empty));
  const xpInLevel = meCard.xp % 100;
  const badges = [["🏆", "Champion", "Win 10 games", meCard.w >= 10], ["🔥", "Win Streak", "Win 3 in a row", meCard.best >= 3], ["🎯", "Master Player", "Reach level 5", meCard.level >= 5], ["👑", "Top Player", "Be #1 on a leaderboard", board.rows[0] && board.rows[0].user.id === myId], ["⭐", "Rising Star", "Win 3 games", meCard.w >= 3]];

  const playTab = gh("div", null,
    gh("div", { style: { ...GLASS, padding: 14, display: "flex", gap: 12, alignItems: "center", marginBottom: 14, boxShadow: "0 0 24px rgba(139,92,246,.18)" } },
      gh(Ring, { size: 52, color: meCard.color, initials: meCard.initials, photo: meCard.avatar, online: true }),
      gh("div", { style: { flex: 1 } },
        gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: "#F5F7FA" } }, "Level " + meCard.level + " " + rankName(meCard.level)),
        gh("div", { style: { height: 7, borderRadius: 4, background: "rgba(255,255,255,0.1)", margin: "7px 0 5px", overflow: "hidden" } }, gh("div", { style: { width: xpInLevel + "%", height: "100%", background: "linear-gradient(90deg,#35D0BA,#8B5CF6)", transition: "width .6s" } })),
        gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4" } }, xpInLevel + "/100 XP · " + meCard.w + "W " + meCard.l + "L · 🔥 " + meCard.streak))),
    gh("div", { style: { display: "flex", gap: 10, marginBottom: 10 } },
      hubBtn("👥 Find a Player", () => go({ mode: "friend" }), { style: { flex: 1 } }),
      hubBtn("🎲 Random Player", () => go({ mode: "random" }), { style: { flex: 1 }, bg: "linear-gradient(135deg,#FF4FA3,#FF8FC4)", glow: "rgba(255,79,163,.45)" })),
    gh("button", { onClick: () => go({ mode: "robot" }), style: { width: "100%", textAlign: "left", cursor: "pointer", border: "1px solid rgba(139,92,246,.5)", borderRadius: 22, padding: "18px 18px", marginBottom: 18, background: "linear-gradient(135deg,rgba(139,92,246,.35),rgba(53,208,186,.18))", boxShadow: "0 0 26px rgba(139,92,246,.3)", display: "flex", alignItems: "center", gap: 14 } },
      gh("div", { style: { fontSize: 44 } }, "🤖"),
      gh("div", null, gh("div", { style: { fontFamily: "Sora", fontWeight: 800, fontSize: 19, color: "#F5F7FA" } }, "Play vs Robot"), gh("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#C9D1DC", marginTop: 2 } }, "Easy to Expert. Starts right away."))),
    gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: "#F5F7FA", margin: "0 2px 10px" } }, "Pick a game"),
    gh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } },
      HUB_GAMES.map((gm) => gh("button", { key: gm.id, disabled: !gm.ready, onClick: () => go({ game: gm.id, mode: null }), "aria-label": gm.name + (gm.ready ? "" : " coming soon"), style: { textAlign: "left", padding: 0, border: "1px solid " + gm.color + "55", borderRadius: 20, overflow: "hidden", cursor: gm.ready ? "pointer" : "default", background: "#121821", opacity: gm.ready ? 1 : 0.6 } },
        gh("div", { style: { height: 84, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, background: "linear-gradient(145deg," + gm.color + "55," + gm.color + "10)" } }, gm.emoji),
        gh("div", { style: { padding: "10px 12px 12px" } }, gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14.5, color: "#F5F7FA" } }, gm.name), gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: gm.ready ? "#9BA7B4" : "#F5B83D", marginTop: 2 } }, gm.ready ? gm.blurb : "Coming soon")))),
      gh("button", { onClick: () => setArcade(true), style: { textAlign: "left", padding: 0, border: "1px solid rgba(255,255,255,.14)", borderRadius: 20, overflow: "hidden", cursor: "pointer", background: "#121821" } },
        gh("div", { style: { height: 84, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, background: "rgba(255,255,255,0.06)" } }, "🕹️"),
        gh("div", { style: { padding: "10px 12px 12px" } }, gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14.5, color: "#F5F7FA" } }, "Solo arcade"), gh("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 2 } }, "Snake, 2048, Memory")))));

  const lobbyTab = gh("div", null,
    gh("div", { style: { display: "flex", gap: 8, marginBottom: 16 } }, [["Online", others.length, "#35D0BA"], ["Playing", others.filter((p) => p.status === "playing").length, "#FF4FA3"], ["Looking", others.filter((p) => p.status === "looking").length, "#F5B83D"]].map(([l, n, c]) => gh("div", { key: l, style: { ...GLASS, flex: 1, padding: "10px 6px", textAlign: "center" } }, gh("div", { style: { fontFamily: "Sora", fontWeight: 800, fontSize: 22, color: c } }, n), gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#9BA7B4" } }, l)))),
    section("Friends available", others.filter((p) => dmOf(p.id) && p.status !== "playing"), "None of your chat friends are free right now."),
    section("Looking for opponents", others.filter((p) => p.status === "looking"), "Nobody is waiting. Tap Random Player to be the first."),
    section("Playing now", others.filter((p) => p.status === "playing"), "No games running."),
    gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: "#F5F7FA", margin: "0 2px 8px" } }, "Recently played"),
    lobby.recent.length ? lobby.recent.map((r, i) => gh("div", { key: i, style: { ...GLASS, padding: "10px 14px", marginBottom: 8, fontFamily: "Inter", fontSize: 13, color: "#C9D1DC" } }, hubName(r.game) + ": " + (r.aName || "Player") + " vs " + (r.bName || "Player") + (r.w ? " · " + (r.w === r.a ? r.aName : r.bName) + " won" : " · draw"))) : gh("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#8891A0" } }, "Finished games show up here."));

  const ranksTab = gh("div", null,
    gh("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"]].map(([k, l]) => gh("button", { key: k, onClick: () => setPeriod(k), style: { flex: 1, padding: "9px 0", borderRadius: 999, cursor: "pointer", fontFamily: "Sora", fontWeight: 700, fontSize: 13, border: "1px solid " + (period === k ? "#35D0BA" : "rgba(255,255,255,.14)"), background: period === k ? "rgba(53,208,186,.18)" : "transparent", color: period === k ? "#35D0BA" : "#9BA7B4" } }, l))),
    board.rows.length ? board.rows.map((r) => gh("div", { key: r.user.id, style: { ...GLASS, padding: "9px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, borderColor: r.user.id === myId ? "#35D0BA" : "rgba(255,255,255,.11)" } },
      gh("div", { style: { width: 28, textAlign: "center", fontFamily: "Sora", fontWeight: 800, fontSize: 16, color: r.rank === 1 ? "#F5B83D" : "#9BA7B4" } }, r.rank === 1 ? "👑" : r.rank),
      gh(Ring, { size: 38, color: r.user.color, initials: r.user.initials, photo: r.user.avatar }),
      gh("div", { style: { flex: 1, minWidth: 0 } }, gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: "#F5F7FA" } }, r.user.id === myId ? "You" : r.user.username || r.user.name), gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#9BA7B4" } }, "Lv " + r.user.level + " · " + r.xp + " XP earned")),
      gh("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#C9D1DC", textAlign: "right" } }, r.w + "W " + r.l + "L"))) : gh("div", { style: { ...GLASS, padding: 18, textAlign: "center", fontFamily: "Inter", fontSize: 13.5, color: "#9BA7B4", marginBottom: 14 } }, "No ranked games yet this " + period + ". Beat a real player to take the first spot."),
    gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 14, color: "#F5F7FA", margin: "14px 2px 8px" } }, "Your badges"),
    gh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, badges.map(([e, n, how, got]) => gh("div", { key: n, style: { ...GLASS, padding: 12, opacity: got ? 1 : 0.5, borderColor: got ? "#F5B83D" : "rgba(255,255,255,.11)" } }, gh("div", { style: { fontSize: 26, filter: got ? "none" : "grayscale(1)" } }, e), gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 13.5, color: "#F5F7FA", marginTop: 4 } }, n), gh("div", { style: { fontFamily: "Inter", fontSize: 11.5, color: "#9BA7B4" } }, got ? "Unlocked" : how)))));

  // setup sheet (one question at a time: game → how → difficulty / player)
  let sheet = null;
  if (setup) {
    const s = setup; let title, body;
    if (!s.game) { title = "Pick a game"; body = gh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, HUB_GAMES.filter((x) => x.ready).map((gm) => gh("button", { key: gm.id, onClick: () => go({ game: gm.id }), style: { padding: 14, borderRadius: 18, border: "1px solid " + gm.color + "88", background: gm.color + "1f", cursor: "pointer", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 700, fontSize: 14 } }, gh("div", { style: { fontSize: 32 } }, gm.emoji), gm.name))); }
    else if (!s.mode) { title = hubName(s.game) + ": how do you want to play?"; body = gh("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, [["friend", "👥 Play vs Friend", "Invite someone who is online"], ["random", "🎲 Play vs Random Player", "We match you with anyone waiting"], ["robot", "🤖 Play vs Robot", "Practice at your own level"]].map(([m, t, d]) => gh("button", { key: m, onClick: () => go({ mode: m }), style: { textAlign: "left", padding: "14px 16px", borderRadius: 18, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)", cursor: "pointer" } }, gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 15, color: "#F5F7FA" } }, t), gh("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#9BA7B4", marginTop: 2 } }, d)))); }
    else if (s.mode === "robot") { title = "Choose difficulty"; body = gh("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, LEVELS.map((l, i) => gh("button", { key: l, onClick: () => go({ level: i }), style: { padding: "16px 8px", borderRadius: 18, border: "1px solid " + ["#35D0BA", "#F5B83D", "#FF7A45", "#FF4FA3"][i], background: "rgba(255,255,255,.05)", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 700, fontSize: 15, cursor: "pointer" } }, ["🌱", "⚡", "🔥", "💀"][i] + " " + l))); }
    else { title = "Who do you want to play?"; const pool = others.filter((p) => p.status !== "playing").sort((a, b) => !!dmOf(b.id) - !!dmOf(a.id)); body = pool.length ? gh("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, pool.map((p) => gh(PlayerCard, { key: p.id, p, onPlay: () => go({ player: p, kind: "invite" }), onChallenge: () => go({ player: p, kind: "challenge" }) }))) : gh("div", { style: { fontFamily: "Inter", fontSize: 13.5, color: "#9BA7B4", padding: "8px 2px" } }, "No one is online right now. Try Random Player, or play the Robot."); }
    sheet = gh("div", { style: { position: "absolute", inset: 0, zIndex: 20, background: "rgba(3,5,9,.6)", display: "flex", alignItems: "flex-end" }, onClick: () => setSetup(null) },
      gh("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxHeight: "82%", overflowY: "auto", background: "#0F141C", borderTop: "1px solid rgba(139,92,246,.5)", borderRadius: "26px 26px 0 0", padding: "16px 16px 22px", animation: "hubUp .25s ease-out" } },
        gh("div", { style: { display: "flex", alignItems: "center", marginBottom: 14 } }, gh("div", { style: { flex: 1, fontFamily: "Sora", fontWeight: 800, fontSize: 17, color: "#F5F7FA" } }, title), gh("button", { onClick: () => setSetup(null), "aria-label": "Close", style: { background: "none", border: "none", color: "#9BA7B4", cursor: "pointer", fontSize: 20 } }, "✕")), body));
  }

  const popups = gh("div", { style: { position: "fixed", top: 10, left: 10, right: 10, zIndex: 60, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" } },
    invites.map((iv) => gh("div", { key: iv.id, style: { ...GLASS, background: "rgba(15,20,28,.92)", borderColor: "#8B5CF6", padding: 12, pointerEvents: "auto", boxShadow: "0 0 24px rgba(139,92,246,.5)", animation: "hubUp .25s ease-out" } },
      gh("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10 } }, gh(Ring, { size: 40, color: iv.from.color, initials: iv.from.initials, photo: iv.from.avatar }), gh("div", { style: { fontFamily: "Inter", fontSize: 14, color: "#F5F7FA" } }, gh("b", null, iv.from.name), (iv.kind === "challenge" ? " challenged you to " : " invited you to play ") + hubName(iv.game))),
      gh("div", { style: { display: "flex", gap: 10 } }, hubBtn("Accept", () => respond(iv, true), { style: { flex: 1 }, small: true }), hubBtn("Decline", () => respond(iv, false), { style: { flex: 1 }, small: true, ghost: true })))),
    toast && !active ? gh("div", { style: { ...GLASS, background: "rgba(15,20,28,.92)", padding: "10px 14px", fontFamily: "Inter", fontSize: 13.5, color: "#F5F7FA" } }, toast) : null);

  const tabs = gh("div", { role: "tablist", style: { display: "flex", gap: 6, padding: "0 16px 10px" } }, [["play", "🎮 Play"], ["lobby", "👥 Lobby"], ["ranks", "🏆 Ranks"]].map(([k, l]) => gh("button", { key: k, role: "tab", "aria-selected": sub === k, onClick: () => setSub(k), style: { flex: 1, padding: "9px 0", borderRadius: 14, cursor: "pointer", fontFamily: "Sora", fontWeight: 700, fontSize: 13, border: "none", background: sub === k ? "linear-gradient(135deg,rgba(53,208,186,.3),rgba(139,92,246,.3))" : "rgba(255,255,255,.05)", color: sub === k ? "#F5F7FA" : "#8891A0", boxShadow: sub === k ? "0 0 14px rgba(53,208,186,.3)" : "none" } }, l)));
  let main;
  if (room) main = gh(GameRoom, { key: room.room || "robot", cfg: room, socket: sock(), myId, onExit: exitRoom, onCall, convo: room.mode === "online" ? dmOf((room.players.find((p) => p.id !== myId) || {}).id) : null });
  else if (arcade) main = gh("div", { style: { display: "flex", flexDirection: "column", height: "100%" } }, gh("button", { onClick: () => setArcade(false), style: { background: "none", border: "none", color: "#35D0BA", fontFamily: "Sora", fontWeight: 700, fontSize: 14, textAlign: "left", padding: "12px 16px 0", cursor: "pointer" } }, "← Back to Games"), gh("div", { style: { flex: 1, minHeight: 0 } }, gh(GamesScreen, { myId })));
  else main = gh(React.Fragment, null,
    gh("div", { style: { display: "flex", alignItems: "center", padding: "14px 16px 10px" } }, gh("div", { style: { flex: 1, fontFamily: "Sora", fontWeight: 800, fontSize: 24, color: "#F5F7FA" } }, "Games"),
      gh("button", { onClick: () => { setBell(true); setUnread(0); }, "aria-label": "Game notifications", style: { position: "relative", background: "rgba(255,255,255,.07)", border: "none", borderRadius: 14, padding: "8px 11px", fontSize: 18, cursor: "pointer" } }, "🔔", unread ? gh("span", { style: { position: "absolute", top: -4, right: -4, background: "#FF4FA3", color: "#fff", borderRadius: 10, fontSize: 10.5, fontFamily: "Sora", fontWeight: 700, padding: "1px 6px" } }, unread) : null)),
    tabs, gh("div", { style: { flex: 1, overflowY: "auto", padding: "4px 16px 24px", WebkitOverflowScrolling: "touch" } }, sub === "play" ? playTab : sub === "lobby" ? lobbyTab : ranksTab));
  const bellPanel = bell ? gh("div", { style: { position: "absolute", inset: 0, zIndex: 30, background: "rgba(3,5,9,.6)", display: "flex", alignItems: "flex-end" }, onClick: () => setBell(false) }, gh("div", { onClick: (e) => e.stopPropagation(), style: { width: "100%", maxHeight: "75%", overflowY: "auto", background: "#0F141C", borderRadius: "26px 26px 0 0", padding: "16px 16px 22px", borderTop: "1px solid rgba(53,208,186,.5)" } },
    gh("div", { style: { fontFamily: "Sora", fontWeight: 800, fontSize: 17, color: "#F5F7FA", marginBottom: 12 } }, "Game notifications"),
    alerts.length ? alerts.map((a) => gh("div", { key: a.id, style: { ...GLASS, padding: "10px 14px", marginBottom: 8, fontFamily: "Inter", fontSize: 13.5, color: "#F5F7FA" } }, a.icon + " " + a.text)) : gh("div", { style: { fontFamily: "Inter", fontSize: 13.5, color: "#8891A0" } }, "Challenges, turns and results will show up here."))) : null;
  const searchBox = searching ? gh("div", { style: { position: "absolute", inset: 0, zIndex: 25, background: "rgba(3,5,9,.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 } },
    gh("div", { style: { fontSize: 54, animation: "hubPulse 1.2s infinite" } }, "🔎"), gh("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: 17, color: "#F5F7FA" } }, "Finding a " + hubName(searching.game) + " opponent…"), hubBtn("Cancel", () => { sock().emit("game:cancel"); setSearching(null); refresh(); }, { ghost: true })) : null;
  return gh(React.Fragment, null,
    gh("style", null, "@keyframes hubUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}@keyframes hubPulse{50%{transform:scale(1.18)}}@keyframes hubFloat{to{transform:translateY(-170px);opacity:0}}@media (prefers-reduced-motion:reduce){*{animation:none!important}}"),
    gh("div", { style: { position: "absolute", inset: 0, display: active ? "flex" : "none", flexDirection: "column", background: "radial-gradient(120% 50% at 50% 0%, #1A1240 0%, #0B0F16 55%)" } }, main, sheet, bellPanel, searchBox),
    popups);
}

// ---- search: suggests words that appear in your chats and groups, and lists the messages that match ----
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function Marked({ text, tokens }) {
  const t = tokens.filter(Boolean);
  if (!t.length) return <>{text}</>;
  return <>{text.split(new RegExp("(" + t.map(escRe).join("|") + ")", "ig")).map((p, i) => (i % 2 ? <b key={i} style={{ color: "#35D0BA", fontWeight: 700 }}>{p}</b> : p))}</>;
}
const snippetOf = (text, tokens) => {
  const low = text.toLowerCase();
  const at = Math.min(...tokens.map(t => { const k = low.indexOf(t); return k < 0 ? Infinity : k; }));
  return !isFinite(at) || at < 25 ? text : "…" + text.slice(at - 20);
};
function SearchPanel({ token, conversations, onOpen, onClose }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState({ suggestions: [], results: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);
  const inputRef = useRef(null);
  const term = q.trim();
  const low = term.toLowerCase();
  const tokens = low.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const id = ++reqId.current;
    if (!term) { setData({ suggestions: [], results: [] }); setBusy(false); setError(""); return; }
    setBusy(true);
    const t = setTimeout(() => {
      api("/api/v1/search?q=" + encodeURIComponent(term), { token })
        .then(d => { if (id === reqId.current) { setData(d); setError(""); } })
        .catch(e => { if (id === reqId.current) setError(e.message); })
        .finally(() => { if (id === reqId.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  const byId = new Map(conversations.map(c => [c.id, c]));
  const nameHits = term ? conversations.filter(c => (c.other.name || "").toLowerCase().includes(low)).slice(0, 5) : [];
  const pick = (text) => { setQ(text); if (inputRef.current) inputRef.current.blur(); };
  const who = (c, h) => (h.mine ? "You: " : c.isGroup ? ((c.members.find(x => x.id === h.senderId) || {}).name || "Former member").split(" ")[0] + ": " : "");
  const empty = term && !busy && !error && !nameHits.length && !data.suggestions.length && !data.results.length;
  const label = { fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, color: "#5B6673", textTransform: "uppercase", letterSpacing: 0.6, padding: "12px 16px 4px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #1B212B", flexShrink: 0 }}>
        <button aria-label="Close search" onClick={onClose} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0, display: "flex" }}><ArrowLeft size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "#1E2530", borderRadius: 22, padding: "9px 14px" }}>
          <Search size={17} color="#8891A0" style={{ flexShrink: 0 }} />
          <input ref={inputRef} autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search chats and groups" maxLength={100}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5 }} />
          {q && <button aria-label="Clear" onClick={() => { setQ(""); if (inputRef.current) inputRef.current.focus(); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", flexShrink: 0 }}><X size={17} color="#8891A0" /></button>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {error && <Banner text={error} onClose={() => setError("")} />}
        {!term && (
          <div style={{ padding: "50px 30px", textAlign: "center" }}>
            <Search size={32} color="#262E3A" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Inter", fontSize: 13.5, color: "#5B6673" }}>Search for a word from any of your chats or groups. Matching words are suggested as you type.</div>
          </div>
        )}
        {empty && <div style={{ padding: "40px 30px", textAlign: "center", fontFamily: "Inter", fontSize: 13.5, color: "#5B6673" }}>No matches for “{term}”</div>}
        {data.suggestions.length > 0 && (
          <>
            <div style={label}>Suggestions</div>
            {data.suggestions.map(s => {
              const starts = s.text.startsWith(low);
              return (
                <div key={s.text} onClick={() => pick(s.text)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer" }}>
                  <Search size={16} color="#5B6673" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: "Inter", fontSize: 15, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {starts ? <>{s.text.slice(0, low.length)}<b style={{ color: "#F5F7FA", fontWeight: 600 }}>{s.text.slice(low.length)}</b></> : <span style={{ color: "#F5F7FA" }}>{s.text}</span>}
                  </span>
                  <span style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673" }}>{s.count}×</span>
                </div>
              );
            })}
          </>
        )}
        {nameHits.length > 0 && (
          <>
            <div style={label}>Chats and groups</div>
            {nameHits.map(c => (
              <div key={c.id} onClick={() => onOpen(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", cursor: "pointer" }}>
                <Ring size={40} color={c.other.color} initials={c.other.initials} photo={c.other.avatar} />
                <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" }}><Marked text={c.other.name} tokens={tokens} /></span>
              </div>
            ))}
          </>
        )}
        {data.results.length > 0 && (
          <>
            <div style={label}>Messages{data.results.length >= 50 ? " (latest 50)" : ""}</div>
            {data.results.map(h => {
              const c = byId.get(h.conversationId);
              if (!c) return null;
              return (
                <div key={h.id} onClick={() => onOpen(c, h)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", cursor: "pointer" }}>
                  <Ring size={44} color={c.other.color} initials={c.other.initials} photo={c.other.avatar} />
                  <div style={{ flex: 1, minWidth: 0, borderBottom: "1px solid #1B212B", paddingBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 14.5, color: "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.other.name}</span>
                      <span style={{ fontFamily: "Inter", fontSize: 11.5, color: "#5B6673", flexShrink: 0 }}>{timeLabel(h.time)}</span>
                    </div>
                    <div style={{ fontFamily: "Inter", fontSize: 13.5, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {who(c, h)}<Marked text={snippetOf(h.text, tokens)} tokens={tokens} />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {busy && !data.results.length && !data.suggestions.length && <div style={{ padding: 24, textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>Searching…</div>}
      </div>
    </div>
  );
}

function ChatsScreen({ token, profile, conversations, loading, error, onOpenChat, onProfile, onNewChat, onNewGroup, presence, favorites = [] }) {
  const [searching, setSearching] = useState(false);
  if (searching) return <SearchPanel token={token} conversations={conversations} onClose={() => setSearching(false)} onOpen={(c, hit) => { setSearching(false); onOpenChat(c, hit); }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title={<span>Lets<span style={{ color: "#35D0BA" }}>chat</span></span>}
        right={
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <div onClick={onNewGroup} title="New group" style={{ cursor: "pointer", display: "flex" }}><Users size={21} color="#9BA7B4" /></div>
            <div onClick={() => setSearching(true)} role="button" aria-label="Search" style={{ cursor: "pointer", display: "flex" }}><Search size={20} color="#9BA7B4" /></div>
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
            <div style={{ fontFamily: "Inter", fontSize: 13, color: "#5B6673" }}>Tap the pencil to message someone by their username, email or phone number.</div>
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

// ============================================================================
// Sounds, voice / video calls, status updates and the "Sounds & features" settings.
// (Plain JS on purpose: the same block is used in app.jsx and the compiled index.html.)
// ============================================================================
const ce = React.createElement;

// ---- feature switches, stored on this device ("Notification sound" lives in the notifs settings: notifs.sound) ----
const DEFAULT_FEATURES = { sound: true, typingSound: true, sendSound: true, status: true, videoCalls: true, voiceCalls: true, clearVoice: true, voiceNotes: true };
const getFeatures = () => ({ ...DEFAULT_FEATURES, ...loadJSON("features", {}) });
const featOn = (k) => getFeatures()[k] !== false;

// ---- sounds: synthesized in the browser (no audio files to download) ----
let _sndCtx = null;
function audioCtx() {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    _sndCtx = _sndCtx || new A();
    if (_sndCtx.state === "suspended") _sndCtx.resume();
    return _sndCtx;
}
// phones only allow sound after a tap, so unlock the audio engine on the first touch / key press
["pointerdown", "touchend", "keydown"].forEach((ev) => window.addEventListener(ev, () => { try { audioCtx(); } catch { } }, { passive: true }));
function noiseSource(ctx, dur) {
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    return s;
}
let _lastTick = 0;
function playSound(kind) { // "typing" | "send"
    if (!featOn("sound")) return;
    if (kind === "typing" && !featOn("typingSound")) return;
    if (kind === "send" && !featOn("sendSound")) return;
    try {
        const ctx = audioCtx();
        if (!ctx) return;
        const t = ctx.currentTime;
        if (kind === "typing") { // a soft keyboard tick
            const now = Date.now();
            if (now - _lastTick < 45) return;
            _lastTick = now;
            const src = noiseSource(ctx, 0.04), f = ctx.createBiquadFilter(), g = ctx.createGain();
            f.type = "bandpass"; f.frequency.value = 1900 + Math.random() * 900; f.Q.value = 1.4;
            g.gain.value = 0.55;
            src.connect(f); f.connect(g); g.connect(ctx.destination);
            src.start(t);
        } else if (kind === "send") { // a quick upward "whoosh"
            const src = noiseSource(ctx, 0.32), f = ctx.createBiquadFilter(), g = ctx.createGain();
            f.type = "bandpass"; f.Q.value = 0.9;
            f.frequency.setValueAtTime(500, t);
            f.frequency.exponentialRampToValueAtTime(3600, t + 0.26);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
            src.connect(f); f.connect(g); g.connect(ctx.destination);
            src.start(t);
            const o = ctx.createOscillator(), og = ctx.createGain();
            o.type = "sine"; o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.12);
            og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            o.connect(og); og.connect(ctx.destination);
            o.start(t); o.stop(t + 0.18);
        }
    } catch { }
}
// ringing: [seconds from start, Hz] notes repeated every few seconds; returns a function that stops it
function startRing(outgoing) {
    let on = true;
    const pattern = outgoing ? [[0, 440], [0.04, 480]] : [[0, 880], [0.2, 1175], [0.4, 880], [0.6, 1175]];
    const len = outgoing ? 1.0 : 0.22, every = outgoing ? 3200 : 2600;
    const ring = () => {
        if (!on || !featOn("sound")) return;
        try {
            const ctx = audioCtx();
            if (!ctx) return;
            const t0 = ctx.currentTime;
            for (const [off, hz] of pattern) {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.type = "sine"; o.frequency.value = hz;
                g.gain.setValueAtTime(0.0001, t0 + off);
                g.gain.exponentialRampToValueAtTime(0.18, t0 + off + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + len);
                o.connect(g); g.connect(ctx.destination);
                o.start(t0 + off); o.stop(t0 + off + len + 0.02);
            }
        } catch { }
        if (!outgoing) { try { const n = getNotifs(); if (n.vibrate && navigator.vibrate) navigator.vibrate([350, 150, 350]); } catch { } }
    };
    ring();
    const timer = setInterval(ring, every);
    return () => { on = false; clearInterval(timer); try { navigator.vibrate && navigator.vibrate(0); } catch { } };
}

// ---- calls ----
const ICE_SERVERS = (window.LETSCHAT_CONFIG && window.LETSCHAT_CONFIG.ICE_SERVERS) || [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const fmtDur = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const getCallLog = () => loadJSON("calllog", []);
const addCallLog = (e) => saveJSON("calllog", [e, ...getCallLog()].slice(0, 50));
const iconBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: 16, display: "flex" };
function mediaError(e, video) {
    const n = e && e.name;
    if (n === "NotAllowedError" || n === "SecurityError") return "Allow microphone" + (video ? " and camera" : "") + " access to make calls";
    if (n === "NotFoundError") return "No microphone" + (video ? " or camera" : "") + " found on this device";
    return "Could not start the " + (video ? "camera or " : "") + "microphone";
}

function CallLayer({ socket, apiRef, notify }) {
    const [call, setCall] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [secs, setSecs] = useState(0);
    const callRef = useRef(null), pcRef = useRef(null), localRef = useRef(null), pendingRef = useRef([]), candRef = useRef([]), ringRef = useRef(null);
    const begin = (c) => { callRef.current = c; setCall(c); };
    const upd = (patch) => { if (!callRef.current) return; callRef.current = { ...callRef.current, ...patch }; setCall(callRef.current); };
    const stopRing = () => { if (ringRef.current) { ringRef.current(); ringRef.current = null; } };
    // closes everything and returns the call that was open
    const teardown = () => {
        const c = callRef.current;
        stopRing();
        if (pcRef.current) { try { pcRef.current.close(); } catch { } pcRef.current = null; }
        if (localRef.current) { localRef.current.getTracks().forEach((t) => t.stop()); localRef.current = null; }
        pendingRef.current = []; candRef.current = [];
        callRef.current = null;
        setCall(null); setRemoteStream(null); setLocalStream(null); setSecs(0);
        return c;
    };
    const finish = (outcome, note) => {
        const c = teardown();
        if (!c) return;
        addCallLog({ id: c.id || String(Date.now()), peer: { id: c.peer.id, name: c.peer.name, initials: c.peer.initials, color: c.peer.color, avatar: c.peer.avatar || null }, conversationId: c.conversationId, video: c.video, dir: c.dir, outcome, dur: c.t0 ? Math.round((Date.now() - c.t0) / 1000) : 0, time: Date.now() });
        if (note) notify(note);
    };
    const getMedia = (video) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) return Promise.reject({ name: "Unsupported" });
        const clear = featOn("clearVoice"); // "Clear voice": echo cancellation, noise suppression and automatic volume
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: clear, noiseSuppression: clear, autoGainControl: clear }, video: video ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false });
    };
    const makePc = (c, stream) => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => { if (e.candidate) socket.emit("call:signal", { callId: c.id, data: { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate } }); };
        pc.ontrack = (e) => setRemoteStream(e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
        pc.onconnectionstatechange = () => {
            const s = pc.connectionState, cur = callRef.current;
            if (!cur || cur.id !== c.id) return;
            if (s === "connected" && cur.phase !== "active") { stopRing(); upd({ phase: "active", t0: Date.now() }); }
            else if (s === "failed") { socket.emit("call:end", { callId: c.id }); finish(cur.phase === "active" ? "completed" : "failed", "The call lost its connection"); }
        };
        return pc;
    };
    const applySignal = async (pc, c, data) => {
        try {
            if (data.sdp) {
                await pc.setRemoteDescription({ type: data.sdp.type, sdp: data.sdp.sdp });
                const q = candRef.current; candRef.current = [];
                for (const cand of q) { try { await pc.addIceCandidate(cand); } catch { } }
                if (data.sdp.type === "offer") {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit("call:signal", { callId: c.id, data: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } });
                }
            } else if (data.candidate) {
                if (pc.remoteDescription) { try { await pc.addIceCandidate(data.candidate); } catch { } }
                else candRef.current.push(data.candidate);
            }
        } catch (e) { console.warn("call signal failed", e); }
    };

    // calls made from a chat or the Calls tab
    useEffect(() => {
        apiRef.current = {
            start: async (conversation, video) => {
                if (!socket) return notify("Not connected yet. Try again in a moment.");
                if (callRef.current) return notify("You are already in a call");
                const peer = conversation.other;
                begin({ id: null, peer, conversationId: conversation.id, video: !!video, dir: "out", phase: "calling", muted: false, camOff: false });
                let stream;
                try { stream = await getMedia(!!video); }
                catch (e) { teardown(); return notify(e && e.name === "Unsupported" ? "Calling is not supported in this browser (it needs a secure https page)" : mediaError(e, video)); }
                if (!callRef.current) { stream.getTracks().forEach((t) => t.stop()); return; } // cancelled while asking for permission
                localRef.current = stream; setLocalStream(stream);
                socket.emit("call:invite", { to: peer.id, conversationId: conversation.id, video: !!video }, (ack) => {
                    if (!callRef.current) { if (ack && ack.callId) socket.emit("call:end", { callId: ack.callId }); return; }
                    if (!ack || ack.error) { teardown(); return notify((ack && ack.error) || "Could not start the call"); }
                    upd({ id: ack.callId, phase: "ringing" });
                    stopRing(); ringRef.current = startRing(true);
                });
            },
        };
    });

    // events from the server
    useEffect(() => {
        if (!socket) return;
        const onIncoming = ({ callId, conversationId, video, from }) => {
            const off = video ? !featOn("videoCalls") : !featOn("voiceCalls");
            if (callRef.current || off) { socket.emit("call:answer", { callId, accept: false, reason: "unavailable" }); return; }
            begin({ id: callId, peer: from, conversationId, video: !!video, dir: "in", phase: "ringing", muted: false, camOff: false });
            stopRing(); ringRef.current = startRing(false);
            try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(from.name, { body: "Incoming " + (video ? "video" : "voice") + " call", tag: "call-" + callId }); } catch { }
        };
        const onAccepted = async ({ callId }) => {
            const c = callRef.current;
            if (!c || c.id !== callId || c.dir !== "out" || !localRef.current) return;
            stopRing();
            upd({ phase: "connecting" });
            try {
                const pc = makePc(c, localRef.current);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("call:signal", { callId, data: { sdp: { type: offer.type, sdp: offer.sdp } } });
            } catch (e) { socket.emit("call:end", { callId }); finish("failed", "Could not connect the call"); }
        };
        const onSignal = ({ callId, data }) => {
            const c = callRef.current;
            if (!c || c.id !== callId || !data) return;
            if (!pcRef.current) pendingRef.current.push(data); else applySignal(pcRef.current, c, data);
        };
        const onEnded = ({ callId, reason }) => {
            const c = callRef.current;
            if (!c || c.id !== callId) return;
            const first = String(c.peer.name || "They").split(" ")[0];
            if (c.phase === "active") return finish("completed");
            if (c.dir === "in") return finish(reason === "ended" || reason === "missed" ? "missed" : reason);
            const notes = { declined: first + " declined the call", unavailable: first + " can't take " + (c.video ? "video" : "voice") + " calls right now", missed: first + " didn't answer", failed: "The call was disconnected", ended: "Call ended" };
            finish(reason === "missed" ? "unanswered" : reason, notes[reason]);
        };
        socket.on("call:incoming", onIncoming);
        socket.on("call:accepted", onAccepted);
        socket.on("call:signal", onSignal);
        socket.on("call:ended", onEnded);
        return () => { socket.off("call:incoming", onIncoming); socket.off("call:accepted", onAccepted); socket.off("call:signal", onSignal); socket.off("call:ended", onEnded); };
    }, [socket]);

    useEffect(() => { // call timer
        if (!call || call.phase !== "active") return;
        const t = setInterval(() => { const c = callRef.current; if (c && c.t0) setSecs(Math.round((Date.now() - c.t0) / 1000)); }, 1000);
        return () => clearInterval(t);
    }, [call && call.phase]);
    useEffect(() => () => { teardown(); }, []);

    const accept = async () => {
        const c = callRef.current;
        if (!c || c.dir !== "in" || c.phase !== "ringing") return;
        stopRing();
        upd({ phase: "connecting" });
        let stream;
        try { stream = await getMedia(c.video); }
        catch (e) { socket.emit("call:answer", { callId: c.id, accept: false }); finish("failed"); return notify(e && e.name === "Unsupported" ? "Calling is not supported in this browser (it needs a secure https page)" : mediaError(e, c.video)); }
        if (!callRef.current || callRef.current.id !== c.id) { stream.getTracks().forEach((t) => t.stop()); return; } // caller hung up meanwhile
        localRef.current = stream; setLocalStream(stream);
        const pc = makePc(c, stream);
        socket.emit("call:answer", { callId: c.id, accept: true });
        const queued = pendingRef.current; pendingRef.current = [];
        for (const d of queued) await applySignal(pc, c, d);
    };
    const decline = () => { const c = callRef.current; if (!c) return; socket.emit("call:answer", { callId: c.id, accept: false }); finish("declined"); };
    const hangUp = () => {
        const c = callRef.current;
        if (!c) return;
        if (c.id) socket.emit("call:end", { callId: c.id });
        finish(c.phase === "active" ? "completed" : c.dir === "out" ? "unanswered" : "missed");
    };
    const toggleMute = () => { const c = callRef.current; if (!c || !localRef.current) return; localRef.current.getAudioTracks().forEach((t) => { t.enabled = c.muted; }); upd({ muted: !c.muted }); };
    const toggleCam = () => { const c = callRef.current; if (!c || !localRef.current) return; localRef.current.getVideoTracks().forEach((t) => { t.enabled = c.camOff; }); upd({ camOff: !c.camOff }); };

    if (!call) return null;
    const peer = call.peer, vid = call.video, active = call.phase === "active";
    const status = call.phase === "calling" ? "Calling…" : call.phase === "ringing" ? (call.dir === "in" ? "Incoming " + (vid ? "video" : "voice") + " call" : "Ringing…") : call.phase === "connecting" ? "Connecting…" : fmtDur(secs);
    const round = (bg, onClick, label, icon) => ce("button", { onClick, "aria-label": label, style: { width: 62, height: 62, borderRadius: "50%", border: "none", background: bg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,.4)" } }, icon);
    const showRemoteVideo = vid && active && remoteStream;
    return ce("div", { style: { position: "absolute", inset: 0, zIndex: 95, background: "#0B0E13", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" } },
        ce("video", { ref: (el) => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }, autoPlay: true, playsInline: true, style: showRemoteVideo ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#000" } : { display: "none" } }),
        vid && localStream && !call.camOff && ce("video", { ref: (el) => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }, autoPlay: true, playsInline: true, muted: true, style: showRemoteVideo ? { position: "absolute", top: 16, right: 16, width: 96, height: 128, objectFit: "cover", borderRadius: 14, border: "2px solid #ffffff55", background: "#000", transform: "scaleX(-1)", zIndex: 2 } : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, transform: "scaleX(-1)" } }),
        ce("div", { style: { position: "relative", zIndex: 3, marginTop: showRemoteVideo ? 18 : "16%", textAlign: "center", textShadow: showRemoteVideo ? "0 1px 8px rgba(0,0,0,.8)" : "none" } },
            !showRemoteVideo && ce("div", { style: { display: "flex", justifyContent: "center", marginBottom: 18 } }, ce(Ring, { size: 108, color: peer.color || "#35D0BA", initials: peer.initials || "?", photo: peer.avatar, ring: true })),
            ce("div", { style: { fontFamily: "Sora", fontWeight: 700, fontSize: showRemoteVideo ? 18 : 24, color: "#F5F7FA" } }, peer.name),
            ce("div", { style: { fontFamily: "Inter", fontSize: 14.5, color: active ? "#35D0BA" : "#9BA7B4", marginTop: 6 } }, status)),
        ce("div", { style: { flex: 1 } }),
        ce("div", { style: { position: "relative", zIndex: 3, display: "flex", gap: 26, alignItems: "center", justifyContent: "center", padding: "0 20px 44px" } },
            call.dir === "in" && call.phase === "ringing"
                ? [ce("div", { key: "d", style: { textAlign: "center" } }, round("#FF6B5D", decline, "Decline call", ce(Phone, { size: 26, color: "#fff", style: { transform: "rotate(135deg)" } })), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 8 } }, "Decline")),
                    ce("div", { key: "a", style: { textAlign: "center" } }, round("#35D0BA", accept, "Accept call", vid ? ce(Video, { size: 26, color: "#0E1116" }) : ce(Phone, { size: 26, color: "#0E1116" })), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 8 } }, "Accept"))]
                : [ce("div", { key: "m", style: { textAlign: "center" } }, round(call.muted ? "#F5F7FA" : "#2B3544", toggleMute, call.muted ? "Unmute" : "Mute", ce(Mic, { size: 25, color: call.muted ? "#0E1116" : "#F5F7FA" })), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 8 } }, call.muted ? "Unmute" : "Mute")),
                    vid && ce("div", { key: "c", style: { textAlign: "center" } }, round(call.camOff ? "#F5F7FA" : "#2B3544", toggleCam, call.camOff ? "Turn camera on" : "Turn camera off", ce(Video, { size: 25, color: call.camOff ? "#0E1116" : "#F5F7FA" })), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 8 } }, call.camOff ? "Camera on" : "Camera off")),
                    ce("div", { key: "e", style: { textAlign: "center" } }, round("#FF6B5D", hangUp, "End call", ce(Phone, { size: 26, color: "#fff", style: { transform: "rotate(135deg)" } })), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#9BA7B4", marginTop: 8 } }, call.phase === "calling" || call.phase === "ringing" ? "Cancel" : "End"))]));
}

function CallsScreen({ conversations = [], onCall = () => { } }) {
    const [log, setLog] = useState(getCallLog);
    const F = getFeatures();
    const bad = { missed: 1, declined: 1, unanswered: 1, failed: 1 };
    const label = (e) => {
        const kind = e.video ? "Video" : "Voice";
        const what = e.outcome === "completed" ? (e.dir === "out" ? "Outgoing" : "Incoming") + (e.dur ? " · " + fmtDur(e.dur) : "") : e.outcome === "missed" ? "Missed" : e.outcome === "declined" ? (e.dir === "out" ? "Declined" : "You declined") : e.outcome === "unanswered" ? "No answer" : e.outcome === "unavailable" ? "Unavailable" : "Failed";
        return kind + " · " + what + " · " + timeLabel(e.time);
    };
    const clear = () => { clearJSON("calllog"); setLog([]); };
    return ce("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
        ce(TopBar, { title: "Calls", right: log.length ? ce("button", { onClick: clear, style: smallBtn }, "Clear") : null }),
        ce("div", { style: { flex: 1, minHeight: 0, overflowY: "auto" } },
            !log.length && ce("div", { style: { padding: "50px 30px", textAlign: "center" } },
                ce(PhoneCall, { size: 34, color: "#262E3A", style: { marginBottom: 12 } }),
                ce("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#8891A0", marginBottom: 6 } }, "No calls yet"),
                ce("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#5B6673" } }, "Open a chat and tap the phone or video icon at the top to call someone.")),
            log.map((e) => {
                const convo = conversations.find((c) => c.id === e.conversationId && !c.isGroup);
                return ce("div", { key: e.id + e.time, style: { display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", borderBottom: "1px solid #1B212B" } },
                    ce(Ring, { size: 46, color: e.peer.color || "#5B6673", initials: e.peer.initials || "?", photo: e.peer.avatar }),
                    ce("div", { style: { flex: 1, minWidth: 0 } },
                        ce("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: bad[e.outcome] && e.dir === "in" ? "#FF6B5D" : "#F5F7FA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, e.peer.name),
                        ce("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#8891A0" } }, label(e))),
                    convo && F.voiceCalls && ce("button", { onClick: () => onCall(convo, false), "aria-label": "Voice call", style: { ...iconBtnStyle, marginRight: 14 } }, ce(Phone, { size: 19, color: "#35D0BA" })),
                    convo && F.videoCalls && ce("button", { onClick: () => onCall(convo, true), "aria-label": "Video call", style: { ...iconBtnStyle, marginRight: 0 } }, ce(Video, { size: 20, color: "#35D0BA" })));
            })));
}

// ---- status ----
const STATUS_COLORS = ["#1E8677", "#8B7CF6", "#FF6B5D", "#4FA8E0", "#F2B84B", "#5B6673"];
function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? "Just now" : m < 60 ? m + " min ago" : Math.floor(m / 60) + " h ago";
}
function StatusComposer({ token, onClose, onPosted }) {
    const [text, setText] = useState("");
    const [bg, setBg] = useState(STATUS_COLORS[0]);
    const [photo, setPhoto] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef(null);
    const pick = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        if (!/^image\//.test(f.type)) return setError("Please choose a photo");
        try { setPhoto(await compressImage(f, 1080)); setError(""); } catch (err) { setError(err.message); }
    };
    const post = async () => {
        if (busy || (!text.trim() && !photo)) return;
        setBusy(true); setError("");
        try { await api("/api/v1/status", { method: "POST", token, body: { text: text.trim(), bg, photo } }); onPosted(); }
        catch (e) { setError(e.message); setBusy(false); }
    };
    return ce(SheetFrame, { title: "New status", onClose },
        ce("div", { style: { padding: "0 16px 22px", overflowY: "auto" } },
            error && ce(Banner, { text: error }),
            ce("div", { style: { position: "relative", borderRadius: 16, overflow: "hidden", background: bg, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 } },
                photo && ce("img", { src: photo, alt: "", style: { width: "100%", maxHeight: 320, objectFit: "contain", display: "block", background: "#000" } }),
                photo && ce("button", { onClick: () => setPhoto(null), "aria-label": "Remove photo", style: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(0,0,0,.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" } }, ce(X, { size: 16, color: "#fff" })),
                !photo && ce("textarea", { value: text, onChange: (e) => setText(e.target.value.slice(0, 300)), placeholder: "Type a status", rows: 4, style: { width: "100%", background: "none", border: "none", outline: "none", resize: "none", textAlign: "center", color: "#fff", fontFamily: "Sora", fontWeight: 600, fontSize: 20, padding: 20, boxSizing: "border-box" } })),
            photo && ce("input", { value: text, onChange: (e) => setText(e.target.value.slice(0, 300)), placeholder: "Add a caption (optional)", style: { width: "100%", boxSizing: "border-box", background: "#1E2530", border: "1px solid #262E3A", borderRadius: 12, outline: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5, padding: "11px 13px", marginBottom: 12 } }),
            ce("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } },
                !photo && STATUS_COLORS.map((c) => ce("button", { key: c, onClick: () => setBg(c), "aria-label": "Background colour", style: { width: 28, height: 28, borderRadius: 14, background: c, border: bg === c ? "3px solid #F5F7FA" : "3px solid transparent", cursor: "pointer", padding: 0 } })),
                ce("div", { style: { flex: 1 } }),
                ce("input", { ref: fileRef, type: "file", accept: "image/*", onChange: pick, style: { display: "none" } }),
                ce("button", { onClick: () => fileRef.current && fileRef.current.click(), style: { ...smallBtn, display: "flex", alignItems: "center", gap: 6 } }, ce(Camera, { size: 15, color: "#35D0BA" }), photo ? "Change photo" : "Add photo")),
            ce("button", { onClick: post, disabled: busy || (!text.trim() && !photo), style: { ...primaryBtn(busy || (!text.trim() && !photo)) } }, busy ? "Posting…" : "Post status"),
            ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "#5B6673", textAlign: "center", marginTop: 10 } }, "Disappears after 24 hours. People you chat with can see it.")));
}
function StatusViewer({ groups, start, token, onClose, onChanged }) {
    const [g, setG] = useState(start);
    const [i, setI] = useState(0);
    const group = groups[g], item = group && group.items[i];
    const next = () => { if (i + 1 < group.items.length) setI(i + 1); else if (g + 1 < groups.length) { setG(g + 1); setI(0); } else onClose(); };
    const prev = () => { if (i > 0) setI(i - 1); else if (g > 0) { setG(g - 1); setI(groups[g - 1].items.length - 1); } };
    useEffect(() => {
        if (!item) return;
        if (!group.mine && !item.seen) { api("/api/v1/status/" + item.id + "/view", { method: "POST", token }).then(() => { item.seen = true; }).catch(() => { }); }
        const t = setTimeout(next, 5500);
        return () => clearTimeout(t);
    }, [g, i]);
    if (!item) return null;
    const remove = async () => {
        if (!window.confirm("Delete this status update?")) return;
        try { await api("/api/v1/status/" + item.id, { method: "DELETE", token }); onChanged(); if (group.items.length === 1) onClose(); else { group.items.splice(i, 1); setI(Math.max(0, i - 1)); } }
        catch { }
    };
    return ce("div", { style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, background: item.photo ? "#000" : item.bg, display: "flex", flexDirection: "column", maxWidth: 640, margin: "0 auto" } },
        ce("div", { style: { display: "flex", gap: 4, padding: "12px 12px 0" } }, group.items.map((it, k) => ce("div", { key: it.id, style: { flex: 1, height: 3, borderRadius: 2, background: k <= i ? "#fff" : "rgba(255,255,255,.35)" } }))),
        ce("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", position: "relative", zIndex: 2 } },
            ce(Ring, { size: 38, color: group.user.color, initials: group.user.initials, photo: group.user.avatar }),
            ce("div", { style: { flex: 1, minWidth: 0 } }, ce("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#fff" } }, group.mine ? "My status" : group.user.name), ce("div", { style: { fontFamily: "Inter", fontSize: 12, color: "rgba(255,255,255,.75)" } }, ago(item.time))),
            ce("button", { onClick: onClose, "aria-label": "Close", style: { background: "none", border: "none", cursor: "pointer", display: "flex" } }, ce(X, { size: 26, color: "#fff" }))),
        ce("div", { style: { flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" } },
            item.photo && ce("img", { src: photoSrc(item.photo), alt: "", style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } }),
            !item.photo && ce("div", { style: { padding: 28, textAlign: "center", fontFamily: "Sora", fontWeight: 600, fontSize: 24, color: "#fff", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, item.text),
            ce("div", { onClick: prev, style: { position: "absolute", left: 0, top: 0, bottom: 0, width: "35%" } }),
            ce("div", { onClick: next, style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "65%" } })),
        item.photo && item.text && ce("div", { style: { padding: "12px 20px", textAlign: "center", color: "#fff", fontFamily: "Inter", fontSize: 15, background: "rgba(0,0,0,.55)" } }, item.text),
        group.mine && ce("div", { style: { display: "flex", alignItems: "center", padding: "12px 18px 22px", color: "#fff", fontFamily: "Inter", fontSize: 13.5, background: "rgba(0,0,0,.35)", position: "relative", zIndex: 2 } },
            ce("span", { style: { flex: 1 } }, "Seen by " + (item.views || 0)),
            ce("button", { onClick: remove, style: { ...smallBtn, color: "#FF6B5D" } }, "Delete")));
}
function StatusScreen({ profile, token }) {
    const [data, setData] = useState({ mine: [], feed: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [composer, setComposer] = useState(false);
    const [view, setView] = useState(null); // { groups, start }
    const F = getFeatures();
    const load = useCallback(() => api("/api/v1/status", { token }).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)).finally(() => setLoading(false)), [token]);
    useEffect(() => { load(); }, [load]);
    const mineGroup = { mine: true, user: profile, items: data.mine };
    const open = (groups, start) => setView({ groups, start });
    const addTap = () => { if (!F.status) return setError("Status upload is turned off. Turn it on in Tools > Sounds & features."); setComposer(true); };
    const row = (key, ring, title, sub, onClick, right) => ce("div", { key, onClick, style: { display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", cursor: "pointer" } }, ring, ce("div", { style: { flex: 1, minWidth: 0 } }, ce("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15.5, color: "#F5F7FA" } }, title), ce("div", { style: { fontFamily: "Inter", fontSize: 13, color: "#8891A0" } }, sub)), right);
    return ce("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
        ce(TopBar, { title: "Status" }),
        ce("div", { style: { flex: 1, minHeight: 0, overflowY: "auto" } },
            error && ce(Banner, { text: error, onClose: () => setError("") }),
            row("mine",
                ce("div", { style: { position: "relative" } },
                    ce(Ring, { size: 52, color: "#35D0BA", initials: profile.initials, photo: profile.avatar, ring: data.mine.length > 0 }),
                    ce("div", { onClick: (e) => { e.stopPropagation(); addTap(); }, style: { position: "absolute", bottom: -1, right: -1, width: 19, height: 19, borderRadius: "50%", background: F.status ? "#35D0BA" : "#5B6673", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0E1116" } }, ce(Plus, { size: 12, color: "#0E1116" }))),
                "My status",
                data.mine.length ? data.mine.length + (data.mine.length === 1 ? " update" : " updates") + " · " + ago(data.mine[data.mine.length - 1].time) : F.status ? "Tap to add a status update" : "Status upload is turned off",
                () => (data.mine.length ? open([mineGroup], 0) : addTap())),
            loading && ce("div", { style: { padding: 24, textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 } }, "Loading…"),
            !loading && data.feed.length > 0 && ce("div", { style: { padding: "14px 16px 4px", fontFamily: "Inter", fontSize: 12, color: "#5B6673", textTransform: "uppercase", letterSpacing: 0.5 } }, "Recent updates"),
            data.feed.map((g, k) => row(g.user.id, ce(Ring, { size: 52, color: g.allSeen ? "#5B6673" : g.user.color, initials: g.user.initials, photo: g.user.avatar, ring: true }), g.user.name, g.items.length + (g.items.length === 1 ? " update" : " updates") + " · " + ago(g.latest), () => open(data.feed, k))),
            !loading && !data.feed.length && ce("div", { style: { padding: "26px 30px", textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 } }, "No updates from your contacts yet. Status updates from people you chat with show up here for 24 hours.")),
        composer && ce(StatusComposer, { token, onClose: () => setComposer(false), onPosted: () => { setComposer(false); load(); } }),
        view && ce(StatusViewer, { groups: view.groups, start: view.start, token, onClose: () => { setView(null); load(); }, onChanged: load }));
}

// ---- Tools > Sounds & features ----
function FeaturesScreen({ onBack }) {
    const [f, setF] = useState(getFeatures);
    const [notifs, setNotifs] = useState(getNotifs);
    const setFeat = (patch) => { const next = { ...f, ...patch }; setF(next); saveJSON("features", next); };
    const setNotif = (patch) => { const next = { ...notifs, ...patch }; setNotifs(next); saveJSON("notifs", next); };
    const head = (t) => ce("div", { style: { padding: "18px 16px 6px", fontFamily: "Inter", fontSize: 12, color: "#35D0BA", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 } }, t);
    const row = (title, sub, on, onChange, disabled) => ce("div", { key: title, style: settingRow },
        ce("div", { style: { flex: 1 } },
            ce("div", { style: { fontFamily: "Sora", fontWeight: 600, fontSize: 15, color: "#F5F7FA" } }, title),
            ce("div", { style: { fontFamily: "Inter", fontSize: 12.5, color: "#8891A0", marginTop: 2 } }, sub)),
        ce(Toggle, { on, onChange, disabled }));
    const quiet = !f.sound;
    return ce("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
        ce(TopBar, { title: "Sounds & features", onBack }),
        ce("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 24 } },
            head("Sounds"),
            row("Sound", "Turn every app sound on or off.", f.sound, (v) => { setFeat({ sound: v }); if (v) setTimeout(() => playSound("send"), 30); }),
            row("Typing sound", "A soft keyboard tick while you type.", f.typingSound, (v) => { setFeat({ typingSound: v }); if (v && f.sound) setTimeout(() => playSound("typing"), 30); }, quiet),
            row("Send sound", "A whoosh when your message is sent.", f.sendSound, (v) => { setFeat({ sendSound: v }); if (v && f.sound) setTimeout(() => playSound("send"), 30); }, quiet),
            row("Notification sound", "A tone when a new message arrives.", notifs.sound, (v) => { setNotif({ sound: v }); if (v && f.sound) playPing(); }, quiet),
            head("Status"),
            row("Status upload", "Post photo and text updates that disappear after 24 hours.", f.status, (v) => setFeat({ status: v })),
            head("Calls"),
            row("Voice calling", "Make and receive voice calls. When off, incoming voice calls are declined.", f.voiceCalls, (v) => setFeat({ voiceCalls: v })),
            row("Video calling", "Make and receive video calls. When off, incoming video calls are declined.", f.videoCalls, (v) => setFeat({ videoCalls: v })),
            row("Clear voice", "Cut echo and background noise in calls and voice notes.", f.clearVoice, (v) => setFeat({ clearVoice: v })),
            head("Voice notes"),
            row("Voice recording and sending", "Show the microphone button so you can record and send voice notes.", f.voiceNotes, (v) => setFeat({ voiceNotes: v })),
            ce("div", { style: { padding: "16px 16px 0", fontFamily: "Inter", fontSize: 12, color: "#5B6673", lineHeight: 1.5 } }, "These switches are saved on this device.")));
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
    { icon: Volume2, label: "Sounds & features", sub: "Sounds, calls, status, voice", view: "features" },
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
    if (n.sound && featOn("sound")) playPing();
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
  ["How do I start a chat?", "Tap the pencil button on the Chats tab. Type a username, email or phone number with country code, or choose “Find friends from my phonebook” to see which of your contacts are already on Letschat Africa."],
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

function ChatDetail({ conversation, myId, socket, token, onBack, onLocalUpdate, presence, lastSeen = {}, contacts = [], onGroupChanged = () => {}, settings = DEFAULT_SETTINGS, onToggleFavorite = () => {}, onBlock = () => {}, onCall = () => {}, focus = null }) {
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
  const [sel, setSel] = useState(null);         // message whose Edit / Delete sheet is open
  const [editing, setEditing] = useState(null); // message being edited (its text sits in the input)
  const pressRef = useRef(null);
  const focusId = focus && focus.conversationId === conversation.id ? focus.id : null;
  const pendingFocus = useRef(focusId);
  const focusEl = useRef(null);
  const [hl, setHl] = useState(null); // search result being highlighted
  const openedAt = useRef(0);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pendingFocus.current = focusId;
    api(`/api/v1/conversations/${conversation.id}/messages`, { token })
      .then(async ({ messages }) => {
        let list = messages;
        if (focusId && !list.some(x => x.id === focusId)) { // the search result is older than the latest page: load from there
          try { list = (await api(`/api/v1/conversations/${conversation.id}/messages?since=${Math.max(0, focus.time - 60000)}&limit=200`, { token })).messages; } catch (e) {}
        }
        if (focusId && !list.some(x => x.id === focusId)) pendingFocus.current = null; // result no longer exists: just open at the bottom
        if (!cancelled) { setMsgs(list); if (focusId) { setHl(focusId); setTimeout(() => setHl(null), 2800); } }
      })
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
    const onUpdated = (m) => {
      if (m.conversationId !== conversation.id) return;
      setMsgs(prev => prev.map(x => {
        if (x.id !== m.id) return x;
        if (m.deleted) { const { audio, file, duration, hasAudio, edited, editedAt, ...rest } = x; return { ...rest, text: m.text, deleted: true }; }
        return { ...x, text: m.text, edited: true, editedAt: m.editedAt };
      }));
      if (m.deleted) { setEditing(e => (e && e.id === m.id ? null : e)); setSel(s => (s && s.id === m.id ? null : s)); }
    };
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    socket.on("typing", onTyping);
    return () => { socket.off("message:new", onNew); socket.off("message:updated", onUpdated); socket.off("typing", onTyping); };
  }, [socket, conversation.id, myId]);

  useEffect(() => {
    if (pendingFocus.current && focusEl.current) { focusEl.current.scrollIntoView({ block: "center" }); pendingFocus.current = null; return; }
    if (!pendingFocus.current) endRef.current?.scrollIntoView();
  }, [msgs, peerTyping]);
  useEffect(() => { onLocalUpdate(conversation.id, msgs); }, [msgs]);

  const notifyTyping = (isTyping) => {
    if (!socket) return;
    socket.emit("typing", { conversationId: conversation.id, typing: isTyping });
    clearTimeout(typingTimeout.current);
    if (isTyping) typingTimeout.current = setTimeout(() => socket.emit("typing", { conversationId: conversation.id, typing: false }), 1500);
  };

  const EDIT_WINDOW_MS = 15 * 60 * 1000; // keep in step with the server
  const canEdit = (m) => !!m && !m.deleted && !m.audio && !m.hasAudio && !m.file && Date.now() - m.time <= EDIT_WINDOW_MS;
  const startEdit = (m) => {
    setSel(null);
    if (!canEdit(m)) return setError("Messages can only be edited for 15 minutes after sending");
    setEditing(m); setDraft(m.text);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };
  const cancelEdit = () => { setEditing(null); setDraft(""); };
  const removeMsg = (m) => {
    setSel(null);
    if (!socket) return setError("Not connected yet. Try again in a moment.");
    if (!window.confirm("Delete this " + (m.audio || m.hasAudio ? "voice note" : "message") + " for everyone?")) return;
    socket.emit("message:delete", { messageId: m.id }, (ack) => { if (ack && ack.error) setError(ack.error); });
  };
  const openMenu = (m) => { if (m.senderId === myId && !m.deleted) { openedAt.current = Date.now(); setSel(m); } };
  const pressStart = (m) => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => openMenu(m), 450); };
  const pressEnd = () => clearTimeout(pressRef.current);

  const send = () => {
    if (!draft.trim() || !socket) return;
    const text = draft.trim();
    if (editing) {
      if (text === editing.text) return cancelEdit();
      const id = editing.id;
      return socket.emit("message:edit", { messageId: id, text }, (ack) => {
        if (ack && ack.error) return setError(ack.error);
        setEditing(null); setDraft("");
        if (ack && ack.message) setMsgs(prev => prev.map(x => (x.id === id ? { ...x, text: ack.message.text, edited: true, editedAt: ack.message.editedAt } : x)));
      });
    }
    setDraft("");
    notifyTyping(false);
    playSound("send");
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
        if (ack && ack.error) setError(ack.error); else playSound("send");
      });
    } catch (e) { clearTimeout(done); setSending(false); setError(e.message || "Could not send that file"); }
  };
  const pickFile = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; sendFile(f); };

  const startRec = async () => {
    if (!featOn("voiceNotes")) return setError("Voice notes are turned off. Turn them on in Tools > Sounds & features.");
    if (!socket || !navigator.mediaDevices || !window.MediaRecorder) return setError("Voice notes are not supported on this device");
    try {
      const clear = featOn("clearVoice"); // clear voice = echo cancellation + noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: clear, noiseSuppression: clear, autoGainControl: clear } });
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
      const r = { mr, chunks: [], t0: Date.now(), cancel: false };
      mr.ondataavailable = (e) => { if (e.data.size) r.chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (r.cancel) return;
        const fr = new FileReader();
        fr.onload = () => socket.emit("message:send", { conversationId: conversation.id, audio: fr.result, duration: Math.round((Date.now() - r.t0) / 1000) }, (ack) => { if (ack && ack.error) setError(ack.error); else playSound("send"); });
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
        {!isGroup && featOn("videoCalls") && <button aria-label="Video call" onClick={() => onCall(conversation, true)} style={iconBtnStyle}><Video size={20} color="#9BA7B4" /></button>}
        {!isGroup && featOn("voiceCalls") && <button aria-label="Voice call" onClick={() => onCall(conversation, false)} style={iconBtnStyle}><Phone size={19} color="#9BA7B4" /></button>}
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
            <div key={m.id} ref={m.id === focusId ? focusEl : undefined}
              onContextMenu={mine && !m.deleted ? (e) => { e.preventDefault(); openMenu(m); } : undefined}
              onTouchStart={mine && !m.deleted ? () => pressStart(m) : undefined} onTouchEnd={pressEnd} onTouchMove={pressEnd} onTouchCancel={pressEnd}
              style={{
              WebkitTouchCallout: "none", boxShadow: hl === m.id ? "0 0 0 2px #F2B84B" : "none", transition: "box-shadow .4s",
              alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "76%",
              background: mine ? "#1E8677" : "#1E2530", borderRadius: 14,
              borderBottomRightRadius: mine ? 3 : 14, borderBottomLeftRadius: mine ? 14 : 3,
              padding: "8px 11px", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5,
            }}>
              {isGroup && !mine && <div style={{ fontSize: 12, fontWeight: 600, color: sender ? sender.color : "#8891A0", marginBottom: 2 }}>{sender ? sender.name : "Former member"}</div>}
              {m.deleted ? <div style={{ fontStyle: "italic", color: "#B9C2CC" }}>{m.text}</div>
                : m.audio ? <audio controls preload="none" src={m.audio} style={{ height: 36, width: 210, maxWidth: "100%" }} />
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
                {m.edited && !m.deleted && <span style={{ fontSize: 10.5, color: "#B9C2CC", fontStyle: "italic" }}>edited</span>}
                <span style={{ fontSize: 10.5, color: "#B9C2CC" }}>{timeLabel(m.time)}</span>
                {mine && !m.deleted && <button aria-label="Message options" onClick={() => openMenu(m)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}><ChevronDown size={14} color="#B9C2CC" /></button>}
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
      {editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "#161B22", borderTop: "1px solid #262E3A", fontFamily: "Inter", fontSize: 13, color: "#F5F7FA", flexShrink: 0 }}>
          <Pencil size={15} color="#35D0BA" />
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><b style={{ color: "#35D0BA" }}>Editing message</b> · {editing.text}</span>
          <button aria-label="Cancel editing" onClick={cancelEdit} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex" }}><X size={18} color="#8891A0" /></button>
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
            onChange={e => { if (e.target.value.length > draft.length) playSound("typing"); setDraft(e.target.value); notifyTyping(true); }}
            onKeyDown={e => { if (e.key === "Enter") send(); else if (e.key === "Escape" && editing) cancelEdit(); }}
            placeholder={editing ? "Edit message" : "Message"} style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5 }} />
          {!editing && <button aria-label="Attach file" onClick={() => fileRef.current && fileRef.current.click()} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}><Paperclip size={19} color="#8891A0" /></button>}
          {!editing && <button aria-label="Take photo" onClick={() => camRef.current && camRef.current.click()} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", flexShrink: 0 }}><Camera size={19} color="#8891A0" /></button>}
        </div>
        <button aria-label={rec ? "Stop and send voice note" : "Record voice note"} onClick={rec ? () => stopRec(false) : startRec}
          style={{ width: 42, height: 42, borderRadius: "50%", border: rec ? "none" : "1px solid #2B3544", background: rec ? "#FF6B5D" : "#1E2530", display: !editing && (rec || featOn("voiceNotes")) ? "flex" : "none", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <Mic size={18} color={rec ? "#0E1116" : "#35D0BA"} />
        </button>
        <button aria-label="Send" onClick={() => { if (rec) stopRec(false); else if (draft.trim()) send(); else if (inputRef.current) inputRef.current.focus(); }}
          style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#35D0BA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 14px #35D0BA33" }}>
          <Send size={17} color="#0E1116" />
        </button>
      </div>
      )}
      {sel && (
        <div onClick={() => { if (Date.now() - openedAt.current > 500) setSel(null); }} style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#161B22", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTop: "1px solid #262E3A", padding: "10px 12px 18px" }}>
            <div style={{ padding: "6px 10px 10px", fontFamily: "Inter", fontSize: 13, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.audio || sel.hasAudio ? "🎤 Voice note" : sel.text}</div>
            {canEdit(sel) && (
              <div onClick={() => startEdit(sel)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "Inter", fontWeight: 500, fontSize: 15, color: "#F5F7FA" }}><Pencil size={18} color="#35D0BA" />Edit message</div>
            )}
            <div onClick={() => removeMsg(sel)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "Inter", fontWeight: 500, fontSize: 15, color: "#FF6B5D" }}><Trash2 size={18} color="#FF6B5D" />Delete for everyone</div>
            <div onClick={() => setSel(null)} style={{ padding: "13px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "Inter", fontWeight: 500, fontSize: 15, color: "#9BA7B4", textAlign: "center" }}>Cancel</div>
          </div>
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
    { label: "Username", value: profile.username ? "@" + profile.username : "Not set (tap to add)" },
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
  const [username, setUsername] = useState(profile.username || "");
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
      const { user } = await api("/api/v1/me", { method: "PATCH", token, body: { name, about, username: username.trim(), ...(avatarChanged ? { avatar } : {}) } });
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
        <div style={{ padding: "0 20px 20px" }}>
          <label style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", textTransform: "uppercase", letterSpacing: 0.5 }}>Username</label>
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #262E3A", marginTop: 4 }}>
            <span style={{ color: "#5B6673", fontFamily: "Inter", fontSize: 15 }}>@</span>
            <input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase().slice(0, 20))} placeholder="choose a username" autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ flex: 1, background: "none", border: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 15, padding: "8px 0 8px 2px", outline: "none" }} />
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginTop: 6 }}>3 to 20 characters: letters, numbers, _ or . People can add you with it.</div>
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
        Your phone number or Google email is your Letschat Africa ID. You can also pick a username in Edit profile so friends can find you without sharing either.
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
  const [focusMsg, setFocusMsg] = useState(null); // search result to jump to when a chat opens
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
  const callApi = useRef(null);
  const startCall = (conversation, video) => { if (callApi.current) callApi.current.start(conversation, video); };

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
    socket.on("message:updated", () => refreshConversations()); // edited / deleted message: refresh the chat list preview
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
        focus={focusMsg}
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
        onCall={startCall}
      />
    );
  } else if (toolsView === "favs") {
    body = <FavouritesScreen conversations={conversations} settings={settings} presence={presence} onBack={() => setToolsView(null)} onOpenChat={setActiveConvo} onToggleFavorite={toggleFavorite} />;
  } else if (toolsView === "privacy") {
    body = <PrivacyScreen settings={settings} onBack={() => setToolsView(null)} onPrivacy={savePrivacy} onBlock={setBlocked} />;
  } else if (toolsView === "communities") {
    body = <CommunitiesScreen conversations={conversations} myId={session.user.id} presence={presence} onBack={() => setToolsView(null)} onOpenChat={setActiveConvo} onNewGroup={() => { setToolsView(null); setShowNewGroup(true); }} />;
  } else if (toolsView === "features") {
    body = <FeaturesScreen onBack={() => setToolsView(null)} />;
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
              onOpenChat={(c, hit) => { setFocusMsg(hit || null); setActiveConvo(c); }}
              onProfile={() => setShowProfile(true)}
              onNewChat={() => setShowNewChat(true)}
              onNewGroup={() => setShowNewGroup(true)}
              favorites={settings.favorites}
            />
          )}
          {tab === "calls" && <CallsScreen conversations={conversations} onCall={startCall} />}
          {tab === "market" && <MarketScreen token={session.token} myId={session.user.id} onMessageSeller={messageSeller} />}
          <GamesHub active={tab === "games"} myId={session.user.id} me={session.user} socketRef={socketRef} conversations={conversations} onCall={startCall} goGames={() => setTab("games")} />
          {tab === "status" && <StatusScreen profile={session.user} token={session.token} />}
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
          {session && <CallLayer socket={socketRef.current} apiRef={callApi} notify={flash} />}
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
