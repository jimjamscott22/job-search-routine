"use client"

import { useEffect, useMemo, useState } from "react"
import jobsApi from "../js/jobs.js"
import storeApi from "../js/store.js"

type Job = { status: "idle" | "running" | "done"; checklist: boolean[]; notes: string; metrics: Record<string, string | number>; startedAt?: string | null; completedAt?: string | null }
type State = { version: number; days: Record<string, { jobs: Record<string, Job> }>; reports: any[] }

const labels: Record<string, string> = { scan: "Fresh job scan", followup: "Follow-up + networking", proof: "Build visible proof", practice: "Interview practice", sweep: "Second job sweep", close: "Close the loop" }
const initials: Record<string, string> = { scan: "01", followup: "02", proof: "03", practice: "04", sweep: "05", close: "06" }

function dateKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
function shortDate(key: string) { return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }
function metricTotal(state: State, today: string, key: string) { return Object.values(state.days).reduce((sum, day) => sum + Object.values(day.jobs).reduce((inner, job) => inner + (Number(job.metrics?.[key]) || 0), 0), 0) }

export default function Dashboard() {
  const today = useMemo(dateKey, [])
  const [state, setState] = useState<State | null>(null)
  const [tab, setTab] = useState<"today" | "reports">("today")
  const [toast, setToast] = useState("")

  useEffect(() => {
    const store = storeApi.createStore(window.localStorage)
    const loaded = jobsApi.ensureDay(store.load(), today)
    store.save(loaded)
    setState(loaded)
  }, [today])

  if (!state) return <main className="loading"><span>Loading your routine</span></main>
  const day = state.days[today]
  const jobs = jobsApi.JOB_IDS.map((id: string) => ({ id, def: jobsApi.JOB_DEFS[id], job: day.jobs[id] }))
  const completed = jobs.filter(({ job }: any) => job.status === "done").length
  const running = jobs.find(({ job }: any) => job.status === "running")
  const reports = [...(state.reports || [])].sort((a,b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""))
  const applications = metricTotal(state, today, "applications")
  const followUps = metricTotal(state, today, "followUps")
  const connections = metricTotal(state, today, "connections")
  const practiceMinutes = metricTotal(state, today, "minutes")

  function persist(next: State) { setState(next); storeApi.createStore(window.localStorage).save(next) }
  function action(id: string, kind: "start" | "complete" | "reopen") {
    const now = new Date()
    let result: any = kind === "complete" ? jobsApi.completeJob(state, today, id, now) : kind === "reopen" ? jobsApi.reopenJob(state, today, id, now) : jobsApi.startJob(state, today, id, now)
    if (result.conflict) {
      const conflict = jobsApi.JOB_DEFS[result.conflict].title
      if (!window.confirm(`${conflict} is still running. Park it and start this job?`)) return
      result = jobsApi.startJob(jobsApi.parkJob(state, today, result.conflict), today, id, now)
    }
    if (result.ok) persist(result.state); else setToast(kind === "complete" ? "Start this job before completing it." : "Reopen this job before starting it again.")
    window.setTimeout(() => setToast(""), 3200)
  }
  function updateJob(id: string, updater: (job: Job) => Job) { const next = jobsApi.ensureDay(state, today); next.days[today].jobs[id] = updater(next.days[today].jobs[id]); persist(next) }
  function exportData() { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `routine-${today}.json`; a.click(); URL.revokeObjectURL(url) }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">R</span><span>Routine</span></div><div className="sidebar-label">Workspace</div><nav><button className={tab === "today" ? "nav-item active" : "nav-item"} onClick={() => setTab("today")}><span>Today</span><b>{completed}/6</b></button><button className={tab === "reports" ? "nav-item active" : "nav-item"} onClick={() => setTab("reports")}><span>Reports</span><b>{reports.length}</b></button></nav><div className="sidebar-bottom"><div className="storage-note"><span className="status-dot" /> Saved locally<br /><small>Your data stays in this browser.</small></div><button className="text-button" onClick={exportData}>Export backup</button></div></aside>
    <section className="content"><header className="topbar"><div><p className="eyebrow">{shortDate(today)} · Tuesday</p><h1>{tab === "today" ? "Your daily rhythm" : "Routine reports"}</h1></div><div className="header-actions"><span className="streak"><strong>4</strong> day momentum</span><button className="avatar" aria-label="Profile">JS</button></div></header>
    {tab === "today" ? <>
      <section className="focus-banner"><div><p className="eyebrow">Today&apos;s focus</p><h2>{running ? `Working on ${running.def.title}` : completed === 6 ? "Routine complete. Protect the momentum." : "Small, consistent actions compound."}</h2><p>{running ? running.def.time : "Move through the routine in order, one useful block at a time."}</p></div><div className="progress-ring"><strong>{Math.round(completed / 6 * 100)}%</strong><span>complete</span></div></section>
      <section className="stats-grid"><Stat label="Applications" value={applications} goal="25 weekly goal" /><Stat label="Follow-ups" value={followUps} goal="Keep conversations warm" /><Stat label="Connections" value={connections} goal="Build your network" /><Stat label="Practice" value={`${practiceMinutes}m`} goal="Make skills visible" /></section>
      <div className="section-heading"><div><p className="eyebrow">The routine</p><h2>Six useful blocks</h2></div><span className="date-chip">{completed} of 6 finished</span></div>
      <section className="job-grid">{jobs.map(({ id, def, job }: any) => <JobCard key={id} id={id} def={def} job={job} onAction={action} onUpdate={updateJob} />)}</section>
      <section className="bottom-grid"><div className="panel reflection"><p className="eyebrow">Close-out reflection</p><h2>What will make tomorrow easier?</h2><p>Capture a useful note in the final block. It becomes your starting point for the next session.</p><div className="reflection-line" /></div><div className="panel momentum"><div className="panel-head"><div><p className="eyebrow">This week</p><h2>Momentum snapshot</h2></div><span>Mon – Sun</span></div><div className="bars">{[35, 52, 80, 45, 68, 28, 12].map((height, i) => <div className="bar-wrap" key={i}><div className={i === 2 ? "bar current" : "bar"} style={{ height: `${height}%` }} /><small>{["M","T","W","T","F","S","S"][i]}</small></div>)}</div></div></section>
    </> : <Reports reports={reports} />}
    </section>{toast && <div className="toast" role="status">{toast}</div>}
  </main>
}

