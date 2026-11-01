// Ten new page-bound university experiences, part one.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';

export const m=(c,e=.13)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:e,roughness:.4,metalness:.14});
export const box=(w,h,d,mat)=>shadowed(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.012,w/6,h/6,d/3)),mat));
export const ball=(r,mat)=>shadowed(new THREE.Mesh(new THREE.SphereGeometry(r,20,14),mat));
export const text=(s,w=.18)=>sprite(s,w,{size:46,width:560,weight:800,color:'#fff9eb',bg:'rgba(18,29,45,.93)'});
export const line=(a,b,c)=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a),new THREE.Vector3(...b)),2,.004,6,false),m(c,.35));
export function world(ctx,title,color=0x23364d){const g=new THREE.Group();g.position.copy(P(.5,.52));ctx.stage.add(g);const floor=box(.7,.018,.4,m(color));floor.position.y=.02;g.add(floor);const heading=text(title,.37);heading.position.set(0,.47,-.14);heading.visible=false;g.add(heading);return {g,heading};}
export function updateWorld(g,heading,fn){return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));heading.scale.set(Math.max(.001,.37*k),Math.max(.001,.37*heading.userData.aspect*k),1);fn?.(t,dt,e);}};}
export function card(ctx,tag,title,body,color=0xd4ad55){ctx.ui.card({tag,title,body,color});}

export function buildProgrammedCorridor(ctx){
 const {g,heading}=world(ctx,'الممر الذي يكتب نفسه',0x253654),cyan=m(0x62cddc,.25),gold=m(0xe9c36e,.25),red=m(0xe78383,.2);
 const path=[0,1,2].map((i)=>{const p=box(.17,.014,.28,cyan);p.position.set((i-1)*.19,.05,.04);g.add(p);return p;});
 const gates=[-1,1].map((side)=>{const b=box(.19,.19,.025,side<0?cyan:gold);b.position.set(side*.19,.19,-.1);g.add(b);const label=text('',.17);label.position.set(side*.19,.31,-.07);g.add(label);return {b,label,side};});
 const learner=ball(.025,gold);learner.position.set(0,.1,.16);g.add(learner);
 const frames=[
  {q:'طالب أخطأ في مفهوم أساسي. إلى أين تقوده؟',options:['إلى شرح قصير ثم محاولة جديدة','إلى اختبار أصعب فوراً'],right:0,why:'التعليم المبرمج يرتب الخبرة ويتيح كشف الخطأ وتصحيحه.'},
  {q:'أتقن الخطوة الأولى. كيف يتقدم؟',options:['إلى إطار تالٍ بتغذية راجعة','إلى نهاية المقرر بلا فحص'],right:0,why:'الانتقال المتدرج مع الاستجابة يتيح تعلماً ذاتياً منظماً.'},
  {q:'أعاد الإجابة ولم ينجح. ماذا يتغير؟',options:['أعيد الشرح بصورة أوضح','أكرر السؤال نفسه بلا تفسير'],right:0,why:'الخطأ يوجّه مساراً علاجياً بدل ترك المتعلم عالقاً.'},
 ];let step=-1,route=0,move=0;
 function show(){const f=frames[step],swap=Math.random()<.5;gates.forEach((x,i)=>{g.remove(x.label);const choice=swap?1-i:i;x.label=text(f.options[choice],.18);x.label.position.set(x.side*.19,.32,-.07);g.add(x.label);x.choice=choice;ctx.tap(x.label,()=>choose(x));});ctx.ui.hud(`الإطار ${step+1} من ٣ · المس أحد البابين`);ctx.ui.caption(f.q);ctx.ui.hideCard();}
 function choose(x){if(step<0||move>0)return;const f=frames[step],ok=x.choice===f.right;route=x.side;move=1;ctx.sfx[ok?'good':'bad']();ctx.fx.burst(g.position.clone().add(x.b.position),ok?0x75d4a3:0xe78383,20,.25,.02);card(ctx,ok?'مسار تقدّم':'مسار تصحيح',ok?'فتح الإطار التالي':'عاد الممر لشرح الفكرة',f.why,ok?0x75d4a3:0xe78383);path[step].material=ok?gold:red;ctx.ui.choices([{label:step===2?'شاهد نتيجة الممر':'تابع في الممر',primary:true,onPick:()=>{move=0;if(step===2){ctx.ui.done();ctx.ui.hud('اكتمل مسار التعلم الذاتي');ctx.ui.choices([{label:'↻ ابدأ من جديد',onPick:reset}]);}else{step++;show();}}}]);}
 function reset(){step=-1;route=0;move=0;learner.position.set(0,.1,.16);path.forEach(p=>p.material=cyan);ctx.ui.hideCard();ctx.ui.hud('المس الباب المناسب ليتغير الممر');ctx.ui.caption('رتّب استجابات الطالب، وشاهد كيف يقوده الخطأ إلى تصحيح');ctx.ui.choices([{label:'✦ ادخل الممر',primary:true,onPick:()=>{step=0;show();ctx.ui.choices([]);}}]);}reset();gates.forEach(x=>ctx.tap(x.b,()=>choose(x)));
 return updateWorld(g,heading,(t,dt)=>{if(move>0){learner.position.x=THREE.MathUtils.damp(learner.position.x,route*.19,5,dt);learner.position.z=THREE.MathUtils.damp(learner.position.z,-.08,5,dt);}else learner.position.y=.1+Math.sin(t*2)*.008;gates.forEach((x,i)=>x.b.rotation.y=Math.sin(t*1.8+i)*.09);});
}

export function buildDesignMachine(ctx){
 const {g,heading}=world(ctx,'آلة بناء المقرر',0x26364b),colors=[0x72cbd5,0xe9c16f,0x9d8cda,0x83cf9c,0xe78b8f];
 const names=['تحليل','تصميم','تطوير','تنفيذ','تقويم'];const tiles=names.map((name,i)=>{const b=box(.105,.08,.065,m(colors[i],.3));b.position.set((i-2)*.125,.13,.12);g.add(b);const label=text(name,.105);label.position.set((i-2)*.125,.23,.12);g.add(label);ctx.tap(b,()=>place(i));ctx.tap(label,()=>place(i));return {b,label};});
 const tower=[0,1,2,3,4].map(i=>{const p=box(.32,.042,.19,m(0x42546b));p.position.set(0,.08+i*.052,-.1);g.add(p);return p;});const loop=new THREE.Mesh(new THREE.TorusGeometry(.2,.006,8,48),m(0xe9c16f,.35));loop.rotation.x=Math.PI/2;loop.position.set(0,.36,-.1);g.add(loop);let count=0,revise=false;
 function place(i){if(count===5)return;if(i!==count){ctx.sfx.bad();ctx.ui.toast(`تحتاج ${names[count]} قبل ${names[i]}`);tiles[i].b.rotation.z=.22;return;}ctx.sfx.good();tower[count].material=tiles[i].b.material;tiles[i].b.position.y=.3;ctx.fx.burst(g.position.clone().add(tower[count].position),colors[i],16,.2,.017);count++;ctx.ui.hud(`بنيت ${count} من ٥ مراحل`);ctx.ui.caption(count<5?`المرحلة التالية: ${names[count]}`:'المقرر قائم؛ جرّب التغذية الراجعة');if(count===5){card(ctx,'تصميم تعليمي','المراحل لا تنتهي عند الترتيب','تؤكد صفحة ١٦٤ أن التقويم التكويني قد يعيد المصمم إلى مرحلة سابقة لتعديلها.',0x83cf9c);ctx.ui.choices([{label:'↶ أعد التحليل بعد التقويم',primary:true,onPick:()=>{revise=true;count=1;tower.slice(1).forEach(p=>p.material=m(0x42546b));tiles.slice(1).forEach((x,j)=>x.b.position.y=.13);ctx.ui.hideCard();ctx.ui.hud('رجعت إلى التحليل لتعديل المقرر');ctx.ui.caption('العودة إلى مرحلة سابقة جزء من التصميم الجيد');ctx.ui.done();ctx.ui.choices([{label:'↻ ابن مقرراً جديداً',onPick:reset}]);}}]);}}
 function reset(){count=0;revise=false;tiles.forEach((x,i)=>{x.b.position.y=.13;x.b.rotation.z=0;});tower.forEach(p=>p.material=m(0x42546b));ctx.ui.hideCard();ctx.ui.hud('المس المراحل بالترتيب لتبني المقرر');ctx.ui.caption('تحليل ← تصميم ← تطوير ← تنفيذ ← تقويم');ctx.ui.choices([]);}reset();
 return updateWorld(g,heading,(t)=>{loop.rotation.z=t*.25;loop.material.emissiveIntensity=revise?.6:.2;});
}

