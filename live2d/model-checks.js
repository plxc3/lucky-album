// Project semantics checked before calling the official SDK parser.
export function validateParameters(parameters,kind){
  const expected=kind==='cat'?['ParamLuckyEar','ParamLuckyTail','ParamBreath','ParamLuckyResponse']:
    kind==='girl'?['ParamBreath','ParamLuckyResponse']:null;
  if(!expected)throw Error('Unknown character');
  const ids=[...parameters.ids];
  if(ids.length!==expected.length||new Set(ids).size!==ids.length||!expected.every(id=>ids.includes(id)))
    throw Error('Actual parameter IDs/count mismatch');
  const bounds=new Map();
  for(const [i,id] of ids.entries()){
    const low=id==='ParamLuckyEar'||id==='ParamLuckyTail'?-1:0;
    if(parameters.minimumValues[i]!==low||parameters.maximumValues[i]!==1||parameters.defaultValues[i]!==0)
      throw Error('Actual parameter range/default mismatch');
    bounds.set(id,[low,1]);
  }
  return {ids,bounds};
}
export function validateMotion(json,ids,bounds){
  if(json.Version!==3||!Number.isFinite(json.Meta?.Duration)||json.Meta.Duration<=0||
    !Array.isArray(json.Curves)||json.Curves.length!==ids.length)throw Error('Invalid motion structure');
  const seen=new Set();
  for(const c of json.Curves){
    if(c.Target!=='Parameter'||!ids.includes(c.Id)||seen.has(c.Id))throw Error('Missing or duplicate motion parameter');
    seen.add(c.Id);const [low,high]=bounds.get(c.Id),s=c.Segments;
    if(!Array.isArray(s)||s.length<2||!s.every(Number.isFinite)||s[0]!==0||s[1]<low||s[1]>high)throw Error('Invalid motion point');
    let cursor=2,time=s[0];
    while(cursor<s.length){
      if(s[cursor]!==1||cursor+7>s.length)throw Error('Expected complete cubic motion segment');
      const p=s.slice(cursor+1,cursor+7),times=[p[0],p[2],p[4]],values=[p[1],p[3],p[5]];
      if(times.some(t=>t<time||t>json.Meta.Duration)||times[0]>times[1]||times[1]>times[2]||
        times[2]<=time||values.some(v=>v<low||v>high))throw Error('Motion time or value outside bounds');
      time=times[2];cursor+=7;
    }
    if(Math.abs(time-json.Meta.Duration)>1e-6)throw Error('Motion end time mismatch');
  }
}
