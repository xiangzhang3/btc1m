export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  try{
    const start=new Date('2014-09-17T00:00:00Z').getTime()/1000;
    const end=Math.floor(Date.now()/1000);
    const spans=[];
    let a=start;
    while(a<end){const b=Math.min(a+360*86400,end);spans.push([a,b]);a=b+1;}
    const chunks=await Promise.all(spans.map(async([p1,p2])=>{
      const u=`https://query1.finance.yahoo.com/v8/finance/chart/BTC-CNY?period1=${Math.floor(p1)}&period2=${Math.floor(p2)}&interval=1d&events=history&includeAdjustedClose=true`;
      const r=await fetch(u,{headers:{accept:'application/json','user-agent':'Mozilla/5.0 BTC1M/1.0'}});
      if(!r.ok)throw new Error('yahoo '+r.status);
      const d=await r.json(),q=d?.chart?.result?.[0],ts=q?.timestamp||[],close=q?.indicators?.quote?.[0]?.close||[],arr=[];
      for(let i=0;i<ts.length;i++){const p=Number(close[i]);if(Number.isFinite(p)&&p>0)arr.push([ts[i]*1000,p]);}
      return arr;
    }));
    const flat=chunks.flat();
    const prices=[...new Map(flat.map(x=>[x[0],x])).values()].sort((x,y)=>x[0]-y[0]);
    if(prices.length<1000)throw new Error('too_few_points '+prices.length);
    return res.status(200).json({source:'Yahoo Finance BTC-CNY daily',prices});
  }catch(e){
    return res.status(502).json({error:'history_unavailable',detail:String(e?.message||e)});
  }
}
