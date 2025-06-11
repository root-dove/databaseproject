// routes/posts.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', async (req, res) => {
  const { page = 1, limit = 10, search = '', type = 'title' } = req.query;
  const offset = (page - 1) * limit;

  try {
    const whereClause = search
      ? type === 'comments'
        ? `WHERE p.id IN (SELECT post_id FROM comments WHERE content LIKE ?)`
        : `WHERE ${type === 'username' ? 'u.username' : 'p.' + type} LIKE ?`
      : '';

    const params = search ? [`%${search}%`, +limit, +offset] : [+limit, +offset];

    const postsQuery = `
      SELECT 
        p.id, p.title, p.created_at, u.username,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ${whereClause}
    `;

    const [posts] = await db.query(postsQuery, search ? [`%${search}%`, +limit, +offset] : [+limit, +offset]);
    const [[{ total }]] = await db.query(countQuery, search ? [`%${search}%`] : []);

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// 좋아요 토글 API
router.post('/:id/like', verifyToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const [exists] = await db.query(
      'SELECT * FROM likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    if (exists.length > 0) {
      await db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
    } else {
      await db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    }

    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: 'Like Toggle Failed' });
  }
});

// 게시글 삭제 API
router.delete('/:id', verifyToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const [post] = await db.query('SELECT * FROM posts WHERE id = ?', [postId]);
    if (post.length === 0) return res.status(404).json({ error: '글 없음' });
    if (post[0].user_id !== userId) return res.status(403).json({ error: '삭제 권한 없음' });

    await db.query('DELETE FROM posts WHERE id = ?', [postId]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: '삭제 실패' });
  }
});

// 댓글 작성 API
router.post('/:id/comments', verifyToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: '내용이 없습니다.' });

  try {
    await db.query(
      'INSERT INTO comments (content, user_id, post_id) VALUES (?, ?, ?)',
      [content, userId, postId]
    );
    res.sendStatus(201);
  } catch (err) {
    res.status(500).json({ error: '댓글 작성 실패' });
  }
});

// 댓글 삭제 API
router.delete('/:postId/comments/:commentId', verifyToken, async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    const [[comment]] = await db.query(
      'SELECT * FROM comments WHERE id = ? AND post_id = ?',
      [commentId, postId]
    );

    if (!comment) return res.status(404).json({ error: '댓글 없음' });
    if (comment.user_id !== userId) return res.status(403).json({ error: '삭제 권한 없음' });

    await db.query('DELETE FROM comments WHERE id = ?', [commentId]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: '댓글 삭제 실패' });
  }
});


router.post('/', verifyToken, async (req, res) => {
  const { title, content } = req.body;
  const userId = req.user.id;

  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
  }

  try {
    await db.query(
      'INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)',
      [title, content, userId]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '글 등록 실패' });
  }
});

// 게시글 상세 + 댓글 목록
router.get('/:id', async (req, res) => {
  const postId = req.params.id;

  try {
    const [[post]] = await db.query(`
      SELECT p.*, u.username,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [postId]);

    if (!post) return res.status(404).json({ error: '게시글 없음' });

    const [comments] = await db.query(`
    SELECT c.id, c.content, c.created_at, c.user_id, u.username
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
    `, [postId]);

    res.json({ post, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '상세 조회 실패' });
  }
});

module.exports = router;
