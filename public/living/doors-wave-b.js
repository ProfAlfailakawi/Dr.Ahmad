// Interactive worlds for pages 392, 406, 464, 510 and 628.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';
const mat=(c,e=.1,transparent=false)=>new THREE.MeshStandardMaterial({color:c,roughness:.3,metalness:.22,emissive:c,emissiveIntensity:e,transparent,opacity:transparent?.42:1,side:THREE.DoubleSide});
const block=(w,h,d,m)=>shadowed(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.012,w/6,h/6,d/3)),m));
const tag=(s,w=.2,c='#fff8e9')=>sprite(s,w,{size:46,width:560,weight:800,color:c,bg:'rgba(21,29,44,.92)'});
const scaleTag=(s,w,k)=>s.scale.set(Math.max(.001,w*k),Math.max(.001,w*s.userData.aspect*k),1);
const sphere=(r,m)=>new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);
const line=(a,b,c)=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...a),new THREE.Vector3(...b)),2,.003,6,false),new THREE.MeshBasicMaterial({color:c}));
function base(ctx,heading,color=0x23384c){const g=new THREE.Group();g.position.copy(P(.5,.52));ctx.stage.add(g);const floor=block(.65,.012,.36,mat(color));floor.position.y=.01;g.add(floor);const name=tag(heading,.35);name.position.set(0,.4,-.13);g.add(name);return {g,name};}
const card=(ctx,tagText,title,body,color)=>ctx.ui.card({tag:tagText,title,body,color});

export function buildHologramLab(ctx){
 const {g,name}=base(ctx,'هولوجرام فوق الورقة',0x18283e),blue=mat(0x60d7e9,.35,true),gold=mat(0xf5c46f,.3),pink=mat(0xe77db8,.3);
 const source=sphere(.035,gold);source.position.set(-.23,.09,.04);g.add(source);
 const screen=block(.27,.22,.006,blue);screen.position.set(.05,.15,0);screen.rotation.y=.32;g.add(screen);
 const figure=new THREE.Mesh(new THREE.IcosahedronGeometry(.09,1),mat(0x76dced,.25,true));figure.position.set(.05,.25,.04);g.add(figure);
 const beam=line([-.23,.09,.04],[.05,.22,.04],0xf7d385);g.add(beam);const halo=new THREE.Mesh(new THREE.TorusGeometry(.12,.003,8,40),pink);halo.position.set(.05,.25,.04);g.add(halo);let phase=0;
 function begin(){phase=1;ctx.ui.hud('ضوء وصورة مجسمة ظاهرياً');card(ctx,'الهولوجرام','الصورة تبدو طافية','تصف الصفحة التصوير التجسيدي وتسجيل الضوء المشتت من الجسم. هذا نموذج بصري مبسط للفكرة.',0x60d7e9);ctx.ui.choices([{label:'افصل طبقات الضوء',primary:true,onPick:split}]);}
 function split(){phase=2;ctx.ui.hud('كل طبقة تؤدي دوراً في المشهد');card(ctx,'افصل الطبقات','من المصدر إلى الصورة','حرّك بصرك بين المصدر وسطح العرض والصورة. ليست هذه صورة هولوجرام حقيقية بالليزر؛ إنها محاكاة تعليمية لتفسير الفكرة.',0xf5c46f);ctx.ui.choices([{label:'أعد تركيب المشهد',primary:true,onPick:done}]);}
 function done(){phase=3;ctx.ui.done();ctx.ui.hud('عاد المجسم فوق الصفحة');card(ctx,'من صفحة ٣٩٢','الفكرة صارت مرئية','الضوء المسجل والمنظور يخلقان الإحساس بالصورة ذات الأبعاد الثلاثة كما يشرح الكتاب.',0xe77db8);ctx.ui.choices([{label:'↻ جرّب مرة أخرى',onPick:reset}]);}
 function reset(){phase=0;ctx.ui.hideCard();ctx.ui.hud('هل تستطيع تفكيك صورة تبدو طافية؟');ctx.ui.choices([{label:'✦ أشعل الهولوجرام',primary:true,onPick:begin}]);}reset();ctx.tap(figure,begin);
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));figure.rotation.y=t*.45;figure.rotation.x=t*.2;figure.position.y=.25+Math.sin(t*2)*.015;figure.position.x=phase===2?.15:.05;screen.position.x=phase===2?-.05:.05;source.position.x=phase===2?-.27:-.23;beam.visible=phase>0;halo.visible=phase>0;halo.rotation.z=t*.35;scaleTag(name,.35,k);}};
}

