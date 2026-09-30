import * as THREE from "./assets/vendor/three.module.js";
import { Reflector } from "./assets/vendor/Reflector.js";
import { DURATION, STORY } from "./city-flight.js";

export function createCity(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0c2331, .0042);
  const camera = new THREE.PerspectiveCamera(52, 1, .3, 720);
  renderer.setClearColor(0x030a13);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  scene.add(new THREE.HemisphereLight(0x7ba9cc, 0x080c17, 1.1));
  const moon = new THREE.DirectionalLight(0x93bddc, 2.8);
  moon.position.set(-65, 110, 50); scene.add(moon);
  const rim = new THREE.DirectionalLight(0xffb476, 1.2);
  rim.position.set(70, 55, -150); scene.add(rim);

  // A local lighting environment gives metal and glass a real reflective finish.
  const environmentFaces = Array.from({length: 6}, (_, index) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d"), gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#56758b"); gradient.addColorStop(.44, "#0e293a");
    gradient.addColorStop(.62, "#1f475c"); gradient.addColorStop(1, "#050a12");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = index % 2 ? "#304453" : "#53667a"; ctx.fillRect(28, 65, 16, 100);
    ctx.fillStyle = "#bd865c"; ctx.fillRect(195, 110, 9, 55);
    return canvas;
  });
  const environment = new THREE.CubeTexture(environmentFaces);
  environment.colorSpace = THREE.SRGBColorSpace; environment.needsUpdate = true; scene.environment = environment;

  const city = new THREE.Group(), left = new THREE.Group(), right = new THREE.Group(), street = new THREE.Group();
  city.add(left, right, street); scene.add(city);
  const district = (x) => x < -11 ? left : x > 11 ? right : street;
  const batches = new Map(), facadeParts = [];
  const cube = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
  const material = {
    metal: new THREE.MeshStandardMaterial({color: 0x233342, metalness: .83, roughness: .28, envMapIntensity: .8}),
    dark: new THREE.MeshStandardMaterial({color: 0x070f19, metalness: .6, roughness: .48}),
    silver: new THREE.MeshStandardMaterial({color: 0x577789, metalness: .9, roughness: .25}),
    gold: new THREE.MeshStandardMaterial({color: 0x75513b, metalness: .82, roughness: .32}),
    cyan: new THREE.MeshBasicMaterial({color: new THREE.Color("#64e8f5").multiplyScalar(1.6)}),
    warm: new THREE.MeshBasicMaterial({color: new THREE.Color("#ffc582").multiplyScalar(1.4)}),
    violet: new THREE.MeshBasicMaterial({color: new THREE.Color("#b6a1fb").multiplyScalar(1.5)}),
    white: new THREE.MeshBasicMaterial({color: new THREE.Color("#daeeff").multiplyScalar(1.5)}),
    red: new THREE.MeshBasicMaterial({color: new THREE.Color("#fe4969").multiplyScalar(1.4)})
  };
  function box(mat, x, y, z, w, h, d, rotation = 0, parent = district(x)) {
    const key = mat.uuid + ":" + parent.uuid;
    if (!batches.has(key)) batches.set(key, {mat, parent, items: []});
    batches.get(key).items.push({x, y, z, w, h, d, rotation});
  }
  function glass(x, y, z, w, h, d, seed, rotation = 0, parent = district(x), style = 1) {
    facadeParts.push({x, y, z, w, h, d, seed, rotation, parent, style});
  }
  let seed = 8357;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const timeUniform = {value: 0};

  const facade = new THREE.ShaderMaterial({
    uniforms: {uTime: timeUniform, uFog: {value: new THREE.Color(0x0c2331)}},
    vertexShader: `
      attribute vec3 aSize; attribute float aSeed; attribute float aStyle;
      varying vec3 vLocal; varying vec3 vNormal; varying vec3 vSize; varying vec3 vWorld;
      varying vec3 vView; varying float vSeed; varying float vDepth; varying float vStyle;
      void main(){
        vLocal=position; vSize=aSize; vSeed=aSeed; vStyle=aStyle;
        mat3 turn=mat3(instanceMatrix);
        vNormal=normalize(mat3(modelMatrix)*turn*normal);
        vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);
        vec4 view=viewMatrix*world;
        vView=cameraPosition-world.xyz; vWorld=world.xyz; vDepth=-view.z;
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: `
      precision highp float;
      uniform float uTime; uniform vec3 uFog;
      uniform vec3 uBeamOrigins[6]; uniform vec3 uBeamDirections[6]; uniform vec3 uBeamColors[6];
      varying vec3 vLocal; varying vec3 vNormal; varying vec3 vSize; varying vec3 vWorld;
      varying vec3 vView; varying float vSeed; varying float vDepth; varying float vStyle;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        bool side=abs(vNormal.x)>abs(vNormal.z);
        vec2 uv=vec2(side?vLocal.z:vLocal.x,vLocal.y)+.5;
        vec2 size=vec2(side?vSize.z:vSize.x,vSize.y);
        vec2 pane=uv*size*vec2(.65,.29), cell=floor(pane), f=fract(pane);
        vec2 aa=fwidth(pane)*1.2;
        float window=smoothstep(.13,.13+aa.x,f.x)*(1.-smoothstep(.85-aa.x,.85,f.x));
        window*=smoothstep(.12,.12+aa.y,f.y)*(1.-smoothstep(.81-aa.y,.81,f.y));
        float room=hash(floor(cell/vec2(3.,1.))+vSeed*900.);
        float occupied=smoothstep(.89,.92,room);
        float intensity=(.15+.7*hash(cell+vSeed*555.))*(.7+.3*smoothstep(.35,.8,f.y));
        vec3 light=mix(vec3(.13,.48,.57),vec3(.85,.49,.22),step(.8,hash(floor(cell/vec2(4.,3.))+vSeed)));
        float fresnel=pow(clamp(1.-abs(dot(normalize(vView),normalize(vNormal))),0.,1.),3.);
        vec3 body=vec3(.009,.018,.029)+vec3(.018,.043,.058)*fresnel;
        float horizontal=1.-smoothstep(.025,.075,min(f.y,1.-f.y));
        float vertical=1.-smoothstep(.025,.075,min(f.x,1.-f.x));
        body+=vec3(.004,.008,.011)*(horizontal+vertical)*.3;
        body+=vec3(.015,.025,.028)*sin(uv.y*size.y*.25+vSeed*40.)*fresnel;
        float lightAmount=.18;
        if(vStyle<.5){
          // Ceramic panels with a small number of recessed vertical glass bands.
          float band=1.-smoothstep(.09,.13,abs(fract(uv.x*3.)-.5));
          vec3 ceramic=vec3(.037,.061,.075)*(.72+.28*max(vNormal.z,0.));
          body=mix(ceramic,body,band);
          occupied*=band; lightAmount=.13;
          body*=.95+.05*sin(uv.y*size.y*.7);
        }else if(vStyle>1.5&&vStyle<2.5){
          // A diagrid skin is drawn at architectural scale, with few lit panes.
          vec2 panel=uv*size*vec2(.12,.12);
          float diagonal=min(abs(fract(panel.x+panel.y)-.5),abs(fract(panel.x-panel.y)-.5));
          float frame=1.-smoothstep(.018,.036,diagonal);
          body=mix(body,vec3(.058,.067,.078),frame*.65);
          lightAmount=.08;
        }else if(vStyle>2.5){
          body*=.8; occupied*=.35; lightAmount=.08;
        }
        vec3 color=body+light*window*occupied*intensity*lightAmount;
        float service=step(.95,fract(uv.y*size.y*.042+vSeed));
        color=mix(color,body*.6,service*.7);
        if(abs(vNormal.y)>.7)color=vec3(.011,.018,.026);
        for(int i=0;i<6;i++){
          vec3 ray=vWorld-uBeamOrigins[i];float distance=length(ray);
          float cone=smoothstep(.86,.96,dot(normalize(ray),uBeamDirections[i]));
          float incidence=.25+.75*max(0.,dot(vNormal,-normalize(ray)));
          color+=uBeamColors[i]*cone*incidence*.20/(1.+distance*distance*.00028);
        }
        float fog=1.-exp(-vDepth*vDepth*.000012);
        gl_FragColor=vec4(mix(color,uFog,clamp(fog,0.,.93)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });

  function tower(x, z, w, d, h, type, s) {
    const podium = 3 + s * 3;
    box(material.dark, x, podium / 2, z, w + 2.3, podium, d + 2.3);
    glass(x, (h + podium) / 2, z, w, h - podium, d, s, 0, district(x), type);
    for (let y = podium; y <= h; y += type === 1 ? 14 : 18) {
      box(material.metal, x, y, z, w + .5, .22, d + .5);
      if (y > h * .8) box(s > .6 ? material.warm : material.cyan, x, y + .12, z + d / 2 + .28, w, .045, .06);
    }
    const fins = type === 0 ? 3 : type === 1 ? 4 : 1;
    for (let i = 0; i <= fins; i++) {
      const fx = x - w / 2 + i * w / fins;
      box(material.metal, fx, (h + podium) / 2, z + d / 2 + .12, .13, h - podium, .4);
    }
    for (const sx of [-1, 1]) {
      box(material.metal, x + sx * (w / 2 + .16), h / 2, z + d / 2, .35, h, .6);
      if (type === 1) box(s > .72 ? material.violet : material.cyan, x + sx * (w / 2 + .36), h * .56, z + d / 2 + .1, .075, h * .74, .12);
    }
    // Glazed street entrances, lintels, and mechanical roof equipment.
    for (let i = 0; i < Math.max(2, Math.floor(w / 4)); i++) {
      const sx = x - w / 2 + 2 + i * 4;
      if (i % 3 === 0) box(material.warm, sx, 1.9, z + d / 2 + 1.18, 2.7, 2.4, .07);
      box(material.dark, sx, 1.9, z + d / 2 + 1.24, .15, 2.5, .1);
    }
    box(material.metal, x, podium + .3, z + d / 2 + 1.3, w + 2.6, .28, 2.4);
    box(material.cyan, x, podium + .15, z + d / 2 + 2.5, w + 2.5, .06, .1);
    for (let j = 0; j < 3; j++) {
      const rx = x + (j - 1) * w * .22;
      box(material.metal, rx, h + 1.1, z, w * .14, 2.2, d * .24);
      for (let k = 0; k < 4; k++) box(material.silver, rx, h + 2.24, z + (k - 1.5) * .4, w * .15, .07, .1);
    }
    if (type === 0) {
      glass(x - w * .13, h + h * .12, z, w * .69, h * .24, d * .77, s + .13, 0, district(x), 0);
      box(material.metal, x - w * .13, h * 1.24, z, w * .74, .35, d * .8);
      glass(x - w * .2, h * 1.31, z, w * .42, h * .14, d * .5, s + .2, 0, district(x), 0);
      box(material.cyan, x - w * .2, h * 1.39, z + d * .26, w * .46, .08, .08);
    } else if (type === 1) {
      const wingH = h * .6;
      for (const sx of [-1, 1]) {
        glass(x + sx * w * .32, h + wingH / 2, z, w * .27, wingH, d * .68, s + sx * .11);
        box(material.metal, x + sx * w * .32, h + wingH, z, w * .31, .35, d * .72);
      }
      box(material.silver, x, h + wingH - .9, z, w * .91, 2.6, d * .45);
      box(material.warm, x, h + wingH + .5, z + d * .23, w * .91, .06, .06);
    } else if (type === 2) {
      glass(x + w * .28, h + 5, z - d * .1, w * .86, 10, d * .7, s + .2, 0, district(x), 2);
      box(material.gold, x + w * .28, h + 10.3, z - d * .1, w * .89, .55, d * .73);
    }
    box(material.silver, x - w * .18, h + 12, z - d * .15, .16, 16, .16);
    box(material.red, x - w * .18, h + 20, z - d * .15, .22, .28, .22);
  }

  // Leave physical space around the landmark footprints, so their silhouettes
  // stay legible rather than intersecting the surrounding curtain-wall blocks.
  const landmarkSites = [
    {x: -78, z: -139, r: 22}, {x: 78, z: -214, r: 22},
    {x: 57, z: -133, r: 17}, {x: -55, z: -198, r: 16}
  ];
  // Irregular blocks, four different silhouettes, and two levels of skyline.
  for (let row = 0; row < 9; row++) {
    for (const side of [-1, 1]) for (let col = 0; col < 3; col++) {
      const x = side * (69 + col * 31 + (random() - .5) * 11);
      const z = 20 - row * 36 + (random() - .5) * 14;
      const w = 12 + random() * 14, d = 12 + random() * 12;
      const h = 18 + random() * (row < 2 ? 33 : 78) + col * 10;
      if (landmarkSites.some(site => Math.abs(x - site.x) < site.r + w / 2 && Math.abs(z - site.z) < site.r + d / 2)) continue;
      tower(x, z, w, d, h, row < 6 ? (row + col) % 4 : 3, random());
    }
  }
  // A quiet skyline closes the street's far end. Large, staggered silhouettes
  // give the wide reveal depth without another field of bright window pixels.
  const skyline = [
    [-164, -374, 35, 125], [-122, -350, 28, 154], [-83, -384, 31, 190],
    [-44, -361, 26, 146], [0, -394, 33, 177], [45, -366, 29, 161],
    [84, -388, 32, 198], [126, -354, 26, 148], [166, -379, 36, 129]
  ];
  skyline.forEach(([x, z, w, h], i) => {
    glass(x, h * .42, z, w, h * .84, 23, .19 + i * .073, 0, street, 3);
    if (i % 3 === 0) {
      glass(x - w * .14, h * .92, z, w * .64, h * .16, 17, .31 + i * .04, 0, street, 0);
    } else if (i % 3 === 1) {
      for (const side of [-1, 1]) glass(x + side * w * .3, h * .92, z, w * .26, h * .16, 15, .42, 0, street, 3);
      box(material.metal, x, h, z, w * .9, .5, 17, 0, street);
    } else {
      glass(x + w * .18, h * .9, z - 3, w * .7, h * .12, 19, .58, 0, street, 2);
      box(material.silver, x + w * .18, h * .963, z - 3, w * .73, .5, 20, 0, street);
    }
    box(material.metal, x, h * .84, z, w + .6, .4, 24, 0, street);
    // Only one short crown light on alternating buildings, softly lost in fog.
    if (i % 2) box(material.cyan, x, h * .84 + .2, z + 12.1, w * .45, .04, .06, 0, street);
  });
  const heroes = [
    {x: -27, z: -31, w: 30, d: 16, h: 43, s: .23, type: 0},
    {x: 28, z: -67, w: 34, d: 18, h: 45, s: .74, type: 1},
    {x: -29, z: -112, w: 37, d: 20, h: 79, s: .46, type: 2}
  ];
  heroes.forEach(b => tower(b.x, b.z, b.w, b.d, b.h, b.type, b.s));

  // A twisting terraced tower, visibly different from the curtain-wall blocks.
  for (const side of [-1, 1]) {
    const x = side * 78, z = side < 0 ? -139 : -214;
    for (let floor = 0; floor < 25; floor++) {
      const y = 8 + floor * 4.4, size = 20 - floor * .28, rotation = side * floor * .026;
      glass(x, y + 1.7, z, size, 3.4, size * .8, .28 + floor * .006, rotation, district(x), 3);
      box(material.silver, x, y + 3.55, z, size + .8, .27, size * .8 + .8, rotation);
      if (floor % 4 === 0) box(material.violet, x, y + 3.75, z + size * .42, size, .055, .08, rotation);
    }
    box(material.silver, x, 123, z, .24, 28, .24);
    box(material.white, x, 137.3, z, .4, .4, .4);
  }

  const curvedCanvas = document.createElement("canvas"); curvedCanvas.width = 1024; curvedCanvas.height = 2048;
  const curvedContext = curvedCanvas.getContext("2d");
  curvedContext.fillStyle = "#07131d"; curvedContext.fillRect(0, 0, 1024, 2048);
  const curvedGradient = curvedContext.createLinearGradient(0, 0, 1024, 0);
  curvedGradient.addColorStop(0, "#0b1c29"); curvedGradient.addColorStop(.35, "#264959");
  curvedGradient.addColorStop(.7, "#091a27"); curvedGradient.addColorStop(1, "#143342");
  curvedContext.fillStyle = curvedGradient; curvedContext.fillRect(0, 0, 1024, 2048);
  for (let col = 0; col < 28; col++) {
    curvedContext.fillStyle = col % 7 ? "#1c3542" : "#375c69";
    curvedContext.fillRect(col * 1024 / 28, 0, 2, 2048);
  }
  for (const y of [360, 790, 1260, 1740]) {
    curvedContext.fillStyle = "#50747a"; curvedContext.fillRect(0, y, 1024, 3);
  }
  const curvedTexture = new THREE.CanvasTexture(curvedCanvas); curvedTexture.colorSpace = THREE.SRGBColorSpace;
  curvedTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const curvedGlass = new THREE.MeshStandardMaterial({map: curvedTexture, color: 0x8badbc, metalness: .65, roughness: .22, emissive: 0xffffff, emissiveMap: curvedTexture, emissiveIntensity: .32, envMapIntensity: .7});
  for (const [x, z, height, radius] of [[57, -133, 118, 10], [-55, -198, 140, 9]]) {
    const parent = district(x);
    const profile = [new THREE.Vector2(radius + 1.8, 0), new THREE.Vector2(radius + 1.8, 8),
      new THREE.Vector2(radius, 12), new THREE.Vector2(radius, height * .7),
      new THREE.Vector2(radius * .78, height * .84), new THREE.Vector2(radius * .62, height)];
    const tower = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), curvedGlass);
    tower.position.set(x, 0, z); parent.add(tower);
    for (const ratio of [.18, .35, .54, .72, .85, 1]) {
      const r = radius * (ratio < .72 ? 1 : ratio < .85 ? .85 : .66) + .6;
      const terrace = new THREE.Mesh(new THREE.CylinderGeometry(r + .8, r + .8, .35, 48), material.metal);
      terrace.position.set(x, height * ratio, z); parent.add(terrace);
      const strip = new THREE.Mesh(new THREE.TorusGeometry(r + .8, .065, 5, 64), ratio > .8 ? material.violet : material.cyan);
      strip.rotation.x = Math.PI / 2; strip.position.set(x, height * ratio + .2, z); parent.add(strip);
    }
    const crown = new THREE.Mesh(new THREE.ConeGeometry(radius * .62, 14, 32), material.silver);
    crown.position.set(x, height + 7, z); parent.add(crown);
    box(material.silver, x, height + 20, z, .16, 16, .16);
    box(material.white, x, height + 28, z, .3, .4, .3);
  }

  // Supported arch and skybridge anchor the far perspective.
  const archPoints = Array.from({length: 31}, (_, i) => {
    const a = Math.PI * i / 30;
    return new THREE.Vector3(-44 * Math.cos(a), 78 + 28 * Math.sin(a), -221);
  });
  const archCurve = new THREE.CatmullRomCurve3(archPoints);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 80, 1.1, 8, false), material.metal); street.add(arch);
  const archLight = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 80, .12, 5, false), material.cyan); archLight.position.z = 1.2; street.add(archLight);
  for (const sx of [-1, 1]) {
    glass(sx * 44, 39, -221, 11, 78, 14, .3, 0, street);
    box(material.silver, sx * 44, 78, -221, 12, 1, 15, 0, street);
    box(material.cyan, sx * 44, 38, -213.8, .12, 70, .14, 0, street);
  }
  box(material.metal, 0, 72, -221, 88, 1.6, 5);
  box(material.cyan, 0, 72.9, -217.9, 88, .08, .08);
  for (let x = -40; x <= 40; x += 5) box(material.silver, x, 74.5, -219, .14, 3.5, 4.5);

  function glowTexture(color) {
    const image = document.createElement("canvas"); image.width = image.height = 128;
    const ctx = image.getContext("2d"), gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, color + "cc"); gradient.addColorStop(.18, color + "50"); gradient.addColorStop(.48, color + "12"); gradient.addColorStop(1, color + "00");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  const glowMaps = new Map();
  function glow(color, x, y, z, w, h, opacity = .4, parent = district(x)) {
    if (!glowMaps.has(color)) glowMaps.set(color, glowTexture(color));
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: glowMaps.get(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity}));
    sprite.position.set(x, y, z); sprite.scale.set(w, h, 1); parent.add(sprite); return sprite;
  }

  // Street lamps, shelters, platforms, bollards and building entrance canopies.
  for (let z = 30; z > -245; z -= 18) for (const side of [-1, 1]) {
    const x = side * 10.5;
    box(material.metal, x, 2.9, z, .12, 5.8, .12, 0, street);
    box(material.metal, x - side * .65, 5.8, z, 1.4, .13, .35, 0, street);
    box(material.warm, x - side * .65, 5.71, z, 1.15, .06, .3, 0, street);
    glow("#ffd69a", x - side * .65, 5.7, z, 3.5, 3.5, .24, street);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 11), new THREE.MeshBasicMaterial({map: glowMaps.get("#ffd69a"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .13}));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x - side * 2, .025, z); street.add(pool);
    box(material.dark, side * 12.4, .2, z, 3, .4, 12);
    box(material.cyan, side * 11.1, .45, z, .06, .07, 12, 0, street);
    for (const offset of [-4, 0, 4]) {
      box(material.metal, side * 11.6, .7, z + offset, .25, 1.4, .25, 0, street);
      box(material.white, side * 11.6, 1.3, z + offset, .28, .06, .28, 0, street);
    }
  }
  for (const [x, z] of [[-17, -9], [19, -45], [-18, -91], [18, -160]]) {
    box(material.metal, x, 4.3, z, 9, .3, 5);
    box(material.cyan, x, 4.14, z + 2.5, 9, .045, .08);
    for (const offset of [-3.8, 3.8]) box(material.silver, x + offset, 2.1, z - 1.7, .13, 4.2, .13);
    box(material.gold, x, .8, z, 6, .25, .9);
    box(material.dark, x, .12, z, 10, .24, 6);
  }

  // The ground and sky share the same distant atmosphere, so the finite scene
  // cannot expose a dark cut-off along the road or at the horizon.
  const atmosphereShader = `
    vec3 atmosphere(vec3 direction){
      vec3 n=normalize(direction);
      float horizon=pow(clamp(1.-abs(n.y),0.,1.),5.);
      float halo=pow(max(0.,dot(n,normalize(vec3(-.3,.13,-1.)))),14.);
      return mix(vec3(.001,.003,.012),vec3(.018,.048,.072),horizon)+vec3(.018,.045,.05)*halo;
    }`;
  // Wet asphalt samples a real mirrored scene with small ripples and rough patches.
  const reflectorShader = {
    uniforms: {color: {value: null}, tDiffuse: {value: null}, textureMatrix: {value: null}, uTime: timeUniform},
    vertexShader: `
      uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
      void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;vec4 view=modelViewMatrix*vec4(position,1.);vDepth=-view.z;gl_Position=projectionMatrix*view;}`,
    fragmentShader: `
      precision highp float; uniform sampler2D tDiffuse; uniform float uTime;
      varying vec4 vUv; varying vec3 vWorld; varying float vDepth;
      ${atmosphereShader}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p=vWorld.xz; float texture=noise(p*5.)*.4+noise(p*.18)*.6;
        vec4 sampleUV=vUv;
        sampleUV.xy+=vec2(sin(p.y*9.+uTime*.5),cos(p.x*7.))*vUv.w*.00045;
        vec3 reflection=texture2DProj(tDiffuse,sampleUV).rgb;
        float road=1.-smoothstep(8.,8.2,abs(p.x));
        float wet=smoothstep(.25,.7,noise(p*.15));
        vec3 color=vec3(.006,.012,.018)+reflection*(.15+wet*.45)*road;
        color+=reflection*.16*(1.-road);
        color+=vec3(.008,.011,.014)*texture;
        float dash=step(.47,fract(p.y/7.))*(1.-smoothstep(.06,.14,abs(abs(p.x)-3.1)));
        float center=1.-smoothstep(.025,.06,abs(p.x));
        color+=vec3(.34,.31,.22)*dash*road+vec3(.15,.12,.065)*center*road;
        float edge=1.-smoothstep(.025,.09,abs(abs(p.x)-8.1));
        color+=vec3(.02,.38,.42)*edge;
        vec2 tiles=abs(fract(p/3.-.5)-.5)/fwidth(p/3.);
        float grout=1.-min(min(tiles.x,tiles.y),1.);
        color=mix(color,color*.55,grout*(1.-road)*.4);
        float fog=1.-exp(-vDepth*vDepth*.00001764);
        color=mix(color,atmosphere(vWorld-cameraPosition),fog);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const mirror = new Reflector(new THREE.PlaneGeometry(1600, 1800), {shader: reflectorShader, textureWidth: 768, textureHeight: 768, clipBias: .004, multisample: 0});
  // Reflector clones shader uniforms, so keep its animated clock explicitly shared.
  mirror.material.uniforms.uTime = timeUniform;
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -.06, -150); street.add(mirror);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(620, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 vWorld;
      ${atmosphereShader}
      void main(){gl_FragColor=vec4(atmosphere(vWorld-cameraPosition),1.);}
    `
  })); scene.add(sky);
  const stars = [];
  for (let i = 0; i < 420; i++) stars.push((random() - .5) * 700, 150 + random() * 240, -400 + random() * 150);
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({color: 0x7f9da9, size: .32, transparent: true, opacity: .46, depthWrite: false})));
  glow("#236b98", -80, 60, -335, 250, 170, .24, scene);
  glow("#384e7b", 80, 80, -350, 270, 210, .2, scene);

  const artworkLoads = [];
  function screenTexture(title, english, detail, color, artworkPath) {
    const canvas = document.createElement("canvas"); canvas.width = 2048; canvas.height = 768;
    const ctx = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    function paint(artwork) {
    ctx.clearRect(0, 0, 2048, 768);
    const gradient = ctx.createLinearGradient(0, 0, 2048, 768);
    gradient.addColorStop(0, color + "12"); gradient.addColorStop(.6, "#030b1200"); gradient.addColorStop(1, color + "08");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 768);
    ctx.strokeStyle = color + "18"; ctx.lineWidth = 1;
    for (let y = 0; y < 768; y += 6) {ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();}
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(12, 12, 2024, 744);
    ctx.lineWidth = 8;
    for (const [x, y, sx, sy] of [[28, 28, 1, 1], [2020, 28, -1, 1], [28, 740, 1, -1], [2020, 740, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x + 74 * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 55 * sy); ctx.stroke();
    }
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = '500 50px "Avenir Next", sans-serif'; ctx.fillStyle = color; ctx.fillText(english, 120, 170);
    let fontSize = 200; ctx.font = '750 ' + fontSize + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    while (ctx.measureText(title).width > 1230) {fontSize -= 4; ctx.font = '750 ' + fontSize + 'px "PingFang SC", "Microsoft YaHei", sans-serif';}
    ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.fillStyle = "#eefcff"; ctx.fillText(title, 120, 367);
    ctx.shadowBlur = 0; ctx.fillStyle = "#c1d7df"; ctx.font = '400 72px "PingFang SC", "Microsoft YaHei", sans-serif'; ctx.fillText(detail, 120, 575);
    if (artwork) ctx.drawImage(artwork, 1380, 70, 650, 650);
    texture.needsUpdate = true;
    }
    paint(null);
    const artwork = new Image(); artwork.decoding = "async";
    artworkLoads.push(new Promise(resolve => {
      artwork.onload = () => {paint(artwork); resolve(true);};
      artwork.onerror = () => resolve(false);
    }));
    artwork.src = artworkPath;
    return texture;
  }
  const signs = [
    {title: "AI 产品落地", english: "01 / AI PRODUCT", detail: "从想法到真实产品", color: "#76ebff", x: -27, y: 22, z: -22.5, w: 26},
    {title: "Agent 与自动化", english: "02 / AGENT & AUTOMATION", detail: "把能力接进工作流程", color: "#b6ff91", x: 28, y: 32, z: -57.5, w: 29},
    {title: "增长与商业化", english: "03 / GROWTH & BUSINESS", detail: "让产品产生用户价值", color: "#c4acff", x: -29, y: 43, z: -101.5, w: 32}
  ];
  const billboards = signs.map((sign, index) => {
    const h = sign.w * 768 / 2048, parent = district(sign.x);
    const group = new THREE.Group(); group.position.set(sign.x, sign.y, sign.z); parent.add(group);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(sign.w + .9, h + .9, .6), material.dark); group.add(backing);
    const screenMaterial = new THREE.ShaderMaterial({
      uniforms: {uMap: {value: screenTexture(sign.title, sign.english, sign.detail, sign.color, "./assets/andy-billboard-" + ["product", "agent-v2", "growth-v2"][index] + ".png")},
        uTime: timeUniform, uColor: {value: new THREE.Color(sign.color)}, uIndex: {value: index}, uFocus: {value: 1}},
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uMap;uniform float uTime;uniform float uIndex;uniform float uFocus;uniform vec3 uColor;varying vec2 vUv;
        void main(){
          vec2 p=(vUv-.5)*vec2(2.6667,1.);
          vec2 center=p+vec2(.88,0.);
          float radius=length(center),angle=atan(center.y,center.x);
          float ring=pow(.007/max(abs(radius-.31),.007),1.4);
          ring*=.4+.6*smoothstep(-.5,.5,sin(angle*3.+uTime*.55+uIndex));
          float inner=pow(.004/max(abs(radius-.23),.004),1.3)*.35;
          float threads=0.;
          for(int i=0;i<3;i++){
            float path=.20*sin(p.x*3.+uTime*.32+float(i)*1.8+uIndex);
            threads+=pow(.002/max(abs(p.y-path),.002),1.3)*.12;
          }
          float grid=(1.-smoothstep(.01,.07,abs(fract(vUv.x*40.)-.5)))*(1.-smoothstep(.01,.06,abs(fract(vUv.y*15.)-.5)));
          float scan=exp(-pow((fract(uTime*.07+vUv.x*.22)-.5)*14.,2.))*.016;
          vec3 background=vec3(.002,.007,.012)+uColor*((ring+inner)*.13+threads*.14+grid*.014+scan);
          background+=uColor*pow(max(0.,1.-radius),3.)*.013;
          vec4 lettering=texture2D(uMap,vUv);
          vec3 color=mix(background,lettering.rgb,lettering.a)*uFocus;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(sign.w, h), screenMaterial); face.position.z = .32; group.add(face);
    for (const sx of [-1, 1]) {
      box(material.metal, sign.x + sx * sign.w * .4, sign.y, sign.z - .32, .2, h + 1.4, .4);
      box(material.silver, sign.x + sx * (sign.w / 2 + .38), sign.y, sign.z + .2, .16, h + .7, .5);
    }
    for (const sy of [-1, 1]) {
      box(material.silver, sign.x, sign.y + sy * (h / 2 + .36), sign.z + .2, sign.w + .85, .16, .5);
      box(sign.x > 0 ? material.warm : material.cyan, sign.x, sign.y + sy * (h / 2 + .46), sign.z + .1, sign.w + .9, .045, .06);
    }
    glow(sign.color, sign.x, sign.y, sign.z - .1, sign.w * 1.8, h * 3.5, .15, parent);
    return {material: screenMaterial, sign};
  });

  // Local street typography is attached to physical facades, with real casings.
  for (const [b, text] of [[heroes[0], "A / LAB"], [heroes[1], "SYSTEMS"], [heroes[2], "ANDY STUDIO"]]) {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#07101a"; ctx.fillRect(0, 0, 512, 128);
    ctx.font = '600 55px "Avenir Next", sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffe1a5"; ctx.fillText(text, 256, 65);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({map: texture}));
    mesh.position.set(b.x, 7.1, b.z + b.d / 2 + .45); district(b.x).add(mesh);
    box(material.metal, b.x, 7.1, b.z + b.d / 2 + .33, 9.5, 2.6, .25);
  }

  // Actual vehicles give scale; illumination remains cheap and instanced.
  const vehicles = [];
  for (let i = 0; i < 22; i++) {
    const group = new THREE.Group(), direction = i % 2 ? -1 : 1;
    group.position.x = direction * 4.7; street.add(group);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, .42, 3.2), i % 3 ? material.metal : material.gold); hull.position.y = .45; group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.12, .34, 1.5), material.dark); cabin.position.set(0, .82, -.18); group.add(cabin);
    for (const sx of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(.24, .08, .08), material.white); head.position.set(sx * .48, .49, 1.64); group.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(.32, .07, .07), material.red); tail.position.set(sx * .43, .48, -1.64); group.add(tail);
    }
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(.6, 8), new THREE.MeshBasicMaterial({map: glowMaps.get("#ffd69a"), transparent: true, opacity: .36, depthWrite: false, blending: THREE.AdditiveBlending}));
    streak.rotation.x = -Math.PI / 2; streak.position.set(0, .015, 3.8); group.add(streak);
    group.rotation.y = direction === 1 ? 0 : Math.PI;
    vehicles.push({group, start: random() * 350, speed: 9 + random() * 9, direction});
  }
  const train = new THREE.Group(); train.position.set(0, 74.5, -221); street.add(train);
  for (let i = 0; i < 3; i++) {
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 2.2), material.silver); carriage.position.x = i * 8.4; train.add(carriage);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(7.2, .5, .03), material.warm); windows.position.set(i * 8.4, .2, 1.13); train.add(windows);
  }
  const drones = [];
  for (let i = 0; i < 7; i++) {
    const group = new THREE.Group(); street.add(group);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(.7, .25, 1.8), material.silver); group.add(hull);
    const light = new THREE.Mesh(new THREE.BoxGeometry(.4, .06, .08), material.cyan); light.position.z = .95; group.add(light);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, .08, .7), material.dark); group.add(wing);
    const trail = new THREE.Mesh(new THREE.BoxGeometry(.07, .06, 4), material.cyan); trail.position.z = -2.3; group.add(trail);
    drones.push({group, start: random() * 330, lane: (i % 2 ? -1 : 1) * (5 + random() * 3), speed: 11 + random() * 5, height: 12 + i * 2.4});
  }

  // Roof-mounted searchlights: luminous cones, PBR spot illumination, and
  // matching projected light on the custom architectural facade shader.
  const searchlightDefinitions = [
    {origin: [-28, 61.4, -31], color: "#56daff", phase: .3},
    {origin: [28, 73.8, -67], color: "#bca1ff", phase: 2.5},
    {origin: [-29, 91.2, -112], color: "#ffd099", phase: 4.5},
    {origin: [-13.5, 1.6, 12], color: "#75e5ff", phase: 1.8, ground: true},
    {origin: [13.5, 1.6, -40], color: "#bda5ff", phase: 3.6, ground: true},
    {origin: [-13.5, 1.6, -135], color: "#f5d294", phase: 5, ground: true}
  ];
  const beamOrigins = searchlightDefinitions.map(() => new THREE.Vector3());
  const beamDirections = searchlightDefinitions.map(() => new THREE.Vector3());
  const beamColors = searchlightDefinitions.map(def => new THREE.Color(def.color));
  facade.uniforms.uBeamOrigins = {value: beamOrigins};
  facade.uniforms.uBeamDirections = {value: beamDirections};
  facade.uniforms.uBeamColors = {value: beamColors};
  const beamGeometry = new THREE.CylinderGeometry(0, 35, 170, 40, 1, true);
  beamGeometry.translate(0, -85, 0);
  const groundBeamGeometry = new THREE.CylinderGeometry(0, 21, 125, 40, 1, true);
  groundBeamGeometry.translate(0, -62.5, 0);
  const down = new THREE.Vector3(0, -1, 0);
  const searchlights = searchlightDefinitions.map(def => {
    const [x, y, z] = def.origin;
    box(material.metal, x, y - .8, z, 2, 1.6, 2);
    box(material.silver, x, y - .15, z, 1.5, .35, 1.5);
    const spot = new THREE.SpotLight(def.color, def.ground ? 8500 : 22000, def.ground ? 140 : 190, def.ground ? .2 : .28, .72, 2);
    scene.add(spot, spot.target);
    const beam = new THREE.Mesh(def.ground ? groundBeamGeometry : beamGeometry, new THREE.ShaderMaterial({
      uniforms: {uColor: {value: new THREE.Color(def.color)}, uOpacity: {value: def.ground ? .026 : .036}},
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
        void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vView=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `
        uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
        void main(){
          // Interpolation at the open cone end can stray below zero. Fractional
          // powers of that value produce NaNs that spread through HDR bloom.
          float axial=clamp(vUv.y,0.,1.);
          if(axial<=.001)discard;
          float face=clamp(abs(dot(normalize(vNormal),normalize(vView))),0.,1.);
          float lengthFade=pow(axial,1.2)*smoothstep(0.,.2,axial);
          float edge=pow(face,1.8);
          gl_FragColor=vec4(uColor,lengthFade*edge*uOpacity);
        }`
    }));
    scene.add(beam);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 1.3, 16), material.silver); scene.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.48, 20), new THREE.MeshBasicMaterial({color: new THREE.Color(def.color).multiplyScalar(2)})); scene.add(lens);
    const halo = glow(def.color, x, y, z, def.ground ? 4 : 7, def.ground ? 4 : 7, .35, scene);
    return {def, spot, beam, lamp, lens, halo};
  });
  let openingAmount = 0;

  // Hundreds of architectural details share a small number of GPU draw calls.
  for (const parent of [left, right, street]) {
    const items = facadeParts.filter(item => item.parent === parent);
    if (!items.length) continue;
    const geometry = cube.clone();
    geometry.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(items.flatMap(b => [b.w, b.h, b.d])), 3));
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(items.map(b => b.seed)), 1));
    geometry.setAttribute("aStyle", new THREE.InstancedBufferAttribute(new Float32Array(items.map(b => b.style)), 1));
    const mesh = new THREE.InstancedMesh(geometry, facade, items.length);
    items.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rotation, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere(); parent.add(mesh);
  }
  for (const {mat, parent, items} of batches.values()) {
    const mesh = new THREE.InstancedMesh(cube, mat, items.length);
    items.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z); dummy.rotation.set(0, b.rotation, 0); dummy.scale.set(b.w, b.h, b.d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere(); parent.add(mesh);
  }

  // HDR glow uses a downsampled pyramid, not an outline on every building.
  const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples: 4});
  const bloom = Array.from({length: 3}, () => new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, depthBuffer: false}));
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blur = new THREE.ShaderMaterial({
    uniforms: {tSource: {value: target.texture}, uPixel: {value: new THREE.Vector2()}, uThreshold: {value: 1}},
    depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      uniform sampler2D tSource;uniform vec2 uPixel;uniform float uThreshold;varying vec2 vUv;
      void main(){
        vec3 color=texture2D(tSource,vUv).rgb*.2;
        color+=(texture2D(tSource,vUv+vec2(uPixel.x,0.)).rgb+texture2D(tSource,vUv-vec2(uPixel.x,0.)).rgb)*.12;
        color+=(texture2D(tSource,vUv+vec2(0.,uPixel.y)).rgb+texture2D(tSource,vUv-vec2(0.,uPixel.y)).rgb)*.12;
        color+=(texture2D(tSource,vUv+uPixel).rgb+texture2D(tSource,vUv-uPixel).rgb+texture2D(tSource,vUv+vec2(uPixel.x,-uPixel.y)).rgb+texture2D(tSource,vUv+vec2(-uPixel.x,uPixel.y)).rgb)*.08;
        float light=max(color.r,max(color.g,color.b));
        color*=mix(1.,smoothstep(.45,1.15,light),uThreshold);gl_FragColor=vec4(color,1.);
      }`
  });
  const post = new THREE.ShaderMaterial({
    uniforms: {tScene: {value: target.texture}, tGlow0: {value: bloom[0].texture}, tGlow1: {value: bloom[1].texture}, tGlow2: {value: bloom[2].texture}},
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `
      uniform sampler2D tScene;uniform sampler2D tGlow0;uniform sampler2D tGlow1;uniform sampler2D tGlow2;varying vec2 vUv;
      void main(){
        vec3 color=texture2D(tScene,vUv).rgb;
        color+=texture2D(tGlow0,vUv).rgb*.12+texture2D(tGlow1,vUv).rgb*.23+texture2D(tGlow2,vUv).rgb*.32;
        float vignette=1.-.19*pow(length((vUv-.5)*vec2(1.,.8))*1.3,2.);
        gl_FragColor=vec4(color*vignette,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post); postScene.add(quad);

  return {
    camera, heroes, signs, artworkReady: Promise.all(artworkLoads),
    setOpening(opening) {openingAmount = opening; left.position.x = -opening * 20; right.position.x = opening * 20;},
    resize(w, h) {
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
      const ratio = renderer.getPixelRatio(), rw = Math.floor(w * ratio), rh = Math.floor(h * ratio);
      target.setSize(rw, rh);
      bloom.forEach((level, i) => level.setSize(Math.max(1, Math.floor(rw / 2 ** (i + 1))), Math.max(1, Math.floor(rh / 2 ** (i + 1)))));
    },
    render(time, story) {
      timeUniform.value = time;
      searchlights.forEach(({def, spot, beam, lamp, lens, halo}, i) => {
        const angle = time * (def.ground ? .17 : .22) + def.phase;
        beamOrigins[i].fromArray(def.origin);
        beamOrigins[i].x += Math.sign(def.origin[0]) * openingAmount * 20;
        if (def.ground) beamDirections[i].set(-Math.sign(def.origin[0]) * (.33 + .18 * Math.sin(angle)), .72 + .05 * Math.sin(angle * .71), -.52 + .12 * Math.cos(angle)).normalize();
        else beamDirections[i].set(Math.sin(angle) * .62, .57 + .12 * Math.sin(angle * .71), -.48 + .14 * Math.cos(angle)).normalize();
        // Emit from in front of the lens so illumination follows the lamp face.
        spot.position.copy(beamOrigins[i]).addScaledVector(beamDirections[i], 1.2);
        spot.target.position.copy(beamOrigins[i]).addScaledVector(beamDirections[i], def.ground ? 125 : 170);
        beam.position.copy(beamOrigins[i]); beam.quaternion.setFromUnitVectors(down, beamDirections[i]);
        lamp.position.copy(beamOrigins[i]); lamp.quaternion.copy(beam.quaternion);
        lens.position.copy(beamOrigins[i]).addScaledVector(beamDirections[i], .68); lens.lookAt(spot.target.position);
        halo.position.copy(beamOrigins[i]);
      });
      billboards.forEach(({material: mat}, i) => {
        const direct = Math.abs(story - STORY.reads[i]);
        const distance = Math.min(direct, DURATION - direct);
        const focus = 1 - THREE.MathUtils.smoothstep(distance, 1.4, 3.4);
        mat.uniforms.uFocus.value = .45 + focus * .65;
      });
      vehicles.forEach(({group, start, speed, direction}) => {group.position.z = ((start + time * speed * direction + 10000) % 370) - 325;});
      drones.forEach(({group, start, lane, speed, height}) => {group.position.set(lane + Math.sin(time * .23 + start) * .8, height + Math.sin(time * .3 + start) * .5, ((start + time * speed) % 360) - 325);});
      train.position.x = ((time * 12) % 200) - 115;
      // Keep the brand reveal free of small airborne silhouettes.
      const brandReveal = story >= STORY.revealStart - 1.4 && story < STORY.revealEnd + .9;
      drones.forEach(({group}) => {group.visible = !brandReveal;});
      train.visible = !brandReveal;
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      quad.material = blur;
      let source = target;
      bloom.forEach((level, i) => {
        blur.uniforms.tSource.value = source.texture; blur.uniforms.uPixel.value.set(2 / source.width, 2 / source.height); blur.uniforms.uThreshold.value = i === 0 ? 1 : 0;
        renderer.setRenderTarget(level); renderer.render(postScene, postCamera); source = level;
      });
      quad.material = post; renderer.setRenderTarget(null); renderer.render(postScene, postCamera);
    }
  };
}
