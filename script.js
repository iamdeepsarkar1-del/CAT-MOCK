// Minimal mock test engine with in-site curation
let DATA_URL = 'questions.json';
let state = {tests: [], currentTest: null, currentIndex: 0, answers: {}, timer: null, timeLeft: 0};

async function loadData(){
  // prefer localStorage curated data
  const local = localStorage.getItem('mts_data_v1');
  if(local){
    try{ state.tests = JSON.parse(local).tests; renderTests(); return; }catch(e){console.warn('local parse error', e); }
  }
  // fallback to fetch
  try{
    const res = await fetch(DATA_URL);
    if(!res.ok) throw new Error('no data');
    const json = await res.json(); state.tests = json.tests || []; renderTests();
  }catch(e){ console.warn('Could not fetch questions.json, using empty'); state.tests = []; renderTests(); }
}

// DOM refs
const testsList = document.getElementById('tests-list');
const testScreen = document.getElementById('test-screen');
const lobby = document.getElementById('lobby');
const testTitle = document.getElementById('test-title');
const timerEl = document.getElementById('timer');
const questionArea = document.getElementById('question-area');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitBtn = document.getElementById('submit-btn');
const quitBtn = document.getElementById('quit-btn');
const resultScreen = document.getElementById('result-screen');
const resultSummary = document.getElementById('result-summary');
const backHome = document.getElementById('back-home');
const adminOpen = document.getElementById('admin-open');
const adminModal = document.getElementById('admin-modal');
const adminList = document.getElementById('admin-list');
const addTestBtn = document.getElementById('add-test');
const exportBtn = document.getElementById('export-json');
const resetBtn = document.getElementById('reset-json');
const closeAdmin = document.getElementById('close-admin');

// render list
function renderTests(){
  testsList.innerHTML = '';
  if(state.tests.length===0) testsList.innerHTML = '<p class="muted">No tests available. Use curate mode to add tests.</p>';
  state.tests.forEach(t=>{
    const el = document.createElement('div'); el.className='test';
    el.innerHTML = `<div><strong>${escapeHtml(t.title)}</strong><div class="muted">${t.questions.length} questions · ${t.duration_minutes} min</div></div>`;
    const bwrap = document.createElement('div');
    const start = document.createElement('button'); start.className='primary'; start.textContent='Start'; start.onclick = ()=>startTest(t.id);
    bwrap.appendChild(start);
    el.appendChild(bwrap);
    testsList.appendChild(el);
  });
}

function startTest(id){
  const t = state.tests.find(x=>x.id===id); if(!t) return alert('Test not found');
  state.currentTest = JSON.parse(JSON.stringify(t)); // copy
  state.currentIndex = 0; state.answers = {};
  state.timeLeft = state.currentTest.duration_minutes * 60;
  lobby.classList.add('hidden'); testScreen.classList.remove('hidden'); resultScreen.classList.add('hidden');
  testTitle.textContent = state.currentTest.title;
  renderQuestion(); startTimer();
}

function renderQuestion(){
  const q = state.currentTest.questions[state.currentIndex];
  questionArea.innerHTML = '';
  const qdiv = document.createElement('div'); qdiv.className='question';
  qdiv.innerHTML = `<div><strong>Q${state.currentIndex+1}.</strong> ${escapeHtml(q.text)}</div>`;
  const opts = document.createElement('div'); opts.className='options';
  q.options.forEach((opt, i)=>{
    const o = document.createElement('div'); o.className='option'; o.textContent = opt; o.onclick = ()=>selectOption(i);
    if(state.answers[q.id]===i) o.classList.add('selected');
    opts.appendChild(o);
  });
  questionArea.appendChild(qdiv); questionArea.appendChild(opts);
}

function selectOption(i){
  const q = state.currentTest.questions[state.currentIndex];
  state.answers[q.id] = i; renderQuestion();
}

prevBtn.onclick = ()=>{ if(state.currentIndex>0){ state.currentIndex--; renderQuestion(); }}
nextBtn.onclick = ()=>{ if(state.currentIndex<state.currentTest.questions.length-1){ state.currentIndex++; renderQuestion(); }}
quitBtn.onclick = ()=>{ if(confirm('Quit test? Your progress will be lost.')) backToLobby(); }
submitBtn.onclick = ()=>{ if(confirm('Submit test now?')) endTest(); }
backHome.onclick = backToLobby;

function backToLobby(){ state.currentTest=null; state.currentIndex=0; state.answers={}; stopTimer(); lobby.classList.remove('hidden'); testScreen.classList.add('hidden'); resultScreen.classList.add('hidden'); }

function endTest(){ stopTimer(); // compute
  const qlist = state.currentTest.questions; let correct=0, attempted=0;
  qlist.forEach(q=>{ const a = state.answers[q.id]; if(typeof a !== 'undefined'){ attempted++; if(a===q.answer) correct++; }});
  const total = qlist.length; const percentage = Math.round((correct/total)*100);
  resultSummary.innerHTML = `<p><strong>Score:</strong> ${correct} / ${total}</p><p><strong>Attempted:</strong> ${attempted}</p><p><strong>Accuracy:</strong> ${percentage}%</p>`;
  testScreen.classList.add('hidden'); resultScreen.classList.remove('hidden');
}

