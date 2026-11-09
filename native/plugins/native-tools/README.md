# letschat-native-tools

A small starter plugin (v8.0.0). It has one harmless method, `echo`, so you can check that a new native plugin is built into the APK and reachable from the page. Copy this folder when Letschat needs a new native Android feature.

## Try it
Inside the Android app, from the page:

```js
const NativeTools = Capacitor.registerPlugin('NativeTools');
const { value } = await NativeTools.echo({ value: 'hello' }); // value is 'hello'
```

In a normal browser the call fails (the plugin only exists in the app), so check `Capacitor.isNativePlatform()` first.

## Files
- `package.json`: the plugin name and where its Android code is (same layout as `background-service` and `chat-bubble`).
- `src/index.js`, `src/index.d.ts`: the JavaScript side.
- `android/build.gradle`: Android library settings (namespace `com.letschatafrica.nativetools`).
- `android/src/main/java/com/letschatafrica/nativetools/NativeToolsPlugin.java`: the Android code.

## Add a feature
1. Add a method with `@PluginMethod` to `NativeToolsPlugin.java`.
2. Add it to `src/index.d.ts`.
3. If it needs an Android permission, add a `<uses-permission>` line to `android/src/main/AndroidManifest.xml`.
