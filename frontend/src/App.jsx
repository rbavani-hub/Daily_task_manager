import { useEffect, useState } from "react";
import "./App.css";

const AUTH_API = "/api/auth";
const API = "/api/users";
const META_KEY = "taskManagerMetadata";
const THEME_KEY = "taskManagerDarkMode";

const emptyTaskDetails = {
    priority: "Medium",
    category: "Personal",
    dueDate: ""
};

function App() {
    const [token, setToken] = useState(
        () => localStorage.getItem("token") || ""
    );
    const [account, setAccount] = useState(null);
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState({});

    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [editingTask, setEditingTask] = useState(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDetails, setEditTaskDetails] = useState(emptyTaskDetails);

    const [newPriority, setNewPriority] = useState("Medium");
    const [newCategory, setNewCategory] = useState("Personal");
    const [newDueDate, setNewDueDate] = useState("");

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [focusMode, setFocusMode] = useState(false);

    const [taskMetadata, setTaskMetadata] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(META_KEY) || "{}");
        } catch {
            return {};
        }
    });

    const [darkMode, setDarkMode] = useState(
        () => localStorage.getItem(THEME_KEY) === "true"
    );

    useEffect(() => {
        localStorage.setItem(META_KEY, JSON.stringify(taskMetadata));
    }, [taskMetadata]);

    useEffect(() => {
        localStorage.setItem(THEME_KEY, String(darkMode));
    }, [darkMode]);

    const apiRequest = async (url, options = {}, authToken = token) => {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(url, { ...options, headers });
        const text = await response.text();

        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error(
                "The server returned HTML instead of JSON. Check the backend logs."
            );
        }

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        return data;
    };

    const loadAccount = async savedToken => {
        try {
            const data = await apiRequest(`${AUTH_API}/me`, {}, savedToken);
            setAccount(data.account);
            setUsers([data.user]);
            setError("");
        } catch (err) {
            localStorage.removeItem("token");
            setToken("");
            setAccount(null);
            setUsers([]);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const savedToken = localStorage.getItem("token");
        if (savedToken) {
            setToken(savedToken);
            loadAccount(savedToken);
        } else {
            setLoading(false);
        }
    }, []);

    const handleAuth = async e => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (mode === "signup" && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must contain at least 8 characters");
            return;
        }

        setSubmitting(true);

        try {
            const endpoint = mode === "signup" ? "/signup" : "/login";
            const body = mode === "signup"
                ? { name, email, password, confirmPassword }
                : { email, password };

            const data = await apiRequest(
                `${AUTH_API}${endpoint}`,
                { method: "POST", body: JSON.stringify(body) },
                ""
            );

            localStorage.setItem("token", data.token);
            setToken(data.token);
            setAccount({
                name: data.user.name,
                email: data.user.email
            });
            setUsers([data.user]);

            setName("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setError("");
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken("");
        setAccount(null);
        setUsers([]);
        setTasks({});
        setPassword("");
        setConfirmPassword("");
        setError("");
        setSuccess("");
        setSearch("");
        setFilter("all");
        setCategoryFilter("all");
        setFocusMode(false);
        setMode("login");
    };

    const openProfileModal = () => {
        setProfileName(account?.name || "");
        setShowProfileModal(true);
        setError("");
        setSuccess("");
    };

    const saveProfile = async e => {
        e.preventDefault();

        if (!users.length || !profileName.trim()) {
            setError("Please enter your name");
            return;
        }

        setSaving(true);
        try {
            const user = users[0];
            const data = await apiRequest(`${API}/${user._id}`, {
                method: "PUT",
                body: JSON.stringify({ name: profileName.trim() })
            });

            setUsers([data]);
            setAccount({ ...account, name: data.name });
            setShowProfileModal(false);
            setSuccess("Your profile has been updated successfully!");
            setError("");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const addTask = async (userId, e) => {
        e.preventDefault();
        const title = (tasks[userId] || "").trim();
        if (!title) return;

        try {
            const data = await apiRequest(`${API}/${userId}/todos`, {
                method: "POST",
                body: JSON.stringify({ title })
            });

            setUsers([data]);

            // Extra details are stored locally because the current
            // backend task API only accepts title and completed.
            const addedTodo = data.todos?.find(todo =>
                todo.title === title
            );

            if (addedTodo) {
                setTaskMetadata(previous => ({
                    ...previous,
                    [addedTodo._id]: {
                        ...emptyTaskDetails,
                        priority: newPriority,
                        category: newCategory,
                        dueDate: newDueDate
                    }
                }));
            }

            setTasks(previous => ({ ...previous, [userId]: "" }));
            setNewPriority("Medium");
            setNewCategory("Personal");
            setNewDueDate("");
            setSuccess("Task added successfully!");
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    const updateTask = async (user, todo, changes) => {
        try {
            const data = await apiRequest(
                `${API}/${user._id}/todos/${todo._id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(changes)
                }
            );

            setUsers([data]);
            setError("");
            return true;
        } catch (err) {
            setError(err.message);
            return false;
        }
    };

    const openTaskModal = (user, todo) => {
        setEditingTask({ user, todo });
        setEditTaskTitle(todo.title);
        setEditTaskDetails({
            ...emptyTaskDetails,
            ...(taskMetadata[todo._id] || {})
        });
        setShowTaskModal(true);
        setError("");
        setSuccess("");
    };

    const saveTask = async e => {
        e.preventDefault();
        const title = editTaskTitle.trim();

        if (!title || !editingTask) {
            setError("Please enter a task title");
            return;
        }

        setSaving(true);
        const updated = await updateTask(
            editingTask.user,
            editingTask.todo,
            { title }
        );

        if (updated) {
            setTaskMetadata(previous => ({
                ...previous,
                [editingTask.todo._id]: editTaskDetails
            }));
            setShowTaskModal(false);
            setEditingTask(null);
            setSuccess("Task updated successfully!");
        }
        setSaving(false);
    };

    const toggleTask = async (user, todo) => {
        const updated = await updateTask(user, todo, {
            completed: !todo.completed
        });

        if (updated) {
            setSuccess(
                todo.completed
                    ? "Task marked as pending"
                    : "Great job! Task completed."
            );
        }
    };

    const deleteTask = async (user, todoId) => {
        if (!window.confirm("Are you sure you want to delete this task?")) {
            return;
        }

        try {
            const data = await apiRequest(
                `${API}/${user._id}/todos/${todoId}`,
                { method: "DELETE" }
            );

            if (data?.todos) {
                setUsers([data]);
            } else {
                const refreshed = await apiRequest(API);
                setUsers(refreshed);
            }

            setTaskMetadata(previous => {
                const next = { ...previous };
                delete next[todoId];
                return next;
            });

            setSuccess("Task deleted successfully!");
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="auth-loading">
                <div className="auth-spinner"></div>
                <p>Loading your workspace...</p>
            </div>
        );
    }

    if (!token || !account) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-brand-icon">✓</div>
                    <span className="eyebrow">DAILY TASK MANAGER</span>
                    <h1>
                        {mode === "login"
                            ? "Welcome back!"
                            : "Create your account"}
                    </h1>
                    <p className="auth-subtitle">
                        {mode === "login"
                            ? "Log in to organize your day and manage your tasks."
                            : "Sign up to start planning your productive day."}
                    </p>

                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={() => setError("")}>×</button>
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleAuth}>
                        {mode === "signup" && (
                            <label>
                                Full name
                                <input
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </label>
                        )}

                        <label>
                            Email address
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </label>

                        <label>
                            Password
                            <input
                                type="password"
                                placeholder="Minimum 8 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                minLength={8}
                                required
                            />
                        </label>

                        {mode === "signup" && (
                            <label>
                                Confirm password
                                <input
                                    type="password"
                                    placeholder="Enter your password again"
                                    value={confirmPassword}
                                    onChange={e =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    minLength={8}
                                    required
                                />
                            </label>
                        )}

                        <button
                            className="primary-btn auth-submit"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Please wait..."
                                : mode === "login"
                                    ? "Login"
                                    : "Create Account"}
                        </button>
                    </form>

                    <div className="auth-switch">
                        {mode === "login"
                            ? "Don't have an account?"
                            : "Already have an account?"}
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === "login" ? "signup" : "login");
                                setError("");
                                setPassword("");
                                setConfirmPassword("");
                            }}
                        >
                            {mode === "login" ? "Sign Up" : "Login"}
                        </button>
                    </div>
                </div>
                <p className="auth-footer">
                    Organize your work. Achieve your goals.
                </p>
            </div>
        );
    }

    const user = users[0];
    const todos = user?.todos || [];
    const totalTasks = todos.length;
    const completedTasks = todos.filter(todo => todo.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const today = new Date().toISOString().slice(0, 10);

    const overdueTasks = todos.filter(todo => {
        const dueDate = taskMetadata[todo._id]?.dueDate;
        return dueDate && dueDate < today && !todo.completed;
    }).length;

    const completionRate = totalTasks
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const priorityCounts = {
        High: 0,
        Medium: 0,
        Low: 0
    };

    todos.forEach(todo => {
        const priority = taskMetadata[todo._id]?.priority || "Medium";
        priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const filteredTasks = todos.filter(todo => {
    const details = taskMetadata[todo._id] || emptyTaskDetails;

    const matchesSearch = todo.title
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
        filter === "all" ||
        (filter === "completed" && todo.completed) ||
        (filter === "pending" && !todo.completed);

    const matchesCategory =
        categoryFilter === "all" ||
        details.category === categoryFilter;

    const matchesFocus = !focusMode || !todo.completed;

    return matchesSearch && matchesStatus &&
        matchesCategory && matchesFocus;
    }).sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (
        order[taskMetadata[a._id]?.priority || "Medium"] -
        order[taskMetadata[b._id]?.priority || "Medium"]
        );
    });

    return (
        <div className={`app ${darkMode ? "dark-mode" : ""}`}>
            <header className="hero">
                <div className="hero-content">
                    <span className="eyebrow">PLAN YOUR DAY BETTER</span>
                    <h1>Daily Task Manager <span>✓</span></h1>
                    <p>
                        Organize your tasks and make every day productive.
                    </p>
                    <div className="logged-in-label">
                        Welcome back, <strong>{account.name}</strong>!
                    </div>
                </div>

                <div className="hero-actions">
                    <button
                        className="secondary-btn"
                        onClick={() => setDarkMode(!darkMode)}
                    >
                        {darkMode ? "☀ Light Mode" : "☾ Dark Mode"}
                    </button>
                    <button className="secondary-btn" onClick={openProfileModal}>
                        ✎ Edit Profile
                    </button>
                    <button className="logout-btn" onClick={logout}>
                        ↪ Logout
                    </button>
                </div>
            </header>

            <main className="container">
                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={() => setError("")}>×</button>
                    </div>
                )}
                {success && (
                    <div className="success-message">
                        {success}
                        <button onClick={() => setSuccess("")}>×</button>
                    </div>
                )}

                <section className="stats-grid">
                    <article className="stat-card">
                        <div className="stat-icon purple">▤</div>
                        <div><p>Total Tasks</p><h2>{totalTasks}</h2></div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon green">✓</div>
                        <div><p>Completed</p><h2>{completedTasks}</h2></div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon orange">◷</div>
                        <div><p>Pending</p><h2>{pendingTasks}</h2></div>
                    </article>
                    <article className="stat-card">
                        <div className="stat-icon blue">%</div>
                        <div><p>Completion Rate</p><h2>{completionRate}%</h2></div>
                    </article>
                </section>

                <section className="extra-stats">
                    <div className="mini-stat overdue-stat">
                        <span>⚠ Overdue tasks</span>
                        <strong>{overdueTasks}</strong>
                    </div>
                    <div className="mini-stat">
                        <span>🔴 High priority</span>
                        <strong>{priorityCounts.High}</strong>
                    </div>
                    <div className="mini-stat">
                        <span>🟡 Medium priority</span>
                        <strong>{priorityCounts.Medium}</strong>
                    </div>
                    <div className="mini-stat">
                        <span>🟢 Low priority</span>
                        <strong>{priorityCounts.Low}</strong>
                    </div>
                </section>

                <section className="users-section">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">YOUR WORKSPACE</span>
                            <h2>My Daily Tasks</h2>
                            <p className="dashboard-email">{account.email}</p>
                        </div>
                        <button
                            className={`focus-btn ${focusMode ? "active" : ""}`}
                            onClick={() => setFocusMode(!focusMode)}
                        >
                            {focusMode ? "✕ Exit Focus Mode" : "◎ Focus Mode"}
                        </button>
                    </div>

                    {!user ? (
                        <div className="empty-state">
                            <h3>No task profile found</h3>
                            <p>Please log out and sign in again.</p>
                        </div>
                    ) : (
                        <article className="user-card">
                            <div className="user-card-header">
                                <div className="avatar">
                                    {(user.name || "U").charAt(0).toUpperCase()}
                                </div>
                                <div className="user-info">
                                    <h3>{user.name}</h3>
                                    <p>{user.email}</p>
                                </div>
                                <button
                                    className="icon-btn"
                                    title="Edit profile"
                                    onClick={openProfileModal}
                                >
                                    ✎
                                </button>
                            </div>

                            <div className="task-summary">
                                <span>{focusMode ? "Focus Mode: Pending Tasks" : "My daily tasks"}</span>
                                <span className="task-count">
                                    {completedTasks}/{totalTasks} completed
                                </span>
                            </div>

                            <form
                                className="task-form enhanced-task-form"
                                onSubmit={e => addTask(user._id, e)}
                            >
                                <input
                                    type="text"
                                    placeholder="What do you need to do today?"
                                    value={tasks[user._id] || ""}
                                    onChange={e =>
                                        setTasks({
                                            ...tasks,
                                            [user._id]: e.target.value
                                        })
                                    }
                                    required
                                />
                                <select
                                    value={newPriority}
                                    onChange={e => setNewPriority(e.target.value)}
                                >
                                    <option>High</option>
                                    <option>Medium</option>
                                    <option>Low</option>
                                </select>
                                <select
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                >
                                    <option>Personal</option>
                                    <option>College</option>
                                    <option>Work</option>
                                    <option>Other</option>
                                </select>
                                <input
                                    type="date"
                                    value={newDueDate}
                                    min={today}
                                    onChange={e => setNewDueDate(e.target.value)}
                                    aria-label="Task due date"
                                />
                                <button type="submit">+ Add Task</button>
                            </form>

                            <div className="task-toolbar">
                                <input
                                    type="text"
                                    placeholder="⌕ Search your tasks..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                <select
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                >
                                    <option value="all">All Tasks</option>
                                    <option value="pending">Pending</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <select
                                    value={categoryFilter}
                                    onChange={e => setCategoryFilter(e.target.value)}
                                >
                                    <option value="all">All Categories</option>
                                    <option value="Personal">Personal</option>
                                    <option value="College">College</option>
                                    <option value="Work">Work</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="task-list">
                                {filteredTasks.length === 0 ? (
                                    <div className="no-tasks">
                                        {focusMode
                                            ? "No pending tasks. Enjoy your break!"
                                            : totalTasks === 0
                                                ? "No tasks yet. Add your first task!"
                                                : "No tasks match your search or filters."}
                                    </div>
                                ) : (
                                    filteredTasks.map(todo => {
                                        const details = {
                                            ...emptyTaskDetails,
                                            ...(taskMetadata[todo._id] || {})
                                        };
                                        const isOverdue =
                                            details.dueDate &&
                                            details.dueDate < today &&
                                            !todo.completed;

                                        return (
                                            <div className="task-item" key={todo._id}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!todo.completed}
                                                    onChange={() => toggleTask(user, todo)}
                                                />
                                                <div className="task-main">
                                                    <span className={todo.completed ? "completed" : ""}>
                                                        {todo.title}
                                                    </span>
                                                    <div className="task-tags">
                                                        <span className={`priority-tag ${details.priority.toLowerCase()}`}>
                                                            {details.priority}
                                                        </span>
                                                        <span className="category-tag">
                                                            {details.category}
                                                        </span>
                                                        {details.dueDate && (
                                                            <span className={`due-tag ${isOverdue ? "overdue" : ""}`}>
                                                                {isOverdue ? "Overdue: " : "Due: "}
                                                                {details.dueDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="task-actions">
                                                    <button
                                                        type="button"
                                                        title="Edit task"
                                                        onClick={() => openTaskModal(user, todo)}
                                                    >
                                                        ✎
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Delete task"
                                                        onClick={() => deleteTask(user, todo._id)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="progress-heading">
                                <span>Your productivity</span>
                                <strong>{completionRate}%</strong>
                            </div>
                            <div className="progress-track">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${completionRate}%` }}
                                />
                            </div>
                            <p className="motivation">
                                {totalTasks === 0
                                    ? "Start small. Achieve something great today!"
                                    : completionRate === 100
                                        ? "Amazing! You completed all your tasks!"
                                        : overdueTasks > 0
                                            ? `You have ${overdueTasks} overdue task(s). Try completing one now!`
                                            : completionRate >= 50
                                                ? "Great progress! Keep going!"
                                                : "Every completed task brings you closer to your goal!"}
                            </p>
                        </article>
                    )}
                </section>
            </main>

            <footer>
                <p>
                    Daily Task Manager · Built with React, Node.js, MongoDB & Docker
                </p>
            </footer>

            {showProfileModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) {
                            setShowProfileModal(false);
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div>
                                <span className="eyebrow">ACCOUNT SETTINGS</span>
                                <h2>Edit Profile</h2>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setShowProfileModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={saveProfile} className="modal-form">
                            <label>
                                Full name
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={e => setProfileName(e.target.value)}
                                    placeholder="Enter your name"
                                    maxLength={60}
                                    required
                                />
                            </label>
                            <label>
                                Email address
                                <input type="email" value={account.email} disabled />
                                <small>Email address cannot be changed here.</small>
                            </label>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowProfileModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save Profile"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTaskModal && (
                <div
                    className="modal-overlay"
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) {
                            setShowTaskModal(false);
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div>
                                <span className="eyebrow">TASK MANAGEMENT</span>
                                <h2>Edit Task</h2>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setShowTaskModal(false)}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={saveTask} className="modal-form">
                            <label>
                                Task title
                                <input
                                    type="text"
                                    value={editTaskTitle}
                                    onChange={e => setEditTaskTitle(e.target.value)}
                                    placeholder="Enter task title"
                                    maxLength={150}
                                    required
                                    autoFocus
                                />
                            </label>
                            <label>
                                Priority
                                <select
                                    value={editTaskDetails.priority}
                                    onChange={e =>
                                        setEditTaskDetails({
                                            ...editTaskDetails,
                                            priority: e.target.value
                                        })
                                    }
                                >
                                    <option>High</option>
                                    <option>Medium</option>
                                    <option>Low</option>
                                </select>
                            </label>
                            <label>
                                Category
                                <select
                                    value={editTaskDetails.category}
                                    onChange={e =>
                                        setEditTaskDetails({
                                            ...editTaskDetails,
                                            category: e.target.value
                                        })
                                    }
                                >
                                    <option>Personal</option>
                                    <option>College</option>
                                    <option>Work</option>
                                    <option>Other</option>
                                </select>
                            </label>
                            <label>
                                Due date
                                <input
                                    type="date"
                                    value={editTaskDetails.dueDate}
                                    onChange={e =>
                                        setEditTaskDetails({
                                            ...editTaskDetails,
                                            dueDate: e.target.value
                                        })
                                    }
                                />
                            </label>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowTaskModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Update Task"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
