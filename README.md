# Ultimate Tic-Tac-Toe — Routing Research Bot

A zero-build browser implementation of **modern Ultimate Tic-Tac-Toe** with a routing-aware AI inspired by threat-space search, proof-number methods, and the routing/certificate ideas developed in this project.

## Play

For this repository, the intended Pages URL is:

**https://talfam36.github.io/ultimate-tic-tac-toe-2/**

The included GitHub Actions workflow deploys the site from `main`. If GitHub asks once for a Pages source, choose **Settings → Pages → GitHub Actions**.

The app is static: `index.html`, `style.css`, `app.js`, `engine.js`, and `ai-worker.js`. It can be hosted directly with GitHub Pages or any static server.

> **Status:** strong experimental bot, **not a proven never-losing strategy**. The modern closed-board version of Ultimate Tic-Tac-Toe is not currently known to be completely solved.

## Rules implemented

- X may open in any of 81 cells.
- A move in relative cell `j` sends the opponent to local board `j`.
- Won or drawn local boards close immediately.
- If sent to a closed board, the player gets free choice among all open boards.
- Three won local boards in a global row/column/diagonal wins.
- If all local boards close with no macro line, the game is a draw.

## Bot architecture

The browser worker combines:

- exact move generation and terminal detection;
- iterative-deepening alpha-beta with a transposition table;
- tactical quiescence extensions;
- exact bounded AND/OR forced-win proofs (a `true` result is a real proof within the searched horizon; failure is only “not proved”);
- critical-board routing analysis: boards where immediate local victory would also complete a macro line;
- a **4,096 structural-certificate metric**. There are `8 × 8³ = 4096` minimal choices of a macro winning line and one local winning line in each constituent board. The engine counts which remain unblocked by current occupancy;
- move ordering that penalizes routing the opponent into immediate global-threat boards or giving a dangerous wildcard;
- routing-aware macro/local evaluation.

The UI displays certificate counts and currently critical macro boards so the strategic model is visible while you play.

## Research direction

The next major step is to replace increasingly large parts of heuristic search with sound **Routing Virtual Connection (RVC)** rules: reusable lemmas that prove a set of routing destinations forces access to a winning threat carrier, analogous to virtual connections in Hex.

A complete solution would require a proof certificate/verifier or an independently validated exhaustive proof. This repository deliberately does **not** claim one before it exists.

## Local development

Because the AI uses a Web Worker, serve the directory over HTTP rather than opening `index.html` as a `file://` URL. For example, any static development server works.
