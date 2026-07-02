/*
 * grid-field.js — the living pane grid.
 *
 *   • .grid-hero     → full-bleed ambient backdrop behind the hero: a WebGL
 *                      fragment shader procedurally lights up a grid of cells
 *                      (like tmux panes) with drifting noise + an occasional
 *                      diagonal sweep, in the app's amber/gold palette. One
 *                      fullscreen quad, one draw call — no per-cell JS.
 *   • .grid-divider  → a thin animated pane-seam between sections: a cheap 2D
 *                      canvas drawing a dashed line with traveling glow blips.
 *
 * window.gridSurge(amount) bumps a shared decaying envelope so every canvas on
 * the page can react together to an interaction (e.g. a CTA hover).
 *
 * Performance: DPR capped at 1.5, requestAnimationFrame, paused on
 * visibilitychange:hidden, clean teardown.
 * Fallback: WebGL unavailable → a static amber gradient, no animation.
 * prefers-reduced-motion → one static frame, no rAF.
 */
(function () {
  "use strict";

  var REDUCE =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  var surge = 0;
  window.gridSurge = function (amount) {
    surge = Math.min(1.2, surge + (amount || 1));
  };

  /* ───────────────────────── HERO GRID (WebGL) ───────────────────────── */
  var FRAG = [
    "precision highp float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform float u_surge;",
    "uniform float u_alpha;",
    "",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }",
    "",
    "float vnoise(vec2 p){",
    "  vec2 i = floor(p); vec2 f = fract(p);",
    "  float a = hash(i);",
    "  float b = hash(i + vec2(1.0,0.0));",
    "  float c = hash(i + vec2(0.0,1.0));",
    "  float d = hash(i + vec2(1.0,1.0));",
    "  vec2 u = f*f*(3.0-2.0*f);",
    "  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;",
    "}",
    "",
    "// per-pane status hue — mirrors the app's real semantic palette (amber",
    "// dominant, occasional info/success/agent panes), not a flat monochrome grid.",
    "vec3 statusHot(vec2 cell){",
    "  float r = hash(cell * 1.37 + 4.2);",
    "  vec3 amber = vec3(1.00, 0.80, 0.40);",
    "  vec3 info  = vec3(0.53, 0.72, 0.90);",
    "  vec3 ok    = vec3(0.62, 0.82, 0.48);",
    "  vec3 agent = vec3(0.84, 0.64, 0.88);",
    "  if (r < 0.58) return amber;",
    "  if (r < 0.73) return info;",
    "  if (r < 0.88) return ok;",
    "  return agent;",
    "}",
    "",
    "// a traveling message: a bright dot sliding along one grid row/column,",
    "// jumping lanes each pass — reads as data hopping between panes.",
    "float packet(vec2 g, float lane, out vec3 pcol){",
    "  float speed  = 0.55 + hash(vec2(lane, 9.1)) * 0.5;",
    "  float rowY   = floor(hash(vec2(lane, 2.3)) * 20.0) + 0.5;",
    "  float phase  = hash(vec2(lane, 6.6)) * 10.0;",
    "  float travel = fract(u_time * speed * 0.12 + phase);",
    "  float colX   = travel * 34.0 - 2.0;",
    "  vec2  target = vec2(colX, rowY);",
    "  float d = length(g - target);",
    "  float head = exp(-d * d * 3.2);",
    "  float tail = exp(-max(g.x - target.x, 0.0) * 2.2) * exp(-abs(g.y - target.y) * 6.0) * step(g.x, target.x) * 0.5;",
    "  float laneMod = mod(lane, 4.0);",
    "  pcol = vec3(1.00, 0.80, 0.40);",
    "  if (laneMod > 0.5 && laneMod < 1.5) pcol = vec3(0.53, 0.72, 0.90);",
    "  if (laneMod > 1.5 && laneMod < 2.5) pcol = vec3(0.62, 0.82, 0.48);",
    "  if (laneMod > 2.5) pcol = vec3(0.84, 0.64, 0.88);",
    "  return clamp(head + tail, 0.0, 1.0);",
    "}",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_res;",
    "  vec2 auv = vec2(uv.x * (u_res.x / u_res.y), uv.y);",
    "",
    "  float cols = 30.0;",
    "  vec2 g = auv * cols;",
    "  vec2 cell = floor(g);",
    "  vec2 cu = fract(g);",
    "",
    "  // soft pane-border gap",
    "  float gap = smoothstep(0.05, 0.12, cu.x) * smoothstep(0.05, 0.12, 1.0 - cu.x)",
    "            * smoothstep(0.05, 0.12, cu.y) * smoothstep(0.05, 0.12, 1.0 - cu.y);",
    "",
    "  float n1 = vnoise(cell * 0.35 + vec2(u_time * 0.22, -u_time * 0.16));",
    "  float n2 = vnoise(cell * 0.9  - vec2(u_time * 0.5,  u_time * 0.3));",
    "  float b = smoothstep(0.52, 0.94, n1 * 0.65 + n2 * 0.35);",
    "",
    "  // diagonal sweep — a slow band of extra brightness crossing the field",
    "  float diag = fract((auv.x + auv.y) * 0.5 - u_time * 0.05);",
    "  float sweep = smoothstep(0.0, 0.18, 1.0 - abs(diag - 0.5) * 2.0);",
    "  b += sweep * 0.22;",
    "",
    "  b += u_surge * 0.35;",
    "  b = clamp(b, 0.0, 1.3);",
    "",
    "  vec3 dim = vec3(0.11, 0.075, 0.045);",
    "  vec3 mid = vec3(0.50, 0.34, 0.18);",
    "  vec3 hot = statusHot(cell);",
    "  vec3 col = mix(dim, mid, clamp(b, 0.0, 1.0));",
    "  col = mix(col, hot, clamp(b - 0.6, 0.0, 1.0) * 1.4);",
    "",
    "  float a = b * gap * u_alpha;",
    "",
    "  // traveling messages hopping through the grid",
    "  vec3 rgbPM = col * a;",
    "  float outA = a;",
    "  for (int k = 0; k < 5; k++) {",
    "    vec3 pcol;",
    "    float p = packet(g, float(k), pcol);",
    "    p *= (0.55 + u_surge * 0.6);",
    "    rgbPM += pcol * p * u_alpha * 1.7;",
    "    outA = clamp(outA + p * u_alpha * 1.7, 0.0, 1.0);",
    "  }",
    "",
    "  gl_FragColor = vec4(rgbPM, outA);",
    "}",
  ].join("\n");

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }",
  ].join("\n");

  var HERO_ALPHA = 0.4;

  function HeroGL(canvas) {
    var gl =
      canvas.getContext("webgl", {
        premultipliedAlpha: true,
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
      }) || canvas.getContext("experimental-webgl", { alpha: true });
    if (!gl) return null;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console) console.warn("grid shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn("grid link:", gl.getProgramInfoLog(prog));
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "u_res");
    var uTime = gl.getUniformLocation(prog, "u_time");
    var uSurge = gl.getUniformLocation(prog, "u_surge");
    var uAlpha = gl.getUniformLocation(prog, "u_alpha");
    gl.uniform1f(uAlpha, HERO_ALPHA);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * DPR));
      var h = Math.max(1, Math.round(r.height * DPR));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    function frame(t) {
      gl.uniform1f(uTime, t);
      gl.uniform1f(uSurge, surge);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    return { resize: resize, frame: frame };
  }

  /* ───────────────────────── SECTION DIVIDER (2D) ───────────────────────── */
  function Divider(canvas) {
    var ctx = canvas.getContext("2d");
    var w = 0,
      h = 0;
    var seed = Math.random() * 10;

    function resize() {
      var r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      var mid = h * 0.5;

      // base dashed seam
      ctx.save();
      ctx.strokeStyle = "rgba(213,154,74,0.28)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.stroke();
      ctx.restore();

      // traveling glow blips
      var n = 3;
      for (var i = 0; i < n; i++) {
        var phase = (t * 0.09 + i / n + seed * 0.1) % 1;
        var x = phase * (w + 160) - 80;
        var grd = ctx.createRadialGradient(x, mid, 0, x, mid, 60 * (1 + surge));
        grd.addColorStop(0, "rgba(231,182,90,0.55)");
        grd.addColorStop(1, "rgba(231,182,90,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(x - 60, mid - 60, 120, 120);
      }
    }

    return { resize: resize, frame: frame };
  }

  /* ───────────────────────── DRIVER ───────────────────────── */
  var instances = [];

  document.querySelectorAll(".grid-hero").forEach(function (c) {
    var hero = HeroGL(c);
    if (hero) {
      instances.push(hero);
    } else {
      c.classList.add("grid-fallback");
    }
  });
  document.querySelectorAll(".grid-divider").forEach(function (c) {
    instances.push(Divider(c));
  });

  if (!instances.length) return;

  function resizeAll() {
    instances.forEach(function (i) {
      i.resize();
    });
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

  if (REDUCE) {
    instances.forEach(function (i) {
      i.frame(6.5);
    });
    return;
  }

  var start = null;
  var raf = null;
  function loop(ts) {
    if (start == null) start = ts;
    var t = (ts - start) / 1000;
    surge *= 0.94;
    if (surge < 0.001) surge = 0;
    for (var i = 0; i < instances.length; i++) instances[i].frame(t);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    } else if (!raf) {
      start = null;
      raf = requestAnimationFrame(loop);
    }
  });
})();
