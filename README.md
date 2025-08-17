# TaskerADHD 🧠✨

An ADHD-friendly task management application with voice capture, AI assistance, and thoughtful UX design.

![TaskerADHD Screenshot](assets/screenshot.png)

## Features 🚀

- **🎤 Voice Capture**: Push-to-talk voice recording with real-time transcription
- **🤖 AI Task Creation**: Automatically shape voice notes into actionable tasks
- **📋 Kanban Boards**: Visual task management with drag-and-drop
- **🎯 Focus Mode**: Minimize distractions and stay on track
- **⚡ Energy-Aware**: Tag tasks by energy level required
- **🌙 Dark Mode**: Easy on the eyes with multiple theme options
- **📱 Responsive**: Works on desktop and mobile devices

## Tech Stack 💻

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **AI/Voice**: OpenAI GPT-4, Deepgram STT
- **Desktop**: Electron

## Prerequisites 📋

- Node.js 18+ 
- PostgreSQL 14+
- Git

## Quick Start 🏃‍♂️

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TaskerADHD.git
   cd TaskerADHD
   ```

2. **Run the setup script**
   
   **Windows (PowerShell)**:
   ```powershell
   ./setup.ps1
   ```
   
   **Mac/Linux**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `server/.env`
   - Add your API keys and database credentials
   - Get API keys from:
     - [Deepgram Console](https://console.deepgram.com/)
     - [OpenAI Platform](https://platform.openai.com/api-keys)

4. **Start development servers**
   ```bash
   npm run dev
   ```

5. **Open the app**
   - Web: http://localhost:3000
   - Electron: Automatically opens

## Building for Production 🏗️

### Desktop Application (Electron)

**Windows**:
```bash
npm run dist:win
```

**macOS**:
```bash
npm run dist:mac
```

**Linux**:
```bash
npm run dist:linux
```

The built executables will be in the `dist` folder.

### Web Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy the `client/out` folder to your static host (Vercel, Netlify, etc.)
3. Deploy the server to your Node.js host (Railway, Heroku, etc.)

## Project Structure 📁

```
TaskerADHD/
├── client/           # Next.js frontend
│   ├── src/
│   │   ├── app/     # App routes and pages
│   │   ├── components/
│   │   ├── services/
│   │   └── stores/  # Zustand state management
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── middleware/
│   └── prisma/      # Database schema
├── electron/        # Desktop app wrapper
└── assets/          # Icons and resources
```

## Development 👩‍💻

### Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build for production
- `npm run dist` - Build desktop executables
- `npm run test` - Run tests

### Key Technologies

- **Voice Processing**: Web Audio API, AudioWorklet
- **Real-time**: WebSockets for live transcription
- **State Management**: Zustand
- **Styling**: Tailwind CSS with custom ADHD-friendly themes
- **Database**: Prisma ORM with PostgreSQL

## Contributing 🤝

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments 🙏

- Built with love for the ADHD community
- Inspired by the need for better task management tools
- Thanks to all contributors and testers

## Support 💬

- [Report Issues](https://github.com/yourusername/TaskerADHD/issues)
- [Discussions](https://github.com/yourusername/TaskerADHD/discussions)
- [Wiki](https://github.com/yourusername/TaskerADHD/wiki)

---

Made with ❤️ by the TaskerADHD team