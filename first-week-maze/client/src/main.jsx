import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = '/api'
const emptyProfile = () => ({name:'',role:'',department:'',location:'',joiningDate:new Date().toISOString().slice(0,10),experience:'Early career'})

async function request(path, options) {
  const response = await fetch(`${API}${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

const Icon = ({children, className=''}) => <span className={`icon ${className}`}>{children}</span>

function App(){
  const [mode,setMode]=useState('employee')
  const [page,setPage]=useState('overview')
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [userId,setUserId]=useState(()=>window.localStorage.getItem('fw-user-id') || '')
  const [user,setUser]=useState(null)
  const [plan,setPlan]=useState([])
  const [loading,setLoading]=useState(()=>Boolean(window.localStorage.getItem('fw-user-id')))
  const [connectionError,setConnectionError]=useState('')
  const [filter,setFilter]=useState('All')
  const [search,setSearch]=useState('')
  const [assistantOpen,setAssistantOpen]=useState(true)
  const [messages,setMessages]=useState([{role:'assistant',text:'Hi! I can help you navigate your first week using verified onboarding information. Try “What should I do today?” or “Who is my HR contact?”'}])
  const [question,setQuestion]=useState('')
  const [typing,setTyping]=useState(false)
  const [showGenerator,setShowGenerator]=useState(false)
  const [profileForm,setProfileForm]=useState(emptyProfile)
  const [toast,setToast]=useState(null)
  const [admin,setAdmin]=useState(null)
  const [profileError,setProfileError]=useState('')
  const [generating,setGenerating]=useState(false)
  
  useEffect(()=>{ if(userId) loadUser(userId); else { setLoading(false); setUser(null); setPlan([]) } },[userId])
  useEffect(()=>{ if(mode==='admin') loadAdmin() },[mode])
  async function loadUser(id){ setLoading(true); setConnectionError(''); try { const d=await request(`/me/${id}`); setUser(d.user); setPlan(d.plan); setProfileForm({name:d.user.name,role:d.user.role,department:d.user.department,location:d.user.location,joiningDate:d.user.joiningDate,experience:d.user.experience}) } catch(error) { setConnectionError(error.message || 'The onboarding service could not be reached.') } finally { setLoading(false) } }
  async function loadAdmin(){ try { setAdmin(await request('/admin/analytics')) } catch(error) { notify(error.message || 'Could not load HR analytics') } }
  function notify(t){ setToast(t); setTimeout(()=>setToast(null),2600) }
  async function toggleTask(t){
    if(t.status==='blocked'){notify('Complete the prerequisite first.'); return}
    const status=t.status==='complete'?'pending':'complete'
    try { const d=await request(`/tasks/${userId}/${t.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}); setPlan(d.plan); notify(status==='complete'?'Task completed ✓':'Task reopened') } catch(error) { notify(error.message || 'Could not update task') }
  }
  async function scheduleReminder(t){
    try { const d=await request('/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,taskId:t.id})}); setPlan(d.plan); notify(`Reminder set for ${t.title}`) } catch(error) { notify(error.message || 'Could not schedule reminder') }
  }
  async function askAssistant(q=question){ if(!q.trim()) return; const text=q.trim(); setQuestion(''); setMessages(m=>[...m,{role:'user',text}]); setTyping(true); try { const d=await request('/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,question:text})}); setTimeout(()=>{setMessages(m=>[...m,{role:'assistant',text:d.answer,source:d.source,contact:d.contact,handoff:d.handoff,escalation:d.escalation,aiUsed:d.aiUsed}]);setTyping(false)},350) } catch(error) { setMessages(m=>[...m,{role:'assistant',text:'I can’t reach the onboarding guide right now. Please try again in a moment.'}]); setTyping(false); notify(error.message || 'Assistant unavailable') } }
  async function generate(){
    setProfileError('')
    setGenerating(true)
    const payload={...profileForm,id:userId || undefined,email:user?.email}
    try {
      const d=await request('/onboarding/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      window.localStorage.setItem('fw-user-id',d.user.id)
      setUserId(d.user.id); setUser(d.user); setPlan(d.plan); setShowGenerator(false); notify(userId?'Profile and tasks updated':'Your onboarding path is ready')
    } catch(error) { setProfileError(error.message || 'Could not save your profile') }
    finally { setGenerating(false) }
  }
  function changeProfile(){
    window.localStorage.removeItem('fw-user-id')
    setProfileForm(emptyProfile()); setProfileError(''); setUser(null); setPlan([]); setUserId('')
  }
  const stats=useMemo(()=>{ const total=plan.length, done=plan.filter(x=>x.status==='complete').length, blocked=plan.filter(x=>x.status==='blocked').length; const now=new Date(); const overdue=plan.filter(x=>x.status==='pending' && user && (x.day===1 ? now>=new Date(user.joiningDate) : now>new Date(new Date(user.joiningDate).getTime()+(x.day-1)*86400000))); return {total,done,blocked,overdue,pct:total?Math.round(done/total*100):0,left:total-done} },[plan,user])
  const days=[1,2,3,4,5]
  const filtered=plan.filter(t=> (filter==='All'||t.priority===filter) && `${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()))
  if(loading) return <div className="boot"><div className="brandMark">FW</div><div>Finding your way into week one…</div></div>
  if(!userId) return <ProfileSetup profileForm={profileForm} setProfileForm={setProfileForm} onSubmit={generate} error={profileError} loading={generating}/>
  if(connectionError || !user) return <ConnectionScreen error={connectionError} onRetry={()=>loadUser(userId)}/>
  return <div className="app">
    <aside className={`sidebar ${sidebarOpen?'sidebarOpen':''}`} id="mobile-navigation">
      <div className="brand"><div className="brandMark">FW</div><div><div className="brandName">First-Week Maze</div><div className="brandSub">Onboarding Command Center</div></div><button type="button" className="sidebarClose" onClick={()=>setSidebarOpen(false)} aria-label="Close navigation menu">×</button></div>
      <div className="switcher"><button className={mode==='employee'?'active':''} onClick={()=>{setMode('employee');setSidebarOpen(false)}}><Icon>◉</Icon> Employee</button><button className={mode==='admin'?'active':''} onClick={()=>{setMode('admin');setSidebarOpen(false)}}><Icon>▦</Icon> HR Admin</button></div>
      {mode==='employee' && <>
        <div className="profileMini"><div className="avatar">{user.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><b>{user.name}</b><span>{user.role} · {user.department}</span><span>{user.location}</span></div></div><button className="profileChange" onClick={changeProfile}>Change employee profile</button>
        <nav>
          <button type="button" className={`navItem ${page==='overview'?'active':''}`} onClick={()=>{setPage('overview');setSidebarOpen(false)}}><Icon>⌂</Icon> Overview</button>
          <button type="button" className={`navItem ${page==='checklist'?'active':''}`} onClick={()=>{setPage('checklist');setSidebarOpen(false)}} aria-current={page==='checklist'?'page':undefined}><Icon>✓</Icon> My checklist <span className="count">{stats.left}</span></button>
          <button type="button" className={`navItem ${page==='knowledge'?'active':''}`} onClick={()=>{setPage('knowledge');setSidebarOpen(false)}}><Icon>◌</Icon> Knowledge base</button>
          <button type="button" className={`navItem ${page==='help'?'active':''}`} onClick={()=>{setPage('help');setSidebarOpen(false)}}><Icon>?</Icon> Help & handoff</button>
        </nav>
        <div className="sidebarTip"><div className="tipDot">✦</div><div><b>Onboarding principle</b><p>What to do. How to do it. Who to contact.</p></div></div>
      </>}
      <div className="sidebarFooter"><span>Microsoft Innovate 2026</span><span>Demo environment</span></div>
    </aside>
      {sidebarOpen&&<button type="button" className="sidebarScrim" onClick={()=>setSidebarOpen(false)} aria-label="Close navigation menu"/>}

    <main className="main">

      <header className="topbar"><div><div className="eyebrow">{mode==='employee'?'EMPLOYEE WORKSPACE':'PEOPLE OPERATIONS'}</div><h1>{mode==='employee'?(page==='knowledge'?'Knowledge base, made searchable.':page==='help'?'Get help with a clear handoff.':page==='checklist'?'Your first-week checklist.':'Your first week, without the maze.'):'Onboarding health at a glance.'}</h1></div><div className="topActions"><button type="button" className="mobileMenuButton" onClick={()=>setSidebarOpen(true)} aria-label="Open navigation menu" aria-expanded={sidebarOpen} aria-controls="mobile-navigation"><span aria-hidden="true">☰</span></button>{mode==='employee'&&page==='overview'&&<button className="ghost" onClick={()=>setShowGenerator(true)}>✦ Personalize</button>}<button className="ghost mobileDemo" onClick={changeProfile}>Change profile</button><div className="notif">◔<span></span></div><div className="avatar small">{user.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div></div></header>
      {mode==='employee'?(page==='knowledge'?<KnowledgeBaseView onBack={()=>setPage('overview')}/>:page==='help'?<HelpHandoffView userId={userId} user={user}/>:page==='checklist'?<ChecklistView {...{user,plan,stats,days,filtered,filter,setFilter,search,setSearch,toggleTask,scheduleReminder}}/>:<EmployeeView {...{user,plan,stats,days,filtered,filter,setFilter,search,setSearch,toggleTask,scheduleReminder,assistantOpen,setAssistantOpen,messages,typing,question,setQuestion,askAssistant,showGenerator,setShowGenerator,profileForm,setProfileForm,generate}}/>):<AdminView admin={admin} onRefresh={loadAdmin}/>} 
    </main>
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function ProfileSetup({profileForm,setProfileForm,onSubmit,error,loading}){
  const update=(key,value)=>setProfileForm(current=>({...current,[key]:value}))
  return <main className="connectionScreen profileSetupScreen">
    <section className="connectionCard profileSetupCard">
      <div className="brand"><div className="brandMark">FW</div><div><div className="brandName">First-Week Maze</div><div className="brandSub">Onboarding Command Center</div></div></div>
      <div className="eyebrow">LET’S SET UP YOUR FIRST WEEK</div>
      <h1>Tell us about your new role.</h1>
      <p>We’ll use your office, team, job title, and joining date to choose relevant onboarding tasks and help information.</p>
      <form onSubmit={event=>{event.preventDefault();onSubmit()}}>
        <div className="formGrid profileFields">
          <label>Your name<input required maxLength="80" autoComplete="name" value={profileForm.name} onChange={event=>update('name',event.target.value)} placeholder="e.g. Alex Mehta"/></label>
          <label>Job title / post<input required list="job-title-options" maxLength="80" value={profileForm.role} onChange={event=>update('role',event.target.value)} placeholder="e.g. Software Engineer"/></label>
          <datalist id="job-title-options"><option value="Software Engineer"/><option value="Product Manager"/><option value="HR Executive"/></datalist>
          <label>Team / department<input required list="team-options" maxLength="80" value={profileForm.department} onChange={event=>update('department',event.target.value)} placeholder="e.g. Backend Engineering"/></label>
          <datalist id="team-options"><option value="Backend Engineering"/><option value="Product"/><option value="People Operations"/></datalist>
          <label>Office location<input required list="office-options" maxLength="80" value={profileForm.location} onChange={event=>update('location',event.target.value)} placeholder="e.g. Noida"/></label>
          <datalist id="office-options"><option value="Noida"/><option value="Mumbai"/></datalist>
          <label>Joining date<input required type="date" value={profileForm.joiningDate} onChange={event=>update('joiningDate',event.target.value)}/></label>
        </div>
        <small className="profileHint">Suggestions match the sample task library. You can enter other values too; those profiles receive tasks marked for “All”.</small>
        {error&&<div className="profileError" role="alert">{error}</div>}
        <button className="primary profileSubmit" type="submit" disabled={loading}>{loading?'Building your path…':'Create my onboarding path →'}</button>
      </form>
      <div className="profilePrivacy">Demo setup only · No password or verified account yet · Use fictional information</div>
    </section>
    <div className="connectionMaze" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span></div>
  </main>
}

function ConnectionScreen({error,onRetry}) { return <main className="connectionScreen"><div className="connectionCard"><div className="brandMark">FW</div><div className="eyebrow">FIRST-WEEK MAZE · CONNECTION CHECK</div><h1>Your onboarding path is ready.</h1><p>The workspace couldn’t reach its API, so your checklist is waiting to load. Check that the project is deployed with the included <code>vercel.json</code> configuration, then try again.</p><div className="connectionStatus"><span className="statusDot"/> {error || 'Onboarding service unavailable'}</div><button className="primary" onClick={onRetry}>Try again <span>↻</span></button><small>For local preview, start the project with <code>npm run dev</code>.</small></div><div className="connectionMaze" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span></div></main> }

function EmployeeView({user,plan,stats,days,filtered,filter,setFilter,search,setSearch,toggleTask,scheduleReminder,assistantOpen,setAssistantOpen,messages,typing,question,setQuestion,askAssistant,showGenerator,setShowGenerator,profileForm,setProfileForm,generate}){
  const next=plan.filter(t=>t.status!=='complete' && t.status!=='blocked').sort((a,b)=>a.day-b.day || (a.priority==='High'?-1:1))[0]
  return <>
    <section className="heroGrid">
      <div className="heroCard"><div className="heroGlow"></div><div className="heroText"><span className="pill">DAY {Math.min(5, Math.max(1,plan.find(t=>t.status!=='complete')?.day||1))} · {user.location}</span><h2>Good morning, {user.name.split(' ')[0]}.</h2><p>Your personalized onboarding path is ready. Keep momentum by completing the next verified step.</p><div className="heroProgress"><div className="progressLine"><span style={{width:`${stats.pct}%`}}></span></div><b>{stats.pct}%</b><small>{stats.done} of {stats.total} tasks completed</small></div></div><div className="heroOrb"><div className="ring" style={{'--p':`${stats.pct*3.6}deg`}}><div><strong>{stats.pct}%</strong><span>complete</span></div></div></div></div>
      <div className="nextCard"><div className="cardKicker">WHAT’S NEXT</div><h3>{next?.title || 'You’re all caught up'}</h3><p>{next?.description || 'No verified pending task is waiting for you right now.'}</p>{next&&<div className="nextActions"><button className="primary" onClick={()=>toggleTask(next)}>Complete task <span>→</span></button><button className="tinyButton" disabled={!!next.reminder} onClick={()=>scheduleReminder(next)}>{next.reminder?'Reminder set':'Remind me tomorrow'}</button></div>}<div className="sourceLine">▣ Based on your role, team & location</div></div>
    </section>

    {stats.overdue.length>0&&<div className="nudge"><div className="nudgeIcon">!</div><div><b>Needs attention</b><span>{stats.overdue.length} onboarding task{stats.overdue.length>1?'s':''} look overdue based on the joining date. Start with <strong>{stats.overdue[0].title}</strong>.</span></div></div>}<section className="statsRow"><Stat label="Completed" value={stats.done} sub="across your week" icon="✓"/><Stat label="Remaining" value={stats.left} sub="tasks to go" icon="→"/><Stat label="Blocked" value={stats.blocked} sub="need a prerequisite" icon="!" danger/><Stat label="Day 1 focus" value={plan.filter(t=>t.day===1&&t.status!=='complete').length} sub="still pending" icon="1"/></section>

    <section className="contentGrid">
      <div className="checklistCard card">
        <div className="sectionHead"><div><div className="cardKicker">YOUR JOURNEY</div><h3>First-week checklist</h3></div><button className="tinyButton" onClick={()=>setShowGenerator(true)}>Edit profile</button></div>
        <div className="filters"><div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks…"/></div><div className="segmented">{['All','High','Medium','Low'].map(x=><button key={x} onClick={()=>setFilter(x)} className={filter===x?'active':''}>{x}</button>)}</div></div>
        <div className="timeline">{days.map(day=>{const tasks=filtered.filter(t=>t.day===day); if(!tasks.length)return null; return <div className="dayBlock" key={day}><div className="dayRail"><div className="dayDot">{day}</div>{day<5&&<div className="dayLine"></div>}</div><div className="dayBody"><div className="dayTitle"><span>DAY {day}</span><small>{tasks.filter(t=>t.status==='complete').length}/{tasks.length} done</small></div>{tasks.map(t=><TaskRow key={t.id} task={t} onToggle={()=>toggleTask(t)} onRemind={()=>scheduleReminder(t)}/>)}</div></div>})}</div>
      </div>
      <div className="assistantCard card">
        <div className="assistantHead"><div><div className="cardKicker">GROUNDED ASSISTANT</div><h3>Ask your onboarding guide</h3></div><button className="closeBtn" onClick={()=>setAssistantOpen(!assistantOpen)}>{assistantOpen?'−':'+'}</button></div>
        {assistantOpen?<>
          <div className="chips">{['What should I do today?','Why is repository access blocked?','Who is my HR contact?','Which security training do I need?'].map(x=><button key={x} onClick={()=>askAssistant(x)}>{x}</button>)}</div>
          <div className="chatBody">{messages.map((m,i)=><ChatMessage key={i} m={m}/>)}{typing&&<div className="typing"><span></span><span></span><span></span></div>}</div>
          <div className="composer"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAssistant()} placeholder="Ask something about your onboarding…"/><button onClick={()=>askAssistant()}>↑</button></div>
          <div className="trustStrip"><span>✓ Grounded in approved onboarding sources</span><span>↗ Human handoff for uncertainty</span></div>
        </>:<div className="assistantCollapsed">Ask the guide when you’re stuck. Answers cite the source.</div>}
      </div>
    </section>
    {showGenerator&&<GeneratorModal {...{profileForm,setProfileForm,generate,setShowGenerator}}/>}
  </>
}

function ChecklistView({user,plan,stats,days,filtered,filter,setFilter,search,setSearch,toggleTask,scheduleReminder}){
  return <section className="checklistPage">
    <div className="checklistPageHero card">
      <div>
        <div className="cardKicker">YOUR FIRST-WEEK JOURNEY</div>
        <h2>Every next step, in one place.</h2>
        <p>Search your assigned tasks, filter by priority, and update your progress as you go.</p>
      </div>
      <div className="checklistPageProgress">
        <strong>{stats.pct}%</strong>
        <span>{stats.done} of {stats.total} tasks complete</span>
        <span>{stats.left} remaining · {stats.blocked} blocked</span>
      </div>
    </div>
    <section className="checklistCard checklistFullCard card">
      <div className="sectionHead">
        <div><div className="cardKicker">PERSONALIZED FOR {user.name.toUpperCase()}</div><h3>First-week checklist</h3></div>
        <span className="checklistCount">{stats.done}/{stats.total} complete</span>
      </div>
      <div className="filters">
        <label className="search"><span>⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search tasks…" aria-label="Search checklist tasks"/></label>
        <div className="segmented" aria-label="Filter tasks by priority">{['All','High','Medium','Low'].map(value=><button type="button" key={value} onClick={()=>setFilter(value)} className={filter===value?'active':''} aria-pressed={filter===value}>{value}</button>)}</div>
      </div>
      {filtered.length===0?<div className="checklistEmpty"><strong>No tasks match those filters.</strong><span>Clear the search or choose “All” to see your assigned tasks.</span></div>:<div className="timeline">{days.map(day=>{const tasks=filtered.filter(task=>task.day===day); if(!tasks.length)return null; return <div className="dayBlock" key={day}><div className="dayRail"><div className="dayDot">{day}</div>{day<5&&<div className="dayLine"></div>}</div><div className="dayBody"><div className="dayTitle"><span>DAY {day}</span><small>{tasks.filter(task=>task.status==='complete').length}/{tasks.length} done</small></div>{tasks.map(task=><TaskRow key={task.id} task={task} onToggle={()=>toggleTask(task)} onRemind={()=>scheduleReminder(task)}/>)}</div></div>})}</div>}
    </section>
  </section>
}

function HelpHandoffView({userId,user}){
  const [handoffs,setHandoffs]=useState([])
  const [contacts,setContacts]=useState([])
  const [buddy,setBuddy]=useState('')
  const [category,setCategory]=useState('General onboarding')
  const [question,setQuestion]=useState('')
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(null)

  useEffect(()=>{
    let active=true
    request(`/handoffs/${encodeURIComponent(userId)}`)
      .then(data=>{
        if(!active) return
        setHandoffs(Array.isArray(data.handoffs)?data.handoffs:[])
        setContacts(Array.isArray(data.contacts)?data.contacts:[])
        setBuddy(data.buddy || '')
      })
      .catch(err=>{ if(active) setError(err.message || 'Could not load your handoffs.') })
      .finally(()=>{ if(active) setLoading(false) })
    return ()=>{ active=false }
  },[userId])

  async function submit(event){
    event.preventDefault()
    setError('')
    setSaved(null)
    if(question.trim().length<5){setError('Please describe what you need help with.');return}
    setSubmitting(true)
    try{
      const data=await request('/handoffs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,question:question.trim(),category})})
      setSaved(data.escalation)
      setHandoffs(items=>[data.escalation,...items].slice(0,20))
      setQuestion('')
    }catch(err){setError(err.message || 'Could not save your request.')}
    finally{setSubmitting(false)}
  }

  return <section className="helpPage">
    <div className="helpHero card">
      <div className="cardKicker">HELP & HUMAN HANDOFF</div>
      <h2>Get your question to the right team.</h2>
      <p>Choose a support team and describe what’s blocking you. Your request is saved as an open handoff record.</p>
    </div>
    <div className="helpGrid">
      <section className="helpForm card">
        <div className="cardKicker">NEW SUPPORT REQUEST</div>
        <h3>What do you need help with?</h3>
        <form onSubmit={submit}>
          <label>Send this to
            <select value={category} onChange={event=>setCategory(event.target.value)}>
              <option>General onboarding</option>
              <option>People Operations</option>
              <option>IT Service Desk</option>
              <option>Security Team</option>
              <option>Backend Platform</option>
              <option>Product Leadership</option>
              <option>Workplace Services</option>
            </select>
          </label>
          <label>Your question
            <textarea required minLength="5" maxLength="1000" rows="5" value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Describe the step you’re stuck on or the help you need…"/>
          </label>
          <div className="helpFormMeta">{question.length}/1000 characters · General requests go to People Operations</div>
          {error&&<div className="helpError" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={submitting}>{submitting?'Saving request…':'Send help request →'}</button>
        </form>
        {saved&&<div className="helpSuccess" role="status">
          <strong>Handoff saved</strong>
          <span>Reference: {saved.id}</span>
          <span>Assigned to: {saved.owner} · Status: {saved.status}</span>
        </div>}
        <div className="helpDemoNote">Demo behavior: this saves a request in the app database. It does not send email, Teams messages, or notify a real support queue. Use fictional questions only; this demo profile is not a secure login.</div>
      </section>
      <section className="helpContacts card">
        <div className="cardKicker">WHO CAN HELP</div>
        <h3>People and support teams</h3>
        {buddy&&<div className="buddyCard"><span className="buddyIcon">✦</span><div><b>{buddy}</b><small>Your onboarding buddy · demo contact</small></div></div>}
        {loading?<div className="helpSubtle">Loading contacts…</div>:<div className="contactList">
          {contacts.map(contact=><div className="helpContact" key={contact.id}>
            <div><b>{contact.team}</b><span>{contact.name} · {contact.role}</span></div>
            <small>{contact.email}</small>
          </div>)}
        </div>}
      </section>
    </div>
    <section className="helpHistory card">
      <div className="sectionHead"><div><div className="cardKicker">YOUR RECENT REQUESTS</div><h3>Handoff history</h3></div><span className="helpCount">{handoffs.length}</span></div>
      {loading?<div className="helpSubtle">Loading your saved requests…</div>:handoffs.length===0?<div className="helpEmpty">No handoff requests yet. If you get stuck, send one above.</div>:<div className="handoffList">
        {handoffs.map(item=><article className="handoffRow" key={item.id}>
          <div className="handoffStatus">{item.status || 'open'}</div>
          <div className="handoffDetails"><b>{item.category || 'General onboarding'} · {item.owner}</b><p>{item.question}</p><small>{item.createdAt?new Date(item.createdAt).toLocaleString():'Date unavailable'} · Ref {item.id}</small></div>
        </article>)}
      </div>}
    </section>
  </section>
}

function KnowledgeBaseView({onBack}){
  const [documents,setDocuments]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [query,setQuery]=useState('')
  const [tag,setTag]=useState('All')

  useEffect(()=>{
    let active=true
    setLoading(true)
    setError('')
    request('/knowledge')
      .then(data=>{ if(active) setDocuments(Array.isArray(data.documents)?data.documents:[]) })
      .catch(err=>{ if(active) setError(err.message || 'Could not load onboarding sources.') })
      .finally(()=>{ if(active) setLoading(false) })
    return ()=>{ active=false }
  },[])

  const tags=[...new Set(documents.flatMap(doc=>Array.isArray(doc.tags)?doc.tags:[]))].sort()
  const term=query.trim().toLowerCase()
  const filtered=documents.filter(doc=>{
    const matchesTag=tag==='All' || (doc.tags||[]).includes(tag)
    const searchable=`${doc.title} ${doc.section} ${doc.text} ${(doc.tags||[]).join(' ')}`.toLowerCase()
    return matchesTag && (!term || searchable.includes(term))
  })

  return <section className="knowledgePage">
    <div className="knowledgeHero card">
      <div>
        <div className="cardKicker">ONBOARDING SOURCE LIBRARY</div>
        <h2>Find the guidance behind your first week.</h2>
        <p>Search the same stored onboarding sources that support the assistant’s answers.</p>
        <button type="button" className="ghost knowledgeBack" onClick={onBack}>← Back to overview</button>
      </div>
      <div className="knowledgeBadge"><strong>{documents.length}</strong><span>sources</span></div>
    </div>
    <div className="knowledgeControls card">
      <label className="search knowledgeSearch"><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search titles, sections, guidance, or tags…" aria-label="Search knowledge sources"/></label>
      <div className="knowledgeTags" aria-label="Filter sources by tag">
        <button type="button" className={tag==='All'?'active':''} onClick={()=>setTag('All')}>All topics</button>
        {tags.map(item=><button type="button" key={item} className={tag===item?'active':''} onClick={()=>setTag(item)}>{item}</button>)}
      </div>
      <div className="knowledgeMeta">{loading?'Loading sources…':error?'':`Showing ${filtered.length} of ${documents.length} sources`}</div>
    </div>
    {error&&<div className="knowledgeNotice" role="alert">Couldn’t load the source library: {error}. Refresh the page and try again.</div>}
    {!loading&&!error&&filtered.length===0&&<div className="knowledgeEmpty card"><strong>No matching sources</strong><span>Try a different word or choose “All topics”.</span></div>}
    <div className="knowledgeGrid">
      {filtered.map(doc=><article className="knowledgeDoc card" key={doc.id}>
        <div className="knowledgeDocTop"><span className="knowledgeDocIcon">▤</span><span className="knowledgeDocLabel">SOURCE</span></div>
        <h3>{doc.title}</h3>
        <div className="knowledgeSection">{doc.section}</div>
        <p>{doc.text}</p>
        <div className="knowledgeDocTags">{(doc.tags||[]).map(item=><span key={item}>{item}</span>)}</div>
      </article>)}
    </div>
    <div className="knowledgeDemoNote">Demo content: replace these examples with your organization’s verified onboarding material before using the app with real employees.</div>
  </section>
}

function Stat({label,value,sub,icon,danger}){return <div className={`stat ${danger?'danger':''}`}><div className="statIcon">{icon}</div><div><div className="statValue">{value}</div><div className="statLabel">{label}</div><small>{sub}</small></div></div>}
function TaskRow({task,onToggle,onRemind}){const done=task.status==='complete'; return <div className={`taskRow ${done?'done':''} ${task.status==='blocked'?'blocked':''}`}><button type="button" className="check" onClick={onToggle} disabled={task.status==='blocked'} aria-label={done?`Reopen ${task.title}`:`Complete ${task.title}`} aria-pressed={done} title={task.status==='blocked'?'Complete the prerequisite first':undefined}>{done?'✓':''}</button><div className="taskMain"><div className="taskTitle">{task.title}<span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span>{task.required&&<span className="required">Required</span>}</div><p>{task.description}</p><div className="taskMeta"><span>◷ {task.estimatedMinutes} min</span><span>▣ {task.owner}</span><span>↗ {task.source} · {task.section}</span>{task.dependency&&<span className="dependency">⛓ Depends on: {task.dependency}</span>}{task.reminder&&<span className="reminder">◔ Reminder scheduled</span>}</div></div>{!done&&!task.reminder&&<button className="taskRemind" onClick={onRemind}>Remind</button>}<a href={task.link} target="_blank" className="taskLink" onClick={e=>{if(task.link.includes('example'))e.preventDefault()}}>Open ↗</a></div>}
function ChatMessage({m}){return <div className={`chatMsg ${m.role==='user'?'userMsg':''}`}><div className="msgAvatar">{m.role==='user'?'AM':'✦'}</div><div><div className="msgText">{m.text}</div>{m.source&&<div className="citation"><b>{m.aiUsed?'AI-assisted answer · source support':'Knowledge-base answer · source'}</b><span>{m.source.title} · {m.source.section}</span><small>{m.source.text}</small></div>}{m.contact&&<div className="contactMini">Contact: <b>{m.contact.name}</b> · {m.contact.team} · {m.contact.email}</div>}{m.handoff&&<div className="handoff">⚑ Human handoff opened{m.escalation?.owner?` — owned by ${m.escalation.owner}`:''}</div>}</div></div>}
function GeneratorModal({profileForm,setProfileForm,generate,setShowGenerator}){const update=(k,v)=>setProfileForm(p=>({...p,[k]:v})); return <div className="modalBackdrop"><div className="modal"><div className="modalTop"><div><div className="cardKicker">PERSONALIZATION ENGINE</div><h3>Build your first-week path</h3><p>These profile signals control which verified tasks appear in the journey.</p></div><button className="closeBtn" onClick={()=>setShowGenerator(false)}>×</button></div><div className="formGrid"><label>Full name<input value={profileForm.name} onChange={e=>update('name',e.target.value)}/></label><label>Role<select value={profileForm.role} onChange={e=>update('role',e.target.value)}><option>Software Engineer</option><option>Product Manager</option><option>HR Executive</option></select></label><label>Department<input value={profileForm.department} onChange={e=>update('department',e.target.value)}/></label><label>Location<select value={profileForm.location} onChange={e=>update('location',e.target.value)}><option>Noida</option><option>Mumbai</option></select></label><label>Joining date<input type="date" value={profileForm.joiningDate} onChange={e=>update('joiningDate',e.target.value)}/></label><label>Experience<select value={profileForm.experience} onChange={e=>update('experience',e.target.value)}><option>Early career</option><option>Experienced</option></select></label></div><div className="modalPreview"><span>Preview</span><div>{profileForm.role} · {profileForm.department} · {profileForm.location}</div><small>The checklist and assistant answers will adapt to this profile.</small></div><div className="modalActions"><button className="ghost" onClick={()=>setShowGenerator(false)}>Cancel</button><button className="primary" onClick={generate}>Generate personalized week →</button></div></div></div>}

function AdminView({admin,onRefresh}){if(!admin)return <div className="loadingPanel">Loading HR analytics…</div>; const max=Math.max(...admin.byDay.map(x=>x.value)); return <div className="adminPage"><div className="adminHero"><div><div className="cardKicker">PEOPLE OPERATIONS CONTROL ROOM</div><h2>Spot who is progressing — and who is stuck.</h2><p>Team-level onboarding visibility without turning the product into employee surveillance.</p></div><button className="primary" onClick={onRefresh}>↻ Refresh data</button></div><div className="statsRow"><Stat label="Avg. completion" value={`${admin.completionRate}%`} sub="across demo employees" icon="%"/><Stat label="Employees blocked" value={admin.blockers} sub="need intervention" icon="!" danger/><Stat label="Open handoffs" value={admin.escalations} sub="questions for humans" icon="↗"/><Stat label="Tracked users" value={admin.employees.length} sub="in this demo cohort" icon="◉"/></div><div className="adminGrid"><div className="card employeeTable"><div className="sectionHead"><div><div className="cardKicker">ONBOARDING HEALTH</div><h3>Employees</h3></div></div><table><thead><tr><th>Employee</th><th>Role</th><th>Location</th><th>Progress</th><th>Signals</th></tr></thead><tbody>{admin.employees.map(e=><tr key={e.id}><td><b>{e.name}</b></td><td>{e.role}</td><td>{e.location}</td><td><div className="tableProgress"><span style={{width:`${e.progress}%`}}></span></div><small>{e.progress}%</small></td><td>{e.blocked>0?<span className="alertTag">{e.blocked} blocked</span>:<span className="okTag">On track</span>}</td></tr>)}</tbody></table></div><div className="card chartCard"><div className="cardKicker">AVERAGE COMPLETION</div><h3>Journey drop-off</h3><div className="barChart">{admin.byDay.map(x=><div className="barWrap" key={x.day}><div className="bar" style={{height:`${Math.max(10,x.value/max*150)}px`}}><span>{x.value}%</span></div><small>{x.day.replace('Day ','D')}</small></div>)}</div></div></div><div className="adminGrid bottom"><div className="card"><div className="cardKicker">TASK AUTHORING</div><h3>Onboarding task library</h3><p className="adminHint">Add a task template for the next cohort. Changes persist in the demo database.</p><AdminTaskEditor onSaved={onRefresh}/></div><div className="card"><div className="cardKicker">COMMON FRICTION</div><h3>Most missed tasks</h3><div className="rankList">{admin.topMissed.map((x,i)=><div key={x.title}><span className="rank">0{i+1}</span><div><b>{x.title}</b><small>{x.count} open assignment(s)</small></div></div>)}</div></div><div className="card adminNote"><div className="cardKicker">DESIGN PRINCIPLE</div><h3>Intervene, don’t surveil.</h3><p>The admin view surfaces blockers and aggregated friction so HR can help employees who need a human, while the employee remains in control of their checklist.</p><div className="notePills"><span>RBAC-ready</span><span>Human-in-loop</span><span>Source-backed</span></div></div></div></div>}


function AdminTaskEditor({onSaved}){
  const [form,setForm]=useState({title:'',description:'',day:1,priority:'Medium',estimatedMinutes:15,required:true,role:'All',department:'All',location:'All',source:'HR Handbook',section:'New section',link:'https://intranet.example/',owner:'People Operations',dueOffsetDays:0})
  const update=(k,v)=>setForm(f=>({...f,[k]:v}))
  async function save(){ if(!form.title.trim()) return; try { await request('/admin/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); setForm({...form,title:'',description:''}); onSaved() } catch(error) { window.alert(error.message || 'Could not save task') } }
  return <div className="authorForm"><div className="authorGrid"><input placeholder="Task title" value={form.title} onChange={e=>update('title',e.target.value)}/><select value={form.priority} onChange={e=>update('priority',e.target.value)}><option>High</option><option>Medium</option><option>Low</option></select><select value={form.day} onChange={e=>update('day',Number(e.target.value))}><option value="1">Day 1</option><option value="2">Day 2</option><option value="3">Day 3</option><option value="4">Day 4</option><option value="5">Day 5</option></select><select value={form.role} onChange={e=>update('role',e.target.value)}><option>All</option><option>Software Engineer</option><option>Product Manager</option><option>HR Executive</option></select></div><textarea placeholder="What should the employee do?" value={form.description} onChange={e=>update('description',e.target.value)}></textarea><div className="authorActions"><label><input type="checkbox" checked={form.required} onChange={e=>update('required',e.target.checked)}/> Required</label><button className="primary" onClick={save}>Add task</button></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
