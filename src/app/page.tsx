"use client";

import { useState, useEffect, useRef } from "react";
// --- FIREBASE IMPORTS ---
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, writeBatch } from "firebase/firestore";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// --- TYPES ---
type Subtask = {
  id: string;
  title: string;
  isCompleted: boolean;
};

type Task = {
  id: string;
  title: string;
  notes?: string;
  subtasks?: Subtask[];
  deadline: string;
  isCompleted: boolean;
  closingComment?: string;
  userId: string;
};

export default function TaskTracker() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [closingComment, setClosingComment] = useState("");
  
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [quote, setQuote] = useState({ text: "Loading inspiration...", author: "System" });

  // --- CSV Import State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        const q = query(collection(db, "tasks"), where("userId", "==", currentUser.uid));
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[]);
        });
        return () => unsubscribeSnapshot();
      } else setTasks([]);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const savedTheme = localStorage.getItem("vimaso-theme");
    if (savedTheme === "light") setIsDark(false);

    const fetchQuote = async () => {
      const today = new Date().toDateString();
      const saved = localStorage.getItem("daily-quote");
      const savedDate = localStorage.getItem("daily-quote-date");
      if (saved && savedDate === today) setQuote(JSON.parse(saved));
      else {
        try {
          const res = await fetch("https://dummyjson.com/quotes/random");
          const data = await res.json();
          setQuote({ text: data.quote, author: data.author });
          localStorage.setItem("daily-quote", JSON.stringify({ text: data.quote, author: data.author }));
          localStorage.setItem("daily-quote-date", today);
        } catch {
          setQuote({ text: "The future belongs to those who build it.", author: "Unknown" });
        }
      }
    };
    fetchQuote();
  }, [mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem("vimaso-theme", isDark ? "dark" : "light");
  }, [isDark, mounted]);

  // --- STANDARD ACTIONS ---
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDeadline || !user) return;
    await addDoc(collection(db, "tasks"), {
      title: newTaskTitle,
      deadline: newTaskDeadline,
      isCompleted: false,
      userId: user.uid,
      notes: "",
      subtasks: []
    });
    setNewTaskTitle("");
    setNewTaskDeadline("");
  };

  const confirmCompletion = async (id: string) => {
    await updateDoc(doc(db, "tasks", id), { isCompleted: true, closingComment });
    setCompletingTaskId(null);
    setClosingComment("");
  };

  const deleteTask = async (id: string) => await deleteDoc(doc(db, "tasks", id));

  const saveNotes = async (id: string) => {
    await updateDoc(doc(db, "tasks", id), { notes: tempNotes });
    setEditingNotesId(null);
  };

  const addSubtask = async (e: React.FormEvent, task: Task) => {
    e.preventDefault();
    if (!newSubtaskTitle) return;
    const newSub: Subtask = { id: crypto.randomUUID(), title: newSubtaskTitle, isCompleted: false };
    const updatedSubtasks = [...(task.subtasks || []), newSub];
    await updateDoc(doc(db, "tasks", task.id), { subtasks: updatedSubtasks });
    setNewSubtaskTitle("");
  };

  const toggleSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = task.subtasks?.map(st => 
      st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
    );
    await updateDoc(doc(db, "tasks", task.id), { subtasks: updatedSubtasks });
  };

  const deleteSubtask = async (task: Task, subtaskId: string) => {
    const updatedSubtasks = task.subtasks?.filter(st => st.id !== subtaskId);
    await updateDoc(doc(db, "tasks", task.id), { subtasks: updatedSubtasks });
  };

  // --- NEW: DOWNLOAD TEMPLATE ---
  const downloadTemplate = () => {
    const templateData = [
      ["title", "deadline", "notes"],
      ["Data Type: String", "Data Type: YYYY-MM-DD", "Data Type: String (optional)"],
      ["Example: Pay electricity bill", "2026-03-25", "Reminder: Check bank balance first"],
      ["Example: Quarterly business review", "2026-04-15", "Discuss Q1 metrics with team"],
      ["", "", ""]
    ];

    // Generate CSV content
    const csvContent = templateData.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'Task_IO_Import_Template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CSV BULK IMPORT ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const titleIndex = headers.indexOf('title');
        const deadlineIndex = headers.indexOf('deadline');
        const notesIndex = headers.indexOf('notes');

        if (titleIndex === -1 || deadlineIndex === -1) {
          alert("CSV Error: Make sure row 1 has 'title' and 'deadline' as column names. 'notes' is optional.");
          setIsImporting(false);
          return;
        }

        const batch = writeBatch(db);
        let validTasksCount = 0;

        for (let i = 1; i < rows.length; i++) {
          // Skip meta rows (description rows)
          if (rows[i].includes('Data Type') || rows[i].includes('Example')) continue;

          const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
          
          const title = cols[titleIndex];
          const deadline = cols[deadlineIndex];
          const notes = notesIndex !== -1 ? cols[notesIndex] : '';

          if (title && deadline) {
            const newDocRef = doc(collection(db, "tasks"));
            batch.set(newDocRef, {
              title: title,
              deadline: deadline,
              notes: notes || '',
              isCompleted: false,
              userId: user.uid,
              subtasks: []
            });
            validTasksCount++;
          }
        }

        if (validTasksCount > 0) {
          await batch.commit();
          alert(`✅ Success! Imported ${validTasksCount} tasks.`);
        } else {
          alert("⚠️ No valid tasks found. Check your CSV formatting.");
        }
      } catch (error) {
        console.error("Error importing CSV:", error);
        alert("❌ Failed to parse the CSV file.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };

  if (!mounted) return null;

  // --- STYLES ---
  const themeWrapper = isDark ? "bg-[#000000] text-[#f5f5f7]" : "bg-[#f5f5f7] text-[#1d1d1f]";
  const cardStyle = `transition-all duration-300 rounded-[18px] p-5 ${isDark ? "bg-[#1c1c1e] border border-white/5" : "bg-white border border-black/5 shadow-sm"}`;
  const inputStyle = `w-full px-4 py-2.5 rounded-[10px] focus:outline-none transition-colors border ${isDark ? "bg-white/5 border-[#424245] text-white focus:border-[#2997ff]" : "bg-black/5 border-gray-200 text-black focus:border-[#2997ff]"}`;
  const btnPrimary = "bg-gradient-to-r from-[#2997ff] to-[#0051d5] text-white rounded-full px-6 py-2.5 font-semibold hover:opacity-90 transition-opacity border-none whitespace-nowrap";
  const btnSecondary = `rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${isDark ? "border-[#2997ff] text-[#2997ff] hover:bg-[#2997ff]/10" : "border-[#0051d5] text-[#0051d5] hover:bg-[#0051d5]/10"}`;
  const btnGhost = `text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "text-[#86868b]" : "text-gray-500"}`;

  if (authLoading) return <div className={`min-h-screen flex items-center justify-center font-sans ${themeWrapper}`}>Checking credentials...</div>;

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-sans ${themeWrapper}`}>
        <div className={`p-10 rounded-[22px] border max-w-md w-full text-center space-y-8 ${isDark ? "bg-[#1c1c1e] border-white/5" : "bg-white border-black/5 shadow-sm"}`}>
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#2997ff] to-[#0051d5] shadow-[0_0_20px_rgba(41,151,255,0.4)]"></div>
          <div><h1 className="text-2xl font-bold tracking-tight mb-2">Task.IO</h1><p className={isDark ? "text-[#86868b]" : "text-gray-500"}>Sign in to sync your goals.</p></div>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className={`${btnPrimary} w-full py-3 text-lg`}>Continue with Google</button>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const getDaysDiff = (deadline: string) => Math.ceil((new Date(deadline).getTime() - today.getTime()) / 86400000);

  // Filter out completed tasks and sort them by nearest date, then alphabetically
  const activeTasks = tasks
    .filter(t => !t.isCompleted)
    .sort((a, b) => {
      const dateDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (dateDiff === 0) {
        return a.title.localeCompare(b.title);
      }
      return dateDiff;
    });

  const buckets = [
    { id: 'daily', label: 'Daily Goals', data: activeTasks.filter(t => getDaysDiff(t.deadline) <= 0) },
    { id: 'short', label: 'Short Term (< 7d)', data: activeTasks.filter(t => { const d = getDaysDiff(t.deadline); return d > 0 && d <= 7; }) },
    { id: 'near', label: 'Near Future (< 6m)', data: activeTasks.filter(t => { const d = getDaysDiff(t.deadline); return d > 7 && d <= 182; }) },
    { id: 'long', label: 'Long Term (> 6m)', data: activeTasks.filter(t => getDaysDiff(t.deadline) > 182) }
  ];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 antialiased tracking-tight overflow-x-hidden ${themeWrapper}`}>
      <div className={`px-6 py-4 flex justify-between items-center border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
        <div className="font-semibold text-lg flex items-center gap-2"><div className="w-6 h-6 rounded-md bg-gradient-to-r from-[#2997ff] to-[#0051d5] shadow-[0_0_10px_rgba(41,151,255,0.6)]"></div>Task.IO</div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDark(!isDark)} className={btnSecondary}>{isDark ? "Light Mode" : "Dark Mode"}</button>
          <button onClick={() => signOut(auth)} className={btnGhost}>Log out</button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto space-y-10 p-6 md:p-10">
        <div className="text-center space-y-2 mb-10 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">"{quote.text}"</h1>
          <p className={`text-lg ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>— {quote.author}</p>
        </div>

        <div className={`${cardStyle} max-w-3xl mx-auto mb-12`}>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-inherit">
            <h2 className="text-lg font-semibold">Initialize Task</h2>
            <div className="flex gap-2">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              
              <button 
                onClick={downloadTemplate}
                className={btnSecondary}
              >
                📋 Download Template
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className={btnSecondary}
              >
                {isImporting ? 'Processing...' : '📥 Bulk Import CSV'}
              </button>
            </div>
          </div>

          <form onSubmit={addTask} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className={`text-sm mb-2 block font-medium ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>New Objective</label>
              <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className={inputStyle} required placeholder="What do you want to achieve?" />
            </div>
            <div className="w-full md:w-48">
              <label className={`text-sm mb-2 block font-medium ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>Deadline</label>
              <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className={inputStyle} required />
            </div>
            <button type="submit" className={btnPrimary}>Add Task</button>
          </form>

          <div className={`mt-4 p-3 rounded-[10px] text-xs ${isDark ? "bg-white/5 border border-white/5" : "bg-black/5 border border-black/5"}`}>
            <p className="font-medium mb-1">📌 CSV Format: Requires columns <code className={isDark ? "bg-black/30" : "bg-black/10"}>title</code>, <code className={isDark ? "bg-black/30" : "bg-black/10"}>deadline</code> (YYYY-MM-DD), <code className={isDark ? "bg-black/30" : "bg-black/10"}>notes</code> (optional)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {buckets.map((bucket) => (
            <div key={bucket.id} className={`flex flex-col rounded-[22px] p-5 border ${isDark ? "bg-[#1c1c1e]/40 border-white/5" : "bg-black/[0.02] border-black/5"}`}>
              <div className={`mb-4 pb-3 border-b flex justify-between items-center sticky top-0 z-10 ${isDark ? "border-white/10 text-white bg-[#1c1c1e]" : "border-black/10 text-black bg-[#f5f5f7]"}`}>
                <h3 className="text-lg font-semibold tracking-tight">{bucket.label}</h3>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}`}>{bucket.data.length}</span>
              </div>

              <div className="flex flex-col gap-4 min-h-[150px]">
                {bucket.data.map((task) => {
                  const diffDays = getDaysDiff(task.deadline);
                  const isBreached = diffDays < 0;
                  const isExpanded = expandedTaskId === task.id;
                  
                  const subTotal = task.subtasks?.length || 0;
                  const subDone = task.subtasks?.filter(s => s.isCompleted).length || 0;
                  const progressPct = subTotal === 0 ? 0 : Math.round((subDone / subTotal) * 100);

                  return (
                    <div key={task.id} className={`${cardStyle} flex flex-col gap-3 transition-shadow ${!isExpanded && "hover:border-[#2997ff]/30"}`}>
                      
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-base font-medium leading-tight">{task.title}</span>
                      </div>

                      {subTotal > 0 && (
                        <div className="w-full mt-1">
                          <div className="flex justify-between text-[10px] font-medium mb-1 opacity-70">
                            <span>Progress</span>
                            <span>{subDone}/{subTotal}</span>
                          </div>
                          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                            <div className="h-full bg-gradient-to-r from-[#2997ff] to-[#0051d5] transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }}></div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isBreached ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-[#2ecc71]/10 border-[#2ecc71]/30 text-[#2ecc71]'}`}>
                          {isBreached ? 'Breached' : 'On Track'}
                        </span>
                        <span className={`text-xs ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>
                          {diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `In ${diffDays}d`}
                        </span>
                      </div>

                      {isExpanded ? (
                        <div className={`mt-3 pt-3 border-t flex flex-col gap-5 ${isDark ? "border-white/10" : "border-black/10"}`}>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>Notes</span>
                              {editingNotesId !== task.id && <button onClick={() => { setEditingNotesId(task.id); setTempNotes(task.notes || ""); }} className={btnGhost}>Edit</button>}
                            </div>
                            
                            {editingNotesId === task.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea value={tempNotes} onChange={e => setTempNotes(e.target.value)} className={`${inputStyle} text-sm min-h-[80px] resize-y`} placeholder="Add context, links, or detailed plans..." autoFocus />
                                <div className="flex gap-2">
                                  <button onClick={() => saveNotes(task.id)} className="text-xs font-semibold text-[#2997ff]">Save</button>
                                  <button onClick={() => setEditingNotesId(null)} className={btnGhost}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className={`text-sm p-3 rounded-[10px] border whitespace-pre-wrap ${isDark ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"}`}>
                                {task.notes ? task.notes : <span className="opacity-40 italic">No notes added.</span>}
                              </div>
                            )}
                          </div>

                          <div>
                            <span className={`text-xs font-semibold uppercase tracking-wider block mb-2 ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>Subtasks</span>
                            <div className="space-y-2 mb-3">
                              {task.subtasks?.map(sub => (
                                <div key={sub.id} className={`flex items-center justify-between p-2 rounded-[8px] border group ${isDark ? "bg-white/5 border-white/5" : "bg-black/5 border-black/5"}`}>
                                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                                    <input type="checkbox" checked={sub.isCompleted} onChange={() => toggleSubtask(task, sub.id)} className="w-4 h-4 rounded border-gray-300 text-[#2997ff] focus:ring-[#2997ff]" />
                                    <span className={`text-sm transition-opacity ${sub.isCompleted ? "line-through opacity-40" : ""}`}>{sub.title}</span>
                                  </label>
                                  <button onClick={() => deleteSubtask(task, sub.id)} className="text-[10px] text-[#ff3b30] opacity-0 group-hover:opacity-100 transition-opacity">Drop</button>
                                </div>
                              ))}
                            </div>
                            <form onSubmit={(e) => addSubtask(e, task)} className="flex gap-2">
                              <input type="text" value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="Add subtask..." className={`${inputStyle} py-1.5 text-sm`} />
                              <button type="submit" className="text-[#2997ff] font-semibold text-xl leading-none px-2">+</button>
                            </form>
                          </div>

                          <button onClick={() => setExpandedTaskId(null)} className={`text-xs text-center pt-2 border-t font-medium ${isDark ? "border-white/10 text-[#86868b] hover:text-white" : "border-black/10 text-gray-500 hover:text-black"}`}>Hide Details</button>
                        </div>
                      ) : (
                        <button onClick={() => setExpandedTaskId(task.id)} className={`text-xs text-left mt-2 pt-2 border-t font-medium transition-colors ${isDark ? "border-white/10 text-[#86868b] hover:text-white" : "border-black/10 text-gray-500 hover:text-black"}`}>
                          + View Details & Notes
                        </button>
                      )}

                      {!isExpanded && (
                        <div className={`flex items-center justify-between mt-1 pt-3 border-t ${isDark ? "border-white/10" : "border-black/10"}`}>
                          {completingTaskId === task.id ? (
                            <div className="w-full flex gap-2">
                              <input type="text" placeholder="Closing note..." value={closingComment} onChange={(e) => setClosingComment(e.target.value)} className={`${inputStyle} text-xs py-1`} autoFocus />
                              <button onClick={() => confirmCompletion(task.id)} className="text-xs text-[#2ecc71] font-semibold">Confirm</button>
                              <button onClick={() => setCompletingTaskId(null)} className="text-xs opacity-50">Cancel</button>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => setCompletingTaskId(task.id)} className={`text-xs font-medium transition-colors ${isDark ? "text-[#2997ff] hover:text-[#0051d5]" : "text-[#0051d5] hover:text-[#2997ff]"}`}>Complete</button>
                              <button onClick={() => deleteTask(task.id)} className="text-xs font-medium text-[#ff3b30] hover:opacity-70 transition-opacity">Delete</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
