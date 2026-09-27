const login = document.querySelector('#login');
const dashboard = document.querySelector('#dashboard');
const status = document.querySelector('#status');
let token = ''; let before; let timer; let generation = 0;
function logout() { generation++; token = ''; before = undefined; clearTimeout(timer); dashboard.hidden = true; login.hidden = false; document.querySelector('#events').replaceChildren(); document.querySelector('#token').value = ''; status.textContent = 'Signed out.'; }
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) logout(); throw new Error(data.error || 'Unable to load records.'); }
  return data;
}
async function load(older = false) {
  const current = generation;
  status.textContent = 'Loading records…';
  try {
    const data = await request(`/api/admin/logs${older && before ? `?before=${before}` : ''}`);
    if (current !== generation || !token) return;
    login.hidden = true; dashboard.hidden = false;
    const body = document.querySelector('#events'); body.replaceChildren();
    for (const event of data.events) {
      const row = document.createElement('tr');
      for (const value of [new Date(event.created).toLocaleString(), event.intent, event.action, event.trigger]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      const cell = document.createElement('td');
      if (event.reviewed) cell.textContent = 'Reviewed';
      else if (event.reviewRequired) {
        const button = document.createElement('button'); button.textContent = 'Mark reviewed';
        button.addEventListener('click', async () => { button.disabled = true; try { await request(`/api/admin/logs/${event.id}/review`, { method: 'POST', body: '{}' }); if (current === generation) cell.textContent = 'Reviewed'; } catch (error) { status.textContent = error.message; button.disabled = false; } });
        cell.append(button);
      } else cell.textContent = 'No review needed';
      row.append(cell); body.append(row);
    }
    before = data.nextCursor;
    document.querySelector('#older').disabled = !before;
    document.querySelector('#summary').textContent = `${data.events.length} records · ${data.retentionDays}-day retention`;
    status.textContent = data.events.length ? '' : 'No records in this window.';
  } catch (error) { if (current === generation) status.textContent = error.message; }
}
login.addEventListener('submit', event => { event.preventDefault(); generation++; token = document.querySelector('#token').value.trim(); document.querySelector('#token').value = ''; clearTimeout(timer); timer = setTimeout(logout, 15 * 60000); load(); });
document.querySelector('#refresh').addEventListener('click', () => load());
document.querySelector('#older').addEventListener('click', () => load(true));
document.querySelector('#logout').addEventListener('click', logout);
window.addEventListener('pagehide', logout);
