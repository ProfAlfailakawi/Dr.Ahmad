// Interactive worlds for pages 111, 186, 274, 297 and 370.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';
const mat=(c,e=.1)=>new THREE.MeshStandardMaterial({color:c,roughness:.35,metalness:.18,emissive:c,emissiveIntensity:e});
const block=(w,h,d,m)=>shadowed(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.012,w/6,h/6,d/3)),m));
const tag=(s,w=.2,c='#fff8e9')=>sprite(s,w,{size:46,width:560,weight:800,color:c,bg:'rgba(21,29,44,.92)'});
const scaleTag=(s,w,k)=>s.scale.set(Math.max(.001,w*k),Math.max(.001,w*s.userData.aspect*k),1);
const sphere=(r,m)=>new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);
function base(ctx,heading,color=0x23384c){const g=new THREE.Group();g.position.copy(P(.5,.52));ctx.stage.add(g);const floor=block(.65,.012,.36,mat(color));floor.position.y=.01;g.add(floor);const name=tag(heading,.35);name.position.set(0,.4,-.13);g.add(name);return {g,name};}
function progress(ctx,tagText,title,body,color){ctx.ui.card({tag:tagText,title,body,color});}

export function buildAccessibleWorld(ctx){
 const {g,name}=base(ctx,'العالم الذي يتبدّل',0x253448); const cyan=mat(0x6ccee0,.2),green=mat(0x87d195,.18),red=mat(0xe87585,.2),gold=mat(0xe9bd6c,.15);
 const room=block(.48,.018,.24,mat(0x41556a));room.position.set(0,.07,0);g.add(room);
 const board=block(.25,.17,.012,cyan);board.position.set(0,.19,-.11);g.add(board);
 const students=[-.17,0,.17].map((x,i)=>{const desk=block(.09,.055,.07,i===1?gold:cyan);desk.position.set(x,.11,.08);g.add(desk);const head=sphere(.027,i===1?red:green);head.position.set(x,.19,.08);g.add(head);return {desk,head};});
 const beams=[-.16,0,.16].map((x,i)=>{const b=block(.06,.08,.012,i===1?red:green);b.position.set(x,.29,-.09);g.add(b);return b;});
 const labels=['بصري','سمعي','حركي'];let mode=-1,adapted=false,now=0;
 function choose(i){mode=i;adapted=false;ctx.sfx.tap();ctx.ui.hud(`حاجز ${labels[i]} أمام المتعلم`);board.material=red;students[1].head.material=red;
  progress(ctx,'تحدي الدمج',`الوصول إلى الدرس: ${labels[i]}`,['المعلومة على اللوح لا تصل لكل طالب بالطريقة نفسها. أضف وصفاً صوتياً أو نصاً قابلاً للقراءة.','شرح صوتي وحده لا يكفي. أضف نصاً واضحاً وتنبيهات مرئية.','الأدوات بعيدة عن متناول الطالب. أضف وسيلة تحكم بديلة ومساراً ميسراً.'][i],0xe87585);
  ctx.ui.choices([{label:['أضف وصفاً ونصاً','أضف نصاً وتنبيهات','أضف تحكماً بديلاً'][i],primary:true,onPick:adapt},{label:'جرّب حاجزاً آخر',onPick:reset}]);}
 function adapt(){adapted=true;board.material=green;students[1].head.material=green;ctx.sfx.good();ctx.ui.hud('أصبح الدرس قابلاً للوصول بوسيلة مساندة');progress(ctx,'التكنولوجيا المساندة','عاد الطالب إلى النشاط','توضح صفحة الكتاب أن التقنية المساندة تفتح قنوات المشاركة والتواصل، وأن تكييف الطريقة يتبع حاجة المتعلم الفردية.',0x87d195);ctx.ui.done();ctx.ui.choices([{label:'↻ جرّب حاجزاً آخر',onPick:reset}]);}
 function reset(){mode=-1;adapted=false;board.material=cyan;students[1].head.material=gold;ctx.ui.hideCard();ctx.ui.hud('اختر حاجزاً لتعيد تصميم طريق التعلم');ctx.ui.choices(labels.map((x,i)=>({label:x,primary:i===0,onPick:()=>choose(i)})));}
 reset();beams.forEach((b,i)=>ctx.tap(b,()=>choose(i)));
 return {update(t,dt,e){now=t;const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));beams.forEach((b,i)=>{b.position.y=.29+Math.sin(t*2+i)*.008;b.material.emissiveIntensity=mode===i?.55:.14;});students[1].head.position.y=.19+(adapted?.02:0)+Math.sin(t*3)*.004;scaleTag(name,.35,k);}};
}