export function buildArMirror(ctx){
 const {g,name}=base(ctx,'الصفحة التي تشرح سحرها',0x1f3048),blue=mat(0x63cbe2,.2),gold=mat(0xe9bd69,.2),green=mat(0x85d4a1,.2);
 const paper=block(.28,.025,.3,mat(0xf3e9d4));paper.position.set(0,.07,0);g.add(paper);
 const camera=block(.12,.075,.055,blue);camera.position.set(-.23,.22,.13);camera.rotation.y=-.35;g.add(camera);
 const lens=sphere(.025,gold);lens.position.set(-.17,.22,.162);g.add(lens);
 const corners=[[-.12,-.1],[.12,-.1],[-.12,.1],[.12,.1]].map(([x,z])=>{const c=block(.025,.013,.025,gold);c.position.set(x,.095,z);g.add(c);return c;});
 const axis=new THREE.AxesHelper(.15);axis.position.set(0,.11,0);g.add(axis);
 const object=new THREE.Mesh(new THREE.OctahedronGeometry(.075),green);object.position.set(0,.22,0);g.add(object);
 const rays=[line([-.17,.22,.16],[-.12,.09,.1],0x6de6ed),line([-.17,.22,.16],[.12,.09,-.1],0x6de6ed)];rays.forEach(x=>g.add(x));let phase=0;
 const steps=[['عين الكاميرا','الكاميرا ترى صورة الصفحة المطبوعة.'],['تعرّف الصفحة','تبحث الخوارزمية عن تفاصيل بصرية مميزة كي تعرف أي صفحة أمامها.'],['موضع الورقة','تقدر زاوية الصفحة وحركتها لتثبت الأجسام في موضعها.'],['طبقة المعنى','يضاف مجسم تفاعلي فوق الصورة الحية ويتحرك معها.']];
 function show(i){phase=i+1;ctx.sfx.good();ctx.ui.hud(steps[i][0]);card(ctx,'كيف يعمل الواقع المعزز',steps[i][0],steps[i][1],i===3?0x85d4a1:0x63cbe2);ctx.ui.choices(i<3?[{label:'اكشف الطبقة التالية',primary:true,onPick:()=>show(i+1)}]:[{label:'↻ اكشف السحر من البداية',onPick:reset}]);if(i===3)ctx.ui.done();}
 function reset(){phase=0;ctx.ui.hideCard();ctx.ui.hud('افصل الكاميرا والتعرف والتثبيت والمجسم');ctx.ui.choices([{label:'✦ اكشف الطبقة الأولى',primary:true,onPick:()=>show(0)}]);}reset();ctx.tap(object,()=>show(Math.min(3,phase)));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));camera.visible=phase>=1;rays.forEach(x=>x.visible=phase>=1);corners.forEach(x=>x.visible=phase>=2);axis.visible=phase>=3;object.visible=phase>=4;object.rotation.y=t*.8;object.position.y=.22+Math.sin(t*2)*.013;scaleTag(name,.35,k);}};
}

export function buildMediaOrchestra(ctx){
 const {g,name}=base(ctx,'أوركسترا الوسائط',0x2b2945),colors=[0xe8bc65,0x6bcbd8,0xe68caa,0x91d197],labels=['نص','صوت','صورة','حركة'];
 const podium=block(.46,.035,.18,mat(0x384257));podium.position.set(0,.07,0);g.add(podium);
 const instruments=labels.map((s,i)=>{const x=-.18+i*.12;const body=block(.09,.08,.06,mat(colors[i],.18));body.position.set(x,.14,0);g.add(body);const orb=sphere(.018,mat(colors[i],.3));orb.position.set(x,.22,0);g.add(orb);const lbl=tag(s,.1);lbl.position.set(x,.29,0);g.add(lbl);return {body,orb,lbl};});
 const notes=Array.from({length:12},(_,i)=>{const n=sphere(.008,mat(colors[i%4],.3));g.add(n);return n;});let active=new Set(),overload=false;
 function toggle(i){active.has(i)?active.delete(i):active.add(i);ctx.sfx.good();ctx.ui.hud(`الوسائط النشطة: ${active.size} من ٤`);card(ctx,'عناصر الوسائط المتعددة',labels[i],`الصفحة تجمع الصوت والنص والصور والرسوم المتحركة. أنت تقرر أي العناصر تخدم الفكرة التعليمية معاً.`,colors[i]);choices();}
 function choices(){ctx.ui.choices([{label:overload?'خفف الازدحام':'أضف كل العناصر دفعة واحدة',onPick:()=>{overload=!overload;active=new Set(overload?[0,1,2,3]:[0,2]);ctx.ui.hud(overload?'المشهد مزدحم، اختر ما يخدم الهدف':'صار المعنى أوضح بعد الاختيار');card(ctx,'تصميم الوسائط',overload?'الازدحام يشتت الانتباه':'التكامل يخدم الفكرة',overload?'كثرة الوسائط لا تضمن وضوح الرسالة. قلل العناصر ثم راقبها.':'اجتمع النص والصورة في توقيت متناسق لتوضيح فكرة واحدة.',overload?0xe68caa:0x91d197);choices();}},{label:'اعتمد المزيج',primary:true,onPick:done}]);}
 function done(){ctx.ui.done();ctx.ui.hud('صممت مزيجك التعليمي');card(ctx,'أوركسترا مكتملة','كل وسيط له دور','الوسائط المتعددة في الصفحة تدمج النص والصوت والصور والحركة في عمل تعليمي واحد متكامل.',0x91d197);ctx.ui.choices([{label:'↻ أعد المزج',onPick:reset}]);}
 function reset(){active=new Set([0,2]);overload=false;ctx.ui.hideCard();ctx.ui.hud('المس آلة لتضيفها أو توقفها');choices();}reset();instruments.forEach((v,i)=>ctx.tap(v.body,()=>toggle(i)));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));instruments.forEach((v,i)=>{v.body.position.y=.14+(active.has(i)?.02:0)+Math.sin(t*3+i)*.005;v.body.material.emissiveIntensity=active.has(i)?.5:.08;v.orb.scale.setScalar(active.has(i)?1.4:.7);scaleTag(v.lbl,.1,k);});notes.forEach((n,i)=>{n.visible=active.has(i%4);n.position.set(-.2+(i%6)*.08,.2+((t*.12+i*.08)% .2),-.08+Math.floor(i/6)*.08);});scaleTag(name,.35,k);}};
}

