/**
 * Zaman tüneli gölgelendiricisi (SkSL — telefonun ekran kartında çalışır).
 *
 * uniform'lar:
 *  res    ekran boyutu (px)
 *  t      geçen süre (sn)
 *  speed  0..1 yolculuk hızı (hızlanır, varışta yavaşlar)
 *  era    0..4 sürekli dönem değeri: 0=2020'ler, 1=2010'lar, 2=2000'ler, 3=90'lar, 4=80'ler
 *  flash  0..1 varış ışık patlaması
 */
export const TUNNEL_SKSL = `
uniform float2 res;
uniform float t;
uniform float speed;
uniform float era;
uniform float flash;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float3 eraColor(float e) {
  float3 c0 = float3(0.20, 0.80, 1.00);  // 2020'ler: buz mavisi
  float3 c1 = float3(0.35, 0.50, 1.00);  // 2010'lar: temiz mavi
  float3 c2 = float3(0.55, 0.95, 0.85);  // 2000'ler: gümüşi turkuaz
  float3 c3 = float3(1.00, 0.28, 0.78);  // 90'lar: neon magenta
  float3 c4 = float3(1.00, 0.55, 0.16);  // 80'ler: sıcak turuncu
  float3 c = mix(c0, c1, clamp(e, 0.0, 1.0));
  c = mix(c, c2, clamp(e - 1.0, 0.0, 1.0));
  c = mix(c, c3, clamp(e - 2.0, 0.0, 1.0));
  c = mix(c, c4, clamp(e - 3.0, 0.0, 1.0));
  return c;
}

// Tünelin kendisi: log-polar uzayda sana doğru akan yıldız çizgileri + ince ışık halkaları
float stars(float2 uv, float layer) {
  float r = length(uv);
  float a = atan(uv.y, uv.x) / 6.2831 + 0.5;          // 0..1
  float lr = log(r + 0.0001);
  float travel = t * (0.35 + 3.2 * speed) + layer * 7.13;
  float N = 70.0 + layer * 40.0;                        // açısal sütun
  float M = 2.2;                                        // derinlik sırası
  float2 g = float2(a * N, lr * M + travel);
  float2 id = floor(g);
  float2 f = fract(g);
  float h = hash(id + layer * 17.0);
  if (h < 0.55) return 0.0;
  float cx = 0.2 + 0.6 * hash(id * 1.7 + 3.1);
  float cy = hash(id * 2.3 + 7.7);
  float len = 0.04 + speed * 0.75;                      // hız arttıkça çizgi uzar
  float dx = abs(f.x - cx) * (N / 70.0);
  float dy = f.y - cy;
  float line = smoothstep(0.05, 0.0, dx) * smoothstep(0.0, 0.02, dy + len) * smoothstep(len, 0.0, dy + len * 0.5);
  return line * smoothstep(0.03, 0.45, r) * (0.5 + 0.5 * h);
}

float3 scene(float2 uv) {
  float r = length(uv);
  float3 base = eraColor(era);
  float s = stars(uv, 0.0) + stars(uv * 1.3, 1.0) * 0.7 + stars(uv * 0.8, 2.0) * 0.5;
  float z = 0.32 / (r + 0.015);
  float ring = sin((z + t * (0.6 + 9.0 * speed)) * 9.0);
  float rings = smoothstep(0.985, 1.0, ring) * 0.55 * smoothstep(0.05, 0.4, r);
  float3 col = mix(float3(1.0), base, 0.55) * s * 1.6 + base * rings;
  col += base * 0.035 / (r + 0.12);
  col += float3(1.0, 0.95, 0.85) * (0.006 / (r * r + 0.006)) * (0.2 + speed * 0.8);
  return col;
}

half4 main(float2 fc) {
  float2 uv = (fc - 0.5 * res) / res.y;

  float w3 = clamp(1.0 - abs(era - 3.0), 0.0, 1.0);   // 90'lar ağırlığı
  float w4 = clamp(era - 3.0, 0.0, 1.0);              // 80'ler ağırlığı
  float w2 = clamp(1.0 - abs(era - 2.0), 0.0, 1.0);   // 2000'ler

  // 90'lar: VHS yatay titreme
  float wob = (hash(float2(floor(fc.y / 6.0), floor(t * 24.0))) - 0.5) * 0.012 * w3;
  uv.x += wob;

  // kromatik sapma: hız ve 90'lar arttıkça renkler ayrışır
  float2 off = normalize(uv + 0.0001) * (0.0015 + 0.005 * speed + 0.007 * w3);
  float3 col;
  col.r = scene(uv + off).r;
  col.g = scene(uv).g;
  col.b = scene(uv - off).b;

  // 2000'ler: hafif piksel ızgarası
  float2 px = fract(fc / 3.0);
  col *= 1.0 - w2 * 0.12 * step(0.66, max(px.x, px.y));

  // 80'ler + 90'lar: tarama çizgileri
  float sl = 0.5 + 0.5 * sin(fc.y * 3.14159 * 0.66);
  col *= 1.0 - (0.10 * w3 + 0.16 * w4) * sl;

  // 80'ler: film greni + sepya
  float g = hash(fc + floor(t * 30.0)) - 0.5;
  col += g * (0.035 + 0.16 * w4 + 0.06 * w3);
  float lum = dot(col, float3(0.299, 0.587, 0.114));
  col = mix(col, float3(lum * 1.12, lum * 0.86, lum * 0.58), w4 * 0.55);

  // vinyet
  float r = length((fc - 0.5 * res) / res.y);
  col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.85;

  // varış ışığı
  col = mix(col, float3(1.0, 0.97, 0.9), flash);
  return half4(half3(clamp(col, 0.0, 1.0)), 1.0);
}
`;
