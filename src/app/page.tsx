"use client";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


import { useState, useEffect } from "react";

type Task = {
  id: string;
  title: string;
  deadline: string;
  isCompleted: boolean;
  closingComment?: string;
};

export default function TaskTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");

  // States
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [closingComment, setClosingComment] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");

  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [quote, setQuote] = useState({ text: "Loading inspiration...", author: "System" });

  // Initial Load
  useEffect(() => {
    setMounted(true);
    const savedTasks = localStorage.getItem("vimaso-task-tracker");
    if (savedTasks) setTasks(JSON.parse(savedTasks));

    const savedTheme = localStorage.getItem("vimaso-theme");
    if (savedTheme === "light") setIsDark(false);

    // Fetch Daily Quote
    const fetchQuote = async () => {
      const today = new Date().toDateString();
      const savedQuote = localStorage.getItem("daily-quote");
      const savedDate = localStorage.getItem("daily-quote-date");

      if (savedQuote && savedDate === today) {
        setQuote(JSON.parse(savedQuote));
      } else {
        try {
          const res = await fetch("https://dummyjson.com/quotes/random");
          const data = await res.json();
          const newQuote = { text: data.quote, author: data.author };
          setQuote(newQuote);
          localStorage.setItem("daily-quote", JSON.stringify(newQuote));
          localStorage.setItem("daily-quote-date", today);
        } catch (e) {
          setQuote({ text: "The future belongs to those who build it.", author: "Unknown" });
        }
      }
    };
    fetchQuote();
  }, []);

  // Save changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("vimaso-task-tracker", JSON.stringify(tasks));
      localStorage.setItem("vimaso-theme", isDark ? "dark" : "light");
    }
  }, [tasks, isDark, mounted]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDeadline) return;
    setTasks([...tasks, { id: crypto.randomUUID(), title: newTaskTitle, deadline: newTaskDeadline, isCompleted: false }]);
    setNewTaskTitle("");
    setNewTaskDeadline("");
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDeadline(task.deadline);
  };

  const saveEdit = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, title: editTitle, deadline: editDeadline } : t));
    setEditingTaskId(null);
  };

  const confirmCompletion = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, isCompleted: true, closingComment: closingComment } : t));
    setCompletingTaskId(null);
    setClosingComment("");
  };

  const deleteTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));

  if (!mounted) return null;

  // --- DATE LOGIC ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysDifference = (deadlineStr: string) => {
    const taskDate = new Date(deadlineStr);
    taskDate.setHours(0, 0, 0, 0);
    return Math.ceil((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);

  const buckets = [
    { id: 'daily', label: 'Daily Goals', data: activeTasks.filter(t => getDaysDifference(t.deadline) <= 0) },
    { id: 'short', label: 'Short Term (< 7d)', data: activeTasks.filter(t => { const d = getDaysDifference(t.deadline); return d > 0 && d <= 7; }) },
    { id: 'near', label: 'Near Future (< 6m)', data: activeTasks.filter(t => { const d = getDaysDifference(t.deadline); return d > 7 && d <= 182; }) },
    { id: 'long', label: 'Long Term (> 6m)', data: activeTasks.filter(t => getDaysDifference(t.deadline) > 182) }
  ];

  // Tailored "ViMaSo" UI Classes
  const themeWrapper = isDark ? "bg-[#000000] text-[#f5f5f7]" : "bg-[#f5f5f7] text-[#1d1d1f]";
  const cardStyle = `transition-transform duration-300 transform hover:scale-[1.02] rounded-[18px] p-5 ${isDark ? "bg-[#1c1c1e] border border-white/5" : "bg-white border border-black/5 shadow-sm"
    }`;
  const inputStyle = `w-full px-4 py-2.5 rounded-[10px] focus:outline-none transition-colors border ${isDark ? "bg-white/5 border-[#424245] text-white focus:border-[#2997ff]" : "bg-black/5 border-gray-200 text-black focus:border-[#2997ff]"
    }`;
  const btnPrimary = "bg-gradient-to-r from-[#2997ff] to-[#0051d5] text-white rounded-full px-6 py-2.5 font-semibold hover:opacity-90 transition-opacity border-none whitespace-nowrap";
  const btnSecondary = `rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${isDark ? "border-[#2997ff] text-[#2997ff] hover:bg-[#2997ff]/10" : "border-[#0051d5] text-[#0051d5] hover:bg-[#0051d5]/10"
    }`;
  const btnGhost = `text-sm font-medium transition-opacity hover:opacity-70 ${isDark ? "text-[#86868b]" : "text-gray-500"}`;

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 antialiased tracking-tight overflow-x-hidden ${themeWrapper}`}>

      {/* Top Navbar */}
      <div className={`px-6 py-4 flex justify-between items-center border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
        <div className="font-semibold text-lg flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-r from-[#2997ff] to-[#0051d5] shadow-[0_0_10px_rgba(41,151,255,0.6)]"></div>
          Task.IO
        </div>
        <button onClick={() => setIsDark(!isDark)} className={btnSecondary}>
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto space-y-10 p-6 md:p-10">

        {/* Daily Quote */}
        <div className="text-center space-y-2 mb-10 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">"{quote.text}"</h1>
          <p className={`text-lg ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>— {quote.author}</p>
        </div>

        {/* Add Task Input Card (Centered) */}
        <div className={`${cardStyle} max-w-3xl mx-auto mb-12`}>
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
        </div>

        {/* Kanban-Style Vertical Columns (Side-by-Side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {buckets.map((bucket) => (
            <div key={bucket.id} className={`flex flex-col rounded-[22px] p-5 border ${isDark ? "bg-[#1c1c1e]/40 border-white/5" : "bg-black/[0.02] border-black/5"}`}>
              {/* Column Header */}
              <div className={`mb-4 pb-3 border-b flex justify-between items-center sticky top-0 ${isDark ? "border-white/10 text-white" : "border-black/10 text-black"}`}>
                <h3 className="text-lg font-semibold tracking-tight">{bucket.label}</h3>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}`}>{bucket.data.length}</span>
              </div>

              {/* Column Content */}
              <div className="flex flex-col gap-4 min-h-[150px]">
                {bucket.data.length === 0 && (
                  <div className={`flex items-center justify-center h-full text-sm italic ${isDark ? "text-[#86868b]/50" : "text-gray-400"}`}>
                    Drop a task here
                  </div>
                )}

                {bucket.data.map((task) => {
                  const diffDays = getDaysDifference(task.deadline);
                  const isBreached = diffDays < 0;

                  return (
                    <div key={task.id} className={cardStyle}>
                      {editingTaskId === task.id ? (
                        <div className="space-y-3">
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputStyle} />
                          <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} className={inputStyle} />
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button onClick={() => saveEdit(task.id)} className={btnSecondary}>Save</button>
                            <button onClick={() => setEditingTaskId(null)} className={btnGhost}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-start gap-3">
                            <span className="text-base font-medium leading-tight">{task.title}</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isBreached ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-[#2ecc71]/10 border-[#2ecc71]/30 text-[#2ecc71]'
                              }`}>
                              {isBreached ? 'Breached' : 'On Track'}
                            </span>
                            <span className={`text-xs ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>
                              {diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays < 0 ? `${Math.abs(diffDays)}d ago` : `In ${diffDays}d`}
                            </span>
                          </div>

                          {completingTaskId === task.id ? (
                            <div className={`mt-2 pt-3 border-t ${isDark ? "border-white/10" : "border-black/10"}`}>
                              <input type="text" placeholder="Closing note..." value={closingComment} onChange={(e) => setClosingComment(e.target.value)} className={`${inputStyle} text-sm py-1.5`} autoFocus />
                              <div className="flex gap-3 mt-3">
                                <button onClick={() => confirmCompletion(task.id)} className="text-xs font-semibold text-[#2997ff] hover:opacity-70">Confirm</button>
                                <button onClick={() => setCompletingTaskId(null)} className={btnGhost}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className={`flex items-center justify-between mt-1 pt-3 border-t ${isDark ? "border-white/10" : "border-black/10"}`}>
                              <button onClick={() => setCompletingTaskId(task.id)} className={`text-xs font-medium transition-colors ${isDark ? "text-[#2997ff] hover:text-[#0051d5]" : "text-[#0051d5] hover:text-[#2997ff]"}`}>Complete</button>
                              <div className="flex gap-3">
                                <button onClick={() => startEdit(task)} className={`text-xs ${btnGhost}`}>Edit</button>
                                <button onClick={() => deleteTask(task.id)} className="text-xs font-medium text-[#ff3b30] hover:opacity-70 transition-opacity">Delete</button>
                              </div>
                            </div>
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

        {/* Completed Archive */}
        <div className={`mt-16 p-6 md:p-8 rounded-[22px] border ${isDark ? "bg-[#1c1c1e]/50 border-white/5" : "bg-gray-50 border-black/5"}`}>
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-3">
            Completed Archive
            <span className={`text-sm font-normal px-3 py-1 rounded-full ${isDark ? "bg-white/10" : "bg-black/5"}`}>{completedTasks.length}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {completedTasks.length === 0 && <p className={`text-sm col-span-full ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>No tasks completed yet. Time to get to work!</p>}
            {completedTasks.map((task) => (
              <div key={task.id} className={`p-4 rounded-[14px] border flex flex-col justify-between ${isDark ? "border-white/5 bg-[#1c1c1e]" : "border-black/5 bg-white"}`}>
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`line-through text-sm ${isDark ? "text-[#86868b]" : "text-gray-400"}`}>{task.title}</span>
                  </div>
                  {task.closingComment && (
                    <div className={`mt-2 p-2.5 text-xs rounded-[8px] border ${isDark ? "bg-white/5 border-white/10 text-[#f5f5f7]" : "bg-black/5 border-black/10 text-black"}`}>
                      <span className={`block text-[10px] font-semibold mb-1 uppercase tracking-wider ${isDark ? "text-[#86868b]" : "text-gray-500"}`}>Note</span>
                      {task.closingComment}
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-dashed flex justify-end border-inherit">
                  <button onClick={() => deleteTask(task.id)} className="text-xs font-medium text-[#ff3b30] hover:opacity-70 transition-opacity">Delete Permanently</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
