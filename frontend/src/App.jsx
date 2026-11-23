
import { useEffect, useState } from "react";
import "./App.css";

const AUTH_API = "/api/auth";
const API = "/api/users";

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
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Common API request function
    const apiRequest = async (url, options = {}, authToken = token) => {
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        const text = await response.text();

        let data;

        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error(
                "The server returned HTML instead of JSON. Check the backend and Docker logs."
            );
        }

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        return data;
    };

    // Load logged-in account and its task list
    const loadAccount = async (savedToken) => {
        try {
            const data = await apiRequest(
                `${AUTH_API}/me`,
                {},
                savedToken
            );

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

    // Check whether a user is already logged in
    useEffect(() => {
        const savedToken = localStorage.getItem("token");

        if (savedToken) {
            setToken(savedToken);
            loadAccount(savedToken);
        } else {
            setLoading(false);
        }
    }, []);

    // Sign up or login
    const handleAuth = async (e) => {
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
            const endpoint =
                mode === "signup" ? "/signup" : "/login";

            const body = mode === "signup"
                ? { name, email, password, confirmPassword }
                : { email, password };

            const data = await apiRequest(
                `${AUTH_API}${endpoint}`,
                {
                    method: "POST",
                    body: JSON.stringify(body)
                },
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
            setSuccess("");
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Logout
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
        setMode("login");
    };

    // Refresh the task profile
    const fetchUsers = async () => {
        try {
            const data = await apiRequest(API);
            setUsers(data);
        } catch (err) {
            setError(err.message);
        }
    };

    // Edit profile name
    const editProfile = async () => {
        if (!users.length) return;

        const user = users[0];
        const newName = prompt("Enter your new name:", user.name);

        if (newName === null || !newName.trim()) return;

        try {
            const data = await apiRequest(`${API}/${user._id}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: newName.trim()
                })
            });

            setUsers([data]);
            setAccount({
                ...account,
                name: data.name
            });
            setSuccess("Profile updated successfully");
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    // Add a task
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
            setTasks({ ...tasks, [userId]: "" });
            setError("");
        } catch (err) {
            setError(err.message);
        }
    };

    // Update a task
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
        } catch (err) {
            setError(err.message);
        }
    };

    // Edit task title
    const editTask = async (user, todo) => {
        const newTitle = prompt("Edit your task:", todo.title);

        if (newTitle === null || !newTitle.trim()) return;

        await updateTask(user, todo, {
            title: newTitle.trim()
        });
    };

    // Complete or uncomplete a task
    const toggleTask = async (user, todo) => {
        await updateTask(user, todo, {
            completed: !todo.completed
        });
    };

    // Delete a task
    const deleteTask = async (user, todoId) => {
        if (!window.confirm("Delete this task?")) return;

        try {
            await apiRequest(
                `${API}/${user._id}/todos/${todoId}`,
                { method: "DELETE" }
            );

            await fetchUsers();
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

    // LOGIN AND SIGNUP SCREEN
    if (!token || !account) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-brand-icon">✓</div>

                    <span className="eyebrow">
                        DAILY TASK MANAGER
                    </span>

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
                            <button onClick={() => setError("")}>
                                ×
                            </button>
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
                                setMode(
                                    mode === "login" ? "signup" : "login"
                                );
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

    // LOGGED-IN DASHBOARD
    return (
        <div className="app">
            <header className="hero">
                <div className="hero-content">
                    <span className="eyebrow">
                        PLAN YOUR DAY BETTER
                    </span>

                    <h1>
                        Daily Task Manager <span>✓</span>
                    </h1>

                    <p>
                        Organize your tasks and make every day productive.
                    </p>

                    <div className="logged-in-label">
                        Logged in as <strong>{account.name}</strong>
                    </div>
                </div>

                <div className="hero-actions">
                    <button
                        className="secondary-btn"
                        onClick={editProfile}
                    >
                        ✎ Edit Profile
                    </button>

                    <button
                        className="logout-btn"
                        onClick={logout}
                    >
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

                <section className="users-section">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">
                                YOUR WORKSPACE
                            </span>
                            <h2>My Daily Tasks</h2>
                            <p className="dashboard-email">
                                {account.email}
                            </p>
                        </div>
                    </div>

                    {users.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">☀</div>
                            <h3>No task profile found</h3>
                            <p>Please log out and sign in again.</p>
                        </div>
                    ) : (
                        <div className="user-grid">
                            {users.map(user => (
                                <article className="user-card" key={user._id}>
                                    <div className="user-card-header">
                                        <div className="avatar">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="user-info">
                                            <h3>{user.name}</h3>
                                            <p>{user.email}</p>
                                        </div>
                                    </div>

                                    <div className="task-summary">
                                        <span>My daily tasks</span>
                                        <span className="task-count">
                                            {user.todos.filter(
                                                t => t.completed
                                            ).length}
                                            /{user.todos.length} completed
                                        </span>
                                    </div>

                                    <form
                                        className="task-form"
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
                                        />

                                        <button type="submit">Add</button>
                                    </form>

                                    <div className="task-list">
                                        {user.todos.length === 0 ? (
                                            <p className="no-tasks">
                                                No tasks yet. Add your first task!
                                            </p>
                                        ) : (
                                            user.todos.map(todo => (
                                                <div
                                                    className="task-item"
                                                    key={todo._id}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={todo.completed}
                                                        onChange={() =>
                                                            toggleTask(user, todo)
                                                        }
                                                    />

                                                    <span className={
                                                        todo.completed
                                                            ? "completed"
                                                            : ""
                                                    }>
                                                        {todo.title}
                                                    </span>

                                                    <div className="task-actions">
                                                        <button
                                                            title="Edit task"
                                                            onClick={() =>
                                                                editTask(user, todo)
                                                            }
                                                        >
                                                            ✎
                                                        </button>

                                                        <button
                                                            title="Delete task"
                                                            onClick={() =>
                                                                deleteTask(
                                                                    user,
                                                                    todo._id
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="progress-track">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: user.todos.length
                                                    ? `${
                                                        user.todos.filter(
                                                            t => t.completed
                                                        ).length /
                                                        user.todos.length * 100
                                                    }%`
                                                    : "0%"
                                            }}
                                        />
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <footer>
                <p>
                    Daily Task Manager · Built with React, Node.js,
                    MongoDB & Docker
                </p>
            </footer>
        </div>
    );
}

export default App;
