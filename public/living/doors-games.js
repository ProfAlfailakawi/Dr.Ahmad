// Five university-level decision games grounded in the printed encyclopedia pages.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';
const material=(color,glow=.12)=>new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.2,emissive:color,emissiveIntensity:glow});
const box=(w,h,d,m)=>shadowed(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.012,w/6,h/6,d/3)),m));
const label=(text,width=.22)=>sprite(text,width,{size:46,width:560,weight:800,color:'#fff8e9',bg:'rgba(20,28,43,.94)'});
const tagScale=(s,w,k)=>s.scale.set(Math.max(.001,w*k),Math.max(.001,w*s.userData.aspect*k),1);
const orb=(r,m)=>new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);
function scene(ctx,title,color,makeProps){
 const g=new THREE.Group();g.position.copy(P(.5,.52));ctx.stage.add(g);
 const base=box(.65,.018,.36,material(0x243449));base.position.y=.02;g.add(base);
 const heading=label(title,.34);heading.position.set(0,.42,-.12);g.add(heading);
 const nodes=[-.2,0,.2].map((x,i)=>{const m=material(color,.12);const n=orb(.026,m);n.position.set(x,.29,.13);g.add(n);return n;});
 const visual=makeProps(g,color);return {g,heading,nodes,visual};
}
function decisionGame(ctx,config){
 const {g,heading,nodes,visual}=scene(ctx,config.title,config.color,config.props);
 let round=-1,score=0,chosen=false,now=0;
 const scoreText=()=>`${score} من ${config.rounds.length}`;
 function show(i){round=i;chosen=false;const r=config.rounds[i];ctx.ui.hud(`${config.role} · المهمة ${i+1} من ${config.rounds.length} · النقاط ${scoreText()}`);
  ctx.ui.card({tag:`${config.role} · المهمة ${i+1}`,title:r.question,body:r.situation,color:config.color});
  ctx.ui.choices(r.options.map((o,j)=>({label:o.label,primary:j===0,onPick:()=>pick(o)})));
 }
 function pick(o){if(chosen)return;chosen=true;score+=o.points;ctx.sfx[o.points?'good':'bad']();
  if(visual.choose)visual.choose(round,o.points,score);
  ctx.ui.hud(`${o.points?'قرار مدروس':'نتيجة تحتاج مراجعة'} · النقاط ${scoreText()}`);
  ctx.ui.card({tag:o.points?'أثر القرار':'راجع الأثر',title:o.result,body:o.impact,color:o.points?0x77cba5:0xe18a85});
  ctx.ui.choices([{label:round===config.rounds.length-1?'اعرض تقييمك':'انتقل للمهمة التالية',primary:true,onPick:()=>round===config.rounds.length-1?finish():show(round+1)}]);
 }
 function finish(){const passed=score>=config.pass;ctx.ui.hud(`${config.role} · النتيجة ${scoreText()}`);
  ctx.ui.card({tag:'تقرير الأداء',title:passed?config.successTitle:'أعد اختبار قراراتك',body:passed?config.success:`حصلت على ${scoreText()}. راجع أثر كل قرار، ثم أعد المهمة لتصل إلى ${config.pass} نقاط على الأقل.`,color:passed?0x77cba5:0xe18a85});
  if(passed)ctx.ui.done();ctx.ui.choices([{label:'↻ أعد اللعب',primary:true,onPick:reset}]);
 }
 function reset(){round=-1;score=0;chosen=false;if(visual.reset)visual.reset();ctx.ui.hideCard();ctx.ui.hud(config.intro);ctx.ui.choices([{label:config.start,primary:true,onPick:()=>show(0)}]);}
 reset();nodes.forEach((n,i)=>ctx.tap(n,()=>{if(round>=0&&!chosen){const r=config.rounds[round];ctx.ui.card({tag:`${config.role} · المهمة ${round+1}`,title:r.question,body:r.situation,color:config.color});}}));
 return {update(t,dt,e){now=t;const k=ease((t-.1)/1.05)*e;g.scale.setScalar(Math.max(.001,k));nodes.forEach((n,i)=>{n.material.emissiveIntensity=i<round?.48:i===round?.32:.1;n.position.y=.29+Math.sin(t*2+i)*.009;});if(visual.update)visual.update(t,dt,e,round,score);tagScale(heading,.34,k);}};
}

