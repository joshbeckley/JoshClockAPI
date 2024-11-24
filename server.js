const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const { v4: uuidv4 } = require('uuid');

const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors()); 

// File to store alarms
const ALARMS_FILE = 'alarms.json';

// Read all alarms from database
const readAlarms = () => {
    if (!fs.existsSync(ALARMS_FILE)) {
        fs.writeFileSync(ALARMS_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(ALARMS_FILE, 'utf8'));
};

// Write all data to database
const writeAlarms = (data) => {
    fs.writeFileSync(ALARMS_FILE, JSON.stringify(data, null, 2));
};

// Route to get all alarms
app.get('/alarms', (req, res) => {
    const db = readAlarms();
    res.json(db);
});

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

app.get('/alarms/current', (req, res) => {
    const db = readAlarms();

    // Vercel uses UTC time - so convert to UTC+2
    // TODO: convert when in production
    let currentDate = new Date(); // Get the current date and time
    // currentDate.setHours(currentDate.getHours() + 2); // Convert to UTC+2 time
    
    let currentDay = days[currentDate.getDay()]; // Get the current day of the week (0-6)

    for (const [date, alarmList] of Object.entries(db)) {
        alarmList.forEach(alarm => {
            if (alarm.day === currentDay) {  // Compare the current day to the alarm's day
                let alarmDate = new Date(date);  // Convert the string date to a Date object
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
    };

    return res.status(200).json({ isAlarm: false, alarm: null}); 
    
});


// Route to add an alarm for a specific day
app.post('/alarms', (req, res) => {
    const { date, time, label } = req.body;
    if (!date || !time) {
        return res.status(400).json({ error: 'Date and time are required.' });
    }

    const alarms = readAlarms();
    if (!alarms[date]) {
        alarms[date] = [];
    }

    d = new Date(date);

    const newAlarm = {
        id: uuidv4(), // Generate a unique ID
        time,
        label: label || 'No label',
        day: days[d.getDay()],
        active: true
    };

    alarms[date].push(newAlarm);
    writeAlarms(alarms);

    res.status(201).json({ message: 'Alarm added successfully.', alarm: newAlarm });
});

// Route to delete alarm
app.delete('/alarms', (req, res) => {
    const { id, date } = req.body;
    if (!id || !date) {
        return res.status(400).json({ error: 'ID and date are required to delete an alarm.' });
    }

    const alarms = readAlarms();
    if (!alarms[date]) {
        return res.status(404).json({ error: 'No alarms found for this date.' });
    }

    const originalLength = alarms[date].length;
    alarms[date] = alarms[date].filter((alarm) => alarm.id != id);

    if (originalLength === alarms[date].length) {
        return res.status(404).json({ error: 'No alarm found with the provided ID.' });
    }

    if (alarms[date].length === 0) {
        delete alarms[date];
    }

    writeAlarms(alarms);
    res.json({ message: 'Alarm deleted successfully.' });
});


// Route to clear all alarms for a specific date
app.delete('/alarms/:date', (req, res) => {
    const { date } = req.params;

    const db = readAlarms();
    if (!db[date]) {
        return res.status(404).json({ error: 'No alarms found for this date.' });
    }

    delete db[date];
    writeAlarms(db);

    res.json({ message: `All alarms for ${date} deleted successfully.` });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
