// Motion pieces for simulation, film, radio, collaborative pages and mobile learning.
import * as THREE from 'three';
import {updateWorld, m, box, ball, text, line} from './doors-ten-a.js?v=25';
import {motionWorld} from './doors-anim-a.js?v=25';
const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};

export function buildSafeReactor(ctx){
 const {g,heading}=motionWorld(ctx,'داخل المحاكاة الآمنة',0x25334b),blue=m(0x70d4e2,.4),gold=m(0xf3c677,.4),red=m(0xed8286,.3);
 const vessel=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.23,32,1,true),new THREE.MeshStandardMaterial({color:0x79c6d2,transparent:true,opacity:.26,metalness:.6,roughness:.2,side:THREE.DoubleSide}));vessel.position.y=.2;g.add(vessel);
 const core=ball(.05,gold);core.position.y=.2;g.add(core);const rods=[-.07,0,.07].map(x=>{const b=box(.022,.14,.022,blue);b.position.set(x,.31,0);g.add(b);return b;});
 const cooling=[0,1,2].map((_,i)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.11+i*.018,.006,8,50),m(0x70d4e2,.5));r.rotation.x=Math.PI/2;r.position.y=.13+i*.07;g.add(r);return r;});
 const gauge=box(.36,.014,.02,blue);gauge.position.set(0,.06,.17);g.add(gauge);const needle=ball(.014,gold);needle.position.set(-.15,.077,.18);g.add(needle);
 let clock=0,stress=false,phase=-1;
 function reset(){clock=0;phase=-1;ctx.ui.hud('محاكاة تعليمية: راقب أثر تغيير متغير واحد');ctx.ui.caption('غيّر متغيراً، راقب الأثر');ctx.ui.choices([{label:stress?'↶ أعد الحالة المستقرة':'غيّر الحمل',primary:true,onPick:()=>{stress=!stress;reset();}},{label:'↻ أعد الزمن',onPick:reset}]);}
 reset();ctx.tap(core,()=>{stress=!stress;reset();});
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>8)clock=0;const rise=smooth((clock-1)/2),recover=smooth((clock-4.5)/2);const heat=stress?rise*(1-recover):.15;core.scale.setScalar(1+heat*.45+Math.sin(t*5)*.04);core.material=heat>.5?red:gold;core.material.emissiveIntensity=.4+heat*.7;rods.forEach((r,i)=>r.position.y=.31+(stress?heat*.035:0)+Math.sin(t*2+i)*.006);cooling.forEach((r,i)=>{r.rotation.z=t*(i%2?-.8:.8);r.material.emissiveIntensity=stress&&heat>.5?.15:.5;});needle.position.x=-.15+heat*.3;vessel.rotation.y=t*.17;const next=clock<2?0:clock<4.5?1:clock<6.5?2:3;if(next!==phase){phase=next;ctx.ui.hud(['النظام يعمل','تغير متغير واحد',stress?'ظهر أثر التغير':'استقر النموذج',stress?'أعد الزمن وقارن':'استنتج علاقة السبب بالنتيجة'][next]);if(next===3)ctx.ui.done();}});
}

export function buildFilmIllusion(ctx){
 const {g,heading}=motionWorld(ctx,'حين تتحرك الصورة الثابتة',0x322d49),dark=m(0x27344b,.2),gold=m(0xf0ca83,.4),cyan=m(0x7bcfdd,.3);
 const reel=[-.23,.23].map(x=>{const wheel=new THREE.Mesh(new THREE.TorusGeometry(.075,.014,10,48),gold);wheel.position.set(x,.29,-.08);g.add(wheel);const hub=ball(.018,dark);hub.position.copy(wheel.position);g.add(hub);return wheel;});
 const strip=box(.5,.11,.014,dark);strip.position.set(0,.16,-.03);g.add(strip);const frames=Array.from({length:7},(_,i)=>{const f=box(.055,.075,.015,i%2?cyan:gold);f.position.set(-.27+i*.09,.16,0);g.add(f);return f;});
 const screen=box(.22,.19,.018,m(0xf2e6d5,.2));screen.position.set(0,.25,.08);g.add(screen);const actor=ball(.025,cyan);actor.position.set(0,.25,.105);g.add(actor);const shutter=box(.23,.2,.01,dark);shutter.position.set(0,.25,.115);g.add(shutter);
 let clock=0,fast=false,phase=-1;
 function change(){fast=!fast;clock=0;phase=-1;ctx.ui.hud(fast?'الإطارات تتلاحق فتظهر الحركة':'الإطارات منفصلة؛ ترى صوراً ثابتة');ctx.ui.caption('صور متتابعة تولّد حركة');ctx.ui.choices([{label:fast?'أبطئ الشريط':'سرّع الشريط',primary:true,onPick:change},{label:'↻ أعد العرض',onPick:()=>{clock=0;phase=-1;}}]);}
 change();change();ctx.tap(screen,change);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;const speed=fast?7:1.3;reel.forEach((w,i)=>w.rotation.z=t*speed*(i?1:-1));frames.forEach((f,i)=>{f.position.x=-.27+((i*.09+clock*speed*.026)%.63);f.material.emissiveIntensity=.12+.35*Math.sin(t*speed+i)**2;});actor.position.x=Math.sin(clock*(fast?6:1.2))*.065;actor.position.y=.24+Math.abs(Math.sin(clock*(fast?6:1.2)))*.045;shutter.visible=!fast&&Math.sin(clock*6)>0;screen.material.emissiveIntensity=fast?.45:.13;if(clock>4&&phase!==1){phase=1;ctx.ui.hud(fast?'لم تر صوراً منفصلة، بل حركة':'ما زلت تميز كل إطار وحده');ctx.ui.done();}});
}

