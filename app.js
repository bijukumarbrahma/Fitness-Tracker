const API_BASE = `${location.origin}/api`;
const storage = {
  get token() { return localStorage.getItem('fit_token'); },
  set token(value) { localStorage.setItem('fit_token', value); },
  get user() {
    try { return JSON.parse(localStorage.getItem('fit_user') || 'null'); } catch { return null; }
  },
  set user(value) { localStorage.setItem('fit_user', JSON.stringify(value)); },
  get theme() { return localStorage.getItem('fit_theme') || 'light'; },
  set theme(value) { localStorage.setItem('fit_theme', value); }
};

let dashboardState = null;
const chartInstances = {};
const stepCounterState = {
  running: false,
  sessionSteps: 0,
  lastPeakAt: 0,
  lastMagnitude: 0,
  handler: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const page = () => document.body.querySelector('[data-page]')?.dataset.page;
const clamp = (value, max = 100) => Math.max(0, Math.min(max, Number(value) || 0));
const today = () => new Date().toISOString().slice(0, 10);

function initTheme() {
  document.documentElement.dataset.theme = storage.theme;
}

function toggleTheme() {
  storage.theme = storage.theme === 'dark' ? 'light' : 'dark';
  initTheme();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (storage.token) headers.Authorization = `Bearer ${storage.token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  let data = {};

  if (contentType.includes('application/json') && raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const preview = raw ? raw.replace(/\s+/g, ' ').slice(0, 90) : '';
    throw new Error(data.message || `Request failed (${response.status}) ${preview}`);
  }

  return data;
}

function toast(message) {
  const stack = $('#toastStack') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast-stack', id: 'toastStack' }));
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setProgress(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('--value', `${clamp(value)}%`);
}

function requireAuth() {
  if (!storage.token) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function redirectIfAuthed() {
  if (storage.token && page() === 'home') {
    location.href = 'dashboard.html';
  }
}

function decorate() {
  initTheme();
  window.lucide?.createIcons();

  $('#themeToggle')?.addEventListener('click', toggleTheme);
  $('#logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('fit_token');
    localStorage.removeItem('fit_user');
    toast('Logged out');
    setTimeout(() => { location.href = 'login.html'; }, 250);
  });

  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function initAuthForms() {
  $('#loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(formObject(event.currentTarget))
      });
      storage.token = data.token;
      storage.user = data.user;
      toast('Session restored');
      location.href = 'dashboard.html';
    } catch (error) {
      toast(error.message);
    }
  });

  $('#registerForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(formObject(event.currentTarget))
      });
      storage.token = data.token;
      storage.user = data.user;
      toast('Account created');
      location.href = 'dashboard.html';
    } catch (error) {
      toast(error.message);
    }
  });

  $('#forgotBtn')?.addEventListener('click', async () => {
    try {
      const email = $('#email')?.value || '';
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      toast(data.message);
    } catch (error) {
      toast(error.message);
    }
  });
}

function initNavigation() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-section-target]');
    if (!button) return;
    const target = button.dataset.sectionTarget;
    const section = document.getElementById(target);
    if (!section) return;

    $$('.section').forEach((el) => el.classList.toggle('active', el.id === target));
    $$('[data-section-target]').forEach((el) => el.classList.toggle('active', el.dataset.sectionTarget === target));
    const title = button.textContent.trim() || target;
    setText('pageTitle', title);
  });
}

function initModals() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-modal]');
    const closer = event.target.closest('[data-close-modal]');
    if (opener) document.getElementById(opener.dataset.openModal)?.classList.add('open');
    if (closer) closer.closest('.modal')?.classList.remove('open');
    if (event.target.classList.contains('modal')) event.target.classList.remove('open');
  });
}

function renderHeatmap(workouts = []) {
  const heatmap = $('#heatmap');
  if (!heatmap) return;
  heatmap.innerHTML = '';
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));
    return date.toISOString().slice(0, 10);
  });

  days.forEach((day) => {
    const count = workouts.filter((workout) => {
      const value = workout.completedAt || workout.updatedAt || workout.createdAt;
      return value && new Date(value).toISOString().slice(0, 10) === day;
    }).length;
    const cell = document.createElement('div');
    cell.className = 'heat-cell';
    cell.dataset.level = count > 2 ? '3' : String(count);
    cell.title = `${day}: ${count} workout${count === 1 ? '' : 's'}`;
    heatmap.appendChild(cell);
  });
}

function renderWorkoutList(workouts = []) {
  const list = $('#workoutList');
  const history = $('#exerciseHistory');
  if (!list) return;

  if (!workouts.length) {
    list.innerHTML = '<div class="empty-state">No workouts yet. Start with one focused session.</div>';
    if (history) history.innerHTML = '<div class="empty-state">Exercise history appears after your first workout.</div>';
    return;
  }

  list.innerHTML = workouts.slice(0, 12).map((workout) => {
    const sets = workout.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) || 0;
    const volume = workout.exercises?.reduce((sum, ex) => sum + ex.sets.reduce((a, set) => a + (set.weightKg || 0) * (set.reps || 0), 0), 0) || 0;
    return `
      <div class="list-row">
        <div>
          <p class="list-title">${workout.title}</p>
          <p class="list-meta">${sets} sets · ${Math.round(volume)} kg volume · ${workout.status}</p>
        </div>
        <span class="pill ${workout.status === 'completed' ? 'good' : ''}">${workout.caloriesBurned || 0} kcal</span>
      </div>
    `;
  }).join('');

  if (history) {
    const exercises = workouts.flatMap((workout) => workout.exercises || []).slice(0, 8);
    history.innerHTML = exercises.length ? exercises.map((exercise) => {
      const pr = Math.max(0, ...exercise.sets.map((set) => set.weightKg || 0));
      return `
        <div class="list-row">
          <div>
            <p class="list-title">${exercise.name}</p>
            <p class="list-meta">${exercise.category} · ${exercise.sets.length} sets</p>
          </div>
          <span class="pill good">PR ${pr}kg</span>
        </div>
      `;
    }).join('') : '<div class="empty-state">Exercise history appears after your first workout.</div>';
  }
}

function renderNutrition(state) {
  const nutrition = state.nutrition || { meals: [], waterMl: 0 };
  const stats = state.stats || {};
  const user = state.user || {};
  const meals = nutrition.meals || [];

  setText('mealCount', `${meals.length} meal${meals.length === 1 ? '' : 's'}`);
  setText('proteinText', `${stats.protein || 0}g / ${user.proteinTarget || 160}g`);
  setText('carbsText', `${stats.carbs || 0}g / ${user.carbTarget || 260}g`);
  setText('fatsText', `${stats.fats || 0}g / ${user.fatTarget || 70}g`);
  setProgress('proteinBar', ((stats.protein || 0) / (user.proteinTarget || 160)) * 100);
  setProgress('carbsBar', ((stats.carbs || 0) / (user.carbTarget || 260)) * 100);
  setProgress('fatsBar', ((stats.fats || 0) / (user.fatTarget || 70)) * 100);

  const mealList = $('#mealList');
  if (!mealList) return;
  mealList.innerHTML = meals.length ? meals.map((meal) => `
    <div class="list-row">
      <div>
        <p class="list-title">${meal.name}</p>
        <p class="list-meta">${meal.protein}g protein · ${meal.carbs}g carbs · ${meal.fats}g fats</p>
      </div>
      <span class="pill">${meal.calories} kcal</span>
    </div>
  `).join('') : '<div class="empty-state">Meals logged today will stack here.</div>';
}

function renderBody(state) {
  const bodyList = $('#bodyList');
  const photoGrid = $('#photoGrid');
  const stats = state.bodyStats || [];
  const photos = state.photos || [];

  if (bodyList) {
    bodyList.innerHTML = stats.length ? stats.slice(-8).reverse().map((stat) => {
      const bmi = stat.heightCm ? (stat.weightKg / ((stat.heightCm / 100) ** 2)).toFixed(1) : '0';
      return `
        <div class="list-row">
          <div>
            <p class="list-title">${stat.date}</p>
            <p class="list-meta">${stat.bodyFatPercent || 0}% body fat · BMI ${bmi}</p>
          </div>
          <span class="pill">${stat.weightKg} kg</span>
        </div>
      `;
    }).join('') : '<div class="empty-state">Log weight and measurements to build your trendline.</div>';
  }

  if (photoGrid) {
    photoGrid.innerHTML = photos.length ? photos.map((photo) => `
      <article class="photo-card">
        <img src="${photo.imageUrl}" alt="${photo.caption || 'Progress photo'}" loading="lazy">
        <div>${photo.date} · ${photo.weightKg || ''}kg</div>
      </article>
    `).join('') : '<div class="empty-state" style="grid-column: 1 / -1;">Transformation photos stay private by default.</div>';
  }
}

function renderGoals(goals = []) {
  const list = $('#goalList');
  if (!list) return;
  list.innerHTML = goals.length ? goals.map((goal) => {
    const percent = clamp((goal.current / goal.target) * 100);
    return `
      <div class="list-row">
        <div style="width: 100%;">
          <p class="list-title">${goal.title}</p>
          <p class="list-meta">${goal.category} · ${goal.current}/${goal.target}${goal.unit}</p>
          <div class="progress" style="margin-top: 10px;"><span style="--value:${percent}%;"></span></div>
        </div>
        <span class="pill ${percent >= 100 ? 'good' : ''}">${Math.round(percent)}%</span>
      </div>
    `;
  }).join('') : '<div class="empty-state">Set a target for strength, weight, nutrition, consistency, or recovery.</div>';
}

function renderSteps(state) {
  const stats = state.stats || {};
  const logs = state.stepLogs || [];
  const steps = Number(stats.steps) || 0;
  const goal = Number(stats.stepGoal) || 10000;
  const completion = Math.min(100, Math.round((steps / goal) * 100));

  setText('stepsValue', steps.toLocaleString());
  setText('stepsSub', `of ${goal.toLocaleString()} goal`);
  setText('stepsLargeValue', steps.toLocaleString());
  setText('stepsGoalText', `${steps.toLocaleString()} / ${goal.toLocaleString()}`);
  setText('stepCaloriesText', `${stats.stepCalories || 0} kcal`);
  setText('stepDistanceText', `${stats.stepDistanceKm || 0} km`);
  setText('stepMinutesText', `${stats.stepActiveMinutes || 0} min`);
  setProgress('stepsBar', completion);

  const ring = $('#stepsRing');
  if (ring) {
    ring.dataset.label = `${completion}%`;
    ring.style.setProperty('--p', completion);
  }

  const history = $('#stepHistory');
  if (history) {
    history.innerHTML = logs.length ? logs.slice(-7).reverse().map((log) => `
      <div class="list-row">
        <div>
          <p class="list-title">${Number(log.steps || 0).toLocaleString()} steps</p>
          <p class="list-meta">${log.date} · ${log.distanceKm || 0} km · ${log.source || 'manual'}</p>
        </div>
        <span class="pill ${log.steps >= log.goal ? 'good' : ''}">${Math.min(100, Math.round((log.steps / log.goal) * 100))}%</span>
      </div>
    `).join('') : '<div class="empty-state">Step history appears after you log your first walk.</div>';
  }
}

function lineChart(id, labels, data, label, color) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  chartInstances[id]?.destroy();
  chartInstances[id] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: `${color}24`,
        fill: true,
        tension: 0.42,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(125, 158, 184, .16)' }, beginAtZero: true }
      },
      animation: { duration: 850, easing: 'easeOutQuart' }
    }
  });
}

function barChart(id, labels, data, label, color) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  chartInstances[id]?.destroy();
  chartInstances[id] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color, borderRadius: 12 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(125, 158, 184, .16)' }, beginAtZero: true }
      },
      animation: { duration: 850, easing: 'easeOutQuart' }
    }
  });
}

function renderCharts(state) {
  const chart = state.chart || {};
  const weightPoints = chart.weight?.length ? chart.weight : [{ date: today().slice(5), value: state.stats?.weight || 75 }];
  const strengthPoints = chart.strength?.length ? chart.strength : [{ label: 'Start', value: 0 }];

  lineChart('weightChart', weightPoints.map((p) => p.date), weightPoints.map((p) => p.value), 'Weight', '#38bdf8');
  barChart('caloriesChart', chart.labels || [], chart.calories || [], 'Calories', '#5eead4');
  barChart('consistencyChart', chart.labels || [], chart.workouts || [], 'Workouts', '#fbbf24');
  lineChart('strengthChart', strengthPoints.map((p) => p.label), strengthPoints.map((p) => p.value), 'Strength', '#a78bfa');
  barChart('stepsChart', chart.labels || [], chart.steps || [], 'Steps', '#38bdf8');
}

function renderDashboard(state) {
  dashboardState = state;
  localStorage.setItem('fit_dashboard_cache', JSON.stringify(state));
  storage.user = state.user;

  const stats = state.stats || {};
  const user = state.user || {};
  const smart = state.smart || {};

  $('#adminLink')?.toggleAttribute('hidden', user.role !== 'admin');
  setText('todayLabel', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }));
  setText('smartGreeting', smart.greeting || `Ready, ${user.name || 'athlete'}?`);
  setText('smartRecommendation', smart.recommendation || 'Log one session to tune recommendations.');
  setText('heroGreeting', smart.greeting || 'Own today\'s session.');
  setText('quoteText', smart.quote || 'Discipline compounds.');
  setText('rewardText', smart.reward || 'Daily challenge active');
  setText('caloriesValue', stats.calories || 0);
  setText('caloriesSub', `of ${user.calorieTarget || 2400} kcal target`);
  setText('streakValue', stats.streak || 0);
  setText('bmiValue', stats.bmi || 0);
  setText('weightSub', `${stats.weight || user.currentWeightKg || 0} kg · ${stats.weightDelta || 0} kg`);
  setText('burnedValue', stats.caloriesBurned || 0);
  setText('weeklyWorkouts', `${stats.weeklyWorkouts || 0} sessions`);
  setText('goalPercent', `${stats.goalCompletion || 0}%`);
  setText('waterText', `${stats.waterMl || 0} ml`);
  setProgress('goalBar', stats.goalCompletion || 0);
  setProgress('waterBar', ((stats.waterMl || 0) / (user.waterTargetMl || 3000)) * 100);

  const ring = $('#scoreRing');
  if (ring) {
    ring.dataset.label = stats.performanceScore || 0;
    ring.style.setProperty('--p', stats.performanceScore || 0);
  }

  renderHeatmap((state.workouts || []).filter((workout) => workout.status === 'completed'));
  renderWorkoutList(state.workouts || []);
  renderNutrition(state);
  renderSteps(state);
  renderBody(state);
  renderGoals(state.goals || []);
  renderCharts(state);
  window.lucide?.createIcons();
}

async function loadDashboard() {
  if (!requireAuth()) return;
  try {
    const cache = localStorage.getItem('fit_dashboard_cache');
    if (cache) renderDashboard(JSON.parse(cache));
  } catch {}

  try {
    const state = await api('/users/dashboard');
    renderDashboard(state);
  } catch (error) {
    if (/invalid|expired|authentication/i.test(error.message)) {
      localStorage.removeItem('fit_token');
      localStorage.removeItem('fit_user');
      location.href = 'login.html';
      return;
    }
    toast(error.message);
  }
}

function closeModalFrom(form) {
  form.closest('.modal')?.classList.remove('open');
  form.reset();
}

function initDashboardForms() {
  $('#addWaterBtn')?.addEventListener('click', async () => {
    try {
      await api('/nutrition/water', {
        method: 'POST',
        body: JSON.stringify({ amountMl: 250, date: today() })
      });
      toast('Water logged');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#workoutForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = formObject(event.currentTarget);
    const sets = [1, 2, 3].map((number) => ({
      weightKg: Number(data[`w${number}`] || 0),
      reps: Number(data[`r${number}`] || 0)
    }));

    try {
      await api('/workouts', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          status: 'completed',
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMin: 52,
          caloriesBurned: Number(data.caloriesBurned || 0),
          exercises: [{ name: data.exercise, category: data.category, sets }]
        })
      });
      closeModalFrom(event.currentTarget);
      toast('Workout completed. PR scan updated.');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#mealForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/nutrition/meal', {
        method: 'POST',
        body: JSON.stringify({ ...formObject(event.currentTarget), date: today() })
      });
      closeModalFrom(event.currentTarget);
      toast('Meal logged');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#bodyForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/body', {
        method: 'PUT',
        body: JSON.stringify({ ...formObject(event.currentTarget), date: today() })
      });
      closeModalFrom(event.currentTarget);
      toast('Body log saved');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#goalForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/goals', {
        method: 'POST',
        body: JSON.stringify(formObject(event.currentTarget))
      });
      closeModalFrom(event.currentTarget);
      toast('Goal added');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#photoForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = new FormData(event.currentTarget);
      payload.set('date', today());
      await api('/photos', { method: 'POST', body: payload });
      closeModalFrom(event.currentTarget);
      toast('Progress photo saved');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });

  $('#stepsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/steps', {
        method: 'POST',
        body: JSON.stringify({ ...formObject(event.currentTarget), date: today(), source: 'manual' })
      });
      closeModalFrom(event.currentTarget);
      toast('Footsteps saved');
      await loadDashboard();
    } catch (error) {
      toast(error.message);
    }
  });
}

async function saveSensorSteps() {
  if (!stepCounterState.sessionSteps) {
    toast('No sensor steps to save yet');
    return;
  }

  try {
    await api('/steps', {
      method: 'POST',
      body: JSON.stringify({
        increment: stepCounterState.sessionSteps,
        date: today(),
        goal: dashboardState?.stats?.stepGoal || 10000,
        source: 'sensor'
      })
    });
    stepCounterState.sessionSteps = 0;
    setText('sensorSessionSteps', '0');
    toast('Sensor steps saved');
    await loadDashboard();
  } catch (error) {
    toast(error.message);
  }
}

async function initStepCounter() {
  const startButton = $('#startStepCounterBtn');
  const saveButton = $('#saveSensorStepsBtn');
  if (!startButton) return;

  saveButton?.addEventListener('click', saveSensorSteps);

  const updateStatus = (message) => setText('sensorStepStatus', message);
  const stop = () => {
    if (stepCounterState.handler) {
      window.removeEventListener('devicemotion', stepCounterState.handler);
    }
    stepCounterState.running = false;
    stepCounterState.handler = null;
    startButton.querySelector('span').textContent = 'Start Sensor';
    updateStatus('Sensor paused. Save the session or continue counting.');
  };

  const start = async () => {
    if (!window.DeviceMotionEvent) {
      updateStatus('Motion sensor is not available in this browser. Use manual steps.');
      return;
    }

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        updateStatus('Motion permission was not granted. Use manual steps.');
        return;
      }
    }

    stepCounterState.running = true;
    startButton.querySelector('span').textContent = 'Pause Sensor';
    updateStatus('Sensor running. Keep your phone with you while walking.');

    stepCounterState.handler = (event) => {
      const reading = event.accelerationIncludingGravity || event.acceleration;
      if (!reading) return;

      const x = reading.x || 0;
      const y = reading.y || 0;
      const z = reading.z || 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      const crossedPeak = magnitude > 13.2 && stepCounterState.lastMagnitude <= 12.4;

      if (crossedPeak && now - stepCounterState.lastPeakAt > 320) {
        stepCounterState.sessionSteps += 1;
        stepCounterState.lastPeakAt = now;
        setText('sensorSessionSteps', stepCounterState.sessionSteps.toLocaleString());
      }

      stepCounterState.lastMagnitude = magnitude;
    };

    window.addEventListener('devicemotion', stepCounterState.handler);
  };

  startButton.addEventListener('click', () => {
    if (stepCounterState.running) {
      stop();
    } else {
      start().catch((error) => updateStatus(error.message));
    }
  });
}

function initTimers() {
  const init = (buttonId, textId, startSeconds, countDown = false) => {
    const button = document.getElementById(buttonId);
    const text = document.getElementById(textId);
    if (!button || !text) return;
    let timer = null;
    let seconds = startSeconds;
    const paint = () => {
      const min = String(Math.floor(seconds / 60)).padStart(2, '0');
      const sec = String(seconds % 60).padStart(2, '0');
      text.textContent = `${min}:${sec}`;
    };
    paint();
    button.addEventListener('click', () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
        button.querySelector('span').textContent = 'Start';
        return;
      }
      button.querySelector('span').textContent = 'Pause';
      timer = setInterval(() => {
        seconds = countDown ? Math.max(0, seconds - 1) : seconds + 1;
        paint();
        if (countDown && seconds === 0) {
          clearInterval(timer);
          timer = null;
          seconds = startSeconds;
          button.querySelector('span').textContent = 'Start';
          toast('Rest finished');
          paint();
        }
      }, 1000);
    });
  };

  init('timerBtn', 'timerText', 0, false);
  init('restTimerBtn', 'restTimerText', 90, true);
}

async function loadAdmin() {
  if (!requireAuth()) return;
  try {
    const data = await api('/admin/overview');
    const stats = data.stats || {};
    setText('adminUsers', stats.users || 0);
    setText('adminWorkouts', stats.workouts || 0);
    setText('adminMeals', stats.meals || 0);
    setText('adminPhotos', stats.photos || 0);
    setText('userCountPill', `${stats.users || 0} users`);
    setText('flaggedCount', `${data.flaggedPhotos?.length || 0} flagged`);

    const rows = $('#adminUserRows');
    if (rows) {
      rows.innerHTML = (data.recentUsers || []).map((user) => `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td><span class="pill ${user.role === 'admin' ? 'good' : ''}">${user.role}</span></td>
          <td>${new Date(user.createdAt).toLocaleDateString()}</td>
          <td><button class="button" data-delete-user="${user._id}"><i data-lucide="trash-2"></i><span>Delete</span></button></td>
        </tr>
      `).join('');
    }

    const top = $('#topUsers');
    if (top) {
      top.innerHTML = (data.topUsers || []).length ? data.topUsers.map((item, index) => `
        <div class="list-row">
          <div>
            <p class="list-title">${index + 1}. ${item.user.name}</p>
            <p class="list-meta">${item.workouts} workouts · ${item.calories || 0} kcal</p>
          </div>
          <span class="pill good">Active</span>
        </div>
      `).join('') : '<div class="empty-state">Leaderboard fills as athletes log workouts.</div>';
    }

    const flagged = $('#flaggedPhotos');
    if (flagged) {
      flagged.innerHTML = (data.flaggedPhotos || []).length ? data.flaggedPhotos.map((photo) => `
        <div class="list-row">
          <div>
            <p class="list-title">${photo.caption || 'Flagged photo'}</p>
            <p class="list-meta">${photo.user?.email || 'Unknown user'} · ${photo.date}</p>
          </div>
          <button class="button" data-delete-photo="${photo._id}"><i data-lucide="trash-2"></i><span>Remove</span></button>
        </div>
      `).join('') : '<div class="empty-state">No flagged content.</div>';
    }

    barChart('adminGrowthChart', ['Users', 'Workouts', 'Nutrition', 'Photos'], [stats.users, stats.workouts, stats.meals, stats.photos], 'Growth', '#38bdf8');
    window.lucide?.createIcons();
  } catch (error) {
    toast(error.message);
    if (error.message.includes('Admin')) setTimeout(() => { location.href = 'dashboard.html'; }, 600);
  }
}

function initAdminActions() {
  document.addEventListener('click', async (event) => {
    const userButton = event.target.closest('[data-delete-user]');
    const photoButton = event.target.closest('[data-delete-photo]');
    try {
      if (userButton) {
        await api(`/admin/users/${userButton.dataset.deleteUser}`, { method: 'DELETE' });
        toast('User removed');
        await loadAdmin();
      }
      if (photoButton) {
        await api(`/admin/photos/${photoButton.dataset.deletePhoto}`, { method: 'DELETE' });
        toast('Photo removed');
        await loadAdmin();
      }
    } catch (error) {
      toast(error.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  decorate();
  redirectIfAuthed();
  initAuthForms();
  initNavigation();
  initModals();

  if (page() === 'dashboard') {
    loadDashboard();
    initDashboardForms();
    initTimers();
    initStepCounter();
  }

  if (page() === 'admin') {
    loadAdmin();
    initAdminActions();
  }
});