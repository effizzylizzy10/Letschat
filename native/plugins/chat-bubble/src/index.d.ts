export interface ShowOptions {
  /** Unread count shown on the badge (hidden when 0). */
  count?: number;
  /** Sender name shown in the preview. */
  title?: string;
  /** Message text shown in the preview for a few seconds. */
  text?: string;
  /** Passed back in the bubbleTapped event. */
  chatId?: string;
  /** Full address of the sender's profile photo (a coloured circle with their first letter is shown until it loads, or when there is none). */
  avatar?: string;
  /** Message id (a message shown twice is only listed once). */
  messageId?: string;
  /** When the message is a reply: who wrote the quoted message ("You" for your own) and its text. */
  replyName?: string;
  replyText?: string;
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

/** What is still missing of everything Letschat needs (see checkAllPermissions). */
export interface PermissionStatus {
  /** Camera, microphone, contacts, location, notifications, photos/files and nearby devices are all allowed. */
  runtimeGranted: boolean;
  /** The permission groups still switched off, e.g. ["camera", "contacts"]. */
  missing: string[];
  /** "Display over other apps" is allowed. */
  overlay: boolean;
  /** Letschat is exempt from battery optimisation. */
  battery: boolean;
  allGranted: boolean;
}

export interface ChatBubblePlugin {
  /** True when Android allows Letschat to draw over other apps. */
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  /** Opens the Android "Display over other apps" screen for Letschat. */
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  /** Which of the permissions Letschat needs are already allowed. */
  checkAllPermissions(): Promise<PermissionStatus>;
  /** Asks for every missing runtime permission in one go (Android shows its allow dialogs one after another). */
  requestRuntimePermissions(): Promise<PermissionStatus>;
  /** Asks for only the named permission groups, e.g. { permissions: ["contacts"] } (Capacitor's built-in request). */
  requestPermissions(options?: { permissions?: string[] }): Promise<Record<string, string>>;
  /** Opens the phone's own App permissions page for Letschat (or the app info page where there is no direct page). */
  openAppPermissionSettings(): Promise<void>;
  /** Shows the bubble, or updates it when it is already on screen. Rejects when the overlay permission is missing. */
  show(options: ShowOptions): Promise<void>;
  hide(): Promise<void>;
  /**
   * Hands over the sign-in so new messages are found while the app is closed. An empty token (sign-out) stops it.
   * `preview` and `groups` are the two switches of Settings > Notifications ("Show message preview", "Group messages"); both count as on when left out.
   */
  setSession(options: { token: string; apiUrl?: string; userId?: string; preview?: boolean; groups?: boolean }): Promise<void>;
  /** Turns the bubble on or off (the "Floating chat bubble" setting). On by default. */
  setEnabled(options: { enabled: boolean }): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
  /** chatId: the chat to open (a tapped message notification or "View"); tab "calls": the head was tapped with no message waiting. */
  addListener(eventName: 'bubbleTapped', listener: (data: { chatId: string; tab?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'appState', listener: (data: { active: boolean }) => void): Promise<PluginListenerHandle>;
}

export declare const ChatBubble: ChatBubblePlugin;
