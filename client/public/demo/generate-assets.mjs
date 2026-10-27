import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// All compositions, text and vector artwork here are original project assets.
const here = path.dirname(fileURLToPath(import.meta.url));
const covers = path.resolve(here, '../covers');
fs.mkdirSync(covers, { recursive: true });
const records = [
  ['demo-midnight','Midnight Drive','Kairo','Nocturnal','Electronic',0,48,[0,7,10,14],[0,7,12,10,7,3,2,7]],
  ['demo-tides','Tides','Solène','Between Waves','Ambient',1,50,[0,7,12,16],[7,12,14,16,14,12,7,4]],
  ['demo-afterglow','Afterglow','Nova Lane','Golden Hours','Chill',2,45,[0,7,12,16],[0,4,7,12,11,7,4,2]],
  ['demo-blue','Blue Hour','Vesper','Quiet City','Lo-fi',3,48,[0,7,10,14],[0,3,7,10,7,5,3,2]],
  ['demo-slow','Slow Motion','Luma','Soft Focus','Downtempo',4,53,[0,7,12,15],[7,10,12,15,12,10,7,3]],
  ['demo-somewhere','Somewhere','The Paper Sky','Open Windows','Indie',5,48,[0,7,12,16],[0,7,9,12,9,7,4,2]],
];
const lines = [
  ['Phố lên đèn trong miền mơ tím','Một nhịp xe đưa gió qua thềm','Ta gom những thanh âm rất khẽ','Thả vào đêm một vệt sao mềm','Dẫu con đường còn xa phía trước','Bình yên đang ở cạnh ta rồi'],
  ['Sóng mang màu trời vừa thức giấc','Chạm bờ cát bằng tiếng thầm thì','Em nghe biển trong lòng tay nhỏ','Mỗi nhịp trôi là một điều gì','Cứ để gió đưa ngày đi chậm','Mình ở đây cùng biển bao la'],
  ['Nắng cuối ngày vương trên ô cửa','Một khoảng trời chợt hóa màu cam','Ta giữ lại hơi ấm rất nhẹ','Trong tim mình một đốm dịu dàng','Khi thành phố vừa lên ánh sáng','Ngày còn ngân như tiếng đàn xa'],
  ['Có một giờ trời xanh rất khẽ','Những mái nhà nghiêng bóng trong mưa','Ta ngồi nghe phố phường chậm lại','Một tiếng cười từ buổi chiều xưa','Đêm đang đến bằng đôi chân nhẹ','Để lòng mình thôi những đợi chờ'],
  ['Chậm một chút nghe ngày đang thở','Mây vừa qua bên mép ly trà','Những điều nhỏ trở thành ánh sáng','Khi lòng mình rộng như hiên nhà','Cứ thong thả qua từng khoảnh khắc','Thời gian mềm như một lời ca'],
  ['Có một nơi nằm sau ô cửa','Trời rất trong và gió rất hiền','Ta gấp những muộn phiền thành giấy','Cho bay lên qua một triền miên','Nếu ngày mai còn nhiều điều lạ','Mình cùng đi về phía bình yên'],
];

function wav(record) {
  const rate=22050, seconds=28, count=rate*seconds;
  const buffer=Buffer.alloc(44+count*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
  const root=record[6], chord=record[7], melody=record[8], variant=record[5];
  const freq = n => 440*Math.pow(2,(n-69)/12);
  const sine = (hz,t)=>Math.sin(2*Math.PI*hz*t);
  for(let i=0;i<count;i++) {
    const t=i/rate, step=Math.floor(t/.875), mt=t%.875, bar=Math.floor(t/3.5), ct=t%3.5;
    const trans=[0,-2,-5,-3][bar%4];
    let sound=0;
    for(let n=0;n<chord.length;n++) {
      const hz=freq(root+chord[n]+trans), env=Math.min(ct/.35,1)*Math.min((3.5-ct)/.7,1);
      sound+=.032*env*(sine(hz,t)+.25*sine(hz*2.001,t)+.11*sine(hz*3,t));
    }
    const mhz=freq(root+12+melody[(step+variant)%melody.length]+trans);
    const menv=Math.min(mt/.018,1)*Math.exp(-mt*3.4);
    sound+=.12*menv*(sine(mhz,t)+.2*sine(mhz*2,t));
    // Quiet bass and a soft pulse, all synthesized without recordings.
    const pulse=t%.4375, beat=Math.exp(-pulse*32);
    sound+=.055*sine(freq(root-12+trans),t)*(.7+.3*Math.sin(t*2));
    sound+=.045*beat*sine(52+45*Math.exp(-pulse*45),t);
    const fade=Math.min(t/1.1,1)*Math.min((seconds-t)/1.7,1);
    buffer.writeInt16LE(Math.round(Math.tanh(sound)*fade*26000),44+i*2);
  }
  fs.writeFileSync(path.join(here,record[0]+'.wav'),buffer);
}
function svg(defs,body,bg='#12121d') { return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs>${defs}<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter><filter id="glow"><feGaussianBlur stdDeviation="20"/></filter></defs><rect width="800" height="800" fill="${bg}"/>${body}<rect width="800" height="800" filter="url(#grain)" opacity=".5"/></svg>`; }
const arts = [
  svg(`<linearGradient id="sky" x2="0" y2="1"><stop stop-color="#0f1238"/><stop offset=".6" stop-color="#5650a2"/><stop offset="1" stop-color="#c8a7b9"/></linearGradient><radialGradient id="moon"><stop stop-color="#e8d3ff"/><stop offset="1" stop-color="#a391da"/></radialGradient><linearGradient id="road" x1="0" x2="1"><stop stop-color="#100c25"/><stop offset=".5" stop-color="#60548e"/><stop offset="1" stop-color="#17102e"/></linearGradient>`, `<rect width="800" height="800" fill="url(#sky)"/><circle cx="560" cy="250" r="110" fill="#c7bbff" opacity=".16" filter="url(#glow)"/><circle cx="560" cy="250" r="67" fill="url(#moon)"/><path d="M0 440 130 330 260 440 390 355 550 435 660 350 800 395V800H0Z" fill="#2a2555"/><path d="M0 500 180 440 310 510 500 445 800 490V800H0Z" fill="#18172f"/><path d="M390 460C390 540 545 565 570 650S420 735 415 800H730C730 705 640 657 620 610S440 520 440 460Z" fill="url(#road)"/><path d="M415 470C415 550 578 582 595 653S570 730 560 800" fill="none" stroke="#efd6eb" stroke-width="4" stroke-dasharray="28 25" opacity=".6"/><g fill="#d7ceff" opacity=".7"><circle cx="125" cy="132" r="2"/><circle cx="280" cy="96" r="1.6"/><circle cx="670" cy="110" r="2"/><circle cx="358" cy="220" r="1.2"/></g>`),
  svg(`<linearGradient id="sea" x2="1" y2="1"><stop stop-color="#125a63"/><stop offset=".5" stop-color="#62b2a8"/><stop offset="1" stop-color="#d4eadb"/></linearGradient><linearGradient id="wave"><stop stop-color="#e2f3e7"/><stop offset="1" stop-color="#3c8a90"/></linearGradient>`, `<rect width="800" height="800" fill="url(#sea)"/><path d="M-100 520C80 170 400 70 850 390" fill="none" stroke="#a4d5c5" stroke-width="125" opacity=".35"/><path d="M-70 570C120 280 430 250 880 520" fill="none" stroke="url(#wave)" stroke-width="83"/><path d="M-40 620C140 390 470 420 840 640" fill="none" stroke="#d8eee0" stroke-width="29" opacity=".7"/><path d="M-60 700C230 470 500 530 900 770" fill="none" stroke="#d2ebe0" stroke-width="7" opacity=".65"/><circle cx="600" cy="200" r="74" fill="#cbe5ca" opacity=".85"/>`),
  svg(`<radialGradient id="sun"><stop stop-color="#ffe0a0"/><stop offset=".5" stop-color="#f99a62"/><stop offset="1" stop-color="#ab3659"/></radialGradient><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#843e63"/><stop offset=".6" stop-color="#e47765"/><stop offset="1" stop-color="#edb58e"/></linearGradient>`, `<rect width="800" height="800" fill="url(#bg)"/><circle cx="400" cy="355" r="250" fill="url(#sun)"/><path d="M0 530Q200 440 400 540T800 490V800H0" fill="#9f4561" opacity=".8"/><path d="M0 640Q190 530 420 620T800 610V800H0" fill="#613349"/><path d="M0 750Q240 660 500 720T800 700V800H0" fill="#372837"/><g stroke="#ffdebd" opacity=".35"><path d="M280 530H520"/><path d="M220 546H580"/><path d="M190 563H610"/><path d="M150 580H650"/></g>`),
  svg(`<linearGradient id="blue" x2="1" y2="1"><stop stop-color="#132c6f"/><stop offset=".5" stop-color="#2d5c9c"/><stop offset="1" stop-color="#88b1cc"/></linearGradient><linearGradient id="glass"><stop stop-color="#a7d8e0" stop-opacity=".65"/><stop offset="1" stop-color="#41699e" stop-opacity=".1"/></linearGradient>`, `<rect width="800" height="800" fill="url(#blue)"/><circle cx="600" cy="170" r="96" fill="#bad7ed" opacity=".65"/><g fill="url(#glass)" stroke="#a3c9e0" stroke-opacity=".25"><path d="M120 260 295 185 295 670 120 750Z"/><path d="M295 185 520 290 520 750 295 670Z"/><path d="M395 400 590 325 590 800 395 800Z"/><path d="M590 325 730 415 730 800 590 800Z"/></g><g stroke="#a8d6f3" stroke-width="3" opacity=".3"><path d="M149 360 265 310M149 400 265 350M149 440 265 390M149 480 265 430M149 520 265 470M149 560 265 510M149 600 265 550M149 640 265 590"/></g>`),
  svg(`<radialGradient id="pink"><stop stop-color="#f5d6f5"/><stop offset=".4" stop-color="#cf8cce"/><stop offset="1" stop-color="#663a88"/></radialGradient><linearGradient id="silk" x2="1" y2="1"><stop stop-color="#f0c0dc"/><stop offset=".4" stop-color="#d1a3db"/><stop offset="1" stop-color="#6a67a3"/></linearGradient>`, `<rect width="800" height="800" fill="#3d2e57"/><circle cx="420" cy="400" r="315" fill="url(#pink)" opacity=".65"/><g fill="none" stroke="url(#silk)"><ellipse cx="400" cy="400" rx="270" ry="100" stroke-width="75" transform="rotate(-35 400 400)"/><ellipse cx="400" cy="400" rx="220" ry="260" stroke-width="34" transform="rotate(-35 400 400)"/><ellipse cx="400" cy="400" rx="115" ry="215" stroke-width="22" transform="rotate(-35 400 400)"/></g><circle cx="270" cy="220" r="30" fill="#f1d0e6" opacity=".75" filter="url(#glow)"/>`),
  svg(`<linearGradient id="green" x2="0" y2="1"><stop stop-color="#dbe2bd"/><stop offset="1" stop-color="#6c8f86"/></linearGradient><linearGradient id="paper"><stop stop-color="#f6edd5"/><stop offset="1" stop-color="#c2c7b2"/></linearGradient>`, `<rect width="800" height="800" fill="url(#green)"/><circle cx="590" cy="190" r="90" fill="#f2e6bd" opacity=".7"/><path d="M0 600 140 490 290 550 450 420 800 580V800H0Z" fill="#75968c"/><path d="M0 680 210 570 400 640 590 510 800 620V800H0Z" fill="#446c68"/><path d="M90 390 680 235 423 535 350 410Z" fill="url(#paper)"/><path d="M350 410 680 235 395 458 423 535Z" fill="#a5b9af"/><path d="M350 410 395 458 320 490Z" fill="#eff0db"/>`),
];
const metadata=[];
for(let n=0;n<records.length;n++) {
  const r=records[n]; wav(r);
  fs.writeFileSync(path.join(covers,r[0]+'.svg'),arts[n]);
  fs.writeFileSync(path.join(here,r[0]+'.lrc'),`[ti:${r[1]}]\n[ar:${r[2]}]\n[al:${r[3]}]\n[by:Auralis original demo]\n`+lines[n].map((line,i)=>`[00:${String(1+i*4).padStart(2,'0')}.00] ${line}`).join('\n')+'\n');
  metadata.push({id:r[0],title:r[1],artist:r[2],album:r[3],genre:r[4],duration:28,coverUrl:`/covers/${r[0]}.svg`,audioUrl:`/demo/${r[0]}.wav`,hasLyrics:true,isDemo:true,ownerId:null});
}
const hero=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="760" viewBox="0 0 1600 760"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#171d45"/><stop offset=".48" stop-color="#7f70aa"/><stop offset=".7" stop-color="#c4a8bb"/><stop offset="1" stop-color="#292e55"/></linearGradient><linearGradient id="lake" x2="0" y2="1"><stop stop-color="#786a98"/><stop offset="1" stop-color="#141b34"/></linearGradient><radialGradient id="haze"><stop stop-color="#e0b6d2" stop-opacity=".6"/><stop offset="1" stop-color="#cdb6d5" stop-opacity="0"/></radialGradient><filter id="mist"><feGaussianBlur stdDeviation="21"/></filter><filter id="grain"><feTurbulence baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer></filter></defs><rect width="1600" height="760" fill="url(#sky)"/><ellipse cx="1110" cy="330" rx="430" ry="270" fill="url(#haze)"/><circle cx="1160" cy="225" r="67" fill="#f2d8e7" opacity=".8"/><path d="M0 440 170 270 270 345 470 135 655 350 800 250 1025 425 1170 340 1410 155 1600 340V760H0Z" fill="#5c5c8e"/><path d="M280 345 470 135 550 248 490 234 463 259 432 240 393 288 365 275Z" fill="#a2a0c4" opacity=".65"/><path d="M1190 320 1410 155 1490 231 1406 204 1370 238 1335 226Z" fill="#b1aacb" opacity=".5"/><path d="M0 445 230 360 360 415 600 320 800 420 940 345 1140 460 1350 360 1600 430V760H0Z" fill="#353c68"/><path d="M0 485Q450 420 850 490T1600 470V760H0Z" fill="url(#lake)"/><path d="M0 471Q600 447 1000 487T1600 466" stroke="#d0b5cd" fill="none" opacity=".4" stroke-width="4" filter="url(#mist)"/><ellipse cx="1160" cy="544" rx="97" ry="19" fill="#e9c2df" opacity=".22" filter="url(#mist)"/><g stroke="#bfa1c5" opacity=".16"><path d="M1000 535H1310"/><path d="M1040 553H1290"/><path d="M975 580H1340"/><path d="M930 625H1380"/></g><path d="M0 660 180 576 280 655 415 600 560 704 780 760H0Z" fill="#101b30"/><path d="M1600 530 1470 565 1430 628 1300 686 1220 760H1600Z" fill="#111a30"/><g fill="#0e1729"><path d="M1400 690V450L1375 523H1388L1362 572H1379L1345 630H1387L1368 672Z"/><path d="M1490 647V380L1450 475H1470L1430 540H1460L1412 612H1470L1450 650Z"/><path d="M1547 620V420L1520 480H1530L1501 540H1522L1498 590H1533Z"/><path d="M107 701V511L79 577H96L61 636H88L57 685H99Z"/></g><rect width="1600" height="760" filter="url(#grain)" opacity=".65"/></svg>`;
fs.writeFileSync(path.join(covers,'hero.svg'),hero);
fs.writeFileSync(path.join(here,'sample.lrc'),'[ti:Lời mẫu Auralis]\n[ar:Tác giả của bạn]\n[00:01.00] Một ngày mới đang mở ra\n[00:05.50] Ánh nắng chạm bên hiên nhà\n[00:10.00] Ta cùng nghe tiếng gió hát\n[00:15.25] Và giữ bình yên trong ta\n');
const dataDir=path.resolve(here,'../../../server/src/data');fs.mkdirSync(dataDir,{recursive:true});
fs.writeFileSync(path.join(dataDir,'demo.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Created 6 original WAV, 7 LRC, 7 SVG and demo metadata.');