export function buildBalloonNetwork(ctx){
 const {g,name}=base(ctx,'بالونات تحمل الإنترنت',0x1a3b54),cloud=mat(0x72d4e5,.2,true),yellow=mat(0xf0c86c,.15),green=mat(0x8ed1a1,.2),red=mat(0xd77983,.15);
 const land=block(.58,.015,.28,mat(0x3a675f));land.position.set(0,.035,0);g.add(land);
 const schools=[-.22,0,.22].map((x,i)=>{const b=block(.075,.075,.055,i===2?red:yellow);b.position.set(x,.09,.06);g.add(b);const lbl=tag(i===2?'مدرسة بعيدة':'محطة',.105);lbl.position.set(x,.19,.06);g.add(lbl);return {b,lbl};});
 const balloons=[-.18,0,.18].map((x,i)=>{const ball=sphere(.045,cloud);ball.position.set(x,.31,-.06);g.add(ball);const basket=block(.025,.02,.02,yellow);basket.position.set(x,.24,-.06);g.add(basket);const tether=line([x,.24,-.06],[x,.28,-.06],0xe7e8d4);g.add(tether);return {ball,basket,tether,x};});
 const paths=[line([-.22,.18,.06],[-.18,.28,-.06],0x89e4ef),line([-.18,.31,-.06],[0,.31,-.06],0x89e4ef),line([0,.31,-.06],[.18,.31,-.06],0x89e4ef),line([.18,.28,-.06],[.22,.18,.06],0x89e4ef)];paths.forEach(x=>g.add(x));let phase=0;
 function launch(){phase=1;ctx.ui.hud('وصلت الإشارة إلى المناطيد');card(ctx,'مشروع لوون في الكتاب','شبكة جوية تجريبية','تصف الصفحة تصور المشروع: مناطيد على ارتفاع عال تنقل الإشارة بين بعضها لتصل إلى مناطق نائية.',0x72d4e5);ctx.ui.choices([{label:'غيّر الارتفاع مع الرياح',primary:true,onPick:steer}]);}
 function steer(){phase=2;ctx.sfx.good();ctx.ui.hud('الرياح غيّرت طريق المناطيد');card(ctx,'توجيه المسار','الارتفاع يغير اتجاه الحركة','تشرح الصفحة أن اختيار طبقة الرياح والارتفاع جزء من توجيه المناطيد، ثم تمر الإشارة عبر الشبكة الجوية.',0xf0c86c);ctx.ui.choices([{label:'أوصل المدرسة البعيدة',primary:true,onPick:done}]);}
 function done(){phase=3;schools[2].b.material=green;ctx.ui.done();ctx.ui.hud('وصلت المدرسة إلى الشبكة');card(ctx,'من صفحة ٥١٠','الهدف: الوصول إلى المناطق النائية','تجربة مستوحاة من مشروع لوون التاريخي الوارد في الكتاب؛ تعرض فكرته التعليمية ولا تمثل خدمة تعمل الآن.',0x8ed1a1);ctx.ui.choices([{label:'↻ أعد الرحلة',onPick:reset}]);}
 function reset(){phase=0;schools[2].b.material=red;ctx.ui.hideCard();ctx.ui.hud('المدرسة البعيدة خارج التغطية');ctx.ui.choices([{label:'✦ أطلق المناطيد',primary:true,onPick:launch}]);}reset();balloons.forEach(x=>ctx.tap(x.ball,launch));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));balloons.forEach((v,i)=>{const y=.31+Math.sin(t*1.5+i)*.014;v.ball.position.y=y;v.ball.position.x=v.x+(phase===2?.025*Math.sin(t+i):0);v.basket.position.y=y-.07;v.basket.position.x=v.ball.position.x;v.tether.position.x=v.ball.position.x-v.x;});paths.forEach(x=>x.visible=phase>0);schools.forEach(v=>scaleTag(v.lbl,.105,k));scaleTag(name,.35,k);}};
}

