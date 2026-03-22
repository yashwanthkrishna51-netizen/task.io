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
      subtasks: [],
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

  // --- DOWNLOAD TEMPLATE ---
  const downloadTemplate = () => {
    const templateData = [
      ["title", "deadline", "notes"],
      ["Data Type: String", "Data Type: YYYY-MM-DD", "Data Type: String (optional)"],
      ["Example: Pay electricity bill", "2026-03-25", "Reminder: Check bank balance first"],
      ["Example: Quarterly business review", "2026-04-15", "Discuss Q1 metrics with team"],
      ["", "", ""],
    ];
    const csvContent = templateData.map(row =>
      row.map(cell => `"${cell}"`).join(",")
    ).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Task_IO_Import_Template.csv");
    link.style.visibility = "hidden";
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
        const rows = text.split("\n").map(row => row.trim()).filter(row => row.length > 0);
        const headers = rows[0].split(",").map(h => h.trim().toLowerCase());
        const titleIndex = headers.indexOf("title");
        const deadlineIndex = headers.indexOf("deadline");
        const notesIndex = headers.indexOf("notes");
        if (titleIndex === -1 || deadlineIndex === -1) {
          alert("CSV Error: Make sure row 1 has 'title' and 'deadline' as column names. 'notes' is optional.");
          setIsImporting(false);
          return;
        }
        const batch = writeBatch(db);
        let validTasksCount = 0;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i].includes("Data Type") || rows[i].includes("Example")) continue;
          const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, "").trim());
          const title = cols[titleIndex];
          const deadline = cols[deadlineIndex];
          const notes = notesIndex !== -1 ? cols[notesIndex] : "";
          if (title && deadline) {
            const newDocRef = doc(collection(db, "tasks"));
            batch.set(newDocRef, {
              title,
              deadline,
              notes: notes || "",
              isCompleted: false,
              userId: user.uid,
              subtasks: [],
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

  // --- STYLES (Obsidian Ember — Geist + Satoshi) ---
  const geist = "font-[family-name:var(--font-geist-sans)]";
  const themeWrapper = isDark ? "bg-[#0A0A0A] text-[#F5F5F5]" : "bg-[#F5F5F5] text-[#1A1A1A]";
  const cardStyle = `transition-all duration-300 rounded-[14px] p-5 ${isDark ? "bg-[#111111] border border-white/[0.08]" : "bg-white border border-black/[0.08] shadow-sm"}`;
  const inputStyle = `w-full px-4 py-2.5 rounded-[10px] focus:outline-none transition-colors border text-[15px] ${isDark ? "bg-white/[0.04] border-white/[0.08] text-[#F5F5F5] placeholder-[#A0A0A0] focus:border-[#FF5C2B]" : "bg-black/[0.04] border-black/[0.08] text-[#1A1A1A] placeholder-[#6B6B6B] focus:border-[#FF5C2B]"}`;
  const btnPrimary = `bg-[#FF5C2B] hover:bg-[#FF8A5C] text-white rounded-full px-6 py-2.5 text-[14px] font-semibold transition-colors border-none whitespace-nowrap ${geist}`;
  const btnSecondary = `rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors border ${geist} ${isDark ? "border-[#FF5C2B]/60 text-[#FF5C2B] hover:bg-[#FF5C2B]/10" : "border-[#FF5C2B] text-[#FF5C2B] hover:bg-[#FF5C2B]/10"}`;
  const btnGhost = `text-[13px] font-medium transition-opacity hover:opacity-70 ${geist} ${isDark ? "text-[#A0A0A0]" : "text-[#6B6B6B]"}`;
  const mutedText = isDark ? "text-[#A0A0A0]" : "text-[#6B6B6B]";
  const labelStyle = `block text-[12px] font-medium mb-1 ${geist} ${mutedText}`;
  const divider = isDark ? "border-white/[0.08]" : "border-black/[0.08]";

  if (authLoading) return (
    <div className={`min-h-screen flex items-center justify-center ${themeWrapper}`}>
      <p className={`text-[15px] ${mutedText} ${geist}`}>Checking credentials...</p>
    </div>
  );

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${themeWrapper}`}>
        <div className={`${cardStyle} w-full max-w-sm flex flex-col gap-6 text-center`}>
          <h1 className={`text-[32px] font-bold tracking-tight ${geist}`}>Task.IO</h1>
          <p className={`text-[15px] ${mutedText}`}>Sign in to sync your goals.</p>
          <button
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className={`${btnPrimary} w-full py-3 text-[16px]`}
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const getDaysDiff = (deadline: string) =>
    Math.ceil((new Date(deadline).getTime() - today.getTime()) / 86400000);

  const activeTasks = tasks
    .filter(t => !t.isCompleted)
    .sort((a, b) => {
      const dateDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (dateDiff === 0) return a.title.localeCompare(b.title);
      return dateDiff;
    });

  const buckets = [
    { id: "daily", label: "Daily Goals", data: activeTasks.filter(t => getDaysDiff(t.deadline) <= 0) },
    { id: "short", label: "Short Term (< 7d)", data: activeTasks.filter(t => { const d = getDaysDiff(t.deadline); return d > 0 && d <= 7; }) },
    { id: "near", label: "Near Future (< 6m)", data: activeTasks.filter(t => { const d = getDaysDiff(t.deadline); return d > 7 && d <= 182; }) },
    { id: "long", label: "Long Term (> 6m)", data: activeTasks.filter(t => getDaysDiff(t.deadline) > 182) },
  ];

  return (
    <div className={`min-h-screen ${themeWrapper}`}>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className={`text-[32px] font-bold tracking-tight ${geist}`}>Task.IO</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsDark(!isDark)} className={btnSecondary}>
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button onClick={() => signOut(auth)} className={btnGhost}>Log out</button>
          </div>
        </header>

        {/* Quote */}
        <div className={`text-[14px] italic leading-relaxed ${mutedText}`}>
          <span>"{quote.text}"</span>
          <span className={`block mt-1 not-italic text-[12px] font-medium ${geist} ${mutedText}`}>
            — {quote.author}
          </span>
        </div>

        {/* Initialize Task */}
        <div className={cardStyle}>
          <h2 className={`text-[20px] font-semibold mb-4 ${geist}`}>Initialize Task</h2>
          <form onSubmit={addTask} className="flex flex-col gap-3">
            <div>
              <label className={labelStyle}>New Objective</label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                className={inputStyle}
                required
                placeholder="What do you want to achieve?"
              />
            </div>
            <div>
              <label className={labelStyle}>Deadline</label>
              <input
                type="date"
                value={newTaskDeadline}
                onChange={e => setNewTaskDeadline(e.target.value)}
                className={inputStyle}
                required
              />
            </div>
            <button type="submit" className={btnPrimary}>Add Task</button>
          </form>

          <div className="flex gap-2 mt-4 flex-wrap">
            <button onClick={downloadTemplate} className={btnSecondary}>📋 Download Template</button>
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className={btnSecondary}
            >
              {isImporting ? "Processing..." : "📥 Bulk Import CSV"}
            </button>
          </div>

          <p className={`text-[12px] mt-3 ${geist} ${mutedText}`}>
            📌 CSV Format: Requires columns <code>title</code>, <code>deadline</code> (YYYY-MM-DD), <code>notes</code> (optional)
          </p>
        </div>

        {/* Task Buckets */}
        {buckets.map((bucket) => (
          <div key={bucket.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className={`text-[20px] font-semibold ${geist}`}>{bucket.label}</h2>
              <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${geist} ${isDark ? "bg-white/[0.08] text-[#A0A0A0]" : "bg-black/[0.06] text-[#6B6B6B]"}`}>
                {bucket.data.length}
              </span>
            </div>

            {bucket.data.map((task) => {
              const diffDays = getDaysDiff(task.deadline);
              const isBreached = diffDays < 0;
              const isExpanded = expandedTaskId === task.id;
              const subTotal = task.subtasks?.length || 0;
              const subDone = task.subtasks?.filter(s => s.isCompleted).length || 0;
              const progressPct = subTotal === 0 ? 0 : Math.round((subDone / subTotal) * 100);

              return (
                <div key={task.id} className={cardStyle}>
                  {/* Task Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-medium leading-snug flex-1">{task.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {subTotal > 0 && (
                        <span className={`text-[12px] font-medium ${geist} ${mutedText}`}>
                          {subDone}/{subTotal}
                        </span>
                      )}
                      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${geist} ${isBreached ? "bg-[#FF453A]/10 text-[#FF453A]" : "bg-[#34C759]/10 text-[#34C759]"}`}>
                        {isBreached ? "Breached" : "On Track"}
                      </span>
                      <span className={`text-[12px] font-medium ${geist} ${mutedText}`}>
                        {diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `In ${diffDays}d`}
                      </span>
                    </div>
                  </div>

                  {/* Subtask Progress Bar */}
                  {subTotal > 0 && (
                    <div className={`mt-3 h-[2px] rounded-full overflow-hidden ${isDark ? "bg-white/[0.08]" : "bg-black/[0.08]"}`}>
                      <div
                        className="h-full rounded-full bg-[#FF5C2B] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  {/* Expanded Panel */}
                  {isExpanded ? (
                    <div className={`mt-4 pt-4 border-t flex flex-col gap-4 ${divider}`}>
                      {/* Notes */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[12px] font-semibold ${geist} ${mutedText}`}>Notes</span>
                          {editingNotesId !== task.id && (
                            <button
                              onClick={() => { setEditingNotesId(task.id); setTempNotes(task.notes || ""); }}
                              className={btnGhost}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {editingNotesId === task.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={tempNotes}
                              onChange={e => setTempNotes(e.target.value)}
                              className={`${inputStyle} min-h-[80px] resize-y`}
                              placeholder="Add context, links, or detailed plans..."
                              autoFocus
                            />
                            <div className="flex gap-3">
                              <button onClick={() => saveNotes(task.id)} className={`text-[13px] font-semibold ${geist} text-[#FF5C2B]`}>Save</button>
                              <button onClick={() => setEditingNotesId(null)} className={btnGhost}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-[15px] leading-relaxed ${task.notes ? "" : mutedText}`}>
                            {task.notes ? task.notes : "No notes added."}
                          </p>
                        )}
                      </div>

                      {/* Subtasks */}
                      <div>
                        <span className={`text-[12px] font-semibold ${geist} block mb-2 ${mutedText}`}>Subtasks</span>
                        {task.subtasks?.map(sub => (
                          <div key={sub.id} className="group flex items-center gap-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={sub.isCompleted}
                              onChange={() => toggleSubtask(task, sub.id)}
                              className="w-4 h-4 rounded accent-[#FF5C2B]"
                            />
                            <span className={`text-[15px] flex-1 ${sub.isCompleted ? "line-through opacity-40" : ""}`}>
                              {sub.title}
                            </span>
                            <button
                              onClick={() => deleteSubtask(task, sub.id)}
                              className={`text-[11px] font-medium text-[#FF453A] opacity-0 group-hover:opacity-100 transition-opacity ${geist}`}
                            >
                              Drop
                            </button>
                          </div>
                        ))}
                        <form onSubmit={e => addSubtask(e, task)} className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={e => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add subtask..."
                            className={`${inputStyle} py-1.5 text-[13px]`}
                          />
                          <button type="submit" className={btnPrimary}>Add</button>
                        </form>
                      </div>

                      <button
                        onClick={() => setExpandedTaskId(null)}
                        className={`text-[13px] text-center pt-2 border-t font-medium ${geist} transition-colors ${divider} ${mutedText} hover:${isDark ? "text-[#F5F5F5]" : "text-[#1A1A1A]"}`}
                      >
                        Hide Details
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setExpandedTaskId(task.id)}
                      className={`text-[13px] text-left mt-2 pt-2 border-t font-medium transition-colors ${geist} w-full ${divider} ${mutedText}`}
                    >
                      + View Details & Notes
                    </button>
                  )}

                  {/* Complete / Delete — only when not expanded */}
                  {!isExpanded && (
                    <div className="flex items-center gap-4 mt-2">
                      {completingTaskId === task.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            placeholder="Closing comment..."
                            value={closingComment}
                            onChange={e => setClosingComment(e.target.value)}
                            className={`${inputStyle} text-[13px] py-1`}
                            autoFocus
                          />
                          <button
                            onClick={() => confirmCompletion(task.id)}
                            className={`text-[13px] text-[#34C759] font-semibold ${geist} whitespace-nowrap`}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setCompletingTaskId(null)}
                            className={`text-[13px] ${geist} opacity-50`}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setCompletingTaskId(task.id)}
                            className={`text-[13px] font-medium ${geist} text-[#FF5C2B] hover:text-[#FF8A5C] transition-colors`}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className={`text-[13px] font-medium text-[#FF453A] hover:opacity-70 transition-opacity ${geist}`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
