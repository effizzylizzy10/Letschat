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
}

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface ChatBubblePlugin {
  /** True when Android allows Letschat to draw over other apps. */
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  /** Opens the Android "Display over other apps" screen for Letschat. */
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  /** Shows the bubble, or updates it when it is already on screen. Rejects when the overlay permission is missing. */
  show(options: ShowOptions): Promise<void>;
  hide(): Promise<void>;
  /** Hands over the sign-in so new messages are found while the app is closed. An empty token (sign-out) stops it. */
  setSession(options: { token: string; apiUrl?: string; userId?: string }): Promise<void>;
  /** Turns the bubble on or off (the "Floating chat bubble" setting). On by default. */
  setEnabled(options: { enabled: boolean }): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
  addListener(eventName: 'bubbleTapped', listener: (data: { chatId: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'appState', listener: (data: { active: boolean }) => void): Promise<PluginListenerHandle>;
}

export declare const ChatBubble: ChatBubblePlugin;