function startTimer(){ stopTimer(); updateTimerDisplay(); state.timer = setInterval(()=>{
  state.timeLeft--; if(state.timeLeft<=0){ clearInterval(state.timer); alert('Time is up!'); endTest(); return }
  updateTimerDisplay();
}, 1000);
}
function stopTimer(){ if(state.timer) clearInterval(state.timer); state.timer=null; }
function updateTimerDisplay(){ const m = Math.floor(state.timeLeft/60); const s = state.timeLeft%60; timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

// Utilities
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Admin / Curation
function isAdminMode(){ try{ return location.search.indexOf('admin=1')!==-1 }catch(e){return false} }

function setupAdmin(){ if(!isAdminMode()) return; adminOpen.classList.remove('hidden'); adminOpen.onclick = ()=>{ adminModal.classList.remove('hidden'); renderAdminList(); };
  closeAdmin.onclick = ()=>{ adminModal.classList.add('hidden'); };
  addTestBtn.onclick = ()=>{ const id = 't'+Date.now(); const newTest = {id, title:'New Test', duration_minutes:10, questions:[]}; state.tests.push(newTest); saveLocal(); renderAdminList(); };
  exportBtn.onclick = ()=>{ const data = JSON.stringify({tests: state.tests}, null, 2); downloadFile('mocktests-export.json', data); };
  resetBtn.onclick = async ()=>{ if(!confirm('Replace with sample questions.json content?')) return; try{ const res = await fetch(DATA_URL); const json = await res.json(); state.tests = json.tests || []; saveLocal(); renderAdminList(); }catch(e){ alert('Failed to load sample file'); }};
}

function renderAdminList(){ adminList.innerHTML=''; state.tests.forEach((t, idx)=>{
  const row = document.createElement('div'); row.className='admin-row';
  const left = document.createElement('div'); left.innerHTML = `<strong>${escapeHtml(t.title)}</strong><div class="muted">${t.questions.length} questions · ${t.duration_minutes} min</div>`;
  const right = document.createElement('div'); right.className='actions';
  const edit = document.createElement('button'); edit.className='small'; edit.textContent='Edit'; edit.onclick = ()=>openTestEditor(idx);
  const del = document.createElement('button'); del.className='small'; del.textContent='Delete'; del.onclick = ()=>{ if(confirm('Delete this test?')){ state.tests.splice(idx,1); saveLocal(); renderAdminList(); }};
  right.appendChild(edit); right.appendChild(del);
  row.appendChild(left); row.appendChild(right); adminList.appendChild(row);
});
}

function openTestEditor(index){ const t = state.tests[index]; // build editor
  const editor = document.createElement('div'); editor.innerHTML = `
    <div style="margin-top:12px">
      <label>Title: <input id="edt-title" value="${escapeHtml(t.title)}" style="width:60%" /></label>
      <label style="margin-left:8px">Duration (min): <input id="edt-duration" value="${t.duration_minutes}" style="width:80px"/></label>
      <div style="margin-top:8px"><button id="add-q" class="small">Add Question</button> <button id="save-test" class="primary">Save</button> <button id="cancel-test" class="small">Cancel</button></div>
      <div id="q-list" style="margin-top:8px"></div>
    </div>
  `;
  adminList.innerHTML=''; adminList.appendChild(editor);
  const qlist = editor.querySelector('#q-list');
  function renderQList(){ qlist.innerHTML=''; t.questions.forEach((q, qi)=>{
    const qr = document.createElement('div'); qr.style.border='1px solid #f0f0f0'; qr.style.padding='8px'; qr.style.margin='6px 0';
    qr.innerHTML = `<div><strong>Q${qi+1}</strong> <button class="small" data-action="edit">Edit</button> <button class="small" data-action="del">Delete</button></div><div class="muted">${escapeHtml(q.text)}</div>`;
    qr.querySelector('[data-action="edit"]').onclick = ()=>{ openQEditor(q, renderQList); };
    qr.querySelector('[data-action="del"]').onclick = ()=>{ if(confirm('Delete question?')){ t.questions.splice(qi,1); renderQList(); }};
    qlist.appendChild(qr);
  }); }
  editor.querySelector('#add-q').onclick = ()=>{ const qid='q'+Date.now(); t.questions.push({id:qid,text:'New Question',options:['Option 1','Option 2','Option 3','Option 4'],answer:0}); renderQList(); };
  editor.querySelector('#save-test').onclick = ()=>{ t.title = document.getElementById('edt-title').value; t.duration_minutes = Number(document.getElementById('edt-duration').value)||10; saveLocal(); renderAdminList(); };
  editor.querySelector('#cancel-test').onclick = ()=>{ renderAdminList(); };
  renderQList();
}

function openQEditor(q, done){
  const modal = document.createElement('div'); modal.style.padding='12px'; modal.style.borderTop='1px solid #eee';
  modal.innerHTML = `
    <div><label>Question text:<br/><textarea id="q-text" style="width:100%;height:80px">${escapeHtml(q.text)}</textarea></label></div>
    <div style="margin-top:8px">Options:<br/>
      <input id="opt0" style="width:100%" value="${escapeHtml(q.options[0]||'')}"><br/>
      <input id="opt1" style="width:100%" value="${escapeHtml(q.options[1]||'')}"><br/>
      <input id="opt2" style="width:100%" value="${escapeHtml(q.options[2]||'')}"><br/>
      <input id="opt3" style="width:100%" value="${escapeHtml(q.options[3]||'')}">
    </div>
    <div style="margin-top:8px">Correct option index (0-3): <input id="correct" value="${q.answer}" style="width:60px"></div>
    <div style="margin-top: