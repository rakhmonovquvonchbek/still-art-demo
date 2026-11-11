(() => {
  const canvas = document.getElementById("art");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let raf = 0;

  /** @type {{x:number,y:number,r:number,a:number,tw:number,spd:number,warm:number}[]} */
  const stars = [];
  /** @type {{cx:number,cy:number,rx:number,ry:number,hue:number,phase:number,drift:number,alpha:number}[]} */
  const nebulae = [];
  /** @type {{y:number,amp:number,thick:number,phase:number,spd:number,tint:string}[]} */
  const ribbons = [];

  // Prebaked film grain — tiled, never regenerated per frame
  const GRAIN_SIZE = 128;
  const grainCanvas = document.createElement("canvas");
  grainCanvas.width = GRAIN_SIZE;
  grainCanvas.height = GRAIN_SIZE;
  const gctx = grainCanvas.getContext("2d");
  const img = gctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28;
  }
  gctx.putImageData(img, 0, 0);
  const grainPattern = ctx.createPattern(grainCanvas, "repeat");

  function seedField() {
    stars.length = 0;
    nebulae.length = 0;
    ribbons.length = 0;

    const area = width * height;
    const starCount = Math.min(220, Math.max(48, Math.floor(area / 14000)));

    for (let i = 0; i < starCount; i += 1) {
      const roll = Math.random();
      let r;
      if (roll < 0.72) r = Math.random() * 0.7 + 0.25;
      else if (roll < 0.93) r = Math.random() * 1.1 + 0.9;
      else r = Math.random() * 1.6 + 1.6;

      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r,
        a: Math.random() * 0.55 + (r > 1.5 ? 0.35 : 0.18),
        tw: Math.random() * Math.PI * 2,
        spd: 0.0009 + Math.random() * 0.0024,
        warm: Math.random(),
      });
    }

    const blobs = Math.min(7, Math.max(4, Math.floor(width / 280)));
    for (let i = 0; i < blobs; i += 1) {
      // 0 teal, 1 olive-moss, 2 ink-slate, 3 soft amber wash
      const kind = i % 4;
      nebulae.push({
        cx: Math.random() * width,
        cy: Math.random() * height * 0.85,
        rx: width * (0.18 + Math.random() * 0.28),
        ry: height * (0.12 + Math.random() * 0.22),
        hue: kind,
        phase: Math.random() * Math.PI * 2,
        drift: 0.00004 + Math.random() * 0.00008,
        alpha: 0.045 + Math.random() * 0.055,
      });
    }

    for (let i = 0; i < 4; i += 1) {
      ribbons.push({
        y: height * (0.22 + i * 0.18),
        amp: 18 + Math.random() * 28,
        thick: 70 + Math.random() * 90,
        phase: Math.random() * Math.PI * 2,
        spd: 0.00012 + Math.random() * 0.0001,
        tint:
          i % 2 === 0
            ? "rgba(58, 110, 108,"
            : "rgba(92, 108, 72,",
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedField();
  }

  function skyBase(now) {
    const sway = Math.sin(now * 0.00005) * 0.03;
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#05080c");
    g.addColorStop(0.28 + sway, "#0a1418");
    g.addColorStop(0.55, "#0c1614");
    g.addColorStop(0.78, "#101a12");
    g.addColorStop(1, "#080e0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function nebulaWash(now) {
    for (let i = 0; i < nebulae.length; i += 1) {
      const n = nebulae[i];
      const ox = Math.sin(now * n.drift + n.phase) * width * 0.06;
      const oy = Math.cos(now * n.drift * 0.85 + n.phase * 1.3) * height * 0.04;
      const cx = n.cx + ox;
      const cy = n.cy + oy;
      const pulse = 0.85 + 0.15 * Math.sin(now * 0.00025 + n.phase);

      let rgb;
      let a = n.alpha * pulse;
      if (n.hue === 0) rgb = "42, 98, 102";
      else if (n.hue === 1) {
        rgb = "78, 96, 54";
        a *= 0.9;
      } else if (n.hue === 2) {
        rgb = "28, 42, 52";
        a *= 1.15;
      } else {
        rgb = "168, 132, 78";
        a *= 0.55;
      }

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(n.rx, n.ry) * pulse);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(0.45, `rgba(${rgb}, ${a * 0.35})`);
      g.addColorStop(1, "rgba(0,0,0,0)");

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(n.rx / Math.max(n.rx, n.ry), n.ry / Math.max(n.rx, n.ry));
      ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(cx - n.rx * 1.2, cy - n.ry * 1.2, n.rx * 2.4, n.ry * 2.4);
      ctx.restore();
    }
  }

  function fluidRibbons(now) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < ribbons.length; i += 1) {
      const r = ribbons[i];
      const yMid =
        r.y +
        Math.sin(now * r.spd + r.phase) * 14 +
        Math.sin(now * r.spd * 0.4 + r.phase * 2) * 8;

      ctx.beginPath();
      const step = Math.max(10, Math.floor(width / 64));
      for (let x = 0; x <= width + step; x += step) {
        const y =
          yMid +
          Math.sin(x * 0.0045 + now * r.spd * 2.2 + r.phase) * r.amp +
          Math.sin(x * 0.0018 + now * r.spd + r.phase * 0.7) * (r.amp * 0.55);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // close a soft band below the wave
      for (let x = width + step; x >= 0; x -= step) {
        const y =
          yMid +
          r.thick * 0.55 +
          Math.sin(x * 0.0038 + now * r.spd * 1.6 + r.phase + 1.1) * (r.amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      const band = ctx.createLinearGradient(0, yMid - r.amp, 0, yMid + r.thick);
      band.addColorStop(0, `${r.tint}0)`);
      band.addColorStop(0.45, `${r.tint}0.045)`);
      band.addColorStop(1, `${r.tint}0)`);
      ctx.fillStyle = band;
      ctx.fill();
    }

    ctx.restore();
  }

  function amberBloom(now) {
    const cx = width * (0.72 + Math.sin(now * 0.00004) * 0.04);
    const cy = height * (0.22 + Math.cos(now * 0.00005) * 0.03);
    const r = Math.max(width, height) * 0.38;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(196, 158, 88, 0.09)");
    g.addColorStop(0.3, "rgba(90, 120, 110, 0.05)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // secondary cooler bloom, lower left
    const cx2 = width * (0.22 + Math.sin(now * 0.00006 + 1) * 0.03);
    const cy2 = height * 0.62;
    const r2 = Math.max(width, height) * 0.32;
    const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
    g2.addColorStop(0, "rgba(48, 92, 96, 0.07)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(now) {
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const tw =
        0.45 +
        0.55 *
          (0.5 + 0.5 * Math.sin(now * s.spd + s.tw)) *
          (0.5 + 0.5 * Math.sin(now * s.spd * 1.7 + s.tw * 1.3));
      const alpha = Math.min(1, s.a * tw);

      if (s.r > 1.8) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4.5);
        if (s.warm > 0.7) {
          glow.addColorStop(0, `rgba(255, 220, 160, ${alpha * 0.35})`);
          glow.addColorStop(0.4, `rgba(210, 190, 140, ${alpha * 0.08})`);
        } else {
          glow.addColorStop(0, `rgba(210, 230, 228, ${alpha * 0.3})`);
          glow.addColorStop(0.4, `rgba(160, 190, 188, ${alpha * 0.07})`);
        }
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (s.warm > 0.75 && s.r > 1.2) {
        ctx.fillStyle = `rgba(255, 228, 180, ${alpha})`;
      } else if (s.warm < 0.2) {
        ctx.fillStyle = `rgba(190, 220, 218, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(228, 236, 230, ${alpha})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function filmGrain(now) {
    if (!grainPattern) return;
    const ox = ((now * 0.012) % GRAIN_SIZE) | 0;
    const oy = ((now * 0.009) % GRAIN_SIZE) | 0;
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.translate(ox, oy);
    ctx.fillStyle = grainPattern;
    ctx.fillRect(-ox - GRAIN_SIZE, -oy - GRAIN_SIZE, width + GRAIN_SIZE * 2, height + GRAIN_SIZE * 2);
    ctx.restore();
  }

  function vignette() {
    const g = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(2, 5, 7, 0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function frame(now) {
    if (!running) return;
    skyBase(now);
    nebulaWash(now);
    fluidRibbons(now);
    amberBloom(now);
    drawStars(now);
    filmGrain(now);
    vignette();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("resize", resize);
  resize();
  start();
})();