export function buildSmartGoalGame(ctx){
 return decisionGame(ctx,{title:'مختبر الأهداف الذكية',role:'مصمم مقرر جامعي',color:0x54c7d2,intro:'حوّل هدفاً عاماً إلى هدف يمكن تدريسه وقياسه',start:'✦ افتح ملف المقرر',pass:3,successTitle:'هدف يصلح للتنفيذ',success:'جمعت التحديد والقياس والواقعية والزمن في قراراتك. الصفحة تعرض خصائص SMART بوصفها أداة لفحص الهدف قبل التدريس.',
 props(g){const rings=[.13,.095,.06].map((r,i)=>{const x=new THREE.Mesh(new THREE.TorusGeometry(r,.009,8,40),material([0x5bd1dc,0xe7b95d,0x96d39b][i],.25));x.position.set(0,.18,.01+i*.005);g.add(x);return x;});const dart=orb(.028,material(0xecc36d,.4));dart.position.set(-.24,.11,.02);g.add(dart);const caption=label('SMART',.18);caption.position.set(0,.34,.02);g.add(caption);return {choose(i,points){dart.position.x=-.24+(i+1)*.12;dart.position.y=.11+points*.06;},reset(){dart.position.set(-.24,.11,.02);},update(t,dt,e){rings.forEach((r,i)=>r.rotation.z=t*(i%2?-.35:.35));tagScale(caption,.18,ease((t-.1)/1)*e);}};},
 rounds:[
 {question:'هدف المقرر: «يفهم الطلاب الوسائط»',situation:'لديك محاضرة لطلبة التربية. اختر صياغة يمكن أن تلاحظ فيها أداء الطالب.',options:[
 {label:'يقارن الطالب وسيطين وفق معيارين',points:1,result:'صار الأداء قابلاً للملاحظة',impact:'المقارنة ومعيارا الحكم يحددان ما سيفعله الطالب وكيف يمكن تقويمه.'},
 {label:'يتعرف الطالب جيداً على الوسائط',points:0,result:'بقي الفعل غامضاً',impact:'«يتعرف جيداً» لا يبين أداء قابلاً للقياس أو معياراً للحكم.'}]},
 {question:'موعد تحقيق الهدف',situation:'الفعل واضح الآن، لكن فريق التدريس يريد أن يعرف متى يفحصه.',options:[
 {label:'بنهاية ورشة اليوم',points:1,result:'أضفت زمناً محدداً',impact:'أصبح للتقويم نقطة زمنية، وهو أحد عناصر الهدف الذكي في الصفحة.'},
 {label:'في وقت مناسب لاحقاً',points:0,result:'الزمن ما زال مفتوحاً',impact:'العبارة لا تحدد موعداً عملياً لمراجعة تحقيق الهدف.'}]},
 {question:'هدف طموح تحت قيود حقيقية',situation:'الورشة مدتها ساعة وأجهزتها محدودة. اختر اتفاقاً واقعياً مع المجموعة.',options:[
 {label:'نجرب وسيطين متاحين ونراجع النتيجة',points:1,result:'وازنته مع الموارد',impact:'تحديد الموارد ومراجعتها مع المشاركين يجعل الهدف أقرب إلى الواقعية والاتفاق.'},
 {label:'ننتج منصة كاملة خلال الساعة',points:0,result:'الهدف أكبر من الوقت',impact:'الطموح وحده لا يكفي إذا كانت الموارد والزمن لا يسمحان بالتنفيذ.'}]}
 ]});
}

