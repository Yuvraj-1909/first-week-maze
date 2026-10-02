const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 4000
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')

app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')))

function loadDb() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) }
function saveDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)) }
function norm(v) { return String(v || '').toLowerCase() }
function matchesRule(task, user) {
  return (task.role === 'All' || task.role === user.role) &&
    (task.department === 'All' || task.department === user.department) &&
    (task.location === 'All' || task.location === user.location)
}
function getPlan(db, user) {
  const tasks = db.tasks.filter(t => matchesRule(t, user))
  const progress = db.taskProgress.filter(p => p.userId === user.id)
  const reminders = (db.reminders || []).filter(r => r.userId === user.id && r.status === 'scheduled')
  return tasks.map(t => ({
    ...t,
    status: progress.find(p => p.taskId === t.id)?.status || 'pending',
    dependency: t.dependsOn ? tasks.find(x => x.id === t.dependsOn)?.title : null,
    reminder: reminders.find(r => r.taskId === t.id) || null
  }))
}
function groundedAnswer(db, user, question) {
  const q = norm(question)
  const docs = db.knowledgeDocuments
    .map(d => ({ d, score: d.tags.reduce((s, tag) => s + (q.includes(norm(tag)) ? 2 : 0), 0) + d.text.toLowerCase().split(/\s+/).filter(w => q.includes(w.replace(/[^a-z0-9]/g,'')) && w.length > 4).length }))
    .sort((a,b) => b.score - a.score)
  const plan = getPlan(db, user)
  const blocked = plan.filter(t => t.status === 'blocked')
  let answer = ''
  let contact = null
  let source = docs[0]?.d || db.knowledgeDocuments[0]

  if (q.includes('today') || q.includes('what should i do')) {
    const day1 = plan.filter(t => t.day === 1 && t.status !== 'complete')
    const next = plan.filter(t => t.status !== 'complete' && t.status !== 'blocked').sort((a,b)=>a.day-b.day || (a.priority === 'High' ? -1 : 1))
    const items = (day1.length ? day1 : next).slice(0, 4)
    answer = items.length ? `Your next verified onboarding steps are: ${items.map(x => x.title).join('; ')}.` : 'You have completed the currently assigned onboarding items.'
    source = db.knowledgeDocuments.find(d => d.id === 'k1') || source
  } else if (q.includes('laptop') || q.includes('device')) {
    answer = 'The verified process is to contact the IT Service Desk for device handover or device issues. Do not bypass the standard device process.'
    contact = db.contacts.find(c => c.team === 'IT Service Desk')
    source = db.knowledgeDocuments.find(d => d.id === 'k3') || source
  } else if (q.includes('hr contact') || q.includes('hr') || q.includes('buddy')) {
    answer = `Your verified People Operations contact is ${db.contacts.find(c=>c.team==='People Operations')?.name || 'People Operations'}. Your assigned onboarding buddy is ${user.buddy}.`
    contact = db.contacts.find(c=>c.team==='People Operations')
    source = db.knowledgeDocuments.find(d => d.id === 'k5') || source
  } else if (q.includes('security') || q.includes('training')) {
    answer = 'Security awareness training is required before access to restricted engineering systems. Security exceptions or sensitive questions should be escalated to the Security Team.'
    contact = db.contacts.find(c => c.team === 'Security Team')
    source = db.knowledgeDocuments.find(d => d.id === 'k2') || source
  } else if (q.includes('noida') || q.includes('mumbai') || q.includes('office')) {
    answer = `For your profile, use the ${user.location} site guidance. Workplace Services owns site-access and facilities questions.`
    contact = db.contacts.find(c => c.team === 'Workplace Services')
    source = db.knowledgeDocuments.find(d => d.id === 'k4') || source
  } else if (q.includes('repository') || q.includes('repo') || q.includes('git')) {
    const dep = plan.find(t => t.id === 't7')
    answer = dep?.status === 'blocked'
      ? 'Repository access is currently blocked because mandatory Security Awareness Training is incomplete. Complete that prerequisite first, then use the verified access-request route.'
      : 'Repository access is requested after mandatory security training. The IT Service Desk handles access requests and the Backend Platform owns architecture questions.'
    contact = db.contacts.find(c=>c.team==='IT Service Desk')
    source = db.knowledgeDocuments.find(d => d.id === 'k6') || source
  } else if (q.includes('sensitive') || q.includes('confidential') || q.includes('personal') || q.includes('exception')) {
    answer = 'I do not have enough verified information to safely answer that. This question should be handed to a human People Operations or Security contact rather than guessed.'
    contact = db.contacts.find(c => c.team === 'People Operations')
    source = db.knowledgeDocuments.find(d => d.id === 'k2') || source
  } else {
    const top = docs[0]
    if (top && top.score > 0) answer = `Based on ${top.d.title}, ${top.d.text}`
    else answer = 'I could not find a sufficiently grounded answer in the onboarding knowledge base. Please use the Human Handoff option so the right contact can help.'
  }

  const uncertainty = (!docs[0] || docs[0].score < 1) && !(q.includes('today') || q.includes('laptop') || q.includes('security') || q.includes('repository') || q.includes('hr') || q.includes('office'))
  return { answer, source: { title: source.title, section: source.section, text: source.text }, contact, uncertainty, handoff: uncertainty || q.includes('sensitive') || q.includes('confidential') }
}

