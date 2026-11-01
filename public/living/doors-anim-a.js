// Five page-anchored motion pieces. Each loop shows a change in the educational system.
import * as THREE from 'three';
import {world, updateWorld, m, box, ball, text, line} from './doors-ten-a.js?v=25';
const clamp=THREE.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const pulse=(t,start,len=.7)=>smooth((t-start)/len);
export function motionWorld(ctx,title,color){const scene=world(ctx,title,color);scene.g.children[0].visible=false;return scene;}

export function buildConcreteToAbstract(ctx){
 const {g,heading}=motionWorld(ctx,'من المحسوس إلى المجرد',0x273b4a),gold=m(0xf1c772,.45),cyan=m(0x80d8de,.35),violet=m(0xbba3ea,.3);
 const rings=[0,.09,.18].map((y,i)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.095+i*.04,.006,8,50),m([0x77d5dc,0xf0c572,0xc7a6e6][i],.4));r.rotation.x=Math.PI/2;r.position.y=.14+y;g.add(r);return r;});
 const object=box(.12,.12,.12,gold);object.position.y=.18;g.add(object);
 const shadow=box(.18,.008,.14,m(0x89b5b2,.1));shadow.position.y=.044;g.add(shadow);
 const symbols=['أرى','ألمس','أفهم'].map((name,i)=>{const s=text(name,.13);s.position.set((i-1)*.18,.38,.08);g.add(s);return s;});
 let clock=0,paused=false,phase=-1;
 function reset(){clock=0;paused=false;phase=-1;ctx.ui.hud('المعرفة تتحول أمامك من صورة إلى خبرة ثم مفهوم');ctx.ui.caption('من الحس إلى الفكرة');ctx.ui.choices([{label:'↻ أعد التحول',onPick:reset},{label:'⏸ أوقف الحركة',onPick:()=>{paused=!paused;ctx.ui.toast(paused?'توقفت الحركة':'استؤنفت الحركة');}}]);}
 reset();ctx.tap(object,()=>{clock=(Math.floor(clock/2.5)+1)*2.5;ctx.sfx.tap();});
 return updateWorld(g,heading,(t,dt)=>{if(!paused)clock+=dt;if(clock>8)clock=0;const p=clock/8,now=Math.min(2,Math.floor(p*3));if(now!==phase){phase=now;ctx.ui.hud(['الصورة تظهر','الخبرة تكتسب جسماً','المفهوم يبقى بعد اختفاء المجسم'][now]);}
  object.scale.setScalar(now===0?.45+.55*smooth((clock-.4)/1.5):now===1?1:.35+.65*(1-smooth((clock-5.6)/1.2)));object.rotation.set(t*.28,t*.7,t*.12);object.position.y=.18+Math.sin(t*2)*.012;
  rings.forEach((r,i)=>{r.rotation.z=t*(i%2?-.4:.4);r.scale.setScalar(.4+.6*pulse(clock,i*1.55));r.material.emissiveIntensity=.2+.5*Math.sin(t*2+i)**2;});symbols.forEach((s,i)=>s.visible=clock>i*2&&clock<7.4);shadow.scale.x=1+Math.sin(t*2)*.06;});
}