export function buildAdoptionGame(ctx){
 return decisionGame(ctx,{title:'غرفة قرار التحول التقني',role:'لجنة جامعية',color:0xe6b86d,intro:'ثلاثة قرارات لإنقاذ مشروع تعليمي محدود الموارد',start:'✦ افتح ملف التحول',pass:3,successTitle:'خطة تبن مدروسة',success:'عالجت التدريب والبنية والتخطيط قبل توسيع المشروع. تعرض الصفحة هذه المعوقات بوصفها أسباباً تحد من أثر المستحدثات.',
 props(g){const towers=[-.18,0,.18].map((x,i)=>{const b=box(.12,.1+i*.035,.11,material([0x78cbd6,0xe6b86d,0x91ce9e][i],.18));b.position.set(x,.1+i*.018,0);g.add(b);const t=label(['تدريب','بنية','خطة'][i],.12);t.position.set(x,.25,0);g.add(t);return {b,t};});const coins=[-.12,0,.12].map(x=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.01,16),material(0xf0d381,.4));c.rotation.x=Math.PI/2;c.position.set(x,.31,.08);g.add(c);return c;});return {choose(i,points,score){coins[i].material.emissiveIntensity=points?.65:.05;towers[i].b.material.emissiveIntensity=points?.45:.08;},reset(){coins.forEach(c=>c.material.emissiveIntensity=.4);towers.forEach(x=>x.b.material.emissiveIntensity=.18);},update(t,dt,e){coins.forEach((c,i)=>c.rotation.z=t*.8+i);towers.forEach(x=>tagScale(x.t,.12,ease((t-.1)/1)*e));}};},
 rounds:[
 {question:'أساتذة يرفضون المنصة الجديدة',situation:'خصصت الجامعة ميزانية صغيرة. ماذا تفعل قبل شراء أدوات إضافية؟',options:[
 {label:'ورشة قصيرة وتجربة بإشراف الأساتذة',points:1,result:'خففت مقاومة التغيير',impact:'الصفحة تذكر عدم القناعة وقلة التدريب ضمن معوقات التوظيف.'},
 {label:'أفرض المنصة فوراً على الجميع',points:0,result:'المقاومة ازدادت',impact:'الإلزام بلا إعداد لا يعالج نقص المهارة أو القناعة.'}]},
 {question:'قاعة بلا اتصال ثابت',situation:'أول تجربة فشلت لأن البنية لم تكن جاهزة. ماذا تقدم للجنة؟',options:[
 {label:'أصلح الاتصال وأجرب في قاعة واحدة',points:1,result:'اختبرت البنية قبل التوسع',impact:'تذكر الصفحة نقص الأجهزة والاتصال وتجهيز القاعات ضمن العوائق المادية.'},
 {label:'أشتري اشتراكات جديدة أولاً',points:0,result:'المشكلة الأساسية بقيت',impact:'اشتراك إضافي لا يصلح قاعة لا تملك اتصالاً مستقراً.'}]},
 {question:'التمويل لا يغطي جميع الكليات',situation:'تبقى موارد محدودة. اختر طريقة إطلاق المشروع.',options:[
 {label:'تجربة محددة مع مؤشرات ثم توسع',points:1,result:'صار التوسع قابلاً للمراجعة',impact:'التخطيط والتجريب يساعدان على مواجهة قلة التمويل والتغير السريع للتقنيات.'},
 {label:'تعميم شامل من اليوم الأول',points:0,result:'تجاوزت قدرة المشروع',impact:'التمويل والتدريب والبنية لا تكفي لتعميم غير مخطط له.'}]}
 ]});
}

