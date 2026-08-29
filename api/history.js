export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  const out=[];
  try{
    const r=await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=cny&days=max&interval=daily',{headers:{accept:'application/json','user-agent':'BTC1M/1.0'}});
    if(r.ok){
      const d=await r.json();
      if(Array.isArray(d.prices)&&d.prices.length){
        return res.status(200).json({source:'coingecko',prices:d.prices});
      }
    }
  }catch(e){}
  try{
    let toTs=Math.floor(Date.now()/1000);
    for(let page=0;page<4;page++){
      const u=`https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=CNY&limit=2000&toTs=${toTs}`;
      const r=await fetch(u,{headers:{accept:'application/json','user-agent':'BTC1M/1.0'}});
      if(!r.ok) break;
      const d=await r.json();
      const rows=d?.Data?.Data||[];
      if(!rows.length) break;
      rows.forEach(x=>{if(x.time&&x.close>0)out.push([x.time*1000,x.close])});
      toTs=rows[0].time-86400;
      if(new Date(rows[0].time*1000).getUTCFullYear()<=2010) break;
    }
    const uniq=[...new Map(out.map(x=>[x[0],x])).values()].sort((a,b)=>a[0]-b[0]);
    if(uniq.length)return res.status(200).json({source:'cryptocompare',prices:uniq});
  }catch(e){}
  return res.status(502).json({error:'history_unavailable'});
}
