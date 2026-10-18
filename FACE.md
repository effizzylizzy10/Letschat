# Face effects (Live and Live Meeting)

Open the sparkle button (Your video) > "Face effects (follow your face)". Tap items to turn them on or off: Top hat, Party hat, Crown, Glasses, Shades, Beard, Moustache, Beer. One hat and one pair of glasses at a time; the rest combine. "None" clears all.

- The items follow your head (move, tilt, come closer) and are drawn into the picture before it is sent, so everyone sees them and the recording keeps them.
- Tracking: MediaPipe Face Landmarker first, the phone's own FaceDetector as a backup. The first time, the tracking files are downloaded (about 5 MB) and saved on the phone. To make it work offline from the start, copy the files listed in `client/vendor/face/README.txt` into `client/vendor/face/` (the server must serve `.mjs` as JavaScript, `.wasm` as application/wasm).
- Not shown on keypad / very small screens (320 px and under), on phones that cannot process video, or while sharing your screen or showing a picture.
- Settings: `LETSCHAT_CONFIG.FACE = { BASE, CDN, MODEL }` in config.js overrides the file locations.
- Pixels are drawn about 10 times a second from the tracker; if the face is lost for more than 0.7 s the items disappear until it is found again.
