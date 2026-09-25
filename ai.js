import {
  LINES, cloneGame, legalMoves, playMutable, immediateLocalWins,
  macroWinningBoards, criticalBoards, certificateCount, serialize
} from './engine.js';

const INF = 1e15;
const WIN = 1e12;

function transformIndex(i,t){
  let r=(i/3)|0,c=i%3;
  if(t>=4)c=2-c;
  const k=t&3;
  for(let n=0;n<k;n++){const nr=c,nc=2-r;r=nr;c=nc;}
  return r*3+c;
}

function canonicalOpeningId(id){
  const b=(id/9)|0,c=id%9;
  let best=81;
  for(let t=0;t<8;t++)best=Math.min(best,transformIndex(b,t)*9+transformIndex(c,t));
  return best;
}

export function openingRepresentatives(){
  const seen=new Set(),out=[];
  for(let id=0;id<81;id++){
    const k=canonicalOpeningId(id);
    if(!seen.has(k)){seen.add(k);out.push(id);}
  }
  return out;
}

function child(s, id) {
  const n = cloneGame(s);
  playMutable(n, id);
  return n;
}

function criticalMask(s, p) {
  let mask = 0;
  for (const b of criticalBoards(s, p)) mask |= 1 << b;
  return mask;
}

function macroScore(s, p) {
  let z = 0;
  for (const line of LINES) {
    let me=0, op=0, open=0;
    for (const b of line) {
      if (s.local[b] === p) me++;
      else if (s.local[b] === -p || s.local[b] === 2) op++;
      else open++;
    }
    if (!op) {
      if (me===2 && open===1) z += 18000;
      else if (me===1 && open===2) z += 1800;
      else if (open===3) z += 120;
    }
    if (!me) {
      if (op===2 && open===1) z -= 20000;
      else if (op===1 && open===2) z -= 1900;
    }
  }
  for (let b=0;b<9;b++) {
    if (s.local[b] === p) z += 2800;
    else if (s.local[b] === -p) z -= 3000;
  }
  return z;
}

function localPotential(s, p) {
  let z = 0;
  for (let b=0;b<9;b++) {
    if (s.local[b] !== 0) continue;
    const o=b*9;
    let macroWeight=1;
    for (const ml of LINES) if (ml.includes(b)) {
      let mine=0, enemy=0, open=0;
      for (const q of ml) {
        if (s.local[q]===p) mine++;
        else if (s.local[q]===-p || s.local[q]===2) enemy++;
        else open++;
      }
      if (!enemy) macroWeight += mine*2 + open*.15;
    }
    for (const line of LINES) {
      let me=0,op=0,em=0;
      for (const c of line) {
        const v=s.cells[o+c];
        if (v===p) me++; else if (v===-p) op++; else em++;
      }
      if (!op) {
        if (me===2&&em===1) z += 90*macroWeight;
        else if (me===1&&em===2) z += 12*macroWeight;
        else z += 1;
      }
      if (!me&&op===2&&em===1) z -= 100*macroWeight;
    }
    if (s.cells[o+4]===p) z += 10*macroWeight;
    else if (s.cells[o+4]===-p) z -= 10*macroWeight;
  }
  return z;
}

function routingScore(s, p) {
  let z=0;
  const myCrit=criticalMask(s,p), opCrit=criticalMask(s,-p);
  if (s.turn===p) {
    if (s.forced<0 && myCrit) z += 40000;
    if (s.forced>=0 && (myCrit>>s.forced&1)) z += 50000;
    if (s.forced>=0 && (opCrit>>s.forced&1)) z -= 7000;
  } else {
    if (s.forced<0 && opCrit) z -= 45000;
    if (s.forced>=0 && (opCrit>>s.forced&1)) z -= 52000;
    if (s.forced>=0 && (myCrit>>s.forced&1)) z += 6500;
  }
  return z;
}

