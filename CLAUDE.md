# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Steve is a multi-component Python learning platform combining:

1. **Streamlit RAG App** ([app.py](app.py)) — Greek mythology-themed document Q&A with Gemini, plus audio (Hume TTS), video (Google Veo 3.0), flashcards, quizzes, PDF study guides, an educational game, and live accessibility analytics
2. **Adaptive Accessibility CV System** ([adaptive_accessibility.py](adaptive_accessibility.py)) — Real-time webcam tracking of emotions, attention, stress, ADHD indicators, and accessibility needs using MediaPipe + DeepFace
3. **Educational Maze Game** ([educational_game_fixed.py](educational_game_fixed.py)) — Pygame maze game generated from document content, with TTS narration and AI-scored open-ended answers

## Running the Applications

### Streamlit App
```bash
pip install -r requirements.txt
# Add GEMINI_API_KEY and HUME_API_KEY to .env
streamlit run app.py
streamlit run app.py --server.runOnSave=true   # dev mode with auto-reload
```

### CV Accessibility System (standalone)
```bash
python adaptive_accessibility.py   # interactive mode: camera / Flask demo / sample data
```

### Educational Game (launched automatically from app.py)
```bash
python educational_game_fixed.py <path/to/game_data.json>
```

## Required Environment Variables (.env)

```
GEMINI_API_KEY="..."   # Google Gemini API — required for all AI features
HUME_API_KEY="..."     # Hume AI — required for AudioBook TTS synthesis
```

## Architecture

### Streamlit App ([app.py](app.py))

- **Gemini model**: `gemini-2.5-pro` (configured in `setup_gemini()` at [app.py:41](app.py#L41))
- **Document pipeline**: `process_uploaded_file()` → PDF/DOCX/TXT extractors → Gemini RAG
- **Session state keys**: `messages`, `document_text`, `flashcards`, `quiz_questions`, `accessibility_tracker`, `accessibility_active`, `pdf_data`, `video_data`
- **Feature functions**: `generate_flashcards()`, `generate_quiz()`, `generate_document_roadmap()`, `generate_comprehensive_pdf()`, `generate_ai_video()`, `generate_accessibility_report()`, `launch_educational_game()`, `synthesize_audio_from_document()`
- **Accessibility integration**: Imports `AdaptiveLearningCV` and `FlaskAccessibilityAPI` from [adaptive_accessibility.py](adaptive_accessibility.py); the toggle in the header starts/stops live webcam tracking and auto-generates a PDF report on stop

### Adaptive Accessibility CV System ([adaptive_accessibility.py](adaptive_accessibility.py))

- **`AdaptiveLearningCV`** — core engine; holds MediaPipe face mesh / hands / pose, DeepFace emotion detection, and circular deque buffers for temporal analysis
- **`FlaskAccessibilityAPI`** — wrapper used by Streamlit (not an actual Flask server); manages camera thread, demo data simulation, and exposes analytics/graph methods
- **Dataclasses**: `LearningState` and `AccessibilityAssessment` hold per-frame computed scores
- **Analytics pipeline**: `process_frame()` → `_store_analytics_data()` → `generate_analytics_report()` → Plotly visualizations as JSON
- **Key computed scores**: stress level, attention score, engagement, fatigue, ADHD risk, visual strain, cognitive load

### Educational Maze Game ([educational_game_fixed.py](educational_game_fixed.py))

- Reads a JSON game data file (written to `tempfile.gettempdir()/zeuzy_game_data.json` by [app.py](app.py))
- Pygame window with a procedurally generated maze; nodes are flashcard, quiz, or goal types
- pyttsx3 TTS narrates the document summary at game start
- Final goal node uses Gemini to score the player's open-ended explanation

## Key Integration Points

| Entry point | Location |
|---|---|
| Gemini model setup | [app.py:41](app.py#L41) `setup_gemini()` |
| File processing | [app.py:68](app.py#L68) `process_uploaded_file()` |
| Accessibility toggle | [app.py:1670](app.py#L1670) — starts/stops `FlaskAccessibilityAPI` |
| CV engine class | [adaptive_accessibility.py:47](adaptive_accessibility.py#L47) `AdaptiveLearningCV` |
| Demo data generator | [adaptive_accessibility.py:1226](adaptive_accessibility.py#L1226) `simulate_demo_data()` |
| Game data path | `tempfile.gettempdir()/zeuzy_game_data.json` (written by [app.py:1200](app.py#L1200)) |

## Dependencies

Heavy ML stack — expect 1–2 GB download on first install.

- **Core**: `streamlit`, `google-generativeai`, `google-genai`, `python-dotenv`
- **Document**: `PyPDF2`, `python-docx`, `reportlab`
- **Audio/Video**: `hume`, `streamlit-lottie`, `moviepy`
- **CV/ML**: `opencv-python`, `mediapipe`, `deepface`, `tensorflow`, `tf-keras`, `scikit-learn`
- **Data/Viz**: `numpy`, `pandas`, `matplotlib`, `seaborn`, `plotly`
- **Game**: `pygame`, `pyttsx3`
- **Generative**: `diffusers`, `transformers`, `accelerate`, `torch`
