'use strict';

export function initNeuralNetwork(canvas, reducedMotion) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const nodes = [];
  const pointer = { x: -1000, y: -1000 };
  let time = 0;
  let animationFrame;
  let width = 0;
  let height = 0;

  const createNodes = () => {
    const density = width < 600 ? 92000 : 72000;
    const minimum = width < 600 ? 9 : 15;
    const maximum = width < 600 ? 14 : 25;
    const count = Math.min(maximum, Math.max(minimum, Math.round((width * height) / density)));
    const columns = Math.ceil(Math.sqrt(count * (width / Math.max(height, 1))));
    const rows = Math.ceil(count / columns);
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    nodes.length = 0;
    for (let index = 0; index < count; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      nodes.push({
        x: (column + .22 + Math.random() * .56) * cellWidth,
        y: (row + .22 + Math.random() * .56) * cellHeight,
        vx: (Math.random() - .5) * .09, vy: (Math.random() - .5) * .09,
        radius: Math.random() * 1.6 + 1, phase: Math.random() * Math.PI * 2,
        tone: index % 3,
      });
    }
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    createNodes();
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);
    time += .018;
    nodes.forEach((node, index) => {
      if (!reducedMotion.matches) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
      }
      for (let next = index + 1; next < nodes.length; next += 1) {
        const other = nodes[next];
        const distance = Math.hypot(node.x - other.x, node.y - other.y);
        if (distance > 210) continue;
        const alpha = (1 - distance / 210) * .22;
        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = node.tone === 1 || other.tone === 1
          ? `rgba(139,92,246,${alpha})` : `rgba(34,211,238,${alpha * .85})`;
        context.lineWidth = .75;
        context.stroke();
      }
      const pointerDistance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
      if (pointerDistance < 220) {
        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(pointer.x, pointer.y);
        context.strokeStyle = `rgba(103,232,249,${(1 - pointerDistance / 220) * .38})`;
        context.stroke();
      }
      const pulse = (Math.sin(time + node.phase) + 1) * .5;
      if (pulse > .72) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 3 + pulse * 3, 0, Math.PI * 2);
        context.strokeStyle = node.tone === 1
          ? `rgba(167,139,250,${pulse * .18})` : `rgba(37,99,235,${pulse * .18})`;
        context.stroke();
      }
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      const colors = ['rgba(34,211,238,.88)', 'rgba(167,139,250,.9)', 'rgba(37,99,235,.9)'];
      const glows = ['#22d3ee', '#8b5cf6', '#2563eb'];
      context.fillStyle = colors[node.tone];
      context.shadowColor = glows[node.tone];
      context.shadowBlur = 6 + pulse * 3;
      context.fill();
      context.shadowBlur = 0;
    });
    if (!reducedMotion.matches && !document.hidden) animationFrame = window.requestAnimationFrame(draw);
  };

  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    window.cancelAnimationFrame(animationFrame);
    if (!document.hidden) draw();
  });
  resize();
  draw();
}
