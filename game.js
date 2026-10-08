(function(){
'use strict';
var $=function(s){return document.querySelector(s);};
var app=$('#app'), canvas=$('#c');
if(typeof THREE==='undefined'){ $('#nogl').hidden=false; return; }
var renderer;
try{ renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true}); }
catch(err){ $('#nogl').hidden=false; return; }

var reduceMotion=false;
try{ reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
var FONT="'Baloo 2','Trebuchet MS','Arial Rounded MT Bold',sans-serif";
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerpAngle(a,b,t){var d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*t;}

/* ---------- renderer, scene, kamera ---------- */
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
var scene=new THREE.Scene();
scene.background=new THREE.Color(0xCDEBFF);
var camera=new THREE.PerspectiveCamera(60,1,0.1,80);
var hemi=new THREE.HemisphereLight(0xFFFFFF,0xBFD6F5,0.82);scene.add(hemi);
var sun=new THREE.DirectionalLight(0xFFF3DC,0.55);
sun.position.set(7,15,9);
sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;
sun.shadow.camera.near=2;sun.shadow.camera.far=40;
sun.shadow.bias=-0.0006;
scene.add(sun);
var world=new THREE.Group();
scene.add(world);

function resize(){
  var w=app.clientWidth||innerWidth, h=app.clientHeight||innerHeight;
  if(typeof state!=='undefined'&&state&&state.algoView&&typeof algoLayout==='function'){setTimeout(function(){algoLayout(true);},0);}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.fov=camera.aspect<1?78:60;
  camera.updateProjectionMatrix();
}
if(window.ResizeObserver){ new ResizeObserver(resize).observe(app); }
window.addEventListener('resize',resize);
resize();

/* ---------- helper bentuk ---------- */
function L(c,o){return new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));}
function BM(c,o){return new THREE.MeshBasicMaterial(Object.assign({color:c},o||{}));}
function put(p,m,x,y,z){m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;}
function box(p,w,h,d,mat,x,y,z){return put(p,new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),x,y,z);}
function cyl(p,rt,rb,h,mat,x,y,z,seg){return put(p,new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||14),mat),x,y,z);}
function sph(p,r,mat,x,y,z,ws,hs){return put(p,new THREE.Mesh(new THREE.SphereGeometry(r,ws||14,hs||10),mat),x,y,z);}
function plane(p,w,h,mat,x,y,z,rx,ry){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x||0,y||0,z||0);m.rotation.set(rx||0,ry||0,0);p.add(m);return m;}
function grp(p,x,y,z,ry){var g=new THREE.Group();g.position.set(x||0,y||0,z||0);g.rotation.y=ry||0;p.add(g);return g;}
function tube(p,pts,r,color){
  var c=new THREE.CatmullRomCurve3(pts.map(function(a){return new THREE.Vector3(a[0],a[1],a[2]);}));
  var m=new THREE.Mesh(new THREE.TubeGeometry(c,18,r,6,false),L(color));
  m.castShadow=true;p.add(m);return m;
}
var seed=11;
function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647;}

/* ---------- tekstur kanvas ---------- */
var redrawables=[];
function rr(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath();}
function canvasTex(w,h,draw){
  var c=document.createElement('canvas');c.width=w;c.height=h;
  var x=c.getContext('2d');draw(x,w,h);
  var t=new THREE.CanvasTexture(c);
  t.anisotropy=4;
  var o={tex:t,redraw:function(){x.clearRect(0,0,w,h);draw(x,w,h);t.needsUpdate=true;}};
  redrawables.push(o);
  return o;
}
function label(x,str,cx,cy,size,color){x.font='800 '+size+'px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(str,cx,cy);}

var floorT=canvasTex(128,128,function(x,w,h){
  x.fillStyle='#D3ECF8';x.fillRect(0,0,w,h);
  x.fillStyle='#EBF8FD';x.fillRect(0,0,64,64);x.fillRect(64,64,64,64);
  x.strokeStyle='rgba(110,150,200,.35)';x.lineWidth=2;x.strokeRect(1,1,w-2,h-2);
});
floorT.tex.wrapS=floorT.tex.wrapT=THREE.RepeatWrapping;
floorT.tex.repeat.set(9,7);

var kbT=canvasTex(512,192,function(x,w,h){
  x.fillStyle='#DFE6F6';x.fillRect(0,0,w,h);
  var rows=[13,12,11,9], kw=(w-30)/13, kh=36, gap=5, y=12;
  rows.forEach(function(n,ri){
    var off=15+ri*kw*0.35;
    for(var i=0;i<n;i++){
      x.fillStyle=(ri===1&&i===11)||(ri===2&&i===10)?'#FF6F59':'#FFFFFF';
      rr(x,off+i*kw+gap/2,y,kw-gap,kh,6);x.fill();
      x.strokeStyle='#9AA8D0';x.lineWidth=2;x.stroke();
    }
    y+=kh+gap+3;
  });
  x.fillStyle='#14B8A6';rr(x,110,y,290,kh,8);x.fill();x.strokeStyle='#1B2559';x.lineWidth=2;x.stroke();
});

function markerTex(kind){
  return canvasTex(128,128,function(x){
    x.fillStyle=kind==='q'?'#FFC83D':(kind==='w'?'#FF6F59':'#27C281');
    x.beginPath();x.arc(64,64,54,0,Math.PI*2);x.fill();
    x.lineWidth=8;x.strokeStyle='#1B2559';x.stroke();
    if(kind==='q'){label(x,'?',64,70,84,'#1B2559');}
    else if(kind==='w'){label(x,'!',64,70,84,'#FFFFFF');}
    else{x.lineWidth=14;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#FFFFFF';x.beginPath();x.moveTo(36,66);x.lineTo(56,86);x.lineTo(94,44);x.stroke();}
  });
}
var qTex=markerTex('q'), okTex=markerTex('ok'), warnTex=markerTex('w');
var arrowTex=canvasTex(128,128,function(x){
  x.fillStyle='#FF6F59';x.beginPath();x.arc(64,64,54,0,Math.PI*2);x.fill();
  x.lineWidth=8;x.strokeStyle='#1B2559';x.stroke();
  x.fillStyle='#FFFFFF';x.beginPath();x.moveTo(38,50);x.lineTo(90,50);x.lineTo(64,92);x.closePath();x.fill();
});

/* ---------- bangun dunia ---------- */
var solids=[];
function addSolid(cx,cz,w,d){solids.push({x0:cx-w/2,x1:cx+w/2,z0:cz-d/2,z1:cz+d/2});}
var blinkers=[];
var specs=[];
/* ---------- ruang (area): lapisan tampilan ---------- */
var AREA_L={shell:0,deskH:1,desk0:2,desk1:3,desk2:4,desk3:5,desk4:6,net:7,printer:8,server:9,cab:10,rack:11,tech:12,plants:13,board:14,door:15,asm:16,l3:17,l4:18,l5:19,l6:20,l7:21,l8:22,off:30};
var areaMask=1, marks=[], WALLS=[];
function snap(){return {w:world.children.length,s:scene.children.length,sol:solids.length};}
function layerWalk(o,n){o.__layer=n;if(o.layers&&o.layers.set){o.layers.set(n);}var c=o.children;if(c&&c.length){for(var i=0;i<c.length;i++){layerWalk(c[i],n);}}return o;}
function claim(name,a,b){
  var n=AREA_L[name];if(!n){return;}
  world.children.slice(a.w,b?b.w:undefined).forEach(function(o){layerWalk(o,n);});
  scene.children.slice(a.s,b?b.s:undefined).forEach(function(o){layerWalk(o,n);});
  for(var i=a.sol;i<(b?b.sol:solids.length);i++){solids[i].layer=n;}
}
function MK(name){marks.push({n:name,m:snap()});}
function closeMarks(){
  for(var i=0;i<marks.length;i++){claim(marks[i].n,marks[i].m,marks[i+1]?marks[i+1].m:snap());}
  marks=[];
  specs.forEach(function(sp){if(sp.sprite&&sp.group&&sp.group.__layer){layerWalk(sp.sprite,sp.group.__layer);}});
}

/* tanah di luar dan lantai */
plane(scene,90,90,L(0xBDE8CC),0,-0.05,0,-Math.PI/2,0).receiveShadow=true;
box(world,18.6,0.25,14.6,L(0x6B7BDA),0,-0.14,0);
var floor=plane(world,18,14,new THREE.MeshLambertMaterial({map:floorT.tex}),0,0.001,0,-Math.PI/2,0);
floor.receiveShadow=true;

/* dinding: bidang satu sisi, tembus pandang dari luar */
function wall(w,h,color,x,y,z,ry,shadow){var m=plane(world,w,h,L(color),x,y,z,0,ry);m.receiveShadow=!!shadow;if(h===4.5){WALLS.push(m);}return m;}
wall(18,4.5,0xBDEBD5,0,2.25,-7,0,true);
wall(18,4.5,0xD7D0FF,0,2.25,7,Math.PI,true);
wall(14,4.5,0xFFE9A8,9,2.25,0,-Math.PI/2,true);
wall(14,4.5,0xFFD1C2,-9,2.25,0,Math.PI/2,true);
[[18,0,-6.985,0],[18,0,6.985,Math.PI],[14,8.985,0,-Math.PI/2],[14,-8.985,0,Math.PI/2]].forEach(function(a){
  var horiz=Math.abs(a[3])<0.1||Math.abs(a[3]-Math.PI)<0.1;
  var x=horiz?a[1]:a[1], z=a[2];
  wall(a[0],0.42,0x6B7BDA,x,0.21,z,a[3]);
  wall(a[0],0.16,0xFFFFFF,x,3.45,z,a[3]);
});

/* papan tulis, pintu, tanda */
function sign(p,w,h,x,y,z,ry,draw){
  var t=canvasTex(512,Math.round(512*h/w),draw);
  plane(p,w,h,BM(0xFFFFFF,{map:t.tex,transparent:true}),x,y,z,0,ry);
  return t;
}
// papan informasi
MK('board');
var boardG=grp(world,-3.2,0,-6.9,0);
box(boardG,5.5,2.4,0.1,L(0xC9D3EE),0,2.55,0);
box(boardG,5.5,0.08,0.2,L(0x8C9AD0),0,1.32,0.08);
var boardT=canvasTex(1024,430,function(x,w,h){
  x.fillStyle='#FFFFFF';x.fillRect(0,0,w,h);
  label(x,'SELAMAT DATANG DI LAB KOMPUTER',w/2,62,52,'#1B2559');
  label(x,'Komputer bekerja dengan 3 langkah',w/2,118,30,'#5A6AA8');
  var cols=[['INPUT','memasukkan data','#14B8A6','#FFFFFF'],['PROSES','mengolah data','#FFC83D','#1B2559'],['OUTPUT','menampilkan hasil','#FF6F59','#FFFFFF']];
  cols.forEach(function(c,i){
    var bx=56+i*322;
    x.fillStyle=c[2];rr(x,bx,160,276,170,22);x.fill();x.lineWidth=5;x.strokeStyle='#1B2559';x.stroke();
    label(x,c[0],bx+138,225,56,c[3]);label(x,c[1],bx+138,288,27,c[3]);
    if(i<2){x.fillStyle='#1B2559';x.beginPath();x.moveTo(bx+286,225);x.lineTo(bx+312,245);x.lineTo(bx+286,265);x.closePath();x.fill();}
  });
  label(x,'Ayo kenali perangkat di lab ini!',w/2,388,32,'#1B2559');
});
plane(boardG,5.3,2.22,BM(0xFFFFFF,{map:boardT.tex}),0,2.55,0.056,0,0);
MK('shell');

MK('door');
// pintu
var doorG=grp(world,5.8,0,-6.88,0);
box(doorG,2.4,3.4,0.14,L(0x16877D),0,1.7,0);
box(doorG,1.9,3.1,0.12,L(0x2FCB8F),0,1.55,0.06);
box(doorG,0.64,0.74,0.04,L(0xBFE9FF),0,2.3,0.14);
sph(doorG,0.08,L(0xFFC83D),0.7,1.4,0.16,10,8);
box(doorG,0.34,0.26,0.08,L(0xFFC83D),0,1.15,0.16);
var lockArc=new THREE.Mesh(new THREE.TorusGeometry(0.09,0.028,8,14,Math.PI),L(0xC9981A));
lockArc.position.set(0,1.27,0.16);doorG.add(lockArc);
var doorSignT=sign(doorG,2.6,0.6,0,3.78,0.1,0,function(x,w,h){
  var op=!!(state&&state.doorTo);
  x.fillStyle=op?'#14B8A6':'#1B2559';rr(x,4,4,w-8,h-8,26);x.fill();
  label(x,'AREA BERIKUTNYA',w/2,h*0.38,54,'#FFC83D');
  label(x,op?'MASUK ▶':'TERKUNCI',w/2,h*0.74,40,'#FFFFFF');
});
MK('shell');

// tanda dinding
MK('net');
sign(world,3.4,0.8,8.97,3.0,-4.2,-Math.PI/2,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,28);x.fill();label(x,'JARINGAN',w/2,h/2+4,70,'#5EEAFF');});
MK('tech');
sign(world,3.4,0.8,-6.5,3.2,6.97,Math.PI,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,28);x.fill();label(x,'AREA TEKNISI',w/2,h/2+4,66,'#FFC83D');});
MK('rack');
sign(world,4.6,0.8,-8.97,3.2,-1.8,Math.PI/2,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,24);x.fill();label(x,'LEMARI & RAK PERANGKAT',w/2,h/2+4,44,'#FFFFFF');});
MK('printer');
sign(world,3.2,0.8,8.97,3.0,0.2,-Math.PI/2,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,28);x.fill();label(x,'PRINTER',w/2,h/2+4,70,'#FF9A8B');});

MK('shell');
/* meja komputer */
function chair(x,z,color){
  var g=grp(world,x,0,z,0);
  cyl(g,0.06,0.06,0.5,L(0x4A5FC1),0,0.3,0,8);
  cyl(g,0.4,0.42,0.06,L(0x4A5FC1),0,0.05,0,5);
  box(g,0.7,0.1,0.65,L(color),0,0.58,0);
  box(g,0.7,0.7,0.1,L(color),0,0.98,0.3);
  addSolid(x,z,0.7,0.7);
}

function makeMonitor(parent,x,y,z,hero){
  var m=grp(parent,x,y,z,0), navy=0x2B3A67;
  box(m,0.7,0.05,0.45,L(navy),0,0.025,0);
  box(m,0.14,0.3,0.1,L(navy),0,0.2,-0.02);
  box(m,1.5,0.92,0.1,L(navy),0,0.81,0);
  box(m,1.34,0.76,0.02,L(0x131B33),0,0.83,0.055);
  plane(m,0.5,0.18,BM(0xFFFFFF,{transparent:true,opacity:0.07}),-0.3,1.0,0.069,0,0);
  box(m,0.08,0.03,0.02,BM(0xFF9F1C),0.62,0.4,0.058);
  return m;
}
function makeKeyboard(parent,x,y,z){
  var k=grp(parent,x,y,z,0);
  box(k,1.2,0.07,0.42,L(0xF2F5FD),0,0.035,0);
  plane(k,1.12,0.34,new THREE.MeshLambertMaterial({map:kbT.tex}),0,0.072,0,-Math.PI/2,0);
  return k;
}
function makeMouse(parent,x,y,z){
  var m=grp(parent,x,y,z,0);
  box(m,0.55,0.01,0.46,L(0x3B82F6),0,0.005,0.02);
  var body=sph(m,1,L(0x5CCFC6),0,0.085,0,14,10);body.scale.set(0.13,0.075,0.2);
  box(m,0.01,0.006,0.1,L(0x1B2559),0,0.152,-0.07);
  box(m,0.03,0.012,0.05,L(0x1B2559),0,0.155,-0.1);
  return m;
}
function makeCPU(parent,x,y,z){
  var c=grp(parent,x,y,z,0);
  box(c,0.5,1.1,0.8,L(0xBBD3FF),0,0.55,0);
  box(c,0.5,0.06,0.8,L(0x8FB0F2),0,1.1,0);
  box(c,0.3,0.06,0.02,L(0x2B3A67),0,0.9,0.41);
  cyl(c,0.07,0.07,0.04,L(0xFFFFFF),0,0.64,0.42,14).rotation.x=Math.PI/2;
  sph(c,0.025,BM(0x35E08A),0.14,0.64,0.42,8,6);
  box(c,0.1,0.03,0.02,L(0x2B3A67),-0.12,0.42,0.41);
  box(c,0.1,0.03,0.02,L(0x2B3A67),0.12,0.42,0.41);
  for(var i=0;i<5;i++){box(c,0.3,0.02,0.02,L(0x7C9BE0),0,0.28-i*0.05,0.41);}
  return c;
}
function makeSpeaker(parent,x,y,z){
  var s=grp(parent,x,y,z,0);
  box(s,0.36,0.58,0.32,L(0xFF7B6B),0,0.29,0);
  cyl(s,0.12,0.12,0.03,L(0x1B2559),0,0.17,0.165,16).rotation.x=Math.PI/2;
  cyl(s,0.05,0.05,0.04,L(0x5EEAFF),0,0.17,0.17,12).rotation.x=Math.PI/2;
  cyl(s,0.06,0.06,0.03,L(0x1B2559),0,0.44,0.165,14).rotation.x=Math.PI/2;
  return s;
}

function buildDesk(x,z,hero,ry,bare){
  var g=grp(world,x,0,z,ry||0), top=L(0xF3C98B), leg=0x4A5FC1;
  box(g,3,0.12,1.4,top,0,0.94,0);
  [[-1.4,-0.6],[1.4,-0.6],[-1.4,0.6],[1.4,0.6]].forEach(function(p){box(g,0.1,0.88,0.1,L(leg),p[0],0.44,p[1]);});
  box(g,2.8,0.55,0.05,L(0x5A70D6),0,0.6,-0.62);
  box(g,0.8,0.7,1.1,L(0x5A70D6),1.0,0.5,0);
  box(g,0.3,0.05,0.04,L(0xFFC83D),1.0,0.62,0.56);
  var parts={};
  parts.monitor=makeMonitor(g,0,1.0,-0.35);
  parts.keyboard=makeKeyboard(g,0,1.0,0.3);
  parts.mouse=makeMouse(g,1.0,1.0,0.3);
  parts.cpu=makeCPU(g,-1.15,1.0,-0.15);
  if(hero){parts.speaker=makeSpeaker(g,1.2,1.0,-0.3);}
  if(!bare){
    tube(g,[[0,1.04,-0.58],[-0.45,1.03,-0.64],[-0.95,1.04,-0.6],[-1.1,1.1,-0.5]],0.02,0x1B2559);
    tube(g,[[1.0,1.02,0.22],[1.0,1.02,-0.05],[0.85,1.02,-0.45],[0.4,1.02,-0.62]],0.014,0x1B2559);
  }
  addSolid(x,z,3.0,1.4);
  parts.g=g;
  return parts;
}
var chairColors=[0xFF6F59,0x14B8A6,0xFFC83D,0x7A5CFF,0xFF8FB5,0x3B82F6];
var deskX=[-4.4,0,4.4], ci=0, hero=null, otherDesks=[];
deskX.forEach(function(x,k){MK('desk'+k);otherDesks.push(buildDesk(x,-3.2,false));chair(x,-1.95,chairColors[ci++%6]);MK('shell');});
deskX.forEach(function(x,k){MK(x===0?'deskH':(k===0?'desk3':'desk4'));var p=buildDesk(x,0.6,x===0);if(x===0){hero=p;}else{otherDesks.push(p);}chair(x,1.85,chairColors[ci++%6]);MK('shell');});

function table(g,w,d,h,topColor,legColor){
  box(g,w,0.1,d,L(topColor),0,h-0.05,0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(s){box(g,0.1,h-0.1,0.1,L(legColor),s[0]*(w/2-0.1),(h-0.1)/2,s[1]*(d/2-0.1));});
}

MK('net');
/* pojok jaringan: router, switch, kabel LAN */
var netG=grp(world,7.9,0,-4.2,-Math.PI/2);
table(netG,3.2,1.2,0.9,0xFFE0A3,0x4A5FC1);
addSolid(7.9,-4.2,1.2,3.2);
var routerG=grp(netG,-0.85,0.9,0.05,0);
routerG.scale.set(1.25,1.25,1.25);
box(routerG,0.9,0.14,0.55,L(0xFFFFFF),0,0.07,0);
box(routerG,0.92,0.04,0.2,L(0x3B82F6),0,0.12,0.15);
[-1,1].forEach(function(s){
  var a=cyl(routerG,0.025,0.025,0.55,L(0x2B3A67),s*0.38,0.4,-0.2,8);a.rotation.z=-s*0.15;
  sph(routerG,0.04,L(0x2B3A67),s*0.38-s*0.04,0.67,-0.2,8,6);
});
[0x35E08A,0x35E08A,0xFFB020,0x5EEAFF].forEach(function(c,i){
  var m=BM(c);box(routerG,0.06,0.035,0.02,m,-0.25+i*0.14,0.075,0.28);
  blinkers.push({m:m,on:c,off:0x23314F,ph:rnd()*6});
});
var switchG=grp(netG,0.7,0.9,0.05,0);
box(switchG,1.3,0.14,0.5,L(0x31406E),0,0.07,0);
for(var pi=0;pi<8;pi++){
  box(switchG,0.09,0.07,0.02,L(0x0F1633),-0.5+pi*0.143,0.05,0.255);
  var lm=BM(0x35E08A);box(switchG,0.035,0.022,0.02,lm,-0.5+pi*0.143,0.115,0.255);
  blinkers.push({m:lm,on:0x35E08A,off:0x1E5B3F,ph:rnd()*6});
}
tube(netG,[[0.28,0.99,0.32],[0.1,1.0,0.52],[-0.3,1.0,0.52],[-0.58,0.99,0.4]],0.018,0xFFC83D);

MK('shell');MK('printer');
/* printer */
var prtT=grp(world,7.9,0,0.2,-Math.PI/2);
table(prtT,2.0,1.2,0.9,0xFFE0A3,0x4A5FC1);
addSolid(7.9,0.2,1.2,2.0);
var printerG=grp(prtT,0,0.9,0,0);
box(printerG,1.2,0.5,0.85,L(0xF1F3FA),0,0.25,0);
box(printerG,1.2,0.06,0.85,L(0xC7CEE8),0,0.53,0);
box(printerG,0.9,0.08,0.02,L(0x2B3A67),0,0.22,0.43);
box(printerG,0.9,0.03,0.4,L(0x9AA6C9),0,0.1,0.62);
box(printerG,0.7,0.012,0.5,L(0xFFFFFF),0,0.13,0.64);
var pf=box(printerG,0.8,0.02,0.5,L(0xFFFFFF),0,0.78,-0.3);pf.rotation.x=0.6;
box(printerG,0.42,0.04,0.2,L(0x2B3A67),0.35,0.57,0.18);
[0x35E08A,0xFFC83D,0xFF6F59].forEach(function(c,i){cyl(printerG,0.03,0.03,0.03,L(c),0.25+i*0.1,0.6,0.18,10);});

MK('shell');MK('server');
/* server */
var srvG=grp(world,8.3,0,3.6,-Math.PI/2);
box(srvG,1.1,2.6,1.2,L(0x39456F),0,1.3,0);
for(var si=0;si<7;si++){
  box(srvG,0.96,0.28,0.04,L(0x4B5A8C),0,0.3+si*0.33,0.61);
  for(var li=0;li<3;li++){
    var cc=[0x35E08A,0x5EEAFF,0xFFB020][(si+li)%3];
    var sm=BM(cc);box(srvG,0.05,0.05,0.02,sm,-0.36+li*0.1,0.3+si*0.33,0.635);
    blinkers.push({m:sm,on:cc,off:0x1B2548,ph:rnd()*6});
  }
  box(srvG,0.4,0.03,0.02,L(0x2B3A67),0.2,0.3+si*0.33,0.635);
}
addSolid(8.3,3.6,1.2,1.1);

MK('shell');MK('cab');
/* lemari dan rak perangkat */
var cabG=grp(world,-8.45,0,-3.8,Math.PI/2);
box(cabG,2.8,2.4,0.9,L(0x6FA8FF),0,1.2,0);
[-1,1].forEach(function(s){
  box(cabG,1.3,2.2,0.04,L(0x9CC6FF),s*0.68,1.2,0.46);
  box(cabG,0.06,0.45,0.06,L(0xFFC83D),s*0.14,1.2,0.5);
});
addSolid(-8.45,-3.8,0.9,2.8);

MK('rack');
var rackG=grp(world,-8.55,0,0.2,Math.PI/2);
[-1,1].forEach(function(s){box(rackG,0.08,2.5,0.7,L(0xE0A82E),s*1.56,1.25,0);});
box(rackG,3.2,2.5,0.04,L(0xF2D79A),0,1.25,-0.34);
var itemCols=[0xD9A05B,0xFF6F59,0x14B8A6,0x7A5CFF,0xFFFFFF,0x3B82F6,0xFFC83D];
for(var lv=0;lv<4;lv++){
  var ly=0.05+lv*0.7;
  box(rackG,3.2,0.06,0.7,L(0xE0A82E),0,ly,0);
  var cx=-1.45;
  while(cx<1.3){
    var iw=0.3+rnd()*0.35, ih=0.22+rnd()*0.32;
    box(rackG,iw,ih,0.3+rnd()*0.25,L(itemCols[Math.floor(rnd()*itemCols.length)]),cx+iw/2,ly+0.03+ih/2,0.02);
    cx+=iw+0.08+rnd()*0.12;
  }
}
addSolid(-8.55,0.2,0.8,3.2);

MK('tech');
/* area teknisi */
var matT=canvasTex(512,332,function(x,w,h){
  x.fillStyle='#1B2559';x.fillRect(0,0,w,h);x.fillStyle='#FFC83D';
  for(var i=-h;i<w;i+=44){x.beginPath();x.moveTo(i,0);x.lineTo(i+22,0);x.lineTo(i+22+h,h);x.lineTo(i+h,h);x.fill();}
  x.fillStyle='#FFF0B8';x.fillRect(26,26,w-52,h-52);
  label(x,'AREA TEKNISI',w/2,h/2,50,'#1B2559');
});
plane(world,4,2.6,BM(0xFFFFFF,{map:matT.tex}),-6.5,0.012,4.5,-Math.PI/2,0);
var benchG=grp(world,-6.5,0,6.35,Math.PI);
table(benchG,2.8,1.0,0.95,0xC8A06A,0x6B7BDA);
addSolid(-6.5,6.35,2.8,1.0);
var tb=box(benchG,0.7,0.3,0.35,L(0xFF4D4D),-0.8,1.1,0);
box(benchG,0.72,0.06,0.37,L(0xC93030),-0.8,1.27,0);
var handle=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.025,6,12,Math.PI),L(0x2B3A67));handle.position.set(-0.8,1.28,0);benchG.add(handle);
cyl(benchG,0.04,0.04,0.2,L(0xFFC83D),0.3,1.0,0.1,8).rotation.z=Math.PI/2;
cyl(benchG,0.012,0.012,0.22,L(0xAAB4D4),0.5,1.0,0.1,6).rotation.z=Math.PI/2;
tube(benchG,[[0.7,0.97,-0.1],[0.9,0.97,0.1],[1.1,0.97,-0.05],[0.95,0.97,-0.2]],0.02,0x3B82F6);
var pegT=canvasTex(512,280,function(x,w,h){
  x.fillStyle='#E9D8B4';x.fillRect(0,0,w,h);
  x.fillStyle='rgba(120,90,50,.35)';
  for(var i=14;i<w;i+=28){for(var j=14;j<h;j+=28){x.beginPath();x.arc(i,j,3,0,6.3);x.fill();}}
  x.lineWidth=4;x.strokeStyle='#1B2559';
  x.fillStyle='#FF6F59';rr(x,60,50,34,150,12);x.fill();x.stroke();
  x.fillStyle='#3B82F6';rr(x,140,70,120,30,12);x.fill();x.stroke();rr(x,140,120,90,30,12);x.fill();x.stroke();
  x.fillStyle='#FFC83D';rr(x,300,50,40,160,14);x.fill();x.stroke();
  x.fillStyle='#14B8A6';rr(x,390,60,70,120,16);x.fill();x.stroke();
});
plane(world,2.6,1.42,BM(0xFFFFFF,{map:pegT.tex}),-6.5,2.0,6.96,0,Math.PI);

MK('shell');
function plant(x,z){
  var g=grp(world,x,0,z,0);
  cyl(g,0.32,0.24,0.5,L(0xFF8F5A),0,0.25,0,10);
  sph(g,0.38,L(0x3CCB7F),0,0.85,0,10,8);sph(g,0.28,L(0x28B56C),0.2,1.2,0.05,10,8);sph(g,0.26,L(0x4BDB92),-0.18,1.15,-0.05,10,8);
  addSolid(x,z,0.6,0.6);
}
MK('plants');plant(8.2,6.2);plant(-8.2,6.2);plant(-8.3,-6.3);MK('shell');