export function buildArcsReactor(ctx){
 const {g,name}=base(ctx,'مفاعل الدافعية',0x302b50), colors=[0xe9b95a,0x5ecbd2,0x84d18b,0xe889b4], labels=['الانتباه','الصلة','الثقة','الرضا'];
 const core=sphere(.07,mat(0xb6a5df,.2));core.position.set(0,.22,0);g.add(core);
 const rings=labels.map((x,i)=>{const angle=i*Math.PI/2;const node=sphere(.038,mat(colors[i],.15));node.position.set(Math.cos(angle)*.19,.2+Math.sin(angle)*.12,0);g.add(node);const lbl=tag(x,.13);lbl.position.copy(node.position).add(new THREE.Vector3(0,.065,.01));g.add(lbl);return {node,lbl};});
 let level=0,seen=new Set();function set(i){seen.add(i);level=seen.size;ctx.sfx.good();core.material.emissiveIntensity=.2+level*.2;ctx.ui.hud(`${labels[i]} يشحن المفاعل · ${level} من ٤`);progress(ctx,'نموذج كيلر ARCS',labels[i],["حدث مفاجئ أو سؤال يوقظ الفضول.","اربط المهمة بما يعنيه المحتوى للمتعلم.","اجعل النجاح ممكناً بخطوات واضحة وتغذية راجعة.","أظهر أثر الإنجاز ليشعر المتعلم بقيمة ما حققه."][i],colors[i]);next();}
 function next(){if(seen.size===4){ctx.ui.hud('الدافعية تستمر عندما تتوازن العناصر الأربعة');progress(ctx,'اكتمل المفاعل','طاقة قابلة للاستمرار','تضع الصفحة الانتباه والصلة والثقة والرضا في قلب التصميم التحفيزي؛ عنصر واحد لا يكفي للمحافظة على الدافعية.',0x84d18b);ctx.ui.done();ctx.ui.choices([{label:'↻ أعد شحن المفاعل',onPick:reset}]);return;}ctx.ui.choices(labels.map((x,i)=>({label:x,primary:i===seen.size,onPick:()=>set(i)})).filter((x,i)=>!seen.has(labels.indexOf(x.label))));}
 function reset(){seen=new Set();level=0;core.material.emissiveIntensity=.2;ctx.ui.hideCard();ctx.ui.hud('اشحن عناصر الدافعية الأربعة');next();}reset();rings.forEach((r,i)=>ctx.tap(r.node,()=>set(i)));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));core.scale.setScalar(1+level*.15+Math.sin(t*3)*.04);rings.forEach((r,i)=>{r.node.material.emissiveIntensity=seen.has(i)?.55:.12;r.node.position.z=Math.sin(t*2+i)*.015;scaleTag(r.lbl,.13,k);});scaleTag(name,.35,k);}};
}

