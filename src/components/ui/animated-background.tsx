"use client";

import React, { useEffect, useRef, useState } from "react";

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      if (document.documentElement.classList.contains("dark")) return true;
      if (document.documentElement.classList.contains("light")) return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };

    setIsDark(checkDark());

    const observer = new MutationObserver(() => {
      setIsDark(checkDark());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particlesArray: Particle[] = [];
    let animationFrameId: number;

    const particleColor = isDark ? "rgba(0, 201, 232, 0.6)" : "rgba(0, 201, 232, 0.4)";
    const lineColor = isDark ? "rgba(0, 201, 232," : "rgba(0, 201, 232,";

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let mouse = {
      x: null as number | null,
      y: null as number | null,
      radius: 120, // Radio de interacción fijo, más amigable
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.x;
      mouse.y = event.y;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseout", handleMouseOut);

    class Particle {
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      size: number;

      constructor(x: number, y: number, directionX: number, directionY: number, size: number) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = particleColor;
        ctx.fill();
      }

      update() {
        if (this.x > canvas.width || this.x < 0) {
          this.directionX = -this.directionX;
        }
        if (this.y > canvas.height || this.y < 0) {
          this.directionY = -this.directionY;
        }

        // Mouse collision
        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius + this.size) {
            if (mouse.x < this.x && this.x < canvas.width - this.size * 10) {
              this.x += 0.5; // Mucho más suave
            }
            if (mouse.x > this.x && this.x > this.size * 10) {
              this.x -= 0.5;
            }
            if (mouse.y < this.y && this.y < canvas.height - this.size * 10) {
              this.y += 0.5;
            }
            if (mouse.y > this.y && this.y > this.size * 10) {
              this.y -= 0.5;
            }
          }
        }

        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      particlesArray = [];
      // Reducimos la densidad y ponemos un límite para buen rendimiento
      const calculatedParticles = Math.floor((canvas.height * canvas.width) / 15000);
      const numberOfParticles = Math.min(calculatedParticles, 70); 
      for (let i = 0; i < numberOfParticles; i++) {
        let size = Math.random() * 2 + 1;
        let x = Math.random() * (canvas.width - size * 2 - size * 2) + size * 2;
        let y = Math.random() * (canvas.height - size * 2 - size * 2) + size * 2;
        // Velocidad mucho más calmada y elegante
        let directionX = Math.random() * 0.3 - 0.15;
        let directionY = Math.random() * 0.3 - 0.15;

        particlesArray.push(new Particle(x, y, directionX, directionY, size));
      }
    }

    function connect() {
      let opacityValue = 1;
      const maxDistance = 15000;
      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) { // Start b at a + 1
          let distance =
            (particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x) +
            (particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y);
          if (distance < maxDistance) {
            opacityValue = 1 - distance / maxDistance;
            if (!ctx) return;
            // Solo conectamos si la opacidad es positiva
            if (opacityValue > 0) {
              ctx.strokeStyle = `${lineColor}${opacityValue})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
              ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
              ctx.stroke();
            }
          }
        }
      }
    }

    function animate() {
      if (!ctx) return;
      animationFrameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
      }
      connect();
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    window.addEventListener("resize", handleResize);

    init();
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseOut);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <div className="fixed inset-0 z-0 bg-background overflow-hidden">
      {/* Añadimos un pequeño degradado de fondo que vaya muy de acuerdo a Neo WA */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background dark:from-primary/10 dark:via-background dark:to-background pointer-events-none" />
      <canvas
        ref={canvasRef}
        className="block h-full w-full opacity-70"
        style={{ pointerEvents: "auto" }}
      />
    </div>
  );
}