function Stat({ label, value, goal }: { label: string; value: string | number; goal: string }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{goal}</small></div> }
function JobCard({ id, def, job, onAction, onUpdate }: any) { const checked = job.checklist.filter(Boolean).length; return <article className={`job-card ${job.status}`}><div className="job-top"><span className="job-number">{initials[id]}</span><span className={`status ${job.status}`}>{job.status}</span></div><h3>{def.title}</h3><p className="job-time">{def.time}</p><div className="job-progress"><span style={{ width: `${checked / def.checklistLength * 100}%` }} /></div><div className="checklist">{def.bullets.map((bullet: string, i: number) => <label key={bullet}><input type="checkbox" checked={!!job.checklist[i]} disabled={job.status === "done"} onChange={e => onUpdate(id, (current: Job) => ({ ...current, checklist: current.checklist.map((value, index) => index === i ? e.target.checked : value) }))} /><span>{bullet}</span></label>)}</div><textarea aria-label={`${def.title} notes`} placeholder="Add a note..." value={job.notes} disabled={job.status === "done"} onChange={e => onUpdate(id, current => ({ ...current, notes: e.target.value }))} />{job.status === "idle" && <button className="action-button" onClick={() => onAction(id, "start")}>Start block</button>}{job.status === "running" && <button className="action-button dark" onClick={() => onAction(id, "complete")}>Mark complete</button>}{job.status === "done" && <button className="action-button subtle" onClick={() => onAction(id, "reopen")}>Reopen block</button>}</article> }
function Reports({ reports }: { reports: any[] }) { return <section className="reports-page"><div className="report-summary"><div><p className="eyebrow">Your record</p><h2>Every finished block leaves evidence.</h2></div><p>{reports.length} completed blocks captured across your routine.</p></div>{reports.length === 0 ? <div className="empty-state"><h3>No reports yet</h3><p>Complete your first routine block and its record will appear here.</p></div> : <div className="report-list">{reports.map(report => <article className="report-row" key={report.id}><span className="report-date">{shortDate(report.date)}</span><div><h3>{report.title}</h3><p>{report.checklistSummary?.checked}/{report.checklistSummary?.total} checklist items · {report.notes || "No note added"}</p></div><span className="report-check">Complete</span></article>)}</div>}</section> }
