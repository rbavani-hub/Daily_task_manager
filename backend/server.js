
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Add it to docker-compose.yml.");
}

// MongoDB connection
const MONGO_HOST = process.env.MONGO_HOST || "mongodb";
const MONGO_USER = process.env.MONGO_USER;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;

const mongoUri = (MONGO_USER && MONGO_PASSWORD)
    ? `mongodb://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@${MONGO_HOST}:27017/internship_db?authSource=admin`
    : `mongodb://${MONGO_HOST}:27017/internship_db`;

mongoose.connect(mongoUri)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch(err => console.error("MongoDB Error:", err));

// Todo schema
const todoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Login account schema
const accountSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const Account = mongoose.model("Account", accountSchema);

// Task owner schema
// accountId connects a task list to its login account.
const userSchema = new mongoose.Schema({
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true
    },
    todos: [todoSchema]
});

const User = mongoose.model("User", userSchema);

// Create JWT token
function createToken(account) {
    return jwt.sign(
        { accountId: account._id },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

// Protect routes: require a valid login token
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Please log in first" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.accountId = decoded.accountId;
        next();
    } catch (error) {
        return res.status(401).json({
            error: "Your session has expired. Please log in again."
        });
    }
}

// Find the logged-in user's task list
async function getOwnUser(req) {
    return User.findOne({ accountId: req.accountId });
}

// Backend status
app.get("/api", (req, res) => {
    res.json({ message: "Daily Todo Manager API is working!" });
});

// SIGN UP
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({
                error: "Name, email and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: "Password must contain at least 8 characters"
            });
        }

        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({
                error: "Passwords do not match"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingAccount = await Account.findOne({
            email: normalizedEmail
        });

        if (existingAccount) {
            return res.status(409).json({
                error: "An account with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const account = await Account.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        try {
            const user = await User.create({
                accountId: account._id,
                name: account.name,
                email: account.email,
                todos: []
            });

            const token = createToken(account);

            res.status(201).json({
                message: "Account created successfully",
                token,
                user
            });
        } catch (error) {
            await Account.findByIdAndDelete(account._id);
            throw error;
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: "An account with this email already exists"
            });
        }

        console.error("Signup error:", error);
        res.status(500).json({ error: "Could not create account" });
    }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email?.trim() || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const account = await Account.findOne({
            email: email.trim().toLowerCase()
        });

        if (!account) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            account.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const user = await getOwnUser({
            accountId: account._id
        });

        if (!user) {
            return res.status(404).json({
                error: "Task profile not found"
            });
        }

        const token = createToken(account);

        res.json({
            message: "Login successful",
            token,
            user
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Could not log in" });
    }
});

// GET CURRENT LOGGED-IN ACCOUNT
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const account = await Account.findById(req.accountId)
            .select("-password");

        const user = await getOwnUser(req);

        if (!account || !user) {
            return res.status(404).json({
                error: "Account or task profile not found"
            });
        }

        res.json({ account, user });
    } catch (error) {
        res.status(500).json({ error: "Could not load account" });
    }
});

// GET ONLY THE LOGGED-IN USER'S TASK PROFILE
// Returns an array to make frontend integration easier.
app.get("/api/users", authenticateToken, async (req, res) => {
    try {
        const user = await getOwnUser(req);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json([user]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EDIT OWN PROFILE
app.put("/api/users/:id", authenticateToken, async (req, res) => {
    try {
        const user = await getOwnUser(req);

        if (!user || user._id.toString() !== req.params.id) {
            return res.status(404).json({ error: "User not found" });
        }

        if (req.body.name !== undefined) {
            if (!req.body.name.trim()) {
                return res.status(400).json({
                    error: "Name cannot be empty"
                });
            }

            user.name = req.body.name.trim();
        }

        await user.save();

        await Account.findByIdAndUpdate(req.accountId, {
            name: user.name
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD A TASK TO THE LOGGED-IN USER'S LIST
app.post("/api/users/:id/todos", authenticateToken, async (req, res) => {
    try {
        const user = await getOwnUser(req);

        if (!user || user._id.toString() !== req.params.id) {
            return res.status(404).json({ error: "User not found" });
        }

        const { title } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({
                error: "Task title is required"
            });
        }

        user.todos.push({ title: title.trim() });
        await user.save();

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EDIT A TASK
app.put(
    "/api/users/:userId/todos/:todoId",
    authenticateToken,
    async (req, res) => {
        try {
            const user = await getOwnUser(req);

            if (!user || user._id.toString() !== req.params.userId) {
                return res.status(404).json({ error: "User not found" });
            }

            const todo = user.todos.id(req.params.todoId);

            if (!todo) {
                return res.status(404).json({ error: "Task not found" });
            }

            if (req.body.title !== undefined) {
                if (!req.body.title.trim()) {
                    return res.status(400).json({
                        error: "Task title cannot be empty"
                    });
                }

                todo.title = req.body.title.trim();
            }

            if (req.body.completed !== undefined) {
                todo.completed = req.body.completed;
            }

            await user.save();
            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// DELETE A TASK
app.delete(
    "/api/users/:userId/todos/:todoId",
    authenticateToken,
    async (req, res) => {
        try {
            const user = await getOwnUser(req);

            if (!user || user._id.toString() !== req.params.userId) {
                return res.status(404).json({ error: "User not found" });
            }

            const todo = user.todos.id(req.params.todoId);

            if (!todo) {
                return res.status(404).json({ error: "Task not found" });
            }

            todo.deleteOne();
            await user.save();

            res.json({ message: "Task deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

const PORT = 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
});
