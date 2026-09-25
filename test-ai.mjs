import assert from 'node:assert/strict';
import {newGame,legalMoves,playMutable} from './engine.js';
import {chooseMove,proveBoundedWin,openingRepresentatives} from './ai.js';

assert.equal(openingRepresentatives().length,15,'empty board should have 15 D4 opening classes');
let s=newGame();
let r=chooseMove(s,{timeMs:80,maxDepth:4});
assert(legalMoves(s).includes(r.move));
playMutable(s,r.move);

let seed=0xabcddcba;function rnd(){seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/2**32;}
for(let g=0;g<30;g++){
  s=newGame();
  for(let ply=0;ply<18&&!s.winner;ply++){
    const ms=legalMoves(s);
    if(ply%2===0){const q=chooseMove(s,{timeMs:20,maxDepth:3});assert(ms.includes(q.move),`illegal AI move ${q.move}`);playMutable(s,q.move);}
    else playMutable(s,ms[(rnd()*ms.length)|0]);
  }
}

s=newGame();
s.local[0]=1;s.local[1]=1;s.cells[18]=1;s.cells[19]=1;s.forced=2;s.turn=1;s.ply=6;
let pr=proveBoundedWin(s,1,1,{nodeLimit:1000,timeMs:100});
assert(pr.proven,'one-ply win should be proven');
r=chooseMove(s,{timeMs:100,maxDepth:3});
assert.equal(r.move,20,'AI should take immediate macro win');
console.log('AI tests passed',r);
