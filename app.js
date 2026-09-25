import {
  newGame, playMutable, legalMoves, exportPosition,
  certificateCount, criticalBoards
} from './engine.js';

let state = newGame();
let human = 1;
let thinking = false;
let history = [];
let activeWorker = null;
let gameToken = 0;

const boardEl = document.querySelector('#board');
const statusEl = document.querySelector('#status');
const analysisEl = document.querySelector('#analysis');
const searchEl = document.querySelector('#search');
const sideEl = document.querySelector('#side');
const strengthEl = document.querySelector('#strength');

function sym(p) { return p===1 ? 'X' : p===-1 ? 'O' : '—'; }
function boardName(i) { return ['↖','↑','↗','←','●','→','↙','↓','↘'][i] ?? 'any'; }

function makeBoard() {
  boardEl.innerHTML='';
  for (let b=0;b<9;b++) {
    const mini=document.createElement('div');
    mini.className='mini';
    mini.dataset.b=b;
    for (let c=0;c<9;c++) {
      const btn=document.createElement('button');
      btn.className='cell';
      btn.dataset.id=b*9+c;
      btn.setAttribute('aria-label',`board ${b+1}, cell ${c+1}`);
      btn.onclick=()=>humanMove(b*9+c);
      mini.appendChild(btn);
    }
    boardEl.appendChild(mini);
  }
}

function render() {
  const lm=new Set(legalMoves(state));
  for (let id=0;id<81;id++) {
    const el=boardEl.querySelector(`[data-id="${id}"]`);
    const v=state.cells[id];
    el.textContent=v===1?'X':v===-1?'O':'';
    el.className='cell '+(v===1?'x':v===-1?'o':'')+
      (lm.has(id)&&state.turn===human&&!thinking?' legal':'')+
      (id===state.last?' last':'');
    el.disabled=!lm.has(id)||state.turn!==human||thinking;
  }

  for (let b=0;b<9;b++) {
    const mini=boardEl.children[b];
    mini.className='mini'+
      (state.local[b]===1?' won-x':state.local[b]===-1?' won-o':state.local[b]===2?' drawn':'')+
      ((state.forced===b&&state.local[b]===0)?' forced':'');
    let badge=mini.querySelector('.macro-badge');
    if (!badge) {
      badge=document.createElement('div');
      badge.className='macro-badge';
      mini.appendChild(badge);
    }
    badge.textContent=state.local[b]===1?'X':state.local[b]===-1?'O':state.local[b]===2?'=':'';
  }

  if (state.winner===1) statusEl.textContent='X wins the macro board.';
  else if (state.winner===-1) statusEl.textContent='O wins the macro board.';
  else if (state.winner===2) statusEl.textContent='Draw.';
  else if (thinking) statusEl.textContent=`Bot is thinking as ${sym(state.turn)}…`;
  else statusEl.textContent=`${sym(state.turn)} to move · ${state.forced<0?'free choice':`play in ${boardName(state.forced)} board`}`;

  const cx=certificateCount(state,1), co=certificateCount(state,-1);
  const critX=criticalBoards(state,1), critO=criticalBoards(state,-1);
  analysisEl.innerHTML=
    `<div><b>Structural certificates</b> X ${cx} · O ${co}</div>`+
    `<div><b>Immediate global-threat boards</b> X ${critX.length?critX.map(boardName).join(' '):'none'} · O ${critO.length?critO.map(boardName).join(' '):'none'}</div>`+
    `<div><b>Ply</b> ${state.ply}</div>`;
}

function humanMove(id) {
  if (thinking || state.turn!==human || !legalMoves(state).includes(id)) return;
  history.push(exportPosition(state));
  playMutable(state,id);
  render();
  maybeBot();
}

function maybeBot() {
  if (state.winner || state.turn===human) return;
  thinking=true;
  render();
  const token=gameToken;
  const worker=new Worker('./ai-worker.js',{type:'module'});
  activeWorker=worker;
  const ms=Number(strengthEl.value);

  worker.onmessage=(event)=>{
    worker.terminate();
    if (activeWorker===worker) activeWorker=null;
    if (token!==gameToken) return;
    const r=event.data;
    if (r.move>=0 && !state.winner) {
      history.push(exportPosition(state));
      playMutable(state,r.move);
    }
    thinking=false;
    searchEl.textContent=r.proven
      ? `PROVED bounded win · horizon ${r.depth} · ${r.nodes.toLocaleString()} search nodes`
      : `search depth ${r.depth} · ${r.nodes.toLocaleString()} nodes · ${Math.round(r.elapsed)} ms`;
    render();
    if (!state.winner && state.turn!==human) maybeBot();
  };

  worker.onerror=()=>{
    worker.terminate();
    if (activeWorker===worker) activeWorker=null;
    if (token!==gameToken) return;
    thinking=false;
    statusEl.textContent='AI worker error. Reload the page.';
  };

  worker.postMessage({state:exportPosition(state),timeMs:ms,maxDepth:12});
}

function reset() {
  gameToken++;
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker=null;
  }
  state=newGame();
  history=[];
  human=sideEl.value==='X'?1:-1;
  thinking=false;
  searchEl.textContent='';
  render();
  maybeBot();
}

document.querySelector('#new').onclick=reset;
sideEl.onchange=reset;
strengthEl.onchange=()=>{};
document.querySelector('#undo').onclick=()=>{
  if (thinking||!history.length) return;
  let target=history.pop();
  while (target && target.turn!==human && history.length) target=history.pop();
  if (target) {
    state={...target,cells:Int8Array.from(target.cells),local:Int8Array.from(target.local)};
    searchEl.textContent='';
    render();
  }
};

makeBoard();
reset();