export function buildEbookAuditGame(ctx){
 return decisionGame(ctx,{title:'محكمة جودة الكتاب الإلكتروني',role:'مراجع جودة',color:0x9a79d5,intro:'افحص نموذج كتاب قبل إطلاقه لطلبة الجامعة',start:'✦ ابدأ المراجعة',pass:3,successTitle:'الكتاب اجتاز المراجعة',success:'راجعت الإبحار والتقويم وسهولة الاستخدام، وهي من المواصفات والمعايير المذكورة في صفحة الكتاب.',
 props(g){const cover=box(.3,.025,.27,material(0x55457b));cover.position.set(0,.07,0);g.add(cover);const pages=[-.08,0,.08].map((x,i)=>{const p=box(.095,.17,.012,material([0xb89ae1,0xd8c8f0,0xf0e8fa][i],.12));p.position.set(x,.17,.015);p.rotation.y=(i-1)*.25;g.add(p);return p;});const marks=[-.12,0,.12].map(x=>{const m=orb(.015,material(0xe9bd72,.25));m.position.set(x,.29,.05);g.add(m);return m;});return {choose(i,points){marks[i].material.color.setHex(points?0x74cfa5:0xe88688);pages[i].rotation.y=points?(i-1)*.4:.8;},reset(){marks.forEach(m=>m.material.color.setHex(0xe9bd72));pages.forEach((p,i)=>p.rotation.y=(i-1)*.25);},update(t,dt,e){pages.forEach((p,i)=>p.position.y=.17+Math.sin(t*2+i)*.004);}};},
 rounds:[
 {question:'الطالب لا يجد الفصل التالي',situation:'الكتاب يحتوي مواد جيدة لكن الانتقال بين الأبواب مربك.',options:[
 {label:'أضيف فهرساً ومسار رجوع واضحاً',points:1,result:'أصلحت الإبحار',impact:'تذكر الصفحة أساليب الإبحار وواجهة التفاعل ضمن مواصفات تصميم الكتاب الإلكتروني.'},
 {label:'أضيف مؤثر حركة للغلاف',points:0,result:'العائق بقي',impact:'تحسين الغلاف لا يعالج صعوبة الوصول إلى المحتوى.'}]},
 {question:'أنشطة بلا تغذية راجعة',situation:'يحل الطالب المهمة، ولا يعرف سبب صحة قراره أو خطئه.',options:[
 {label:'أعرض تفسيراً بعد كل قرار',points:1,result:'صار التقويم أداة تعلم',impact:'تذكر الصفحة التقويم والتغذية الراجعة ضمن معايير التصميم التعليمي.'},
 {label:'أكتفي بإظهار الدرجة النهائية',points:0,result:'ضاعت فرصة التعلم',impact:'الدرجة وحدها لا تفسر الخطأ أو توجه المحاولة التالية.'}]},
 {question:'نص صغير على شاشة هاتف',situation:'اختبر الكتاب طالب يستخدم شاشة صغيرة مدة طويلة.',options:[
 {label:'أجعل الخط مقروءاً والتباين واضحاً',points:1,result:'تحسنت سهولة الاستخدام',impact:'النص واللون وتماسك العرض من المعايير الفنية ومعايير سهولة الاستخدام في الصفحة.'},
 {label:'أزيد عدد الصور بلا تغيير النص',points:0,result:'المشكلة البصرية مستمرة',impact:'صور أكثر لا تعالج حجم الخط أو وضوح النص.'}]}
 ]});
}

export function buildByodPolicyGame(ctx){
 return decisionGame(ctx,{title:'مجلس سياسة الأجهزة الشخصية',role:'مجلس كلية',color:0x5ac7ca,intro:'اسمح بالأجهزة من دون أن تجعلها شرطاً للإقصاء',start:'✦ افتح جلسة المجلس',pass:3,successTitle:'سياسة أكثر إنصافاً',success:'وظفت الأجهزة الشخصية للتعلم مع بديل متاح ودعم واضح. الصفحة تصف BYOD واختلاف المواقف حول تطبيقه.',
 props(g){const devices=[[-.18,.09,.065],[0,.12,.085],[.18,.08,.06]].map(([x,h,w],i)=>{const d=box(w,h,.015,material([0x58bcd3,0x8ed1a1,0xe8bd6d][i],.18));d.position.set(x,.16,.03);g.add(d);const screen=box(w*.75,h*.65,.003,material(0xc4f0e4,.25));screen.position.set(x,.16,.04);g.add(screen);return d;});const wifi=new THREE.Mesh(new THREE.TorusGeometry(.07,.007,8,30,Math.PI),material(0x84d9d8,.3));wifi.position.set(0,.32,-.04);g.add(wifi);return {choose(i,points){devices[i].material.emissiveIntensity=points?.6:.04;},reset(){devices.forEach(d=>d.material.emissiveIntensity=.18);},update(t){wifi.rotation.z=Math.sin(t*2)*.1;}};},
 rounds:[
 {question:'طالب لا يملك جهازاً مناسباً',situation:'تريد فتح مقرر يعتمد على الأجهزة الشخصية.',options:[
 {label:'أوفر جهاز إعارة ومساراً بديلاً',points:1,result:'أبقيت المشاركة ممكنة',impact:'السماح بالجهاز الشخصي لا يعني اشتراط امتلاكه على كل طالب.'},
 {label:'أشترط الجهاز على الجميع',points:0,result:'استبعدت بعض الطلبة',impact:'السياسة تفقد قيمتها التعليمية إذا منعت من لا يملك الجهاز من الوصول.'}]},
 {question:'شبكة الجامعة مزدحمة',situation:'طلبة عدة تخصصات يدخلون المقرر في الوقت نفسه.',options:[
 {label:'أختبر الاتصال والمواد قبل التعميم',points:1,result:'خففت خطر الانقطاع',impact:'اختبار البنية والدخول إلى المواد يجعل التطبيق قابلاً للتنفيذ.'},
 {label:'أعلن التطبيق بلا تجربة',points:0,result:'تركت عائقاً غير معروف',impact:'توافر الأجهزة لا يكفي إذا لم تعمل شبكة الوصول والمواد عند الحاجة.'}]},
 {question:'الأجهزة تصرف الانتباه في الحصة',situation:'بعض الطلاب ينتقلون إلى تطبيقات لا تخص النشاط.',options:[
 {label:'أحدد مهمة قصيرة وقواعد استخدام',points:1,result:'صار للجهاز دور تعلم واضح',impact:'ترتبط فائدة BYOD بتصميم النشاط ومتى يستخدم الجهاز، لا بحضوره وحده.'},
 {label:'أترك الاستخدام بلا هدف',points:0,result:'تشتت النشاط',impact:'غياب هدف وقواعد يجعل الجهاز أقرب إلى مصدر تشتيت.'}]}
 ]});
}

