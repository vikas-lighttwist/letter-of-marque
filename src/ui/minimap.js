// Round world chart: islands, the port, your fleet and every Spanish sail.
const WORLD_R = 860;

export class Minimap {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.size = this.canvas.width;
  }

  toMap(x, z) {
    const s = (this.size / 2 - 6) / WORLD_R;
    return [this.size / 2 + x * s, this.size / 2 + z * s];
  }

  update() {
    const { ctx, size, game } = this;
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);

    // sea
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 48, 66, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 169, 74, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // islands
    for (const isl of game.env.islands) {
      const [x, y] = this.toMap(isl.x, isl.z);
      const r = Math.max(2.5, isl.r * ((size / 2 - 6) / WORLD_R));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isl.port ? '#d9a94a' : '#7da868';
      ctx.fill();
      if (isl.port) {
        ctx.fillStyle = '#241a08';
        ctx.font = `bold ${Math.max(8, r)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚓', x, y + 0.5);
      }
    }

    // flotsam
    ctx.fillStyle = '#f2c14e';
    for (const l of game.loot) {
      const [x, y] = this.toMap(l.mesh.position.x, l.mesh.position.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    // X marks the spot
    if (game.treasure) {
      const [x, y] = this.toMap(game.treasure.x, game.treasure.z);
      ctx.strokeStyle = '#e0503c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
    }

    // ships
    for (const s of game.ships) {
      if (s.dead || s.sinking) continue;
      const [x, y] = this.toMap(s.pos.x, s.pos.z);
      if (s === game.flagship) continue;
      const big = s.classKey === 'shipOfTheLine' || s.classKey === 'galleon';
      ctx.beginPath();
      ctx.arc(x, y, big ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle =
        s.faction === 'england' ? '#e8f4ff' : s.classKey === 'galleon' ? '#ffcf4d' : '#e0503c';
      ctx.fill();
    }

    // flagship: heading triangle
    const f = game.flagship;
    if (f) {
      const [x, y] = this.toMap(f.pos.x, f.pos.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(Math.sin(f.heading), Math.cos(f.heading)) * -1 + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.5, 4);
      ctx.lineTo(-3.5, 4);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#1a3a4a';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}
