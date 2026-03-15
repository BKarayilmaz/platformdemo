const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const skillButtons = {
  z: document.getElementById('skill-z'),
  x: document.getElementById('skill-x'),
  c: document.getElementById('skill-c'),
};

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = 450;
const GRAVITY = 1600;

const player = {
  x: 220,
  y: GROUND_Y - 72,
  w: 46,
  h: 72,
  vy: 0,
  onGround: true,
  dashTime: 0,
  alive: true,
};

const colors = {
  z: '#42f57b',
  x: '#52b6ff',
  c: '#ff6e8f',
};

let selectedSkill = 'z';
let score = 0;
let worldSpeed = 260;
let difficulty = 1;
let spawnTimer = 1.3;
let lastTime = 0;

let obstacles = [];
let skills = [];
let projectiles = [];

const cooldowns = {
  z: { current: 0, max: 2.2 },
  x: { current: 0, max: 3.6 },
  c: { current: 0, max: 4.8 },
};

function updateSkillStrip() {
  Object.entries(skillButtons).forEach(([key, btn]) => {
    if (!btn) return;
    btn.classList.toggle('is-selected', key === selectedSkill);
  });
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function restart() {
  player.y = GROUND_Y - player.h;
  player.vy = 0;
  player.onGround = true;
  player.alive = true;
  player.dashTime = 0;
  score = 0;
  worldSpeed = 260;
  difficulty = 1;
  spawnTimer = 1.2;
  obstacles = [];
  skills = [];
  projectiles = [];
  Object.values(cooldowns).forEach((c) => {
    c.current = 0;
  });
}

function spawnObstacle() {
  const x = W + rand(100, 280);
  const roll = Math.random();

  if (roll < 0.38) {
    obstacles.push({ type: 'gap', x, w: rand(120, 220) });
    return;
  }

  if (roll < 0.7) {
    obstacles.push({ type: 'wall', x, y: GROUND_Y - 90, w: rand(44, 70), h: 90 });
    return;
  }

  obstacles.push({
    type: 'turret',
    x,
    y: GROUND_Y - 66,
    w: 52,
    h: 66,
    fire: rand(0.8, 1.3),
  });
}

function isPlayerOverGap() {
  const foot = player.x + player.w / 2;
  for (const o of obstacles) {
    if (o.type !== 'gap') continue;
    if (foot > o.x && foot < o.x + o.w) return true;
  }
  return false;
}

function placeSkill(mx, my) {
  if (!player.alive) return;
  const cd = cooldowns[selectedSkill];
  if (cd.current > 0) return;

  if (selectedSkill === 'z') {
    const y = Math.min(GROUND_Y - 10, Math.max(260, my));
    skills.push({ type: 'z', x: mx - 34, y, w: 68, h: 12, ttl: 8, used: false });
  } else if (selectedSkill === 'x') {
    const y = Math.min(GROUND_Y - 100, Math.max(220, my - 45));
    skills.push({ type: 'x', x: mx - 12, y, w: 24, h: 100, ttl: 7, used: false });
  } else {
    const y = Math.min(GROUND_Y - 120, Math.max(180, my - 45));
    skills.push({ type: 'c', x: mx - 10, y, w: 20, h: 120, ttl: 6, hp: 3 });
  }

  cd.current = cd.max;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * W;
  const my = ((e.clientY - rect.top) / rect.height) * H;
  placeSkill(mx, my);
});

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'z' || key === 'x' || key === 'c') {
    selectedSkill = key;
    updateSkillStrip();
  }
  if (key === 'r') restart();
});

Object.entries(skillButtons).forEach(([key, btn]) => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    selectedSkill = key;
    updateSkillStrip();
  });
});

