const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const { v4: uuidv4 } = require('uuid');

const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

const { Pool } = require('pg');

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
      const result = await pool.query('SELECT * FROM neon_data');
      data = result.rows; // `rows` is an array of objects
      return data; // You can now use this data as a JavaScript object
    } catch (error) {
      console.error('Error fetching data:', error);
      return null; // Handle errors gracefully
    }
  }

// Write all data to database
const writeAlarms = (data) => {
    fs.writeFileSync(ALARMS_FILE, JSON.stringify(data, null, 2));
};

app.get('/', (req, res) => {
    res.send('Server Is Online');
});

app.get('/alarms', async (req, res) => {
    try {
        const db = await readAlarms(); // Wait for the promise to resolve
        res.json(db); // Sends the resolved array as JSON
    } catch (error) {
        console.error('Error fetching alarms:', error);
        res.status(500).json({ error: 'Failed to fetch alarms' }); // Handle errors gracefully
    }
});

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// TODO: DOESNT WORK
app.get('/alarms/current', async (req, res) => {
    try {
        const db = await readAlarms(); // Wait for the promise to resolve

            // Vercel uses UTC time - so convert to UTC+2
        // TODO: convert when in production
        let currentDate = new Date(); // Get the current date and time
        // currentDate.setHours(currentDate.getHours() + 2); // Convert to UTC+2 time
        
        let currentDay = days[currentDate.getDay()]; // Get the current day of the week (0-6)
        console.log(db)
        
        db.forEach(alarm => {
            if (alarm.day === currentDay) {  // Compare the current day to the alarm's day
                let alarmDate = new Date(alarm.date);  // Convert the string date to a Date object
                const [hours, minutes] = alarm.time.split(":").map(Number);
                alarmDate.setHours(hours);
                alarmDate.setMinutes(minutes);
                alarmDate.setSeconds(0);

                const diff = alarmDate - currentDate; // Difference in milliseconds
                if (diff <= 60000 && diff > 0) { // Check if the alarm is within 1 minute
                    return res.status(201).json({ isAlarm: true, alarm: alarm});
                }
            }
        });
        

        return res.status(200).json({ isAlarm: false, alarm: null}); 
    } catch (error) {
        console.error('Error fetching alarms:', error);
        res.status(500).json({ error: 'Failed to fetch alarms' }); // Handle errors gracefully
    }

    
    
});


app.get('/alarms/current/today', async (req, res) => {
  try {
      const db = await readAlarms(); // Wait for the promise to resolve

          // Vercel uses UTC time - so convert to UTC+2
      // TODO: convert when in production
      let currentDate = new Date(); // Get the current date and time
      currentDate.setHours(currentDate.getHours() + 2); // Convert to UTC+2 time
      
      let currentDay = days[currentDate.getDay()]; // Get the current day of the week (0-6)
      console.log(db)
      
      db.forEach(alarm => {
          if (alarm.day === currentDay) {  // Compare the current day to the alarm's day
            return res.status(201).json({ isAlarm: true, alarm: alarm, currentTime: currentDate.getTime()});
          }
      });
      

      return res.status(200).json({ isAlarm: false, alarm: null}); 
  } catch (error) {
      console.error('Error fetching alarms:', error);
      res.status(500).json({ error: 'Failed to fetch alarms' }); // Handle errors gracefully
  }

  
  
});


async function insertAlarm(alarm) {
    const query = `
      INSERT INTO neon_data (id, time, label, day, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`;
    const values = [alarm.id, alarm.time, alarm.label, alarm.day, alarm.active];
  
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error inserting alarm:', error);
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
    const query = 'DELETE FROM neon_data WHERE id = $1 RETURNING *'; // Use RETURNING to confirm deletion
    try {
      const result = await pool.query(query, [alarmId]);
      if (result.rowCount > 0) {
        console.log('Alarm deleted successfully:', result.rows[0]); // Log the deleted record
        return result.rows[0];
      } else {
        console.log('No alarm found with the given ID.');
        return null;
      }
    } catch (error) {
      console.error('Error deleting alarm:', error);
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
    console.log(`Server running at http://localhost:${PORT}`);
});