export function buildAccessBridge(ctx){
 const {g,heading}=motionWorld(ctx,'جسر يصل إلى الجميع',0x29414b),red=m(0xe98790,.2),green=m(0x91d7ab,.3),cyan=m(0x75d3df,.3),gold=m(0xecc576,.3);
 const stairs=[0,1,2,3].map(i=>{const b=box(.12,.035+i*.035,.18,red);b.position.set(-.21+i*.14,.055+i*.018,0);g.add(b);return b;});
 const ramp=box(.57,.018,.18,green);ramp.position.set(0,.12,.015);g.add(ramp);
 const travelers=[0,1,2].map((i)=>{const p=ball(.025,[cyan,gold,green][i]);p.position.set(-.27,.17,.08+i*.045);g.add(p);return p;});
 const barrier=box(.018,.14,.21,red);barrier.position.set(.08,.17,.03);g.add(barrier);const light=ball(.035,gold);light.position.set(.27,.26,0);g.add(light);
 let open=false,clock=0,phase=-1;
 function set(v){open=v;clock=0;phase=-1;ctx.sfx[v?'good':'tap']();ctx.ui.hud(v?'الجسر متاح؛ راقب الثلاثة يعبرون':'درج وحاجز يوقفان بعض المتعلمين');ctx.ui.caption('الوصول يبدأ من التصميم');ctx.ui.choices([{label:v?'↶ أظهر العائق':'✦ حوّل الدرج إلى جسر',primary:true,onPick:()=>set(!open)}]);}
 set(false);ctx.tap(barrier,()=>set(true));ctx.tap(ramp,()=>set(!open));
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;const k=smooth(clock/1.4);stairs.forEach((x,i)=>{x.scale.y=open?1-k:1;x.material.emissiveIntensity=open?.05:.2;});ramp.scale.x=open?k:.001;ramp.rotation.z=open?.08*k:0;barrier.scale.y=open?1-k:1;barrier.visible=!open||k<.99;
  travelers.forEach((x,i)=>{const progress=open?smooth((clock-1.1-i*.35)/2.2):i===0?smooth((clock-.5)/2):0;x.position.x=-.27+progress*(open?.54:.23);x.position.y=.17+Math.sin(t*5+i)*.008;});light.material.emissiveIntensity=open?.4+.4*Math.sin(t*3)**2:.08;if(open&&clock>4&&phase!==1){phase=1;ctx.ui.hud('عبر الثلاثة عندما تغير تصميم الطريق');ctx.ui.done();}});
}

export function buildBlueprintClass(ctx){
 const {g,heading}=motionWorld(ctx,'المخطط يصير درساً',0x263b4c),cyan=m(0x75d0df,.3),gold=m(0xf1c87b,.35),green=m(0x8ed3a6,.3);
 const grid=Array.from({length:7},(_,i)=>{const x=line([-.28+i*.09,.055,-.16],[-.28+i*.09,.055,.16],0x75d0df);g.add(x);return x;});
 for(let i=0;i<5;i++){const z=line([-.28,.055,-.16+i*.08],[.28,.055,-.16+i*.08],0x75d0df);g.add(z);grid.push(z);}
 const walls=[[-.28,0,.56,.014],[.28,0,.56,.014],[0,-.16,.014,.32]].map(([x,z,w,d])=>{const b=box(w,.2,d,cyan);b.position.set(x,.15,z);g.add(b);return b;});
 const desks=[-.16,0,.16].map(x=>{const b=box(.1,.06,.08,gold);b.position.set(x,.11,.06);g.add(b);return b;});
 const feedback=ball(.027,green);feedback.position.set(.23,.32,-.1);g.add(feedback);const path=line([.23,.32,-.1],[-.2,.06,-.1],0x8ed3a6);g.add(path);
 let clock=0,phase=-1;
 function reset(){clock=0;phase=-1;ctx.ui.hud('المخطط المسطح يرتفع إلى قاعة تعلم');ctx.ui.caption('التقويم يعيد تشكيل الخطة');ctx.ui.choices([{label:'↻ أعد البناء',onPick:reset}]);}
 reset();ctx.tap(feedback,reset);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>9)clock=0;const a=pulse(clock,.6,1.5),b=pulse(clock,2,1.4),c=pulse(clock,3.5,1.2),d=pulse(clock,6,1);
  grid.forEach((x,i)=>x.material.emissiveIntensity=.1+.3*(1-a));walls.forEach((x,i)=>{x.scale.y=Math.max(.002,b);x.position.y=.05+.1*b;});desks.forEach((x,i)=>{x.scale.setScalar(Math.max(.002,c));x.rotation.y=c*Math.PI*(i%2?1:-1);});feedback.position.x=.23-.43*d;feedback.position.y=.32-.24*d;feedback.material.emissiveIntensity=.2+.6*Math.sin(t*5)**2;path.visible=clock>6;
  const next=clock<2?0:clock<4?1:clock<6?2:3;if(next!==phase){phase=next;ctx.ui.hud(['مخطط وتحليل','القاعة تتشكل','التدريس يبدأ','التقويم يعود إلى التصميم'][next]);if(next===3)ctx.ui.done();}});
}

