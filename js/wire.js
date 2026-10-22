/* Провод — элемент схемы.
   Отрезок между двумя выводами компонентов.
   endA / endB — ссылки { comp, pinId }.
   points — массив точек ломаной. points[0] — конец A, points[last] — конец B.

   Регистрируется в window.SchematicComponents под ключом 'wire'.
*/
(function () {
  'use strict';

  window.SchematicComponents = window.SchematicComponents || {};

  const COL = {
    line:        '#e74c3c',
    shadow:      'rgba(0,0,0,0.08)',
    highlight:   'rgba(255,255,255,0.35)',
    selGlow:     'rgba(74, 144, 226, 0.35)',
    connFill:    '#ffffff',
    connEdge:    '#2c3e50',
    connEdgeSel: '#4a90e2',
    connHalo:    'rgba(74, 144, 226, 0.3)'
  };

  function drawConnector(ctx, x, y, color, selected) {
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = COL.connHalo;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = COL.connFill;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = selected ? COL.connEdgeSel : COL.connEdge;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
  }

  window.SchematicComponents.wire = {
    w: 0,
    h: 0,

    defaults: {
      type: 'wire',
      endA: null,
      endB: null,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ],
      ax: 0, ay: 0,
      bx: 0, by: 0,
      color: COL.line
    },

    draw(ctx) {
      const color = this._color || this.color || COL.line;
      const selected = !!this._selected;

      let pts;
      if (this.points && this.points.length >= 2) {
        pts = this.points;
      } else {
        pts = [{ x: this.ax, y: this.ay }, { x: this.bx, y: this.by }];
      }

      const drawPath = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      };

      ctx.save();

      if (selected) {
        drawPath();
        ctx.strokeStyle = COL.selGlow;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      drawPath();
      ctx.strokeStyle = COL.shadow;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      drawPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      drawPath();
      ctx.strokeStyle = COL.highlight;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      drawConnector(ctx, pts[0].x, pts[0].y, color, selected);
      drawConnector(ctx, pts[pts.length - 1].x, pts[pts.length - 1].y, color, selected);

      ctx.restore();
    }
  };
})();