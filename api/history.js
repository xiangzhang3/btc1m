export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  try{
    const u='https://query1.finance.yahoo.com/v8/finance/chart/BTC-CNY?range=max&interval=1d&events=history&includeAdjustedClose=true';
    const r=await fetch(u,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 BTC1M/1.0'}});
    if(!r.ok) throw new Error('yahoo '+r.status);
    const d=await r.json();
    const q=d?.chart?.result?.[0];
    const ts=q?.timestamp||[];
    const close=q?.indicators?.quote?.[0]?.close||[];
    const prices=[];
    for(let i=0;i<ts.length;i++){
      const p=Number(close[i]);
      if(Number.isFinite(p)&&p>0) prices.push([ts[i]*1000,p]);
    }
    if(prices.length<100) throw new Error('too_few_points');
    return res.status(200).json({source:'Yahoo Finance BTC-CNY',prices});
  }catch(e){
    return res.status(502).json({error:'history_unavailable',detail:String(e?.message||e)});
  }
}
