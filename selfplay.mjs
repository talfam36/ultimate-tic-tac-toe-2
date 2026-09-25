import {newGame,legalMoves,playMutable} from './engine.js';
import {chooseMove} from './ai.js';
for(let g=1;g<=3;g++){
  const s=newGame(); let moves=[];
  while(!s.winner&&s.ply<81){
    const r=chooseMove(s,{timeMs:25,maxDepth:4});
    if(!legalMoves(s).includes(r.move)) throw new Error(`illegal at ply ${s.ply}: ${r.move}`);
    moves.push(r.move); playMutable(s,r.move);
  }
  console.log(`game ${g}: winner=${s.winner} plies=${s.ply} moves=${moves.join(',')}`);
}
