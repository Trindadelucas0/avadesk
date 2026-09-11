"use client";

import { useEffect, useRef } from "react";

/** Accent Avadesk (`--accent`), equivalente visual ao `#3a86ff` do template. */
const COLOR = { r: 107, g: 140, b: 255 };
const BASE_COUNT = 80;
const DENSITY_AREA = 800;
const LINK_DISTANCE = 150;
const LINK_OPACITY = 0.4;
const LINK_WIDTH = 1;
const MOVE_SPEED = 2;
const SIZE_VALUE = 3;
const OPACITY_VALUE = 0.5;
const MOBILE_CAP = 40;
const DESKTOP_CAP = 80;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

function particleCap(width: number) {
  return width < 768 ? MOBILE_CAP : DESKTOP_CAP;
}

function particleCount(width: number, height: number) {
  const area = (width * height) / 1000;
  const fromDensity = Math.round((area * BASE_COUNT) / DENSITY_AREA);
  return Math.max(16, Math.min(particleCap(width), fromDensity));
}

function seedParticles(width: number, height: number, previous: Particle[]): Particle[] {
  const count = particleCount(width, height);
  const next = previous.slice(0, count);
  while (next.length < count) {
    next.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.random() - 0.5,
      vy: Math.random() - 0.5,
      radius: Math.max(0.4, Math.random() * SIZE_VALUE),
      opacity: Math.random() * OPACITY_VALUE,
    });
  }
  for (const p of next) {
    p.x = Math.min(width, Math.max(0, p.x));
    p.y = Math.min(height, Math.max(0, p.y));
  }
  return next;
}

function wrap(p: Particle, width: number, height: number) {
  if (p.x - p.radius > width) {
    p.x = -p.radius;
    p.y = Math.random() * height;
  } else if (p.x + p.radius < 0) {
    p.x = width + p.radius;
    p.y = Math.random() * height;
  }
  if (p.y - p.radius > height) {
    p.y = -p.radius;
    p.x = Math.random() * width;
  } else if (p.y + p.radius < 0) {
    p.y = height + p.radius;
    p.x = Math.random() * width;
  }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  move: boolean
) {
  ctx.clearRect(0, 0, width, height);
  const ms = MOVE_SPEED / 2;

  for (const p of particles) {
    if (move) {
      p.x += p.vx * ms;
      p.y += p.vy * ms;
      wrap(p, width, height);
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${p.opacity})`;
    ctx.fill();
  }

  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist > LINK_DISTANCE) continue;
      const opacity = LINK_OPACITY * (1 - dist / LINK_DISTANCE);
      if (opacity <= 0) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${COLOR.r},${COLOR.g},${COLOR.b},${opacity})`;
      ctx.lineWidth = LINK_WIDTH;
      ctx.stroke();
    }
  }
}

export function ConnectedParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || window.innerWidth;
      height = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = seedParticles(width, height, particles);
      if (reduced) drawFrame(ctx, particles, width, height, false);
    };

    const loop = () => {
      if (document.visibilityState === "visible" && !reduced) {
        drawFrame(ctx, particles, width, height, true);
      }
      frame = window.requestAnimationFrame(loop);
    };

    const onMotion = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        drawFrame(ctx, particles, width, height, false);
      }
    };

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    motion.addEventListener("change", onMotion);
    window.addEventListener("resize", resize);
    resize();
    if (!reduced) frame = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      aria-hidden
    />
  );
}
