# Ludo: two dice

- Both dice tumble for about a second on every roll (yours and the other player's), then land on real pip faces.
- Each die is used on one piece. After a roll, tap a die to choose it (when both can be used), then tap a glowing piece.
- A 6 on either die brings a piece out of base. A 6, a capture, or a piece reaching home gives another roll once both dice are used.
- A die that cannot move any piece is skipped; if neither die can move, the turn passes (or you roll again if a 6 came up).
- Rules live in `GAME_RULES.ludo` in both `client/app.js` and `server/client/server.js` and must stay identical. A move is `piece + 4 * die` (`-1` rolls). Deploy the server and the app together. One-die games already in progress still finish.