world.updateMatrixWorld(true);

/* ---------- objek interaktif ---------- */
var INFO={
  monitor:{name:'Monitor',type:'PERANGKAT OUTPUT',desc:'Monitor menampilkan gambar, tulisan, dan video dari komputer.',fact:'Layar tersusun dari titik-titik kecil bernama piksel.',bot:'Lewat monitor, kita bisa melihat kerja komputer!'},
  keyboard:{name:'Keyboard',type:'PERANGKAT INPUT',desc:'Keyboard digunakan untuk mengetik huruf, angka, dan simbol.',fact:'Susunan huruf Q W E R T Y di keyboard disebut QWERTY.',bot:'Mengetik jadi mudah dengan keyboard!'},
  mouse:{name:'Mouse',type:'PERANGKAT INPUT',desc:'Mouse digunakan untuk menggerakkan pointer di layar.',fact:'Mouse pertama di dunia terbuat dari kayu.',bot:'Benar! Mouse digunakan untuk menggerakkan pointer.'},
  cpu:{name:'CPU / System Unit',type:'PERANGKAT PROSES',desc:'CPU adalah otak komputer. Di sinilah komputer berpikir dan bekerja.',fact:'Komputer bisa menghitung miliaran langkah setiap detik.',bot:'CPU itu otaknya komputer. Keren, kan?'},
  speaker:{name:'Speaker',type:'PERANGKAT OUTPUT',desc:'Speaker mengeluarkan suara, seperti musik, video, dan suara game.',fact:'Speaker mengubah sinyal listrik menjadi getaran suara.',bot:'Sekarang komputer bisa bersuara!'},
  printer:{name:'Printer',type:'PERANGKAT OUTPUT',desc:'Printer mencetak tulisan atau gambar dari komputer ke kertas.',fact:'Hasil cetak di kertas sering disebut hardcopy.',bot:'Tugas sekolah bisa dicetak dengan printer.'},
  router:{name:'Router',type:'PERANGKAT JARINGAN',desc:'Router membantu menghubungkan jaringan ke jaringan lain, seperti ke internet.',fact:'Banyak router punya antena untuk mengirim sinyal Wi-Fi.',bot:'Router membuat komputer bisa terhubung ke internet.'},
  switch:{name:'Switch',type:'PERANGKAT JARINGAN',desc:'Switch menghubungkan beberapa komputer dalam satu jaringan supaya bisa saling berkirim data.',fact:'Kabel LAN dicolokkan ke lubang yang disebut port.',bot:'Switch itu seperti terminal untuk kabel LAN.'}
};
var COUNT=8;
function spec(id,group,dy,range,extra){specs.push(Object.assign({id:id,group:group,dy:dy,range:range||3.2,counted:!!INFO[id]},INFO[id]||{},extra||{}));}
spec('monitor',hero.monitor,1.7);
spec('keyboard',hero.keyboard,0.6);
spec('mouse',hero.mouse,0.5);
spec('cpu',hero.cpu,1.5);
spec('speaker',hero.speaker,0.95);
spec('printer',printerG,1.2);
spec('router',routerG,1.15);
spec('switch',switchG,0.65);
spec('server',srvG,2.7,3.4,{counted:false,name:'Server',type:'BONUS',desc:'Server adalah komputer besar yang menyimpan data dan melayani banyak komputer lain.',fact:'Situs web yang kamu buka tersimpan di sebuah server.',bot:''});
spec('board',boardG,0,4.2,{counted:false,name:'Papan Informasi',type:'BONUS',desc:'Komputer bekerja dengan tiga langkah: Input, Proses, lalu Output.',fact:'Keyboard dan mouse adalah input. Monitor dan speaker adalah output.',bot:''});
spec('door',doorG,0,3.6,{counted:false,name:'Pintu',type:'BONUS',desc:'Pintu ini terkunci. Kenali dulu semua perangkat di lab, ya!',fact:'Area berikutnya akan terbuka di tahap selanjutnya.',bot:''});

var SECOND_DY={monitor:1.7,keyboard:0.6,mouse:0.5,cpu:1.5};
otherDesks.forEach(function(p){
  ['monitor','keyboard','mouse','cpu'].forEach(function(id){spec(id,p[id],SECOND_DY[id],2.6,{noSprite:true});});
});
var interactables=[];
specs.forEach(function(s){
  var mats=[];
  s.group.traverse(function(c){if(c.isMesh&&c.material&&c.material.emissive&&mats.indexOf(c.material)<0){mats.push(c.material);}});
  s.mats=mats;
  s.pos=new THREE.Vector3();s.group.getWorldPosition(s.pos);
  if(s.counted&&!s.noSprite){
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:qTex.tex,transparent:true}));
    sp.scale.set(0.55,0.55,0.55);
    sp.position.set(s.pos.x,s.pos.y+s.dy,s.pos.z);
    s.baseY=sp.position.y;
    scene.add(sp);s.sprite=sp;
  }
  interactables.push(s);
});

/* ---------- tas dan benda yang bisa dibawa ---------- */
function mkUSB(g){
  box(g,0.36,0.08,0.15,L(0x3B82F6),0,0.04,0);
  box(g,0.18,0.05,0.11,L(0xD3DAEC),0.26,0.04,0);
  box(g,0.04,0.02,0.05,L(0x1B2559),0.3,0.04,0);
  var lp=new THREE.Mesh(new THREE.TorusGeometry(0.045,0.014,6,12),L(0xFFC83D));lp.position.set(-0.2,0.04,0);lp.rotation.x=Math.PI/2;g.add(lp);
}
function mkCoil(g,coilC,plugC,pins){
  for(var i=0;i<3;i++){
    var t=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.032,6,18),L(coilC));
    t.position.y=0.04+i*0.06;t.rotation.x=Math.PI/2;t.castShadow=true;g.add(t);
  }
  box(g,0.16,0.1,0.1,L(plugC),0.3,0.06,0);
  for(var k=0;k<pins;k++){box(g,0.07,0.02,0.02,L(0xC8CFE3),0.4,0.06+(k-(pins-1)/2)*0.04,0);}
}
var ITEMDEFS=[
  {id:'mouse',name:'Mouse',icon:'🖱️',spot:[-2.2,-0.85],hold:1.5,build:function(g){makeMouse(g,0,0,0);}},
  {id:'usb',name:'USB Flashdisk',icon:'💾',spot:[2.2,-0.85],hold:1.9,build:mkUSB},
  {id:'keyboard',name:'Keyboard',icon:'⌨️',spot:[6.3,2.6],hold:0.6,build:function(g){makeKeyboard(g,0,0,0);}},
  {id:'power',name:'Kabel Power',icon:'🔌',spot:[-5.8,4.3],hold:1.2,build:function(g){mkCoil(g,0x2B3A67,0xFFFFFF,2);}},
  {id:'hdmi',name:'Kabel HDMI',icon:'📺',spot:[3.0,4.6],hold:1.2,build:function(g){mkCoil(g,0xFF6F59,0x1B2559,1);}},
  {id:'lan',name:'Kabel LAN',icon:'🔗',spot:[5.8,-0.85],hold:1.2,build:function(g){mkCoil(g,0x14B8A6,0x3B82F6,1);}}
];
function collectMats(g){var m=[];g.traverse(function(c){if(c.isMesh&&c.material&&c.material.emissive&&m.indexOf(c.material)<0){m.push(c.material);}});return m;}
MK('off');
var items=[];
ITEMDEFS.forEach(function(d,i){
  var g=grp(world,d.spot[0],0,d.spot[1],0);
  var model=grp(g,0,0.42,0,0);d.build(model);
  var ring=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0xFFC83D,{transparent:true,opacity:0.9,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.02;g.add(ring);
  var it={def:d,g:g,model:model,ring:ring,state:'free',got:false,ph:i*1.3};
  var o={id:'item:'+d.id,isItem:true,item:it,group:g,name:d.name,type:'BENDA',range:1.7,bias:0.6,active:true,pos:new THREE.Vector3(d.spot[0],0.5,d.spot[1]),mats:collectMats(model)};
  it.rec=o;items.push(it);interactables.push(o);
});
var crateG=grp(world,-8.1,0,4.6,Math.PI/2);
(function(){
  var wood=L(0xD9A05B), band=L(0x3B82F6);
  box(crateG,1.1,0.08,1.0,wood,0,0.04,0);
  box(crateG,1.1,0.55,0.08,wood,0,0.3,0.46);
  box(crateG,1.1,0.55,0.08,wood,0,0.3,-0.46);
  box(crateG,0.08,0.55,1.0,wood,0.51,0.3,0);
  box(crateG,0.08,0.55,1.0,wood,-0.51,0.3,0);
  box(crateG,1.14,0.07,0.12,band,0,0.58,0.46);
  box(crateG,1.14,0.07,0.12,band,0,0.58,-0.46);
  sign(crateG,0.98,0.3,0,0.3,0.51,0,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,22);x.fill();label(x,'KOTAK PERANGKAT',w/2,h/2+3,50,'#FFC83D');});
})();
addSolid(-8.1,4.6,1.0,1.1);
var crateRec={id:'crate',isCrate:true,group:crateG,name:'Kotak Perangkat',type:'TEMPAT',range:2.5,bias:0.3,active:true,pos:new THREE.Vector3(-8.1,0.4,4.6),mats:collectMats(crateG)};
interactables.push(crateRec);
MK('shell');
items.forEach(function(it){it.g.visible=false;it.rec.active=false;});crateRec.active=false;
var CRATE_SLOTS=[[-0.28,-0.2],[0,-0.2],[0.28,-0.2],[-0.28,0.2],[0,0.2],[0.28,0.2]];

function heldItem(){return state.inv[state.sel];}
function hitsSolid(x,z,r){
  for(var i=0;i<solids.length;i++){var s=solids[i];if(s.layer&&!((areaMask>>s.layer)&1)){continue;}if(x>s.x0-r&&x<s.x1+r&&z>s.z0-r&&z<s.z1+r){return true;}}
  return false;
}
function refreshInv(){
  var slots=document.querySelectorAll('#inv .slot'), n=0;
  for(var i=0;i<slots.length;i++){
    var it=state.inv[i], sl=slots[i];
    if(it){n++;}
    sl.querySelector('.si').textContent=it?it.def.icon:'';
    sl.querySelector('.sl').textContent=it?it.def.name:'';
    sl.className='slot'+(i===state.sel?' sel':'');
  }
  $('#inv-n').textContent=n+'/3';
  var AIL=allItems();for(var j=0;j<AIL.length;j++){if(AIL[j].state==='held'){AIL[j].g.visible=(AIL[j]===state.inv[state.sel]);}}
  $('#drop-btn').hidden=!heldItem();
  lastPrompt=null;
  if(typeof updateGoal==='function'&&state.mode==='play'){updateGoal();}
}
function selectSlot(i){
  if(state.mode!=='play'||state.panelOpen){return;}
  state.sel=i;refreshInv();sfx.open();
}
function pickUp(o){
  var it=o.item, idx=state.inv.indexOf(null);
  if(idx<0){say('Tasmu penuh! Tekan Q untuk meletakkan satu benda dulu.');sfx.close();return;}
  state.inv[idx]=it;state.sel=idx;it.state='held';o.active=false;it.ring.visible=false;
  kid.root.add(it.g);
  it.g.position.set(0,1.1,0.55);it.g.rotation.set(0,0,0);it.g.scale.setScalar(it.def.hold);
  it.model.position.y=0;it.model.rotation.y=0;it.model.scale.setScalar(1);
  if(!it.got){it.got=true;addXP(10);}
  sfx.reward();
  state.pickN++;
  say(state.pickN===1?'Kamu membawa '+it.def.name+'! Tekan Q untuk meletakkan':'Kamu membawa '+it.def.name+'.');
  refreshInv();
}
function dropActive(){
  if(state.mode!=='play'||state.panelOpen){return;}
  var it=heldItem();if(!it){return;}
  if(it.l5){resetCable(it);}
  var fx=Math.sin(kidFace), fz=Math.cos(kidFace), x=pos.x, z=pos.z;
  for(var d=0.95;d>=0;d-=0.25){
    var tx=clamp(pos.x+fx*d,-8.3,8.3), tz=clamp(pos.z+fz*d,-6.3,6.3);
    if(!hitsSolid(tx,tz,0.3)){x=tx;z=tz;break;}
  }
  scene.add(it.g);
  it.g.position.set(x,0,z);it.g.rotation.set(0,0,0);it.g.scale.setScalar(1);it.g.visible=true;
  it.ring.visible=true;it.state='free';it.model.scale.setScalar(it.def.fs||1);
  it.rec.active=true;it.rec.pos.set(x,0.5,z);
  state.inv[state.sel]=null;
  sfx.close();refreshInv();
}
function useCrate(){
  var it=heldItem();
  if(!it){say('Ini Kotak Perangkat. Ambil benda berkilau, lalu tekan E di sini untuk memasukkannya.');return;}
  if(it.def.l2){say('Komponen ini dipakai untuk merakit komputer. Bawa ke Meja Rakit!');return;}
  if(it.def.l3){say('Perangkat ini dipakai untuk Level 3. Bawa ke area INPUT, PROSES, atau OUTPUT!');return;}
  if(it.def.l5){say('Kabel LAN ini dipakai untuk jaringan. Bawa ke pojok JARINGAN!');return;}
  if(it.def.l8){say('Benda ini dipakai untuk Misi Besar. Bawa ke komputer di meja belakang kanan!');return;}
  state.inv[state.sel]=null;
  var slot=CRATE_SLOTS[state.placed%CRATE_SLOTS.length];
  state.placed++;it.state='placed';
  crateG.add(it.g);
  it.g.position.set(slot[0],0.1,slot[1]);it.g.rotation.set(0,0,0);it.g.scale.setScalar(it.def.hold*0.45);it.g.visible=true;
  for(var i=0;i<3;i++){if(state.inv[i]){state.sel=i;break;}}
  addXP(20);sfx.reward();
  var left=items.length-state.placed;
  refreshInv();updateMission();
  if(left===0&&!state.trainDone){
    state.trainDone=true;
    setTimeout(function(){
      addXP(30,1);sfx.reward();confetti();updateMission();
      var t=$('#toast');
      t.innerHTML='<div class="t-card card"><div class="t-k">LATIHAN · KOTAK PERANGKAT</div><h2>BAGUS SEKALI!</h2><p>Kamu sudah bisa mengambil, membawa, dan meletakkan perangkat.</p><p>+30 XP · ⭐ +1</p></div>';
      t.hidden=false;setTimeout(hideToast,6000);
      say('Siap! Di level berikutnya kita akan merakit komputer.');
    },700);
    say('Semua perangkat sudah masuk kotak!');
  }else{
    say('Bagus! '+it.def.name+' masuk ke kotak. Tinggal '+left+' benda lagi!');
  }
}
Array.prototype.forEach.call(document.querySelectorAll('#inv .slot'),function(b){
  b.addEventListener('mousedown',function(e){e.preventDefault();});
  b.addEventListener('click',function(){selectSlot(+b.getAttribute('data-i'));});
});
$('#drop-btn').addEventListener('mousedown',function(e){e.preventDefault();});
$('#drop-btn').addEventListener('click',dropActive);

/* ---------- level 2: meja rakit ---------- */
MK('asm');
var l2items=[];
var L2DEFS=[
  {id:'monitor',name:'Monitor',icon:'🖥️',spot:[-3.0,3.4],hold:0.5,fs:0.55,l2:true,build:function(g){makeMonitor(g,0,0,0);}},
  {id:'keyboard',name:'Keyboard',icon:'⌨️',spot:[-6.2,1.9],hold:0.6,l2:true,build:function(g){makeKeyboard(g,0,0,0);}},
  {id:'mouse',name:'Mouse',icon:'🖱️',spot:[-6.4,-0.85],hold:1.5,l2:true,build:function(g){makeMouse(g,0,0,0);}},
  {id:'power',name:'Kabel Power',icon:'🔌',spot:[-1.5,5.8],hold:1.2,l2:true,build:function(g){mkCoil(g,0x2B3A67,0xFFFFFF,2);}},
  {id:'hdmi',name:'Kabel HDMI',icon:'📺',spot:[7.4,4.7],hold:1.2,l2:true,build:function(g){mkCoil(g,0xFF6F59,0x1B2559,1);}},
  {id:'usbcable',name:'Kabel USB',icon:'🔗',spot:[-7.8,2.6],hold:1.2,l2:true,build:function(g){mkCoil(g,0x7A5CFF,0xC8CFE3,1);}}
];
function allItems(){return items.concat(l2items,l3items,l5items,l8items);}
L2DEFS.forEach(function(d,i){
  var g=grp(world,d.spot[0],0,d.spot[1],0);
  var model=grp(g,0,0.42,0,0);d.build(model);model.scale.setScalar(d.fs||1);
  var ring=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0x14B8A6,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.02;g.add(ring);
  var it={def:d,g:g,model:model,ring:ring,state:'free',got:false,ph:i*1.1+0.5};
  var o={id:'l2item:'+d.id,isItem:true,item:it,group:g,name:d.name,type:'KOMPONEN',range:1.7,bias:0.6,active:false,pos:new THREE.Vector3(d.spot[0],0.5,d.spot[1]),mats:collectMats(model)};
  g.visible=false;it.rec=o;l2items.push(it);interactables.push(o);
});
function labelSprite(parent,text,x,y,z,w){
  var t=canvasTex(256,64,function(c,cw,ch){c.fillStyle='#1B2559';rr(c,3,3,cw-6,ch-6,18);c.fill();label(c,text,cw/2,ch/2+2,text.length>10?26:34,'#FFFFFF');});
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t.tex,transparent:true,depthTest:false}));
  sp.scale.set(w,w/4,1);sp.position.set(x,y,z);sp.renderOrder=9;sp.visible=false;parent.add(sp);return sp;
}
var asmG=grp(world,5.3,0,5.4,Math.PI), deskG=grp(asmG,0,0,0,0);
(function(){
  box(deskG,3,0.12,1.4,L(0xF3C98B),0,0.94,0);
  [[-1.4,-0.6],[1.4,-0.6],[-1.4,0.6],[1.4,0.6]].forEach(function(q){box(deskG,0.1,0.88,0.1,L(0x4A5FC1),q[0],0.44,q[1]);});
  box(deskG,2.8,0.55,0.05,L(0x5A70D6),0,0.6,-0.62);
  box(deskG,0.8,0.7,1.1,L(0x5A70D6),1.0,0.5,0);
  box(deskG,0.3,0.05,0.04,L(0xFFC83D),1.0,0.62,0.56);
})();
addSolid(5.3,5.4,3.0,1.4);
var ghostMat=BM(0x14B8A6,{transparent:true,opacity:0.35});
function ghostBox(w,h,d,x,y,z){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),ghostMat);m.position.set(x,y,z);m.visible=false;asmG.add(m);return m;}
var ghosts={monitor:ghostBox(1.5,0.95,0.12,0,1.5,-0.35),keyboard:ghostBox(1.2,0.07,0.42,0,1.04,0.3),mouse:ghostBox(0.42,0.1,0.36,1.0,1.06,0.3)};
var glabels={monitor:labelSprite(asmG,'MONITOR',0,2.2,-0.35,0.9),keyboard:labelSprite(asmG,'KEYBOARD',0,1.4,0.3,0.9),mouse:labelSprite(asmG,'MOUSE',1.0,1.4,0.3,0.7)};
var cpuG=makeCPU(asmG,-1.15,1.0,-0.15);
var cpuLabel=labelSprite(asmG,'CPU: PASANG KABEL',-1.15,2.05,-0.15,1.5);
box(world,0.22,0.22,0.06,L(0xFFFFFF),6.9,0.4,6.96);
box(world,0.05,0.07,0.02,L(0x1B2559),6.85,0.42,6.925);
box(world,0.05,0.07,0.02,L(0x1B2559),6.95,0.42,6.925);
var asmSignT=canvasTex(512,128,function(x,w,h){
  var open=!!(state&&state.stageDone);
  x.fillStyle=open?'#14B8A6':'#1B2559';rr(x,4,4,w-8,h-8,26);x.fill();
  label(x,'MEJA RAKIT',w/2,h*0.4,60,'#FFFFFF');
  label(x,open?'LEVEL 2 · RAKIT KOMPUTER':'LEVEL 2 · TERKUNCI',w/2,h*0.78,30,open?'#FFF3C9':'#FFC83D');
});
plane(world,2.6,0.65,BM(0xFFFFFF,{map:asmSignT.tex}),5.3,3.2,6.95,0,Math.PI);
var asmRec={id:'asm',isAsm:true,group:deskG,name:'Meja Rakit',type:'TEMPAT',range:3.3,bias:0.2,active:true,pos:new THREE.Vector3(5.3,1.0,5.4),mats:collectMats(deskG)};
var cpuRec={id:'cpu-rakit',isCpu:true,group:cpuG,name:'CPU Meja Rakit',type:'TEMPAT',range:2.6,bias:0.25,active:true,pos:new THREE.Vector3(6.45,1.0,5.55),mats:collectMats(cpuG)};
interactables.push(asmRec,cpuRec);
var asmArrow=new THREE.Sprite(new THREE.SpriteMaterial({map:arrowTex.tex,transparent:true,depthTest:false}));
asmArrow.scale.set(0.9,0.9,0.9);asmArrow.position.set(5.3,3.7,5.4);asmArrow.renderOrder=10;asmArrow.visible=false;scene.add(asmArrow);

var asmParts={}, boot={active:false,t:0,last:0}, scr={p:-1};
var bootT=canvasTex(512,320,function(x,w,h){
  var p=scr.p;
  if(p<0){x.fillStyle='#131B33';x.fillRect(0,0,w,h);return;}
  if(p<0.2){
    x.fillStyle='#05070F';x.fillRect(0,0,w,h);x.fillStyle='#9FE8B8';
    x.font='700 24px monospace';x.textAlign='left';x.textBaseline='alphabetic';
    x.fillText('KOMP-BIOS v1.0',24,44);x.fillText('Memeriksa memori ... OK',24,80);x.fillText('Mencari disk ... OK',24,116);
    if(Math.floor(p*40)%2===0){x.fillRect(24,134,14,24);}
    return;
  }
  if(p<1){
    var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#2B3A8F');g.addColorStop(1,'#14B8A6');x.fillStyle=g;x.fillRect(0,0,w,h);
    label(x,'KOMP-OS',w/2,h*0.36,78,'#FFFFFF');
    var k=(p-0.2)/0.8;
    x.fillStyle='rgba(255,255,255,.3)';rr(x,96,196,320,24,12);x.fill();
    x.fillStyle='#FFC83D';rr(x,96,196,Math.max(24,320*k),24,12);x.fill();
    label(x,'Memuat... '+Math.round(k*100)+'%',w/2,256,28,'#FFFFFF');
    return;
  }
  var g2=x.createLinearGradient(0,0,0,h);g2.addColorStop(0,'#8EDBFF');g2.addColorStop(1,'#DDF6FF');x.fillStyle=g2;x.fillRect(0,0,w,h);
  label(x,'Selamat datang di Lab Komputer!',w/2,70,34,'#1B2559');
  label(x,'Komputer berhasil dirakit',w/2,114,28,'#0C7A6F');
  [['#FF6F59','Tulis'],['#FFC83D','Gambar'],['#14B8A6','Main']].forEach(function(ic,i){
    var ix=96+i*120;x.fillStyle=ic[0];rr(x,ix,150,72,72,16);x.fill();x.lineWidth=4;x.strokeStyle='#1B2559';x.stroke();
    label(x,ic[1],ix+36,246,24,'#1B2559');
  });
  x.fillStyle='#1B2559';x.fillRect(0,h-36,w,36);label(x,'SYSTEM ONLINE',w/2,h-18,22,'#5EEAFF');
});
var CABLE_PORT={power:'power',hdmi:'hdmi',usbcable:'usb'};
var COMP_KINDS=['monitor','keyboard','mouse'];
var KIND_NAMES={monitor:'Monitor',keyboard:'Keyboard',mouse:'Mouse',power:'Kabel Power',hdmi:'Kabel HDMI',usbcable:'Kabel USB'};
var OK_MSG={
  monitor:'Bagus! Monitor sudah terpasang. Monitor menampilkan gambar.',
  keyboard:'Bagus! Keyboard sudah terpasang.',
  mouse:'Bagus! Mouse sudah terpasang.',
  power:'Bagus! Kabel power sudah terpasang. Ia mengalirkan listrik.',
  hdmi:'Bagus! Kabel monitor sudah terpasang. HDMI mengirim gambar ke layar.',
  usbcable:'Bagus! Kabel USB sudah terpasang.'
};
var PORT_HINT={power:'Port POWER punya dua lubang pipih dan satu lubang bulat.',hdmi:'Port HDMI berbentuk datar dengan sudut miring.',usb:'Port USB berbentuk persegi panjang kecil.'};
var PORTS=[
  {id:'power',label:'POWER',svg:'<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="4" y="4" width="56" height="40" rx="12" fill="#2B3A67"/><rect x="17" y="12" width="7" height="15" rx="2" fill="#FFC83D"/><rect x="40" y="12" width="7" height="15" rx="2" fill="#FFC83D"/><circle cx="32" cy="35" r="4" fill="#FFC83D"/></svg>'},
  {id:'hdmi',label:'HDMI',svg:'<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 8h52v18l-8 14H14L6 26z" fill="#2B3A67"/><rect x="16" y="16" width="32" height="7" rx="2" fill="#FF6F59"/></svg>'},
  {id:'usb',label:'USB',svg:'<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="6" y="10" width="52" height="28" rx="5" fill="#2B3A67"/><rect x="12" y="20" width="40" height="8" rx="2" fill="#7A5CFF"/></svg>'}
];
function startLevel2(){
  state.l2Active=true;state.level=2;updateStats();
  l2items.forEach(function(it){it.g.visible=true;it.rec.active=true;});
  asmSignT.redraw();updateMission();
}
function installComp(kind){
  if(kind==='monitor'){var m=makeMonitor(asmG,0,1.0,-0.35);plane(m,1.3,0.72,BM(0xFFFFFF,{map:bootT.tex}),0,0.83,0.068,0,0);asmParts.monitor=layerWalk(m,AREA_L.asm);}
  else if(kind==='keyboard'){asmParts.keyboard=layerWalk(makeKeyboard(asmG,0,1.0,0.3),AREA_L.asm);}
  else if(kind==='mouse'){asmParts.mouse=layerWalk(makeMouse(asmG,1.0,1.0,0.3),AREA_L.asm);}
  ghosts[kind].visible=false;glabels[kind].visible=false;
}
function addCable(kind){
  var c={
    power:[0x1B2559,[[6.45,1.15,6.12],[6.5,0.95,6.5],[6.55,0.55,6.8],[6.83,0.42,6.93]]],
    hdmi:[0xFF6F59,[[6.45,1.5,6.1],[6.1,1.68,6.1],[5.6,1.52,5.95],[5.3,1.36,5.85]]],
    usbcable:[0x7A5CFF,[[6.2,1.3,5.15],[5.95,1.06,5.0],[5.65,1.045,4.98],[5.4,1.045,5.08]]]
  }[kind];
  layerWalk(tube(world,c[1],0.03,c[0]),AREA_L.asm);
}
function afterInstall(it,kind){
  state.inv[state.sel]=null;it.state='installed';it.g.visible=false;
  for(var i=0;i<3;i++){if(state.inv[i]){state.sel=i;break;}}
  state.l2in[kind]=true;state.l2n++;
  addXP(20);sfx.reward();refreshInv();updateMission();
  if(state.l2n>=6){startBoot();}
  else{say(OK_MSG[kind]+' Tinggal '+(6-state.l2n)+' lagi!');}
}
function startBoot(){
  boot.active=true;boot.t=0;boot.last=0;scr.p=0;bootT.redraw();
  [262,330,392,523].forEach(function(f,i){tone(f,i*0.18,0.3);});
  say('Semua komponen terpasang! Komputer mulai menyala...',true);
  updateMission();
}
function finishLevel2(){
  state.l2Done=true;state.levelsDone[2]=true;
  addXP(100,1);sfx.reward();confetti();updateMission();
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 2 · MERAKIT KOMPUTER</div><h2>MISSION COMPLETE</h2><p>Komputer menyala! Kamu berhasil merakit komputer sendiri.</p><p>+100 XP · ⭐ +1</p><p>🔓 Level 3: Input, Proses, Output terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(3);
}
function useAsm(){
  if(!state.stageDone){say('Level 2 masih terkunci. Selesaikan Level 1 dulu, ya!');return;}
  if(state.l2Done||boot.active){say('Komputer ini sudah menyala!');return;}
  var it=heldItem();
  if(!it){
    var miss=[];Object.keys(KIND_NAMES).forEach(function(k){if(!state.l2in[k]){miss.push(KIND_NAMES[k]);}});
    say('Meja Rakit masih butuh: '+miss.join(', ')+'.');return;
  }
  var k=it.def.id;
  if(COMP_KINDS.indexOf(k)>=0){
    if(state.l2in[k]){say(KIND_NAMES[k]+' sudah terpasang. Cari komponen lain.');return;}
    installComp(k);afterInstall(it,k);
  }else if(CABLE_PORT[k]){
    say('Belum tepat. Kabel dipasang di port belakang CPU. Dekati CPU lalu tekan E.');sfx.close();
  }else{
    say('Belum tepat. '+it.def.name+' tidak dipakai untuk merakit komputer.');sfx.close();
  }
}
function useCpu(){
  if(!state.stageDone){say('Level 2 masih terkunci. Selesaikan Level 1 dulu, ya!');return;}
  if(state.l2Done||boot.active){say('Komputer ini sudah menyala!');return;}
  var it=heldItem();
  if(!it){say('Ini CPU. Bawa kabel ke sini, lalu pilih port yang cocok.');return;}
  var k=it.def.id;
  if(CABLE_PORT[k]){
    if(state.l2in[k]){say(KIND_NAMES[k]+' sudah terpasang.');return;}
    openPort(it);
  }else if(COMP_KINDS.indexOf(k)>=0){
    say('Belum tepat. '+it.def.name+' dipasang di atas meja, bukan di CPU.');sfx.close();
  }else if(k==='lan'){
    say('Kabel LAN dipakai untuk jaringan. Kita pakai nanti!');
  }else{
    say('Belum tepat. Coba cari port yang sesuai.');sfx.close();
  }
}
function buildPort(){
  var box=$('#ports');box.textContent='';
  PORTS.forEach(function(pt,i){
    var kind=pt.id==='usb'?'usbcable':pt.id;
    var b=document.createElement('button');b.type='button';
    b.className='portb'+(state.l2in[kind]?' done':'');
    b.setAttribute('data-p',pt.id);
    b.innerHTML=pt.svg+'<span>'+pt.label+'</span><small>tekan '+(i+1)+'</small>';
    b.addEventListener('click',function(){choosePort(i);});
    box.appendChild(b);
  });
}
function openPort(it){
  state.panelOpen=true;state.portOpen=true;state.portWrong=0;unlock();
  buildPort();
  $('#port-sub').textContent='Kamu membawa: '+it.def.name+'. Pilih port yang cocok di belakang CPU.';
  var m=$('#port-msg');m.textContent='';m.className='port-msg';
  $('#port').hidden=false;$('#prompt').hidden=true;lastPrompt=null;sfx.open();
}
function closePort(){
  state.panelOpen=false;state.portOpen=false;$('#port').hidden=true;sfx.close();idleT=0;
}
function choosePort(i){
  if(!state.portOpen){return;}
  var pt=PORTS[i];if(!pt){return;}
  var it=heldItem();if(!it){closePort();return;}
  var kind=it.def.id, want=CABLE_PORT[kind], msg=$('#port-msg');
  if(want===pt.id){
    closePort();addCable(kind);afterInstall(it,kind);
  }else{
    state.portWrong++;sfx.close();
    msg.className='port-msg bad';msg.textContent='Belum tepat. Coba cari port yang sesuai.';
    say('Belum tepat. Coba cari port yang sesuai.');
    if(state.portWrong>=2){
      msg.textContent+=' Petunjuk: '+PORT_HINT[want];
      Array.prototype.forEach.call($('#ports').children,function(b){if(b.getAttribute('data-p')===want){b.className='portb hl';}});
    }
  }
}
$('#port-close').addEventListener('click',closePort);
$('#port').addEventListener('click',function(e){if(e.target===this){closePort();}});

