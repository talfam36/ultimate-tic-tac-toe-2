import assert from 'node:assert/strict';
import {newGame,playMutable,legalMoves,certificateCount,cloneGame} from './engine.js';

function perft(s,d){if(d===0)return 1;let n=0;for(const m of legalMoves(s)){const c=cloneGame(s);assert(playMutable(c,m));n+=perft(c,d-1);}return n;}
const expected=[1,81,720,6336,55080,473256];
for(let d=0;d<expected.length;d++){const got=perft(newGame(),d);console.log('perft',d,got);assert.equal(got,expected[d]);}
assert.equal(certificateCount(newGame(),1),4096);
assert.equal(certificateCount(newGame(),-1),4096);

let seed=0x12345678;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}
for(let g=0;g<300;g++){let s=newGame(), guard=0;while(!s.winner&&guard++<81){const ms=legalMoves(s);assert(ms.length>0);const m=ms[(rnd()*ms.length)|0];assert(playMutable(s,m));for(let b=0;b<9;b++)if(s.local[b]!==0){for(const q of legalMoves(s))assert.notEqual((q/9)|0,b);}}assert(s.winner!==0||guard<=81);}
console.log('all tests passed');