export function buildSearchDetective(ctx){
 const {g,name}=base(ctx,'محقّق البحث',0x19354b),cyan=mat(0x54c5d6,.2),gold=mat(0xe9bf67,.2),pink=mat(0xe080a2,.18);
 const lens=new THREE.Mesh(new THREE.TorusGeometry(.075,.009,8,32),gold);lens.position.set(-.19,.18,.04);g.add(lens);const handle=block(.013,.1,.013,gold);handle.position.set(-.12,.1,.04);handle.rotation.z=-.6;g.add(handle);
 const cards=[-.08,.09,.24].map((x,i)=>{const c=block(.12,.14,.012,i===1?gold:cyan);c.position.set(x,.16,-.02+i*.025);g.add(c);const l=tag(['ضجيج','فهرس','مصدر'][i],.1);l.position.set(x,.25,.01+i*.025);g.add(l);return {c,l};});let step=0;
 function start(){step=1;ctx.ui.hud('النتائج الكثيرة لا تعني إجابة دقيقة');progress(ctx,'استراتيجيات البحث','تخمة معلومات','تبدأ الصفحة بمشكلة كثرة الصفحات والنتائج؛ المفتاح هو صياغة كلمات محددة قبل فحص المصدر.',0xe9bf67);ctx.ui.choices([{label:'ابحث بكلمة عامة',onPick:noisy},{label:'حدد كلمتين مفتاحيتين',primary:true,onPick:focus}]);}
 function noisy(){step=2;ctx.ui.hud('نتائج كثيرة ومشتتة');progress(ctx,'محرك البحث','أعد صياغة السؤال','الكلمة العامة تفتح نتائج واسعة. ضيّق الاستعلام حتى يستطيع الفهرس تقريب الوثائق المرتبطة بسؤالك.',0xe080a2);ctx.ui.choices([{label:'أضف كلمة دقيقة',primary:true,onPick:focus}]);}
 function focus(){step=3;ctx.sfx.good();ctx.ui.hud('الفهرس قرّب النتائج المرتبطة');progress(ctx,'العنكبوت والفهرس','وصلت إلى نتائج أقرب','تشرح الصفحة أن العناكب تجمع الصفحات، والفهرس ينظمها، ثم تعرض قاعدة المحرك ما يطابق الكلمات المفتاحية.',0x54c5d6);ctx.ui.choices([{label:'افحص المصدر',primary:true,onPick:done}]);}
 function done(){step=4;ctx.ui.done();ctx.ui.hud('الجواب ليس في أول نتيجة دائماً');progress(ctx,'قضية مكتملة','من السؤال إلى الدليل','حددت الكلمات، ثم فحصت مصدر النتيجة. هكذا يتحول البحث من جمع روابط إلى قرار مبني على دليل.',0x84d18b);ctx.ui.choices([{label:'↻ قضية جديدة',onPick:reset}]);}
 function reset(){step=0;ctx.ui.hideCard();ctx.ui.hud('معلومة ضائعة في بحر الصفحات');ctx.ui.choices([{label:'✦ ابدأ التحقيق',primary:true,onPick:start}]);}reset();cards.forEach((v,i)=>ctx.tap(v.c,()=>step<3?focus():done()));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));lens.rotation.z=Math.sin(t*2)*.12;cards.forEach((v,i)=>{v.c.position.y=.16+Math.sin(t*2+i)*.01;v.c.material.emissiveIntensity=step>=3&&i===1?.55:.15;scaleTag(v.l,.1,k);});scaleTag(name,.35,k);}};
}

