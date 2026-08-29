const MEMPOOL='https://mempool.space/api';
const BLOCKSTREAM='https://blockstream.info/api';

async function json(url){
  const r=await fetch(url,{headers:{accept:'application/json','user-agent':'BTC1M/1.0'}});
  if(!r.ok)throw new Error(`${url} ${r.status}`);
  return r.json();
}

function normalizeBlock(block,source){
  const fees=block?.extras?.totalFees;
  return {height:Number(block.height),hash:block.id,timestamp:Number(block.timestamp),txCount:Number(block.tx_count),size:Number(block.size),weight:Number(block.weight),fees:Number.isFinite(Number(fees))?Number(fees):null,difficulty:Number.isFinite(Number(block.difficulty))?Number(block.difficulty):null,source};
}

async function fromMempool(){
  const [blocks,adjustment]=await Promise.all([json(`${MEMPOOL}/v1/blocks`),json(`${MEMPOOL}/v1/difficulty-adjustment`)]);
  if(!Array.isArray(blocks)||blocks.length<2)throw new Error('mempool blocks unavailable');
  return {source:'mempool.space',blocks:blocks.slice(0,10).map(x=>normalizeBlock(x,'mempool.space')),adjustment:{progressPercent:Number(adjustment.progressPercent),remainingBlocks:Number(adjustment.remainingBlocks),estimatedRetargetDate:Number(adjustment.estimatedRetargetDate),difficultyChange:Number(adjustment.difficultyChange)}};
}

async function fromBlockstream(){
  const blocks=await json(`${BLOCKSTREAM}/blocks`);
  if(!Array.isArray(blocks)||blocks.length<2)throw new Error('blockstream blocks unavailable');
  const height=Number(blocks[0].height),epochStart=height-height%2016;
  const epochHash=await fetch(`${BLOCKSTREAM}/block-height/${epochStart}`).then(async r=>{if(!r.ok)throw new Error(`blockstream epoch ${r.status}`);return r.text()});
  const epoch=await json(`${BLOCKSTREAM}/block/${epochHash.trim()}`),elapsed=Math.max(1,Number(blocks[0].timestamp)-Number(epoch.timestamp)),mined=height-epochStart,remainingBlocks=2016-mined;
  return {source:'Blockstream Esplora (fallback)',blocks:blocks.slice(0,10).map(x=>normalizeBlock(x,'Blockstream Esplora')),adjustment:{progressPercent:mined/2016*100,remainingBlocks,estimatedRetargetDate:(Number(blocks[0].timestamp)+remainingBlocks*(elapsed/Math.max(1,mined)))*1000,difficultyChange:null}};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=45, stale-while-revalidate=300');
  try{
    let payload;
    try{payload=await fromMempool()}catch(primaryError){payload=await fromBlockstream();payload.primaryError=String(primaryError?.message||primaryError)}
    const [latest,previous]=payload.blocks;
    return res.status(200).json({...payload,updatedAt:Date.now(),tip:{height:latest.height,hash:latest.hash,timestamp:latest.timestamp,intervalSeconds:Math.max(0,latest.timestamp-previous.timestamp),difficulty:latest.difficulty}});
  }catch(error){return res.status(502).json({error:'bitcoin_network_unavailable',detail:String(error?.message||error)})}
}