export function buildRadioWave(ctx){
 const {g,heading}=motionWorld(ctx,'الصوت يعبر الصفحة',0x203e4b),gold=m(0xecc778,.4),cyan=m(0x77d4df,.35),green=m(0x8fd7ab,.3);
 const tower=box(.025,.27,.025,gold);tower.position.set(-.25,.18,0);g.add(tower);const source=ball(.035,gold);source.position.set(-.25,.34,0);g.add(source);
 const ring=Array.from({length:5},(_,i)=>{const w=new THREE.Mesh(new THREE.TorusGeometry(.04,.004,8,48),m(0x80d7e2,.5));w.position.set(-.24,.29,.01);g.add(w);return w;});
 const receivers=[-.03,.12,.26].map((x,i)=>{const b=box(.065,.11,.06,m(0x5b7991,.15));b.position.set(x,.11,i%2?.08:-.05);g.add(b);const light=ball(.014,green);light.position.set(x,.2,i%2?.08:-.05);g.add(light);return {b,light,x};});
 const waveform=Array.from({length:12},(_,i)=>{const b=box(.009,.03,.008,cyan);b.position.set(-.18+i*.034,.08,.14);g.add(b);return b;});
 let clock=0,muted=false,phase=-1;
 function set(){muted=!muted;clock=0;phase=-1;ctx.ui.hud(muted?'انقطع المصدر؛ المستقبلات صامتة':'الموجة تحمل درساً إلى أماكن مختلفة');ctx.ui.caption('الصوت يصل إلى البعيد');ctx.ui.choices([{label:muted?'أعد البث':'أوقف البث',primary:true,onPick:set},{label:'↻ شاهد الموجة',onPick:()=>{clock=0;phase=-1;}}]);}
 set();set();ctx.tap(source,set);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>6)clock=0;source.material.emissiveIntensity=muted?.06:.5+.3*Math.sin(t*5)**2;ring.forEach((r,i)=>{const p=((clock*1.5+i*.2)%3)/3;r.visible=!muted;r.scale.setScalar(.3+p*6);r.material.opacity=(1-p)*.55;});receivers.forEach(({b,light,x},i)=>{const active=!muted&&clock>(i+1)*.8;light.material.emissiveIntensity=active?.8:.04;light.scale.setScalar(active?1.4:1);b.rotation.y=Math.sin(t*2+i)*.05;});waveform.forEach((b,i)=>b.scale.y=muted?.1:.25+Math.abs(Math.sin(t*5+i*.65))*.9);if(clock>3.8&&phase!==1){phase=1;ctx.ui.hud(muted?'لا موجة بلا مصدر':'وصلت الرسالة الصوتية إلى ثلاث نقاط');ctx.ui.done();}});
}

