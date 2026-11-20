const C=require('./calc.js');
const base={invest:88e6,applPrice:15e6,applLife:2e6,fee:60,interval:7,varPerSession:0,fixed:500000,payMode:'prepaid',inst:3,
 models:[{name:'fib',shots:1500,sess:4,pat:4,ok:true},{name:'nod',shots:1500,sess:6,pat:3,ok:true},{name:'scar',shots:1000,sess:4,pat:0,ok:false}]};
const near=(a,b,t)=>Math.abs(a-b)<=(t||1);
let ok=true; const chk=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c) ok=false;};
// 1) prepaid: month1 collect = 4*360000+3*540000 = 3,060,000
let R=C.simulate(base,120);
chk('prepaid m1 collect=3.06M',near(R.collect[1],3060000));
chk('program total/month=3.06M',near(R.program[1],3060000));
// 2) steady: all sessions weekly: fib 4 sess → offsets floor(k*7/30.44)=0 → all in start month; nod 6 sess → k=5 →35d → month+1
chk('steady month=2',R.steadyMonth===2);
chk('m1 sessions = 4*4+3*(5 of 6 in month1? k*7/30.44: 0,7,14,21,28→0, 35→1)',near(R.sessions[1],4*4+3*5));
chk('m2 sessions = 16+15+3*1',near(R.sessions[2],16+15+3));
// 3) revenue steady m2 = 3.06M ; accrual = shots*7.5
chk('steady revenue=3.06M',near(R.revenue[2],3060000));
chk('applCost 7.5',near(R.applCost,7.5));
chk('contrib m2 = rev - shots*7.5',near(R.contrib[2],R.revenue[2]-R.shots[2]*7.5));
// 4) cash payback prepaid
const pb=R.payback; console.log('payback',pb);
// manual: net steady = 3.06M -0.5M = 2.56M (until replacement). m1 net = 3.06-0.5=2.56 → cum = -88+2.56*m
chk('payback ≈ 88/2.56 = 34.375 (replacement after)', near(pb,34.375,0.01));
// 5) replacement cash: shots/month=4*6000+3*9000=51000 → 2,000,000/51000=39.2 months → first at month 40
chk('first replacement at month 40',R.firstRepl===40);
chk('replacement amount 15M',R.replCash[40]===15e6);
// 6) per-session pay is slower than prepaid
const s2=C.simulate(Object.assign({},base,{payMode:'session'}),120);
chk('session collect m1 < prepaid',s2.collect[1]<R.collect[1]);
chk('session payback ≥ prepaid',s2.payback>=pb);
// totals equal over long run
const sumP=R.collect.reduce((a,b)=>a+b,0), sumS=s2.collect.reduce((a,b)=>a+b,0);
console.log('collect sums',sumP,sumS);
// 7) installment N=3
const s3=C.simulate(Object.assign({},base,{payMode:'installment',inst:3}),120);
chk('inst m1 collect = prog/3',near(s3.collect[1],3060000/3));
chk('inst steady collect=3.06M',near(s3.collect[4],3060000));
// 8) reverse: 24 months mix
const rv=C.reverseMix(base,24); console.log(rv.total,rv.split);
const chk24=C.simulate({...base,models:base.models.map((m,i)=>({...m,pat:(rv.split.find(x=>x.name===m.name)||{n:0}).n}))},24).cum[24];
chk('reverse mix achieves ≥0 at 24 (fractional split)',chk24>=-1);
const rv1=C.reverseMix(base,24); const lowCfg={...base,models:base.models.map((m,i)=>({...m,pat:(rv.split.find(x=>x.name===m.name)||{n:0}).n*(rv.total-1)/rv.total}))};
chk('total-1 fails',C.simulate(lowCfg,24).cum[24]<0);
const so=C.reverseSolo(base,24,0); console.log('solo fib',so);
const sp=base.models.map(m=>m.pat); sp[0]=so.n;
chk('solo satisfies',C.simulate({...base,models:base.models.map((m,i)=>({...m,pat:sp[i]}))},24).cum[24]>=0);
sp[0]=so.n-1; chk('solo-1 fails',C.simulate({...base,models:base.models.map((m,i)=>({...m,pat:sp[i]}))},24).cum[24]<0);
// 9) zero patients
const z=C.simulate({...base,models:base.models.map(m=>({...m,pat:0}))},60); chk('zero pat → payback null',z.payback===null);
console.log(ok?'ALL PASS':'SOME FAIL');
