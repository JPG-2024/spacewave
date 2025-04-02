import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(__dirname);
const app = express();

// Enable CORS for all routes
const corsOptions = {
  origin: 'http://localhost:5173', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));

const AUDIO_FOLDER = path.join(__dirname, '..', 'mp3s');

// Ensure downloads directory exists
if (!fs.existsSync(AUDIO_FOLDER)) {
  fs.mkdirSync(AUDIO_FOLDER, { recursive: true });
}

app.use(express.json());
app.use(express.static(AUDIO_FOLDER));

// Initialize SQLite database
const db = new sqlite3.Database('./backend/music.db', err => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run(
      `
            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                yt_link TEXT UNIQUE,
                file_name TEXT,
                downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `,
      err => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      },
    );
  }
});

app.get('/files', (req, res) => {
  fs.readdir(AUDIO_FOLDER, (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan directory: ' + err);
    }

    const filePairs = files.reduce((acc, file) => {
      if (file.endsWith('.mp3')) {
        const baseName = path.basename(file, '.mp3');
        const thumbnail = `${baseName}.webp`;
        acc.push({
          mp3: file,
          thumbnail: files.includes(thumbnail) ? thumbnail : null, // Include null if thumbnail doesn't exist
        });
      }
      return acc;
    }, []);


    res.json(filePairs.reverse());
  });
});

app.post('/download', (req, res) => {
  const { yt_link } = req.body;

  if (!yt_link) {
    return res.status(400).send('You must provide a YouTube link.');
  }

  // Check if the URL is already downloaded
  db.get('SELECT * FROM downloads WHERE yt_link = ?', [yt_link], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).send('Database error.');
    }

    if (row) {
      return res.status(400).send('This video has already been downloaded.');
    }

    const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 "${yt_link.replace(/"/g, '\\"')}" -o "${AUDIO_FOLDER.replace(/"/g, '\\"')}/%(title)s.%(ext)s" --write-thumbnail`;
    exec(command, { cwd: AUDIO_FOLDER }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return res.status(500).send('Failed to download video.');
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
      }
      console.log(`Stdout: ${stdout}`);

      // Extract file name from stdout (you may need to adjust this based on yt-dlp output)
      const fileNameMatch = stdout.match(/Destination: (.+\.mp3)/);
      const fileName = fileNameMatch ? path.basename(fileNameMatch[1]) : null;

      if (fileName) {
        // Insert the downloaded URL into the database
        db.run(
          'INSERT INTO downloads (yt_link, file_name) VALUES (?, ?)',
          [yt_link, fileName],
          err => {
            if (err) {
              console.error('Error inserting into database:', err.message);
            }
          },
        );
      }

      res.status(200).send({});
    });
  });
});

app.delete('/delete', (req, res) => {
  const { fileName } = req.body;

  if (!fileName) {
    return res.status(400).send('You must provide a file name.');
  }

  const mp3Path = path.join(AUDIO_FOLDER, fileName);
  const thumbnailPath = path.join(
    AUDIO_FOLDER,
    `${path.basename(fileName, '.mp3')}.webp`,
  );

  // Delete the MP3 file
  fs.unlink(mp3Path, err => {
    if (err) {
      console.error(`Error deleting MP3 file: ${err.message}`);
      return res.status(500).send('Failed to delete MP3 file.');
    }

    // Delete the thumbnail file
    fs.unlink(thumbnailPath, err => {
      if (err && err.code !== 'ENOENT') {
        console.error(`Error deleting thumbnail: ${err.message}`);
        return res.status(500).send('Failed to delete thumbnail.');
      }

      // Remove the entry from the database
      db.run('DELETE FROM downloads WHERE file_name = ?', [fileName], err => {
        if (err) {
          console.error('Error deleting from database:', err.message);
          return res.status(500).send('Failed to delete database entry.');
        }

        console.log(`Deleted ${fileName} and its thumbnail from the database.`);
        res.status(200).send({});
      });
    });
  });
});

app.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});
