/* ============================================================
   STATE & STORAGE HELPERS
============================================================ */
const STATE = {
  user: null,
  workouts: [],
  meals: [],
  weights: [],
  waterGlasses: 6,
  waterGoal: 8,
  photos: [],
  goal: 'gain-muscle',
  calorieGoal: 2000,
  theme: 'dark'
};

// LocalStorage helpers
const LS = {
  save(key, val) { try { localStorage.setItem('ff_' + key, JSON.stringify(val)); } catch(e){} },
  load(key, def) { try { const v = localStorage.getItem('ff_' + key); return v ? JSON.parse(v) : def; } catch(e){ return def; } }
};

/* ============================================================
   AUTH
============================================================ */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (tab==='login'&&i===0)||(tab==='signup'&&i===1)));
  document.getElementById('login-panel').classList.toggle('active', tab === 'login');
  document.getElementById('signup-panel').classList.toggle('active', tab === 'signup');
}

function fillDemo() {
  document.getElementById('login-email').value = 'demo@fitforge.com';
  document.getElementById('login-password').value = 'demo123';
}

function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value.trim();
  if (!email || !pass) { showToast('❌', 'Please fill all fields'); return; }
  // Check saved users or demo
  const users = LS.load('users', []);
  const demo = { name:'Alex Johnson', email:'demo@fitforge.com', password:'demo123', height:175, weight:75.2, calGoal:2000, joined:'March 2026' };
  const found = users.find(u => u.email === email && u.password === pass) || (email === demo.email && pass === demo.password ? demo : null);
  if (!found) { showToast('❌', 'Invalid credentials'); return; }
  loginUser(found);
}

function handleSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const height = document.getElementById('signup-height').value;
  const weight = document.getElementById('signup-weight').value;
  const pass = document.getElementById('signup-password').value;
  if (!name || !email || !pass) { showToast('❌', 'Please fill required fields'); return; }
  const users = LS.load('users', []);
  if (users.find(u => u.email === email)) { showToast('❌', 'Email already registered'); return; }
  const user = { name, email, password: pass, height: height || 170, weight: weight || 70, calGoal: 2000, joined: new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'}) };
  users.push(user);
  LS.save('users', users);
  loginUser(user);
}

function loginUser(user) {
  STATE.user = user;
  LS.save('currentUser', user);
  loadUserData();
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  renderUI();
  initCharts();
  showToast('🎉', 'Welcome back, ' + user.name.split(' ')[0] + '!');
  refreshQuote();
  // Workout reminder notification after 3s. This only fires if the user has
  // already allowed device notifications from the bell button.
  setTimeout(() => {
    sendDeviceNotification({
      title: 'FitForge Workout Reminder',
      body: "Time to hit the gym! Don't skip today.",
      tag: 'fitforge-workout-reminder'
    });
  }, 3000);
}

function logout() {
  LS.save('currentUser', null);
  location.reload();
}

/* ============================================================
   ON LOAD — AUTO-LOGIN IF SESSION EXISTS
============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const saved = LS.load('currentUser', null);
  if (saved && saved.email) {
    loginUser(saved);
  }
  // Load theme
  const theme = LS.load('theme', 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  STATE.theme = theme;
  updateThemeLabel();
  registerNotificationWorker();
  updateInstallButton();
});

/* ============================================================
   LOAD USER DATA FROM LS
============================================================ */
function loadUserData() {
  const u = STATE.user.email;
  STATE.workouts = LS.load('workouts_' + u, getDemoWorkouts());
  STATE.meals = LS.load('meals_' + u, getDemoMeals());
  STATE.weights = LS.load('weights_' + u, getDemoWeights());
  STATE.waterGlasses = LS.load('water_' + u, 6);
  STATE.photos = LS.load('photos_' + u, []);
  STATE.goal = LS.load('goal_' + u, 'gain-muscle');
  STATE.calorieGoal = STATE.user.calGoal || 2000;
}

function saveUserData() {
  const u = STATE.user.email;
  LS.save('workouts_' + u, STATE.workouts);
  LS.save('meals_' + u, STATE.meals);
  LS.save('weights_' + u, STATE.weights);
  LS.save('water_' + u, STATE.waterGlasses);
  LS.save('photos_' + u, STATE.photos);
  LS.save('goal_' + u, STATE.goal);
}

