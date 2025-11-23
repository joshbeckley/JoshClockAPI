const { DateTime } = require('luxon');
const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const { v4: uuidv4 } = require('uuid');

const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

const { Pool } = require('pg');

let lastTimeChecked = "None"

// Replace with your Neon connection details
const pool = new Pool({
  connectionString: 'postgres://neondb_owner:INHKb2wQJ3Yk@ep-polished-violet-a23xv7vs-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

  
// Middleware
app.use(bodyParser.json());
app.use(cors()); 

// Read all alarms from database
async function readAlarms() {
    try {
      const result = await pool.query('SELECT * FROM alarms');
      data = result.rows; // `rows` is an array of objects
      console.log("[SERVER]: Read all alarms");
      return data; // You can now use this data as a JavaScript object
    } catch (error) {
      console.error('[SERVER]: Error fetching data:', error);
      return null; // Handle errors gracefully
    }
  }

app.get('/', (req, res) => {
  console.log("[SERVER]: Online");
  res.send(`Server Is Online - /alarms/current/today called: ${lastTimeChecked}`);
});

app.get('/alarms', async (req, res) => {
    try {
        const db = await readAlarms(); // Wait for the promise to resolve
        res.json(db); // Sends the resolved array as JSON
        console.log("[SERVER]: Sent all alarms");
    } catch (error) {
        console.error('[SERVER]: Error fetching alarms:', error);
        res.status(500).json({ error: 'Failed to fetch alarms' }); // Handle errors gracefully
    }
});

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatReadableDate(date = DateTime.now()) {
  return date.setZone('Africa/Johannesburg').toFormat('dd LLL yyyy, HH:mm');
}

app.get('/alarms/current/today', async (req, res) => {
  try {
      const db = await readAlarms();
      const currentDate = DateTime.now().setZone('Africa/Johannesburg');
      const currentDay = days[currentDate.weekday % 7];

      lastTimeChecked = formatReadableDate(currentDate);
      console.log("[SERVER]: set last time: ", lastTimeChecked);
      const alarm = db.find(alarm => alarm.day === currentDay); // Find the first alarm for today

      if (alarm) {
          return res.status(201).json({ isAlarm: true, alarm });
      }

      res.status(200).json({ isAlarm: false, alarm: null }); 
  } catch (error) {
      console.error('[SERVER]: Error fetching alarms:', error);
      res.status(500).json({ error: 'Failed to fetch alarms' });
  }
});


async function insertAlarm(alarm) {
    const query = `
      INSERT INTO alarms (id, time, label, day, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`;
    const values = [alarm.id, alarm.time, alarm.label, alarm.day, alarm.active];
  
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('[SERVER]: Error inserting alarm:', error);
      throw error; // Re-throw the error to handle it upstream if needed
    }
  }

// Route to add an alarm for a specific day
app.post('/alarms', async (req, res) => {
    const { date, time, label } = req.body;
    if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required.' });
    }

    const alarms = readAlarms();
    if (!alarms[date]) {
        alarms[date] = [];
    }

    d = new Date(date);

    const alarm = {
        id: uuidv4(), // Generate a unique ID
        time,
        label: label || 'No label',
        day: days[d.getDay()],
        active: true
    };
    try {
        const newAlarm = await insertAlarm(alarm);
        res.json({ success: true, message: 'Alarm inserted successfully', alarm: newAlarm });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error inserting alarm', error: error.message });
    }
});


async function deleteAlarmById(alarmId) {
    const query = 'DELETE FROM alarms WHERE id = $1 RETURNING *'; // Use RETURNING to confirm deletion
    try {
      const result = await pool.query(query, [alarmId]);
      if (result.rowCount > 0) {
        console.log('[SERVER]: Alarm deleted successfully:', result.rows[0]); // Log the deleted record
        return result.rows[0];
      } else {
        console.log('[SERVER]: No alarm found with the given ID.');
        return null;
      }
    } catch (error) {
      console.error('[SERVER]: Error deleting alarm:', error);
      throw error; // Re-throw the error to handle it upstream if needed
    }
  }

// Route to delete alarm
app.delete('/alarms', async (req, res) => {
    const {id} = req.body
    console.log(id)
    try {
      const deletedAlarm = await deleteAlarmById(id);
      if (deletedAlarm) {
        res.json({ success: true, message: 'Alarm deleted successfully', alarm: deletedAlarm });
      } else {
        res.status(404).json({ success: false, message: 'Alarm not found' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting alarm', error: error.message });
    }
  });



// Start the server
app.listen(PORT, () => {
    console.log(`[SERVER]: Server running at http://localhost:${PORT}`);
});