export function buildComputerElevator(ctx){
 const {g,name}=base(ctx,'مصعد أجيال الحاسوب',0x283244),shell=mat(0x8898af,.1),screen=mat(0x5cc9d3,.28),gold=mat(0xefc46b,.2);
 const lift=block(.25,.29,.18,shell);lift.position.set(0,.17,0);g.add(lift);const monitor=block(.17,.12,.011,screen);monitor.position.set(0,.22,.098);g.add(monitor);const keys=Array.from({length:5},(_,i)=>{const b=block(.04,.012,.012,gold);b.position.set(-.095+i*.047,.12,.098);g.add(b);return b;});const nums=['الجيل الأول','الجيل الثاني','الجيل الثالث','الجيل الرابع','الجيل الخامس'].map((s)=>{const n=tag(s,.24);n.position.set(0,.35,.05);g.add(n);return n;});
 const stages=[['الجيل الأول','أجهزة كبيرة الحجم وبطيئة في معالجة المعلومات.'],['الجيل الثاني','تقلص الحجم مع تطور المكونات الإلكترونية.'],['الجيل الثالث','تسارعت المعالجة وازدادت إمكانات التشغيل.'],['الجيل الرابع','أصبحت الحواسيب أصغر وأوسع انتشاراً.'],['الجيل الخامس','توسعت قدرات الحاسب وتطبيقاته الذكية.']];let index=-1;
 function show(i){index=i;ctx.sfx.good();ctx.ui.hud(`المصعد عند ${stages[i][0]}`);progress(ctx,'أجيال الحاسوب',stages[i][0],stages[i][1]+' تصنف الصفحة أجيال الحاسب إلى خمسة.',0x5cc9d3);ctx.ui.choices(i<4?[{label:'اصعد إلى الجيل التالي',primary:true,onPick:()=>show(i+1)}]:[{label:'↻ عد إلى البداية',onPick:reset}]);if(i===4)ctx.ui.done();}
 function reset(){index=-1;ctx.ui.hideCard();ctx.ui.hud('خمسة أجيال في مصعد واحد');ctx.ui.choices([{label:'✦ ادخل المصعد',primary:true,onPick:()=>show(0)}]);}reset();keys.forEach((b,i)=>ctx.tap(b,()=>show(i)));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));const compact=index<0?1:1-index*.1;lift.scale.set(compact,1,compact);monitor.material.emissiveIntensity=.25+Math.sin(t*3)*.12;keys.forEach((b,i)=>b.material.emissiveIntensity=index===i?.7:.15);nums.forEach((n,i)=>{n.visible=i===Math.max(0,index);scaleTag(n,.24,k);});scaleTag(name,.35,k);}};
}

export function buildFlippedClass(ctx){
 const {g,name}=base(ctx,'الفصل المقلوب',0x253a4c),blue=mat(0x5bc8d6,.2),gold=mat(0xeebf68,.2),green=mat(0x81d19a,.2);
 const left=block(.24,.16,.18,blue),right=block(.24,.16,.18,gold);left.position.set(-.16,.13,0);right.position.set(.16,.13,0);g.add(left,right);
 const house=tag('البيت',.13),classroom=tag('الصف',.13);house.position.set(-.16,.27,.02);classroom.position.set(.16,.27,.02);g.add(house,classroom);
 const arrow=new THREE.Mesh(new THREE.TorusGeometry(.06,.006,8,32),green);arrow.rotation.x=Math.PI/2;arrow.position.set(0,.24,.03);g.add(arrow);let phase=0;
 function flip(){phase=1;ctx.sfx.good();ctx.ui.hud('الشرح في البيت، والتطبيق داخل الصف');progress(ctx,'الفصول المقلوبة','تغير مكان كل نشاط','تشرح صفحات الفصل المقلوب أن الطالب يطالع المحتوى قبل الحصة، ويستثمر وقت الصف في العمل والتفاعل.',0x5bc8d6);ctx.ui.choices([{label:'اجعل الصف للنقاش',onPick:()=>activity('نقاش')},{label:'اجعل الصف للتطبيق',primary:true,onPick:()=>activity('تطبيق')}]);}
 function activity(x){phase=2;ctx.ui.hud(`وقت الصف صار ${x==='نقاش'?'حواراً':'تطبيقاً'}`);progress(ctx,'استثمار وقت الحصة',`الصف: ${x}`,'المحتوى يصل قبل اللقاء، فيتحرر وقت الحصة للأسئلة والعمل ومساعدة من يحتاج دعماً.',0x81d19a);ctx.ui.done();ctx.ui.choices([{label:'↻ اقلب الفصل مجدداً',onPick:reset}]);}
 function reset(){phase=0;ctx.ui.hideCard();ctx.ui.hud('اقلب ترتيب الشرح والنشاط');ctx.ui.choices([{label:'✦ اقلب الفصل',primary:true,onPick:flip}]);}reset();ctx.tap(arrow,flip);
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));arrow.rotation.z=t*(phase?1:.35);left.position.y=.13+Math.sin(t*2)*.006;right.position.y=.13+Math.sin(t*2+1)*.006;right.material=phase?green:gold;scaleTag(house,.13,k);scaleTag(classroom,.13,k);scaleTag(name,.35,k);}};
}