/* ============================================================
   DEMO DATA
============================================================ */
function getDemoWorkouts() {
  return [
    { id: 1, name:'Push Day A', type:'push', duration:55, cals:320, date:'2026-03-25', exercises:[
      {name:'Bench Press',sets:4,reps:8,weight:80},
      {name:'Overhead Press',sets:3,reps:10,weight:50},
      {name:'Tricep Pushdown',sets:3,reps:12,weight:30}
    ]},
    { id: 2, name:'Pull Day', type:'pull', duration:60, cals:350, date:'2026-03-24', exercises:[
      {name:'Deadlift',sets:4,reps:5,weight:120},
      {name:'Pull-ups',sets:3,reps:8,weight:0},
      {name:'Barbell Row',sets:3,reps:10,weight:70}
    ]},
    { id: 3, name:'Leg Day', type:'legs', duration:70, cals:420, date:'2026-03-22', exercises:[
      {name:'Squat',sets:4,reps:8,weight:100},
      {name:'Leg Press',sets:3,reps:12,weight:150},
      {name:'Calf Raises',sets:4,reps:15,weight:60}
    ]},
    { id: 4, name:'Morning Run', type:'cardio', duration:35, cals:280, date:'2026-03-21', exercises:[
      {name:'Running',sets:1,reps:1,weight:0}
    ]}
  ];
}

function getDemoMeals() {
  return [
    { id: 1, name:'Oats with Banana', type:'breakfast', cals:380, carbs:65, protein:14, fat:8, date:'2026-03-26' },
    { id: 2, name:'Chicken Rice Bowl', type:'lunch', cals:620, carbs:80, protein:52, fat:12, date:'2026-03-26' },
    { id: 3, name:'Protein Shake', type:'snack', cals:180, carbs:15, protein:30, fat:3, date:'2026-03-26' },
    { id: 4, name:'Salmon & Veggies', type:'dinner', cals:660, carbs:50, protein:52, fat:22, date:'2026-03-26' }
  ];
}

function getDemoWeights() {
  const w = [];
  const base = 76.8;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  days.forEach((d,i) => w.push({ day: d, value: +(base - i * 0.23 + (Math.random()-.5)*.3).toFixed(1) }));
  return w;
}

/* ============================================================
   NAVIGATION
============================================================ */
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = { dashboard:'DASHBOARD', workouts:'WORKOUT TRACKER', progress:'PROGRESS', calories:'CALORIES', water:'WATER INTAKE', bmi:'BMI CALCULATOR', goals:'GOALS', photos:'PROGRESS PHOTOS', profile:'PROFILE' };
  document.getElementById('topbar-title').textContent = titles[page] || page.toUpperCase();
  closeSidebar();
  // Page-specific renders
  if (page === 'dashboard') renderDashboard();
  if (page === 'workouts') renderWorkoutLog();
  if (page === 'calories') renderMeals();
  if (page === 'water') renderWater();
  if (page === 'progress') renderProgressCharts();
  if (page === 'photos') renderPhotos();
  if (page === 'profile') renderProfile();
  window.scrollTo(0, 0);
}

/* ============================================================
   SIDEBAR (MOBILE)
============================================================ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

/* ============================================================
   THEME
============================================================ */
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  LS.save('theme', STATE.theme);
  updateThemeLabel();
  // Rebuild charts for theme
  setTimeout(() => { destroyCharts(); initCharts(); }, 100);
}
function updateThemeLabel() {
  document.getElementById('theme-label').textContent = STATE.theme === 'dark' ? 'Dark Mode' : 'Light Mode';
}

/* ============================================================
   RENDER UI (GENERAL)
============================================================ */
function renderUI() {
  const u = STATE.user;
  const firstName = u.name.split(' ')[0].toUpperCase();
  document.getElementById('welcome-username').textContent = firstName;
  document.getElementById('sidebar-username').textContent = u.name;
  document.getElementById('sidebar-goal').textContent = goalLabel(STATE.goal);
  document.getElementById('sidebar-avatar').textContent = u.name[0];
  // Greeting
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
  document.getElementById('greeting-text').textContent = greet;
  renderDashboard();
}