export function buildSchoollessCity(ctx){
 const {g,name}=base(ctx,'مدينة تتعلم بلا جدران',0x244354),baseMat=mat(0x49616a),green=mat(0x8bd1a1,.2),gold=mat(0xe7bd70,.2),blue=mat(0x6bcbd8,.2),red=mat(0xe27e91,.2);
 const plate=block(.62,.018,.36,baseMat);plate.position.y=.04;g.add(plate);
 const hubs=[['بيت',-.22,-.08,gold],['مكتبة',.19,-.09,blue],['مجتمع',-.2,.11,green],['مرشد',.2,.11,gold]].map(([s,x,z,m])=>{const b=block(.105,.1,.09,m);b.position.set(x,.11,z);g.add(b);const roof=new THREE.Mesh(new THREE.ConeGeometry(.075,.055,4),m);roof.position.set(x,.19,z);roof.rotation.y=Math.PI/4;g.add(roof);const lbl=tag(s,.11);lbl.position.set(x,.26,z);g.add(lbl);return {b,roof,lbl};});
 const learners=[-.12,0,.12].map((x,i)=>{const a=sphere(.018,i===2?red:gold);a.position.set(x,.07,.02);g.add(a);return a;});
 const roads=[line([-.22,.1,-.08],[0,.08,.02],0x9be2e5),line([.19,.1,-.09],[0,.08,.02],0x9be2e5),line([-.2,.1,.11],[0,.08,.02],0x9be2e5),line([.2,.1,.11],[0,.08,.02],0x9be2e5)];roads.forEach(r=>g.add(r));let phase=0;
 function remove(){phase=1;ctx.ui.hud('اختفى مبنى المدرسة؛ أين سيتعلم الجميع؟');card(ctx,'مجتمع بلا مدرسة','المدينة صارت شبكة تعلم','تناقش الصفحة تصور التعلم الشبكي وتغير دور المدرسة التقليدية. وزع فرص التعلم، ثم اختبر الوصول إليها.',0xe7bd70);ctx.ui.choices([{label:'افتح المكتبة والمجتمع',primary:true,onPick:connect}]);}
 function connect(){phase=2;ctx.ui.hud('وصل طالبان، وبقي طالب بعيد عن الطريق');card(ctx,'اختبار العدالة','الاتصال وحده لا يكفي','توزيع الأماكن يوسع الفرص، لكن متعلماً بلا وسيلة وصول قد يظل خارج الشبكة. أضف إرشاداً ومساراً مناسباً.',0xe27e91);ctx.ui.choices([{label:'أضف مرشداً وطريقاً بديلاً',primary:true,onPick:done}]);}
 function done(){phase=3;learners[2].material=green;ctx.ui.done();ctx.ui.hud('المدينة تتعلم، والجميع له طريق');card(ctx,'مدينة أعيد تصميمها','التعلم يصل للجميع','فكرة المجتمع بلا مدرسة في الكتاب تدعو إلى تصور شبكة تعلم تتجاوز المبنى؛ نجاحها يعتمد على إمكان وصول كل متعلم.',0x8bd1a1);ctx.ui.choices([{label:'↻ أعد تخطيط المدينة',onPick:reset}]);}
 function reset(){phase=0;learners[2].material=red;ctx.ui.hideCard();ctx.ui.hud('ماذا يبقى من التعلم إذا اختفى المبنى؟');ctx.ui.choices([{label:'✦ أعد رسم المدينة',primary:true,onPick:remove}]);}reset();hubs.forEach((h,i)=>ctx.tap(h.b,()=>phase?connect():remove()));
 return {update(t,dt,e){const k=ease((t-.1)/1)*e;g.scale.setScalar(Math.max(.001,k));hubs.forEach((h,i)=>{h.b.material.emissiveIntensity=phase>=2?.25+.1*Math.sin(t*3+i):.1;scaleTag(h.lbl,.11,k);});learners.forEach((a,i)=>{a.position.y=.07+Math.sin(t*2+i)*.006;a.position.x=[-.12,0,.12][i]+(phase>=2&&i<2?.045*Math.sin(t*.5+i):0);});roads.forEach((r,i)=>r.visible=phase>=2&&(i<2||phase===3));scaleTag(name,.35,k);}};
}