function evalState(s,p) {
  if (s.winner===p) return WIN-s.ply;
  if (s.winner===-p) return -WIN+s.ply;
  if (s.winner===2) return 0;
  const mine=certificateCount(s,p), opp=certificateCount(s,-p);
  return macroScore(s,p)+localPotential(s,p)+routingScore(s,p)+(mine-opp)*3.5;
}

function movePriority(s,id,p) {
  const b=(id/9)|0,c=id%9;
  const n=child(s,id);
  let sc=0;
  if (n.winner===p) return 1e9;
  if (n.local[b]===p && s.local[b]===0) sc += 120000;
  const oppCrit=criticalMask(n,-p), myCrit=criticalMask(n,p);
  if (n.turn===-p) {
    if (n.forced<0 && oppCrit) sc -= 90000;
    if (n.forced>=0 && (oppCrit>>n.forced&1)) sc -= 150000;
    if (n.forced>=0 && (myCrit>>n.forced&1)) sc += 16000;
  }
  sc += Math.min(10000, (certificateCount(s,-p)-certificateCount(n,-p))*15);
  if (c===4) sc+=1500;
  else if (c===0||c===2||c===6||c===8) sc+=550;
  if (b===4) sc+=300;
  return sc;
}

function ordered(s,moves,p) {
  return moves.map(m=>[m,movePriority(s,m,p)]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
}

function boundedProof(s, attacker, depth, ctx) {
  if (s.winner===attacker) return 1;
  if (s.winner!==0) return 0;
  if (depth<=0) return 0;
  if (ctx.nodes++ >= ctx.limit || performance.now()>=ctx.stopAt) return -1;
  const key=`${depth}|${attacker}|${serialize(s)}`;
  const cached=ctx.memo.get(key);
  if (cached!==undefined) return cached;
  const ms=ordered(s,legalMoves(s),s.turn);
  let sawUnknown=false;
  if (s.turn===attacker) {
    for (const m of ms) {
      const r=boundedProof(child(s,m),attacker,depth-1,ctx);
      if (r===1) {ctx.memo.set(key,1);return 1;}
      if (r<0) sawUnknown=true;
    }
    if (sawUnknown) return -1;
    ctx.memo.set(key,0); return 0;
  }
  for (const m of ms) {
    const r=boundedProof(child(s,m),attacker,depth-1,ctx);
    if (r===0) {ctx.memo.set(key,0);return 0;}
    if (r<0) sawUnknown=true;
  }
  if (sawUnknown) return -1;
  ctx.memo.set(key,1); return 1;
}

export function proveBoundedWin(s, attacker, depth, {nodeLimit=50000,timeMs=250}={}) {
  const ctx={nodes:0,limit:nodeLimit,stopAt:performance.now()+timeMs,memo:new Map()};
  const result=boundedProof(s,attacker,depth,ctx);
  return {proven:result===1, disprovenWithinBound:result===0, unknown:result<0, nodes:ctx.nodes};
}

export function chooseMove(s, {timeMs=1200,maxDepth=12}={}) {
  const root=s.turn;
  const start=performance.now(), stopAt=start+timeMs;
  let nodes=0,tt=new Map(), timedOut=false;
  const timeUp=()=>performance.now()>=stopAt;

  let best=-1, bestScore=0, depthDone=0, proofDepth=0;

  if (s.ply>=8) {
    for (const d of [3,5,7]) {
      if (timeUp()) break;
      const proofBudget=Math.min(60000,8000*d);
      for (const m of ordered(s,legalMoves(s),root)) {
        if (timeUp()) break;
        const n=child(s,m);
        if (n.winner===root) {best=m;proofDepth=1;break;}
        const remain=Math.max(20,stopAt-performance.now());
        const pr=proveBoundedWin(n,root,d-1,{nodeLimit:proofBudget,timeMs:Math.min(220,remain)});
        if (pr.proven) {best=m;proofDepth=d;break;}
      }
      if (proofDepth) break;
    }
  }
  if (proofDepth) return {move:best,score:WIN,depth:proofDepth,nodes,proven:true,elapsed:performance.now()-start};

  function qsearch(pos,alpha,beta,qdepth) {
    nodes++;
    const stand=evalState(pos,root);
    if (qdepth<=0||pos.winner||timeUp()) return stand;
    const maximizing=pos.turn===root;
    if (maximizing) { if (stand>=beta)return stand; if (stand>alpha)alpha=stand; }
    else { if (stand<=alpha)return stand; if (stand<beta)beta=stand; }
    const cur=pos.turn;
    const critCur=criticalMask(pos,cur),critOpp=criticalMask(pos,-cur);
    let tactical=[];
    for (const m of legalMoves(pos)) {
      const b=(m/9)|0,n=child(pos,m);
      if (n.winner||n.local[b]!==pos.local[b]||critCur||critOpp) tactical.push(m);
    }
    if (tactical.length>8) tactical=ordered(pos,tactical,cur).slice(0,8);
    if (maximizing) {
      let val=stand;
      for (const m of tactical) {const v=qsearch(child(pos,m),alpha,beta,qdepth-1);if(v>val)val=v;if(v>alpha)alpha=v;if(alpha>=beta)break;}
      return val;
    }
    let val=stand;
    for (const m of tactical) {const v=qsearch(child(pos,m),alpha,beta,qdepth-1);if(v<val)val=v;if(v<beta)beta=v;if(alpha>=beta)break;}
    return val;
  }

  function alphabeta(pos,depth,alpha,beta) {
    nodes++;
    if ((nodes&1023)===0 && timeUp()) {timedOut=true;throw new Error('timeout');}
    if (pos.winner) return evalState(pos,root);
    if (depth<=0) return qsearch(pos,alpha,beta,2);
    const maximizing=pos.turn===root;
    const key=depth>=3?serialize(pos):null;
    if (key) {
      const e=tt.get(key);
      if (e&&e.depth>=depth) {
        if (e.flag===0)return e.val;
        if (e.flag===1&&e.val>alpha)alpha=e.val;
        else if (e.flag===-1&&e.val<beta)beta=e.val;
        if (alpha>=beta)return e.val;
      }
    }
    const origA=alpha,origB=beta;
    let val=maximizing?-INF:INF,bestLocal=-1;
    for (const m of ordered(pos,legalMoves(pos),pos.turn)) {
      const v=alphabeta(child(pos,m),depth-1,alpha,beta);
      if (maximizing) {if(v>val){val=v;bestLocal=m;}if(v>alpha)alpha=v;}
      else {if(v<val){val=v;bestLocal=m;}if(v<beta)beta=v;}
      if (alpha>=beta)break;
    }
    if (key) {
      let flag=0;if(val<=origA)flag=-1;else if(val>=origB)flag=1;
      tt.set(key,{depth,val,flag,move:bestLocal});
      if (tt.size>140000) {let i=0;for(const k of tt.keys()){tt.delete(k);if(++i>35000)break;}}
    }
    return val;
  }

  function rootSearch(depth) {
    let alpha=-INF,beta=INF,move=-1,score=-INF;
    const rootMoves=s.ply===0?openingRepresentatives():legalMoves(s);
    for (const m of ordered(s,rootMoves,root)) {
      if (timeUp()) {timedOut=true;throw new Error('timeout');}
      const v=alphabeta(child(s,m),depth-1,alpha,beta);
      if (v>score){score=v;move=m;}
      if (v>alpha)alpha=v;
    }
    return {move,score};
  }

  try {
    for (let d=1;d<=maxDepth;d++) {
      const r=rootSearch(d);
      if (r.move>=0){best=r.move;bestScore=r.score;depthDone=d;}
      if (Math.abs(bestScore)>WIN/2||timeUp())break;
    }
  } catch (e) {
    if (!timedOut) throw e;
  }
  if (best<0){const ms=legalMoves(s);best=ms.length?ms[0]:-1;}
  return {move:best,score:bestScore,depth:depthDone,nodes,proven:false,elapsed:performance.now()-start};
}