function goalLabel(g) {
  return { 'lose-weight': 'Lose Weight', 'gain-muscle': 'Gain Muscle', 'maintain': 'Maintain' }[g] || g;
}

/* ============================================================
   DASHBOARD
============================================================ */
function renderDashboard() {
  // Stats
  const todayMeals = STATE.meals.filter(m => m.date === todayStr());
  const totalCals = todayMeals.reduce((s,m) => s + m.cals, 0);
  const latestWeight = STATE.weights.length ? STATE.weights[STATE.weights.length-1].value : '--';
  document.getElementById('dash-weight').textContent = latestWeight;
  document.getElementById('dash-workouts').textContent = STATE.workouts.length;
  document.getElementById('dash-calories').textContent = totalCals.toLocaleString();
  document.getElementById('dash-water').textContent = STATE.waterGlasses;
  document.getElementById('dash-water-bar').style.width = Math.min(100,(STATE.waterGlasses/STATE.waterGoal)*100) + '%';

  // Recent workouts
  const list = document.getElementById('recent-workouts-list');
  if (!STATE.workouts.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏋️</div><div class="empty-state-text">No workouts yet. Start logging!</div></div>';
    return;
  }
  list.innerHTML = STATE.workouts.slice(0,4).map(w => `
    <div class="recent-workout-item">
      <span class="workout-type-badge badge-${w.type}">${w.type}</span>
      <div class="workout-item-info">
        <div class="workout-item-name">${w.name}</div>
        <div class="workout-item-meta">${w.duration} min · ${w.exercises.length} exercises</div>
      </div>
      <div class="workout-item-right">
        <div class="workout-item-calories">${w.cals}</div>
        <div class="workout-item-date">${formatDate(w.date)}</div>
      </div>
    </div>`).join('');
}

/* ============================================================
   CHARTS
============================================================ */
let charts = {};
function destroyCharts() {
  Object.values(charts).forEach(c => { if(c) c.destroy(); });
  charts = {};
}

function initCharts() {
  const isDark = STATE.theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = isDark ? '#a0a0a8' : '#555560';
  const accent = '#b5f23d';
  const blue = '#4da6ff';
  const orange = '#ff8c42';

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = gridColor;

  // Weekly activity chart (dashboard)
  const wCtx = document.getElementById('weeklyChart');
  if (wCtx) {
    charts.weekly = new Chart(wCtx, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Calories Burned',
          data: [320, 0, 350, 420, 0, 280, 180],
          backgroundColor: [accent, 'rgba(181,242,61,0.2)', accent, accent, 'rgba(181,242,61,0.2)', accent, accent],
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
          x: { grid: { display: false }, ticks: { color: textColor } }
        }
      }
    });
  }

  // Weight chart
  const weightCtx = document.getElementById('weightChart');
  if (weightCtx) {
    charts.weight = new Chart(weightCtx, {
      type: 'line',
      data: {
        labels: STATE.weights.map(w => w.day),
        datasets: [{
          label: 'Weight (kg)',
          data: STATE.weights.map(w => w.value),
          borderColor: accent, backgroundColor: 'rgba(181,242,61,0.1)',
          tension: 0.4, fill: true, pointBackgroundColor: accent,
          pointRadius: 4, pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
          x: { grid: { display: false }, ticks: { color: textColor } }
        }
      }
    });
  }

  // Volume chart
  const volCtx = document.getElementById('volumeChart');
  if (volCtx) {
    charts.volume = new Chart(volCtx, {
      type: 'doughnut',
      data: {
        labels: ['Push','Pull','Legs','Cardio'],
        datasets: [{
          data: [8, 6, 6, 4],
          backgroundColor: ['rgba(255,77,77,0.7)','rgba(77,166,255,0.7)','rgba(168,85,247,0.7)','rgba(255,140,66,0.7)'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, padding: 14 } }
        },
        cutout: '65%'
      }
    });
  }

  // Monthly calories chart
  const monCtx = document.getElementById('monthlyCalChart');
  if (monCtx) {
    charts.monthly = new Chart(monCtx, {
      type: 'line',
      data: {
        labels: Array.from({length:26},(v,i) => 'Mar '+(i+1)),
        datasets: [{
          label: 'Cal Burned',
          data: Array.from({length:26},() => Math.floor(200+Math.random()*300)),
          borderColor: orange, backgroundColor: 'rgba(255,140,66,0.1)',
          tension: 0.4, fill: true, pointRadius: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: gridColor }, ticks: { color: textColor } },
          x: { grid: { display: false }, ticks: { color: textColor, maxTicksLimit: 6 } }
        }
      }
    });
  }
}