/* ---------- level 3: input, proses, output ---------- */
MK('l3');
var l3items=[];
function mkPrinter(g){
  box(g,1.2,0.5,0.85,L(0xF1F3FA),0,0.25,0);
  box(g,1.2,0.06,0.85,L(0xC7CEE8),0,0.53,0);
  box(g,0.9,0.08,0.02,L(0x2B3A67),0,0.22,0.43);
  box(g,0.9,0.03,0.4,L(0x9AA6C9),0,0.1,0.62);
  box(g,0.7,0.012,0.5,L(0xFFFFFF),0,0.13,0.64);
  var pf=box(g,0.8,0.02,0.5,L(0xFFFFFF),0,0.78,-0.3);pf.rotation.x=0.6;
}
var L3DEFS=[
  {id:'l3-keyboard',name:'Keyboard',icon:'⌨️',zone:'input',hold:0.6,l3:true,build:function(g){makeKeyboard(g,0,0,0);},ok:'Keyboard memasukkan huruf dan angka ke komputer.',hint:'Benda ini dipakai untuk mengetik, yaitu memasukkan data.'},
  {id:'l3-mouse',name:'Mouse',icon:'🖱️',zone:'input',hold:1.5,l3:true,build:function(g){makeMouse(g,0,0,0);},ok:'Mouse memasukkan perintah gerak pointer ke komputer.',hint:'Benda ini kita gerakkan dengan tangan untuk memberi perintah.'},
  {id:'l3-cpu',name:'CPU',icon:'🧠',zone:'proc',hold:0.6,fs:0.5,l3:true,build:function(g){makeCPU(g,0,0,0);},ok:'CPU memproses data. Ia otak komputer.',hint:'Benda ini berpikir dan mengolah data.'},
  {id:'l3-monitor',name:'Monitor',icon:'🖥️',zone:'out',hold:0.5,fs:0.55,l3:true,build:function(g){makeMonitor(g,0,0,0);},ok:'Monitor menampilkan hasil kerja komputer.',hint:'Benda ini menampilkan gambar dan tulisan, yaitu hasil kerja.'},
  {id:'l3-speaker',name:'Speaker',icon:'🔊',zone:'out',hold:1.2,l3:true,build:function(g){makeSpeaker(g,0,0,0);},ok:'Speaker mengeluarkan suara, hasil kerja komputer.',hint:'Benda ini mengeluarkan suara.'},
  {id:'l3-printer',name:'Printer',icon:'🖨️',zone:'out',hold:0.5,fs:0.5,l3:true,build:mkPrinter,ok:'Printer mencetak hasil kerja ke kertas.',hint:'Benda ini mencetak hasil ke kertas.'}
];
var L3SPOTS=[[-4.4,-0.85],[0,-0.85],[4.4,-0.85],[-5.0,3.0],[1.2,3.1],[4.6,3.3],[-7.3,-1.9],[0.3,6.1],[2.6,6.1],[-3.0,5.6]];
L3DEFS.forEach(function(d,i){
  var g=grp(world,0,0,0,0);
  var model=grp(g,0,0.42,0,0);d.build(model);model.scale.setScalar(d.fs||1);
  var ring=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0x7A5CFF,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.02;g.add(ring);
  var it={def:d,g:g,model:model,ring:ring,state:'free',got:false,ph:i*0.9+0.2,wrongN:0};
  var o={id:'l3item:'+d.id,isItem:true,item:it,group:g,name:d.name,type:'PERANGKAT',range:1.7,bias:0.6,active:false,pos:new THREE.Vector3(0,0.5,0),mats:collectMats(model)};
  g.visible=false;it.rec=o;l3items.push(it);interactables.push(o);
});
var ZONES={
  input:{label:'INPUT',sub:'memasukkan data',color:0x14B8A6,x:-4.0},
  proc:{label:'PROSES',sub:'mengolah data',color:0xFFC83D,x:0},
  out:{label:'OUTPUT',sub:'menampilkan hasil',color:0xFF6F59,x:4.0}
};
Object.keys(ZONES).forEach(function(k){
  var z=ZONES[k], zg=grp(world,z.x,0,-5.6,0);
  z.g=zg;z.padMat=L(z.color);
  box(zg,2.6,0.08,1.9,z.padMat,0,0.04,0);
  var tx=canvasTex(256,192,function(x,w,h){
    x.fillStyle='rgba(255,255,255,.9)';rr(x,10,10,w-20,h-20,22);x.fill();
    label(x,z.label,w/2,h*0.42,k==='proc'?50:56,'#1B2559');
    label(x,z.sub,w/2,h*0.76,22,'#5A6AA8');
  });
  plane(zg,2.3,1.7,BM(0xFFFFFF,{map:tx.tex}),0,0.092,0,-Math.PI/2,0);
  z.flashMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.9),BM(0x22CC66,{transparent:true,opacity:0}));
  z.flashMesh.rotation.x=-Math.PI/2;z.flashMesh.position.y=0.1;zg.add(z.flashMesh);
  z.l1=labelSprite(zg,z.label,0,1.75,0,1.5);
  z.l2=labelSprite(zg,z.sub,0,1.4,0,1.3);
  z.pop=new THREE.Sprite(new THREE.SpriteMaterial({map:okTex.tex,transparent:true,depthTest:false}));
  z.pop.scale.set(0.6,0.6,0.6);z.pop.visible=false;z.pop.renderOrder=10;zg.add(z.pop);
  z.flash=0;z.shake=0;z.popT=0;z.n=0;
  z.rec={id:'zone-'+k,isZone:true,zone:k,group:zg,name:'Area '+z.label,type:'AREA',range:2.4,bias:0.3,active:true,pos:new THREE.Vector3(z.x,0.4,-5.6),mats:[z.padMat]};
  interactables.push(z.rec);
});
var l3Arrow=new THREE.Sprite(new THREE.SpriteMaterial({map:arrowTex.tex,transparent:true,depthTest:false}));
l3Arrow.scale.set(0.9,0.9,0.9);l3Arrow.position.set(0,3.4,-5.6);l3Arrow.renderOrder=10;l3Arrow.visible=false;scene.add(l3Arrow);
MK('shell');

function startLevel3(){
  state.l3Active=true;state.level=3;updateStats();
  var pool=L3SPOTS.slice().sort(function(){return Math.random()-0.5;});
  l3items.forEach(function(it,i){
    var sp=pool[i];
    it.g.position.set(sp[0],0,sp[1]);it.rec.pos.set(sp[0],0.5,sp[1]);
    it.g.visible=true;it.rec.active=true;
  });
  Object.keys(ZONES).forEach(function(k){ZONES[k].l1.visible=true;ZONES[k].l2.visible=true;});
  updateMission();
}
function flashZone(z,ok){
  z.flashMesh.material.color.setHex(ok?0x22CC66:0xFF3030);
  z.flash=0.8;
  if(ok){z.popT=1;}else{z.shake=0.45;}
}
function sortItem(it,z){
  state.inv[state.sel]=null;it.state='sorted';
  var idx=z.n++;
  z.g.add(it.g);
  it.g.position.set((idx-1)*0.85,0,0.05);it.g.rotation.set(0,0,0);it.g.scale.setScalar(1);it.g.visible=true;
  it.model.position.y=0.12;it.model.rotation.y=0;it.model.scale.setScalar(it.def.fs||1);
  it.ring.visible=false;
  z.pop.position.x=(idx-1)*0.85;
  for(var i=0;i<3;i++){if(state.inv[i]){state.sel=i;break;}}
  state.l3n++;
  flashZone(z,true);addXP(20);sfx.reward();refreshInv();updateMission();
  var left=6-state.l3n;
  if(left===0){say('Benar! '+it.def.ok+' Semua perangkat sudah di tempat yang benar!',true);setTimeout(finishLevel3,900);}
  else{say('Benar! '+it.def.ok+' Tinggal '+left+' lagi!');}
}
function useZone(rec){
  if(!state.l2Done){say('Level 3 masih terkunci. Selesaikan Level 2 dulu, ya!');return;}
  if(state.l3Done){say('Kamu sudah memilah semua perangkat. Hebat!');return;}
  var z=ZONES[rec.zone], it=heldItem();
  if(!it){say('Ini area '+z.label+' ('+z.sub+'). Bawa perangkat ke sini, lalu tekan E.');return;}
  if(!it.def.l3){say('Benda ini bukan bagian Level 3. Letakkan dengan Q, lalu ambil perangkat bercincin ungu.');sfx.close();return;}
  if(it.def.zone===rec.zone){sortItem(it,z);}
  else{
    it.wrongN++;sfx.close();flashZone(z,false);
    say(it.wrongN>=2?'Belum tepat. Petunjuk: '+it.def.hint:'Belum tepat. Apakah '+it.def.name+' memasukkan, mengolah, atau menampilkan data?');
  }
}
function finishLevel3(){
  state.l3Done=true;state.levelsDone[3]=true;
  addXP(30);sfx.reward();confetti();updateMission();
  setTimeout(function(){addXP(100,1);},600);
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 3 · INPUT, PROSES, OUTPUT</div><h2>MISSION COMPLETE</h2><p>Kamu memilah semua perangkat dengan benar!</p><p>+130 XP · ⭐ +1</p><p>🔓 Level 4: Teknisi Komputer terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(4);
}

/* ---------- level 4: teknisi komputer ---------- */
var svc={built:false,n:0,cause:null,found:false,fixed:false,checkedN:0,busy:false,scr:'off',p:0,pt:0,idle:0,blink:0,list:[],byId:{}};
var SVX=-0.5, SVZ=4.7;
function SW(lx,ly,lz){return new THREE.Vector3(SVX-lx,ly,SVZ-lz);}
function winBar(x,w,title){
  x.fillStyle='#FFFFFF';rr(x,28,22,w-56,262,18);x.fill();x.lineWidth=4;x.strokeStyle='#1B2559';x.stroke();
  x.fillStyle='#14B8A6';rr(x,28,22,w-56,44,18);x.fill();x.stroke();
  label(x,title,w/2,45,26,'#FFFFFF');
}
function drawSvc(x,w,h){
  var s=svc.scr, p=svc.p;
  x.textAlign='center';x.textBaseline='middle';
  if(s==='off'){x.fillStyle='#131B33';x.fillRect(0,0,w,h);return;}
  if(s==='nosignal'){
    x.fillStyle='#0A1A3A';x.fillRect(0,0,w,h);
    label(x,'TIDAK ADA SINYAL',w/2,h*0.42,50,'#5EEAFF');
    label(x,'Kabel monitor belum terhubung',w/2,h*0.62,26,'#B9C6F0');return;
  }
  if(s==='boot'){
    if(p<0.25){
      x.fillStyle='#05070F';x.fillRect(0,0,w,h);x.fillStyle='#9FE8B8';
      x.font='700 24px monospace';x.textAlign='left';x.textBaseline='alphabetic';
      x.fillText('KOMP-BIOS v1.0',24,44);x.fillText('Memeriksa memori ... OK',24,80);x.fillText('Mencari disk ... OK',24,116);
      return;
    }
    var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#2B3A8F');g.addColorStop(1,'#14B8A6');x.fillStyle=g;x.fillRect(0,0,w,h);
    var k=Math.min(1,(p-0.25)/0.75);
    label(x,'KOMP-OS',w/2,h*0.36,78,'#FFFFFF');
    x.fillStyle='rgba(255,255,255,.3)';rr(x,96,196,320,24,12);x.fill();
    x.fillStyle='#FFC83D';rr(x,96,196,Math.max(24,320*k),24,12);x.fill();
    label(x,'Memuat... '+Math.round(k*100)+'%',w/2,256,28,'#FFFFFF');return;
  }
  if(s==='desk'){
    var g2=x.createLinearGradient(0,0,0,h);g2.addColorStop(0,'#8EDBFF');g2.addColorStop(1,'#DDF6FF');x.fillStyle=g2;x.fillRect(0,0,w,h);
    label(x,'Komputer menyala lagi!',w/2,80,40,'#1B2559');
    label(x,'Masalah sudah diperbaiki',w/2,128,28,'#0C7A6F');
    [['#FF6F59','Tulis'],['#FFC83D','Gambar'],['#14B8A6','Main']].forEach(function(ic,i){
      var ix=96+i*120;x.fillStyle=ic[0];rr(x,ix,170,72,72,16);x.fill();x.lineWidth=4;x.strokeStyle='#1B2559';x.stroke();
      label(x,ic[1],ix+36,268,24,'#1B2559');
    });
    return;
  }
  if(s==='kbbad'||s==='kbok'){
    x.fillStyle='#CFE6FF';x.fillRect(0,0,w,h);
    winBar(x,w,'Menulis');
    label(x,'Ketik sapaanmu di sini:',w/2,104,30,'#1B2559');
    x.fillStyle='#F1F4FC';rr(x,56,134,w-112,66,14);x.fill();x.lineWidth=3;x.strokeStyle='#1B2559';x.stroke();
    if(s==='kbok'){
      x.textAlign='left';x.font='800 34px '+FONT;x.fillStyle='#1B2559';x.fillText('Halo KOMP-BOT!',78,168);x.textAlign='center';
    }else if(svc.blink){x.fillStyle='#1B2559';x.fillRect(80,146,5,42);}
    x.fillStyle=s==='kbok'?'#14B8A6':'#FF6F59';rr(x,56,218,w-112,50,25);x.fill();x.stroke();
    label(x,s==='kbok'?'Keyboard berfungsi!':'Keyboard tidak merespons',w/2,244,28,'#FFFFFF');
    return;
  }
  if(s==='spbad'||s==='spok'){
    var ok=s==='spok';
    x.fillStyle='#2B1F5C';x.fillRect(0,0,w,h);
    label(x,'Lagu Ceria',w/2,50,32,'#FFC83D');
    x.fillStyle='#FFFFFF';rr(x,150,120,36,60,6);x.fill();
    x.beginPath();x.moveTo(184,120);x.lineTo(238,86);x.lineTo(238,214);x.lineTo(184,180);x.closePath();x.fill();
    x.lineCap='round';
    if(ok){
      x.strokeStyle='#5EEAFF';x.lineWidth=9;
      [28,52,76].forEach(function(r){x.beginPath();x.arc(238,150,r,-0.8,0.8);x.stroke();});
    }else{
      x.strokeStyle='#FF6F59';x.lineWidth=12;
      x.beginPath();x.moveTo(280,116);x.lineTo(340,184);x.moveTo(340,116);x.lineTo(280,184);x.stroke();
    }
    label(x,ok?'Suara terdengar!':'Tidak ada suara',w/2,262,32,ok?'#7CF2B5':'#FF9A8B');
    return;
  }
  if(s==='all'){
    var g3=x.createLinearGradient(0,0,0,h);g3.addColorStop(0,'#2B3A8F');g3.addColorStop(1,'#14B8A6');x.fillStyle=g3;x.fillRect(0,0,w,h);
    label(x,'SEMUA MASALAH TERATASI',w/2,60,36,'#FFFFFF');
    ['Monitor menyala','Keyboard berfungsi','Speaker bersuara'].forEach(function(t,i){
      var cy=124+i*56;
      x.fillStyle='#FFC83D';x.beginPath();x.arc(120,cy,20,0,Math.PI*2);x.fill();x.lineWidth=4;x.strokeStyle='#1B2559';x.stroke();
      x.lineWidth=6;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(110,cy);x.lineTo(118,cy+9);x.lineTo(132,cy-9);x.stroke();
      x.textAlign='left';x.font='800 30px '+FONT;x.fillStyle='#FFFFFF';x.fillText(t,160,cy+2);x.textAlign='center';
    });
  }
}
var svcT=canvasTex(512,320,drawSvc);
function drawSvcSign(x,w,h){
  var done=!!(state&&state.l4Done), n=svc.n, c=(!done&&CASES)?CASES[n]:null;
  x.fillStyle=done?'#14B8A6':'#1B2559';rr(x,4,4,w-8,h-8,26);x.fill();
  label(x,'MEJA SERVIS',w/2,h*0.36,56,'#FFFFFF');
  label(x,done?'LEVEL 4 · SELESAI':(c?'KASUS '+(n+1)+' · '+c.short:'LEVEL 4 · TEKNISI'),w/2,h*0.76,28,'#FFC83D');
}
var svcSignT=canvasTex(512,128,drawSvcSign);

function plugMesh(parent,col,p){
  var g=grp(parent,p[0],p[1],p[2],0);
  box(g,0.11,0.08,0.08,L(col),0,0,0);
  box(g,0.05,0.05,0.06,L(0xC8CFE3),0.075,0,0);
  return g;
}
function cableCP(parent,okPts,badPts,col,plugCol){
  var okG=grp(parent,0,0,0,0), badG=grp(parent,0,0,0,0);
  tube(okG,okPts,0.028,col);tube(badG,badPts,0.028,col);
  plugMesh(okG,plugCol,okPts[okPts.length-1]);plugMesh(badG,plugCol,badPts[badPts.length-1]);
  return {root:parent,setBad:function(v){okG.visible=!v;badG.visible=v;},groups:[okG,badG]};
}
function buttonCP(parent,p,ry,badColor){
  var g=grp(parent,p[0],p[1],p[2],ry);
  box(g,0.16,0.16,0.03,L(0x2B3A67),0,0,0);
  cyl(g,0.05,0.05,0.04,L(0xE9EEFF),0,0,0.03,12).rotation.x=Math.PI/2;
  var led=BM(0x35E08A);box(g,0.04,0.025,0.02,led,0,0.115,0.01);
  return {setBad:function(v){led.color.setHex(v?badColor:0x35E08A);},groups:[g]};
}
function knobCP(parent,p){
  var g=grp(parent,p[0],p[1],p[2],0), kn=grp(g,0,0,0,0);
  cyl(g,0.075,0.075,0.02,L(0x2B3A67),0,0,0,16).rotation.x=Math.PI/2;
  cyl(kn,0.05,0.05,0.05,L(0xE9EEFF),0,0,0.03,14).rotation.x=Math.PI/2;
  box(kn,0.016,0.045,0.02,L(0xFF6F59),0,0.028,0.058);
  return {setBad:function(v){kn.rotation.z=v?2.4:-0.5;},groups:[g]};
}
function clipCP(parent,p){
  var g=grp(parent,p[0],p[1],p[2],0);
  var a=new THREE.Mesh(new THREE.TorusGeometry(0.1,0.014,6,14),L(0x3B82F6));a.rotation.x=-Math.PI/2;a.scale.set(1.5,1,1);a.castShadow=true;g.add(a);
  var b=new THREE.Mesh(new THREE.TorusGeometry(0.07,0.014,6,14),L(0x3B82F6));b.rotation.x=-Math.PI/2;b.position.set(0.1,0.01,0.03);b.scale.set(1.4,1,1);b.castShadow=true;g.add(b);
  sph(g,0.035,L(0xC98A4B),-0.18,0.01,0.08,8,6);sph(g,0.028,L(0xC98A4B),0.26,0.01,-0.07,8,6);
  return {setBad:function(v){g.visible=v;},groups:[g]};
}

var CPDEF={
  power:{name:'Kabel Power',act:'Colokkan',ok:'Kabel power terpasang kuat di stop kontak.',bad:'Masalah ditemukan! Kabel power terlepas dari stop kontak, jadi listrik tidak mengalir.',fix:'Bagus! Kabel power sudah dicolokkan. Listrik mengalir lagi.',pos:[-1.15,0.35,-1.3]},
  hdmi:{name:'Kabel Monitor',act:'Pasang',ok:'Kabel monitor (HDMI) terpasang kuat.',bad:'Masalah ditemukan! Kabel monitor terlepas, jadi gambar tidak sampai ke layar.',fix:'Bagus! Kabel monitor sudah terpasang. Gambar bisa tampil lagi.',pos:[-0.5,1.4,-0.5]},
  mbtn:{name:'Tombol Power Monitor',act:'Nyalakan',ok:'Tombol power monitor menyala hijau.',bad:'Masalah ditemukan! Tombol power monitor mati. Lampunya merah.',fix:'Bagus! Monitor sudah dinyalakan.',pos:[0.55,1.4,-0.45]},
  usb:{name:'Kabel Keyboard',act:'Colokkan',ok:'Kabel keyboard terpasang di port USB.',bad:'Masalah ditemukan! Kabel keyboard terlepas dari port USB.',fix:'Bagus! Kabel keyboard sudah dipasang di port USB.',pos:[-0.6,1.1,0.12]},
  key:{name:'Tombol Keyboard',act:'Bersihkan',ok:'Semua tombol keyboard bergerak lancar.',bad:'Masalah ditemukan! Ada klip kertas yang menyangkut di antara tombol.',fix:'Bagus! Klip kertas sudah dibuang. Tombol bisa ditekan lagi.',pos:[0.3,1.1,0.32]},
  restart:{name:'Tombol Restart',act:'Restart',ok:'Komputer berjalan lancar, tidak perlu di-restart.',bad:'Masalah ditemukan! Komputer sedang macet. Ia perlu di-restart.',fix:'Bagus! Komputer sudah di-restart dan keyboard bekerja lagi.',pos:[-1.3,1.75,0.27]},
  audio:{name:'Kabel Audio',act:'Pasang',ok:'Kabel audio terpasang kuat di speaker.',bad:'Masalah ditemukan! Kabel audio terlepas dari speaker.',fix:'Bagus! Kabel audio sudah dipasang. Suara bisa mengalir ke speaker.',pos:[0.5,1.25,-0.62]},
  vol:{name:'Volume Speaker',act:'Naikkan',ok:'Volume speaker sudah cukup keras.',bad:'Masalah ditemukan! Volume speaker diputar sampai paling kecil.',fix:'Bagus! Volume speaker sudah dinaikkan.',pos:[1.29,1.08,-0.1]},
  spwr:{name:'Tombol Power Speaker',act:'Nyalakan',ok:'Speaker sudah menyala. Lampunya hijau.',bad:'Masalah ditemukan! Speaker belum dinyalakan. Lampunya merah.',fix:'Bagus! Speaker sudah dinyalakan.',pos:[1.3,1.12,-0.47]}
};
var CASES=[
  {id:'monitor',short:'MONITOR GELAP',title:'Monitor tidak menyala',points:['power','hdmi','mbtn'],
    intro:'Layar monitor ini gelap! Periksa bagian bertanda ?: kabel power, kabel monitor, dan tombol power. Kabel ada di belakang meja.',
    screen:function(c){return c==='hdmi'?'nosignal':'off';}},
  {id:'keyboard',short:'KEYBOARD MATI',title:'Keyboard tidak berfungsi',points:['usb','key','restart'],
    intro:'Sekarang keyboard tidak berfungsi! Tombol ditekan, tapi tulisan tidak muncul. Periksa bagian bertanda ?.',
    screen:function(){return 'kbbad';}},
  {id:'speaker',short:'SPEAKER BISU',title:'Speaker tidak bersuara',points:['audio','vol','spwr'],
    intro:'Terakhir: speaker tidak bersuara! Periksa kabel audio, volume, dan tombol power speaker.',
    screen:function(){return 'spbad';}}
];

