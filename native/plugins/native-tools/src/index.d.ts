export interface NativeToolsPlugin {
  /** Sends the text to the Android side and gets it back. Use it to check that the plugin is built into the app and the bridge works. */
  echo(options: { value: string }): Promise<{ value: string }>;
}

export declare const NativeTools: NativeToolsPlugin;
