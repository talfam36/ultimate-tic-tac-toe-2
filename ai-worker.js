import {importPosition} from './engine.js';
import {chooseMove} from './ai.js';

self.onmessage = (event) => {
  const {state,timeMs=1200,maxDepth=12}=event.data;
  const result=chooseMove(importPosition(state),{timeMs,maxDepth});
  self.postMessage(result);
};
