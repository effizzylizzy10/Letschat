import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { io } from "socket.io-client";
import {
  Search, Phone, Video, MoreVertical, ArrowLeft, Camera, Send,
  Smile, Paperclip, Mic, MessageCircle, PhoneCall, Radio, Grid3x3,
  Check, CheckCheck, Plus, Edit3, ChevronRight, Bell,
  Lock, HelpCircle, Users, Star, LogOut, User, Pencil, X, AlertCircle
} from "lucide-react";

/* ============================================================
   LETSCHAT AFRICA — realtime chat client
   Talks to the Letschat Africa server (Express + Socket.io) configured in config.js.
   Color: --ink #0E1116 --panel #161B22 --accent #35D0BA --amber #F2B84B
          --coral #FF6B5D  --ink-0 #F5F7FA --ink-1 #9BA7B4 --ink-2 #5B6673
   Type: Display 'Sora' / Body 'Inter'
   ============================================================ */

const { API_URL, SOCKET_URL } = window.LETSCHAT_CONFIG;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function timeLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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

function Ring({ size = 52, color, initials, online, ring, photo, onClick }) {
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
      {online && (
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 13, height: 13, borderRadius: "50%", background: "#35D0BA", border: "3px solid #0E1116" }} />
      )}
    </div>
  );
}

// ---- fullscreen tap-to-zoom viewer for a profile picture ----
function ImageZoomModal({ photo, initials, color, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "#000000E6", zIndex: 30,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#F5F7FA", cursor: "pointer" }}>
        <X size={26} />
      </button>
      {photo ? (
        <img
          src={photo}
          alt=""
          onContextMenu={e => e.preventDefault()}
          draggable={false}
          style={{
            width: "82%", maxWidth: 340, aspectRatio: "1 / 1", borderRadius: "50%",
            objectFit: "cover", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none",
          }}
        />
      ) : (
        <div style={{ width: 220, height: 220, borderRadius: "50%", background: color + "26", color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Sora", fontWeight: 700, fontSize: 70, border: `1px solid ${color}55` }}>{initials}</div>
      )}
    </div>
  );
}

function TabBar({ active, setActive }) {
  const tabs = [
    { id: "chats", icon: MessageCircle, label: "Chats" },
    { id: "calls", icon: PhoneCall, label: "Calls" },
    { id: "status", icon: Radio, label: "Status" },
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
function NewChatModal({ token, onClose, onStarted }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (!phone.trim()) return;
    setBusy(true); setError("");
    try {
      const { conversation } = await api("/api/conversations", { method: "POST", token, body: { phone } });
      onStarted(conversation);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

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
          Enter the Letschat Africa phone number of the person you want to message. They need to have signed in to Letschat Africa at least once.
        </div>
        {error && <Banner text={error} />}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#1E2530", border: "1px solid #262E3A", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <span style={{ fontFamily: "Sora", fontWeight: 600, color: "#8891A0" }}>+</span>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
            placeholder="234801234567" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 15 }} />
        </div>
        <button onClick={start} disabled={busy || !phone.trim()} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer",
          background: "#35D0BA", color: "#0E1116", fontFamily: "Sora", fontWeight: 700, fontSize: 15, opacity: busy ? 0.7 : 1,
        }}>{busy ? "Looking up…" : "Start chat"}</button>
      </div>
    </div>
  );
}