export function buildGoalBeacon(ctx){
 const {g,heading}=motionWorld(ctx,'منارة الهدف',0x263648),cyan=m(0x6bbed4,.2),gold=m(0xf0c779,.45),red=m(0xe88892,.25);
 const stones=[0,1,2,3,4].map(i=>{const b=box(.09,.024,.09,cyan);b.position.set(-.24+i*.12,.07,0);g.add(b);return b;});
 const beam=new THREE.Mesh(new THREE.ConeGeometry(.14,.38,32,1,true),new THREE.MeshBasicMaterial({color:0xf5d487,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}));beam.position.set(.25,.31,0);g.add(beam);
 const beacon=ball(.043,gold);beacon.position.set(.25,.43,0);g.add(beacon);const learner=ball(.025,red);learner.position.set(-.24,.13,.06);g.add(learner);
 let lit=true,clock=0,phase=-1;
 function toggle(){lit=!lit;clock=0;phase=-1;ctx.sfx.tap();ctx.ui.hud(lit?'الهدف معروف؛ الطريق يظهر قبل السير':'الهدف مخفي؛ الخطوات تبدو مشتتة');ctx.ui.caption('هدف واضح، مسار واضح');ctx.ui.choices([{label:lit?'أخف الهدف':'أظهر الهدف',primary:true,onPick:toggle}]);}
 toggle();toggle();ctx.tap(beacon,toggle);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>7)clock=0;const progress=lit?smooth((clock-1)/4):Math.abs(Math.sin(clock*.7))*.3;learner.position.x=-.24+progress*.48;learner.position.y=.13+Math.sin(t*6)*.006;stones.forEach((x,i)=>{const glow=lit&&clock>i*.7;x.material.emissiveIntensity=glow?.6:.08;x.position.y=.07+(glow?.012*Math.sin(t*3+i):0);});beam.visible=lit;beam.rotation.y=t*.25;beacon.material.emissiveIntensity=lit?.5+.35*Math.sin(t*3)**2:.05;if(lit&&progress>.98&&phase!==1){phase=1;ctx.ui.hud('وصل الطالب لأن الطريق كان واضحاً');ctx.ui.done();}});
}

export function buildInnovationWave(ctx){
 const {g,heading}=motionWorld(ctx,'موجة التغيير',0x27384b),colors=[0xf2c978,0x80d7e1,0x9cd5ae,0xc6a4e6],nodes=[];
 for(let ring=0;ring<3;ring++)for(let i=0;i<(ring+1)*5;i++){const angle=i*Math.PI*2/((ring+1)*5),radius=.085+ring*.09;const b=ball(.018+ring*.003,m(colors[ring],.05));b.position.set(Math.cos(angle)*radius,.13+ring*.035,Math.sin(angle)*radius*.65);g.add(b);nodes.push({b,ring,angle});}
 const seed=ball(.042,m(colors[0],.6));seed.position.set(0,.27,0);g.add(seed);const waves=[0,1,2].map(i=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.07,.004,8,64),m(colors[i+1],.35));r.rotation.x=Math.PI/2;r.position.y=.11+i*.02;g.add(r);return r;});
 let clock=0,delay=false,phase=-1;
 function restart(){clock=0;phase=-1;ctx.ui.hud('الفكرة تبدأ صغيرة ثم تنتشر عبر النظام');ctx.ui.caption('التدرج يغيّر الانتشار');ctx.ui.choices([{label:delay?'أزل عائق التبني':'أضف عائق تبني',onPick:()=>{delay=!delay;restart();}},{label:'↻ أطلق موجة جديدة',onPick:restart}]);}
 restart();ctx.tap(seed,restart);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>9)clock=0;seed.scale.setScalar(1+.2*Math.sin(t*4));waves.forEach((w,i)=>{const p=(clock-i*1.25)/2.8;w.visible=p>0&&p<1;w.scale.setScalar(.2+Math.max(0,p)*4.7);w.material.opacity=1-p;});nodes.forEach(({b,ring,angle})=>{const on=clock>ring*1.5+1+(delay&&ring===2?2:0)+Math.sin(angle*3)*.2;b.material.emissiveIntensity=on?.7:.04;b.scale.setScalar(on?1.2+.15*Math.sin(t*4+angle):.8);});const next=clock<2?0:clock<4?1:clock<7?2:3;if(phase!==next){phase=next;ctx.ui.hud(['فكرة جديدة','تجربة مصغرة','انتشار بين الممارسين',delay?'العائق أبطأ الانتشار':'صار المستحدث جزءاً من النظام'][next]);if(next===3)ctx.ui.done();}});
}