function renderProgressCharts() {
  // Rebuild if destroyed
  if (!charts.weight) setTimeout(() => initCharts(), 50);
}

function setWeightChartRange(range, el) {
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/* ============================================================
   WORKOUTS
============================================================ */
let exerciseRows = [];

function addExerciseRow() {
  const id = Date.now();
  exerciseRows.push(id);
  const list = document.getElementById('exercise-list');
  const row = document.createElement('div');
  row.className = 'exercise-item';
  row.id = 'ex-' + id;
  row.innerHTML = `
    <input class="ex-name" placeholder="Exercise name" id="ex-name-${id}" />
    <input class="ex-sets" type="number" placeholder="Sets" id="ex-sets-${id}" style="width:60px" />
    <input class="ex-reps" type="number" placeholder="Reps" id="ex-reps-${id}" style="width:60px" />
    <input class="ex-weight" type="number" placeholder="kg" id="ex-weight-${id}" style="width:60px" />
    <div class="ex-del" onclick="removeExerciseRow(${id})">✕</div>`;
  list.appendChild(row);
}

function removeExerciseRow(id) {
  document.getElementById('ex-' + id)?.remove();
  exerciseRows = exerciseRows.filter(r => r !== id);
}

function saveWorkout() {
  const name = document.getElementById('wkt-name').value.trim();
  const type = document.getElementById('wkt-type').value;
  const duration = parseInt(document.getElementById('wkt-duration').value) || 0;
  const cals = parseInt(document.getElementById('wkt-cals').value) || 0;
  if (!name) { showToast('❌', 'Please enter a workout name'); return; }
  const exercises = exerciseRows.map(id => ({
    name: document.getElementById('ex-name-'+id)?.value || '',
    sets: parseInt(document.getElementById('ex-sets-'+id)?.value) || 0,
    reps: parseInt(document.getElementById('ex-reps-'+id)?.value) || 0,
    weight: parseFloat(document.getElementById('ex-weight-'+id)?.value) || 0
  })).filter(e => e.name);
  const workout = { id: Date.now(), name, type, duration, cals, date: todayStr(), exercises };
  STATE.workouts.unshift(workout);
  saveUserData();
  // Reset form
  document.getElementById('wkt-name').value = '';
  document.getElementById('wkt-duration').value = '';
  document.getElementById('wkt-cals').value = '';
  document.getElementById('exercise-list').innerHTML = '';
  exerciseRows = [];
  renderWorkoutLog();
  showToast('✅', 'Workout saved! Great work! 💪');
}

function renderWorkoutLog() {
  const log = document.getElementById('workout-log');
  if (!STATE.workouts.length) {
    log.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No workouts yet. Log your first session!</div></div>';
    return;
  }
  log.innerHTML = STATE.workouts.map(w => `
    <div class="workout-log-item">
      <div class="workout-log-header">
        <span class="workout-type-badge badge-${w.type}">${w.type}</span>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700">${w.name}</div>
          <div style="font-size:12px;color:var(--text2)">${formatDate(w.date)} · ${w.duration} min · ${w.cals} cal</div>
        </div>
        <button class="btn-danger" onclick="deleteWorkout(${w.id})">Delete</button>
      </div>
      ${w.exercises.length ? `
      <div class="workout-log-exercises">
        <table class="exercise-table">
          <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th></tr></thead>
          <tbody>
            ${w.exercises.map(e => `<tr><td>${e.name}</td><td>${e.sets}</td><td>${e.reps}</td><td>${e.weight ? e.weight+'kg' : 'BW'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`).join('');
}

function deleteWorkout(id) {
  STATE.workouts = STATE.workouts.filter(w => w.id !== id);
  saveUserData();
  renderWorkoutLog();
  showToast('🗑️', 'Workout deleted');
}

/* ============================================================
   CALORIES
============================================================ */
function addMeal() {
  const name = document.getElementById('meal-name').value.trim();
  const type = document.getElementById('meal-type').value;
  const cals = parseInt(document.getElementById('meal-cals').value) || 0;
  const carbs = parseInt(document.getElementById('meal-carbs').value) || 0;
  const protein = parseInt(document.getElementById('meal-protein').value) || 0;
  const fat = parseInt(document.getElementById('meal-fat').value) || 0;
  if (!name || !cals) { showToast('❌', 'Enter meal name and calories'); return; }
  STATE.meals.unshift({ id: Date.now(), name, type, cals, carbs, protein, fat, date: todayStr() });
  saveUserData();
  ['meal-name','meal-cals','meal-carbs','meal-protein','meal-fat'].forEach(id => document.getElementById(id).value = '');
  renderMeals();
  showToast('🍽️', 'Meal logged!');
}

function renderMeals() {
  const today = STATE.meals.filter(m => m.date === todayStr());
  const totalCals = today.reduce((s,m) => s + m.cals, 0);
  const totalCarbs = today.reduce((s,m) => s + m.carbs, 0);
  const totalProt = today.reduce((s,m) => s + m.protein, 0);
  const totalFat = today.reduce((s,m) => s + m.fat, 0);

  document.getElementById('ring-calories').textContent = totalCals;
  document.getElementById('macro-carbs').textContent = totalCarbs + 'g';
  document.getElementById('macro-protein').textContent = totalProt + 'g';
  document.getElementById('macro-fat').textContent = totalFat + 'g';

  // Ring animation
  const goal = STATE.calorieGoal;
  const circumference = 408;
  const offset = circumference - (Math.min(totalCals/goal,1) * circumference);
  document.getElementById('calorie-ring-circle').style.strokeDashoffset = offset;

  const dotClass = { breakfast:'dot-breakfast', lunch:'dot-lunch', dinner:'dot-dinner', snack:'dot-snack' };
  const list = document.getElementById('meal-list');
  if (!today.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍽️</div><div class="empty-state-text">No meals logged today. Stay fueled!</div></div>';
    return;
  }
  list.innerHTML = today.map(m => `
    <div class="meal-item">
      <div class="meal-type-dot ${dotClass[m.type]||'dot-snack'}"></div>
      <div class="meal-info">
        <div class="meal-name">${m.name}</div>
        <div class="meal-type-label">${m.type.charAt(0).toUpperCase()+m.type.slice(1)} · ${m.carbs}g carbs · ${m.protein}g protein · ${m.fat}g fat</div>
      </div>
      <div class="meal-calories">${m.cals} kcal</div>
      <button class="btn-danger" onclick="deleteMeal(${m.id})" style="margin-left:8px">✕</button>
    </div>`).join('');
}

function deleteMeal(id) {
  STATE.meals = STATE.meals.filter(m => m.id !== id);
  saveUserData();
  renderMeals();
  showToast('🗑️', 'Meal removed');
}

/* ============================================================
   WATER
============================================================ */
function renderWater() {
  const g = document.getElementById('water-glasses');
  g.innerHTML = '';
  for (let i = 0; i < STATE.waterGoal; i++) {
    const div = document.createElement('div');
    div.className = 'water-glass' + (i < STATE.waterGlasses ? ' filled' : '');
    div.textContent = i < STATE.waterGlasses ? '💧' : '🥛';
    div.onclick = () => { STATE.waterGlasses = i < STATE.waterGlasses ? i : i+1; saveUserData(); renderWater(); };
    g.appendChild(div);
  }
  document.getElementById('water-count').textContent = STATE.waterGlasses;
  document.getElementById('water-bar').style.width = Math.min(100,(STATE.waterGlasses/STATE.waterGoal)*100) + '%';
  const liters = (STATE.waterGlasses * 0.25).toFixed(2);
  const goalL = (STATE.waterGoal * 0.25).toFixed(1);
  document.getElementById('water-liters').textContent = `${liters}L / ${goalL}L goal`;
}
function addWater() {
  if (STATE.waterGlasses < STATE.waterGoal) { STATE.waterGlasses++; saveUserData(); renderWater(); showToast('💧','Glass logged! Keep going!'); }
  else showToast('🎉','Daily water goal achieved!');
}
function removeWater() {
  if (STATE.waterGlasses > 0) { STATE.waterGlasses--; saveUserData(); renderWater(); }
}
function resetWater() { STATE.waterGlasses = 0; saveUserData(); renderWater(); showToast('🔄','Water intake reset'); }

/* ============================================================
   BMI CALCULATOR
============================================================ */
function calculateBMI() {
  const h = parseFloat(document.getElementById('bmi-height').value);
  const w = parseFloat(document.getElementById('bmi-weight').value);
  if (!h || !w) { showToast('❌','Enter height and weight'); return; }
  const bmi = (w / ((h/100) ** 2)).toFixed(1);
  document.getElementById('bmi-value').textContent = bmi;
  let cat, cls, advice;
  if (bmi < 18.5) {
    cat='Underweight'; cls='bmi-underweight';
    advice='Your BMI is below the normal range. Consider increasing caloric intake and strength training to build muscle mass. Consult a nutritionist for a personalized plan.';
  } else if (bmi < 25) {
    cat='Normal Weight'; cls='bmi-normal';
    advice='🎉 Your BMI is in the healthy range! Keep up your current fitness routine and balanced diet to maintain this.';
  } else if (bmi < 30) {
    cat='Overweight'; cls='bmi-overweight';
    advice='Your BMI is slightly above normal. A combination of regular cardio, strength training, and a moderate caloric deficit can help you reach a healthier weight.';
  } else {
    cat='Obese'; cls='bmi-obese';
    advice='Your BMI indicates obesity. Please consult a healthcare professional. A structured workout program and dietary changes can significantly improve your health.';
  }
  const catEl = document.getElementById('bmi-category');
  catEl.textContent = cat;
  catEl.className = 'bmi-category ' + cls;
  document.getElementById('bmi-advice').textContent = advice;
  showToast('📊','BMI calculated: ' + bmi + ' — ' + cat);
}

/* ============================================================
   GOALS
============================================================ */
function selectGoal(goal, el) {
  document.querySelectorAll('.goal-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  STATE.goal = goal;
  document.getElementById('sidebar-goal').textContent = goalLabel(goal);
  saveUserData();
  showToast('🎯','Goal updated: ' + goalLabel(goal));
}

function saveGoalTargets() {
  const tw = document.getElementById('goal-target-weight').value;
  const twkt = document.getElementById('goal-workouts-week').value;
  const tcal = document.getElementById('goal-calories-day').value;
  if (tw) {
    const current = STATE.weights.length ? STATE.weights[STATE.weights.length-1].value : 75;
    const target = parseFloat(tw);
    document.getElementById('goal-current-w').textContent = current;
    document.getElementById('goal-target-w').textContent = target;
    const diff = Math.abs(current - target);
    document.getElementById('weight-goal-text').textContent = diff.toFixed(1) + ' kg to go';
    const prog = Math.max(0, Math.min(100, (1 - diff/15)*100));
    document.getElementById('weight-goal-bar').style.width = prog + '%';
  }
  if (twkt) document.getElementById('goal-target-wkt').textContent = twkt;
  if (tcal) { STATE.calorieGoal = parseInt(tcal); document.getElementById('goal-target-cal').textContent = tcal; }
  showToast('✅','Goals saved!');
}

/* ============================================================
   WEIGHT LOG
============================================================ */
function logWeight() {
  const val = parseFloat(document.getElementById('new-weight-input').value);
  if (!val) { showToast('❌','Enter a weight value'); return; }
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const day = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  STATE.weights.push({ day, value: val });
  if (STATE.weights.length > 30) STATE.weights.shift();
  saveUserData();
  document.getElementById('new-weight-input').value = '';
  // Update chart
  if (charts.weight) {
    charts.weight.data.labels = STATE.weights.map(w => w.day);
    charts.weight.data.datasets[0].data = STATE.weights.map(w => w.value);
    charts.weight.update();
  }
  showToast('⚖️','Weight logged: ' + val + ' kg');
}

/* ============================================================
   PROGRESS PHOTOS
============================================================ */
function uploadPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    STATE.photos.unshift({ id: Date.now(), data: e.target.result, date: todayStr() });
    saveUserData();
    renderPhotos();
    showToast('📸','Photo uploaded!');
  };
  reader.readAsDataURL(file);
}

function renderPhotos() {
  const grid = document.getElementById('photos-grid');
  if (!STATE.photos.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📷</div><div class="empty-state-text">No photos yet. Upload your first progress photo!</div></div>';
    return;
  }
  grid.innerHTML = STATE.photos.map(p => `
    <div class="photo-card">
      <img src="${p.data}" alt="Progress photo" />
      <div class="photo-card-overlay">${formatDate(p.date)}</div>
    </div>`).join('');
}

/* ============================================================
   PROFILE
============================================================ */
function renderProfile() {
  const u = STATE.user;
  document.getElementById('profile-avatar').textContent = u.name[0];
  document.getElementById('profile-name').textContent = u.name.toUpperCase();
  document.getElementById('profile-email').textContent = u.email;
  document.getElementById('profile-height').textContent = (u.height || '--') + ' cm';
  document.getElementById('profile-weight').textContent = (u.weight || '--') + ' kg';
  document.getElementById('profile-joined').textContent = u.joined || 'Unknown';
  document.getElementById('profile-goal-badge').textContent = goalLabel(STATE.goal);
  document.getElementById('edit-name').value = u.name;
  document.getElementById('edit-height').value = u.height || '';
  document.getElementById('edit-weight').value = u.weight || '';
  document.getElementById('edit-cal-goal').value = STATE.calorieGoal;
}

function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const height = document.getElementById('edit-height').value;
  const weight = document.getElementById('edit-weight').value;
  const calGoal = document.getElementById('edit-cal-goal').value;
  if (name) STATE.user.name = name;
  if (height) STATE.user.height = parseFloat(height);
  if (weight) STATE.user.weight = parseFloat(weight);
  if (calGoal) { STATE.calorieGoal = parseInt(calGoal); STATE.user.calGoal = STATE.calorieGoal; }
  // Update saved users
  const users = LS.load('users', []);
  const idx = users.findIndex(u => u.email === STATE.user.email);
  if (idx >= 0) users[idx] = {...users[idx], ...STATE.user};
  LS.save('users', users);
  LS.save('currentUser', STATE.user);
  renderUI();
  renderProfile();
  showToast('✅','Profile updated!');
}

/* ============================================================
   GYM MODE (STOPWATCH)
============================================================ */
let timerInterval = null, timerRunning = false, timerSec = 0;

function openGymMode() {
  document.getElementById('gym-mode-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeGymMode() {
  if (timerRunning) toggleTimer();
  document.getElementById('gym-mode-overlay').classList.remove('active');
  document.body.style.overflow = '';
}
function toggleTimer() {
  timerRunning = !timerRunning;
  const btn = document.getElementById('gym-start-btn');
  btn.textContent = timerRunning ? '⏸' : '▶';
  if (timerRunning) {
    timerInterval = setInterval(() => {
      timerSec++;
      updateTimerDisplay();
    }, 1000);
  } else {
    clearInterval(timerInterval);
  }
}
function resetTimer() {
  if (timerRunning) toggleTimer();
  timerSec = 0;
  updateTimerDisplay();
}
function updateTimerDisplay() {
  const h = Math.floor(timerSec / 3600);
  const m = Math.floor((timerSec % 3600) / 60);
  const s = timerSec % 60;
  document.getElementById('gym-timer').textContent =
    pad(h) + ':' + pad(m) + ':' + pad(s);
}
function pad(n) { return n.toString().padStart(2,'0'); }

/* ============================================================
   MOTIVATIONAL QUOTES
============================================================ */
const QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "— Unknown" },
  { text: "Push harder than yesterday if you want a different tomorrow.", author: "— Unknown" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "— Unknown" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "— Arnold Schwarzenegger" },
  { text: "Success is usually the culmination of controlling failure.", author: "— Sylvester Stallone" },
  { text: "Take care of your body. It's the only place you have to live.", author: "— Jim Rohn" },
  { text: "What seems impossible today will one day become your warm-up.", author: "— Unknown" },
  { text: "A one-hour workout is 4% of your day. No excuses.", author: "— Unknown" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "— Jim Ryun" },
  { text: "Sweat is just fat crying. Keep going.", author: "— Unknown" }
];
function refreshQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('quote-text').textContent = '"' + q.text + '"';
  document.getElementById('quote-author').textContent = q.author;
}

