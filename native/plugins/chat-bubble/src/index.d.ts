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

/** What is already allowed on this phone (answer of checkAllPermissions and requestRuntimePermissions). */
export interface PermissionStatus {
  /** Camera, microphone, contacts, location, notifications, photos/files and nearby devices are all allowed. */
  runtimeGranted: boolean;
  /** The groups still switched off: "camera", "microphone", "contacts", "location", "notifications", "media", "storage", "nearby". */
  missing: string[];
  /** "Display over other apps" is allowed. */
  overlay: boolean;
  /** Android lets Letschat ignore battery optimisation. */
  battery: boolean;
  /** Everything above is on. */
  allGranted: boolean;
}

export interface ChatBubblePlugin {
  /** True when Android allows Letschat to draw over other apps. */
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  /** Opens the Android "Display over other apps" screen for Letschat. */
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  /** Which of everything Letschat needs is already allowed (used by the one-time permission set-up). */
  checkAllPermissions(): Promise<PermissionStatus>;
  /** Asks for every missing runtime permission in one go: Android shows its allow dialogs one after another. */
  requestRuntimePermissions(): Promise<PermissionStatus>;
  /** Asks for some of the permission groups only, for example `{ permissions: ['contacts'] }`. */
  requestPermissions(options?: { permissions?: string[] }): Promise<Record<string, string>>;
  /** Opens the phone's own permission page for Letschat (Settings > Apps > Letschat > Permissions). */
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
  /** chatId: the chat to open (a tapped "View" or message notification). tab: "calls" when the head was tapped with no message waiting. */
  addListener(eventName: 'bubbleTapped', listener: (data: { chatId: string; tab?: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'appState', listener: (data: { active: boolean }) => void): Promise<PluginListenerHandle>;
}

export declare const ChatBubble: ChatBubblePlugin;