export function buildWikiConstellation(ctx){
 const {g,heading}=motionWorld(ctx,'المعرفة التي يكتبها الجميع',0x29364b),cyan=m(0x80d7df,.3),gold=m(0xedc779,.3),green=m(0x8dd3a5,.3),red=m(0xe88d95,.25);
 const pages=[[-.2,.13], [0,.31], [.2,.13], [0,.14]].map(([x,y],i)=>{const p=box(.12,.1,.014,[cyan,gold,green,red][i]);p.position.set(x,y,0);g.add(p);const l=text(['صفحة','إضافة','تصحيح','نسخة سابقة'][i],.115);l.position.set(x,y+.1,.02);g.add(l);return {p,l,x,y};});
 const links=[[0,1],[1,2],[2,3],[3,0]].map(([a,b])=>{const q=line([pages[a].x,pages[a].y,0],[pages[b].x,pages[b].y,0],0x89d6e2);g.add(q);return q;});
 const cursor=ball(.018,gold);cursor.position.set(-.2,.13,.04);g.add(cursor);
 let clock=0,revert=false,phase=-1;
 function reset(){clock=0;phase=-1;ctx.ui.hud(revert?'راجعت النسخة السابقة ثم استعدت معلومة':'صفحة تنمو بإضافات متعددة ومراجعة لاحقة');ctx.ui.caption('معرفة تتجدد');ctx.ui.choices([{label:revert?'تابع الكتابة':'اعرض تاريخ التعديل',primary:true,onPick:()=>{revert=!revert;reset();}},{label:'↻ أعد القصة',onPick:reset}]);}
 reset();ctx.tap(pages[3].p,()=>{revert=!revert;reset();});
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>8)clock=0;const targets=revert?[0,3,2,1]:[0,1,2,3],segment=Math.min(3,Math.floor(clock/1.7)),k=smooth((clock%1.7)/1.7),a=pages[targets[segment]],b=pages[targets[Math.min(3,segment+1)]];cursor.position.x=THREE.MathUtils.lerp(a.x,b.x,k);cursor.position.y=THREE.MathUtils.lerp(a.y,b.y,k);pages.forEach((x,i)=>{const active=clock>i*1.3;x.p.scale.setScalar(active?1+.07*Math.sin(t*3+i):.5);x.p.material.emissiveIntensity=active?.45:.06;});links.forEach((x,i)=>x.visible=clock>(i+1)*1.5);if(clock>6.8&&phase!==1){phase=1;ctx.ui.hud(revert?'تاريخ التعديل جعل التصحيح ممكناً':'كل مساهمة غيّرت شبكة الصفحات');ctx.ui.done();}});
}

export function buildMobileOrbit(ctx){
 const {g,heading}=motionWorld(ctx,'المعرفة ترافق الطالب',0x243d4e),blue=m(0x7ad0df,.35),gold=m(0xecc778,.35),green=m(0x91d6a9,.3),purple=m(0xb9a5e6,.3);
 const phone=box(.12,.23,.025,m(0x1a2a43,.3));phone.position.set(0,.2,0);g.add(phone);const screen=box(.095,.18,.005,blue);screen.position.set(0,.2,.016);g.add(screen);
 const orbit=new THREE.Mesh(new THREE.TorusGeometry(.23,.004,8,80),m(0xa3cddd,.25));orbit.rotation.x=Math.PI/2.5;orbit.position.y=.21;g.add(orbit);
 const places=[['البيت',gold],['الجامعة',green],['الطريق',purple]].map(([name,mat],i)=>{const b=ball(.034,mat);g.add(b);const l=text(name,.12);g.add(l);return {b,l};});
 const rays=places.map(()=>{const x=line([0,.2,.02],[.2,.2,.02],0x83d3df);g.add(x);return x;});const book=box(.047,.065,.006,gold);book.position.set(0,.19,.026);g.add(book);
 let clock=0,phase=-1;
 function reset(){clock=0;phase=-1;ctx.ui.hud('مورد واحد يتحرك مع الطالب بين ثلاثة أماكن');ctx.ui.caption('التعلم يرافقك');ctx.ui.choices([{label:'↻ أعد رحلة المورد',onPick:reset}]);}
 reset();ctx.tap(phone,reset);
 return updateWorld(g,heading,(t,dt)=>{clock+=dt;if(clock>9)clock=0;phone.rotation.y=Math.sin(t*.8)*.18;screen.material.emissiveIntensity=.25+.2*Math.sin(t*3)**2;orbit.rotation.z=t*.2;places.forEach((x,i)=>{const a=t*.25+i*Math.PI*2/3,xpos=Math.cos(a)*.24,z=Math.sin(a)*.13;x.b.position.set(xpos,.2+Math.sin(t*2+i)*.012,z);x.l.position.set(xpos,.28,z);const active=clock>i*2+1;x.b.material.emissiveIntensity=active?.7:.08;x.b.scale.setScalar(active?1.2:1);rays[i].visible=active;rays[i].rotation.y=-Math.atan2(z,xpos);rays[i].scale.x=Math.hypot(xpos,z)/.2;});book.position.x=Math.sin(clock*1.05)*.07;book.rotation.z=Math.sin(t*2)*.18;const next=clock<2?0:clock<4?1:clock<6?2:3;if(next!==phase){phase=next;ctx.ui.hud(['المورد يفتح في البيت','التعلم يستمر في الجامعة','المحتوى يرافق الطريق','ثلاثة سياقات، جهاز واحد'][next]);if(next===3)ctx.ui.done();}});
}
