export interface StartOptions {
  /** Notification title. Default: "Letschat Africa" */
  title?: string;
  /** Notification text. Default: "Connected. Tap to open." */
  text?: string;
}

export interface BackgroundServicePlugin {
  /** Starts the foreground service and remembers to restart it after a reboot or app update. */
  start(options?: StartOptions): Promise<{ running: boolean }>;
  /** Stops the service and turns the restart-after-reboot off (call this on logout). */
  stop(): Promise<{ running: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
  isIgnoringBatteryOptimizations(): Promise<{ ignoring: boolean }>;
  /** Opens the Android "ignore battery optimisation" prompt. */
  requestIgnoreBatteryOptimizations(): Promise<{ ignoring: boolean }>;
}

export declare const BackgroundService: BackgroundServicePlugin;