function buildService(){
  if(svc.built){return;}
  svc.built=true;
  var P=buildDesk(SVX,SVZ,true,Math.PI,true), g=P.g;
  plane(P.monitor,1.3,0.72,BM(0xFFFFFF,{map:svcT.tex}),0,0.83,0.068,0,0);svc.mon=P.monitor;
  /* stop kontak di dinding */
  var op=SW(-1.15,0.45,-2.26);
  box(world,0.3,0.3,0.05,L(0xFFFFFF),op.x,op.y,6.96);
  box(world,0.04,0.09,0.02,L(0x1B2559),op.x-0.06,op.y+0.02,6.925);box(world,0.04,0.09,0.02,L(0x1B2559),op.x+0.06,op.y+0.02,6.925);
  plane(world,2.6,0.65,BM(0xFFFFFF,{map:svcSignT.tex}),SVX,3.2,6.95,0,Math.PI);
  /* port di belakang CPU */
  [1.35,1.25,1.15,1.05].forEach(function(py,i){box(g,0.1,0.05,0.02,L(0x2B3A67),-1.15+(i%2?0.1:-0.1),py+(i>1?-0.18:0),-0.555);});
  var vis={};
  vis.power=cableCP(g,
    [[-1.15,1.25,-0.57],[-1.15,1.1,-0.8],[-1.15,0.5,-0.85],[-1.15,0.06,-1.3],[-1.15,0.08,-1.9],[-1.15,0.4,-2.2]],
    [[-1.15,1.25,-0.57],[-1.15,1.1,-0.8],[-1.15,0.5,-0.85],[-1.15,0.06,-1.3],[-0.85,0.05,-1.6]],0x1B2559,0xFFFFFF);
  vis.hdmi=cableCP(g,
    [[-1.0,1.55,-0.57],[-0.8,1.7,-0.6],[-0.45,1.6,-0.5],[-0.25,1.42,-0.43]],
    [[-1.0,1.55,-0.57],[-0.8,1.7,-0.6],[-0.6,1.1,-0.5],[-0.45,1.03,-0.2]],0xFF6F59,0x1B2559);
  vis.mbtn=buttonCP(P.monitor,[0.55,0.4,-0.06],Math.PI,0xFF4D4D);
  vis.usb=cableCP(g,
    [[-0.58,1.05,0.12],[-0.7,1.06,0.14],[-0.85,1.25,0.16],[-0.91,1.35,0.12]],
    [[-0.58,1.05,0.12],[-0.7,1.06,0.14],[-0.76,1.03,0.3],[-0.7,1.03,0.45]],0x7A5CFF,0xC8CFE3);
  vis.key=clipCP(g,[0.3,1.1,0.32]);
  vis.restart=buttonCP(P.cpu,[-0.1,0.78,0.42],0,0xFFB020);
  vis.audio=cableCP(g,
    [[-0.95,1.4,-0.58],[-0.4,1.2,-0.62],[0.4,1.2,-0.62],[0.95,1.3,-0.55],[1.1,1.4,-0.48]],
    [[-0.95,1.4,-0.58],[-0.4,1.2,-0.62],[0.4,1.2,-0.62],[0.7,1.05,-0.6],[0.85,1.03,-0.5]],0x14B8A6,0x3B82F6);
  vis.vol=knobCP(P.speaker,[0.09,0.08,0.19]);
  vis.spwr=buttonCP(P.speaker,[0.1,0.15,-0.17],Math.PI,0xFF4D4D);
  Object.keys(CPDEF).forEach(function(id,i){
    var d=CPDEF[id], v=vis[id], wp=SW(d.pos[0],d.pos[1],d.pos[2]);
    var mats=[];v.groups.forEach(function(gg){collectMats(gg).forEach(function(m){if(mats.indexOf(m)<0){mats.push(m);}});});
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:qTex.tex,transparent:true,depthTest:false}));
    sp.scale.set(0.5,0.5,0.5);sp.renderOrder=9;sp.visible=false;
    sp.position.set(wp.x,Math.max(wp.y+0.55,1.95),wp.z);scene.add(sp);
    var cp={id:id,def:d,vis:v,sprite:sp,baseY:sp.position.y,st:'new',ph:i*0.8,inCase:false};
    cp.rec={id:'cp:'+id,isCheck:true,cp:cp,group:g,name:d.name,type:'PERIKSA',range:1.3,bias:0.5,active:false,pos:wp,mats:mats};
    interactables.push(cp.rec);svc.list.push(cp);svc.byId[id]=cp;
    v.setBad(false);
  });
  svc.arrow=new THREE.Sprite(new THREE.SpriteMaterial({map:arrowTex.tex,transparent:true,depthTest:false}));
  svc.arrow.scale.set(0.9,0.9,0.9);svc.arrow.position.set(SVX,3.5,SVZ);svc.arrow.renderOrder=10;svc.arrow.visible=false;scene.add(svc.arrow);
}
function setScreen(m){svc.scr=m;svc.p=0;svc.pt=0;svcT.redraw();}
function startLevel4(){
  var _m=snap();buildService();claim('l4',_m);
  state.l4Active=true;state.level=4;updateStats();
  if(hitsSolid(pos.x,pos.z,R)){pos.z=3.2;vel.set(0,0,0);}
  startCase(0,true);
}
function startCase(n,silent){
  var c=CASES[n];
  svc.n=n;svc.busy=false;svc.found=false;svc.fixed=false;svc.checkedN=0;svc.idle=0;
  svc.cause=c.points[Math.floor(Math.random()*c.points.length)];
  svc.list.forEach(function(cp){
    var inCase=c.points.indexOf(cp.id)>=0;
    cp.inCase=inCase;cp.st='new';cp.rec.active=inCase;
    cp.vis.setBad(inCase&&cp.id===svc.cause);
    cp.sprite.visible=inCase;
  });
  setScreen(c.screen(svc.cause));
  svcSignT.redraw();
  lastPrompt=null;
  updateMission();
  if(!silent){say(c.intro);}
}
function useCheck(rec){
  var cp=rec.cp, c=CASES[svc.n];
  if(!state.l4Active||state.l4Done){return;}
  if(svc.busy){say('Tunggu sebentar, komputer sedang bekerja...');return;}
  svc.idle=0;lastPrompt=null;
  if(cp.st==='bad'){
    cp.vis.setBad(false);cp.st='fixed';svc.fixed=true;svc.busy=true;
    addXP(30);sfx.reward();say(cp.def.fix);
    if(c.id==='monitor'){setScreen('boot');[262,330,392,523].forEach(function(f,i){tone(f,0.3+i*0.18,0.3);});}
    else if(c.id==='keyboard'){setScreen('kbok');}
    else{setScreen('spok');[523,659,784,659,523,784].forEach(function(f,i){tone(f,0.2+i*0.2,0.25,'square',0.07);});}
    updateMission();
    setTimeout(caseSolved,c.id==='monitor'?3800:3000);
  }else if(cp.st==='new'){
    svc.checkedN++;
    if(cp.id===svc.cause){
      cp.st='bad';svc.found=true;addXP(20);sfx.reward();
      say(cp.def.bad+' Tekan E lagi untuk memperbaikinya.');
    }else{
      cp.st='ok';addXP(10);sfx.open();
      say(cp.def.ok+' Bukan ini penyebabnya.');
    }
    updateMission();
  }else{
    say(cp.def.name+' sudah diperiksa dan normal. Periksa bagian lain, ya!');
  }
}
function caseSolved(){
  var n=svc.n;
  svc.list.forEach(function(cp){cp.rec.active=false;cp.sprite.visible=false;});
  state.l4n=n+1;
  lastPrompt=null;
  if(n<CASES.length-1){
    var d=document.createElement('div');d.className='bpop';d.textContent='✓ Kasus '+(n+1)+' selesai!';
    app.appendChild(d);setTimeout(function(){d.remove();},3700);
    updateMission();
    say('Komputer pulih! Tapi tunggu... ada masalah baru.');
    svc.busy=true;
    setTimeout(function(){startCase(n+1);},2600);
  }else{finishLevel4();}
}
function finishLevel4(){
  state.l4Done=true;state.levelsDone[4]=true;
  setScreen('all');svcSignT.redraw();
  addXP(100,1);sfx.reward();confetti();awardBadge('tech');updateMission();
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 4 · TEKNISI KOMPUTER</div><h2>MISSION COMPLETE</h2><p>Kamu menemukan penyebab dan memperbaiki 3 masalah komputer!</p><div class="t-badge">🏆 Junior Technician</div><p>+100 XP · ⭐ +1</p><p>🔓 Level 5: Jaringan Komputer terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(5);
}
function caseTags(){
  return CASES.map(function(c,i){return {t:c.short.charAt(0)+c.short.slice(1).toLowerCase(),ok:i<state.l4n,cur:i===svc.n&&!state.l4Done};});
}
function pointTags(){
  var c=CASES[svc.n];
  return c.points.map(function(id){var cp=svc.byId[id];return {t:CPDEF[id].name,ok:cp.st==='ok'||cp.st==='fixed',cur:cp.st==='bad'};});
}

/* ---------- level 5: jaringan komputer ---------- */
MK('l5');
var l5items=[];
var nw={built:false,ports:{},links:{},tubes:{},lp:{},broken:false,nLinks:0,wrongN:0,idle:0,done:false,lineM:null,arrow:null};
var NCHAIN={pc:0,sw:1,rt:2,net:3};
var NLINK={
  'pc-sw':{name:'PC → Switch',ok:'Bagus! PC terhubung ke Switch. Switch menghubungkan beberapa komputer dalam satu jaringan.'},
  'sw-rt':{name:'Switch → Router',ok:'Bagus! Switch terhubung ke Router. Router membantu menghubungkan jaringan ke jaringan lain.'},
  'rt-net':{name:'Router → Internet',ok:'Bagus! Router terhubung ke Internet.'}
};
var NPORTS={
  pc:{dev:'pc',name:'Port LAN di PC',label:'PC',p:[3.37,1.5,-2.93],face:'z'},
  sw1:{dev:'sw',name:'Port Switch',label:'SWITCH',p:[7.52,0.96,-3.14],face:'x'},
  sw2:{dev:'sw',name:'Port Switch',label:'SWITCH',p:[7.52,0.96,-3.86],face:'x'},
  rt1:{dev:'rt',name:'Port Router',label:'ROUTER',p:[7.45,0.99,-4.7],face:'x'},
  rt2:{dev:'rt',name:'Port Router',label:'ROUTER',p:[7.45,0.99,-5.4],face:'x'},
  net:{dev:'net',name:'Colokan Internet',label:'INTERNET',p:[8.73,1.0,-6.3],face:'x'}
};
var DEVNAME={pc:'PC',sw:'Switch',rt:'Router',net:'Internet'};
function drawNet(x,w,h){
  var l=nw.links, all=!!nw.done;
  x.textAlign='center';x.textBaseline='middle';
  var g=x.createLinearGradient(0,0,0,h);
  if(all){g.addColorStop(0,'#14B8A6');g.addColorStop(1,'#2B3A8F');}else{g.addColorStop(0,'#2B3A8F');g.addColorStop(1,'#131B33');}
  x.fillStyle=g;x.fillRect(0,0,w,h);
  label(x,all?'CONNECTED':'BELUM TERHUBUNG',w/2,56,all?66:40,all?'#FFFFFF':'#FFC83D');
  var xs=[64,192,320,448], nm=['PC','SWITCH','ROUTER','INTERNET'], ks=['pc-sw','sw-rt','rt-net'];
  for(var i=0;i<3;i++){
    var on=!!l[ks[i]];
    x.lineWidth=on?10:6;x.strokeStyle=on?'#7CF2B5':'#6E7BB0';x.lineCap='round';
    x.setLineDash(on?[]:[10,10]);
    x.beginPath();x.moveTo(xs[i]+42,176);x.lineTo(xs[i+1]-42,176);x.stroke();
  }
  x.setLineDash([]);
  for(var j=0;j<4;j++){
    var lit=(j>0&&l[ks[j-1]])||(j<3&&l[ks[j]]);
    x.fillStyle=lit?'#FFC83D':'#DCE4F7';rr(x,xs[j]-42,138,84,76,16);x.fill();
    x.lineWidth=4;x.strokeStyle='#1B2559';x.setLineDash([]);x.stroke();
    label(x,nm[j],xs[j],176,j===3?17:20,'#1B2559');
  }
  label(x,all?'Internet siap dipakai!':'Pasang kabel LAN dari PC sampai Internet',w/2,262,all?30:24,all?'#FFFFFF':'#B9C6F0');
}
var netT=canvasTex(512,320,drawNet);
var L5SPOTS=[[-4.4,-0.85],[0,-0.85],[4.4,-0.85],[-5.0,3.0],[2.4,2.9],[-7.3,-1.9],[2.6,5.9],[-3.2,2.8],[6.4,1.4]];
[1,2,3].forEach(function(n,i){
  var d={id:'l5-lan'+n,name:'Kabel LAN',icon:'🔗',hold:1.2,l5:true,build:function(g){mkCoil(g,0x14B8A6,0x3B82F6,1);}};
  var g=grp(world,0,0,0,0);
  var model=grp(g,0,0.42,0,0);d.build(model);
  var ring=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0x3B82F6,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.02;g.add(ring);
  var it={def:d,g:g,model:model,ring:ring,state:'free',got:false,ph:i*1.2+0.4,l5:{end:null}};
  var o={id:'l5item:'+n,isItem:true,item:it,group:g,name:d.name,type:'KABEL',range:1.7,bias:0.6,active:false,pos:new THREE.Vector3(0,0.5,0),mats:collectMats(model)};
  g.visible=false;it.rec=o;l5items.push(it);interactables.push(o);
});
MK('shell');
function setNetLine(a,b){
  var dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,len=Math.sqrt(dx*dx+dy*dy+dz*dz)||0.001;
  nw.lineM.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  nw.lineM.scale.set(1,len,1);
  nw.lineM.quaternion.setFromUnitVectors(nw.up,new THREE.Vector3(dx/len,dy/len,dz/len));
}
function buildNetwork(){
  if(nw.built){return;}
  nw.built=true;
  layerWalk(plane(otherDesks[2].monitor,1.3,0.72,BM(0xFFFFFF,{map:netT.tex}),0,0.83,0.068,0,0),AREA_L.desk2);
  nw.up=new THREE.Vector3(0,1,0);
  nw.lineM=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,1,6),L(0x14B8A6));
  nw.lineM.visible=false;scene.add(nw.lineM);
  /* colokan Internet di dinding */
  var ig=grp(world,8.86,1.25,-6.3,0);
  box(ig,0.2,0.7,0.8,L(0x2B3A67),0,0,0);
  sph(ig,0.28,L(0x3B9BFF),-0.12,0.66,0,14,10);
  sph(ig,0.1,L(0x3CCB7F),-0.34,0.72,0.1,8,6);sph(ig,0.09,L(0x3CCB7F),-0.3,0.6,-0.12,8,6);
  labelSprite(scene,'INTERNET',8.5,2.35,-6.3,1.3).visible=true;
  /* access point */
  var ap=grp(world,8.86,2.7,-1.7,0);
  cyl(ap,0.34,0.34,0.08,L(0xFFFFFF),0,0,0,18).rotation.z=Math.PI/2;
  sph(ap,0.2,L(0xEAF6FF),-0.1,0,0,12,8);
  box(ap,0.03,0.06,0.06,BM(0x35E08A),-0.28,0.08,0);
  labelSprite(scene,'ACCESS POINT',8.5,3.4,-1.7,1.5).visible=true;
  var apRec={id:'ap',group:ap,name:'Access Point',type:'PERANGKAT JARINGAN',desc:'Access Point membagi sinyal Wi-Fi supaya laptop dan tablet bisa ikut terhubung tanpa kabel.',fact:'Wi-Fi adalah sambungan jaringan tanpa kabel.',bot:'',range:2.6,bias:0,active:true,pos:new THREE.Vector3(8.8,1.4,-1.7),mats:collectMats(ap)};
  interactables.push(apRec);
  /* port */
  Object.keys(NPORTS).forEach(function(id){
    var d=NPORTS[id], g=grp(world,d.p[0],d.p[1],d.p[2],0), z=d.face==='z';
    box(g,z?0.2:0.04,0.14,z?0.04:0.2,L(0x14B8A6),0,0,0);
    box(g,z?0.13:0.05,0.08,z?0.05:0.13,L(0x131B33),z?0:-0.005,0,z?0.005:0);
    var plug=grp(g,z?0:-0.07,0,z?0.07:0,0);
    box(plug,0.1,0.08,0.08,L(0x3B82F6),0,0,0);
    plug.visible=false;
    var sp=labelSprite(scene,d.label,d.p[0]+(z?0:-0.1),d.p[1]+0.42,d.p[2],0.75);sp.visible=true;
    var wp=new THREE.Vector3(d.p[0],d.p[1],d.p[2]);
    var pt={id:id,def:d,plug:plug,occ:null,label:sp};
    pt.rec={id:'port:'+id,isNetPort:true,pid:id,group:g,name:d.name,type:'PORT',range:1.3,bias:1.2,active:false,pos:wp,mats:collectMats(g)};
    nw.ports[id]=pt;interactables.push(pt.rec);
  });
  nw.arrow=new THREE.Sprite(new THREE.SpriteMaterial({map:arrowTex.tex,transparent:true,depthTest:false}));
  nw.arrow.scale.set(0.9,0.9,0.9);nw.arrow.position.set(7.9,3.2,-4.3);nw.arrow.renderOrder=10;nw.arrow.visible=false;scene.add(nw.arrow);
}
function startLevel5(){
  var _m=snap();buildNetwork();claim('l5',_m);
  state.l5Active=true;state.level=5;updateStats();
  var pool=L5SPOTS.slice().sort(function(){return Math.random()-0.5;});
  l5items.forEach(function(it,i){
    var sp=pool[i];
    it.g.position.set(sp[0],0,sp[1]);it.rec.pos.set(sp[0],0.5,sp[1]);
    it.g.visible=true;it.rec.active=true;
  });
  Object.keys(nw.ports).forEach(function(k){nw.ports[k].rec.active=true;});
  netT.redraw();
  updateMission();
}
function resetCable(it){
  var c=it.l5;
  if(c&&c.end){var pt=nw.ports[c.end];pt.occ=null;pt.plug.visible=false;c.end=null;}
}
function netPath(key,a,b){
  var A=a.def.p,B=b.def.p;
  if(key==='pc-sw'){return [A,[A[0],1.06,-2.7],[4.5,1.04,-2.62],[5.7,1.04,-2.65],[6.1,0.5,-2.8],[6.5,0.06,-3.0],[6.9,0.06,B[2]],[7.3,0.7,B[2]],B];}
  if(key==='sw-rt'){return [A,[7.3,1.04,A[2]+(B[2]-A[2])/3],[7.3,1.04,A[2]+2*(B[2]-A[2])/3],B];}
  return [A,[7.25,0.9,A[2]-0.1],[7.2,0.4,-5.95],[7.9,0.1,-6.35],[8.5,0.3,-6.35],B];
}
function netHint(){
  var ks=['pc-sw','sw-rt','rt-net'];
  for(var i=0;i<3;i++){if(!nw.links[ks[i]]){return 'Petunjuk: hubungkan '+NLINK[ks[i]].name+' dulu.';}}
  return '';
}
function netWrong(da,db){
  if(da===db){return 'Belum tepat. Satu kabel harus menghubungkan dua perangkat yang berbeda.';}
  var s=[da,db].sort().join('-');
  if(s==='net-pc'){return 'Belum tepat. PC tidak langsung ke Internet. Lewat Switch dan Router dulu.';}
  if(s==='pc-rt'){return 'Belum tepat. PC harus ke Switch dulu, baru ke Router.';}
  if(s==='net-sw'){return 'Belum tepat. Switch tidak langsung ke Internet. Lewat Router dulu.';}
  return 'Belum tepat. Ingat urutannya: PC → Switch → Router → Internet.';
}
function useNetPort(rec){
  var pt=nw.ports[rec.pid], it=heldItem();
  if(!state.l4Done){say('Level 5 masih terkunci. Selesaikan Level 4 dulu, ya!');return;}
  if(nw.done){say('Jaringan sudah tersambung. Hebat!');return;}
  if(!it){say(pt.def.name+'. Ambil kabel LAN bercincin biru, lalu colokkan di sini.');return;}
  if(!it.def.l5){say('Ini bukan kabel LAN. Cari kabel LAN bercincin biru.');sfx.close();return;}
  if(pt.occ){say('Port ini sudah terpasang kabel. Pilih port lain.');sfx.close();return;}
  var c=it.l5;nw.idle=0;
  if(!c.end){
    c.end=pt.id;pt.occ=it;pt.plug.visible=true;sfx.open();lastPrompt=null;
    say('Satu ujung kabel terpasang. Bawa ujung satunya ke perangkat berikutnya!');
    return;
  }
  var a=nw.ports[c.end], da=a.def.dev, db=pt.def.dev;
  var diff=Math.abs(NCHAIN[da]-NCHAIN[db]);
  var key=NCHAIN[da]<NCHAIN[db]?da+'-'+db:db+'-'+da;
  if(diff!==1||nw.links[key]){
    resetCable(it);nw.wrongN++;sfx.close();lastPrompt=null;
    var m=diff===1?'Sambungan ini sudah ada.':netWrong(da,db);
    if(nw.wrongN>=2){m+=' '+netHint();}
    say(m);return;
  }
  var first=NCHAIN[da]<NCHAIN[db]?a:pt, second=first===a?pt:a;
  pt.plug.visible=true;pt.occ=it;
  nw.tubes[key]=layerWalk(tube(world,netPath(key,first,second),0.03,0x14B8A6),AREA_L.l5);nw.lp[key]=[first.id,second.id];
  nw.links[key]=true;nw.nLinks++;c.end=null;
  state.inv[state.sel]=null;it.state='installed';it.g.visible=false;
  for(var i=0;i<3;i++){if(state.inv[i]){state.sel=i;break;}}
  addXP(20);sfx.reward();refreshInv();netT.redraw();updateMission();
  if(nw.nLinks>=3){
    nw.done=true;netT.redraw();
    if(state.l5Done){l8NetFixed();return;}
    say('Jaringan tersambung! Data dari PC mengalir lewat Switch dan Router sampai ke Internet.',true);
    setTimeout(finishLevel5,1300);
  }else{say(NLINK[key].ok+' Tinggal '+(3-nw.nLinks)+' sambungan lagi!');}
}
function finishLevel5(){
  state.l5Done=true;state.levelsDone[5]=true;
  addXP(30);sfx.reward();confetti();awardBadge('net');updateMission();
  setTimeout(function(){addXP(100,1);},600);
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 5 · JARINGAN KOMPUTER</div><h2>MISSION COMPLETE</h2><p>PC sudah terhubung ke Internet lewat Switch dan Router!</p><div class="t-badge">🏆 Network Explorer</div><p>+130 XP · ⭐ +1</p><p>🔓 Level 6: Keamanan Komputer terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(6);
}
function linkTags(){
  return ['pc-sw','sw-rt','rt-net'].map(function(k){return {t:NLINK[k].name,ok:!!nw.links[k],cur:false};});
}