export function buildTechBalanceGame(ctx){
 return decisionGame(ctx,{title:'غرفة التوازن التقني',role:'مستشار تعليمي',color:0xe49a82,intro:'حالات جامعية بين الخوف من التقنية والإفراط فيها',start:'✦ ابدأ الحالات',pass:3,successTitle:'قرارات متزنة',success:'فرقت بين حاجة التدريب وحدود الاستخدام وتقييم الفائدة. تناقش الصفحة الخوف من التكنولوجيا والهوس بها.',
 props(g){const beam=box(.43,.018,.04,material(0xe8c88b));beam.position.set(0,.18,0);g.add(beam);const stem=box(.018,.16,.03,material(0xb7bbc8));stem.position.set(0,.1,0);g.add(stem);const pans=[-.18,.18].map((x,i)=>{const p=box(.14,.015,.09,material(i?0xe59389:0x6dc8d0,.2));p.position.set(x,.12,.02);g.add(p);const lbl=label(i?'هوس':'خوف',.12);lbl.position.set(x,.25,.02);g.add(lbl);return {p,lbl};});const needle=orb(.035,material(0xf5d57b,.35));needle.position.set(0,.22,.025);g.add(needle);let lean=0;return {choose(i,points){lean=points?0:(i%2?1:-1);},reset(){lean=0;},update(t,dt,e){beam.rotation.z=THREE.MathUtils.lerp(beam.rotation.z,lean*.18,Math.min(1,dt*4));needle.position.x=Math.sin(t*2)*.007;pans.forEach((x,i)=>tagScale(x.lbl,.12,ease((t-.1)/1)*e));}};},
 rounds:[
 {question:'محاضر يخشى تجربة منصة جديدة',situation:'الرفض مرتبط بقلة الخبرة أكثر من اعتراض على الهدف التعليمي.',options:[
 {label:'تدريب قصير وتجربة منخفضة المخاطر',points:1,result:'قدمت طريقاً للتعلم',impact:'تذكر الصفحة أن الصفوف والدورات والمعرفة تساعد على تجاوز الخوف من التقنية.'},
 {label:'أسخر من تردده أمام زملائه',points:0,result:'عمقت المقاومة',impact:'الإحراج لا يبني مهارة ولا يجيب عن القلق.'}]},
 {question:'طالب يفتح المنصة طوال الليل',situation:'يربط كل دقيقة دراسة بإشعارات وتنبيهات متواصلة.',options:[
 {label:'أضع فترات دراسة وحدوداً للتنبيهات',points:1,result:'حفظت فائدة الأداة',impact:'الهدف استخدام التقنية لخدمة التعلم مع حدود واضحة للوقت والانتباه.'},
 {label:'أزيد الإشعارات لتحفيزه',points:0,result:'ازداد التشتت',impact:'المزيد من التنبيهات لا يعالج الإفراط في الاستخدام.'}]},
 {question:'لجنة تريد إلغاء كل تقنية بعد تعثر تجربة',situation:'تعثر نشاط واحد، لكن بعض الطلبة استفادوا منه.',options:[
 {label:'أراجع الأدلة وأعدل طريقة التطبيق',points:1,result:'اتخذت قراراً مبنياً على الأثر',impact:'التقييم يميز بين مشكلة في الأداة ومشكلة في استخدامها، ويجنب الرفض المطلق أو الحماس المطلق.'},
 {label:'ألغي جميع الأدوات فوراً',points:0,result:'حكمت من تجربة واحدة',impact:'التعميم لا يبين سبب التعثر ولا يحفظ ما نجح من النشاط.'}]}
 ]});
}