app.get('/api/health', (_, res) => res.json({ ok: true }))
app.get('/api/users', (_, res) => res.json(loadDb().users))
app.get('/api/me/:id', (req,res)=>{ const db=loadDb(); const user=db.users.find(u=>u.id===req.params.id); if(!user) return res.status(404).json({error:'User not found'}); res.json({user, plan:getPlan(db,user)}) })
app.post('/api/onboarding/generate', (req,res)=>{
  const db=loadDb()
  const body=req.body
  const user={id:body.id || `u-${crypto.randomUUID()}`, name:body.name, email:body.email || 'demo@northstar.example', role:body.role, department:body.department, location:body.location, joiningDate:body.joiningDate, experience:body.experience || 'Early career', status:'in_progress', buddy: body.buddy || 'Riya Sharma'}
  const existing=db.users.find(u=>u.id===user.id)
  if(existing) Object.assign(existing,user)
  else db.users.push(user)
  saveDb(db)
  res.json({user, plan:getPlan(db,user)})
})
app.patch('/api/tasks/:userId/:taskId', (req,res)=>{
  const db=loadDb(); const {userId,taskId}=req.params; const status=req.body.status
  if(!['pending','complete','blocked'].includes(status)) return res.status(400).json({error:'Invalid status'})
  const user=db.users.find(u=>u.id===userId)
  const task=db.tasks.find(t=>t.id===taskId)
  if(!user || !task) return res.status(404).json({error:'User or task not found'})
  if(!matchesRule(task,user)) return res.status(403).json({error:'This task is not assigned to this user'})
  let row=db.taskProgress.find(p=>p.userId===userId&&p.taskId===taskId)
  if(!row) { row={userId,taskId,status}; db.taskProgress.push(row) } else row.status=status
  // dependency repair: dependent task becomes unblocked automatically when prerequisite is complete
  db.tasks.filter(t=>t.dependsOn===taskId).forEach(t=>{
    const p=db.taskProgress.find(x=>x.userId===userId&&x.taskId===t.id)
    if(p && status==='complete' && p.status==='blocked') p.status='pending'
    if(p && status!=='complete') p.status='blocked'
  })
  // A completed task no longer needs a scheduled nudge.
  if(status==='complete') (db.reminders || []).filter(r=>r.userId===userId&&r.taskId===taskId&&r.status==='scheduled').forEach(r=>r.status='cancelled')
  saveDb(db); res.json({plan:getPlan(db,user)})
})
app.post('/api/reminders', (req,res)=>{
  const db=loadDb(); const {userId,taskId,remindAt}=req.body || {}
  const user=db.users.find(u=>u.id===userId); const task=db.tasks.find(t=>t.id===taskId)
  if(!user || !task || !matchesRule(task,user)) return res.status(404).json({error:'Assigned user or task not found'})
  if(!db.reminders) db.reminders=[]
  db.reminders.filter(r=>r.userId===userId&&r.taskId===taskId&&r.status==='scheduled').forEach(r=>r.status='replaced')
  const reminder={id:crypto.randomUUID(),userId,taskId,remindAt:remindAt||new Date(Date.now()+86400000).toISOString(),status:'scheduled',createdAt:new Date().toISOString()}
  db.reminders.push(reminder); saveDb(db)
  res.status(201).json({reminder,plan:getPlan(db,user)})
})
app.post('/api/assistant', (req,res)=>{
  const db=loadDb(); const user=db.users.find(u=>u.id===req.body.userId); if(!user) return res.status(404).json({error:'User not found'})
  const result=groundedAnswer(db,user,req.body.question || '')
  if(result.handoff) {
    const owner=result.contact?.team || 'People Operations'
    const escalation={id:crypto.randomUUID(), userId:user.id, question:req.body.question, owner, createdAt:new Date().toISOString(), status:'open'}
    db.supportEscalations.push(escalation)
    result.escalation={id:escalation.id,owner,status:escalation.status}
  }
  saveDb(db); res.json(result)
})
app.post('/api/handoffs', (req,res)=>{
  const db=loadDb(); const {userId,question,category='General onboarding'}=req.body || {}
  const user=db.users.find(u=>u.id===userId)
  if(!user || !String(question||'').trim()) return res.status(400).json({error:'A user and question are required'})
  const owner=category.toLowerCase().includes('security') ? 'Security Team' : category.toLowerCase().includes('it') ? 'IT Service Desk' : 'People Operations'
  const escalation={id:crypto.randomUUID(),userId:user.id,question:question.trim(),category,owner,createdAt:new Date().toISOString(),status:'open'}
  db.supportEscalations.push(escalation); saveDb(db)
  res.status(201).json({escalation})
})
app.post('/api/admin/tasks', (req,res)=>{
  const db=loadDb(); const task={id:`t-${crypto.randomUUID().slice(0,8)}`,...req.body}; db.tasks.push(task); saveDb(db); res.json(task)
})
app.put('/api/admin/tasks/:id',(req,res)=>{ const db=loadDb(); const t=db.tasks.find(x=>x.id===req.params.id); if(!t) return res.status(404).json({error:'Task not found'}); Object.assign(t,req.body); saveDb(db); res.json(t) })
app.get('/api/admin/analytics',(req,res)=>{
  const db=loadDb();
  const employeeRows=db.users.map(u=>{ const plan=getPlan(db,u); const total=plan.length; const done=plan.filter(t=>t.status==='complete').length; const blocked=plan.filter(t=>t.status==='blocked').length; return {id:u.id,name:u.name,role:u.role,location:u.location,progress:total?Math.round(done/total*100):0,blocked,status:u.status,done,total} })
  const countByTask={}; db.taskProgress.forEach(p=>{ if(p.status==='pending'||p.status==='blocked') countByTask[p.taskId]=(countByTask[p.taskId]||0)+1 })
  const topMissed=Object.entries(countByTask).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,count])=>({title:db.tasks.find(t=>t.id===id)?.title||id,count}))
  const avg=employeeRows.length?Math.round(employeeRows.reduce((s,x)=>s+x.progress,0)/employeeRows.length):0
  res.json({employees:employeeRows, completionRate:avg, topMissed, blockers:employeeRows.filter(x=>x.blocked>0).length, escalations:db.supportEscalations.filter(x=>x.status==='open').length, byDay:[{day:'Day 1',value:78},{day:'Day 2',value:62},{day:'Day 3',value:45},{day:'Day 4',value:28},{day:'Day 5',value:15}]})
})

module.exports = app