/* ---------- level 6: keamanan digital ---------- */
var SITS=[
  {id:'usb',short:'Flashdisk',name:'Flashdisk di Lantai',bot:'Flashdisk ini bukan milik kita. Apa yang sebaiknya dilakukan?',
   opts:[{t:'Colokkan ke komputer',bad:'Jangan! Flashdisk asing bisa membawa virus ke komputer sekolah.'},
         {t:'Berikan kepada guru',safe:true},
         {t:'Bawa pulang',bad:'Itu bukan milikmu. Pemiliknya mungkin mencarinya, dan isinya bisa berbahaya.'}],
   ok:'Pilihan aman! Guru akan mencari pemiliknya dan memeriksa flashdisk itu dengan aman.'},
  {id:'phish',short:'Pesan hadiah',name:'Pesan Hadiah di Layar',bot:'Ada pesan: kamu menang HP gratis! Kamu disuruh klik tautan dan menulis password. Apa yang kamu lakukan?',
   opts:[{t:'Klik tautan dan tulis password',bad:'Jangan! Pesan hadiah seperti ini biasanya penipuan untuk mencuri password.'},
         {t:'Tutup pesan dan beri tahu guru',safe:true},
         {t:'Kirim pesan ini ke teman',bad:'Jangan disebar! Temanmu bisa tertipu juga.'}],
   ok:'Pilihan aman! Pesan hadiah yang meminta password itu penipuan. Menutupnya dan melapor sudah tepat.'},
  {id:'pass',short:'Password',name:'Membuat Password',bot:'Kamu membuat password baru untuk akunmu. Password mana yang paling aman?',
   opts:[{t:'12345',str:0.1,bad:'Terlalu mudah ditebak. Orang lain bisa menebaknya dalam sekejap.'},
         {t:'budi2015',str:0.3,bad:'Nama dan tahun lahir mudah ditebak orang lain.'},
         {t:'Kp7#Lm29',str:1,safe:true}],
   ok:'Pilihan aman! Password kuat memakai huruf besar, angka, dan simbol, dan tidak memakai namamu. Jangan beri tahu siapa pun!'},
  {id:'chat',short:'Chat orang asing',name:'Chat dengan Orang Asing',bot:'Orang yang tidak kamu kenal meminta alamat rumah dan fotomu lewat chat. Apa yang kamu lakukan?',
   opts:[{t:'Kirim alamat rumahku',bad:'Jangan! Orang asing tidak boleh tahu alamat rumahmu.'},
         {t:'Jangan kirim, ceritakan ke guru atau orang tua',safe:true},
         {t:'Kirim fotoku saja',bad:'Jangan! Foto pribadi juga tidak boleh dikirim ke orang asing.'}]
   ,ok:'Pilihan aman! Jangan beri data pribadi ke orang asing, dan ceritakan ke orang dewasa yang kamu percaya.'}
];
var SIT={};SITS.forEach(function(q){q.scr='base';q.solved=false;q.seen=false;q.wrong=0;SIT[q.id]=q;});
var sec={built:false,nSolved:0,nSeen:0,wrongN:0,idle:0,cur:null,fly:null,shake:0,usb:null,sprites:{},recs:{}};
function drawSec(id){return function(x,w,h){
  var q=SIT[id], st=q.scr;
  x.textAlign='center';x.textBaseline='middle';x.setLineDash([]);x.lineWidth=4;x.strokeStyle='#1B2559';
  function okCheck(cy){
    x.fillStyle='#FFC83D';x.beginPath();x.arc(w/2,cy,32,0,Math.PI*2);x.fill();x.stroke();
    x.lineWidth=8;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(w/2-14,cy);x.lineTo(w/2-3,cy+12);x.lineTo(w/2+16,cy-12);x.stroke();
  }
  if(st==='bad'&&id!=='pass'){
    x.fillStyle='#B93A25';x.fillRect(0,0,w,h);
    label(x,id==='phish'?'PERINGATAN!':'JANGAN!',w/2,84,58,'#FFFFFF');
    label(x,id==='phish'?'Passwordmu dicuri penipu':'Data pribadimu bocor',w/2,160,32,'#FFE0DA');
    label(x,id==='phish'?'Jangan klik tautan aneh':'Orang asing tidak boleh tahu',w/2,208,28,'#FFE0DA');return;
  }
  if(st==='ok'&&id!=='pass'){
    x.fillStyle='#14B8A6';x.fillRect(0,0,w,h);
    label(x,id==='phish'?'Pesan penipuan ditutup':'Kamu aman!',w/2,90,id==='phish'?38:52,'#FFFFFF');
    label(x,id==='phish'?'Sudah dilaporkan ke guru':'Sudah cerita ke orang dewasa',w/2,150,28,'#E9FFF8');
    okCheck(228);return;
  }
  if(id==='phish'){
    x.fillStyle='#CFE6FF';x.fillRect(0,0,w,h);
    x.fillStyle='#FFF3C9';rr(x,40,26,w-80,h-52,20);x.fill();x.stroke();
    label(x,'SELAMAT!!!',w/2,76,54,'#FF6F59');
    label(x,'Kamu menang HP gratis!',w/2,134,32,'#1B2559');
    label(x,'Klik di sini dan tulis passwordmu',w/2,176,23,'#1B2559');
    x.fillStyle='#FF6F59';rr(x,150,208,212,56,28);x.fill();x.stroke();
    label(x,'KLIK DI SINI',w/2,237,28,'#FFFFFF');return;
  }
  if(id==='pass'){
    x.fillStyle='#E8F0FF';x.fillRect(0,0,w,h);
    label(x,'Buat password baru',w/2,52,38,'#1B2559');
    x.fillStyle='#FFFFFF';rr(x,60,96,w-120,68,16);x.fill();x.stroke();
    if(st==='base'){label(x,'• • • • • • • •',w/2,131,40,'#8C9AD0');label(x,'Pilih password yang aman',w/2,222,26,'#4A5FC1');return;}
    label(x,q.typed||'',w/2,131,40,'#1B2559');
    var good=st==='ok', str=q.str||0;
    x.fillStyle='#DCE4F7';rr(x,60,190,w-120,30,15);x.fill();x.stroke();
    x.fillStyle=good?'#22CC66':(str>0.2?'#FFB020':'#FF4D4D');rr(x,60,190,Math.max(30,(w-120)*str),30,15);x.fill();x.stroke();
    label(x,good?'KUAT! Password aman':(str>0.2?'Kurang kuat':'Lemah! Mudah ditebak'),w/2,258,30,good?'#0C7A6F':'#B93A25');
    return;
  }
  if(id==='chat'){
    x.fillStyle='#F3EDFF';x.fillRect(0,0,w,h);
    x.fillStyle='#7A5CFF';rr(x,24,18,w-48,44,14);x.fill();x.stroke();
    label(x,'Teman Baru (tidak dikenal)',w/2,41,24,'#FFFFFF');
    x.fillStyle='#FFFFFF';rr(x,40,84,300,56,18);x.fill();x.stroke();label(x,'Hai! Rumahmu di mana?',190,112,22,'#1B2559');
    x.fillStyle='#FFFFFF';rr(x,40,152,380,56,18);x.fill();x.stroke();label(x,'Kirim alamat dan fotomu dong!',230,180,22,'#1B2559');
    x.fillStyle='#FFFFFF';rr(x,40,236,w-80,50,25);x.fill();x.stroke();label(x,'Tulis pesan...',w/2,261,22,'#8C9AD0');
  }
};}
var secT={phish:canvasTex(512,320,drawSec('phish')),pass:canvasTex(512,320,drawSec('pass')),chat:canvasTex(512,320,drawSec('chat'))};
var SEC_SPOTS=[[-2.2,2.9],[2.4,3.1],[-6.4,-1.0],[6.2,0.9],[1.9,-0.9],[-1.9,-0.9],[-6.4,2.9]];
var TEACHER_BOX=[-6.9,1.1,-6.4];
function setSitScr(q,m){q.scr=m;if(secT[q.id]){secT[q.id].redraw();}}
function buildSecurity(){
  if(sec.built){return;}
  sec.built=true;
  /* meja guru */
  var tg=grp(world,-6.9,0,-6.4,0);
  box(tg,1.8,0.1,0.9,L(0xB98350),0,0.95,0);
  box(tg,0.1,0.95,0.8,L(0x8C5A32),-0.8,0.47,0);box(tg,0.1,0.95,0.8,L(0x8C5A32),0.8,0.47,0);
  var bx=grp(tg,0.1,1.0,0,0);box(bx,0.5,0.32,0.4,L(0xFFC83D),0,0.16,0);box(bx,0.3,0.03,0.04,L(0x1B2559),0,0.325,0.05);
  sph(tg,0.1,L(0xFF4D4D),-0.55,1.1,0.1,10,8);
  addSolid(-6.9,-6.4,1.8,0.9);
  sign(world,2.2,0.55,-6.9,2.5,-6.95,0,function(x,w,h){x.fillStyle='#1B2559';rr(x,4,4,w-8,h-8,22);x.fill();label(x,'MEJA GURU',w/2,h*0.5,52,'#FFFFFF');});
  labelSprite(scene,'KOTAK TEMUAN',-6.8,2.0,-6.4,1.3).visible=true;
  /* flashdisk */
  var ug=grp(world,0,0,0,0), um=grp(ug,0,0.14,0,0);
  sec.usbMat=L(0x3B82F6);
  box(um,0.14,0.05,0.34,sec.usbMat,0,0,0);box(um,0.1,0.03,0.12,L(0xC8CFE3),0,0,-0.23);box(um,0.12,0.06,0.1,L(0xFF6F59),0,0.005,0.1);
  var ur=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0xFF6F59,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  ur.rotation.x=-Math.PI/2;ur.position.y=0.02;ug.add(ur);
  sec.usb={g:ug,m:um,ring:ur};
  ug.visible=false;
  /* penanda dan interaktif */
  var defs={
    usb:{pos:new THREE.Vector3(0,0.5,0),range:1.7,group:um,my:1.2},
    phish:{pos:new THREE.Vector3(-4.4,1.8,-3.55),range:2.6,desk:0,my:2.75},
    pass:{pos:new THREE.Vector3(0,1.8,-3.55),range:2.6,desk:1,my:2.75},
    chat:{pos:new THREE.Vector3(-4.4,1.8,0.25),range:2.8,desk:3,my:2.75}
  };
  SITS.forEach(function(q){
    var d=defs[q.id], grpm=d.group;
    if(d.desk!==undefined){
      var mon=otherDesks[d.desk].monitor;
      layerWalk(plane(mon,1.3,0.72,BM(0xFFFFFF,{map:secT[q.id].tex}),0,0.83,0.068,0,0),mon.__layer||0);
      grpm=mon;
    }
    var rec={id:'sit:'+q.id,isSit:true,sit:q,group:grpm,name:q.name,type:'SITUASI',range:d.range,bias:1.5,active:false,pos:d.pos,mats:collectMats(grpm)};
    q.rec=rec;interactables.push(rec);sec.recs[q.id]=rec;
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:warnTex.tex,transparent:true,depthTest:false}));
    sp.scale.set(0.55,0.55,0.55);sp.renderOrder=9;sp.visible=false;scene.add(sp);
    q.sprite=sp;q.my=d.my;q.sy=d.my;
  });
}
function startLevel6(){
  var _m=snap();buildSecurity();claim('l6',_m);
  state.l6Active=true;state.level=6;updateStats();
  var sp=SEC_SPOTS[Math.floor(Math.random()*SEC_SPOTS.length)];
  sec.usb.g.position.set(sp[0],0,sp[1]);sec.usb.g.visible=true;
  SIT.usb.rec.pos.set(sp[0],0.5,sp[1]);
  SITS.forEach(function(q){
    q.rec.active=true;q.scr='base';q.solved=false;q.seen=false;q.wrong=0;
    var px=q.rec.pos;q.sprite.position.set(px.x,q.id==='usb'?1.3:2.75,px.z);q.sy=q.sprite.position.y;q.sprite.visible=true;
    if(secT[q.id]){secT[q.id].redraw();}
  });
  updateMission();
}
function openChoice(q){
  if(!state.l6Active||q.solved){return;}
  state.panelOpen=true;state.choiceOpen=true;sec.cur=q;q.wrong=0;sec.idle=0;unlock();
  if(!q.seen){q.seen=true;sec.nSeen++;addXP(10);updateMission();}
  q.shown=q.opts.slice().sort(function(){return Math.random()-0.5;});
  var box=$('#choice-opts');box.textContent='';
  q.shown.forEach(function(o,i){
    var b=document.createElement('button');b.type='button';b.className='optb';
    b.innerHTML='<kbd>'+(i+1)+'</kbd><span></span>';b.lastChild.textContent=o.t;
    b.addEventListener('click',function(){chooseOpt(i);});
    box.appendChild(b);
  });
  $('#choice-h').textContent=q.name;$('#choice-q').textContent=q.bot;
  $('#choice-msg').textContent='';
  $('#choice').hidden=false;$('#prompt').hidden=true;lastPrompt=null;sfx.open();
  say(q.bot);
}
function closeChoice(){
  var q=sec.cur;
  state.panelOpen=false;state.choiceOpen=false;$('#choice').hidden=true;sfx.close();idleT=0;
  if(q&&!q.solved){setSitScr(q,'base');sec.shake=0;if(sec.usbMat){sec.usbMat.color.setHex(0x3B82F6);}}
  sec.cur=null;
}
function chooseOpt(i){
  var q=sec.cur;if(!state.choiceOpen||!q){return;}
  var o=q.shown[i];if(!o){return;}
  if(o.safe){solveSit(q,o);return;}
  q.wrong++;sec.wrongN++;sfx.close();
  var rf=$('#redflash');rf.className='';void rf.offsetWidth;rf.className='go';
  if(q.id==='pass'){q.typed=o.t;q.str=o.str;}
  setSitScr(q,'bad');
  if(q.id==='usb'){sec.shake=1.2;sec.usbMat.color.setHex(0xFF4D4D);}
  var m=$('#choice-msg');m.textContent=o.bad+(q.wrong>=2?' Petunjuk: pilih tindakan yang paling aman untukmu.':'');
  say(o.bad);
  if(q.wrong>=2){
    Array.prototype.forEach.call($('#choice-opts').children,function(b,k){if(q.shown[k].safe){b.className='optb hl';}});
  }
}
function solveSit(q,o){
  q.solved=true;sec.nSolved++;
  state.panelOpen=false;state.choiceOpen=false;$('#choice').hidden=true;sec.cur=null;idleT=0;
  q.rec.active=false;lastPrompt=null;
  if(q.id==='pass'){q.typed=o.t;q.str=1;}
  setSitScr(q,'ok');
  if(q.id==='usb'){
    sec.usbMat.color.setHex(0x3B82F6);sec.shake=0;
    var st=sec.usb.g.position;
    sec.fly={t:0,x0:st.x,z0:st.z};
  }
  addXP(30);sfx.reward();say(q.ok);
  q.sprite.material.map=okTex.tex;q.sprite.material.needsUpdate=true;
  updateMission();
  if(sec.nSolved>=SITS.length){setTimeout(finishLevel6,2200);}
}
function finishLevel6(){
  state.l6Done=true;state.levelsDone[6]=true;
  SITS.forEach(function(q){q.sprite.visible=false;});
  addXP(100,1);sfx.reward();confetti();awardBadge('safe');updateMission();
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 6 · KEAMANAN KOMPUTER</div><h2>MISSION COMPLETE</h2><p>Kamu memilih tindakan yang aman di 4 situasi!</p><div class="t-badge">🏆 Cyber Safety Hero</div><p>+100 XP · ⭐ +1</p><p>🔓 Level 7: Algoritma terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(7);
}
function sitTags(){return SITS.map(function(q){return {t:q.short,ok:q.solved,cur:false};});}

/* ---------- level 7: algoritma ---------- */
var AX0=1.4,AZ0=2.75,ACELL=0.75,ACOLS=3,AROWS=5,MAXB=10;
var ADIR=[[0,-1],[1,0],[0,1],[-1,0]], ARY=[Math.PI,Math.PI/2,0,-Math.PI/2];
var CMD={F:{n:'FORWARD',ic:'↑'},L:{n:'LEFT',ic:'←'},R:{n:'RIGHT',ic:'→'},B:{n:'BACK',ic:'↓'}};
var PUZ=[
  {start:[1,4],dir:0,goal:[2,2],obs:[],intro:'Puzzle 1: bantu robot sampai ke komputer. Robot menghadap ke atas. Contoh: FORWARD, FORWARD, RIGHT, FORWARD.'},
  {start:[1,4],dir:0,goal:[0,0],obs:[[1,2],[1,1],[2,0]],intro:'Puzzle 2: ada kardus yang menghalangi. Cari jalan memutar!'},
  {start:[2,1],dir:0,goal:[0,3],obs:[[1,1],[1,2],[1,3]],intro:'Puzzle 3: tembok kardus di tengah. Pakai LEFT, RIGHT, dan BACK dengan cerdik!'}
];
var algo={built:false,n:0,solved:[false,false,false],prog:[],run:null,fails:0,idle:0,opened:false,busy:false,ar:null,goalMat:null,obsG:[],bot:null};
function aX(c){return AX0+(c+0.5)*ACELL;}
function aZ(r){return AZ0+(r+0.5)*ACELL;}
function aBlocked(p,c,r){
  if(c<0||c>=ACOLS||r<0||r>=AROWS){return true;}
  for(var i=0;i<p.obs.length;i++){if(p.obs[i][0]===c&&p.obs[i][1]===r){return true;}}
  return false;
}
function aStep(p,st,cmd){
  var c=st.c,r=st.r,d=st.d;
  if(cmd==='L'){return {c:c,r:r,d:(d+3)%4};}
  if(cmd==='R'){return {c:c,r:r,d:(d+1)%4};}
  var dd=cmd==='F'?d:(d+2)%4;
  var nc=c+ADIR[dd][0],nr=r+ADIR[dd][1];
  if(aBlocked(p,nc,nr)){return null;}
  return {c:nc,r:nr,d:d};
}
function solvePuz(p){
  var q=[{c:p.start[0],r:p.start[1],d:p.dir,path:[]}],seen={};
  seen[p.start[0]+','+p.start[1]+','+p.dir]=1;
  while(q.length){
    var s0=q.shift();
    if(s0.c===p.goal[0]&&s0.r===p.goal[1]){return s0.path;}
    ['F','L','R','B'].forEach(function(cm){
      var n=aStep(p,s0,cm);if(!n){return;}
      var k=n.c+','+n.r+','+n.d;if(seen[k]){return;}seen[k]=1;
      q.push({c:n.c,r:n.r,d:n.d,path:s0.path.concat([cm])});
    });
  }
  return null;
}
function buildArena(){
  if(algo.built){return;}
  algo.built=true;
  var g=grp(world,0,0,0,0);
  for(var c=0;c<ACOLS;c++){for(var r=0;r<AROWS;r++){
    plane(g,ACELL-0.04,ACELL-0.04,BM((c+r)%2?0xCFEFFF:0xEAF8FF),aX(c),0.03,aZ(r),-Math.PI/2,0);
  }}
  var W=ACOLS*ACELL,H=AROWS*ACELL,cx=AX0+W/2,cz=AZ0+H/2;
  box(g,W+0.2,0.08,0.1,L(0x2B3A67),cx,0.04,AZ0-0.05);box(g,W+0.2,0.08,0.1,L(0x2B3A67),cx,0.04,AZ0+H+0.05);
  box(g,0.1,0.08,H,L(0x2B3A67),AX0-0.05,0.04,cz);box(g,0.1,0.08,H,L(0x2B3A67),AX0+W+0.05,0.04,cz);
  labelSprite(scene,'LAB ALGORITMA',cx,1.5,AZ0+0.1,1.7).visible=true;
  /* komputer tujuan */
  algo.goalG=grp(world,0,0,0,0);
  box(algo.goalG,0.5,0.05,0.35,L(0x2B3A67),0,0.03,0);
  box(algo.goalG,0.1,0.2,0.08,L(0x2B3A67),0,0.15,0);
  box(algo.goalG,0.46,0.34,0.05,L(0x2B3A67),0,0.42,0);
  algo.goalMat=BM(0x5EEAFF);
  box(algo.goalG,0.38,0.26,0.02,algo.goalMat,0,0.42,0.03);
  /* penanda start */
  var sr=new THREE.Mesh(new THREE.RingGeometry(0.2,0.3,20),BM(0xFFC83D,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  sr.rotation.x=-Math.PI/2;sr.position.y=0.045;scene.add(sr);algo.startRing=sr;
  /* kardus penghalang */
  for(var i=0;i<4;i++){
    var o=grp(world,0,0,0,0);
    box(o,0.5,0.4,0.5,L(0xC98A4B),0,0.2,0);box(o,0.14,0.41,0.52,L(0xE8C48B),0,0.2,0);
    o.visible=false;algo.obsG.push(o);
  }
  /* robot kecil */
  var rb=new THREE.Group();
  box(rb,0.3,0.24,0.3,L(0xFF6F59),0,0.2,0);
  box(rb,0.26,0.22,0.24,L(0xFFFFFF),0,0.44,0);
  box(rb,0.18,0.09,0.03,L(0x1B2559),0,0.46,0.12);
  box(rb,0.04,0.05,0.02,BM(0x5EEAFF),-0.05,0.46,0.14);box(rb,0.04,0.05,0.02,BM(0x5EEAFF),0.05,0.46,0.14);
  cyl(rb,0.012,0.012,0.14,L(0x1B2559),0,0.62,0,6);sph(rb,0.035,BM(0xFFC83D),0,0.7,0,8,6);
  [-1,1].forEach(function(sg){cyl(rb,0.07,0.07,0.06,L(0x1B2559),sg*0.17,0.07,0,10).rotation.z=Math.PI/2;});
  rb.traverse(function(o){if(o.isMesh){o.castShadow=true;}});
  scene.add(rb);algo.bot=rb;
  /* konsol */
  var kg=grp(world,2.5,0,2.4,0);
  box(kg,1.0,0.08,0.55,L(0x4A5FC1),0,0.85,0);box(kg,0.08,0.85,0.5,L(0x2B3A67),-0.45,0.42,0);box(kg,0.08,0.85,0.5,L(0x2B3A67),0.45,0.42,0);
  box(kg,0.5,0.03,0.34,L(0x2B3A67),0,0.91,0.05);
  var lp=grp(kg,0,0.92,-0.1,0);box(lp,0.5,0.34,0.03,L(0x2B3A67),0,0.18,0);box(lp,0.44,0.28,0.02,BM(0x5EEAFF),0,0.18,0.02);
  var rec={id:'algo-console',isAlgo:true,group:kg,name:'Konsol Robot',type:'ALGORITMA',range:1.9,bias:1.5,active:false,pos:new THREE.Vector3(2.5,1.0,2.4),mats:collectMats(kg)};
  interactables.push(rec);algo.rec=rec;
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:warnTex.tex,transparent:true,depthTest:false}));
  sp.scale.set(0.55,0.55,0.55);sp.renderOrder=9;sp.position.set(2.5,1.9,2.4);scene.add(sp);algo.sprite=sp;
  algo.ar={c:0,r:0,d:0,x:0,z:0,ry:0,y:0};
}
function algoPlaceRobot(){
  var p=PUZ[algo.n], ar=algo.ar;
  ar.c=p.start[0];ar.r=p.start[1];ar.d=p.dir;ar.x=aX(ar.c);ar.z=aZ(ar.r);ar.ry=ARY[p.dir];ar.y=0.06;
}
function loadPuzzle(n){
  algo.n=n;algo.prog=[];algo.run=null;algo.fails=0;algo.busy=false;
  var p=PUZ[n];
  algo.goalG.position.set(aX(p.goal[0]),0.04,aZ(p.goal[1]));
  algo.startRing.position.set(aX(p.start[0]),0.045,aZ(p.start[1]));
  algo.obsG.forEach(function(o,i){
    var ob=p.obs[i];o.visible=!!ob;if(ob){o.position.set(aX(ob[0]),0.04,aZ(ob[1]));}
  });
  algoPlaceRobot();
  algo.goalMat.color.setHex(0x5EEAFF);
  algoRender();
}
function startLevel7(){
  var _m=snap();buildArena();claim('l7',_m);
  state.l7Active=true;state.level=7;updateStats();
  loadPuzzle(0);algo.rec.active=true;algo.sprite.visible=true;
  updateMission();
}
function algoRender(){
  var box=$('#a-prog');box.textContent='';
  for(var i=0;i<MAXB;i++){
    var b=document.createElement('button');b.type='button';
    var cm=algo.prog[i];
    b.className='aslot'+(cm?' f':'')+((algo.run&&algo.run.i===i)?' on':'');
    b.textContent=cm?(CMD[cm].ic+' '+CMD[cm].n):String(i+1);
    if(cm){b.setAttribute('data-c',cm);(function(k){b.addEventListener('click',function(){algoRemove(k);});})(i);}
    box.appendChild(b);
  }
  $('#a-title').textContent='PUZZLE '+(algo.n+1)+'/3';
  $('#a-goal').textContent='Bantu robot sampai ke komputer!';
  var dis=!!algo.busy;
  ['a-run','a-undo','a-clear'].forEach(function(id){$('#'+id).disabled=dis;});
  Array.prototype.forEach.call($('#a-pal').children,function(b){b.disabled=dis;});
}
function algoMsg(t,bad){var m=$('#a-msg');m.textContent=t;m.className='a-msg'+(bad?' bad':'');}
function algoAdd(cm){
  if(algo.busy||!state.algoOpen){return;}
  if(algo.prog.length>=MAXB){algoMsg('Slot penuh. Hapus satu blok dulu.',true);sfx.close();return;}
  algo.prog.push(cm);sfx.open();algoMsg('');algoRender();
}
function algoRemove(i){if(algo.busy){return;}algo.prog.splice(i,1);algoRender();}
function algoKey(e){
  var m={ArrowUp:'F',ArrowLeft:'L',ArrowRight:'R',ArrowDown:'B'};
  if(m[e.code]){algoAdd(m[e.code]);return true;}
  if(e.code==='Backspace'){if(!algo.busy){algo.prog.pop();algoRender();}return true;}
  if(e.code==='Enter'){algoRun();return true;}
  return false;
}
function algoLayout(on){
  var w=app.clientWidth||innerWidth,h=app.clientHeight||innerHeight,pnl=$('#algo');
  if(!on){camera.clearViewOffset();pnl.className='';return;}
  var side=w>=820&&w>h*1.05;
  pnl.className=side?'side':'';
  if(side){camera.setViewOffset(w,h,-Math.min(430,w*0.42)/2,0,w,h);}
  else{var ph=(+$('#algo .a-card').offsetHeight)||320;camera.setViewOffset(w,h,0,Math.round(ph/2),w,h);}
}
function openAlgo(){
  if(!state.l7Active||state.l7Done){return;}
  state.panelOpen=true;state.algoOpen=true;state.algoView=true;algo.opened=true;algo.idle=0;unlock();
  algoPlaceRobot();algo.run=null;algo.busy=false;
  algoMsg(PUZ[algo.n].intro);
  algoRender();
  app.classList.add('algo-on');$('#algo').hidden=false;algoLayout(true);
  $('#prompt').hidden=true;lastPrompt=null;sfx.open();
  say(PUZ[algo.n].intro);updateMission();
}
function closeAlgo(){
  state.panelOpen=false;state.algoOpen=false;state.algoView=false;
  $('#algo').hidden=true;app.classList.remove('algo-on');algoLayout(false);sfx.close();idleT=0;lastPrompt=null;
  algo.run=null;algo.busy=false;algoPlaceRobot();
}
function algoRun(){
  if(algo.busy||!state.algoOpen){return;}
  if(!algo.prog.length){algoMsg('Susun blok perintah dulu, ya!',true);sfx.close();return;}
  algoPlaceRobot();
  algo.busy=true;algo.run={i:-1,kind:null,t:0};
  algoMsg('Robot menjalankan algoritmamu...');algoRender();
}
function algoFail(msg){
  algo.fails++;sfx.close();
  if(algo.fails>=2){
    var sol=solvePuz(PUZ[algo.n]);
    if(sol){msg+=' Petunjuk: mulai dengan '+sol.slice(0,2).map(function(c){return CMD[c].n;}).join(', ')+'.';}
  }
  algoMsg(msg,true);say(msg);
  algo.run={i:-2,kind:'wait',t:0,after:'reset'};
  algoRender();
}
function algoSuccess(){
  var n=algo.n;
  algo.solved[n]=true;sfx.reward();addXP(30);
  algo.goalMat.color.setHex(0x7CF2B5);
  algo.run={i:-2,kind:'happy',t:0,after:'next'};
  var m='Algoritmamu berhasil!'+(n===0?' Algoritma adalah urutan langkah untuk menyelesaikan masalah.':'');
  algoMsg(m);say(m);
  updateMission();
}
function algoUpdate(dt,T){
  var ar=algo.ar, run=algo.run;
  if(run){
    run.t+=dt;
    if(run.kind==='wait'){
      if(run.t>1.3){algo.run=null;algo.busy=false;algoPlaceRobot();algoRender();}
    }else if(run.kind==='happy'){
      ar.y=0.06+Math.abs(Math.sin(run.t*7))*0.25;ar.ry+=dt*6;
      if(run.t>1.8){
        ar.y=0.06;
        if(algo.n<PUZ.length-1){closeAlgoSoft();loadPuzzle(algo.n+1);openAlgoNext();}
        else{closeAlgo();setTimeout(finishLevel7,300);}
      }
    }else{
      if(run.kind===null||run.t>=run.dur){
        if(run.kind){applyStep(run);}
        if(algo.run!==run){/* sudah diganti oleh hasil langkah */}
        else{
          run.i++;
          if(run.i>=algo.prog.length){algoFail('Robot belum sampai ke komputer. Periksa lagi urutan langkahmu!');}
          else{startStep(run);algoRender();}
        }
      }else{animStep(run);}
    }
  }
  algo.bot.position.set(ar.x,ar.y,ar.z);algo.bot.rotation.y=ar.ry;
  if(algo.sprite.visible){algo.sprite.position.y=1.9+(reduceMotion?0:Math.sin(T*3)*0.08);}
}
function closeAlgoSoft(){algo.run=null;algo.busy=false;}
function openAlgoNext(){
  algoMsg(PUZ[algo.n].intro);say(PUZ[algo.n].intro);algoRender();
}
function startStep(run){
  var cmd=algo.prog[run.i], ar=algo.ar, p=PUZ[algo.n];
  run.cmd=cmd;run.t=0;
  tone(330+run.i*40,0,0.1,'square',0.05);
  if(cmd==='L'||cmd==='R'){
    run.kind='turn';run.dur=0.45;run.ry0=ar.ry;run.ry1=ar.ry+(cmd==='L'?Math.PI/2:-Math.PI/2);
    run.d1=(ar.d+(cmd==='R'?1:3))%4;
  }else{
    var dd=cmd==='F'?ar.d:(ar.d+2)%4;
    var n=aStep(p,{c:ar.c,r:ar.r,d:ar.d},cmd);
    run.x0=ar.x;run.z0=ar.z;
    if(n){run.kind='move';run.dur=0.6;run.nc=n.c;run.nr=n.r;run.x1=aX(n.c);run.z1=aZ(n.r);}
    else{run.kind='bump';run.dur=0.5;run.x1=ar.x+ADIR[dd][0]*0.3;run.z1=ar.z+ADIR[dd][1]*0.3;}
  }
}
function animStep(run){
  var ar=algo.ar,k=Math.min(1,run.t/run.dur),e=k*k*(3-2*k);
  if(run.kind==='turn'){ar.ry=run.ry0+(run.ry1-run.ry0)*e;}
  else if(run.kind==='move'){ar.x=run.x0+(run.x1-run.x0)*e;ar.z=run.z0+(run.z1-run.z0)*e;ar.y=0.06+Math.sin(k*Math.PI)*0.06;}
  else if(run.kind==='bump'){var b=Math.sin(k*Math.PI);ar.x=run.x0+(run.x1-run.x0)*b;ar.z=run.z0+(run.z1-run.z0)*b;}
}
function applyStep(run){
  var ar=algo.ar,p=PUZ[algo.n];
  ar.y=0.06;
  if(run.kind==='turn'){ar.d=run.d1;ar.ry=ARY[ar.d];return;}
  if(run.kind==='move'){
    ar.c=run.nc;ar.r=run.nr;ar.x=aX(ar.c);ar.z=aZ(ar.r);
    if(ar.c===p.goal[0]&&ar.r===p.goal[1]){algoSuccess();}
    return;
  }
  if(run.kind==='bump'){ar.x=run.x0;ar.z=run.z0;algoFail('Ups, robot menabrak! Ada kardus atau tepi arena di depannya.');}
}
function finishLevel7(){
  state.l7Done=true;state.levelsDone[7]=true;
  algo.rec.active=false;algo.sprite.visible=false;
  addXP(100,1);sfx.reward();confetti();awardBadge('algo');updateMission();
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 7 · ALGORITMA</div><h2>MISSION COMPLETE</h2><p>Kamu menyusun algoritma untuk membantu robot sampai ke komputer!</p><div class="t-badge">🏆 Algorithm Master</div><p>+100 XP · ⭐ +1</p><p>🔓 Level 8: Misi Besar terbuka</p></div>';
  t.hidden=false;setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(8);
}
function puzTags(){return PUZ.map(function(p,i){return {t:'Puzzle '+(i+1),ok:algo.solved[i],cur:false};});}
$('#a-pal').addEventListener('click',function(e){var b=e.target.closest?e.target.closest('button'):null;if(b&&b.getAttribute('data-c')){algoAdd(b.getAttribute('data-c'));}});
$('#a-run').addEventListener('click',algoRun);
$('#a-undo').addEventListener('click',function(){if(!algo.busy){algo.prog.pop();algoRender();}});
$('#a-clear').addEventListener('click',function(){if(!algo.busy){algo.prog=[];algoRender();}});
$('#a-close').addEventListener('click',closeAlgo);

