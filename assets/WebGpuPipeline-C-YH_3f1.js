import{a as e,c as t,d as n,f as r,i,l as a,m as o,n as s,o as c,p as l,r as u,s as d,t as f,u as p}from"./index-W9Wxxli2.js";var m=8,h=class{device;maxRows;rows=0;buffer=null;version=0;constructor(e,t){this.device=e,this.maxRows=t}allocate(e,t){let n=this.device,i=this.buffer,a=n.createBuffer({size:e*r*m,usage:140});if(i!==null&&t>0){let e=n.createCommandEncoder();e.copyBufferToBuffer(i,0,a,0,t*m),n.queue.submit([e.finish()])}i?.destroy(),this.buffer=a,this.rows=e,this.version++}upload(e,t,n,r){if(this.buffer===null)return;let i=this.device,a=r*m,o=i.createBuffer({size:a,usage:4,mappedAtCreation:!0});new Int16Array(o.getMappedRange()).set(e.subarray(t*4,(t+r)*4)),o.unmap();let s=i.createCommandEncoder();s.copyBufferToBuffer(o,0,this.buffer,n*m,a),i.queue.submit([s.finish()]),o.destroy()}},g=`
const ATLAS: f32 = ${d}.0;
const CORNER: i32 = 1;

struct Segment {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) k: i32,
  @location(1) @interpolate(flat) c01: vec4f,
  @location(2) @interpolate(flat) c23: vec4f,
  @location(3) @interpolate(flat) w: vec2f,
  @location(4) @interpolate(flat) inv: vec4f,
  @location(5) @interpolate(flat) rect: vec4f,
  @location(6) p: vec2f,
}

// No segment: all four vertices outside the clip volume
fn outside() -> Segment {
  var s: Segment;
  s.k = 1;
  s.position = vec4f(2.0, 2.0, 2.0, 1.0);
  return s;
}

// The Hermite tangents (columns m1, m2) of the centripetal Catmull-Rom segment p1 -> p2
fn tangents(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f) -> mat2x2f {
  let d01 = max(sqrt(length(p1 - p0)), 1e-4);
  let d12 = max(sqrt(length(p2 - p1)), 1e-4);
  let d23 = max(sqrt(length(p3 - p2)), 1e-4);
  let m1 = d12 * ((p1 - p0) / d01 - (p2 - p0) / (d01 + d12) + (p2 - p1) / d12);
  let m2 = d12 * ((p2 - p1) / d12 - (p3 - p1) / (d12 + d23) + (p3 - p2) / d23);
  return mat2x2f(m1, m2);
}

// The quad of segment p1 -> p2 (relative local units) at its atlas place, and the fragment inputs
fn emit(vi: u32, p1: vec2f, p2: vec2f, m1: vec2f, m2: vec2f, w1: f32, w2: f32, k: i32, m: mat2x2f, shift: vec2f, sigma: f32, atlasOffset: vec2f, rect: vec4f) -> Segment {
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let c1 = m1;
  let c2 = 3.0 * (p2 - p1) - 2.0 * m1 - m2;
  let c3 = 2.0 * (p1 - p2) + m1 + m2;
  // A box along the device chord holding the Bezier points, grown by the radius and the antialiasing
  let q1 = m * p1 + shift;
  let chord = m * (p2 - p1);
  let da = m * (m1 / 3.0);
  let db = chord - m * (m2 / 3.0);
  let chordLength = length(chord);
  let u = select(vec2f(1.0, 0.0), chord / chordLength, chordLength > 1e-6);
  let v = vec2f(-u.y, u.x);
  let minU = min(0.0, min(chordLength, min(dot(da, u), dot(db, u))));
  let maxU = max(0.0, max(chordLength, max(dot(da, u), dot(db, u))));
  let minV = min(0.0, min(dot(da, v), dot(db, v)));
  let maxV = max(0.0, max(dot(da, v), dot(db, v)));
  let grow = max(w1, w2) * 0.5 * sigma + 1.0;
  let device = q1 + u * mix(minU - grow, maxU + grow, corner.x) + v * mix(minV - grow, maxV + grow, corner.y);
  let det = m[0][0] * m[1][1] - m[1][0] * m[0][1];
  let inverseM = mat2x2f(vec2f(m[1][1], -m[0][1]), vec2f(-m[1][0], m[0][0])) * (1.0 / det);
  let inverseT = transpose(inverseM);
  var s: Segment;
  s.p = inverseM * (device - shift);
  s.inv = vec4f(inverseT[0], inverseT[1]);
  s.k = k;
  s.c01 = vec4f(p1, c1);
  s.c23 = vec4f(c2, c3);
  s.w = vec2f(w1, w2);
  s.rect = rect;
  let atlas = device + atlasOffset;
  s.position = vec4f(atlas.x * (2.0 / ATLAS) - 1.0, 1.0 - atlas.y * (2.0 / ATLAS), 0.0, 1.0);
  return s;
}

// The largest coverage of the segment's k capsules in the stroke's atlas rectangle, blended with max
@fragment fn coverage(s: Segment) -> @location(0) vec4f {
  let frag = s.position.xy;
  if (any(frag < s.rect.xy) || any(frag >= s.rect.zw)) {
    discard;
  }
  let inverseT = mat2x2f(s.inv.xy, s.inv.zw);
  let c0 = s.c01.xy;
  let c1 = s.c01.zw;
  let c2 = s.c23.xy;
  let c3 = s.c23.zw;
  let k = f32(s.k);
  var a = c0;
  var wa = s.w.x;
  var result = 0.0;
  for (var j = 1; j <= 24; j++) {
    if (j > s.k) {
      break;
    }
    let t = f32(j) / k;
    let b = c0 + t * (c1 + t * (c2 + t * c3));
    let wb = mix(s.w.x, s.w.y, t);
    let ab = b - a;
    let ap = s.p - a;
    let l2 = dot(ab, ab);
    let h = select(0.0, clamp(dot(ap, ab) / l2, 0.0, 1.0), l2 > 0.0);
    let q = ap - ab * h;
    let dist = length(q);
    var n = vec2f(1.0, 0.0);
    if (dist > 1e-6) {
      n = q / dist;
    } else if (l2 > 0.0) {
      n = vec2f(-ab.y, ab.x) / sqrt(l2);
    }
    let r = 0.5 * mix(wa, wb, h);
    // Local units per device px along n: the distance to the edge and the width in device px
    let g = length(inverseT * n);
    result = max(result, clamp(min(0.5 - (dist - r) / g, 2.0 * r / g), 0.0, 1.0));
    a = b;
    wa = wb;
  }
  return vec4f(result, 0.0, 0.0, 0.0);
}
`,_=`
${g}

const FIRST: i32 = 2;
const LAST: i32 = 4;

@group(0) @binding(0) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(1) var<storage, read> records: array<vec4f>;

@vertex fn vertexMain(@builtin(vertex_index) vi: u32, @builtin(instance_index) instance: u32) -> Segment {
  let i = i32(instance);
  let n1 = nodes[i];
  let tag = i32(n1.w);
  let flags = tag & 15;
  let single = (flags & FIRST) != 0 && (flags & LAST) != 0;
  if ((flags & LAST) != 0 && !single) {
    return outside();
  }
  let curve = (tag >> 4u) * 4;
  let record0 = records[curve];
  let record1 = records[curve + 1];
  let record2 = records[curve + 2];
  let s = record1.z;
  let p1 = n1.xy;
  let w1 = n1.z;
  var p2 = p1;
  var w2 = w1;
  var m1 = vec2f(0.0);
  var m2 = vec2f(0.0);
  var k = 1;
  if (!single) {
    let n2 = nodes[i + 1];
    let flags2 = i32(n2.w) & 15;
    p2 = n2.xy;
    w2 = n2.z;
    let start = (flags & (FIRST | CORNER)) != 0;
    let end = (flags2 & (LAST | CORNER)) != 0;
    let len = length(p2 - p1) * s;
    // Straight (a 2-node run, or under 1.5 device px): equal tangents make the cubic the chord
    m1 = p2 - p1;
    m2 = m1;
    if (!(start && end) && len >= 1.5) {
      let p0 = select(nodes[max(i - 1, 0)].xy, p1, start);
      let p3 = select(nodes[i + 2].xy, p2, end);
      k = clamp(i32(ceil(len / 2.0)), 1, 24);
      let m = tangents(p0, p1, p2, p3);
      m1 = m[0];
      m2 = m[1];
    }
  }
  return emit(vi, p1, p2, m1, m2, w1, w2, k, mat2x2f(record0.xy, record0.zw), record1.xy, record1.w, record2.xy, records[curve + 3]);
}
`,v=`
${g}
const STORE_WIDTH: i32 = ${r};
override wideSegments: bool = false;

struct Call {
  m: mat2x2f,
  scale: f32,
  sigma: f32,
}

@group(0) @binding(0) var<storage, read> storeTexels: array<vec2u>;
@group(0) @binding(1) var<storage, read> records: array<vec4f>;
@group(0) @binding(2) var<storage, read> segments: array<u32>;
@group(0) @binding(3) var<uniform> drawCall: Call;

var<private> firstTexel: i32;
var<private> unit: f32;
var<private> wUnit: f32;

// Node t of the stroke: (x, y) relative to its first node, w, corner flag; i16 halves sign-extended
fn node(t: i32) -> vec4f {
  let q = storeTexels[firstTexel + t];
  let x = bitcast<i32>(q.x << 16u) >> 16u;
  let y = bitcast<i32>(q.x) >> 16u;
  let w = bitcast<i32>(q.y << 16u) >> 16u;
  let flags = bitcast<i32>(q.y) >> 16u;
  return vec4f(vec2f(f32(x), f32(y)) * unit, f32(w) * wUnit, f32(flags));
}

@vertex fn vertexMain(@builtin(vertex_index) vi: u32, @builtin(instance_index) instance: u32) -> Segment {
  var record: i32;
  if (wideSegments) { record = i32(segments[instance]); }
  else { record = i32((segments[instance >> 1u] >> ((instance & 1u) * 16u)) & 0xffffu); }
  let r = record * 4;
  let record0 = records[r];
  let record1 = records[r + 1];
  let record3 = records[r + 3];
  firstTexel = i32(record0.y) * STORE_WIDTH + i32(record0.x);
  unit = record3.x;
  wUnit = record3.y;
  let n = i32(record0.z);
  let every = i32(record0.w);
  let a = (i32(instance) - i32(record3.z)) * every;
  let n1 = node(a);
  let p1 = n1.xy;
  let w1 = n1.z;
  var p2 = p1;
  var w2 = w1;
  var m1 = vec2f(0.0);
  var m2 = vec2f(0.0);
  var k = 1;
  if (n > 1) {
    let b = min(a + every, n - 1);
    let n2 = node(b);
    p2 = n2.xy;
    w2 = n2.z;
    let start = a == 0 || (i32(n1.w) & CORNER) != 0;
    let end = b == n - 1 || (i32(n2.w) & CORNER) != 0;
    let len = length(p2 - p1) * drawCall.scale;
    m1 = p2 - p1;
    m2 = m1;
    if (!(start && end) && len >= 1.5) {
      let p0 = select(node(max(a - every, 0)).xy, p1, start);
      let p3 = select(node(min(b + every, n - 1)).xy, p2, end);
      k = clamp(i32(ceil(len / 2.0)), 1, 24);
      let m = tangents(p0, p1, p2, p3);
      m1 = m[0];
      m2 = m[1];
    }
  }
  return emit(vi, p1, p2, m1, m2, w1, w2, k, drawCall.m, record1.xy, drawCall.sigma, record1.zw, records[r + 2]);
}
`,y=`
const SIZE: f32 = 262.0;
// A multiply run keeps v = a - c (shaders.md, Composite)
override multiply: bool = false;

@group(0) @binding(0) var atlas: texture_2d<f32>;

struct Item {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) box: vec4f,
  @location(1) @interpolate(flat) delta: vec2f,
  @location(2) @interpolate(flat) mode: i32,
  @location(3) @interpolate(flat) alpha: f32,
  @location(4) @interpolate(flat) color: vec4f,
}

@vertex fn vertexMain(@builtin(vertex_index) vi: u32, @location(0) box: vec4f, @location(1) extra: vec4f, @location(2) color: vec4f) -> Item {
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let mode = i32(extra.z);
  let grow = select(0.0, 0.5, mode == 1);
  let device = mix(box.xy - grow, box.zw + grow, corner);
  var item: Item;
  item.position = vec4f(device.x * 2.0 / SIZE - 1.0, 1.0 - device.y * 2.0 / SIZE, 0.0, 1.0);
  item.box = box;
  item.delta = extra.xy;
  item.mode = mode;
  item.alpha = extra.w;
  item.color = color;
  return item;
}

@fragment fn fragmentMain(item: Item) -> @location(0) vec4f {
  // Top-left corner of this pixel in device px
  let pixel = item.position.xy - 0.5;
  var c: f32;
  if (item.mode == 1) {
    let overlap = max(min(pixel + 1.0, item.box.zw) - max(pixel, item.box.xy), vec2f(0.0));
    c = item.alpha * overlap.x * overlap.y;
  } else {
    c = textureLoad(atlas, vec2i(pixel + item.delta + 0.5), 0).r;
  }
  let o = item.color * c;
  if (multiply) {
    return vec4f(o.a - o.rgb, o.a);
  }
  return o;
}
`,b=`
@group(0) @binding(0) var color: texture_2d<f32>;

@vertex fn vertexMain(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let v = textureLoad(color, vec2i(position.xy), 0);
  return vec4f(v.a - v.rgb, v.a);
}
`,x=`
struct Scratch {
  counts: array<u32, ${t}>,
  localOffsets: array<u32, ${t}>,
  totals: array<u32, 64>,
  bases: array<u32, 64>,
}
struct Call { matrix: vec4f, originX: vec4f, originY: vec4f, scales: vec4f, cells: vec4u, rest: vec4f }
@group(0) @binding(0) var<storage, read> entries: array<vec4f>;
@group(0) @binding(1) var<storage, read> handles: array<u32>;
@group(0) @binding(2) var<storage, read> paints: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> records: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> items: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> segments: array<u32>;
@group(0) @binding(6) var<storage, read_write> scratch: Scratch;
@group(0) @binding(7) var<storage, read_write> arguments: array<u32>;
@group(0) @binding(8) var<uniform> call: Call;

fn relative(v: vec3f, origin: vec3f) -> f32 { return ((v.x - origin.x) + (v.y - origin.y)) + (v.z - origin.z); }

@compute @workgroup_size(256)
fn plan(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= call.cells.w) { return; }
  let at = handles[i] * 6u;
  let position = vec2f(relative(entries[at].xyz, call.originX.xyz), relative(entries[at + 1u].xyz, call.originY.xyz));
  let m = mat2x2f(call.matrix.xy, call.matrix.zw);
  let origin = m * position + call.rest.xy;
  let bounds = entries[at + 2u];
  let lo = origin + m * bounds.xy;
  let hi = origin + m * bounds.zw;
  let codes = bitcast<vec4u>(entries[at + 3u]);
  let units = entries[at + 4u];
  let ink = entries[at + 5u].x * call.scales.x * call.scales.y;
  let color = paints[select(codes.z, codes.w, call.scales.w != 0.0)];
  let r = i * 4u;
  let item = i * 3u;
  scratch.counts[i] = 0u;
  records[r] = vec4f(0.0); records[r + 1u] = vec4f(0.0); records[r + 2u] = vec4f(0.0); records[r + 3u] = vec4f(0.0);
  items[item] = vec4f(0.0); items[item + 1u] = vec4f(0.0); items[item + 2u] = vec4f(0.0);
  if (color.a <= 0.0 || codes.x == 0xffffffffu) { return; }
  if ((bounds.z - bounds.x) * call.scales.x < units.w && (bounds.w - bounds.y) * call.scales.y < units.w) {
    let center = (lo + hi) * 0.5;
    items[item] = vec4f(center - 0.5, center + 0.5);
    items[item + 1u] = vec4f(0.0, 0.0, 1.0, min(ink, 1.0));
    items[item + 2u] = color;
    return;
  }
  let lower = max(vec2f(0.0), floor(lo - 1.0));
  let upper = min(vec2f(262.0), ceil(hi + 1.0));
  let size = upper - lower;
  if (any(size <= vec2f(0.0))) { return; }
  let place = vec2f(f32((i % call.cells.z) * call.cells.x), f32((i / call.cells.z) * call.cells.y));
  let shift = u32(clamp(floor(units.z - call.scales.z), 0.0, 24.0));
  let step = 1u << shift;
  let n = codes.y;
  scratch.counts[i] = select(1u, (n - 2u + step) >> shift, n > 1u);
  records[r] = vec4f(f32(codes.x % ${r}u), f32(codes.x / ${r}u), f32(n), f32(step));
  records[r + 1u] = vec4f(origin, place - lower);
  records[r + 2u] = vec4f(place, place + size);
  records[r + 3u] = vec4f(units.xy, 0.0, 0.0);
  items[item] = vec4f(lower, upper);
  items[item + 1u] = vec4f(place - lower, 0.0, 0.0);
  items[item + 2u] = color;
}

var<workgroup> sums: array<u32, 256>;

@compute @workgroup_size(256)
fn scan(@builtin(local_invocation_index) lane: u32, @builtin(workgroup_id) group: vec3u) {
  let i = group.x * 256u + lane;
  var count = 0u;
  if (i < call.cells.w) { count = scratch.counts[i]; }
  sums[lane] = count;
  workgroupBarrier();
  for (var stride = 1u; stride < 256u; stride *= 2u) {
    var extra = 0u;
    if (lane >= stride) { extra = sums[lane - stride]; }
    workgroupBarrier();
    sums[lane] += extra;
    workgroupBarrier();
  }
  if (i < call.cells.w) { scratch.localOffsets[i] = sums[lane] - count; }
  if (lane == 255u) { scratch.totals[group.x] = sums[lane]; }
}

@compute @workgroup_size(64)
fn totals(@builtin(local_invocation_index) lane: u32) {
  var count = 0u;
  if (lane < (call.cells.w + 255u) / 256u) { count = scratch.totals[lane]; }
  sums[lane] = count;
  workgroupBarrier();
  for (var stride = 1u; stride < 64u; stride *= 2u) {
    var extra = 0u;
    if (lane >= stride) { extra = sums[lane - stride]; }
    workgroupBarrier();
    sums[lane] += extra;
    workgroupBarrier();
  }
  scratch.bases[lane] = sums[lane] - count;
  if (lane == 63u) {
    arguments[0] = 4u; arguments[1] = sums[lane]; arguments[2] = 0u; arguments[3] = 0u;
    arguments[4] = 4u; arguments[5] = call.cells.w; arguments[6] = 0u; arguments[7] = 0u;
  }
}

@compute @workgroup_size(256)
fn finalize(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= call.cells.w) { return; }
  let start = scratch.localOffsets[i] + scratch.bases[i / 256u];
  records[i * 4u + 3u].z = f32(start);
  for (var j = 0u; j < scratch.counts[i]; j++) { segments[start + j] = i; }
}
`;async function S(e){let t=e.createShaderModule({code:x,label:`store compute`}),n=e.createBindGroupLayout({entries:Array.from({length:9},(e,t)=>({binding:t,visibility:4,buffer:{type:t===8?`uniform`:t<3?`read-only-storage`:`storage`}}))}),r=e.createPipelineLayout({bindGroupLayouts:[n]}),[i,a,o,s]=await Promise.all([`plan`,`scan`,`totals`,`finalize`].map(n=>e.createComputePipelineAsync({layout:r,compute:{module:t,entryPoint:n}})));if(!i||!a||!o||!s)throw Error(`Missing store compute pipeline`);return{layout:n,plan:i,scan:a,totals:o,finalize:s}}var C={topology:`triangle-strip`},w={operation:`max`,srcFactor:`one`,dstFactor:`one`},T={operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src-alpha`},E={operation:`add`,srcFactor:`one`,dstFactor:`one-minus-src`};async function D(e,t){let n=(t,n)=>e.createShaderModule({code:t,label:n}),r=n(_,`coverage`),i=n(v,`store`),a=n(y,`composite`),o=n(b,`convert`),s=[{format:`r8unorm`,blend:{color:w,alpha:w}}],c=(t,n=!1)=>e.createRenderPipelineAsync({layout:`auto`,vertex:{module:t,entryPoint:`vertexMain`,...n?{constants:{wideSegments:1}}:{}},fragment:{module:t,entryPoint:`coverage`,targets:s},primitive:C}),l={arrayStride:48,stepMode:`instance`,attributes:[0,1,2].map(e=>({shaderLocation:e,offset:e*16,format:`float32x4`}))},u=t=>e.createRenderPipelineAsync({layout:`auto`,vertex:{module:a,entryPoint:`vertexMain`,buffers:[l]},fragment:{module:a,entryPoint:`fragmentMain`,constants:{multiply:+!!t},targets:[{format:`rgba8unorm`,blend:{color:t?E:T,alpha:T}}]},primitive:C}),[d,f,p,m,h,g,x]=await Promise.all([c(r),c(i),u(!1),u(!0),e.createRenderPipelineAsync({layout:`auto`,vertex:{module:o,entryPoint:`vertexMain`},fragment:{module:o,entryPoint:`fragmentMain`,targets:[{format:t}]},primitive:{topology:`triangle-list`}}),c(i,!0),S(e)]);return{coverage:d,store:f,composite:p,compositeMultiply:m,convert:h,storeWide:g,compute:x}}var O=class{device;target;handles;scratch;arguments;uniform;callData=new Float32Array(24);storeCall=new Float32Array(8);callInts=new Uint32Array(this.callData.buffer);entries=null;paints=null;entrySize=0;entrySource=null;uploadEntryRange=(e,t)=>{this.entries&&this.entrySource&&this.device.queue.writeBuffer(this.entries,e*24*4,this.entrySource.data,e*24,(t-e)*24)};paintSize=0;cellWidth=1;cellHeight=1;columns=1;capacity=1;constructor(e,n){this.device=e,this.target=n,this.handles=e.createBuffer({size:t*4,usage:136}),this.scratch=e.createBuffer({size:(t*2+128)*4,usage:136}),this.arguments=e.createBuffer({size:32,usage:384}),this.uniform=e.createBuffer({size:96,usage:72})}configure(e,r,i,a,o){return!r.aligned||!r.invertible||!Number.isFinite(r.scale)||!Number.isFinite(r.sigma)||!Number.isFinite(Math.fround(r.e/r.a))||!Number.isFinite(Math.fround(r.f/r.d))||e.compute.data.byteLength>this.device.limits.maxStorageBufferBindingSize?!1:(this.cellWidth=Math.max(1,Math.min(262,Math.ceil(i*r.scaleX)+3)),this.cellHeight=Math.max(1,Math.min(262,Math.ceil(a*r.scaleY)+3)),this.columns=Math.floor(d/this.cellWidth),this.capacity=Math.max(1,Math.min(t,this.columns*Math.floor(d/this.cellHeight),Math.floor(n/o))),!0)}draw(e,t,n,r,i,a){if(t===0)return;let o=this.device,s=o.queue,c=this.target,u=c.store();if(!u)return;let d=n.compute;if(d.data.byteLength!==this.entrySize&&(this.entries?.destroy(),this.entrySize=d.data.byteLength,this.entries=o.createBuffer({size:this.entrySize,usage:136}),d.invalidate()),i.data.byteLength!==this.paintSize&&(this.paints?.destroy(),this.paintSize=i.data.byteLength,this.paints=o.createBuffer({size:this.paintSize,usage:136})),!this.entries||!this.paints)return;this.entrySource=d,d.upload(this.uploadEntryRange),s.writeBuffer(this.paints,0,i.data,0,i.size*4),s.writeBuffer(this.handles,0,e,0,t);let f=this.callData;f.set(r.uniform);let p=-r.e/r.a,m=-r.f/r.d;l(f,4,p),l(f,8,m),f[12]=r.scaleX,f[13]=r.scaleY,f[14]=r.log2Scale,f[15]=+!!r.dark,this.callInts[16]=this.cellWidth,this.callInts[17]=this.cellHeight,this.callInts[18]=this.columns,this.callInts[19]=t,f[20]=r.a*p+r.e,f[21]=r.d*m+r.f,f[22]=r.scale,f[23]=r.sigma,s.writeBuffer(this.uniform,0,f);let h=this.storeCall;h.set(r.uniform),h[4]=r.scale,h[5]=r.sigma,s.writeBuffer(c.call,0,h);let g=[this.entries,this.handles,this.paints,c.records,c.items,c.segments,this.scratch,this.arguments,this.uniform],_=o.createBindGroup({layout:c.programs.compute.layout,entries:g.map((e,t)=>({binding:t,resource:{buffer:e}}))}),v=o.createCommandEncoder(),y=v.beginComputePass();y.setBindGroup(0,_);for(let e of[`plan`,`scan`,`totals`,`finalize`])y.setPipeline(c.programs.compute[e]),y.dispatchWorkgroups(e===`totals`?1:Math.ceil(t/256));y.end();let b=v.beginRenderPass({colorAttachments:[{view:c.atlas,loadOp:`clear`,storeOp:`store`}]});b.setPipeline(c.programs.storeWide),b.setBindGroup(0,o.createBindGroup({layout:c.programs.storeWide.getBindGroupLayout(0),entries:[u,c.records,c.segments,c.call].map((e,t)=>({binding:t,resource:{buffer:e}}))})),b.drawIndirect(this.arguments,0),b.end();let x=v.beginRenderPass({colorAttachments:[{view:c.color,loadOp:c.isComposited()?`load`:`clear`,storeOp:`store`}]});x.setPipeline(a?c.programs.compositeMultiply:c.programs.composite),x.setBindGroup(0,c.composite(a)),x.setVertexBuffer(0,c.items),x.drawIndirect(this.arguments,16),x.end(),s.submit([v.finish()]),c.complete()}get bytes(){return this.entrySize+this.paintSize+t*12+512+128}},k=`rgba8unorm`,A=136,j=(p*4+t*16+a*12)*4+n*2+d**2+262**2*4*2,M={r:0,g:0,b:0,a:0},N=class r{compute;static async create(e){let t=null;try{let n=await navigator.gpu.requestAdapter();if(!n)return null;let i=n.info,a=Reflect.get(i,`isFallbackAdapter`)===!0,o=s(a?`software`:`${i.vendor} ${i.architecture} ${i.description}`,f()),c=Math.min(n.limits.maxStorageBufferBindingSize,n.limits.maxBufferSize,o);t=await n.requestDevice({requiredLimits:{maxStorageBufferBindingSize:c,maxBufferSize:c}});let l=new OffscreenCanvas(262,262),d=l.getContext(`webgpu`);if(!(d instanceof GPUCanvasContext))throw Error(`No webgpu context`);d.configure({device:t,format:k,alphaMode:`premultiplied`,usage:18}),t.pushErrorScope(`validation`);let p=await D(t,k),m=new r(l,d,t,p,u(c,1/0),e),h=await t.popErrorScope();if(h)throw Error(h.message);return m}catch(e){return console.warn(`WebGPU fill unavailable:`,e),t?.destroy(),null}}api=`webgpu`;store;nodes=new Float32Array(p*4);records=new Float32Array(t*16);items=new Float32Array(a*12);segments=new Uint16Array(n);shelves=new o(d);composited=!1;lost=!1;disposed=!1;dirty=new e(262);canvas;context;device;programs;storeMemory;nodeBuffer;recordBuffer;segmentBuffer;itemBuffer;callBuffer;callData=new Float32Array(8);atlasView;color;colorView;coverageGroup;compositeGroup;multiplyGroup;convertGroup;storeGroup=null;storeGroupVersion=-1;constructor(e,t,r,a,o,s){this.canvas=e,this.context=t,this.device=r,this.programs=a;let c=(e,t)=>r.createBuffer({size:e,usage:t});this.nodeBuffer=c(this.nodes.byteLength,A),this.recordBuffer=c(this.records.byteLength,A),this.segmentBuffer=c(n*4,A),this.itemBuffer=c(this.items.byteLength,32|A),this.callBuffer=c(this.callData.byteLength,72);let l=r.createTexture({size:[d,d],format:`r8unorm`,usage:20});this.atlasView=l.createView(),this.color=r.createTexture({size:[262,262],format:k,usage:21}),this.colorView=this.color.createView();let u=(e,t)=>r.createBindGroup({layout:e.getBindGroupLayout(0),entries:t.map((e,t)=>({binding:t,resource:e instanceof GPUBuffer?{buffer:e}:e}))});this.coverageGroup=u(a.coverage,[this.nodeBuffer,this.recordBuffer]),this.compositeGroup=u(a.composite,[this.atlasView]),this.multiplyGroup=u(a.compositeMultiply,[this.atlasView]),this.convertGroup=u(a.convert,[this.colorView]),this.storeMemory=new h(r,o),this.store=new i(this.storeMemory),this.compute=new O(r,{records:this.recordBuffer,items:this.itemBuffer,segments:this.segmentBuffer,atlas:this.atlasView,color:this.colorView,call:this.callBuffer,programs:a,store:()=>this.lost?null:(this.store.flush(),this.storeMemory.buffer),composite:e=>e?this.multiplyGroup:this.compositeGroup,isComposited:()=>this.composited,complete:()=>{this.composited=!0,this.dirty.x0=this.dirty.y0=0,this.dirty.x1=this.dirty.y1=262}}),r.lost.then(()=>{this.lost=!0,this.disposed||s.lost()})}get bytes(){return this.lost?0:j+n*2+this.store.bytes+this.compute.bytes}draw(e,t,n,r,i,a){if(this.shelves.reset(),e===0||this.lost)return;let o=this.device,s=o.queue,c=this.programs,l=o.createCommandEncoder();if(n>0){if(t>0&&s.writeBuffer(this.nodeBuffer,0,this.nodes,0,t*4),s.writeBuffer(this.recordBuffer,0,this.records,0,n*16),r>0){this.store.flush(),s.writeBuffer(this.segmentBuffer,0,this.segments,0,r+(r&1));let e=this.callData;e.set(i.uniform),e[4]=i.scale,e[5]=i.sigma,s.writeBuffer(this.callBuffer,0,e)}let e=l.beginRenderPass({colorAttachments:[{view:this.atlasView,loadOp:`clear`,clearValue:M,storeOp:`store`}]});t>0&&(e.setPipeline(c.coverage),e.setBindGroup(0,this.coverageGroup),e.draw(4,t));let a=r>0?this.storeBindGroup():null;a&&(e.setPipeline(c.store),e.setBindGroup(0,a),e.draw(4,r)),e.end()}this.dirty.grow(this.items,e,12),s.writeBuffer(this.itemBuffer,0,this.items,0,e*12);let u=l.beginRenderPass({colorAttachments:[{view:this.colorView,loadOp:this.composited?`load`:`clear`,clearValue:M,storeOp:`store`}]});this.composited=!0,u.setPipeline(a?c.compositeMultiply:c.composite),u.setBindGroup(0,a?this.multiplyGroup:this.compositeGroup),u.setVertexBuffer(0,this.itemBuffer),u.draw(4,e),u.end(),s.submit([l.finish()])}storeBindGroup(){let e=this.storeMemory,t=e.buffer;return t===null?null:((this.storeGroup===null||this.storeGroupVersion!==e.version)&&(this.storeGroup=this.device.createBindGroup({layout:this.programs.store.getBindGroupLayout(0),entries:[t,this.recordBuffer,this.segmentBuffer,this.callBuffer].map((e,t)=>({binding:t,resource:{buffer:e}}))}),this.storeGroupVersion=e.version),this.storeGroup)}handOff(e,t){this.composited=!1;let n=this.dirty;if(e&&!this.lost&&!n.empty){let r=this.context.getCurrentTexture(),i=this.device.createCommandEncoder(),{x0:a,y0:o}=n,s=n.x1-a,l=n.y1-o;if(t){let e=i.beginRenderPass({colorAttachments:[{view:r.createView(),loadOp:`clear`,clearValue:M,storeOp:`store`}]});e.setScissorRect(a,o,s,l),e.setPipeline(this.programs.convert),e.setBindGroup(0,this.convertGroup),e.draw(3),e.end()}else i.copyTextureToTexture({texture:this.color,origin:{x:a,y:o}},{texture:r,origin:{x:a,y:o}},{width:s,height:l});this.device.queue.submit([i.finish()]);let u=this.canvas.transferToImageBitmap();c(e,u,n,t),u.close()}n.clear()}dispose(){this.disposed||(this.disposed=!0,this.lost=!0,this.device.destroy())}};export{N as WebGpuPipeline};