# TaskerADHD - Usage Guide

## 🎯 What is TaskerADHD?

TaskerADHD is an ADHD-friendly task management application with voice-to-task functionality, AI integration, and a user-friendly interface designed specifically for neurodivergent users.

## 🚀 How to Run TaskerADHD

### Option 1: Development Mode (Recommended)

**For the full experience with all features:**

1. **Download the source code** from GitHub
2. **Install Node.js** (if not already installed): https://nodejs.org/
3. **Open terminal** in the TaskerADHD folder
4. **Run the startup script**:
   - **Windows**: Double-click `start-taskeradhd.bat`
   - **Mac/Linux**: Run `./setup.sh` then `npm run dev`

This will automatically:
- Install all dependencies
- Start the backend server (port 3001)
- Start the frontend server (port 3000)  
- Launch the Electron desktop app

### Option 2: Electron Installer

**For a simple desktop app experience:**

1. **Download and install** `TaskerADHD-Setup-1.0.0.exe`
2. **Run the development servers first**:
   - Download the source code
   - Run `npm run dev` in the TaskerADHD folder
3. **Launch the installed app** - it will connect to your running servers

## ⚡ Features

- **Voice Capture**: Record voice memos and convert to tasks
- **AI Task Shaping**: OpenAI integration for smart task creation
- **Kanban Boards**: Visual task management
- **Energy-Based Filtering**: Match tasks to your energy level
- **Focus Mode**: Minimize distractions
- **Time Boxing**: Built-in Pomodoro timer
- **Dark/Light/Low-Stim Themes**: Sensory-friendly options

## 🔧 Configuration

### API Keys (Optional)

To use voice features and AI task creation:

1. **Deepgram API Key** (for voice transcription)
   - Get from: https://deepgram.com/
   - Add in Settings page

2. **OpenAI API Key** (for AI task processing)
   - Get from: https://platform.openai.com/
   - Add in Settings page

### Database

The app uses PostgreSQL. Default connection is:
- Host: localhost
- Port: 5432
- Database: taskeradhd

## 🆘 Troubleshooting

### Common Issues

**"Server Startup Failed"**
- Make sure Node.js is installed
- Run `npm install` in the project folder
- Check ports 3000 and 3001 are available

**"Cannot find module"**
- Delete `node_modules` folder
- Run `npm install` again

**"Voice services not initialized"**
- Add Deepgram API key in Settings
- Make sure microphone permissions are granted

### Getting Help

1. Check the implementation docs at `/docs` in the app
2. Look for error messages in the console
3. Try restarting the servers

## 📝 Development

**Project Structure:**
- `client/` - Next.js frontend
- `server/` - Node.js/Express backend  
- `electron/` - Electron desktop app wrapper

**Commands:**
- `npm run dev` - Start all development servers
- `npm run dist:win` - Build Windows installer
- `npm install` - Install dependencies

## 🎯 Next Steps

1. Start with the basic task management features
2. Add your API keys for voice and AI features
3. Customize themes and settings for your needs
4. Explore the focus mode and energy filtering

Enjoy using TaskerADHD! 🧠✨