/* ---------- level 8: misi besar ---------- */
MK('l8');
var l8items=[];
var L8={built:false,active:false,done:false,s:[false,false,false,false,false,false],inst:{},scr:'off',p:0,pt:0,light:1,lightTo:1,print:null,busy:false,idle:0,key:null,P:null,ovs:[],marks:[],deskRec:null,prnRec:null,paper:null,sockP:null,sockU:null};
L8.sCount=function(){return L8.s.filter(Boolean).length;};
var L8TASKS=['Pasang komputer','Perbaiki jaringan','Hubungkan printer','Nyalakan komputer','Jalankan program','Cetak hasil'];
var L8SPOTS=[[-4.4,-0.85],[0,-0.85],[4.4,-0.85],[-5.0,3.0],[-7.3,-1.9],[-3.2,2.8],[6.4,1.4],[-6.4,2.9]];
var L8DEFS=[
  {id:'l8-monitor',kind:'monitor',name:'Monitor',icon:'🖥️',hold:0.5,fs:0.55,l8:true,build:function(g){makeMonitor(g,0,0,0);}},
  {id:'l8-keyboard',kind:'keyboard',name:'Keyboard',icon:'⌨️',hold:0.6,l8:true,build:function(g){makeKeyboard(g,0,0,0);}},
  {id:'l8-mouse',kind:'mouse',name:'Mouse',icon:'🖱️',hold:1.5,l8:true,build:function(g){makeMouse(g,0,0,0);}},
  {id:'l8-printercable',kind:'printercable',name:'Kabel Printer',icon:'🖨️',hold:1.2,l8:true,build:function(g){mkCoil(g,0x7A5CFF,0xC8CFE3,1);}}
];
L8DEFS.forEach(function(d,i){
  var g=grp(world,0,0,0,0);
  var model=grp(g,0,0.42,0,0);d.build(model);model.scale.setScalar(d.fs||1);
  var ring=new THREE.Mesh(new THREE.RingGeometry(0.42,0.56,28),BM(0xFF8A3D,{transparent:true,opacity:0.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.02;g.add(ring);
  var it={def:d,g:g,model:model,ring:ring,state:'free',got:false,ph:i*0.8+0.3};
  var o={id:'l8item:'+d.kind,isItem:true,item:it,group:g,name:d.name,type:'MISI BESAR',range:1.7,bias:0.6,active:false,pos:new THREE.Vector3(0,0.5,0),mats:collectMats(model)};
  g.visible=false;it.rec=o;l8items.push(it);interactables.push(o);
});
MK('shell');
function drawL8(x,w,h){
  var s=L8.scr,p=L8.p;
  x.textAlign='center';x.textBaseline='middle';x.setLineDash([]);
  if(s==='off'){x.fillStyle='#131B33';x.fillRect(0,0,w,h);return;}
  if(s==='boot'){
    if(p<0.25){
      x.fillStyle='#05070F';x.fillRect(0,0,w,h);x.fillStyle='#9FE8B8';
      x.font='700 24px monospace';x.textAlign='left';x.textBaseline='alphabetic';
      x.fillText('KOMP-BIOS v1.0',24,44);x.fillText('Memeriksa memori ... OK',24,80);x.fillText('Mencari disk ... OK',24,116);return;
    }
    var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#2B3A8F');g.addColorStop(1,'#14B8A6');x.fillStyle=g;x.fillRect(0,0,w,h);
    var k=Math.min(1,(p-0.25)/0.75);
    label(x,'KOMP-OS',w/2,h*0.36,78,'#FFFFFF');
    x.fillStyle='rgba(255,255,255,.3)';rr(x,96,196,320,24,12);x.fill();
    x.fillStyle='#FFC83D';rr(x,96,196,Math.max(24,320*k),24,12);x.fill();
    label(x,'Memuat... '+Math.round(k*100)+'%',w/2,256,28,'#FFFFFF');return;
  }
  if(s==='desk'){
    var g2=x.createLinearGradient(0,0,0,h);g2.addColorStop(0,'#8EDBFF');g2.addColorStop(1,'#DDF6FF');x.fillStyle=g2;x.fillRect(0,0,w,h);
    label(x,'Komputer menyala!',w/2,56,40,'#1B2559');
    x.lineWidth=4;x.strokeStyle='#1B2559';
    x.fillStyle='#FFC83D';rr(x,78,96,140,116,18);x.fill();x.stroke();
    label(x,'LAPORAN',148,166,26,'#1B2559');
    x.fillStyle='#FF6F59';rr(x,238,96,80,80,16);x.fill();x.stroke();label(x,'Tulis',278,196,20,'#1B2559');
    x.fillStyle='#14B8A6';rr(x,338,96,80,80,16);x.fill();x.stroke();label(x,'Main',378,196,20,'#1B2559');
    label(x,'Buka program LAPORAN',w/2,260,28,'#0C7A6F');return;
  }
  if(s==='run'){
    x.fillStyle='#1B2559';x.fillRect(0,0,w,h);
    label(x,'LAPORAN LAB',w/2,70,46,'#FFC83D');
    label(x,'Program berjalan...',w/2,140,30,'#FFFFFF');
    x.fillStyle='rgba(255,255,255,.25)';rr(x,76,184,360,30,15);x.fill();
    x.fillStyle='#7CF2B5';rr(x,76,184,Math.max(30,360*Math.min(1,p)),30,15);x.fill();
    label(x,Math.round(Math.min(1,p)*100)+'%',w/2,256,30,'#FFFFFF');return;
  }
  if(s==='done'||s==='sent'){
    x.fillStyle=s==='done'?'#14B8A6':'#2B3A8F';x.fillRect(0,0,w,h);
    label(x,s==='done'?'Laporan siap!':'Mencetak...',w/2,84,52,'#FFFFFF');
    label(x,s==='done'?'Kirim hasil ke printer':'Kertas keluar dari printer',w/2,160,30,'#E9FFF8');
    x.fillStyle='#FFFFFF';rr(x,206,198,100,80,12);x.fill();x.lineWidth=4;x.strokeStyle='#1B2559';x.stroke();
    x.fillStyle='#1B2559';x.fillRect(222,214,68,6);x.fillRect(222,230,68,6);x.fillRect(222,246,44,6);
    return;
  }
  if(s==='online'){
    var g3=x.createLinearGradient(0,0,0,h);g3.addColorStop(0,'#14B8A6');g3.addColorStop(1,'#2B3A8F');x.fillStyle=g3;x.fillRect(0,0,w,h);
    label(x,'SYSTEM ONLINE',w/2,h*0.42,68,'#FFFFFF');
    label(x,'Laboratorium siap digunakan',w/2,h*0.66,28,'#FFF3C9');
  }
}
var l8T=canvasTex(512,320,drawL8);
var sysT=canvasTex(512,320,function(x,w,h){
  var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#14B8A6');g.addColorStop(1,'#2B3A8F');x.fillStyle=g;x.fillRect(0,0,w,h);
  x.textAlign='center';x.textBaseline='middle';
  label(x,'SYSTEM ONLINE',w/2,h*0.42,68,'#FFFFFF');
  label(x,'Laboratorium siap digunakan',w/2,h*0.66,28,'#FFF3C9');
});
function setL8Scr(m){L8.scr=m;L8.p=0;L8.pt=0;l8T.redraw();}
function l8Socket(x,y,z,face){
  var g=grp(world,x,y,z,0), zf=face==='z';
  box(g,zf?0.2:0.04,0.14,zf?0.04:0.2,L(0xFF8A3D),0,0,0);
  box(g,zf?0.13:0.05,0.08,zf?0.05:0.13,L(0x131B33),zf?0:-0.005,0,zf?0.005:0);
  var plug=grp(g,zf?0:-0.07,0,zf?0.07:0,0);box(plug,0.1,0.08,0.08,L(0x7A5CFF),0,0,0);plug.visible=false;
  return {g:g,plug:plug};
}
function buildL8(){
  if(L8.built){return;}
  L8.built=true;
  var P=otherDesks[2];L8.P=P;
  layerWalk(plane(P.monitor,1.3,0.72,BM(0xFFFFFF,{map:l8T.tex}),0,0.83,0.076,0,0),P.monitor.__layer||0);
  /* papan status jaringan di dinding */
  plane(world,1.7,1.06,BM(0xFFFFFF,{map:netT.tex}),8.96,2.55,-3.4,0,-Math.PI/2);
  labelSprite(scene,'STATUS JARINGAN',8.6,3.25,-3.4,1.5).visible=true;
  /* layar SYSTEM ONLINE untuk semua monitor */
  var mons=[otherDesks[0].monitor,otherDesks[1].monitor,otherDesks[3].monitor,otherDesks[4].monitor,hero.monitor];
  if(svc.mon){mons.push(svc.mon);}
  mons.forEach(function(m){var pl=plane(m,1.3,0.72,BM(0xFFFFFF,{map:sysT.tex}),0,0.83,0.082,0,0);layerWalk(pl,m.__layer||0);pl.visible=false;L8.ovs.push(pl);});
  /* colokan printer dan colokan USB di PC */
  L8.sockP=l8Socket(7.46,1.2,0.65,'x');L8.sockU=l8Socket(3.12,1.28,-2.93,'z');
  L8.lblP=labelSprite(scene,'PRINTER',7.35,1.75,0.65,0.9);L8.lblU=labelSprite(scene,'PC (USB)',3.12,1.8,-2.93,0.9);
  /* kertas */
  var pp=grp(world,7.52,1.04,0.2,0);box(pp,0.34,0.012,0.26,L(0xFFFFFF),0,0,0);
  var ptx=canvasTex(128,96,function(x,w,h){x.fillStyle='#FFFFFF';x.fillRect(0,0,w,h);label(x,'LAPORAN',w/2,34,22,'#1B2559');x.fillStyle='#1B2559';x.fillRect(18,54,92,5);x.fillRect(18,68,92,5);});
  plane(pp,0.3,0.22,BM(0xFFFFFF,{map:ptx.tex}),0,0.008,0,-Math.PI/2,Math.PI/2);
  pp.visible=false;L8.paper=pp;
  /* interaktif */
  L8.deskRec={id:'l8-desk',isL8:true,kind:'desk',group:P.g,name:'Komputer Utama',type:'MISI BESAR',range:3.1,bias:3,active:false,pos:new THREE.Vector3(4.4,1.1,-3.45),mats:collectMats(P.cpu)};
  L8.prnRec={id:'l8-printer',isL8:true,kind:'printer',group:printerG,name:'Printer',type:'MISI BESAR',range:2.4,bias:3,active:false,pos:new THREE.Vector3(7.2,1.2,0.4),mats:collectMats(printerG)};
  interactables.push(L8.deskRec,L8.prnRec);
  [[4.4,3.0,-3.45],[7.2,2.3,0.4]].forEach(function(q){
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:warnTex.tex,transparent:true,depthTest:false}));
    sp.scale.set(0.55,0.55,0.55);sp.renderOrder=9;sp.position.set(q[0],q[1],q[2]);sp.visible=false;scene.add(sp);
    L8.marks.push({sp:sp,y:q[1]});
  });
}
function startLevel8(){
  var _m=snap();buildL8();claim('l8',_m);
  L8.active=true;state.l8Active=true;state.level=8;updateStats();
  L8.light=1;L8.lightTo=0;
  var P=L8.P;P.monitor.visible=false;P.keyboard.visible=false;P.mouse.visible=false;
  setL8Scr('off');
  /* benda */
  var pool=L8SPOTS.slice().sort(function(){return Math.random()-0.5;});
  l8items.forEach(function(it,i){
    var sp=pool[i];
    it.g.position.set(sp[0],0,sp[1]);it.rec.pos.set(sp[0],0.5,sp[1]);
    it.g.visible=true;it.rec.active=true;
  });
  /* putuskan satu sambungan jaringan */
  var keys=['sw-rt','rt-net'];L8.key=keys[Math.floor(Math.random()*keys.length)];
  if(nw.tubes[L8.key]){nw.tubes[L8.key].visible=false;}
  (nw.lp[L8.key]||[]).forEach(function(id){var pt=nw.ports[id];pt.occ=null;pt.plug.visible=false;});
  nw.links[L8.key]=false;nw.nLinks=2;nw.broken=true;nw.done=false;netT.redraw();
  nw.ports.pc.rec.active=false;nw.ports.pc.label.visible=false;
  var cab=l5items[l5items.length-1];
  var cs=pool[4];
  scene.add(cab.g);cab.g.position.set(cs[0],0,cs[1]);cab.g.rotation.set(0,0,0);cab.g.scale.setScalar(1);cab.g.visible=true;
  cab.ring.visible=true;cab.state='free';cab.model.scale.setScalar(cab.def.fs||1);cab.model.position.y=0.42;
  if(cab.l5){cab.l5.end=null;}
  cab.rec.active=true;cab.rec.pos.set(cs[0],0.5,cs[1]);
  /* tempat tugas */
  L8.deskRec.active=true;L8.prnRec.active=true;
  L8.lblP.visible=true;L8.lblU.visible=true;
  L8.marks.forEach(function(m){m.sp.visible=true;});
  updateMission();
}
function l8Tags(){return L8TASKS.map(function(t,i){return {t:t,ok:!!L8.s[i],cur:false};});}
function l8Next(){
  var s=L8.s;
  if(!s[0]){return 'Pasang Monitor, Keyboard, dan Mouse di komputer meja belakang kanan.';}
  if(!s[1]||!s[2]){
    var m=[];if(!s[1]){m.push('perbaiki jaringan (kabel LAN biru)');}if(!s[2]){m.push('sambungkan printer (Kabel Printer)');}
    return 'Tugas berikutnya: '+m.join(' dan ')+'.';
  }
  if(!s[3]){return 'Nyalakan komputer: tekan E di komputer meja belakang kanan.';}
  if(!s[4]){return 'Jalankan program LAPORAN di komputer.';}
  return 'Kirim hasil ke printer di sisi kanan lab.';
}
function l8Label(t){
  var it=heldItem(), s=L8.s;
  if(t.kind==='desk'){
    if(it&&it.def.l8){return 'Pasang';}
    if(s[0]&&s[1]&&s[2]&&!s[3]){return 'Nyalakan';}
    if(s[3]&&!s[4]){return 'Jalankan';}
    return 'Periksa';
  }
  if(it&&it.def.l8&&it.def.kind==='printercable'){return 'Colokkan';}
  if(s[4]&&!s[5]){return 'Cetak';}
  return 'Periksa';
}
function l8Consume(it){
  state.inv[state.sel]=null;it.state='installed';it.g.visible=false;
  for(var i=0;i<3;i++){if(state.inv[i]){state.sel=i;break;}}
  refreshInv();
}
function useL8(rec){
  if(!state.l7Done||!L8.active||L8.done){return;}
  L8.idle=0;lastPrompt=null;
  if(rec.kind==='desk'){useL8Desk();}else{useL8Printer();}
}
function useL8Desk(){
  var it=heldItem(), s=L8.s;
  if(it&&it.def.l8){
    var k=it.def.kind;
    if(k==='monitor'||k==='keyboard'||k==='mouse'){
      if(L8.inst[k]){say(it.def.name+' sudah terpasang. Cari benda lain.');sfx.close();return;}
      L8.P[k].visible=true;L8.inst[k]=true;
      if(k==='monitor'){L8.P.monitor.visible=true;}
      l8Consume(it);addXP(20);sfx.reward();
      var n=(L8.inst.monitor?1:0)+(L8.inst.keyboard?1:0)+(L8.inst.mouse?1:0);
      if(n>=3){s[0]=true;say('Komputer terpasang! Tugas berikutnya: perbaiki jaringan dan sambungkan printer.');}
      else{say('Bagus! '+it.def.name+' terpasang. Tinggal '+(3-n)+' lagi!');}
      updateMission();return;
    }
    say('Belum tepat. '+it.def.name+' dipasang di printer, bukan di komputer.');sfx.close();return;
  }
  if(it&&it.def.l5){say('Kabel LAN dipakai di pojok JARINGAN, bukan di komputer ini.');sfx.close();return;}
  if(!s[0]){say('Komputer ini butuh Monitor, Keyboard, dan Mouse. Cari benda bercincin oranye!');return;}
  if(!s[3]){
    if(!(s[1]&&s[2])){
      var ms=[];if(!s[1]){ms.push('perbaiki jaringan');}if(!s[2]){ms.push('sambungkan printer');}
      say('Sebelum menyalakan komputer, '+ms.join(' dan ')+' dulu.');return;
    }
    if(L8.busy){say('Tunggu sebentar, komputer sedang menyala...');return;}
    L8.busy=true;setL8Scr('boot');
    [262,330,392,523].forEach(function(f,i){tone(f,i*0.18,0.3);});
    say('Komputer mulai menyala...');return;
  }
  if(!s[4]){
    if(L8.busy||L8.scr!=='desk'){say('Tunggu sebentar...');return;}
    L8.busy=true;setL8Scr('run');sfx.open();say('Program LAPORAN berjalan...');return;
  }
  if(!s[5]){say('Laporan sudah siap! Kirim hasilnya ke printer.');return;}
}
function useL8Printer(){
  var it=heldItem(), s=L8.s;
  if(it&&it.def.l8&&it.def.kind==='printercable'){
    if(s[2]){say('Printer sudah terhubung.');return;}
    L8.sockP.plug.visible=true;L8.sockU.plug.visible=true;
    layerWalk(tube(world,[[7.46,1.2,0.65],[7.1,0.6,0.7],[7.0,0.06,0.2],[5.8,0.05,-0.9],[3.6,0.05,-1.3],[3.0,0.06,-2.0],[3.0,0.06,-2.3],[3.05,0.7,-2.45],[3.1,1.06,-2.6],[3.12,1.28,-2.93]],0.03,0x7A5CFF),AREA_L.l8);
    l8Consume(it);s[2]=true;addXP(30);sfx.reward();
    say('Bagus! Printer terhubung ke komputer lewat kabel.');updateMission();return;
  }
  if(it&&it.def.l8){say('Belum tepat. '+it.def.name+' dipasang di komputer.');sfx.close();return;}
  if(!s[2]){say('Printer ini belum terhubung. Ambil Kabel Printer, lalu colokkan di sini.');return;}
  if(!s[4]){say('Printer menunggu hasil dari komputer. Jalankan program LAPORAN dulu!');return;}
  if(!s[5]){
    if(L8.print){return;}
    L8.print={t:0};L8.busy=true;L8.paper.visible=true;L8.paper.position.x=7.52;
    setL8Scr('sent');[392,440,392,440].forEach(function(f,i){tone(f,i*0.2,0.15,'square',0.06);});
    say('Mengirim hasil ke printer...');return;
  }
}
function l8NetFixed(){
  nw.broken=false;L8.s[1]=true;
  addXP(30);sfx.reward();updateMission();
  say('Jaringan tersambung lagi! Papan status di dinding menunjukkan CONNECTED.');
}
function showFinal(){
  $('#f-xp').textContent='⭐ '+state.stars+' bintang';
  $('#f-st').textContent=state.xp+' XP';
  $('#f-bd').textContent='🏆 '+state.nBadges+' badge';
  state.panelOpen=true;state.finalOpen=true;unlock();
  $('#prompt').hidden=true;$('#final').hidden=false;
}
function hideFinal(){
  state.panelOpen=false;state.finalOpen=false;$('#final').hidden=true;idleT=0;
}
function restartGame(){
  try{location.reload();}catch(e){try{location.href=location.href;}catch(e2){}}
}
function finishLevel8(){
  L8.done=true;state.l8Done=true;state.levelsDone[8]=true;
  L8.lightTo=1;L8.ovs.forEach(function(p){p.visible=true;});
  setL8Scr('online');
  L8.marks.forEach(function(m){m.sp.visible=false;});
  L8.deskRec.active=false;L8.prnRec.active=false;
  addXP(100,1);sfx.reward();confetti();awardBadge('eng');updateMission();
  [523,659,784,1047,1319].forEach(function(f,i){tone(f,i*0.12,0.3);});
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 8 · MISI BESAR</div><h2>SYSTEM ONLINE</h2><p>Mission Complete! Seluruh laboratorium menyala lagi.</p><div class="t-badge">🏆 JUNIOR COMPUTER ENGINEER</div><p>+100 XP · ⭐ +1</p><p>Kamu menamatkan Computer Adventure!</p></div>';
  t.hidden=false;setTimeout(hideToast,9000);
  say('Hebat! Kamu sekarang Junior Computer Engineer!');
  $('#restart').hidden=false;
  setTimeout(function(){hideToast();showFinal();},4500);
}

closeMarks();
/* ---------- karakter dan KOMP-BOT ---------- */
function buildKid(gender){
  var girl=gender==='girl';
  var skin=0xFFD3AE, shirt=girl?0xFF6F9C:0x14B8A6, bottom=girl?0x7A5CFF:0x2B3A8F, hairC=girl?0x4B2E1B:0x2B1A10, bagC=girl?0xFFC83D:0xFF6F59;
  var root=new THREE.Group(), legs=[], arms=[];
  [-1,1].forEach(function(s){
    var p=new THREE.Group();p.position.set(s*0.14,0.58,0);root.add(p);
    if(girl){cyl(p,0.075,0.065,0.44,L(skin),0,-0.28,0,10);cyl(p,0.08,0.08,0.1,L(0xFFFFFF),0,-0.43,0,10);}
    else{cyl(p,0.1,0.09,0.5,L(bottom),0,-0.28,0,10);}
    box(p,0.18,0.1,0.28,L(girl?0xFF4D6D:0xFFFFFF),0,-0.53,0.04);
    legs.push(p);
  });
  cyl(root,0.24,0.27,0.55,L(shirt),0,0.85,0,12);
  if(girl){cyl(root,0.27,0.4,0.26,L(bottom),0,0.62,0,14);}
  else{cyl(root,0.275,0.275,0.06,L(0x1B2559),0,0.6,0,12);}
  [-1,1].forEach(function(s){
    var p=new THREE.Group();p.position.set(s*0.34,1.06,0);root.add(p);
    cyl(p,0.08,0.075,0.2,L(shirt),0,-0.1,0,10);
    cyl(p,0.065,0.06,0.26,L(skin),0,-0.31,0,10);
    sph(p,0.075,L(skin),0,-0.47,0,10,8);
    arms.push(p);
  });
  sph(root,0.34,L(skin),0,1.46,0,16,12);
  sph(root,0.06,L(skin),-0.34,1.46,0,8,6);sph(root,0.06,L(skin),0.34,1.46,0,8,6);
  var hair=new THREE.Mesh(new THREE.SphereGeometry(0.365,16,10,0,Math.PI*2,0,1.85),L(hairC));
  hair.position.set(0,1.49,-0.03);hair.rotation.x=-0.6;hair.castShadow=true;root.add(hair);
  if(girl){
    [-1,1].forEach(function(s){
      sph(root,0.13,L(hairC),s*0.37,1.3,-0.06,10,8);
      sph(root,0.055,L(0xFFC83D),s*0.33,1.44,-0.05,8,6);
    });
  }else{
    sph(root,0.1,L(hairC),0.08,1.8,0.1,8,6);
  }
  [-1,1].forEach(function(s){sph(root,0.05,BM(0x1B2559),s*0.12,1.45,0.3,8,6);});
  var smile=new THREE.Mesh(new THREE.TorusGeometry(0.08,0.014,6,12,Math.PI),BM(0x1B2559));
  smile.position.set(0,1.375,0.325);smile.rotation.z=Math.PI;root.add(smile);
  [-1,1].forEach(function(s){var ch=new THREE.Mesh(new THREE.CircleGeometry(0.045,10),BM(0xFF8FA3,{transparent:true,opacity:0.65}));ch.position.set(s*0.2,1.39,0.285);root.add(ch);});
  var bag=grp(root,0,0.88,-0.3,0);
  box(bag,0.42,0.52,0.16,L(bagC),0,0,0);
  box(bag,0.3,0.2,0.05,L(0xFFFFFF),0,-0.1,-0.1);
  root.traverse(function(o){if(o.isMesh){o.castShadow=true;}});
  return {root:root,legs:legs,arms:arms};
}
function buildBot(){
  var r=new THREE.Group(), white=0xF4F8FF, blue=0x3B82F6;
  cyl(r,0.2,0.26,0.34,L(white),0,0,0,14);
  sph(r,0.06,BM(0x5EEAFF),0,0.03,0.22,8,6);
  var head=sph(r,0.27,L(white),0,0.4,0,16,12);head.scale.set(1,0.85,1);
  box(r,0.38,0.22,0.06,L(0x1B2559),0,0.42,0.22);
  box(r,0.07,0.1,0.02,BM(0x5EEAFF),-0.09,0.43,0.255);
  box(r,0.07,0.1,0.02,BM(0x5EEAFF),0.09,0.43,0.255);
  cyl(r,0.015,0.015,0.2,L(0x1B2559),0,0.72,0,6);
  sph(r,0.05,BM(0xFFC83D),0,0.84,0,8,6);
  [-1,1].forEach(function(s){
    cyl(r,0.06,0.06,0.08,L(blue),s*0.27,0.4,0,10).rotation.z=Math.PI/2;
    box(r,0.07,0.22,0.07,L(white),s*0.3,0.03,0);
    sph(r,0.05,L(blue),s*0.3,-0.1,0,8,6);
  });
  var th=cyl(r,0.1,0.02,0.14,BM(0xFF9F1C),0,-0.24,0,10);th.castShadow=false;
  r.traverse(function(o){if(o.isMesh){o.castShadow=true;}});
  return r;
}

/* ---------- state ---------- */
var state={mode:'menu',gender:'boy',xp:0,stars:0,level:1,checked:{},nChecked:0,panelOpen:false,sound:true,current:null,stageDone:false,pendingFinish:false,justFound:false,openedAtTut:3,badges:{},nBadges:0,levelsDone:{},ch:null,chDoneIds:{},chDone:0,chStarted:false,hintOn:false,wrongN:0,res:null,progOpen:false};
var chT=0;
state.inv=[null,null,null];state.sel=0;state.placed=0;state.trainDone=false;state.itemHint=false;state.pickN=0;
state.l2Active=false;state.l2Done=false;state.l2n=0;state.l2in={};state.portOpen=false;state.portWrong=0;
state.l3Active=false;state.l3Done=false;state.l3n=0;
state.l4Active=false;state.l4Done=false;state.l4n=0;
state.l5Active=false;state.l5Done=false;
state.l6Active=false;state.l6Done=false;state.choiceOpen=false;
state.l7Active=false;state.l7Done=false;state.algoOpen=false;state.algoView=false;
state.l8Active=false;state.l8Done=false;
state.finalOpen=false;state.doorTo=0;state.area=1;state.voice=true;state.voiceIdx=0;state.transition=false;
var SPAWN=new THREE.Vector3(0,0,4.6);
var pos=SPAWN.clone(), vel=new THREE.Vector3();
var yaw=0, pitch=0.42, camDist=4.6, kidFace=Math.PI, phase=0, armWave=1;
var kid=null, bot=buildBot();
scene.add(bot);
bot.position.set(1.3,1.9,4.2);
function setKid(g){
  if(kid){scene.remove(kid.root);}
  state.gender=g;kid=buildKid(g);scene.add(kid.root);
  kid.root.position.copy(pos);
}
setKid('boy');

