export const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

export function newGame() {
  return {
    cells: new Int8Array(81),
    local: new Int8Array(9),
    forced: -1,
    turn: 1,
    winner: 0,
    ply: 0,
    last: -1,
  };
}

export function cloneGame(s) {
  return {
    cells: new Int8Array(s.cells),
    local: new Int8Array(s.local),
    forced: s.forced,
    turn: s.turn,
    winner: s.winner,
    ply: s.ply,
    last: s.last,
  };
}

export function boardCellId(board, cell) { return board * 9 + cell; }
export function idToMove(id) { return { board: Math.floor(id / 9), cell: id % 9 }; }

export function lineWinner9(values, player) {
  for (const [a,b,c] of LINES) {
    if (values[a] === player && values[b] === player && values[c] === player) return true;
  }
  return false;
}

export function localWinner(s, board, player) {
  const o = board * 9;
  for (const [a,b,c] of LINES) {
    if (s.cells[o+a] === player && s.cells[o+b] === player && s.cells[o+c] === player) return true;
  }
  return false;
}

export function legalMoves(s) {
  if (s.winner !== 0) return [];
  const out = [];
  if (s.forced >= 0 && s.local[s.forced] === 0) {
    const o = s.forced * 9;
    for (let c = 0; c < 9; c++) if (s.cells[o+c] === 0) out.push(o+c);
    return out;
  }
  for (let b = 0; b < 9; b++) {
    if (s.local[b] !== 0) continue;
    const o = b * 9;
    for (let c = 0; c < 9; c++) if (s.cells[o+c] === 0) out.push(o+c);
  }
  return out;
}

export function isLegal(s, id) {
  if (s.winner !== 0 || id < 0 || id >= 81 || s.cells[id] !== 0) return false;
  const b = Math.floor(id/9);
  if (s.local[b] !== 0) return false;
  return s.forced < 0 || s.local[s.forced] !== 0 || b === s.forced;
}

export function playMutable(s, id) {
  if (!isLegal(s, id)) return false;
  const p = s.turn;
  const b = Math.floor(id / 9), c = id % 9;
  s.cells[id] = p;
  s.last = id;
  s.ply++;

  if (localWinner(s, b, p)) {
    s.local[b] = p;
  } else {
    let full = true;
    const o = b * 9;
    for (let k=0;k<9;k++) if (s.cells[o+k] === 0) { full = false; break; }
    if (full) s.local[b] = 2;
  }

  if (lineWinner9(s.local, p)) {
    s.winner = p;
    s.forced = -1;
  } else {
    let anyOpen = false;
    for (let k=0;k<9;k++) if (s.local[k] === 0) { anyOpen = true; break; }
    if (!anyOpen) {
      s.winner = 2;
      s.forced = -1;
    } else {
      s.forced = s.local[c] === 0 ? c : -1;
      s.turn = -p;
    }
  }
  return true;
}

export function play(s, id) {
  const n = cloneGame(s);
  if (!playMutable(n, id)) return null;
  return n;
}

export function immediateLocalWins(s, board, player) {
  if (board < 0 || s.local[board] !== 0) return [];
  const out = [];
  const o = board * 9;
  for (let c=0;c<9;c++) {
    const id=o+c;
    if (s.cells[id] !== 0) continue;
    s.cells[id] = player;
    if (localWinner(s, board, player)) out.push(c);
    s.cells[id] = 0;
  }
  return out;
}

export function macroWinningBoards(s, player) {
  const out = new Set();
  for (const line of LINES) {
    let mine=0, target=-1, blocked=false;
    for (const b of line) {
      if (s.local[b] === player) mine++;
      else if (s.local[b] === 0) { if (target < 0) target=b; else target=-2; }
      else { blocked=true; break; }
    }
    if (!blocked && mine === 2 && target >= 0) out.add(target);
  }
  return [...out];
}

export function criticalBoards(s, player) {
  const macro = new Set(macroWinningBoards(s, player));
  const out = [];
  for (const b of macro) if (immediateLocalWins(s, b, player).length) out.push(b);
  return out;
}

export function survivingLocalLines(s, board, player) {
  if (s.local[board] === player) return 1;
  if (s.local[board] !== 0) return 0;
  const opp = -player, o=board*9;
  let n=0;
  for (const line of LINES) {
    let ok=true;
    for (const c of line) if (s.cells[o+c] === opp) {ok=false; break;}
    if (ok) n++;
  }
  return n;
}

export function certificateCount(s, player) {
  let total=0;
  for (const macroLine of LINES) {
    let ways=1;
    for (const b of macroLine) {
      const n = survivingLocalLines(s,b,player);
      if (!n) { ways=0; break; }
      ways *= n;
    }
    total += ways;
  }
  return total;
}

export function serialize(s) {
  let body='';
  for (let i=0;i<81;i++) body += s.cells[i]===1?'X':s.cells[i]===-1?'O':'.';
  return `${s.turn}|${s.forced}|${s.winner}|${body}`;
}

export function exportPosition(s) {
  return {
    cells: Array.from(s.cells), local: Array.from(s.local), forced:s.forced,
    turn:s.turn, winner:s.winner, ply:s.ply, last:s.last
  };
}

export function importPosition(o) {
  return {
    cells: Int8Array.from(o.cells), local: Int8Array.from(o.local),
    forced:o.forced, turn:o.turn, winner:o.winner, ply:o.ply, last:o.last
  };
}
