# 🎓 Steve - Adaptive AI Learning Platform

Steve is an advanced, AI-powered educational platform designed to provide a highly personalized and adaptive learning experience. By integrating real-time computer vision and machine learning, Steve monitors student engagement, cognitive load, and accessibility needs, ensuring that every learner receives the support they need to succeed.

## 🌟 Key Features

### 1. Real-Time Accessibility Intelligence (AI Track)
- **Emotion & Engagement Tracking**: Utilizes `DeepFace` and `MediaPipe` to analyze facial expressions and head poses, determining the student's emotional state, attention span, and overall engagement level.
- **Stress & Cognitive Load Monitoring**: Identifies indicators of high stress or cognitive overload, providing real-time insights and adaptive recommendations.
- **Accessibility Needs Detection**: Monitors visual strain (e.g., eye aspect ratio, blink rate), motor precision, and potential ADHD indicators (e.g., fidgeting, unstable focus) to recommend personalized accommodations (e.g., high contrast, shorter sessions).

### 2. Comprehensive PDF Analytics Reports
- Generates detailed, professional PDF reports at the end of each study session.
- Features dynamic, data-rich visualizations (graphs and charts) for Attention, Stress, Engagement, ADHD Risk, Visual Strain, and Cognitive Load.
- Provides actionable, personalized recommendations for optimizing the learning experience based on the session's data.

### 3. Career Fit & Skill Bridge (Intelligent Career Matching)
- **JD vs. Resume Deep Scan**: Performs an exhaustive comparison between a user's PDF resume and a Job Description, generating a comprehensive 'Fit Score'.
- **Exhaustive Requirement Extraction**: Identifies hard skills, soft skills, leadership requirements, and experience thresholds.
- **Automated Skill Bridge**: One-click redirection from identified skill gaps to the AI Course Builder. It automatically populates the course title, subject, and syllabus prompt with the exact context needed to close the professional gap.

### 4. AI-Powered Course Builder
- **Dynamic Curriculum Generation**: Uses LLMs to generate structured, multi-chapter courses on any subject in seconds.
- **Context-Aware Learning**: When bridged from the Career Fit page, the builder tunes the curriculum to specific industry requirements.

## 🛠️ Technology Stack

**Frontend:**
- React (Vite)
- TypeScript
- TailwindCSS
- Lucide React (Icons)

**Backend / AI Engine:**
- Python (Flask for the API server)
- Groq Cloud SDK (Llama 3 / Mixtral for high-speed analysis and course generation)
- OpenCV (Computer Vision)
- MediaPipe (Face mesh and landmark detection)
- DeepFace (Emotion recognition)
- PDF.js (Client-side resume parsing and text extraction)
- ReportLab & Matplotlib (PDF report generation and data visualization)
- Pandas & NumPy (Data processing)

## 🚀 Getting Started

### Prerequisites
- Node.js & npm (for frontend)
- Python 3.9+ (for AI backend)
- Anaconda (recommended for managing Python environments)

### 1. Backend Setup (AI Analytics Server)
Navigate to the root directory and install the Python dependencies:
```bash
pip install -r requirements.txt
```
Run the local Flask API server:
```bash
python "adaptive_accessibility (1).py" --server
```
*(The server will run on `http://127.0.0.1:8788`)*

### 2. Frontend Setup (Web Application)
Open a new terminal window, navigate to the web app directory, install dependencies, and start the development server:
```bash
cd steve/apps/web
npm install
npm run dev
```

## 📈 How It Works

1. **Start a Chapter**: Navigate to any course chapter in the web app.
2. **Enable AI Tracking**: Click the **"AI Track Session"** toggle. Ensure camera permissions are granted.
3. **Learn**: Proceed with your study session while the AI intelligently monitors your engagement and accessibility metrics in the background.
4. **Generate Report**: Once finished, click **"Stop Tracking"**. The system will automatically compile your session data, generate a comprehensive PDF analytics report and download it to your device.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License.