/* ---------- HUD ---------- */
function popEl(el){el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}
function updateStats(){$('#lvl').textContent=state.level;$('#xp').textContent=state.xp;$('#stars').textContent=state.stars;}
function updateMission(){
  var lab=$('#m-label'), tx=$('#m-text'), cap=$('#m-cap'), ul=$('#objs'), rows=[], tot=CHALLENGES.length;
  var l2c=['monitor','keyboard','mouse'].filter(function(k){return state.l2in[k];}).length;
  var l2k=['power','hdmi','usbcable'].filter(function(k){return state.l2in[k];}).length;
  if(state.l8Done){
    lab.textContent='MISI BESAR SELESAI';tx.textContent='SYSTEM ONLINE! Seluruh laboratorium menyala.';
    rows=[{t:'Selesaikan 6 tugas lab',n:6,tot:6,tags:l8Tags()},{t:'Nyalakan seluruh lab',n:1,tot:1}];
    cap.textContent='Kamu Junior Computer Engineer!';
  }else if(state.l8Active){
    lab.textContent='MISI BESAR · LEVEL 8';
    tx.textContent=l8Next();
    rows=[{t:'Selesaikan 6 tugas lab',n:L8.sCount(),tot:6,tags:l8Tags()},{t:'Nyalakan seluruh lab',n:0,tot:1}];
    cap.textContent='Cari benda bercincin oranye dan kabel LAN biru.';
  }else if(state.l7Done){
    lab.textContent='LEVEL 7 SELESAI';tx.textContent='Pintu ke ruang berikutnya terbuka!';
    rows=[{t:'Buka Konsol Robot',n:1,tot:1},{t:'Selesaikan 3 puzzle',n:3,tot:3,tags:puzTags()}];
    cap.textContent='Algoritma = urutan langkah menyelesaikan masalah.';
  }else if(state.l7Active){
    lab.textContent='MISI LEVEL 7 · ALGORITMA';
    tx.textContent='Susun blok FORWARD, LEFT, RIGHT, BACK agar robot sampai ke komputer.';
    rows=[{t:'Buka Konsol Robot',n:algo.opened?1:0,tot:1},{t:'Selesaikan 3 puzzle',n:algo.solved.filter(Boolean).length,tot:3,tags:puzTags()}];
    cap.textContent='Dekati konsol bertanda !, susun langkah, lalu tekan RUN.';
  }else if(state.l6Done){
    lab.textContent='LEVEL 6 SELESAI';tx.textContent='Pintu ke ruang berikutnya terbuka!';
    rows=[{t:'Temukan 4 situasi',n:4,tot:4},{t:'Pilih tindakan yang aman',n:4,tot:4,tags:sitTags()}];
    cap.textContent='Kamu jadi pahlawan keamanan digital!';
  }else if(state.l6Active){
    lab.textContent='MISI LEVEL 6 · KEAMANAN DIGITAL';
    tx.textContent='Temukan 4 situasi bertanda !, lalu pilih tindakan yang aman.';
    rows=[{t:'Temukan 4 situasi',n:sec.nSeen,tot:4},{t:'Pilih tindakan yang aman',n:sec.nSolved,tot:4,tags:sitTags()}];
    cap.textContent='Satu flashdisk di lantai dan tiga komputer.';
  }else if(state.l5Done){
    lab.textContent='LEVEL 5 SELESAI';tx.textContent='Pintu ke ruang berikutnya terbuka!';
    rows=[{t:'Ambil 3 kabel LAN',n:3,tot:3},{t:'Hubungkan PC sampai Internet',n:3,tot:3,tags:linkTags()}];
    cap.textContent='Kamu paham cara kerja jaringan sederhana!';
  }else if(state.l5Active){
    var l5g=l5items.filter(function(i){return i.got;}).length;
    lab.textContent='MISI LEVEL 5 · JARINGAN KOMPUTER';
    tx.textContent='Ambil kabel LAN bercincin biru, lalu hubungkan PC → Switch → Router → Internet.';
    rows=[{t:'Ambil 3 kabel LAN',n:l5g,tot:3},{t:'Hubungkan PC sampai Internet',n:nw.nLinks,tot:3,tags:linkTags()}];
    cap.textContent='Colokkan satu ujung, lalu bawa ujung satunya ke perangkat berikutnya.';
  }else if(state.l4Done){
    lab.textContent='LEVEL 4 SELESAI';tx.textContent='Pintu ke ruang berikutnya terbuka!';
    rows=[{t:'Selesaikan 3 kasus',n:3,tot:3,tags:caseTags()},{t:'Cari penyebab dan perbaiki',n:1,tot:1}];
    cap.textContent='Kamu sudah jadi teknisi komputer!';
  }else if(state.l4Active){
    var c4=CASES[svc.n];
    lab.textContent='MISI LEVEL 4 · TEKNISI KOMPUTER';
    tx.textContent=svc.fixed?'Komputer sedang diperbaiki...':(svc.found?'Masalah ditemukan! Dekati bagian bertanda ! lalu perbaiki.':'Kasus '+(svc.n+1)+': '+c4.title+'. Periksa bagian bertanda ?');
    rows=[{t:'Selesaikan 3 kasus',n:state.l4n,tot:3,tags:caseTags()},{t:'Cari penyebab dan perbaiki',n:svc.fixed?1:0,tot:1,tags:pointTags()}];
    cap.textContent='Periksa satu per satu. Bagian yang rusak bertanda !';
  }else if(state.l3Done){
    lab.textContent='LEVEL 3 SELESAI';tx.textContent='Pintu ke ruang berikutnya terbuka!';
    rows=[{t:'Temukan 6 perangkat',n:6,tot:6},{t:'Taruh di area yang benar',sub:'INPUT · PROSES · OUTPUT',n:6,tot:6}];
    cap.textContent='Kamu paham input, proses, dan output!';
  }else if(state.l2Done){
    var l3f=l3items.filter(function(i){return i.got;}).length;
    lab.textContent='MISI LEVEL 3 · INPUT, PROSES, OUTPUT';
    tx.textContent='Ambil perangkat bercincin ungu, lalu bawa ke area yang benar.';
    rows=[{t:'Temukan 6 perangkat',n:l3f,tot:6},{t:'Taruh di area yang benar',sub:'INPUT · PROSES · OUTPUT',n:state.l3n,tot:6}];
    cap.textContent='Tas muat 3 benda. Tekan Q untuk meletakkan.';
  }else if(state.stageDone){
    lab.textContent='MISI LEVEL 2 · MERAKIT KOMPUTER';
    tx.textContent=l2c<3?'Ambil komponen bercincin hijau, lalu pasang di Meja Rakit.':(l2k<3?'Sekarang pasang kabel di port belakang CPU.':'Komputer sedang menyala...');
    rows=[{t:'Pasang komponen di meja',sub:'Monitor, Keyboard, Mouse',n:l2c,tot:3},{t:'Pasang kabel di port CPU',sub:'Power, HDMI, USB',n:l2k,tot:3}];
    cap.textContent='Setelah semua terpasang, komputer menyala!';
  }else{
    lab.textContent='MISI LEVEL 1 · MENGENAL KOMPUTER';
    if(state.ch){tx.textContent='Sekarang: temukan '+state.ch.name+'!';}
    else if(state.nChecked>=COUNT){tx.textContent='Semua perangkat sudah dikenal!';}
    else{tx.textContent='Dekati perangkat bertanda ? lalu tekan E.';}
    rows=[{t:'Kenali dan cari 8 perangkat',n:state.nChecked,tot:COUNT,chips:true}];
    cap.textContent='Ikuti panah dan cari perangkat yang diminta KOMP-BOT.';
  }
  ul.textContent='';
  rows.forEach(function(r){
    var li=document.createElement('li'), done=r.n>=r.tot;
    li.className='obj'+(done?' done':'');
    var ck=document.createElement('span');ck.className='ck';ck.textContent=done?'✓':'';
    var ot=document.createElement('div');ot.className='ot';
    var tt=document.createElement('span');tt.textContent=r.t;ot.appendChild(tt);
    if(r.chips){
      var sm=document.createElement('small');
      CHALLENGES.forEach(function(c){
        var sp=document.createElement('span');
        sp.className='cn'+(state.checked[c.id]?' ok':'')+((state.ch&&state.ch.id===c.id)?' cur':'');
        sp.textContent=(state.checked[c.id]?'✓ ':'')+c.name;sm.appendChild(sp);
      });
      ot.appendChild(sm);
    }else if(r.tags){
      var sm3=document.createElement('small');
      r.tags.forEach(function(tg){var sp3=document.createElement('span');sp3.className='cn'+(tg.ok?' ok':'')+(tg.cur?' cur':'');sp3.textContent=(tg.ok?'✓ ':'')+tg.t;sm3.appendChild(sp3);});
      ot.appendChild(sm3);
    }else if(r.sub){var sm2=document.createElement('small');sm2.textContent=r.sub;ot.appendChild(sm2);}
    var cnt=document.createElement('b');cnt.className='on';cnt.textContent=r.n+'/'+r.tot;
    li.appendChild(ck);li.appendChild(ot);li.appendChild(cnt);ul.appendChild(li);
  });
  updateGoal();
}
function floatText(t){var d=document.createElement('div');d.className='float';d.textContent=t;$('#fx').appendChild(d);setTimeout(function(){d.remove();},1400);}
function addXP(n,stars){
  state.xp+=n;if(stars){state.stars+=stars;}
  updateStats();popEl($('#xp-pill'));if(stars){popEl($('#star-pill'));}
  floatText('+'+n+' XP');
}

/* dialog KOMP-BOT */
var typeTimer=null, hideTimer=null;
function say(text,sticky){
  var box=$('#bot-dialog'), el=$('#bot-text');
  box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
  clearInterval(typeTimer);clearTimeout(hideTimer);speak(text);tone(988,0,0.08,'sine',0.07);tone(1319,0.08,0.11,'sine',0.07);
  var i=0;el.textContent='';
  typeTimer=setInterval(function(){i+=2;el.textContent=text.slice(0,i);if(i>=text.length){clearInterval(typeTimer);}},18);
  if(!sticky){hideTimer=setTimeout(function(){box.classList.remove('show');},5200+text.length*70);}
}

/* suara */
var ac=null;
function audio(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}return ac;}
function tone(f,t0,d,type,v){
  var a=audio();if(!a||!state.sound){return;}
  var o=a.createOscillator(), g=a.createGain(), t=a.currentTime+t0;
  o.type=type||'triangle';o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v||0.12,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+0.05);
}
var sfx={
  open:function(){tone(660,0,0.12);tone(880,0.08,0.14);},
  close:function(){tone(520,0,0.1);},
  reward:function(){[523,659,784,1047].forEach(function(f,i){tone(f,i*0.09,0.22);});}
};
$('#snd').addEventListener('click',function(){
  state.sound=!state.sound;this.textContent=state.sound?'🔊':'🔇';this.setAttribute('aria-pressed',String(state.sound));
});

/* ---------- level 1: tantangan, badge, kemajuan ---------- */
var CHALLENGES=[
  {id:'keyboard',name:'Keyboard',badge:'keyboard',ok:'Betul! Keyboard dipakai untuk mengetik.',hint:'Petunjuk: alat untuk mengetik, ada di depan monitor.'},
  {id:'mouse',name:'Mouse',badge:'mouse',ok:'Betul! Mouse dipakai untuk menggerakkan pointer.',hint:'Petunjuk: perangkat kecil di dekat keyboard.'},
  {id:'monitor',name:'Monitor',ok:'Betul! Monitor menampilkan gambar.',hint:'Petunjuk: layar besar yang menampilkan gambar.'},
  {id:'cpu',name:'CPU',ok:'Betul! CPU adalah otak komputer.',hint:'Petunjuk: kotak biru di samping monitor.'},
  {id:'speaker',name:'Speaker',ok:'Betul! Speaker mengeluarkan suara.',hint:'Petunjuk: kotak merah kecil di dekat monitor.'},
  {id:'printer',name:'Printer',ok:'Betul! Printer mencetak ke kertas.',hint:'Petunjuk: mesin besar di meja sisi kanan lab.'},
  {id:'router',name:'Router',ok:'Betul! Router menghubungkan jaringan.',hint:'Petunjuk: perangkat berantena di meja JARINGAN.'},
  {id:'switch',name:'Switch',ok:'Betul! Switch menghubungkan banyak komputer.',hint:'Petunjuk: kotak datar berlampu di meja JARINGAN.'}
];
var LEVELS=['Mengenal Komputer','Merakit Komputer','Input, Proses, Output','Teknisi Komputer','Jaringan Komputer','Keamanan Komputer','Algoritma','Misi Besar'];
var BADGES=[
  {id:'explorer',name:'Computer Explorer',how:'Selesaikan Level 1'},
  {id:'mouse',name:'Mouse Master',how:'Temukan Mouse di Level 1'},
  {id:'keyboard',name:'Keyboard Master',how:'Temukan Keyboard di Level 1'},
  {id:'tech',name:'Junior Technician',how:'Selesaikan Level 4'},
  {id:'net',name:'Network Explorer',how:'Selesaikan Level 5'},
  {id:'safe',name:'Cyber Safety Hero',how:'Selesaikan Level 6'},
  {id:'algo',name:'Algorithm Master',how:'Selesaikan Level 7'},
  {id:'eng',name:'Junior Computer Engineer',how:'Selesaikan Level 8'}
];
function unlock(){try{if(document.pointerLockElement){document.exitPointerLock();}}catch(e){}}
function pickChallenge(excl){
  var pool=CHALLENGES.filter(function(c){return !state.chDoneIds[c.id]&&!state.checked[c.id];});
  if(!pool.length){return null;}
  var alt=pool.filter(function(c){return c.id!==excl;});
  return (alt.length?alt:pool)[0];
}
function startChallenge(prefix,excl){
  var c=pickChallenge(excl);
  if(!c){return false;}
  state.ch=c;state.chStarted=true;state.hintOn=false;state.wrongN=0;chT=0;
  updateMission();
  say((prefix||'')+'Yuk, cari '+c.name+'!');
  return true;
}
function awardBadge(id){
  if(state.badges[id]){return;}
  state.badges[id]=true;state.nBadges++;
  $('#nbadge').textContent=state.nBadges;popEl($('#badge-pill'));
  var b=BADGES.filter(function(x){return x.id===id;})[0];
  var d=document.createElement('div');d.className='bpop';d.textContent='🏆 Badge baru: '+b.name;
  app.appendChild(d);setTimeout(function(){d.remove();},3700);
}
function chip(cls,no,title,sub){
  var li=document.createElement('li');li.className='chip '+cls;
  var n=document.createElement('span');n.className='no';n.textContent=no;
  var w=document.createElement('div');
  var b=document.createElement('b');b.textContent=title;
  var sm=document.createElement('small');sm.textContent=sub;
  w.appendChild(b);w.appendChild(sm);li.appendChild(n);li.appendChild(w);
  return li;
}
function buildProg(){
  var lv=$('#prog-levels'), bd=$('#prog-badges');lv.textContent='';bd.textContent='';
  LEVELS.forEach(function(name,i){
    var no=i+1, done=!!state.levelsDone[no], open=no===1||!!state.levelsDone[no-1];
    var cls=done?'done':(open?'open':'lock');
    var sub=done?'Selesai ✓':(open?(no<=8?'Sedang dimainkan':'Terbuka · segera hadir'):'🔒 Terkunci');
    lv.appendChild(chip(cls,String(no),name,sub));
  });
  BADGES.forEach(function(b){
    var got=!!state.badges[b.id];
    bd.appendChild(chip(got?'done':'lock',got?'🏆':'🔒',b.name,got?'Sudah didapat':b.how));
  });
}
function openProg(){
  if(state.panelOpen||state.mode!=='play'){return;}
  buildProg();state.panelOpen=true;state.progOpen=true;unlock();
  $('#prog').hidden=false;$('#prompt').hidden=true;lastPrompt=null;sfx.open();
}
function closeProg(){
  state.panelOpen=false;state.progOpen=false;$('#prog').hidden=true;sfx.close();idleT=0;
}

/* ---------- panel dan interaksi ---------- */
var tut={step:0};
function openPanel(o){
  state.panelOpen=true;state.current=o;state.openedAtTut=tut.step;
  if(tut.step<3){tut.step=3;}
  state.justFound=false;state.res=null;
  unlock();
  $('#p-tag').textContent=o.type;
  $('#p-name').textContent=o.name;
  $('#p-desc').textContent=o.id==='door'?(state.area===1?'Pintu terkunci. Kenali semua perangkat dulu!':'Pintu terkunci. Selesaikan misi di ruang ini dulu!'):o.desc;
  $('#p-fact').textContent=o.fact;
  var lines=[];
  if(o.counted&&!state.checked[o.id]){
    state.checked[o.id]=true;state.nChecked++;state.justFound=true;
    addXP(10);sfx.reward();
    lines.push('Perangkat baru ditemukan! +10 XP');
  }else{sfx.open();}
  var c=state.ch;
  if(c&&o.counted){
    if(o.id===c.id){
      state.res={correct:true,c:c};
      state.ch=null;state.chDoneIds[c.id]=true;state.chDone++;
      lines.push('Tantangan benar! +10 XP ⭐');
      setTimeout(function(){addXP(10,1);sfx.reward();},600);
      if(c.badge){awardBadge(c.badge);}
    }else{
      state.wrongN++;state.res={wrong:true,c:c};
      lines.push('Hebat! Sekarang cari '+c.name+'.');
    }
  }
  if(state.nChecked===COUNT&&!state.stageDone){state.pendingFinish=true;}
  updateMission();
  var nw=$('#p-new');nw.textContent='';
  lines.forEach(function(t){var d=document.createElement('div');d.textContent=t;nw.appendChild(d);});
  nw.className='p-new';
  nw.hidden=!lines.length;
  $('#panel').hidden=false;
  $('#prompt').hidden=true;
}
function closePanel(){
  if(!state.panelOpen){return;}
  if(state.progOpen){closeProg();return;}
  if(state.finalOpen){hideFinal();return;}
  if(state.algoOpen){closeAlgo();return;}
  if(state.choiceOpen){closeChoice();return;}
  if(state.portOpen){closePort();return;}
  state.panelOpen=false;$('#panel').hidden=true;sfx.close();
  var o=state.current;state.current=null;idleT=0;
  var res=state.res;state.res=null;
  var tutorial=state.openedAtTut<3;
  var found=state.justFound;state.justFound=false;
  var done=state.pendingFinish;state.pendingFinish=false;
  if(res&&res.correct){
    if(!startChallenge(res.c.ok+' ',res.c.id)&&!done){say(res.c.ok);}
  }else if(res&&res.wrong){
    var w='Itu '+o.name.split(' /')[0]+'. Sekarang kita cari '+res.c.name+', yuk!';
    if(state.wrongN>=2){state.hintOn=true;w+=' '+res.c.hint;}
    say(w);
  }else if(o&&o.counted){
    if(!state.chStarted){startChallenge((tutorial?'Hebat! ':'')+o.bot+' ',o.id);}
    else if(!done){
      var left=COUNT-state.nChecked;
      say(o.bot+(found&&left>0?' Tinggal '+left+' perangkat lagi!':''));
    }
  }else if(o&&tutorial){
    say('Hebat! Sekarang cari perangkat bertanda ?.');
  }
  if(done){setTimeout(finishStage,450);}
}
function confetti(){
  if(reduceMotion){return;}
  var cols=['#FFC83D','#14B8A6','#FF6F59','#7A5CFF','#FF8FB5'];
  for(var i=0;i<36;i++){
    var c=document.createElement('div');c.className='confetti';
    c.style.left=Math.random()*100+'%';c.style.background=cols[i%cols.length];
    c.style.animationDuration=(2+Math.random()*2)+'s';c.style.animationDelay=(Math.random()*0.6)+'s';
    app.appendChild(c);setTimeout((function(el){return function(){el.remove();};})(c),4800);
  }
}
function finishStage(){
  state.stageDone=true;state.levelsDone[1]=true;
  addXP(100,1);updateMission();sfx.reward();confetti();
  awardBadge('explorer');
  var t=$('#toast');
  t.innerHTML='<div class="t-card card"><div class="t-k">LEVEL 1 · MENGENAL KOMPUTER</div><h2>MISSION COMPLETE</h2><p>Semua perangkat dikenali dan semua tantangan selesai!</p><div class="t-badge">🏆 Computer Explorer</div><p>+100 XP · ⭐ +1</p><p>🔓 Level 2: Merakit Komputer terbuka</p></div>';
  t.hidden=false;
  setTimeout(hideToast,7000);
  say('Hebat! Misi selesai!');
  openDoor(2);
}

/* ---------- ruang, pintu, tujuan, panah, suara ---------- */
var BASE_ALL=['deskH','desk0','desk1','desk2','desk3','desk4','net','printer','server','cab','rack','tech','plants','board','door'];
var WALL0=[0xBDEBD5,0xD7D0FF,0xFFE9A8,0xFFD1C2];
function tintWalls(c){return [c,c,c,c];}
var AREAS=[null,
  {name:'RUANG 1',sub:'Kenalan dengan perangkat',lay:BASE_ALL,floor:0xFFFFFF,walls:WALL0,intro:''},
  {name:'RUANG 2',sub:'Merakit komputer',lay:['asm','door'],floor:0xDFFFEF,walls:tintWalls(0xB9F0D2),intro:'Selamat datang di ruang merakit! Ambil benda berwarna hijau, lalu pasang di meja.'},
  {name:'RUANG 3',sub:'Input, Proses, Output',lay:['l3','board','door'],floor:0xFFF5D0,walls:tintWalls(0xFFE9A8),intro:'Di sini kita belajar input, proses, dan output. Ambil benda ungu, lalu taruh di tempat yang benar.'},
  {name:'RUANG 4',sub:'Teknisi komputer',lay:['l4','tech','door'],floor:0xEAE5FF,walls:tintWalls(0xD7D0FF),intro:'Aduh, komputernya rusak! Yuk, periksa bagian yang ada tanda tanya.'},
  {name:'RUANG 5',sub:'Jaringan komputer',lay:['l5','net','desk2','door'],floor:0xDDF3FF,walls:tintWalls(0xBFE3FF),intro:'Ini ruang jaringan! Ambil kabel biru, lalu sambungkan komputer sampai ke internet.'},
  {name:'RUANG 6',sub:'Keamanan komputer',lay:['l6','desk0','desk1','desk3','door'],floor:0xFFE6E0,walls:tintWalls(0xFFD1C2),intro:'Hati-hati di dunia digital! Cari tanda seru, lalu pilih yang paling aman.'},
  {name:'RUANG 7',sub:'Algoritma',lay:['l7','door'],floor:0xF1E6FF,walls:tintWalls(0xE2D3FF),intro:'Ayo bantu robot sampai ke komputer! Susun langkah-langkahnya, ya.'},
  {name:'MISI BESAR',sub:'Nyalakan lab kembali',lay:BASE_ALL.concat(['l5','l8']),floor:0xFFFFFF,walls:WALL0,intro:'Ini misi besar! Ayo nyalakan lab kembali.'}
];
var doorArrow=new THREE.Sprite(new THREE.SpriteMaterial({map:arrowTex.tex,transparent:true,depthTest:false}));
doorArrow.scale.set(0.9,0.9,0.9);doorArrow.position.set(5.8,4.3,-6.6);doorArrow.renderOrder=10;doorArrow.visible=false;scene.add(doorArrow);
var DOOR_POS={x:5.8,z:-6.4};
function setArea(n,place){
  var A=AREAS[n],m=1;
  A.lay.forEach(function(k){m|=(1<<AREA_L[k]);});
  areaMask=m;camera.layers.mask=m;
  WALLS.forEach(function(w,i){w.material.color.setHex(A.walls[i%A.walls.length]);});
  floor.material.color.setHex(A.floor);
  state.area=n;
  if(place){pos.set(5.8,0,-5.2);vel.set(0,0,0);yaw=Math.PI;pitch=0.4;}
}
function refreshDoor(){
  doorSignT.redraw();lockArc.visible=!state.doorTo;doorArrow.visible=!!state.doorTo;
}
function openDoor(n){
  state.doorTo=n;refreshDoor();updateGoal();
  setTimeout(function(){if(state.doorTo===n&&!state.panelOpen){say('Pintunya sudah terbuka. Yuk, masuk!');}},2400);
}
function clearBag(){
  for(var i=0;i<3;i++){var it=state.inv[i];if(it){it.state='installed';it.g.visible=false;if(it.rec){it.rec.active=false;}state.inv[i]=null;}}
  state.sel=0;refreshInv();
}
function showBanner(n){
  var A=AREAS[n],b=$('#areabanner');
  b.textContent=A.name;var sm=document.createElement('small');sm.textContent=A.sub;b.appendChild(sm);
  b.hidden=false;setTimeout(function(){b.hidden=true;},2800);
}
function enterNext(){
  var n=state.doorTo;if(!n||state.transition){return;}
  state.transition=true;$('#fade').className='on';sfx.open();
  setTimeout(function(){
    state.doorTo=0;refreshDoor();clearBag();
    setArea(n,true);
    ({2:startLevel2,3:startLevel3,4:startLevel4,5:startLevel5,6:startLevel6,7:startLevel7,8:startLevel8})[n]();
    updateMission();updateGoal();
    $('#fade').className='';state.transition=false;
    showBanner(n);say(AREAS[n].intro);
  },520);
}
/* tujuan singkat untuk anak */
var DEVIC={monitor:'🖥️',keyboard:'⌨️',mouse:'🖱️',cpu:'🧠',speaker:'🔊',printer:'🖨️',router:'📡',switch:'🔀'};
function heldKind(){var h=heldItem();return h?h.def:null;}
function goalFor(){
  if(state.doorTo){return {ic:'🚪',tx:'Masuk pintu hijau',n:0,tot:0};}
  var a=state.area,d=heldKind();
  if(a===1){
    if(state.ch){return {ic:DEVIC[state.ch.id]||'🔍',tx:'Cari '+state.ch.name,n:state.nChecked,tot:COUNT};}
    return {ic:'🔍',tx:'Dekati tanda ?',n:state.nChecked,tot:COUNT};
  }
  if(a===2){
    var c2=['monitor','keyboard','mouse'].filter(function(k){return state.l2in[k];}).length;
    if(d&&d.l2){return {ic:'🛠️',tx:CABLE_PORT[d.id]?'Pasang di CPU':'Pasang di meja',n:state.l2n,tot:6};}
    return {ic:'🟢',tx:c2<3?'Ambil benda hijau':'Ambil kabel hijau',n:state.l2n,tot:6};
  }
  if(a===3){
    if(d&&d.l3){return {ic:'📥',tx:'Taruh di area',n:state.l3n,tot:6};}
    return {ic:'🟣',tx:'Ambil benda ungu',n:state.l3n,tot:6};
  }
  if(a===4){
    if(svc.fixed){return {ic:'✨',tx:'Hebat!',n:state.l4n,tot:3};}
    if(svc.found){return {ic:'🔧',tx:'Perbaiki tanda !',n:state.l4n,tot:3};}
    return {ic:'🔍',tx:'Periksa tanda ?',n:state.l4n,tot:3};
  }
  if(a===5){
    if(d&&d.l5){return {ic:'🔌',tx:'Colokkan kabel',n:nw.nLinks,tot:3};}
    return {ic:'🔵',tx:'Ambil kabel biru',n:nw.nLinks,tot:3};
  }
  if(a===6){return {ic:'❗',tx:'Cari tanda !',n:sec.nSolved,tot:4};}
  if(a===7){return {ic:'🤖',tx:'Tolong robot',n:algo.solved.filter(Boolean).length,tot:3};}
  if(state.l8Done){return {ic:'🏆',tx:'Selesai!',n:6,tot:6};}
  var s=L8.s;
  if(!s[0]){return {ic:'🟠',tx:(d&&d.l8)?'Pasang di komputer':'Ambil benda oranye',n:L8.sCount(),tot:6};}
  if(!s[1]){return {ic:'🔵',tx:(d&&d.l5)?'Colokkan kabel biru':'Ambil kabel biru',n:L8.sCount(),tot:6};}
  if(!s[2]){return {ic:'🖨️',tx:(d&&d.l8)?'Colokkan ke printer':'Ambil kabel printer',n:L8.sCount(),tot:6};}
  if(!s[3]){return {ic:'💡',tx:'Nyalakan komputer',n:L8.sCount(),tot:6};}
  if(!s[4]){return {ic:'▶️',tx:'Jalankan program',n:L8.sCount(),tot:6};}
  return {ic:'🖨️',tx:'Cetak hasil',n:L8.sCount(),tot:6};
}
function updateGoal(){
  var g=goalFor();
  $('#g-ic').textContent=g.ic;$('#g-tx').textContent=g.tx;
  var p=$('#g-pips');p.textContent='';
  for(var i=0;i<g.tot;i++){var d=document.createElement('i');if(i<g.n){d.className='on';}p.appendChild(d);}
}
/* panah penunjuk arah */
function nearestFree(list,filter){
  var best=null,bd=1e9;
  list.forEach(function(it){
    if(it.state!=='free'||!it.rec.active){return;}
    if(filter&&!filter(it)){return;}
    var d=Math.hypot(it.rec.pos.x-pos.x,it.rec.pos.z-pos.z);if(d<bd){bd=d;best=it.rec.pos;}
  });
  return best;
}
function guidePos(){
  if(state.doorTo){return DOOR_POS;}
  var a=state.area,d=heldKind(),i;
  if(a===1){
    if(state.stageDone){return null;}
    var id=state.ch?state.ch.id:null;
    if(!id){var un=specs.filter(function(q){return q.counted&&!state.checked[q.id];});un.sort(function(p,q){return Math.hypot(p.pos.x-pos.x,p.pos.z-pos.z)-Math.hypot(q.pos.x-pos.x,q.pos.z-pos.z);});return un.length?un[0].pos:null;}
    for(i=0;i<specs.length;i++){if(specs[i].id===id&&specs[i].counted){return specs[i].pos;}}
    return null;
  }
  if(a===2){
    if(d&&d.l2){return CABLE_PORT[d.id]?cpuRec.pos:asmRec.pos;}
    return nearestFree(l2items)||asmRec.pos;
  }
  if(a===3){
    if(d&&d.l3){return ZONES.proc.rec.pos;}
    return nearestFree(l3items)||ZONES.proc.rec.pos;
  }
  if(a===4){
    var cps=svc.list.filter(function(c){return c.rec.active;});
    for(i=0;i<cps.length;i++){if(cps[i].st==='bad'){return cps[i].rec.pos;}}
    for(i=0;i<cps.length;i++){if(cps[i].st==='new'){return cps[i].rec.pos;}}
    return null;
  }
  if(a===5){
    if(nw.done){return null;}
    if(d&&d.l5){return nw.ports.sw1.rec.pos;}
    return nearestFree(l5items)||nw.ports.sw1.rec.pos;
  }
  if(a===6){
    var us=SITS.filter(function(q){return !q.solved;});
    us.sort(function(p,q){return Math.hypot(p.rec.pos.x-pos.x,p.rec.pos.z-pos.z)-Math.hypot(q.rec.pos.x-pos.x,q.rec.pos.z-pos.z);});
    return us.length?us[0].rec.pos:null;
  }
  if(a===7){return state.algoOpen?null:algo.rec.pos;}
  if(state.l8Done){return null;}
  var s=L8.s;
  if(!s[0]){
    if(d&&d.l8&&(d.kind==='monitor'||d.kind==='keyboard'||d.kind==='mouse')){return L8.deskRec.pos;}
    return nearestFree(l8items,function(it){return it.def.kind!=='printercable'&&!L8.inst[it.def.kind];})||L8.deskRec.pos;
  }
  if(!s[1]){
    if(d&&d.l5){return nw.ports.sw1.rec.pos;}
    return nearestFree(l5items)||nw.ports.sw1.rec.pos;
  }
  if(!s[2]){
    if(d&&d.l8&&d.kind==='printercable'){return L8.prnRec.pos;}
    return nearestFree(l8items,function(it){return it.def.kind==='printercable';})||L8.prnRec.pos;
  }
  if(!s[5]&&s[4]){return L8.prnRec.pos;}
  return L8.deskRec.pos;
}
function updateGuideHUD(){
  var g=$('#guide');
  if(state.mode!=='play'||state.panelOpen||state.transition){g.hidden=true;return;}
  var gp=guidePos();if(!gp){g.hidden=true;return;}
  var dx=gp.x-pos.x,dz=gp.z-pos.z,dist=Math.hypot(dx,dz);
  if(dist<1.7){g.hidden=true;return;}
  var fx=-Math.sin(yaw),fz=-Math.cos(yaw);
  var ang=Math.atan2(dx*(-fz)+dz*fx,dx*fx+dz*fz);
  $('#g-ar').style.transform='rotate('+ang+'rad)';
  $('#g-d').textContent=Math.round(dist)+' m';
  g.hidden=false;
}
/* suara KOMP-BOT */
function spoken(t){
  return String(t)
    .replace(/[\u2600-\u27BF\uFE0F\u{1F000}-\u{1FAFF}]/gu,'')
    .replace(/\+(\d+)\s*XP/g,'tambah $1 poin').replace(/\bXP\b/g,'poin')
    .replace(/→/g,' ke ').replace(/[·•]/g,', ').replace(/\s*\/\s*/g,' atau ')
    .replace(/\bWASD\b/g,'W, A, S, D').replace(/\bHDMI\b/g,'H D M I').replace(/\bUSB\b/g,'U S B')
    .replace(/\bCPU\b/g,'C P U').replace(/\bPC\b/g,'P C').replace(/\bRUN\b/g,'ran').replace(/\bWi-Fi\b/gi,'wai fai')
    .replace(/\s+/g,' ').trim();
}
function idVoices(){
  var ss=window.speechSynthesis;if(!ss||!ss.getVoices){return [];}
  var vs=ss.getVoices()||[],l=[];
  for(var i=0;i<vs.length;i++){if(/^id/i.test(vs[i].lang)||/indones/i.test(vs[i].name)){l.push(vs[i]);}}
  var sc=function(v){var n=v.name||'';return (/natural/i.test(n)?6:0)+(/online/i.test(n)?4:0)+(/google/i.test(n)?3:0)+(/gadis|damayanti|female|wanita/i.test(n)?2:0)+(v.localService?0:1);};
  l.sort(function(a,b){return sc(b)-sc(a);});
  return l;
}
function speak(t){
  var ss=window.speechSynthesis;
  if(!state.voice||!ss||typeof SpeechSynthesisUtterance==='undefined'){return;}
  try{
    var l=idVoices();if(!l.length){return;}
    var v=l[(state.voiceIdx||0)%l.length];
    ss.cancel();
    var parts=spoken(t).match(/[^.!?]+[.!?]*/g)||[];
    parts.forEach(function(p){
      p=p.trim();if(!p){return;}
      var u=new SpeechSynthesisUtterance(p);u.voice=v;u.lang=v.lang;u.rate=0.98;u.pitch=1.08;
      ss.speak(u);
    });
  }catch(e){}
}
$('#voice2').addEventListener('click',function(){
  var l=idVoices();
  if(!l.length){say('Perangkat ini belum punya suara bahasa Indonesia. Coba pakai browser Chrome atau Edge.');return;}
  state.voice=true;$('#voice').textContent='🗣️';
  state.voiceIdx=((state.voiceIdx||0)+1)%l.length;
  say('Halo! Aku KOMP-BOT. Ini suara nomor '+(state.voiceIdx+1)+' dari '+l.length+'.');
});
$('#f-again').addEventListener('click',restartGame);
$('#f-stay').addEventListener('click',hideFinal);
$('#restart').addEventListener('click',function(){if(state.l8Done&&!state.panelOpen){showFinal();}});
$('#voice').addEventListener('click',function(){
  state.voice=!state.voice;this.textContent=state.voice?'🗣️':'🤐';this.setAttribute('aria-pressed',String(state.voice));
  if(!state.voice&&window.speechSynthesis){try{speechSynthesis.cancel();}catch(e){}}
});
$('.mission').addEventListener('click',function(){this.classList.toggle('open');});
$('#goal').addEventListener('click',function(){$('.mission').classList.toggle('open');});
function hideToast(){$('#toast').hidden=true;}
$('#toast').addEventListener('click',hideToast);
$('#badge-pill').addEventListener('click',function(){if(state.progOpen){closeProg();}else{openProg();}});
$('#prog-close').addEventListener('click',closeProg);
$('#prog').addEventListener('click',function(e){if(e.target===this){closeProg();}});
$('#p-close').addEventListener('click',closePanel);

