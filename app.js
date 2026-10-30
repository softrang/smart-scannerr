const $=id=>document.getElementById(id);
const video=$('video'), hint=$('cameraHint'), pagesBox=$('pages');
let stream=null, pages=[], cvReady=false;
function setCameraUI(on){$('start').disabled=on;$('stop').disabled=!on;$('capture').disabled=!on;video.style.display=on?'block':'none';hint.style.display=on?'none':'block'}
function waitOpenCV(){return new Promise(resolve=>{let tries=0;const timer=setInterval(()=>{if(window.cv&&cv.Mat){clearInterval(timer);cvReady=true;resolve(true)}if(++tries>80){clearInterval(timer);resolve(false)}},250)})}
$('start').addEventListener('click',async()=>{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false});video.srcObject=stream;await video.play();setCameraUI(true)}catch(e){alert('ক্যামেরা চালু করা যায়নি। HTTPS ব্যবহার করুন এবং Browser permission দিন।')}})
$('stop').addEventListener('click',stopCamera);
function stopCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;setCameraUI(false)}
$('capture').addEventListener('click',()=>{const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;c.getContext('2d').drawImage(video,0,0,c.width,c.height);addPage(c)});
$('upload').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);addPage(c);URL.revokeObjectURL(im.src)};im.src=URL.createObjectURL(f);e.target.value=''});
function addPage(source){const processed=autoCrop(source);pages.push(processed);renderPages()}
function autoCrop(source){
 if(!cvReady)return source;
 let src=null,gray=null,blur=null,edges=null,contours=null,hierarchy=null;
 try{
  src=cv.imread(source);gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);cv.Canny(blur,edges,50,150);let kernel=cv.Mat.ones(5,5,cv.CV_8U);cv.dilate(edges,edges,kernel);contours=new cv.MatVector();hierarchy=new cv.Mat();cv.findContours(edges,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
  let best=null,bestArea=0;const total=src.cols*src.rows;
  for(let i=0;i<contours.size();i++){let cnt=contours.get(i),peri=cv.arcLength(cnt,true),approx=new cv.Mat();cv.approxPolyDP(cnt,approx,.02*peri,true);let area=cv.contourArea(approx);if(approx.rows===4&&area>total*.12&&area>bestArea){bestArea=area;best=[];for(let j=0;j<4;j++)best.push({x:approx.intAt(j,0),y:approx.intAt(j,1)})}cnt.delete();approx.delete()}
  if(!best)return source;
  const pts=orderPoints(best),w=Math.max(dist(pts[0],pts[1]),dist(pts[2],pts[3])),h=Math.max(dist(pts[0],pts[3]),dist(pts[1],pts[2]));
  const dst=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,w-1,0,w-1,h-1,0,h-1]);const srcPts=cv.matFromArray(4,1,cv.CV_32FC2,pts.flatMap(p=>[p.x,p.y]));const M=cv.getPerspectiveTransform(srcPts,dst);let out=new cv.Mat();cv.warpPerspective(src,out,M,new cv.Size(Math.round(w),Math.round(h)));let result=document.createElement('canvas');cv.imshow(result,out);dst.delete();srcPts.delete();M.delete();out.delete();return result;
 }catch(err){console.warn('Auto crop fallback',err);return source}
 finally{[src,gray,blur,edges,contours,hierarchy].forEach(x=>{if(x&&x.delete)x.delete()})}
}
function orderPoints(p){const sum=p.map(a=>a.x+a.y),dif=p.map(a=>a.x-a.y);return [p[sum.indexOf(Math.min(...sum))],p[dif.indexOf(Math.max(...dif))],p[sum.indexOf(Math.max(...sum))],p[dif.indexOf(Math.min(...dif))]]}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function renderPages(){pagesBox.innerHTML='';$('count').textContent=`${pages.length} page`;pages.forEach((c,i)=>{const box=document.createElement('div');box.className='page';const img=document.createElement('img');img.src=c.toDataURL('image/jpeg',.92);const meta=document.createElement('div');meta.className='meta';meta.innerHTML=`<span>পৃষ্ঠা ${i+1}</span>`;const del=document.createElement('button');del.textContent='মুছুন';del.onclick=()=>{pages.splice(i,1);renderPages()};meta.append(del);box.append(img,meta);pagesBox.append(box)});if(!pages.length)pagesBox.innerHTML='<div class="empty">এখনো কোনো পৃষ্ঠা যোগ করা হয়নি</div>';['pdf','jpg','print','clear'].forEach(id=>$(id).disabled=!pages.length)}
$('clear').onclick=()=>{pages=[];renderPages()};
$('jpg').onclick=()=>download(pages[pages.length-1].toDataURL('image/jpeg',.95),`scan-${pages.length}.jpg`);
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click()}
$('pdf').onclick=()=>{if(!window.jspdf){alert('PDF library লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।');return}const {jsPDF}=window.jspdf;const size=$('paper').value;const dims=size==='A3'?[297,420]:[210,297];const doc=new jsPDF({orientation:'portrait',unit:'mm',format:size});pages.forEach((c,i)=>{if(i)doc.addPage(size,'portrait');const ratio=c.width/c.height;let w=dims[0],h=dims[1];if(ratio>w/h){h=w/ratio}else{w=h*ratio}doc.addImage(c.toDataURL('image/jpeg',.94),'JPEG',(dims[0]-w)/2,(dims[1]-h)/2,w,h)});doc.save(`A3-smart-scan-${Date.now()}.pdf`)};
$('print').onclick=()=>{const win=window.open('','_blank');if(!win){alert('Print window blocked. Pop-up অনুমতি দিন।');return}const imgs=pages.map(c=>`<img src="${c.toDataURL('image/jpeg',.95)}">`).join('');win.document.write(`<!doctype html><html><head><title>Print scans</title><style>@page{size:${$('paper').value};margin:0}body{margin:0}img{width:100%;height:100vh;object-fit:contain;page-break-after:always}</style></head><body>${imgs}<script>window.onload=()=>window.print()<\/script></body></html>`);win.document.close()};
waitOpenCV().then(ok=>{if(!ok)console.warn('OpenCV unavailable; auto crop will use original images')});