export function buildEvidenceLab(ctx){
 const {g,heading}=world(ctx,'مختبر كشف الوهم',0x28334e),gold=m(0xecc375,.25),blue=m(0x6bcbd8,.25),red=m(0xe47e89,.25);
 const beam=box(.46,.016,.04,gold);beam.position.set(0,.21,0);g.add(beam);const stem=box(.018,.18,.03,blue);stem.position.set(0,.12,0);g.add(stem);const pans=[-1,1].map((s,i)=>{const b=box(.13,.018,.09,i?blue:red);b.position.set(s*.18,.13,.04);g.add(b);const l=text(i?'الدليل':'الادعاء',.13);l.position.set(s*.18,.3,.03);g.add(l);return {b,l};});const weight=ball(.027,gold);weight.position.set(-.18,.16,.06);g.add(weight);let value=.5,stage=0;
 function set(v){value=v;weight.position.x=-.18+v*.36;beam.rotation.z=(v-.5)*.22;ctx.ui.hud(v<.4?'ادعاء أن لكل طالب نمطاً ثابتاً':v<.7?'اسأل: هل ثبت أثر المطابقة؟':'الدليل يقود القرار التعليمي');}
 function test(){stage=1;ctx.ui.hideSlider();set(.8);ctx.sfx.good();card(ctx,'صفحة ٢٣٠','اختبر الادعاء قبل تصنيف الطلبة','تعرض الصفحة انتقادات للأساس العلمي لنماذج أنماط التعلم، وتدعو إلى الحذر من تحويلها إلى وصفة ثابتة لكل طالب.',0x6bcbd8);ctx.ui.done();ctx.ui.choices([{label:'↻ جرّب الميزان ثانية',onPick:reset}]);}
 function reset(){stage=0;ctx.ui.hideCard();ctx.ui.hud('حرّك ثقل الميزان من الادعاء إلى الدليل');ctx.ui.caption('هل يكفي وصف الطالب بأنه «بصري» لتقرير طريقة تدريسه؟');ctx.ui.choices([{label:'افحص الحكم',primary:true,onPick:test}]);ctx.ui.slider({label:'وزن الدليل',value:.5,onInput:set});set(.5);}reset();ctx.tap(weight,()=>set(Math.min(1,value+.2)));
 return updateWorld(g,heading,(t)=>{weight.position.y=.16+Math.sin(t*2)*.006;pans.forEach((x,i)=>x.b.position.y=.13+(i?1:-1)*(value-.5)*.06);});
}

export function buildCloudCourse(ctx){
 const {g,heading}=world(ctx,'المقرر الذي يعيش في السحابة',0x183950),cloud=m(0x78d5e4,.35),green=m(0x85d4a0,.25),red=m(0xe7808a,.25),gold=m(0xf0c878,.3);
 const core=ball(.085,cloud);core.scale.set(1.4,.65,1);core.position.set(0,.34,-.08);g.add(core);const file=box(.075,.095,.012,gold);file.position.set(0,.34,-.01);g.add(file);const nodes=[-.2,0,.2].map((x,i)=>{const n=box(.1,.075,.04,i===2?red:green);n.position.set(x,.12,.1);g.add(n);const label=text(['محاضر','طالب','طالب بعيد'][i],.12);label.position.set(x,.22,.1);g.add(label);ctx.tap(n,()=>toggle(i));ctx.tap(label,()=>toggle(i));return {n,label,x,on:i!==2};});const links=nodes.map(x=>{const l=line([0,.29,-.06],[x.x,.17,.1],0x7ce0eb);g.add(l);return l;});let touches=0;
 function toggle(i){const x=nodes[i];x.on=!x.on;x.n.material=x.on?green:red;links[i].visible=x.on;touches++;ctx.sfx[x.on?'good':'bad']();ctx.ui.hud(`${nodes.filter(n=>n.on).length} من ٣ يستطيعون الوصول`);ctx.ui.caption(x.on?'عاد الاتصال بالمقرر المشترك':'انقطع وصول هذا الطرف إلى الملف');if(touches>=3){card(ctx,'الحوسبة السحابية','الاتصال والصلاحيات يحددان الوصول','توضح صفحة ٣٦٦ فكرة تقديم الموارد عبر الشبكة. سحابة المقرر مفيدة حين يستطيع المشاركون الوصول إليها، مع إدارة الاتصال والصلاحيات.',0x78d5e4);ctx.ui.done();ctx.ui.choices([{label:'↻ أعد تجربة الشبكة',onPick:reset}]);}}
 function reset(){touches=0;nodes.forEach((x,i)=>{x.on=i!==2;x.n.material=x.on?green:red;links[i].visible=x.on;});ctx.ui.hideCard();ctx.ui.hud('المس الأجهزة لتقطع الاتصال أو تعيده');ctx.ui.caption('الملف واحد، لكن الوصول إليه ليس مضموناً للجميع');ctx.ui.choices([]);}reset();
 return updateWorld(g,heading,t=>{core.position.y=.34+Math.sin(t*2)*.012;file.rotation.y=t*.25;links.forEach((x,i)=>x.material.emissiveIntensity=nodes[i].on?.4+.1*Math.sin(t*5+i):0);});
}

