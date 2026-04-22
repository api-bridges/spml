import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect('mongodb://localhost/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(rateLimit({ windowMs: 60000, max: 200 }));

// TODO: Define Mongoose models before the route handlers.
// The following models are referenced: User, Post
// Example:
//   const UserSchema = new mongoose.Schema({ /* fields */ }, { timestamps: true });
//   const User = mongoose.model('User', UserSchema);

const authRequired = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    const emailRegex = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    req.body.password = hashed;
    const user = await User.create({ ...req.body });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing required fields: email, password' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/me', authRequired, async (req, res) => {
  try {
    return res.json({ user: req.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const posts = await Post.find({}).skip((page - 1) * 10).limit(10);
    return res.json({ posts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/posts', authRequired, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Missing required fields: title, body' });
    const post = await Post.create({ ...req.body });
    return res.json({ post });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json({ post });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/posts/:id', authRequired, async (req, res) => {
  try {
    const { title, body } = req.body;
    await Post.updateOne({ _id: req.params.id }, { ...req.body });
    return res.json({ message: 'Success' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/posts/:id', authRequired, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Success' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});