var target=null, hl=null, lastPrompt=null, idleT=0;
function setHL(o){
  if(hl===o){return;}
  if(hl){hl.mats.forEach(function(m){m.emissive.setHex(0);m.emissiveIntensity=1;});}
  hl=o;
}
function pickTarget(){
  var fx=-Math.sin(yaw), fz=-Math.cos(yaw), best=null, bs=1e9;
  for(var i=0;i<interactables.length;i++){
    var o=interactables[i], dx=o.pos.x-pos.x, dz=o.pos.z-pos.z, d=Math.hypot(dx,dz);
    if(o.active===false||d>o.range){continue;}
    if(o.group&&o.group.__layer&&!((areaMask>>o.group.__layer)&1)){continue;}
    var dot=d>0.001?(dx*fx+dz*fz)/d:1;
    if(dot<0.25&&d>1.4){continue;}
    var sc=d-dot*1.2-(o.bias||0);
    if(sc<bs){bs=sc;best=o;}
  }
  return best;
}
function tryInteract(){
  if(state.mode!=='play'){return;}
  if(!$('#toast').hidden){hideToast();return;}
  if(state.panelOpen){closePanel();return;}
  if(target){
    if(target.isItem){pickUp(target);}
    else if(target.isCrate){useCrate();}
    else if(target.isAsm){useAsm();}
    else if(target.isCpu){useCpu();}
    else if(target.isZone){useZone(target);}
    else if(target.isCheck){useCheck(target);}
    else if(target.isNetPort){useNetPort(target);}
    else if(target.isSit){openChoice(target.sit);}
    else if(target.id==='door'&&state.doorTo){enterNext();}
    else if(target.isAlgo){openAlgo();}
    else if(target.isL8){useL8(target);}
    else{openPanel(target);}
  }
}

/* ---------- input ---------- */
var keys={}, dragging=false;
var MOVE_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
window.addEventListener('keydown',function(e){
  if(state.mode==='play'&&MOVE_KEYS.indexOf(e.code)>=0){e.preventDefault();}
  keys[e.code]=true;
  if(state.mode!=='play'||e.repeat){return;}
  if(state.algoOpen&&algoKey(e)){e.preventDefault();return;}
  if(e.code==='KeyE'){tryInteract();}
  else if(e.code==='KeyB'){if(state.progOpen){closeProg();}else{openProg();}}
  else if(e.code==='KeyQ'){dropActive();}
  else if(e.code==='Digit1'||e.code==='Digit2'||e.code==='Digit3'){var dn=+e.code.slice(5)-1;if(state.portOpen){choosePort(dn);}else if(state.choiceOpen){chooseOpt(dn);}else{selectSlot(dn);}}
  else if(state.panelOpen&&(e.code==='Escape'||e.code==='Enter'||e.code==='Space')){closePanel();}
});
window.addEventListener('keyup',function(e){keys[e.code]=false;});
window.addEventListener('blur',function(){keys={};dragging=false;});
function lockPointer(){
  try{var p=canvas.requestPointerLock();if(p&&p.catch){p.catch(function(){});}}catch(e){}
}
canvas.addEventListener('mousedown',function(){
  if(state.mode!=='play'){return;}
  dragging=true;
  if(document.pointerLockElement!==canvas){lockPointer();}
});
window.addEventListener('mouseup',function(){dragging=false;});
document.addEventListener('mousemove',function(e){
  if(state.mode!=='play'||state.panelOpen){return;}
  if(document.pointerLockElement===canvas||dragging){
    yaw-=e.movementX*0.0028;
    pitch=clamp(pitch+e.movementY*0.0024,0.05,1.25);
  }
});
canvas.addEventListener('wheel',function(e){
  if(state.mode!=='play'){return;}
  e.preventDefault();camDist=clamp(camDist+e.deltaY*0.003,3,7.5);
},{passive:false});

/* sentuh */
var joy={x:0,y:0}, joyId=null, lookId=null, lastLook={x:0,y:0};
function enableTouch(){app.classList.add('touch');}
try{if(matchMedia('(pointer: coarse)').matches){enableTouch();}}catch(e){}
window.addEventListener('touchstart',enableTouch,{passive:true});
var joyEl=$('#joy'), knob=$('#joy-knob');
function joyMove(t){
  var r=joyEl.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  var dx=t.clientX-cx, dy=t.clientY-cy, len=Math.hypot(dx,dy), max=48;
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  knob.style.transform='translate('+dx+'px,'+dy+'px)';
  joy.x=dx/max;joy.y=-dy/max;
}
function joyEnd(){joyId=null;joy.x=0;joy.y=0;knob.style.transform='';}
joyEl.addEventListener('touchstart',function(e){e.preventDefault();var t=e.changedTouches[0];joyId=t.identifier;joyMove(t);},{passive:false});
joyEl.addEventListener('touchmove',function(e){e.preventDefault();for(var i=0;i<e.changedTouches.length;i++){if(e.changedTouches[i].identifier===joyId){joyMove(e.changedTouches[i]);}}},{passive:false});
joyEl.addEventListener('touchend',function(e){for(var i=0;i<e.changedTouches.length;i++){if(e.changedTouches[i].identifier===joyId){joyEnd();}}});
joyEl.addEventListener('touchcancel',joyEnd);
$('#ebtn').addEventListener('touchstart',function(e){e.preventDefault();tryInteract();},{passive:false});
canvas.addEventListener('touchstart',function(e){
  if(state.mode!=='play'||lookId!==null){return;}
  var t=e.changedTouches[0];lookId=t.identifier;lastLook={x:t.clientX,y:t.clientY};
},{passive:true});
canvas.addEventListener('touchmove',function(e){
  e.preventDefault();
  for(var i=0;i<e.changedTouches.length;i++){
    var t=e.changedTouches[i];
    if(t.identifier===lookId&&!state.panelOpen){
      yaw-=(t.clientX-lastLook.x)*0.006;
      pitch=clamp(pitch+(t.clientY-lastLook.y)*0.005,0.05,1.25);
      lastLook={x:t.clientX,y:t.clientY};
    }
  }
},{passive:false});
function lookEnd(e){for(var i=0;i<e.changedTouches.length;i++){if(e.changedTouches[i].identifier===lookId){lookId=null;}}}
canvas.addEventListener('touchend',lookEnd);
canvas.addEventListener('touchcancel',lookEnd);

/* ---------- menu ---------- */
function pickChar(g){
  setKid(g);
  $('#ch-boy').setAttribute('aria-pressed',String(g==='boy'));
  $('#ch-girl').setAttribute('aria-pressed',String(g==='girl'));
}
$('#ch-boy').addEventListener('click',function(){pickChar('boy');});
$('#ch-girl').addEventListener('click',function(){pickChar('girl');});
$('#start').addEventListener('click',function(){
  var a=audio();if(a&&a.resume){a.resume();}
  state.mode='play';
  $('#menu').hidden=true;$('#hud').hidden=false;
  yaw=0;pitch=0.42;kidFace=Math.PI;
  updateStats();updateMission();
  lockPointer();
  canvas.focus();
  say(app.classList.contains('touch')?'Halo! Aku KOMP-BOT. Geser joystick untuk jalan, ya!':'Halo! Aku KOMP-BOT. Ayo jalan pakai tombol W, A, S, D!',true);
});

/* ---------- loop utama ---------- */
var SPEED=4.3, R=0.4, T=0;
var camLook=new THREE.Vector3(0,1.2,4.6), lookT=new THREE.Vector3(), camWant=new THREE.Vector3();
camera.position.set(1.5,1.9,8.2);
var menuA=0;

function moveAxis(dx,dz){
  var nx=clamp(pos.x+dx,-8.55,8.55), nz=clamp(pos.z+dz,-6.55,6.55);
  for(var i=0;i<solids.length;i++){
    var s=solids[i];
    if(s.layer&&!((areaMask>>s.layer)&1)){continue;}
    if(nx>s.x0-R&&nx<s.x1+R&&nz>s.z0-R&&nz<s.z1+R){
      if(dx!==0){nx=dx>0?s.x0-R:s.x1+R;}
      else if(dz!==0){nz=dz>0?s.z0-R:s.z1+R;}
    }
  }
  pos.x=nx;pos.z=nz;
}

function update(dt){
  var play=state.mode==='play';
  var ix=0, iz=0;
  if(play&&!state.panelOpen){
    if(keys.KeyW||keys.ArrowUp){iz+=1;}
    if(keys.KeyS||keys.ArrowDown){iz-=1;}
    if(keys.KeyA){ix-=1;}
    if(keys.KeyD){ix+=1;}
    ix+=joy.x;iz+=joy.y;
    if(keys.ArrowLeft){yaw+=1.9*dt;}
    if(keys.ArrowRight){yaw-=1.9*dt;}
  }
  var len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}
  var fx=-Math.sin(yaw), fz=-Math.cos(yaw), rx=Math.cos(yaw), rz=-Math.sin(yaw);
  var k=Math.min(1,dt*12);
  vel.x+=((fx*iz+rx*ix)*SPEED-vel.x)*k;
  vel.z+=((fz*iz+rz*ix)*SPEED-vel.z)*k;
  if(Math.abs(vel.x)<0.01){vel.x=0;}
  if(Math.abs(vel.z)<0.01){vel.z=0;}
  if(vel.x!==0){moveAxis(vel.x*dt,0);}
  if(vel.z!==0){moveAxis(0,vel.z*dt);}

  /* karakter */
  var sp=Math.hypot(vel.x,vel.z), kk=Math.min(1,sp/SPEED);
  if(play){
    if(sp>0.25){kidFace=Math.atan2(vel.x,vel.z);}
    kid.root.rotation.y=lerpAngle(kid.root.rotation.y,kidFace,Math.min(1,dt*12));
  }else{
    var toCam=Math.atan2(camera.position.x-pos.x,camera.position.z-pos.z);
    kid.root.rotation.y=lerpAngle(kid.root.rotation.y,toCam,Math.min(1,dt*6));
  }
  phase+=sp*dt*2.6;
  kid.root.position.set(pos.x,Math.abs(Math.sin(phase))*0.05*kk+(play?0:Math.sin(T*2)*0.012),pos.z);
  kid.legs[0].rotation.x=Math.sin(phase)*0.8*kk;
  kid.legs[1].rotation.x=-Math.sin(phase)*0.8*kk;
  armWave+=((play?0:1)-armWave)*Math.min(1,dt*6);
  kid.arms[0].rotation.x=-Math.sin(phase)*0.7*kk;
  kid.arms[1].rotation.x=Math.sin(phase)*0.7*kk;
  kid.arms[1].rotation.z=armWave*(2.5+(reduceMotion?0:Math.sin(T*7)*0.25));

  /* KOMP-BOT mengikuti */
  var bx=pos.x+rx*1.25-fx*0.1, bz=pos.z+rz*1.25-fz*0.1;
  bx=clamp(bx,-8.5,8.5);bz=clamp(bz,-6.5,6.5);
  var bk=1-Math.exp(-dt*3.2);
  bot.position.x+=(bx-bot.position.x)*bk;
  bot.position.z+=(bz-bot.position.z)*bk;
  bot.position.y=1.95+(reduceMotion?0:Math.sin(T*2.4)*0.09);
  bot.rotation.y=lerpAngle(bot.rotation.y,Math.atan2(pos.x-bot.position.x,pos.z-bot.position.z),Math.min(1,dt*5));
  bot.rotation.z=clamp((bx-bot.position.x)*-0.2,-0.2,0.2);

  /* kamera */
  if(play){
    var cp=Math.cos(pitch);
    camWant.set(pos.x+Math.sin(yaw)*camDist*cp,1.4+Math.sin(pitch)*camDist,pos.z+Math.cos(yaw)*camDist*cp);
    camWant.x=clamp(camWant.x,-13,13);camWant.z=clamp(camWant.z,-11,11);camWant.y=clamp(camWant.y,0.8,8);
    lookT.set(pos.x,1.4,pos.z);
    if(state.algoView){
      var asp=camera.aspect||1.6, tf=Math.tan((camera.fov||60)*Math.PI/360);
      var need=4.9/(2*tf*Math.min(asp,1.8)), dd=Math.max(4.4,need), ox=0.66*dd, oy=0.75*dd;
      camWant.set(2.5+ox,Math.min(0.2+oy,7.5),4.6);lookT.set(2.5,0.2,4.6);
    }
  }else{
    if(!reduceMotion){menuA=Math.sin(T*0.45)*0.55;}
    camWant.set(pos.x+Math.sin(menuA)*3.9,1.85,pos.z+Math.cos(menuA)*3.9);
    lookT.set(pos.x,1.1,pos.z);
  }
  camera.position.lerp(camWant,1-Math.exp(-dt*(play?9:4)));
  camLook.lerp(lookT,1-Math.exp(-dt*10));
  camera.lookAt(camLook);

  /* penanda dan lampu berkedip */
  for(var i=0;i<interactables.length;i++){
    var s=interactables[i];
    if(s.sprite){
      var hint=!!(state.ch&&state.ch.id===s.id);
      var want=hint?arrowTex.tex:(state.checked[s.id]?okTex.tex:qTex.tex);
      if(s.sprite.material.map!==want){s.sprite.material.map=want;s.sprite.material.needsUpdate=true;}
      s.sprite.position.y=s.baseY+(reduceMotion?0:Math.sin(T*(hint?6:3)+i)*(hint?0.14:0.07));
      var sc=hint?0.85:0.55+(state.checked[s.id]||reduceMotion?0:Math.sin(T*4+i)*0.04);
      s.sprite.scale.set(sc,sc,sc);
    }
  }
  for(var b=0;b<blinkers.length;b++){var bl=blinkers[b];bl.m.color.setHex(Math.sin(T*3+bl.ph)>-0.2?bl.on:bl.off);}

  var AI=allItems();
  for(var q=0;q<AI.length;q++){
    var fi=AI[q];
    if(fi.state==='free'){
      fi.model.position.y=0.42+(reduceMotion?0:Math.sin(T*2.2+fi.ph)*0.07);
      if(!reduceMotion){fi.model.rotation.y+=dt*0.9;}
      var rs=1+(reduceMotion?0:Math.sin(T*3+fi.ph)*0.06);fi.ring.scale.set(rs,rs,rs);
    }
  }

  if(state.l2Active){
    var l2on=!state.l2Done;
    ghostMat.opacity=reduceMotion?0.35:0.25+0.15*Math.sin(T*4);
    for(var gk in ghosts){var gs=l2on&&!state.l2in[gk];ghosts[gk].visible=gs;glabels[gk].visible=gs;}
    cpuLabel.visible=l2on&&!(state.l2in.power&&state.l2in.hdmi&&state.l2in.usbcable);
    asmArrow.visible=l2on&&!boot.active;
    asmArrow.position.y=3.7+(reduceMotion?0:Math.sin(T*4)*0.15);
    if(boot.active){
      boot.t+=dt;scr.p=Math.min(1.02,boot.t/4);
      if(boot.t-boot.last>0.12){boot.last=boot.t;bootT.redraw();}
      if(boot.t>=4.5){boot.active=false;scr.p=1.02;bootT.redraw();finishLevel2();}
    }
  }

  if(state.l3Active){
    var hi3=heldItem();
    l3Arrow.visible=!state.l3Done&&!!(hi3&&hi3.def.l3);
    l3Arrow.position.y=3.4+(reduceMotion?0:Math.sin(T*4)*0.15);
    var ZK=Object.keys(ZONES);
    for(var zi=0;zi<ZK.length;zi++){
      var zz=ZONES[ZK[zi]];
      if(zz.flash>0){zz.flash-=dt;zz.flashMesh.material.opacity=Math.max(0,zz.flash/0.8)*0.65;}else{zz.flashMesh.material.opacity=0;}
      if(zz.shake>0){zz.shake-=dt;zz.g.position.x=zz.x+(reduceMotion?0:Math.sin(T*70)*0.07*Math.min(1,zz.shake/0.2));}else{zz.g.position.x=zz.x;}
      if(zz.popT>0){zz.popT-=dt;zz.pop.visible=true;zz.pop.position.y=0.5+(1-zz.popT)*0.9;}else{zz.pop.visible=false;}
    }
  }

  if(state.l4Active){
    var on4=!state.l4Done;
    svc.arrow.visible=on4&&svc.checkedN===0&&!svc.busy;
    svc.arrow.position.y=3.5+(reduceMotion?0:Math.sin(T*4)*0.15);
    for(var ci4=0;ci4<svc.list.length;ci4++){
      var cp4=svc.list[ci4];
      if(!cp4.rec.active){continue;}
      var w4=cp4.st==='bad'?warnTex.tex:(cp4.st==='new'?qTex.tex:okTex.tex);
      if(cp4.sprite.material.map!==w4){cp4.sprite.material.map=w4;cp4.sprite.material.needsUpdate=true;}
      cp4.sprite.position.y=cp4.baseY+(reduceMotion?0:Math.sin(T*(cp4.st==='bad'?6:3)+cp4.ph)*0.08);
    }
    if(svc.scr==='boot'){
      svc.p+=dt/2.6;svc.pt+=dt;
      if(svc.p>=1){svc.scr='desk';svcT.redraw();}
      else if(svc.pt>0.1){svc.pt=0;svcT.redraw();}
    }
    if(svc.scr==='kbbad'){
      var bl4=Math.floor(T*2)%2;
      if(bl4!==svc.blink){svc.blink=bl4;svcT.redraw();}
    }
    if(play&&!state.panelOpen&&on4&&!svc.busy){
      svc.idle+=dt;
      if(svc.idle>40){
        svc.idle=0;
        say(svc.found?'Bagian bertanda ! bermasalah. Dekati lalu tekan E untuk memperbaikinya.':'Periksa bagian bertanda ? satu per satu. Kabel ada di belakang meja, ayo jalan memutar!');
      }
    }
  }

  if(state.l5Active){
    var hi5=heldItem(), cab=hi5&&hi5.def.l5?hi5:null;
    nw.arrow.visible=!nw.done&&!!cab;
    nw.arrow.position.y=3.2+(reduceMotion?0:Math.sin(T*4)*0.15);
    if(cab&&cab.l5.end){
      var pe=nw.ports[cab.l5.end].def.p;
      setNetLine({x:pe[0],y:pe[1],z:pe[2]},{x:pos.x,y:1.0,z:pos.z});nw.lineM.visible=true;
    }else{nw.lineM.visible=false;}
    if(play&&!state.panelOpen&&!nw.done){
      nw.idle+=dt;
      if(nw.idle>40){
        nw.idle=0;
        say(cab?'Colokkan kabel ke port di PC, Switch, Router, atau Internet. '+netHint():'Cari kabel LAN bercincin biru di lantai.');
      }
    }
  }

  if(state.l6Active){
    SITS.forEach(function(q,i){
      if(q.sprite.visible){q.sprite.position.y=q.sy+(reduceMotion?0:Math.sin(T*3+i)*0.08);}
    });
    if(sec.shake>0){
      sec.shake-=dt;
      sec.usb.m.position.x=(reduceMotion?0:Math.sin(T*60)*0.04);
      if(sec.shake<=0){sec.usbMat.color.setHex(0x3B82F6);sec.usb.m.position.x=0;}
    }
    if(sec.fly){
      sec.fly.t+=dt/1.3;
      var ft=Math.min(1,sec.fly.t), ug2=sec.usb.g;
      ug2.position.x=sec.fly.x0+(TEACHER_BOX[0]-sec.fly.x0)*ft;
      ug2.position.z=sec.fly.z0+(TEACHER_BOX[2]-sec.fly.z0)*ft;
      ug2.position.y=Math.sin(ft*Math.PI)*1.1+(TEACHER_BOX[1]-0.14)*ft;
      sec.usb.ring.visible=false;
      if(ft>=1){ug2.visible=false;sec.fly=null;}
    }
    if(play&&!state.panelOpen&&!state.l6Done){
      sec.idle+=dt;
      if(sec.idle>40){sec.idle=0;say('Cari situasi bertanda !: flashdisk di lantai dan tiga komputer di lab.');}
    }
  }

  if(state.l7Active){
    algoUpdate(dt,T);
    if(play&&!state.panelOpen&&!state.l7Done){
      algo.idle+=dt;
      if(algo.idle>40){algo.idle=0;say('Dekati Konsol Robot bertanda ! di dekat arena, lalu tekan E.');}
    }
  }

  if(state.l8Active){
    if(Math.abs(L8.light-L8.lightTo)>0.002){
      L8.light+=(L8.lightTo-L8.light)*Math.min(1,dt*(L8.lightTo>L8.light?1.4:6));
      hemi.intensity=0.82*(0.4+0.6*L8.light);sun.intensity=0.55*(0.3+0.7*L8.light);
    }
    L8.marks.forEach(function(m,i){if(m.sp.visible){m.sp.position.y=m.y+(reduceMotion?0:Math.sin(T*3+i*1.7)*0.08);}});
    if(L8.scr==='boot'){
      L8.p+=dt/3;L8.pt+=dt;
      if(L8.p>=1){setL8Scr('desk');L8.busy=false;L8.s[3]=true;addXP(20);sfx.reward();say('Komputer menyala! Buka program LAPORAN dengan E.');updateMission();}
      else if(L8.pt>0.1){L8.pt=0;l8T.redraw();}
    }else if(L8.scr==='run'){
      L8.p+=dt/2.5;L8.pt+=dt;
      if(L8.p>=1){setL8Scr('done');L8.busy=false;L8.s[4]=true;addXP(30);sfx.reward();say('Program selesai! Laporan siap. Kirim hasilnya ke printer.');updateMission();}
      else if(L8.pt>0.1){L8.pt=0;l8T.redraw();}
    }
    if(L8.print){
      L8.print.t+=dt;
      var pk=Math.min(1,L8.print.t/2);
      L8.paper.position.x=7.52-0.26*pk;
      if(L8.print.t>=2.6){
        L8.print=null;L8.busy=false;L8.s[5]=true;addXP(30);sfx.reward();updateMission();
        say('Cetak selesai! Sekarang nyalakan seluruh lab...',true);
        setTimeout(finishLevel8,900);
      }
    }
    if(play&&!state.panelOpen&&!state.l8Done&&!L8.busy){
      L8.idle+=dt;
      if(L8.idle>40){L8.idle=0;say(l8Next());}
    }
  }

  updateGuideHUD();

  /* target interaksi, tutorial, petunjuk */
  if(play&&!state.panelOpen){
    target=pickTarget();
    setHL(target);
    if(hl){var kp=0.35+0.15*Math.sin(T*6);hl.mats.forEach(function(m){m.emissive.setHex(0xFFD84A);m.emissiveIntensity=kp;});}
    if(target!==lastPrompt){
      lastPrompt=target;
      var pr=$('#prompt');
      if(target){
        $('#pr-main').textContent=(target.id==='door'&&state.doorTo)?'Masuk':target.isL8?l8Label(target):target.isAlgo?'Pakai':target.isSit?'Periksa':target.isNetPort?(heldItem()&&heldItem().def.l5?'Colokkan':'Lihat'):target.isCheck?(target.cp.st==='bad'?target.cp.def.act:'Periksa'):target.isItem?'Pick Up':((target.isCrate||target.isAsm||target.isCpu||target.isZone)&&heldItem()?'Place':'Interact');
        $('#pr-sub').textContent=target.name;pr.hidden=false;
        if(target.isItem&&!state.itemHint&&tut.step>=3){state.itemHint=true;say('Benda berkilau ini bisa diambil. Tekan E untuk Pick Up.');}
      }else{pr.hidden=true;}
    }
    if(tut.step===0&&Math.hypot(pos.x-SPAWN.x,pos.z-SPAWN.z)>3){tut.step=1;if(!startChallenge('Bagus! ')){say('Bagus! Sekarang coba dekati komputer.',true);}}
    else if(tut.step===1&&target){tut.step=2;say(app.classList.contains('touch')?'Sudah dekat! Tekan tombol E, ya.':'Sudah dekat! Tekan tombol E, ya.',true);}
    idleT+=dt;
    if(state.ch){
      chT+=dt;
      if(!state.hintOn&&chT>28){state.hintOn=true;say(state.ch.hint);}
    }
    if(tut.step>=3&&!state.stageDone&&idleT>35){idleT=0;say(state.ch?'Ingat, kita sedang mencari '+state.ch.name+'!':'Cari tanda ? yang melayang. Dekati perangkatnya lalu tekan E.');}
  }else if(state.panelOpen){
    setHL(null);lastPrompt=null;
  }
}

setArea(1,false);
var last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  var dt=Math.min(0.05,(now-last)/1000);last=now;T+=dt;
  update(dt);
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);

try{
  if(document.fonts&&document.fonts.load){
    Promise.all([document.fonts.load('800 40px "Baloo 2"'),document.fonts.load('700 16px "Nunito"')]).then(function(){
      redrawables.forEach(function(r){r.redraw();});
    }).catch(function(){});
  }
}catch(e){}
})();