export function buildBlendMixer(ctx){
 const {g,heading}=world(ctx,'مِزجتان، فصل واحد',0x294054),blue=m(0x69cddd,.25),gold=m(0xecc274,.25),red=m(0xe48486,.2);
 const halves=[-1,1].map((s,i)=>{const b=box(.25,.14,.2,i?blue:gold);b.position.set(s*.14,.13,0);g.add(b);const l=text(i?'إلكتروني':'حضوري',.18);l.position.set(s*.14,.28,0);g.add(l);return {b,l};});const students=[-.19,-.1,.1,.19].map(x=>{const p=ball(.018,blue);p.position.set(x,.25,.07);g.add(p);return p;});const bridge=box(.05,.025,.18,m(0x87d6a3,.3));bridge.position.set(0,.19,0);g.add(bridge);let blend=.5,validated=false;
 function set(v){blend=v;halves[0].b.scale.y=.55+(1-v)*.9;halves[1].b.scale.y=.55+v*.9;bridge.material.emissiveIntensity=1-Math.abs(v-.5)*1.5;ctx.ui.hud(`حضوري ${Math.round((1-v)*100)}٪ · إلكتروني ${Math.round(v*100)}٪`);}
 function assess(){validated=true;const ok=blend>.25&&blend<.75;ctx.sfx[ok?'good':'bad']();card(ctx,'التعليم المخلوط',ok?'تتعاون القاعتان':'أحد المسارين ابتلع الآخر',ok?'المزج هنا يوظف الحضور والمواد الإلكترونية معاً؛ تؤكد صفحة ٣٧٣ أهمية تكامل المادة وإدارة المصادر بذكاء.':'عدّل القرص حتى يكون لكل من الحضور والمواد الإلكترونية دور واضح في النشاط.',ok?0x87d6a3:0xe48486);if(ok)ctx.ui.done();ctx.ui.choices([{label:ok?'↻ جرّب مزيجاً آخر':'عدّل المزيج',onPick:()=>{ctx.ui.hideCard();ctx.ui.choices([{label:'اختبر الفصل',primary:true,onPick:assess}]);}}]);}
 function reset(){validated=false;ctx.ui.hideCard();ctx.ui.caption('وازن بين نقاش القاعة والمادة الإلكترونية');ctx.ui.choices([{label:'اختبر الفصل',primary:true,onPick:assess}]);ctx.ui.slider({label:'نسبة التعلم الإلكتروني',value:.5,onInput:set});set(.5);}reset();ctx.tap(halves[0].b,()=>{set(Math.max(0,blend-.1));});ctx.tap(halves[1].b,()=>{set(Math.min(1,blend+.1));});
 return updateWorld(g,heading,(t)=>{students.forEach((x,i)=>{x.position.y=.25+Math.sin(t*2+i)*.009;x.material=blend>.5?blue:gold;});bridge.rotation.z=Math.sin(t*2)*.06;});
}
