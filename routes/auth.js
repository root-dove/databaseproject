// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: '회원가입 실패' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ error: '사용자 없음' });

    const valid = await bcrypt.compare(password, users[0].password);
    if (!valid) return res.status(401).json({ error: '비밀번호 오류' });

    const token = jwt.sign({ id: users[0].id, username }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true }).json({ message: '로그인 성공' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로그인 실패' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token').json({ message: '로그아웃' });
});

// 현재 로그인 사용자 정보 확인
router.get('/me', verifyToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token').json({ message: '로그아웃' });
});

module.exports = router;