function ChatsScreen({ token, profile, conversations, loading, error, onOpenChat, onProfile, onNewChat, presence }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title={<span>Lets<span style={{ color: "#35D0BA" }}>chat</span></span>}
        right={
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
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
            <Ring size={52} color={c.other.color} initials={c.other.initials} online={!!presence[c.other.id]} />
            <div style={{ flex: 1, minWidth: 0, borderBottom: "1px solid #1B212B", paddingBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 16, color: "#F5F7FA" }}>{c.other.name}</span>
                <span style={{ fontFamily: "Inter", fontSize: 12, color: c.unread ? "#35D0BA" : "#5B6673" }}>{c.lastMessage ? timeLabel(c.lastMessage.time) : ""}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Inter", fontSize: 13.5, color: "#8891A0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                  {c.lastMessage ? (c.lastMessage.senderId === c.myId ? "You: " : "") + c.lastMessage.text : "Say hello 👋"}
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

function ToolsScreen({ onProfile }) {
  const items = [
    { icon: User, label: "Profile", sub: "Edit your details" },
    { icon: Star, label: "Favourites", sub: "Quick access chats" },
    { icon: Users, label: "Communities", sub: "Manage your groups" },
    { icon: Bell, label: "Notifications", sub: "Sound & alerts" },
    { icon: Lock, label: "Privacy", sub: "Blocked, read receipts" },
    { icon: HelpCircle, label: "Help", sub: "FAQ, contact us" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar title="Tools" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.map(it => {
          const Icon = it.icon;
          return (
            <div key={it.label} onClick={it.label === "Profile" ? onProfile : undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", cursor: "pointer", borderBottom: "1px solid #1B212B" }}>
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
function ChatDetail({ conversation, myId, socket, token, onBack, onLocalUpdate, presence }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const endRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/api/conversations/${conversation.id}/messages`, { token })
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

  const online = !!presence[conversation.other.id];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px", borderBottom: "1px solid #1B212B" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#F5F7FA", cursor: "pointer", padding: 0 }}><ArrowLeft size={22} /></button>
        <Ring size={38} color={conversation.other.color} initials={conversation.other.initials} online={online} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 15.5, color: "#F5F7FA" }}>{conversation.other.name}</div>
          <div style={{ fontFamily: "Inter", fontSize: 12, color: peerTyping ? "#35D0BA" : online ? "#35D0BA" : "#5B6673" }}>
            {peerTyping ? "typing…" : online ? "online" : "offline"}
          </div>
        </div>
        <Video size={19} color="#5B6673" style={{ marginRight: 16, opacity: 0.5 }} />
        <Phone size={18} color="#5B6673" style={{ marginRight: 16, opacity: 0.5 }} />
        <MoreVertical size={19} color="#9BA7B4" />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8, background: "#0B0E13" }}>
        {loading && <div style={{ margin: "auto", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>Loading conversation…</div>}
        {error && <Banner text={error} onClose={() => setError("")} />}
        {!loading && msgs.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", color: "#5B6673", fontFamily: "Inter", fontSize: 13 }}>
            No messages yet.<br />Say hello to {conversation.other.name.split(" ")[0]} 👋
          </div>
        )}
        {msgs.map(m => {
          const mine = m.senderId === myId;
          return (
            <div key={m.id} style={{
              alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "76%",
              background: mine ? "#1E8677" : "#1E2530", borderRadius: 14,
              borderBottomRightRadius: mine ? 3 : 14, borderBottomLeftRadius: mine ? 14 : 3,
              padding: "8px 11px", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5,
            }}>
              <div>{m.text}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span style={{ fontSize: 10.5, color: "#B9C2CC" }}>{timeLabel(m.time)}</span>
                {mine && (m.read ? <CheckCheck size={13} color="#35D0BA" /> : <Check size={13} color="#B9C2CC" />)}
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

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#0E1116" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#1E2530", borderRadius: 24, padding: "9px 12px" }}>
          <Smile size={19} color="#8891A0" />
          <input
            value={draft}
            onChange={e => { setDraft(e.target.value); notifyTyping(true); }}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Message" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Inter", fontSize: 14.5 }} />
          <Paperclip size={18} color="#8891A0" />
        </div>
        <button onClick={send} style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "#35D0BA", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          {draft.trim() ? <Send size={17} color="#0E1116" /> : <Mic size={17} color="#0E1116" />}
        </button>
      </div>
    </div>
  );
}

function ProfileScreen({ onBack, onEdit, profile, onLogOut }) {
  const [zoomed, setZoomed] = useState(false);
  const rows = [
    { label: "Name", value: profile.name },
    { label: "About", value: profile.about },
    { label: "Phone", value: "+" + profile.phone },
  ];
  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={e => e.preventDefault()}
    >
      <TopBar title="Profile" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 26px" }}>
          <Ring size={110} color="#35D0BA" initials={profile.initials} photo={profile.avatar} ring onClick={() => setZoomed(true)} />
        </div>
        {rows.map(r => (
          <div key={r.label} onClick={r.label !== "Phone" ? onEdit : undefined} style={{ padding: "14px 20px", borderBottom: "1px solid #1B212B", cursor: r.label !== "Phone" ? "pointer" : "default" }}>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Sora", fontWeight: 600, fontSize: 16, color: "#F5F7FA" }}>{r.value}</span>
              {r.label !== "Phone" && <Pencil size={15} color="#5B6673" />}
            </div>
          </div>
        ))}
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

function EditProfileScreen({ onBack, profile, token, onSave }) {
  const [name, setName] = useState(profile.name);
  const [about, setAbout] = useState(profile.about);
  const [avatar, setAvatar] = useState(profile.avatar || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const pickPhoto = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataURL(file, 512);
      setAvatar(dataUrl);
    } catch (err) {
      setError(err.message || "Couldn't process that image — try a different one.");
    } finally {
      e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true); setError("");
    try {
      const { user } = await api("/api/me", { method: "PATCH", token, body: { name, about, avatar } });
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
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 24px" }}>
          <div style={{ position: "relative" }}>
            <Ring size={100} color="#35D0BA" initials={profile.initials} photo={avatar} ring />
            <button onClick={pickPhoto} style={{
              position: "absolute", bottom: 2, right: 2, width: 32, height: 32, borderRadius: "50%",
              background: "#35D0BA", border: "2px solid #0E1116", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer", padding: 0,
            }}>
              <Camera size={15} color="#0E1116" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
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
function LoginScreen({ onContinue }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true); setError("");
    try {
      await onContinue(phone, name);
    } catch (e) {
      if (e.message.includes("Name required")) setNeedsName(true);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", background: "radial-gradient(circle at 50% 0%, #12251F 0%, #0E1116 62%)" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, margin: "0 auto 20px", background: "conic-gradient(from 120deg, #35D0BA, #F2B84B, #35D0BA)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 66, height: 66, borderRadius: 18, background: "#0E1116", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 24, color: "#35D0BA" }}>L<span style={{ color: "#F2B84B" }}>A</span></span>
          </div>
        </div>
        <div style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 13, letterSpacing: 1, color: "#35D0BA", textTransform: "uppercase", marginBottom: 10 }}>Letschat Africa</div>
        <h1 style={{ fontFamily: "Sora", fontWeight: 700, fontSize: 24, color: "#F5F7FA", margin: "0 0 8px" }}>
          {needsName ? "What's your name?" : "Enter your number"}
        </h1>
        <p style={{ fontFamily: "Inter", fontSize: 14, color: "#8891A0", margin: 0, lineHeight: 1.5 }}>
          {needsName ? "This is what people you chat with will see." : "This becomes your Letschat Africa ID — share it so others can message you."}
        </p>
      </div>

      {error && <Banner text={error} onClose={() => setError("")} />}

      {!needsName ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#161B22", border: "1px solid #262E3A", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <span style={{ fontFamily: "Sora", fontWeight: 600, color: "#8891A0", fontSize: 15 }}>+</span>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="234801234567" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 16, letterSpacing: 0.5 }} />
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#161B22", border: "1px solid #262E3A", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#F5F7FA", fontFamily: "Sora", fontWeight: 600, fontSize: 16 }} />
        </div>
      )}

      <button
        disabled={busy || (needsName ? !name.trim() : phone.length < 7)}
        onClick={submit}
        style={{
          padding: "15px", borderRadius: 14, border: "none",
          cursor: busy ? "default" : "pointer",
          background: (needsName ? name.trim() : phone.length >= 7) ? "#35D0BA" : "#1E2530",
          color: (needsName ? name.trim() : phone.length >= 7) ? "#0E1116" : "#5B6673",
          fontFamily: "Sora", fontWeight: 700, fontSize: 15,
        }}>{busy ? "Please wait…" : needsName ? "Create account" : "Continue"}</button>

      <p style={{ textAlign: "center", fontFamily: "Inter", fontSize: 12, color: "#5B6673", marginTop: 22, lineHeight: 1.6 }}>
        Letschat Africa connects two people over the internet in realtime — <br />no phone verification code is actually sent yet.
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
  const socketRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = FONT_LINK;
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // connect socket once logged in
  useEffect(() => {
    if (!session) return;
    const socket = io(SOCKET_URL, { auth: { token: session.token } });
    socketRef.current = socket;
    socket.on("presence:update", ({ userId, online }) => {
      setPresence(prev => ({ ...prev, [userId]: online }));
    });
    socket.on("message:new", () => refreshConversations());
    socket.on("connect_error", (err) => setConvError("Can't reach the Letschat Africa server: " + err.message));
    return () => socket.disconnect();
  }, [session]);

  const refreshConversations = async () => {
    if (!session) return;
    try {
      const { conversations } = await api("/api/conversations", { token: session.token });
      setConversations(conversations.map(c => ({ ...c, myId: session.user.id })));
      setConvError("");
    } catch (e) {
      setConvError(e.message);
    }
  };

  useEffect(() => {
    if (!session) return;
    setConvLoading(true);
    refreshConversations().finally(() => setConvLoading(false));
  }, [session]);

  const handleLogin = async (phone, name) => {
    const { token, user } = await api("/api/auth/register-or-login", { method: "POST", body: { phone, name } });
    saveJSON("session", { token, user });
    setSession({ token, user });
  };

  const handleLogOut = () => {
    socketRef.current?.disconnect();
    clearJSON("session");
    setSession(null);
    setConversations([]);
    setActiveConvo(null);
    setShowProfile(false);
  };

  const handleNewChatStarted = (conversation) => {
    setShowNewChat(false);
    refreshConversations();
    setActiveConvo({ id: conversation.id, other: conversation.other });
  };

  const frame = {
    width: "100%", maxWidth: 400, height: 780, margin: "0 auto", background: "#0E1116",
    borderRadius: 28, overflow: "hidden", position: "relative", display: "flex",
    flexDirection: "column", fontFamily: "Inter, sans-serif",
    boxShadow: "0 30px 70px -20px rgba(0,0,0,0.6)", border: "1px solid #1B212B",
  };

  let body;
  if (!session) {
    body = <LoginScreen onContinue={handleLogin} />;
  } else if (activeConvo) {
    body = (
      <ChatDetail
        conversation={activeConvo}
        myId={session.user.id}
        socket={socketRef.current}
        token={session.token}
        presence={presence}
        onBack={() => { setActiveConvo(null); refreshConversations(); }}
        onLocalUpdate={() => {}}
      />
    );
  } else if (showEdit) {
    body = <EditProfileScreen profile={session.user} token={session.token} onBack={() => setShowEdit(false)} onSave={(user) => { const next = { ...session, user }; setSession(next); saveJSON("session", next); setShowEdit(false); }} />;
  } else if (showProfile) {
    body = <ProfileScreen profile={session.user} onBack={() => setShowProfile(false)} onEdit={() => setShowEdit(true)} onLogOut={handleLogOut} />;
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
            />
          )}
          {tab === "calls" && <CallsScreen />}
          {tab === "status" && <StatusScreen profile={session.user} />}
          {tab === "tools" && <ToolsScreen onProfile={() => setShowProfile(true)} />}
          {showNewChat && <NewChatModal token={session.token} onClose={() => setShowNewChat(false)} onStarted={handleNewChatStarted} />}
        </div>
        <TabBar active={tab} setActive={setTab} />
      </>
    );
  }

  return (
    <div style={{ background: "#05070A", minHeight: "100vh", padding: "24px 12px", display: "flex", alignItems: "center" }}>
      <div style={frame}>{body}</div>
    </div>
  );
}
  
// ---- mount ----
const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(React.createElement(App));
}
}
}
