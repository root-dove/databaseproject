// app.js
const express = require('express');
const db = require('./db');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('MariaDB 연동 서버 정상 작동 중!');
});

// 예시 API: 사용자 목록 조회
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    console.error('DB 조회 에러:', err);
    res.status(500).send('DB Error');
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
