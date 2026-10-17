# Ludo: two dice

- Both dice tumble for about a second on every roll (yours and the other player's), then land on real pip faces.
- Each die is used on one piece. After a roll, tap a die to choose it (when both can be used), then tap a glowing piece.
- A 6 on either die brings a piece out of base. A 6, a capture, or a piece reaching home gives another roll once both dice are used.
- A die that cannot move any piece is skipped; if neither die can move, the turn passes (or you roll again if a 6 came up).
- Rules live in `GAME_RULES.ludo` in both `client/app.js` and `server/client/server.js` and must stay identical. A move is `piece + 4 * die` (`-1` rolls). Deploy the server and the app together. One-die games already in progress still finish.

## Visual upgrade
- Realistic board: wooden frame with grain and brass studs, glossy coloured yards with sockets, cream track with stars, home columns with arrows, and a centre of four glossy triangles with a jewel.
- 3D pawns with shading and a ground shadow. Pieces that can move bob and show a pulsing ring; the yard of the player whose turn it is glows.
- Pawns hop square by square, captured pawns fly back to their yard, and there are dust, capture, home sparkle and win confetti effects.
- 3D cube dice with real pips that toss and tumble, then land on the rolled face with a bounce and a shadow.
- Rules are unchanged; only `LudoBoard`, `LudoDie` and the Ludo CSS in `client/app.js` changed.

Update: the Snakes & Ladders die is now the same 3D cube as Ludo (tumbles about a second on every roll, yours or the other player's, then lands on the rolled face). The Ludo icon in the Games hub also spins in 3D.

Snakes & Ladders effects: after the 3D die lands the pawn hops square by square with a shadow; the first move out of the start gives a dust puff; a ladder gives a gold sparkle burst at the bottom and top; a snake shakes the board (with a short vibration) and bursts pink; a 6 pops a "SIX!" banner; reaching 100 rains confetti. All effects are skipped for people who prefer reduced motion.

Update: the Solo arcade tile and the Dominoes (coming soon) tile were removed from the Games screen.

