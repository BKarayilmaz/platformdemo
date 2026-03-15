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
let lastObstacleType = 'none';
let comboStreak = 0;
let comboTimer = 0;

let toast = {
  text: '',
  ttl: 0,
  color: '#ffffff',
};

let obstacles = [];
let skills = [];
let projectiles = [];

const missionTemplates = [
  { id: 'jump_uses', title: 'Jump Master', desc: 'Z ile 4 ziplama yap', event: 'z_used', target: 4, reward: 120 },
  { id: 'wall_break', title: 'Breaker', desc: 'X dash ile 3 duvar kir', event: 'wall_break', target: 3, reward: 150 },
  { id: 'shield_blocks', title: 'Guardian', desc: 'C ile 6 mermi blokla', event: 'projectile_block', target: 6, reward: 160 },
];

let mission = null;
let missionSwapDelay = 0;

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

function setToast(text, color = '#ffffff', ttl = 1.2) {
  toast.text = text;
  toast.color = color;
  toast.ttl = ttl;
}

function startNewMission() {
  const pick = missionTemplates[Math.floor(Math.random() * missionTemplates.length)];
  mission = {
    ...pick,
    progress: 0,
    done: false,
  };
  setToast(`Yeni gorev: ${mission.desc}`, '#ffcd57', 1.8);
}

function addMissionProgress(eventName, amount = 1) {
  if (!mission || mission.done) return;
  if (mission.event !== eventName) return;
  mission.progress += amount;
  if (mission.progress >= mission.target) {
    mission.done = true;
    score += mission.reward;
    setToast(`Gorev tamamlandi +${mission.reward} puan`, '#8cff98', 1.8);
    missionSwapDelay = 1.4;
    return;
  }
  setToast(`Gorev: ${mission.progress}/${mission.target}`, '#d9e5ff', 0.9);
}

function markSkillSuccess(skillType) {
  comboStreak += 1;
  comboTimer = 2.6;
  const labels = { z: 'Jump', x: 'Dash', c: 'Shield' };
  setToast(`${labels[skillType]} basarili x${getComboMultiplier().toFixed(1)}`, colors[skillType], 0.9);
}

function getComboMultiplier() {
  return 1 + Math.min(1.5, comboStreak * 0.12);
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
  lastObstacleType = 'none';
  comboStreak = 0;
  comboTimer = 0;
  missionSwapDelay = 0;
  obstacles = [];
  skills = [];
  projectiles = [];
  toast.ttl = 0;
  Object.values(cooldowns).forEach((c) => {
    c.current = 0;
  });
  startNewMission();
}

function spawnObstacle() {
  const x = W + rand(100, 280);
  const roll = Math.random();
  let nextType = 'turret';

  if (roll < 0.38) nextType = 'gap';
  else if (roll < 0.7) nextType = 'wall';

  // Fairness rules: avoid repeating the same high-risk pattern back-to-back.
  if (lastObstacleType === 'gap' && nextType === 'gap') nextType = Math.random() < 0.5 ? 'wall' : 'turret';
  if (lastObstacleType === 'gap' && nextType === 'wall') nextType = 'turret';
  if (lastObstacleType === 'wall' && nextType === 'wall' && Math.random() < 0.45) nextType = 'gap';

  if (nextType === 'gap') {
    obstacles.push({ type: 'gap', x, w: rand(120, 220) });
  } else if (nextType === 'wall') {
    obstacles.push({ type: 'wall', x, y: GROUND_Y - 90, w: rand(44, 70), h: 90 });
  } else {
    obstacles.push({
      type: 'turret',
      x,
      y: GROUND_Y - 66,
      w: 52,
      h: 66,
      fire: rand(0.8, 1.3),
    });
  }
  lastObstacleType = nextType;
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
  if (!player.alive) {
    setToast('Oyun bitti. R ile tekrar basla', '#ff9aa2');
    return;
  }
  const cd = cooldowns[selectedSkill];
  if (cd.current > 0) {
    setToast(`${selectedSkill.toUpperCase()} hazir degil: ${cd.current.toFixed(1)}s`, '#ffb86c');
    return;
  }

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
  toast.ttl = Math.max(0, toast.ttl - dt);
  if (missionSwapDelay > 0) {
    missionSwapDelay -= dt;
    if (missionSwapDelay <= 0) {
      startNewMission();
    }
  }

  if (comboTimer > 0) {
    comboTimer -= dt;
  } else if (comboStreak > 0) {
    comboStreak = Math.max(0, comboStreak - dt * 2.5);
  }

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
        markSkillSuccess('z');
        addMissionProgress('z_used', 1);
      }
    }

    if (s.type === 'x' && !s.used && intersects(prect, s)) {
      player.dashTime = 0.58;
      s.used = true;
      markSkillSuccess('x');
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
        score += 30 * getComboMultiplier();
        addMissionProgress('wall_break', 1);
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
        markSkillSuccess('c');
        addMissionProgress('projectile_block', 1);
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

  score += dt * 11 * getComboMultiplier();
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

  if (toast.ttl > 0) {
    ctx.font = '700 22px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillStyle = toast.color;
    ctx.fillText(toast.text, W / 2, 100);
  }
}

function updateStatus() {
  const zCd = cooldowns.z.current > 0 ? cooldowns.z.current.toFixed(1) + 's' : 'hazir';
  const xCd = cooldowns.x.current > 0 ? cooldowns.x.current.toFixed(1) + 's' : 'hazir';
  const cCd = cooldowns.c.current > 0 ? cooldowns.c.current.toFixed(1) + 's' : 'hazir';
  const comboText = `Combo x${getComboMultiplier().toFixed(1)}`;
  const missionText = mission
    ? `Gorev: ${mission.desc} (${Math.min(mission.progress, mission.target)}/${mission.target})`
    : 'Gorev: yukleniyor';

  statusEl.textContent = `Skor ${Math.floor(score)} | ${comboText} | Secili ${selectedSkill.toUpperCase()} | Z ${zCd} | X ${xCd} | C ${cCd} | ${missionText}`;

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
