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
    const density = width < 600 ? 68000 : 47000;
    const minimum = width < 600 ? 12 : 20;
    const maximum = width < 600 ? 20 : 34;
    const count = Math.min(maximum, Math.max(minimum, Math.round((width * height) / density)));
    nodes.length = 0;
    for (let index = 0; index < count; index += 1) {
      nodes.push({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - .5) * .13, vy: (Math.random() - .5) * .13,
        radius: Math.random() * 1.6 + 1, phase: Math.random() * Math.PI * 2,
        white: index % 5 === 0, violet: index % 7 === 0,
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
        if (distance > 185) continue;
        const alpha = (1 - distance / 185) * .3;
        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = node.violet || other.violet
          ? `rgba(200,107,211,${alpha * .82})` : `rgba(117,17,130,${alpha * 1.15})`;
        context.lineWidth = .75;
        context.stroke();
      }
      const pointerDistance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
      if (pointerDistance < 220) {
        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(pointer.x, pointer.y);
        context.strokeStyle = `rgba(237,112,255,${(1 - pointerDistance / 220) * .5})`;
        context.stroke();
      }
      const pulse = (Math.sin(time + node.phase) + 1) * .5;
      if (pulse > .72) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 3 + pulse * 3, 0, Math.PI * 2);
        context.strokeStyle = node.violet
          ? `rgba(237,112,255,${pulse * .2})` : `rgba(117,17,130,${pulse * .22})`;
        context.stroke();
      }
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fillStyle = node.white ? 'rgba(255,255,255,.8)'
        : node.violet ? 'rgba(237,112,255,.95)' : 'rgba(200,107,211,.92)';
      context.shadowColor = node.white ? '#fff' : node.violet ? '#38bdf8' : '#2563eb';
      context.shadowBlur = 8 + pulse * 4;
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