function update(dt) {
  if (!player.alive) return;

  difficulty += dt * 0.04;
  worldSpeed = 260 + difficulty * 18;

  Object.values(cooldowns).forEach((c) => {
    c.current = Math.max(0, c.current - dt);
  });

  if (player.dashTime > 0) {
    player.dashTime -= dt;
  }

  const speed = worldSpeed + (player.dashTime > 0 ? 420 : 0);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = rand(Math.max(0.62, 1.35 - difficulty * 0.03), Math.max(0.9, 1.8 - difficulty * 0.04));
  }

  for (const o of obstacles) {
    o.x -= speed * dt;

    if (o.type === 'turret') {
      o.fire -= dt;
      if (o.fire <= 0 && o.x < W - 50 && o.x > 220) {
        projectiles.push({ x: o.x + 8, y: o.y + 20, w: 12, h: 12, v: 360 + difficulty * 22 });
        o.fire = rand(0.85, 1.35);
      }
    }
  }

  for (const s of skills) {
    s.x -= speed * dt;
    s.ttl -= dt;
  }

  for (const p of projectiles) {
    p.x -= (speed + p.v) * dt;
  }

  obstacles = obstacles.filter((o) => o.x + (o.w || 50) > -120);
  skills = skills.filter((s) => s.ttl > 0 && s.x + s.w > -120 && !(s.used && s.type !== 'c'));
  projectiles = projectiles.filter((p) => p.x + p.w > -30);

  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  const overGap = isPlayerOverGap();
  if (!overGap && player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  const prect = { x: player.x, y: player.y, w: player.w, h: player.h };

  for (const s of skills) {
    if (s.type === 'z' && !s.used) {
      const touchingTop =
        prect.x + prect.w > s.x &&
        prect.x < s.x + s.w &&
        prect.y + prect.h >= s.y &&
        prect.y + prect.h <= s.y + 18 &&
        player.vy >= 0;
      if (touchingTop) {
        player.vy = -740;
        player.onGround = false;
        s.used = true;
      }
    }

    if (s.type === 'x' && !s.used && intersects(prect, s)) {
      player.dashTime = 0.58;
      s.used = true;
    }
  }

  if (player.y > H + 60) {
    player.alive = false;
  }

  const remaining = [];
  for (const o of obstacles) {
    if (o.type === 'gap') {
      remaining.push(o);
      continue;
    }

    const oRect = { x: o.x, y: o.y, w: o.w, h: o.h };
    if (intersects(prect, oRect)) {
      if (o.type === 'wall' && player.dashTime > 0) {
        score += 30;
        continue;
      }
      player.alive = false;
    }
    remaining.push(o);
  }
  obstacles = remaining;

  const keptProjectiles = [];
  for (const p of projectiles) {
    let consumed = false;
    for (const s of skills) {
      if (s.type !== 'c') continue;
      if (intersects(p, s)) {
        s.hp -= 1;
        consumed = true;
        if (s.hp <= 0) s.ttl = 0;
        break;
      }
    }

    if (consumed) continue;

    if (intersects(prect, p) && player.dashTime <= 0) {
      player.alive = false;
      continue;
    }

    keptProjectiles.push(p);
  }
  projectiles = keptProjectiles;

  score += dt * 11;
}

function drawBackground(t) {
  ctx.fillStyle = '#0c1728';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(195, 225, 255, 0.12)';
  ctx.lineWidth = 1;
  const shift = (t * 0.04) % 48;
  for (let x = -48; x < W + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x - shift, 0);
    ctx.lineTo(x - shift, H);
    ctx.stroke();
  }

  ctx.fillStyle = '#15382b';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  const gaps = obstacles.filter((o) => o.type === 'gap');
  ctx.fillStyle = '#0c1728';
  for (const g of gaps) {
    ctx.fillRect(g.x, GROUND_Y, g.w, H - GROUND_Y);
  }
}

function draw() {
  drawBackground(performance.now());

  for (const o of obstacles) {
    if (o.type === 'gap') continue;
    if (o.type === 'wall') {
      ctx.fillStyle = '#7e8ca5';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#50617e';
      ctx.fillRect(o.x + 6, o.y + 8, o.w - 12, 10);
    }

    if (o.type === 'turret') {
      ctx.fillStyle = '#a66067';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#402833';
      ctx.fillRect(o.x - 6, o.y + 18, 15, 10);
    }
  }

  for (const s of skills) {
    ctx.fillStyle = colors[s.type];
    if (s.type === 'z') {
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillRect(s.x + 10, s.y - 8, s.w - 20, 8);
    } else if (s.type === 'x') {
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#c4e6ff';
      ctx.fillRect(s.x + 4, s.y + 10, s.w - 8, s.h - 20);
    } else {
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  for (const p of projectiles) {
    ctx.fillStyle = '#ffd26a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  ctx.fillStyle = player.dashTime > 0 ? '#7bd3ff' : '#ffcd57';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = '#23324f';
  ctx.fillRect(player.x + 28, player.y + 18, 10, 10);
}

function updateStatus() {
  const zCd = cooldowns.z.current > 0 ? cooldowns.z.current.toFixed(1) + 's' : 'hazir';
  const xCd = cooldowns.x.current > 0 ? cooldowns.x.current.toFixed(1) + 's' : 'hazir';
  const cCd = cooldowns.c.current > 0 ? cooldowns.c.current.toFixed(1) + 's' : 'hazir';

  const planText = [
    'Skill plan:',
    `Z Jump Pad: cd 2.2s, omur 8s, tek kullanim`,
    `X Dash Gate: cd 3.6s, omur 7s, dash 0.58s + duvar kirma`,
    `C Barrier: cd 4.8s, omur 6s, 3 vurus absorbe`,
  ].join(' | ');

  statusEl.textContent = `Skor ${Math.floor(score)} | Secili ${selectedSkill.toUpperCase()} | Z ${zCd} | X ${xCd} | C ${cCd} | ${planText}`;

  if (!player.alive) {
    statusEl.textContent += ' | Oyun bitti - R ile yeniden baslat';
  }
}

function loop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.033, (ts - lastTime) / 1000);
  lastTime = ts;

  update(dt);
  draw();
  updateStatus();

  requestAnimationFrame(loop);
}

restart();
updateSkillStrip();
requestAnimationFrame(loop);