/* ============================================================
   APP INSTALL / DOWNLOAD
============================================================ */
let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButton() {
  const button = document.getElementById('install-app-btn');
  if (!button) return;

  if (isAppInstalled()) {
    button.textContent = '✓ Installed';
    button.disabled = true;
    button.title = 'FitForge is installed';
  } else {
    button.textContent = '⬇ App';
    button.disabled = false;
    button.title = 'Download FitForge';
  }
}

async function installApp() {
  if (isAppInstalled()) {
    showToast('OK', 'FitForge is already installed.');
    return;
  }

  if (!deferredInstallPrompt) {
    showToast('⬇', 'Use your browser menu and choose Install app or Add to Home Screen.');
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  if (choice.outcome === 'accepted') {
    showToast('OK', 'FitForge is downloading to your device.');
  } else {
    showToast('!', 'App download cancelled.');
  }

  updateInstallButton();
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallButton();
  showToast('OK', 'FitForge installed successfully.');
});

/* ============================================================
   NOTIFICATIONS
============================================================ */
const DEVICE_NOTIFICATION_OPTIONS = {
  icon: 'fitforge-icon.svg',
  badge: 'fitforge-icon.svg',
  vibrate: [160, 80, 160],
  requireInteraction: false
};

async function registerNotificationWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;

  try {
    const registration = await navigator.serviceWorker.register('sw.js');
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

async function ensureNotificationPermission(promptUser = false) {
  if (!('Notification' in window)) {
    showToast('!', 'This browser does not support phone notifications.');
    return false;
  }

  if (Notification.permission === 'granted') return true;

  if (Notification.permission === 'denied') {
    showToast('!', 'Notifications are blocked. Enable them in your browser settings.');
    return false;
  }

  if (!promptUser) return false;

  const permission = await Notification.requestPermission();
  if (permission === 'granted') return true;

  showToast('!', 'Allow notifications to receive reminders on your phone.');
  return false;
}

async function sendDeviceNotification({ title, body, tag }, promptUser = false) {
  const canNotify = await ensureNotificationPermission(promptUser);
  if (!canNotify) return false;

  const options = {
    ...DEVICE_NOTIFICATION_OPTIONS,
    body,
    tag,
    data: { url: location.href }
  };

  const registration = await registerNotificationWorker();
  if (registration && 'showNotification' in registration) {
    await registration.showNotification(title, options);
  } else {
    new Notification(title, options);
  }

  return true;
}

async function sendNotification() {
  const msgs = [
    { icon:'💪', text:"Time to hit the gym! Don't skip leg day." },
    { icon:'🏃', text:"Your streak is at 7 days — keep it alive!" },
    { icon:'💧', text:"You haven't logged water today. Stay hydrated!" },
    { icon:'🍽️', text:"Don't forget to log your meals for today." },
    { icon:'⚡', text:"Ready for today's session? You've got this!" }
  ];
  const m = msgs[Math.floor(Math.random()*msgs.length)];
  await sendDeviceNotification({
    title: 'FitForge Reminder',
    body: m.text,
    tag: 'fitforge-manual-reminder'
  }, true);
}

/* ============================================================
   SOCIAL SHARING
============================================================ */
function shareProgress() {
  const w = STATE.workouts.length;
  const text = `💪 Crushed ${w} workouts with FitForge! 🔥 7 day streak and counting. #FitForge #Fitness #GymLife`;
  if (navigator.share) {
    navigator.share({ title: 'My FitForge Progress', text });
  } else {
    navigator.clipboard.writeText(text).then(() => showToast('🔗','Progress copied to clipboard!'));
  }
}

/* ============================================================
   TOAST SYSTEM
============================================================ */
function showToast(icon, text, duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-accent';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${text}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================================
   UTILITIES
============================================================ */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// Add first exercise row on workout page load
document.addEventListener('DOMContentLoaded', () => {
  addExerciseRow();
  // Pre-fill BMI from profile
  setTimeout(() => {
    if (STATE.user) {
      if (STATE.user.height) document.getElementById('bmi-height').value = STATE.user.height;
      if (STATE.user.weight) document.getElementById('bmi-weight').value = STATE.user.weight;
    }
  }, 500);
});

// Keyboard shortcut: Escape closes gym mode
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeGymMode();
});
