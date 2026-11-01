function graphPalette(counts,hand,options){
  const opts={hue_start:205,saturation:.46,lightness:.62,golden_angle:137.508,min_hue_gap:18,...Object.fromEntries(Object.entries(options||{}).filter(([,v])=>v!=null))};
  const mod=x=>((x%360)+360)%360;
  const hueOf=hex=>{const[r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),range=max-min;if(!range)return 0;
    const rc=(max-r)/range,gc=(max-g)/range,bc=(max-b)/range;let h=r===max?bc-gc:g===max?2+rc-bc:4+gc-rc;return mod(h/6*360);};
  const hsl=(h,s,l)=>{h=mod(h)/360;s=Math.max(0,Math.min(1,s));l=Math.max(0,Math.min(1,l));
    const m2=l<=.5?l*(1+s):l+s-l*s,m1=2*l-m2;
    const v=x=>{x=((x%1)+1)%1;if(x<1/6)return m1+(m2-m1)*x*6;if(x<.5)return m2;if(x<2/3)return m1+(m2-m1)*(2/3-x)*6;return m1;};
    return '#'+[h+1/3,h,h-1/3].map(x=>kgRound((s===0?l:v(x))*255).toString(16).padStart(2,'0').toUpperCase()).join('');};
  const colors=Object.create(null);for(const[d,c]of Object.entries(hand||{}))if(counts.has(d))colors[d]=String(c);
  const taken=Object.values(colors).map(hueOf),order=[...counts.keys()].filter(d=>!Object.hasOwn(colors,d)).sort((a,b)=>counts.get(b)-counts.get(a)||kgCompare(a,b));let k=0;
  for(const domain of order){let hue=null;for(let i=0;i<64;i++){const candidate=mod(opts.hue_start+k*opts.golden_angle);k++;if(taken.every(t=>{const d=mod(candidate-t);return Math.min(d,360-d)>=opts.min_hue_gap;})){hue=candidate;break;}}
    if(hue===null){hue=mod(opts.hue_start+k*opts.golden_angle);k++;}taken.push(hue);colors[domain]=hsl(hue,opts.saturation,opts.lightness);}
  return{colors,domains:[...counts].map(([name,count])=>({name,color:colors[name]||'',count})).sort((a,b)=>b.count-a.count||kgCompare(a.name,b.name))};
}
