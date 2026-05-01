import streamlit as st
from dotenv import load_dotenv
import os
import sys
import re
import json
import PyPDF2
import docx
from io import BytesIO
import requests
from streamlit_lottie import st_lottie
from typing import Dict, Any
# Note: Google Imagen API requires separate installation and setup
from PIL import Image
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image as RLImage
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfgen import canvas
import tempfile
import json
import time
from google import genai as google_genai
from google.genai import types
from datetime import datetime
import threading
import plotly.graph_objs as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import base64
from adaptive_accessibility import AdaptiveLearningCV, FlaskAccessibilityAPI
import subprocess
import threading

load_dotenv()

# ── HuggingFace Inference API configuration ───────────────────────────────────
from huggingface_hub import InferenceClient as _HFClient
from gtts import gTTS as _gTTS

# Best free models verified working on HuggingFace free tier
MODEL_GENERAL = "Qwen/Qwen2.5-7B-Instruct"          # Q&A, summaries, narration, roadmap
MODEL_JSON    = "Qwen/Qwen2.5-7B-Instruct"           # Flashcards, quiz, MCQs (JSON)
MODEL_IMAGE   = "black-forest-labs/FLUX.1-schnell"   # Fast image generation (verified)

def _hf_client() -> _HFClient:
    api_key = os.getenv("HUGGINGFACE_API_KEY")
    if not api_key:
        raise ValueError("HUGGINGFACE_API_KEY not set in .env")
    return _HFClient(api_key=api_key)

def call_hf(prompt: str, model: str = MODEL_GENERAL, max_tokens: int = 2048) -> str:
    """Send a chat prompt via HuggingFace InferenceClient and return the response text."""
    client = _hf_client()
    result = client.chat_completion(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        max_tokens=max_tokens,
    )
    return result.choices[0].message.content

def generate_image_hf(prompt: str):
    """Generate an image via FLUX.1-schnell; returns a PIL Image or None."""
    try:
        client = _hf_client()
        return client.text_to_image(prompt, model=MODEL_IMAGE)
    except Exception:
        return None

def check_hf() -> bool:
    """Return True if the HuggingFace key is configured, else show an error."""
    if not os.getenv("HUGGINGFACE_API_KEY"):
        st.error("Please set your HUGGINGFACE_API_KEY in the .env file")
        return False
    return True

def extract_text_from_pdf(pdf_file):
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

def extract_text_from_docx(docx_file):
    doc = docx.Document(docx_file)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text

def extract_text_from_txt(txt_file):
    return str(txt_file.read(), "utf-8")

def process_uploaded_file(uploaded_file):
    if uploaded_file is not None:
        file_extension = uploaded_file.name.split(".")[-1].lower()

        if file_extension == "pdf":
            return extract_text_from_pdf(uploaded_file)
        elif file_extension == "docx":
            return extract_text_from_docx(uploaded_file)
        elif file_extension == "txt":
            return extract_text_from_txt(uploaded_file)
        else:
            st.error("Unsupported file format. Please upload PDF, DOCX, or TXT files.")
            return None
    return None

def load_lottieurl(url: str):
    r = requests.get(url)
    if r.status_code != 200:
        return None
    return r.json()

def synthesize_audio_from_document():
    """Synthesize audio from document content using gTTS (Google TTS, free, no key needed)."""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        text_to_synthesize = st.session_state.document_text[:2000].strip()
        tts = _gTTS(text=text_to_synthesize, lang="en", slow=False)
        buf = BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)

        st.session_state.audio_data = buf.read()
        st.session_state.show_audio_player = True

        st.session_state.messages.append({
            "role": "assistant",
            "content": "🎵 **AudioBook Generated!**\n\nI've synthesized the document content into audio. Use the player below to listen or download the MP3."
        })

        return True

    except Exception as e:
        st.error(f"Error generating audio: {str(e)}")
        return False

# ── AssemblyAI voice transcription ───────────────────────────────────────────
import assemblyai as _aai

def transcribe_audio_assemblyai(audio_bytes: bytes) -> str | None:
    """Write audio to a temp WAV file and transcribe with the AssemblyAI SDK."""
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        st.error("Please set your ASSEMBLYAI_API_KEY in the .env file")
        return None

    _aai.settings.api_key = api_key

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        transcriber = _aai.Transcriber()
        transcript = transcriber.transcribe(tmp_path)

        if transcript.status == _aai.TranscriptStatus.error:
            st.error(f"AssemblyAI transcription failed: {transcript.error}")
            return None

        return transcript.text or ""
    except Exception as e:
        st.error(f"Transcription error: {e}")
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

def generate_document_roadmap():
    """Generate a visual text-based roadmap of the document content"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        if not check_hf():
            return False

        roadmap_prompt = f"""
        Analyze the following document and create a visual ASCII-style roadmap using emojis and text.
        Create a clear pathway showing the main concepts, flow, and structure of the document.
        Use arrows (→, ↓), emojis, and formatting to create a visual journey.

        Format it like this example:
        🏁 START: [Main Topic]
        ↓
        📍 STEP 1: [First Key Concept]
        ↓
        📍 STEP 2: [Second Key Concept]
        ↓
        🎯 GOAL: [Final Outcome/Conclusion]

        Document Content:
        {st.session_state.document_text[:2000]}...

        Create a comprehensive visual roadmap with emojis, arrows, and clear structure (max 500 words).
        """

        roadmap_content = call_hf(roadmap_prompt, MODEL_GENERAL)

        # Add the roadmap to chat
        st.session_state.messages.append({
            "role": "assistant",
            "content": f"🗺️ **Document Roadmap Generated!**\n\nHere's a visual roadmap of your document's content and structure:\n\n```\n{roadmap_content}\n```"
        })

        return True

    except Exception as e:
        st.error(f"Error generating roadmap: {str(e)}")
        return False

def generate_flashcards():
    """Generate flashcards from document content"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        if not check_hf():
            return False

        flashcards_prompt = f"""
        Create 10 educational flashcards based on the following document content.
        Format each flashcard as a JSON object with "question" and "answer" fields.
        Make questions that test understanding, key concepts, and important details.
        Keep questions clear and concise, answers should be informative but not too long.

        Document Content:
        {st.session_state.document_text[:3000]}...

        Respond with ONLY a valid JSON array of flashcard objects like this:
        [
            {{"question": "What is...?", "answer": "The answer is..."}},
            {{"question": "How does...?", "answer": "It works by..."}}
        ]

        Generate exactly 10 flashcards.
        """

        flashcards_text = call_hf(flashcards_prompt, MODEL_JSON)

        # Clean up the response to extract JSON
        import json
        try:
            # Remove any markdown formatting
            if "```json" in flashcards_text:
                flashcards_text = flashcards_text.split("```json")[1].split("```")[0]
            elif "```" in flashcards_text:
                flashcards_text = flashcards_text.split("```")[1].split("```")[0]

            flashcards_data = json.loads(flashcards_text.strip())

            # Store flashcards in session state
            st.session_state.flashcards = flashcards_data
            st.session_state.current_card = 0
            st.session_state.show_flashcards = True
            st.session_state.show_answer = False

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"📚 **Flashcards Generated!**\n\nI've created {len(flashcards_data)} flashcards based on your document. Click the flashcard popup to start studying!"
            })

            return True

        except json.JSONDecodeError:
            st.error("Error parsing flashcards. Please try again.")
            return False

    except Exception as e:
        st.error(f"Error generating flashcards: {str(e)}")
        return False

@st.dialog("📚 Study Flashcards")
def show_flashcards_popup():
    """Display flashcards in a popup dialog"""
    if 'flashcards' not in st.session_state or not st.session_state.flashcards:
        st.error("No flashcards available!")
        return

    flashcards = st.session_state.flashcards
    current_card = st.session_state.get('current_card', 0)
    show_answer = st.session_state.get('show_answer', False)

    # Progress indicator
    st.progress((current_card + 1) / len(flashcards))
    st.write(f"Card {current_card + 1} of {len(flashcards)}")

    # Card container with styling
    with st.container():
        st.markdown("""
        <style>
        .flashcard {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 20px 0;
            color: white;
            min-height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .flashcard h3 {
            color: white !important;
            margin: 0;
        }
        </style>
        """, unsafe_allow_html=True)

        if not show_answer:
            # Show question
            st.markdown(f"""
            <div class="flashcard">
                <h3>❓ {flashcards[current_card]['question']}</h3>
            </div>
            """, unsafe_allow_html=True)

            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                if st.button("Show Answer", width='stretch'):
                    st.session_state.show_answer = True
                    st.rerun()
        else:
            # Show answer
            st.markdown(f"""
            <div class="flashcard">
                <h3>💡 {flashcards[current_card]['answer']}</h3>
            </div>
            """, unsafe_allow_html=True)

    # Navigation buttons
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        if st.button("⬅️ Previous", disabled=(current_card == 0), width='stretch'):
            st.session_state.current_card = max(0, current_card - 1)
            st.session_state.show_answer = False
            st.rerun()

    with col2:
        if show_answer and st.button("🔄 Hide Answer", width='stretch'):
            st.session_state.show_answer = False
            st.rerun()

    with col3:
        if st.button("➡️ Next", disabled=(current_card >= len(flashcards) - 1), width='stretch'):
            st.session_state.current_card = min(len(flashcards) - 1, current_card + 1)
            st.session_state.show_answer = False
            st.rerun()

    with col4:
        if st.button("🔀 Shuffle", width='stretch'):
            import random
            random.shuffle(st.session_state.flashcards)
            st.session_state.current_card = 0
            st.session_state.show_answer = False
            st.rerun()

    # Close button
    if st.button("✅ Done Studying", width='stretch'):
        st.session_state.show_flashcards = False
        st.rerun()

def generate_quiz():
    """Generate quiz questions from document content"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        if not check_hf():
            return False

        quiz_prompt = f"""
        Create 10 quiz questions based on the following document content.
        Format each question as a JSON object with multiple choice options.
        Make questions that test comprehension, analysis, and key concepts.

        Document Content:
        {st.session_state.document_text[:3000]}...

        Respond with ONLY a valid JSON array of quiz objects like this:
        [
            {{
                "question": "What is the main concept discussed in the document?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0,
                "explanation": "Detailed explanation of why this answer is correct."
            }}
        ]

        Requirements:
        - Generate exactly 10 questions
        - Use "correct" as index (0, 1, 2, or 3) for the correct answer
        - Make questions challenging but fair
        - Provide clear explanations for correct answers
        """

        quiz_text = call_hf(quiz_prompt, MODEL_JSON)

        # Clean up the response to extract JSON
        try:
            # Remove any markdown formatting
            if "```json" in quiz_text:
                quiz_text = quiz_text.split("```json")[1].split("```")[0]
            elif "```" in quiz_text:
                quiz_text = quiz_text.split("```")[1].split("```")[0]

            quiz_data = json.loads(quiz_text.strip())

            # Store quiz in session state
            st.session_state.quiz_questions = quiz_data
            st.session_state.current_question = 0
            st.session_state.user_answers = {}
            st.session_state.show_quiz = True
            st.session_state.quiz_completed = False
            st.session_state.show_quiz_results = False

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"🧠 **Quiz Generated!**\n\nI've created {len(quiz_data)} challenging questions based on your document. Test your knowledge with the interactive quiz!"
            })

            return True

        except json.JSONDecodeError:
            st.error("Error parsing quiz questions. Please try again.")
            return False

    except Exception as e:
        st.error(f"Error generating quiz: {str(e)}")
        return False

@st.dialog("🧠 Knowledge Quiz")
def show_quiz_popup():
    """Display interactive quiz in a popup dialog"""
    if 'quiz_questions' not in st.session_state or not st.session_state.quiz_questions:
        st.error("No quiz questions available!")
        return

    questions = st.session_state.quiz_questions
    current_q = st.session_state.get('current_question', 0)
    user_answers = st.session_state.get('user_answers', {})
    show_results = st.session_state.get('show_quiz_results', False)

    # Custom CSS for quiz styling
    st.markdown("""
    <style>
    .quiz-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin-bottom: 20px;
    }
    .question-card {
        background: #f8f9fa;
        border-left: 4px solid #667eea;
        padding: 20px;
        border-radius: 8px;
        margin: 15px 0;
    }
    .option-button {
        margin: 5px 0;
        width: 100%;
    }
    .quiz-progress {
        background: #e9ecef;
        height: 10px;
        border-radius: 5px;
        margin: 10px 0;
    }
    .quiz-results {
        background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin: 20px 0;
    }
    </style>
    """, unsafe_allow_html=True)

    if show_results:
        # Show Results
        correct_answers = sum(1 for i, answer in user_answers.items()
                             if answer == questions[i]['correct'])
        total_questions = len(questions)
        score_percentage = (correct_answers / total_questions) * 100

        st.markdown(f"""
        <div class="quiz-results">
            <h2>🎉 Quiz Complete!</h2>
            <h3>Your Score: {correct_answers}/{total_questions} ({score_percentage:.1f}%)</h3>
        </div>
        """, unsafe_allow_html=True)

        # Performance feedback
        if score_percentage >= 80:
            st.success("🌟 Excellent! You have a strong understanding of the material.")
        elif score_percentage >= 60:
            st.info("👍 Good job! Review the explanations for questions you missed.")
        else:
            st.warning("📚 Keep studying! Review the material and try again.")

        # Show detailed results
        st.subheader("📋 Detailed Results")

        for i, question in enumerate(questions):
            user_answer = user_answers.get(i, -1)
            correct_answer = question['correct']
            is_correct = user_answer == correct_answer

            with st.expander(f"Question {i+1}: {'✅' if is_correct else '❌'}", expanded=False):
                st.write(f"**Question:** {question['question']}")
                st.write(f"**Your Answer:** {question['options'][user_answer] if user_answer != -1 else 'Not answered'}")
                st.write(f"**Correct Answer:** {question['options'][correct_answer]}")
                st.write(f"**Explanation:** {question['explanation']}")

        # Action buttons
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("🔄 Retake Quiz", width='stretch'):
                st.session_state.current_question = 0
                st.session_state.user_answers = {}
                st.session_state.show_quiz_results = False
                st.rerun()

        with col2:
            if st.button("📊 New Quiz", width='stretch'):
                if generate_quiz():
                    st.rerun()

        with col3:
            if st.button("✅ Done", width='stretch'):
                st.session_state.show_quiz = False
                st.rerun()

    else:
        # Show Quiz Questions
        st.markdown(f"""
        <div class="quiz-header">
            <h3>Question {current_q + 1} of {len(questions)}</h3>
        </div>
        """, unsafe_allow_html=True)

        # Progress bar
        progress = (current_q + 1) / len(questions)
        st.progress(progress)

        # Current question
        question = questions[current_q]

        st.markdown(f"""
        <div class="question-card">
            <h4>{question['question']}</h4>
        </div>
        """, unsafe_allow_html=True)

        # Answer options
        selected_option = st.radio(
            "Choose your answer:",
            options=range(len(question['options'])),
            format_func=lambda x: f"{chr(65+x)}) {question['options'][x]}",
            key=f"quiz_q_{current_q}",
            index=user_answers.get(current_q, 0) if current_q in user_answers else 0
        )

        # Store selected answer
        st.session_state.user_answers[current_q] = selected_option

        # Navigation buttons
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            if st.button("⬅️ Previous", disabled=(current_q == 0), width='stretch'):
                st.session_state.current_question = max(0, current_q - 1)
                st.rerun()

        with col2:
            if current_q < len(questions) - 1:
                if st.button("➡️ Next", width='stretch'):
                    st.session_state.current_question = min(len(questions) - 1, current_q + 1)
                    st.rerun()
            else:
                if st.button("🏁 Finish Quiz", width='stretch'):
                    st.session_state.show_quiz_results = True
                    st.rerun()

        with col3:
            # Question navigator
            if st.button("📋 Jump to...", width='stretch'):
                st.session_state.show_question_nav = not st.session_state.get('show_question_nav', False)
                st.rerun()

        with col4:
            if st.button("❌ Close", width='stretch'):
                st.session_state.show_quiz = False
                st.rerun()

        # Question navigator
        if st.session_state.get('show_question_nav', False):
            st.subheader("📍 Jump to Question")
            nav_cols = st.columns(5)
            for i in range(len(questions)):
                col_idx = i % 5
                with nav_cols[col_idx]:
                    status = "✅" if i in user_answers else "⭕"
                    if st.button(f"{status} Q{i+1}", key=f"nav_q_{i}", width='stretch'):
                        st.session_state.current_question = i
                        st.session_state.show_question_nav = False
                        st.rerun()

        # Quiz statistics
        answered = len(user_answers)
        remaining = len(questions) - answered

        st.markdown(f"""
        <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 20px;">
            <small>
            📊 Progress: {answered}/{len(questions)} answered | {remaining} remaining
            </small>
        </div>
        """, unsafe_allow_html=True)

def generate_ai_video():
    """Generate AI video using Google Veo 3.0 from document summary with fallback options"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        # Veo 3.0 still requires a Google API key (OpenRouter doesn't offer video generation)
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            st.error("Please set your GEMINI_API_KEY in the .env file (required for Veo 3.0 video generation)")
            return False

        if not check_hf():
            return False

        # Use OpenRouter to craft the video prompt
        summary_prompt = f"""
        Create a concise, visual description for a video based on this document.
        Focus on creating an engaging, cinematic prompt that would work well for AI video generation.
        Keep it under 100 words and make it visually descriptive.

        Document Content:
        {st.session_state.document_text[:2000]}...

        Create a video prompt that captures the essence and key concepts visually.
        """

        video_prompt = call_hf(summary_prompt, MODEL_GENERAL).strip()

        # Add status message to chat
        st.session_state.messages.append({
            "role": "assistant",
            "content": f"🎬 **Starting Video Generation with Veo 3.0**\n\nGenerating video with prompt:\n\n*{video_prompt}*\n\nThis may take several minutes. The video will automatically download when ready..."
        })

        # Initialize Google GenAI client
        client = google_genai.Client(api_key=api_key)

        # Start video generation
        with st.spinner("🎬 Generating AI video with Veo 3.0... This may take several minutes."):
            operation = client.models.generate_videos(
                model="veo-3.0-generate-001",
                prompt=video_prompt,
            )

            # Poll for completion
            start_time = time.time()
            max_wait_time = 600  # 10 minutes timeout

            while not operation.done:
                elapsed_time = time.time() - start_time
                if elapsed_time > max_wait_time:
                    st.error("Video generation timed out after 10 minutes. Please try again.")
                    return False

                st.info(f"⏳ Video generation in progress... ({int(elapsed_time)}s elapsed)")
                time.sleep(10)
                operation = client.operations.get(operation)

            # Download the generated video
            generated_video = operation.response.generated_videos[0]

            # Create a unique filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"zeuzy_video_{timestamp}.mp4"

            # Download and save video
            client.files.download(file=generated_video.video)
            generated_video.video.save(filename)

            # Store video data for Streamlit download
            with open(filename, 'rb') as video_file:
                video_data = video_file.read()

            st.session_state.video_data = video_data
            st.session_state.video_filename = filename
            st.session_state.show_video_download = True

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"🎉 **Video Generated Successfully!**\n\nYour AI-generated video is ready! Generated using:\n\n*{video_prompt}*\n\nThe video has been automatically downloaded as `{filename}`. You can also download it again using the button below."
            })

            # Clean up temporary file
            try:
                os.remove(filename)
            except:
                pass

            return True

    except Exception as e:
        error_message = str(e)

        # Handle specific quota/billing errors
        if "429" in error_message or "RESOURCE_EXHAUSTED" in error_message or "quota" in error_message.lower():
            st.error("🚫 **Video Generation Quota Exceeded**")
            st.info("""
            **Issue:** Your Google AI API quota has been exceeded.

            **Solutions:**
            1. **Enable Billing**: Veo 3.0 requires a paid Google Cloud account
            2. **Check Quotas**: Visit [Google AI Studio](https://aistudio.google.com) to check your limits
            3. **Upgrade Plan**: Consider upgrading your API plan for higher quotas
            4. **Wait**: Quotas reset periodically (usually daily)

            **Alternative:** Try again later when quota resets.
            """)

        elif "PERMISSION_DENIED" in error_message:
            st.error("🔒 **Access Denied to Veo 3.0**")
            st.info("""
            **Issue:** Your API key doesn't have access to Veo 3.0.

            **Solutions:**
            1. **Apply for Access**: Request Veo 3.0 access at [Google AI Studio](https://aistudio.google.com)
            2. **Verify Billing**: Ensure billing is enabled on your Google Cloud account
            3. **Check Region**: Veo 3.0 may not be available in all regions

            **Alternative:** Try again later or contact support.
            """)

        else:
            st.error(f"❌ **Video Generation Failed**")
            st.error(f"Error details: {error_message}")
            st.info("""
            **Troubleshooting Steps:**
            1. Check your internet connection
            2. Verify your GEMINI_API_KEY is correct
            3. Ensure your Google Cloud project has Veo 3.0 enabled
            4. Try again in a few minutes

            **Alternative:** Try again later or check your configuration.
            """)

        return False


def generate_accessibility_report():
    """Generate comprehensive accessibility analytics PDF report"""
    if 'accessibility_tracker' not in st.session_state or not st.session_state.accessibility_tracker:
        st.warning("No accessibility tracking data available!")
        return False

    try:
        tracker = st.session_state.accessibility_tracker

        with st.spinner("Generating comprehensive accessibility analytics report..."):
            # Get analytics data
            analytics_report = tracker.generate_analytics_report(time_window_hours=24)

            if 'error' in analytics_report:
                st.error(f"Error generating analytics: {analytics_report['error']}")
                return False

            # Create PDF
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            doc = SimpleDocTemplate(temp_file.name, pagesize=A4)

            # Get styles
            styles = getSampleStyleSheet()

            # Custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=HexColor('#2E4057')
            )

            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=16,
                spaceAfter=12,
                spaceBefore=20,
                textColor=HexColor('#4A90A4')
            )

            subheading_style = ParagraphStyle(
                'CustomSubHeading',
                parent=styles['Heading3'],
                fontSize=14,
                spaceAfter=8,
                spaceBefore=15,
                textColor=HexColor('#5C677D')
            )

            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=6,
                alignment=TA_JUSTIFY
            )

            # Build PDF content
            story = []

            # Title Page
            story.append(Paragraph("🧠 Accessibility Analytics Report", title_style))
            story.append(Spacer(1, 20))
            story.append(Paragraph("Comprehensive Emotion, Attention, Stress & Engagement Analysis", styles['Normal']))
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
            story.append(Spacer(1, 50))

            # Executive Summary
            story.append(Paragraph("📊 Executive Summary", heading_style))

            summary = analytics_report.get('summary', {})

            # Create summary content
            summary_content = []
            if 'avg_stress' in summary:
                stress_level = "High" if summary['avg_stress'] > 60 else "Moderate" if summary['avg_stress'] > 30 else "Low"
                summary_content.append(f"• Average Stress Level: {summary['avg_stress']:.1f}% ({stress_level})")

            if 'avg_attention' in summary:
                attention_level = "High" if summary['avg_attention'] > 70 else "Moderate" if summary['avg_attention'] > 50 else "Low"
                summary_content.append(f"• Average Attention Score: {summary['avg_attention']:.1f}% ({attention_level})")

            if 'avg_engagement' in summary:
                engagement_level = "High" if summary['avg_engagement'] > 70 else "Moderate" if summary['avg_engagement'] > 50 else "Low"
                summary_content.append(f"• Average Engagement Level: {summary['avg_engagement']:.1f}% ({engagement_level})")

            if 'dominant_emotion' in summary:
                summary_content.append(f"• Dominant Emotion: {summary['dominant_emotion'].title()}")

            if 'session_duration' in analytics_report:
                summary_content.append(f"• Session Duration: {analytics_report['session_duration']}")

            if 'data_points' in analytics_report:
                summary_content.append(f"• Data Points Collected: {analytics_report['data_points']}")

            for item in summary_content:
                story.append(Paragraph(item, body_style))

            story.append(PageBreak())

            # Detailed Analysis
            story.append(Paragraph("🔍 Detailed Performance Analysis", heading_style))

            # Emotional State Analysis
            story.append(Paragraph("😊 Emotional State Analysis", subheading_style))
            emotion_analysis = f"""
            Throughout the session, your emotional patterns revealed important insights about your learning experience:

            • Primary Emotion: {summary.get('dominant_emotion', 'neutral').title()}
            • Emotional Diversity: {summary.get('emotion_diversity', 0)} different emotions detected
            • Emotional Stability: {"High" if summary.get('emotion_diversity', 0) < 4 else "Moderate" if summary.get('emotion_diversity', 0) < 6 else "Variable"}

            Interpretation: {_get_emotion_interpretation(summary)}
            """
            story.append(Paragraph(emotion_analysis, body_style))
            story.append(Spacer(1, 20))

            # Attention Analysis
            story.append(Paragraph("🎯 Attention & Focus Analysis", subheading_style))
            attention_analysis = f"""
            Your attention patterns during the learning session show:

            • Average Attention Score: {summary.get('avg_attention', 0):.1f}%
            • Attention Stability: {summary.get('attention_stability', 0):.1f}%
            • Focus Quality: {_categorize_attention(summary.get('avg_attention', 0))}

            Analysis: {_get_attention_interpretation(summary)}
            """
            story.append(Paragraph(attention_analysis, body_style))
            story.append(Spacer(1, 20))

            # Stress Analysis
            story.append(Paragraph("😰 Stress Level Analysis", subheading_style))
            stress_analysis = f"""
            Stress monitoring throughout your session indicates:

            • Average Stress Level: {summary.get('avg_stress', 0):.1f}%
            • Peak Stress Level: {summary.get('max_stress', 0):.1f}%
            • Stress Trend: {summary.get('stress_trend', 'stable').title()}

            Implications: {_get_stress_interpretation(summary)}
            """
            story.append(Paragraph(stress_analysis, body_style))
            story.append(Spacer(1, 20))

            # Engagement Analysis
            story.append(Paragraph("🚀 Engagement Level Analysis", subheading_style))
            engagement_analysis = f"""
            Your engagement with the learning material shows:

            • Average Engagement: {summary.get('avg_engagement', 0):.1f}%
            • Engagement Trend: {summary.get('engagement_trend', 'stable').title()}
            • Peak Engagement: {analytics_report.get('performance_metrics', {}).get('peak_engagement', 0):.1f}%

            Assessment: {_get_engagement_interpretation(summary)}
            """
            story.append(Paragraph(engagement_analysis, body_style))
            story.append(PageBreak())

            # Accessibility Insights
            story.append(Paragraph("♿ Accessibility Insights", heading_style))

            # ADHD Risk Assessment
            if 'avg_adhd_risk' in summary:
                story.append(Paragraph("🧠 ADHD Risk Assessment", subheading_style))
                adhd_content = f"""
                ADHD Risk Score: {summary['avg_adhd_risk']:.1f}% ({summary.get('adhd_category', 'Unknown')})

                {_get_adhd_interpretation(summary.get('avg_adhd_risk', 0))}
                """
                story.append(Paragraph(adhd_content, body_style))
                story.append(Spacer(1, 15))

            # Visual Strain Assessment
            if 'avg_visual_strain' in summary:
                story.append(Paragraph("👁️ Visual Strain Assessment", subheading_style))
                visual_content = f"""
                Average Visual Strain: {summary['avg_visual_strain']:.1f}%
                Peak Visual Strain: {summary.get('max_visual_strain', 0):.1f}%

                {_get_visual_strain_interpretation(summary.get('avg_visual_strain', 0))}
                """
                story.append(Paragraph(visual_content, body_style))
                story.append(Spacer(1, 15))

            # Cognitive Load Assessment
            if 'avg_cognitive_load' in summary:
                story.append(Paragraph("🧠 Cognitive Load Assessment", subheading_style))
                cognitive_content = f"""
                Average Cognitive Load: {summary['avg_cognitive_load']:.1f}%
                Peak Cognitive Load: {summary.get('peak_cognitive_load', 0):.1f}%

                {_get_cognitive_load_interpretation(summary.get('avg_cognitive_load', 0))}
                """
                story.append(Paragraph(cognitive_content, body_style))

            story.append(PageBreak())

            # Recommendations Section
            story.append(Paragraph("💡 Personalized Recommendations", heading_style))

            recommendations = analytics_report.get('recommendations', [])
            if recommendations:
                for rec in recommendations:
                    story.append(Paragraph(f"📌 {rec.get('category', 'General').replace('_', ' ').title()}", subheading_style))
                    story.append(Paragraph(f"Action: {rec.get('action', 'No action specified')}", body_style))

                    if rec.get('details'):
                        for detail in rec['details']:
                            story.append(Paragraph(f"• {detail}", body_style))

                    priority_color = '#e74c3c' if rec.get('priority') == 'high' else '#f39c12' if rec.get('priority') == 'medium' else '#27ae60'
                    story.append(Paragraph(f"Priority: {rec.get('priority', 'medium').title()}",
                                         ParagraphStyle('Priority', parent=body_style, textColor=HexColor(priority_color))))
                    story.append(Spacer(1, 15))
            else:
                story.append(Paragraph("No specific recommendations needed. Your learning patterns appear optimal.", body_style))

            story.append(PageBreak())

            # Technical Insights
            story.append(Paragraph("🔬 Technical Insights", heading_style))

            insights = analytics_report.get('insights', [])
            if insights:
                for insight in insights:
                    story.append(Paragraph(f"🔍 {insight.get('type', 'General').title()} Insight", subheading_style))
                    story.append(Paragraph(insight.get('message', ''), body_style))
                    story.append(Paragraph(f"Recommended Action: {insight.get('action', 'monitor').title()}", body_style))
                    story.append(Spacer(1, 15))

            # Performance Metrics
            performance = analytics_report.get('performance_metrics', {})
            if performance:
                story.append(Paragraph("📈 Performance Metrics", subheading_style))

                metrics_content = []
                if 'attention_efficiency' in performance:
                    metrics_content.append(f"• Attention Efficiency: {performance['attention_efficiency']:.1f}%")
                if 'engagement_rate' in performance:
                    metrics_content.append(f"• Engagement Rate: {performance['engagement_rate']:.1f}%")
                if 'stress_management' in performance:
                    metrics_content.append(f"• Stress Management: {performance['stress_management']:.1f}%")
                if 'visual_comfort' in performance:
                    metrics_content.append(f"• Visual Comfort: {performance['visual_comfort']:.1f}%")

                for metric in metrics_content:
                    story.append(Paragraph(metric, body_style))

            # Footer
            story.append(Spacer(1, 50))
            story.append(Paragraph("Generated by Steve Accessibility Analytics", styles['Normal']))
            story.append(Paragraph("This report provides insights into your learning patterns and accessibility needs.", styles['Normal']))

            # Build PDF
            doc.build(story)

            # Read the PDF file
            with open(temp_file.name, 'rb') as pdf_file:
                pdf_data = pdf_file.read()

            # Store PDF data for download
            st.session_state.accessibility_pdf_data = pdf_data
            st.session_state.show_accessibility_pdf_download = True

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": "🧠 **Accessibility Analytics Report Generated!**\n\nI've created a comprehensive analysis of your learning session including:\n\n• Detailed emotion analysis and patterns\n• Attention and focus assessment\n• Stress level monitoring and trends\n• Engagement level evaluation\n• ADHD risk assessment\n• Visual strain and cognitive load analysis\n• Personalized accessibility recommendations\n• Technical insights and performance metrics\n\nDownload your report below to review your learning analytics!"
            })

            return True

    except Exception as e:
        st.error(f"Error generating accessibility report: {str(e)}")
        return False

def _get_emotion_interpretation(summary):
    """Generate emotion interpretation"""
    dominant = summary.get('dominant_emotion', 'neutral')
    diversity = summary.get('emotion_diversity', 0)

    if dominant in ['happy', 'surprise']:
        return "Positive emotional state indicates good learning conditions and engagement."
    elif dominant in ['sad', 'angry', 'fear']:
        return "Negative emotions detected suggest potential stress or learning difficulties. Consider breaks and support."
    elif dominant == 'neutral':
        return "Neutral emotional state is normal but may indicate disengagement or fatigue."
    else:
        return "Mixed emotional patterns suggest variable learning experience."

def _get_attention_interpretation(summary):
    """Generate attention interpretation"""
    avg_attention = summary.get('avg_attention', 0)
    stability = summary.get('attention_stability', 0)

    if avg_attention > 70 and stability > 70:
        return "Excellent attention levels with high stability. Optimal learning conditions."
    elif avg_attention > 50:
        return "Good attention levels but could be improved with structured breaks and engagement techniques."
    else:
        return "Low attention scores suggest need for shorter sessions, breaks, and more interactive content."

def _categorize_attention(score):
    """Categorize attention score"""
    if score > 80:
        return "Excellent"
    elif score > 60:
        return "Good"
    elif score > 40:
        return "Fair"
    else:
        return "Needs Improvement"

def _get_stress_interpretation(summary):
    """Generate stress interpretation"""
    avg_stress = summary.get('avg_stress', 0)
    trend = summary.get('stress_trend', 'stable')

    if avg_stress > 70:
        return "High stress levels detected. Immediate stress reduction techniques recommended."
    elif avg_stress > 40:
        return "Moderate stress levels. Monitor closely and implement preventive measures."
    elif trend == 'increasing':
        return "Stress levels are rising. Consider taking breaks and reducing cognitive load."
    else:
        return "Stress levels are within normal range for learning activities."

def _get_engagement_interpretation(summary):
    """Generate engagement interpretation"""
    avg_engagement = summary.get('avg_engagement', 0)
    trend = summary.get('engagement_trend', 'stable')

    if avg_engagement > 70:
        return "High engagement levels indicate effective learning and content relevance."
    elif avg_engagement > 50:
        return "Moderate engagement. Consider more interactive elements and varied content presentation."
    else:
        return "Low engagement suggests need for more interactive, personalized, or gamified content."

def _get_adhd_interpretation(score):
    """Generate ADHD interpretation"""
    if score > 70:
        return "High ADHD risk indicators suggest structured support, frequent breaks, and attention aids may be beneficial."
    elif score > 40:
        return "Moderate ADHD patterns detected. Consider implementing structured learning approaches."
    else:
        return "Low ADHD risk. Current attention patterns appear typical for learning activities."

def _get_visual_strain_interpretation(score):
    """Generate visual strain interpretation"""
    if score > 60:
        return "High visual strain detected. Adjust screen brightness, increase font size, and take regular eye breaks."
    elif score > 30:
        return "Moderate visual strain. Consider optimizing display settings and lighting conditions."
    else:
        return "Visual comfort levels are good. Current display settings appear appropriate."

def _get_cognitive_load_interpretation(score):
    """Generate cognitive load interpretation"""
    if score > 70:
        return "High cognitive load suggests content may be too complex or presented too quickly. Consider simplification."
    elif score > 40:
        return "Moderate cognitive load is normal but monitor for signs of overload."
    else:
        return "Cognitive load is manageable. Current learning pace appears appropriate."

def launch_educational_game():
    """Launch the educational Pygame maze game"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        if not check_hf():
            return False

        with st.spinner("🎮 Preparing your educational game..."):
            # Generate summary for audio narration
            summary_prompt = f"""
            Create a clear, engaging summary of this document for audio narration in a game.
            Keep it conversational and motivating for learning. Limit to 100 words.

            Document: {st.session_state.document_text[:2000]}...

            Create a summary that will get players excited to learn about this topic.
            """

            game_summary = call_hf(summary_prompt, MODEL_GENERAL)

            # Generate roadmap structure for maze
            roadmap_prompt = f"""
            Create a learning roadmap structure for this document that can be used in a maze game.
            Format as sections with titles and types.

            Document: {st.session_state.document_text[:2000]}...

            Create 4-6 sections in order:
            1. Start with introduction (flashcard)
            2. 2-3 main concept sections (flashcard)
            3. 1-2 practice sections (quiz)
            4. End with goal section (goal)

            Format each section as: Title | Type | Brief content description
            """

            roadmap_text = call_hf(roadmap_prompt, MODEL_GENERAL)

            # Parse roadmap into game data
            sections = []
            for line in roadmap_text.split('\n'):
                if '|' in line:
                    parts = [part.strip() for part in line.split('|')]
                    if len(parts) >= 3:
                        title = parts[0]
                        section_type = parts[1].lower()
                        content = parts[2]

                        # Ensure valid types
                        if section_type not in ['flashcard', 'quiz', 'goal']:
                            section_type = 'flashcard'

                        sections.append({
                            'title': title,
                            'type': section_type,
                            'content': content,
                            'data': _generate_section_data(title, content, section_type, st.session_state.document_text)
                        })

            # Fallback sections if parsing fails
            if not sections:
                sections = [
                    {'title': 'Introduction', 'type': 'flashcard', 'content': 'Welcome to learning!', 'data': {}},
                    {'title': 'Main Concepts', 'type': 'flashcard', 'content': 'Key ideas to understand', 'data': {}},
                    {'title': 'Knowledge Check', 'type': 'quiz', 'content': 'Test your understanding', 'data': {}},
                    {'title': 'Master the Topic', 'type': 'goal', 'content': 'Explain what you learned', 'data': {}}
                ]

            # Create game data package
            game_data = {
                'summary': game_summary,
                'roadmap': {
                    'sections': sections
                },
                'document_title': getattr(st.session_state, 'uploaded_file_name', 'Learning Document')
            }

            # Save game data for the game to access
            game_data_path = os.path.join(tempfile.gettempdir(), 'zeuzy_game_data.json')
            with open(game_data_path, 'w', encoding='utf-8') as f:
                json.dump(game_data, f, indent=2, ensure_ascii=False)

            # Launch game in separate process
            def launch_game_process():
                try:
                    game_script = os.path.join(os.path.dirname(__file__), 'educational_game_fixed.py')
                    subprocess.run([sys.executable, game_script, game_data_path], check=True)
                except Exception as e:
                    print(f"Game launch error: {e}")

            # Start game in background thread
            game_thread = threading.Thread(target=launch_game_process, daemon=True)
            game_thread.start()

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"🎮 **Educational Game Launched!**\n\nI've created a personalized maze game based on your document:\n\n• **Audio Narration**: Document summary will be read aloud\n• **Learning Maze**: Navigate through {len(sections)} learning sections\n• **Interactive Elements**: Flashcards and quizzes at each stop\n• **AI Assessment**: Explain what you learned for a final score\n\n**Controls:**\n• WASD or Arrow Keys to move\n• Space to play audio narration\n• Mouse to interact with quizzes and flashcards\n\nThe game window should open shortly. Have fun learning!"
            })

            return True

    except Exception as e:
        st.error(f"Error launching game: {str(e)}")
        st.info("💡 **Troubleshooting:**\n- Ensure pygame is installed: `pip install pygame pyttsx3`\n- Check that your system supports audio playback\n- Try restarting the application")
        return False

def _generate_section_data(title: str, content: str, section_type: str, document_text: str) -> Dict[str, Any]:
    """Generate specific data for each game section with quota error handling"""

    def _get_fallback_quiz_data(title: str) -> Dict[str, Any]:
        """Generate fallback quiz data when API is unavailable"""
        return {
            "questions": [
                {
                    "question": f"What is the main topic discussed in '{title}'?",
                    "options": ["Primary concept", "Secondary idea", "Related topic", "Background information"],
                    "correct": 0
                },
                {
                    "question": f"Which statement best describes '{title}'?",
                    "options": ["It's a core learning objective", "It's optional material", "It's review content", "It's introductory material"],
                    "correct": 0
                },
                {
                    "question": f"How does '{title}' relate to the overall document?",
                    "options": ["It's an essential component", "It's supplementary", "It's an example", "It's a conclusion"],
                    "correct": 0
                }
            ]
        }

    def _get_fallback_flashcard_data(title: str, content: str) -> Dict[str, Any]:
        """Generate fallback flashcard data when API is unavailable"""
        return {
            "flashcards": [
                {
                    "front": f"What is '{title}'?",
                    "back": f"This section covers key concepts related to {title}. {content[:100]}..."
                },
                {
                    "front": f"Key learning point about '{title}'",
                    "back": f"Understanding {title} is important for mastering the overall topic covered in this document."
                }
            ]
        }

    try:
        # Check for quota/API errors and use fallback immediately
        if section_type == 'quiz':
            try:
                # Generate quiz questions
                quiz_prompt = f"""
                Create 3 multiple choice questions about "{title}" from this document:

                Document: {document_text[:1500]}...

                Format as JSON:
                {{
                    "questions": [
                        {{
                            "question": "Question text?",
                            "options": ["A", "B", "C", "D"],
                            "correct": 0
                        }}
                    ]
                }}
                """

                quiz_text = call_hf(quiz_prompt, MODEL_JSON)

                # Clean and parse JSON
                if "```json" in quiz_text:
                    quiz_text = quiz_text.split("```json")[1].split("```")[0]
                elif "```" in quiz_text:
                    quiz_text = quiz_text.split("```")[1].split("```")[0]

                try:
                    return json.loads(quiz_text.strip())
                except:
                    return _get_fallback_quiz_data(title)

            except Exception as api_error:
                # Handle quota errors specifically
                if "429" in str(api_error) or "quota" in str(api_error).lower():
                    print(f"API quota exceeded, using fallback quiz data for '{title}'")
                    return _get_fallback_quiz_data(title)
                else:
                    print(f"API error for quiz '{title}': {api_error}")
                    return _get_fallback_quiz_data(title)

        elif section_type == 'flashcard':
            try:
                # Generate flashcards
                flashcard_prompt = f"""
                Create 2 flashcards about "{title}" from this document:

                Document: {document_text[:1500]}...

                Format as JSON:
                {{
                    "flashcards": [
                        {{
                            "front": "Key term or concept",
                            "back": "Definition or explanation"
                        }}
                    ]
                }}
                """

                flashcard_text = call_hf(flashcard_prompt, MODEL_JSON)

                # Clean and parse JSON
                if "```json" in flashcard_text:
                    flashcard_text = flashcard_text.split("```json")[1].split("```")[0]
                elif "```" in flashcard_text:
                    flashcard_text = flashcard_text.split("```")[1].split("```")[0]

                try:
                    return json.loads(flashcard_text.strip())
                except:
                    return _get_fallback_flashcard_data(title, content)

            except Exception as api_error:
                # Handle quota errors specifically
                if "429" in str(api_error) or "quota" in str(api_error).lower():
                    print(f"API quota exceeded, using fallback flashcard data for '{title}'")
                    return _get_fallback_flashcard_data(title, content)
                else:
                    print(f"API error for flashcard '{title}': {api_error}")
                    return _get_fallback_flashcard_data(title, content)

        return {}

    except Exception as e:
        print(f"Section data generation error: {e}")
        # Return appropriate fallback based on section type
        if section_type == 'quiz':
            return _get_fallback_quiz_data(title)
        elif section_type == 'flashcard':
            return _get_fallback_flashcard_data(title, content)
        return {}

def generate_comprehensive_pdf():
    """Generate a comprehensive PDF study guide using ReportLab"""
    if not st.session_state.document_text:
        st.warning("Please upload a document first!")
        return False

    try:
        if not check_hf():
            return False

        # Generate all content sections via OpenRouter
        with st.spinner("Generating comprehensive study content..."):

            # 1. Generate Summary
            summary_prompt = f"""
            Create a comprehensive summary of the following document. Make it detailed but concise.

            Document: {st.session_state.document_text[:3000]}...

            Provide a well-structured summary covering all main points.
            """
            summary_content = call_hf(summary_prompt, MODEL_GENERAL)

            # 2. Generate MCQs
            mcq_prompt = f"""
            Create 10 multiple choice questions based on the document. Format as JSON:
            [
                {{
                    "question": "Question text?",
                    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
                    "correct": "A",
                    "explanation": "Explanation why this is correct"
                }}
            ]

            Document: {st.session_state.document_text[:3000]}...
            """
            mcq_text = call_hf(mcq_prompt, MODEL_JSON)

            # Clean MCQ response
            if "```json" in mcq_text:
                mcq_text = mcq_text.split("```json")[1].split("```")[0]
            mcqs = json.loads(mcq_text.strip())

            # 3. Generate Detailed Explanations
            explanations_prompt = f"""
            Provide detailed explanations of the key concepts in the document.
            Cover 5-7 main topics with in-depth analysis.

            Document: {st.session_state.document_text[:3000]}...
            """
            explanations_content = call_hf(explanations_prompt, MODEL_GENERAL)

            # 4. Generate Thinking Questions
            thinking_prompt = f"""
            Create 8 thought-provoking questions about the document that encourage critical thinking and analysis.

            Document: {st.session_state.document_text[:3000]}...

            Format as numbered questions (1. Question... 2. Question...)
            """
            thinking_content = call_hf(thinking_prompt, MODEL_GENERAL)

            # 5. Generate Hands-on Activities
            activities_prompt = f"""
            Create 6 hands-on activities or exercises related to the document content.
            Include practical applications, exercises, or projects.

            Document: {st.session_state.document_text[:3000]}...

            Format as numbered activities with clear instructions.
            """
            activities_content = call_hf(activities_prompt, MODEL_GENERAL)

            # 6. Generate Text Roadmap
            roadmap_prompt = f"""
            Create a visual text roadmap of the document using ASCII art, emojis, and clear structure.

            Document: {st.session_state.document_text[:2000]}...
            """
            roadmap_content = call_hf(roadmap_prompt, MODEL_GENERAL)

        # Generate cover image and section illustrations via HuggingFace
        with st.spinner("Generating AI illustrations for the study guide..."):
            # Derive a short topic from the document for image prompts
            topic_hint = st.session_state.document_text[:200].replace("\n", " ")
            cover_img_bytes = generate_image_hf(
                f"Educational illustration representing: {topic_hint}, clean, colorful, professional"
            )
            concept_img_bytes = generate_image_hf(
                f"Abstract visual concept map diagram for: {topic_hint}, minimal, infographic style"
            )

        # Create PDF
        with st.spinner("Creating PDF document..."):
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            doc = SimpleDocTemplate(temp_file.name, pagesize=A4)

            # Get styles
            styles = getSampleStyleSheet()

            # Custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=TA_CENTER,
                textColor=HexColor('#2E4057')
            )

            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=16,
                spaceAfter=12,
                spaceBefore=20,
                textColor=HexColor('#4A90A4')
            )

            subheading_style = ParagraphStyle(
                'CustomSubHeading',
                parent=styles['Heading3'],
                fontSize=14,
                spaceAfter=8,
                spaceBefore=15,
                textColor=HexColor('#5C677D')
            )

            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                spaceAfter=6,
                alignment=TA_JUSTIFY
            )

            # Build PDF content
            story = []

            # Title Page
            story.append(Paragraph("📚 Comprehensive Study Guide", title_style))
            story.append(Spacer(1, 20))
            story.append(Paragraph("Generated by Steve AI", styles['Normal']))
            story.append(Spacer(1, 20))

            # Cover illustration (if generated)
            if cover_img_bytes:
                try:
                    img_buf = BytesIO()
                    cover_img_bytes.convert("RGB").save(img_buf, format="PNG")
                    img_buf.seek(0)
                    story.append(RLImage(img_buf, width=5 * inch, height=3 * inch))
                    story.append(Spacer(1, 20))
                except Exception:
                    pass

            # Table of Contents
            story.append(Paragraph("📋 Table of Contents", heading_style))
            toc_data = [
                ["1. Document Summary", "Page 2"],
                ["2. Learning Roadmap", "Page 3"],
                ["3. Detailed Explanations", "Page 4"],
                ["4. Multiple Choice Questions", "Page 5"],
                ["5. Critical Thinking Questions", "Page 6"],
                ["6. Hands-on Activities", "Page 7"]
            ]

            toc_table = Table(toc_data)
            toc_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#E8F4F8')),
                ('TEXTCOLOR', (0, 0), (-1, 0), black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('GRID', (0, 0), (-1, -1), 1, black)
            ]))
            story.append(toc_table)
            story.append(PageBreak())

            # 1. Summary Section
            story.append(Paragraph("📄 Document Summary", heading_style))
            story.append(Paragraph(summary_content, body_style))
            story.append(PageBreak())

            # 2. Roadmap Section
            story.append(Paragraph("🗺️ Learning Roadmap", heading_style))
            story.append(Paragraph(roadmap_content, body_style))
            story.append(PageBreak())

            # 3. Detailed Explanations
            story.append(Paragraph("📖 Detailed Explanations", heading_style))
            if concept_img_bytes:
                try:
                    img_buf2 = BytesIO()
                    concept_img_bytes.convert("RGB").save(img_buf2, format="PNG")
                    img_buf2.seek(0)
                    story.append(RLImage(img_buf2, width=4 * inch, height=2.5 * inch))
                    story.append(Spacer(1, 10))
                except Exception:
                    pass
            story.append(Paragraph(explanations_content, body_style))
            story.append(PageBreak())

            # 4. MCQs Section
            story.append(Paragraph("❓ Multiple Choice Questions", heading_style))
            for i, mcq in enumerate(mcqs, 1):
                story.append(Paragraph(f"<b>Question {i}:</b> {mcq['question']}", subheading_style))
                for option in mcq['options']:
                    story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{option}", body_style))
                story.append(Paragraph(f"<b>Answer:</b> {mcq['correct']}", body_style))
                story.append(Paragraph(f"<b>Explanation:</b> {mcq['explanation']}", body_style))
                story.append(Spacer(1, 15))
            story.append(PageBreak())

            # 5. Thinking Questions
            story.append(Paragraph("🤔 Critical Thinking Questions", heading_style))
            story.append(Paragraph(thinking_content, body_style))
            story.append(PageBreak())

            # 6. Hands-on Activities
            story.append(Paragraph("🛠️ Hands-on Activities", heading_style))
            story.append(Paragraph(activities_content, body_style))

            # Build PDF
            doc.build(story)

            # Read the PDF file
            with open(temp_file.name, 'rb') as pdf_file:
                pdf_data = pdf_file.read()

            # Add success message to chat
            st.session_state.messages.append({
                "role": "assistant",
                "content": "📄 **Comprehensive Study Guide Generated!**\n\nI've created a detailed PDF study guide with:\n• Document Summary\n• Learning Roadmap\n• Detailed Explanations\n• 10 Multiple Choice Questions\n• Critical Thinking Questions\n• Hands-on Activities\n\nUse the download button below to get your PDF!"
            })

            # Store PDF data for download
            st.session_state.pdf_data = pdf_data
            st.session_state.show_pdf_download = True

            return True

    except Exception as e:
        st.error(f"Error generating PDF: {str(e)}")
        return False

# ── Stevens Course Advisor ────────────────────────────────────────────────────

_STEVENS_PROGRAM_LABELS = {
    "MS_Business_Intelligence_and_Analytics": "MS Business Intelligence & Analytics",
    "ME_Robotics": "ME Robotics",
    "MS_Applied_Artificial_Intelligence": "MS Applied AI",
}

_POOL_LABELS = {
    "core": "Core (Required)",
    "concentration_electives": "Concentration Electives",
    "engineering_tools_and_methods": "Engineering Tools & Methods",
    "robotics_core": "Robotics Core",
    "electives": "Electives",
    "mathematical_foundation": "Mathematical Foundation",
    "concentration": "Concentration",
    "project_and_thesis": "Project & Thesis",
}

_DEGREE_REQUIREMENTS = {
    "MS_Business_Intelligence_and_Analytics": {
        "core":                    {"courses": 11, "credits": 27},
        "concentration_electives": {"courses": 3,  "credits": 9},
    },
    "ME_Robotics": {
        "engineering_tools_and_methods": {"courses": 1, "credits": 3},
        "robotics_core":                 {"courses": 3, "credits": 9},
        "electives":                     {"courses": 6, "credits": 18},
    },
    "MS_Applied_Artificial_Intelligence": {
        "mathematical_foundation": {"courses": 1, "credits": 3},
        "core":                    {"courses": 4, "credits": 12},
        "concentration":           {"courses": 3, "credits": 9},
        "project_and_thesis":      {"courses": 2, "credits": 6},
    },
}

_POOL_COLORS = {
    "core":                          "#3b82f6",
    "concentration_electives":       "#8b5cf6",
    "concentration":                 "#8b5cf6",
    "engineering_tools_and_methods": "#f59e0b",
    "robotics_core":                 "#3b82f6",
    "electives":                     "#10b981",
    "mathematical_foundation":       "#f59e0b",
    "project_and_thesis":            "#ef4444",
}

# Canonical pool order per program (drives display and post-processing order)
_POOL_ORDER = {
    "MS_Business_Intelligence_and_Analytics": ["core", "concentration_electives"],
    "ME_Robotics": ["engineering_tools_and_methods", "robotics_core", "electives"],
    # AAI: fill concentration before core so small sub-pools are reserved first
    "MS_Applied_Artificial_Intelligence": ["mathematical_foundation", "concentration", "core", "project_and_thesis"],
}

# BIA core is always all 11 — not LLM-decided
_BIA_CORE = [
    "BIA 580", "FIN 515", "MIS 631", "MIS 632", "MIS 633",
    "MIS 634", "MIS 637", "BIA 650", "BIA 652", "BIA 654", "BIA 686",
]

# Display order for each program (student-facing, always logical regardless of fill order)
_POOL_DISPLAY_ORDER = {
    "MS_Business_Intelligence_and_Analytics": ["core", "concentration_electives"],
    "ME_Robotics": ["engineering_tools_and_methods", "robotics_core", "electives"],
    "MS_Applied_Artificial_Intelligence": ["mathematical_foundation", "core", "concentration", "project_and_thesis"],
}


def _parse_credits(raw) -> int:
    if isinstance(raw, int):   return raw
    if isinstance(raw, float): return int(raw)
    if isinstance(raw, str):
        try:   return int(raw.split("-")[0])
        except: return 3
    return 3


def _load_stevens_courses():
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stevens_courses.json")
    try:
        with open(json_path) as f:
            return json.load(f)
    except Exception:
        return None


def _pool_codes_from_json(courses_data, prog_key, json_pool_name):
    """Return all course codes from a named JSON course_pools entry."""
    pool = courses_data["programs"].get(prog_key, {}).get("course_pools", {}).get(json_pool_name, {})
    return [c["code"] for c in pool.get("courses", []) if isinstance(c, dict)]


def _lookup_course(courses_data, prog_key, code):
    prog = courses_data["programs"].get(prog_key, {})
    for pool_name, pool in prog.get("course_pools", {}).items():
        if "courses" in pool:
            for c in pool["courses"]:
                if isinstance(c, dict) and c.get("code") == code:
                    return c, pool_name
        else:
            for sub_key, sub_val in pool.items():
                if isinstance(sub_val, dict) and "courses" in sub_val:
                    for c in sub_val["courses"]:
                        if isinstance(c, dict) and c.get("code") == code:
                            return c, f"{pool_name}/{sub_key}"
    return None, None


def _available_for_pool(courses_data, prog_key, pool_name, prog_recs):
    """Return (codes,) or (me_codes, csee_codes) for ME electives."""
    cp = courses_data["programs"].get(prog_key, {}).get("course_pools", {})

    if prog_key == "MS_Business_Intelligence_and_Analytics" and pool_name == "concentration_electives":
        rec = prog_recs.get("recommended_concentration", "Data Analytics")
        if rec == "Big Data":
            bd = _pool_codes_from_json(courses_data, prog_key, "big_data_concentration_required")
            ds = _pool_codes_from_json(courses_data, prog_key, "data_science_and_ai_concentration_electives")
            return bd + [c for c in ds if c not in bd]
        m = {"Data Analytics": "data_analytics_concentration_electives",
             "Data Science and AI": "data_science_and_ai_concentration_electives"}
        return _pool_codes_from_json(courses_data, prog_key, m.get(rec, "data_analytics_concentration_electives"))

    if prog_key == "MS_Applied_Artificial_Intelligence" and pool_name == "concentration":
        rec = prog_recs.get("recommended_concentration", "data_engineering")
        key = rec.lower().replace(" ", "_").replace("-", "_")
        conc_pool = cp.get("concentration_courses", {})
        sub = conc_pool.get(key) or next((v for k, v in conc_pool.items() if k.lower() == key), {})
        return [c["code"] for c in sub.get("courses", []) if isinstance(c, dict)]

    if prog_key == "ME_Robotics" and pool_name == "electives":
        me   = _pool_codes_from_json(courses_data, prog_key, "me_robotics_electives")
        csee = _pool_codes_from_json(courses_data, prog_key, "cs_ee_cpe_ma_electives")
        return me, csee   # caller receives a 2-tuple

    return _pool_codes_from_json(courses_data, prog_key, pool_name)


def _pick(want, preferred, available, seen):
    """Select up to `want` codes: prefer from `preferred`, fill from `available`, skip `seen`."""
    result = []
    for code in (preferred + [c for c in available if c not in preferred]):
        if len(result) >= want:
            break
        if code in available and code not in seen and code not in result:
            result.append(code)
    return result[:want]


def _post_process(prog_key, prog_recs, courses_data):
    """
    Guarantee degree requirements are met exactly:
    - Correct course count per pool
    - No duplicates across pools
    - Invalid LLM codes replaced with valid pool alternatives
    Returns a clean pools dict.
    """
    req_map = _DEGREE_REQUIREMENTS.get(prog_key, {})
    seen: set = set()
    result = {}

    for pool_name in _POOL_ORDER.get(prog_key, []):
        req_n = req_map.get(pool_name, {}).get("courses", 0)
        raw   = prog_recs.get("pools", {}).get(pool_name, [])

        # ── BIA core: always fixed 11 ──────────────────────────────────────
        if prog_key == "MS_Business_Intelligence_and_Analytics" and pool_name == "core":
            result["core"] = list(_BIA_CORE)
            seen.update(_BIA_CORE)
            continue

        # ── AAI project/thesis: fixed by track ────────────────────────────
        if prog_key == "MS_Applied_Artificial_Intelligence" and pool_name == "project_and_thesis":
            track = prog_recs.get("recommended_track", "project_track")
            result["project_and_thesis"] = (
                ["900-level"] if "thesis" in track.lower() else ["AAI 800", "EE 820"]
            )
            continue

        # ── ME Robotics electives: sub-pool minimums ──────────────────────
        if prog_key == "ME_Robotics" and pool_name == "electives":
            me_avail, csee_avail = _available_for_pool(courses_data, prog_key, "electives", prog_recs)
            me_raw   = [c for c in raw if c in me_avail]
            csee_raw = [c for c in raw if c in csee_avail]

            me_picks   = _pick(2, me_raw,   me_avail,   seen);  seen.update(me_picks)
            csee_picks = _pick(2, csee_raw, csee_avail, seen);  seen.update(csee_picks)

            combined = me_picks + csee_picks
            if len(combined) < req_n:
                extra = _pick(req_n - len(combined), raw, me_avail + csee_avail, seen)
                seen.update(extra)
                combined += extra

            result["electives"] = combined[:req_n]
            continue

        # ── BIA Big Data: BIA 678 must be first ───────────────────────────
        if (prog_key == "MS_Business_Intelligence_and_Analytics"
                and pool_name == "concentration_electives"
                and prog_recs.get("recommended_concentration") == "Big Data"):
            avail = _available_for_pool(courses_data, prog_key, pool_name, prog_recs)
            preferred = ["BIA 678"] + [c for c in raw if c != "BIA 678"]
            picks = _pick(req_n, preferred, avail, seen)
            seen.update(picks)
            result[pool_name] = picks
            continue

        # ── General case ──────────────────────────────────────────────────
        avail = _available_for_pool(courses_data, prog_key, pool_name, prog_recs)
        picks = _pick(req_n, raw, avail, seen)
        seen.update(picks)
        result[pool_name] = picks

    return result


def _build_catalog_text(courses_data, prog_key=None):
    lines = []
    programs = ({prog_key: courses_data["programs"][prog_key]} if prog_key
                else courses_data["programs"])
    for pk, prog in programs.items():
        label    = _STEVENS_PROGRAM_LABELS.get(pk, pk)
        total_cr = prog.get("degree_requirements", {}).get("total_credits",
                   prog.get("total_credits_required", "?"))
        lines.append(f"\n=== {label} ({total_cr} cr required) ===")
        for pool_name, pool in prog["course_pools"].items():
            lines.append(f"  [{_POOL_LABELS.get(pool_name, pool_name)}]")
            if "courses" in pool:
                for c in pool["courses"]:
                    if isinstance(c, dict):
                        desc = (c.get("description") or "")[:90].replace("\n", " ")
                        lines.append(f"    {c['code']}: {c['name']} "
                                     f"({_parse_credits(c.get('credits',3))} cr) — {desc}")
            else:
                for sub_key, sub_val in pool.items():
                    if isinstance(sub_val, dict) and "courses" in sub_val:
                        lines.append(f"    [{sub_key.replace('_',' ').title()}]")
                        for c in sub_val["courses"]:
                            if isinstance(c, dict):
                                desc = (c.get("description") or "")[:70].replace("\n", " ")
                                lines.append(f"      {c['code']}: {c['name']} "
                                             f"({_parse_credits(c.get('credits',3))} cr) — {desc}")
    return "\n".join(lines)


def _recommend_courses_for_role(target_role, courses_data, degree_filter=None):
    prog_keys = [degree_filter] if degree_filter else list(courses_data["programs"].keys())
    catalog   = _build_catalog_text(courses_data, degree_filter)

    parts = []
    for pk in prog_keys:
        if pk == "MS_Business_Intelligence_and_Analytics":
            parts.append(
                f'  "MS_Business_Intelligence_and_Analytics": {{'
                f'"reasoning":"...","recommended_concentration":"Data Analytics|Data Science and AI|Big Data",'
                f'"pools":{{"core":{json.dumps(_BIA_CORE)},'
                f'"concentration_electives":["C1","C2","C3"]}}}}'
            )
        elif pk == "ME_Robotics":
            parts.append(
                '  "ME_Robotics": {"reasoning":"...","pools":{'
                '"engineering_tools_and_methods":["C1"],'
                '"robotics_core":["C1","C2","C3"],'
                '"electives":["C1","C2","C3","C4","C5","C6"]}}'
            )
        elif pk == "MS_Applied_Artificial_Intelligence":
            parts.append(
                '  "MS_Applied_Artificial_Intelligence": {"reasoning":"...",'
                '"recommended_track":"project_track|thesis_track",'
                '"recommended_concentration":"data_engineering|software_engineering|electrical_engineering|computer_engineering|biomedical_engineering|systems_biology|mechanical_engineering|ai_in_design_and_construction",'
                '"pools":{"mathematical_foundation":["C1"],"core":["C1","C2","C3","C4"],'
                '"concentration":["C1","C2","C3"],"project_and_thesis":["AAI 800","EE 820"]}}'
            )

    prompt = f"""Stevens Institute graduate academic advisor.
Student target role: {target_role}

Course catalog:
{catalog}

Pick the best courses for a {target_role}. Return ONLY valid JSON, no markdown or extra text:

{{
{chr(10).join(parts)}
}}

Rules (enforced programmatically — just give your best picks):
- BIA core: keep all 11 exactly as shown
- BIA concentration_electives: 3 codes from the chosen concentration pool only
- ME electives: 6 codes total, minimum 2 from ME pool, minimum 2 from CS/EE pool
- AAI core: 4 codes from core pool; concentration: 3 codes from chosen sub-pool, different from core
- AAI project_and_thesis: ["AAI 800","EE 820"] for project_track, ["900-level"] for thesis_track
- No repeated codes across pools; only codes that appear in the catalog above
"""

    raw = call_hf(prompt, MODEL_JSON, max_tokens=2000)
    m   = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            llm_out = json.loads(m.group())
            result  = {}
            for pk, prog_recs in llm_out.items():
                if pk not in courses_data["programs"]:
                    continue
                result[pk] = {
                    "reasoning":                prog_recs.get("reasoning", ""),
                    "recommended_concentration": prog_recs.get("recommended_concentration", ""),
                    "recommended_track":         prog_recs.get("recommended_track", ""),
                    "pools": _post_process(pk, prog_recs, courses_data),
                }
            return result
        except (json.JSONDecodeError, KeyError):
            pass
    return {}


# ── Roadmap CSS ───────────────────────────────────────────────────────────────
_ROADMAP_CSS = """<style>
.rm-role-tag{display:inline-block;background:linear-gradient(90deg,#1d4ed8,#7c3aed);
  color:#fff;font-size:11px;font-weight:700;letter-spacing:.04em;
  padding:3px 10px;border-radius:20px;margin-bottom:10px}
.rm-pool-bar{display:flex;align-items:center;gap:6px;padding:6px 10px;
  margin:10px 0 4px;border-left:3px solid;border-radius:0 6px 6px 0;background:#1e293b}
.rm-pool-name{font-size:12px;font-weight:700;color:#e2e8f0;flex:1}
.rm-pool-badge{font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600}
.rm-badge-ok{background:#14532d;color:#86efac}
.rm-badge-warn{background:#451a03;color:#fcd34d}
.rm-code{background:#1e3a5f;color:#93c5fd;font-size:10px;font-weight:800;
  padding:2px 6px;border-radius:4px;white-space:nowrap}
.rm-cr{background:#14532d;color:#86efac;font-size:10px;font-weight:700;
  padding:2px 5px;border-radius:4px;white-space:nowrap}
.rm-off{font-size:10px;color:#64748b}
.rm-desc{font-size:12px;color:#94a3b8;line-height:1.6;margin-top:6px}
.rm-meta{font-size:11px;color:#64748b;margin-bottom:6px}
.rm-credit-ok{color:#22c55e;font-weight:700}
.rm-credit-warn{color:#f59e0b;font-weight:700}
</style>"""


def _render_course_roadmap(recommendations, courses_data, target_role):
    if not recommendations:
        st.warning("Could not generate recommendations. Try a more specific role name.")
        return

    _PROG_ICONS = {
        "MS_Business_Intelligence_and_Analytics": "📊",
        "ME_Robotics": "🤖",
        "MS_Applied_Artificial_Intelligence": "🧠",
    }

    st.markdown(_ROADMAP_CSS, unsafe_allow_html=True)
    st.markdown(f'<div class="rm-role-tag">🎯 {target_role}</div>', unsafe_allow_html=True)

    for prog_key, prog_recs in recommendations.items():
        prog_label = _STEVENS_PROGRAM_LABELS.get(prog_key, prog_key)
        icon       = _PROG_ICONS.get(prog_key, "🎓")
        req_map    = _DEGREE_REQUIREMENTS.get(prog_key, {})
        prog_total = courses_data["programs"][prog_key].get("total_credits_required", 30)
        pools      = prog_recs.get("pools", {})

        # ── Credit total (project_and_thesis always counted at 6 cr) ─────
        total_cr = 0
        for pool_name, codes in pools.items():
            if pool_name == "project_and_thesis":
                total_cr += req_map.get("project_and_thesis", {}).get("credits", 6)
            else:
                for code in codes:
                    c, _ = _lookup_course(courses_data, prog_key, code)
                    total_cr += _parse_credits(c.get("credits", 3)) if c else 3

        complete   = total_cr >= prog_total
        pct        = min(total_cr / prog_total, 1.0)
        credit_cls = "rm-credit-ok" if complete else "rm-credit-warn"
        credit_txt = f"{'✓' if complete else '⚠'} {total_cr} / {prog_total} cr"

        rec_conc  = prog_recs.get("recommended_concentration", "").replace("_", " ").title()
        rec_track = prog_recs.get("recommended_track", "").replace("_", " ").title()
        meta      = "  ·  ".join(p for p in [rec_conc, rec_track] if p)

        with st.expander(f"{icon}  {prog_label}", expanded=True):
            reasoning = prog_recs.get("reasoning", "")
            if reasoning:
                st.caption(reasoning)
            if meta:
                st.markdown(f'<div class="rm-meta">{meta}</div>', unsafe_allow_html=True)

            # Credit progress bar
            bar_col, lbl_col = st.columns([4, 1])
            with bar_col:
                st.progress(pct)
            with lbl_col:
                st.markdown(
                    f'<div style="padding-top:4px"><span class="{credit_cls}">{credit_txt}</span></div>',
                    unsafe_allow_html=True,
                )

            # ── Pool sections ─────────────────────────────────────────────
            for pool_name in _POOL_DISPLAY_ORDER.get(prog_key, list(pools.keys())):
                codes = pools.get(pool_name, [])
                if not codes:
                    continue

                req       = req_map.get(pool_name, {})
                req_n     = req.get("courses", len(codes))
                req_cr    = req.get("credits", "?")
                pool_ok   = len(codes) == req_n
                color     = _POOL_COLORS.get(pool_name, "#3b82f6")
                badge_cls = "rm-badge-ok" if pool_ok else "rm-badge-warn"
                badge_txt = f"✓ {len(codes)}/{req_n}  ·  {req_cr} cr" if pool_ok else f"⚠ {len(codes)}/{req_n} courses"
                label     = _POOL_LABELS.get(pool_name, pool_name.replace("_", " ").title())

                st.markdown(
                    f'<div class="rm-pool-bar" style="border-left-color:{color}">'
                    f'<span class="rm-pool-name">{label}</span>'
                    f'<span class="rm-pool-badge {badge_cls}">{badge_txt}</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                for code in codes:
                    course, _ = _lookup_course(courses_data, prog_key, code)
                    if course:
                        offered = (course.get("typically_offered") or "").split(",")[0] or "N/A"
                        cr      = _parse_credits(course.get("credits", 3))
                        with st.expander(f"{code}  —  {course['name']}", expanded=False):
                            st.markdown(
                                f'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
                                f'<span class="rm-code">{code}</span>'
                                f'<span class="rm-cr">{cr} cr</span>'
                                f'<span class="rm-off">{offered}</span>'
                                f'</div>'
                                f'<div class="rm-desc">'
                                f'{course.get("description","No description available.")}'
                                f'</div>',
                                unsafe_allow_html=True,
                            )
                    else:
                        st.markdown(
                            f'<div style="font-size:11px;color:#475569;padding:3px 0 3px 4px">· {code}</div>',
                            unsafe_allow_html=True,
                        )


def main():
    st.set_page_config(page_title="LazyZeszy", page_icon="🤖", layout="wide")

    # Initialize accessibility tracker in session state
    if 'accessibility_tracker' not in st.session_state:
        st.session_state.accessibility_tracker = None
    if 'accessibility_active' not in st.session_state:
        st.session_state.accessibility_active = False
    if 'accessibility_api' not in st.session_state:
        st.session_state.accessibility_api = None
    if 'target_role' not in st.session_state:
        st.session_state.target_role = ""
    if 'selected_degree_key' not in st.session_state:
        st.session_state.selected_degree_key = None
    if 'course_recommendations' not in st.session_state:
        st.session_state.course_recommendations = {}
    if 'stevens_courses_data' not in st.session_state:
        st.session_state.stevens_courses_data = _load_stevens_courses()

    # Consolidated CSS
    st.markdown("""
        <style>
            /* Button styling */
            .stButton>button {
                border-radius: 8px;
                width: 100%;
                height: 50px;
                margin-bottom: 8px;
                padding: 8px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                line-height: 1.2;
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
            }

            /* Special styling for Play Learning Game button to keep it larger */
            .stButton>button:contains("🎮") {
                height: auto;
                padding: 12px 16px;
                font-size: 16px;
            }

            /* Sidebar Lottie positioning */
            section[data-testid="stSidebar"] {
                position: relative;
            }
            .lottie-bottom {
                position: absolute;
                bottom: 20px;
                left: 0;
                right: 0;
            }

            /* Un-fix the chat input */
            .st-emotion-cache-1xw8zd0.e1d2x3se3 {
                position: static;
            }

            /* Accessibility toggle styling */
            .accessibility-toggle {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999;
                background: white;
                border-radius: 10px;
                padding: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
        </style>
    """, unsafe_allow_html=True)

    # Accessibility Toggle in Header
    col_title, col_toggle = st.columns([4, 1])

    with col_title:
        st.title("⚡ Steve")
        st.subheader("Impart knowledge from Mount Olympus!")

    with col_toggle:
        st.markdown("<br>", unsafe_allow_html=True)  # Add spacing

        # Accessibility Toggle Button
        accessibility_toggle = st.toggle(
            "🧠 Analytics",
            value=st.session_state.accessibility_active,
            help="Toggle accessibility tracking and analytics"
        )

        # Handle toggle state changes
        if accessibility_toggle != st.session_state.accessibility_active:
            if accessibility_toggle:
                # Start tracking
                try:
                    st.session_state.accessibility_api = FlaskAccessibilityAPI()
                    st.session_state.accessibility_tracker = st.session_state.accessibility_api.tracker

                    # Start with demo data for immediate results
                    st.session_state.accessibility_api.simulate_demo_data(duration_minutes=1)

                    # Start actual tracking
                    result = st.session_state.accessibility_api.start_tracking()
                    if result['status'] == 'success':
                        st.session_state.accessibility_active = True
                        st.success("🧠 Accessibility tracking started!")
                    else:
                        # If camera fails, use demo mode
                        st.session_state.accessibility_active = True
                        st.info("🧠 Accessibility tracking started in demo mode!")

                except Exception as e:
                    st.error(f"Failed to start tracking: {str(e)}")
                    # Fallback to tracker without camera
                    st.session_state.accessibility_tracker = AdaptiveLearningCV()
                    st.session_state.accessibility_active = True
                    st.info("🧠 Accessibility tracking started in offline mode!")
            else:
                # Stop tracking and generate report
                if st.session_state.accessibility_api:
                    st.session_state.accessibility_api.stop_tracking()

                # Generate PDF report automatically
                if st.session_state.accessibility_tracker:
                    with st.spinner("Generating accessibility analytics report..."):
                        if generate_accessibility_report():
                            st.success("📄 Accessibility report generated!")

                st.session_state.accessibility_active = False
                st.info("🧠 Accessibility tracking stopped and report generated!")

    if not check_hf():
        return

    with st.sidebar:
        # ── Course Advisor ────────────────────────────────────────────────────
        st.header("🎯 Course Advisor")

        _DEGREE_OPTIONS = {
            "All Programs": None,
            "📊 MS Business Intelligence & Analytics": "MS_Business_Intelligence_and_Analytics",
            "🤖 ME Robotics": "ME_Robotics",
            "🧠 MS Applied AI": "MS_Applied_Artificial_Intelligence",
        }
        selected_degree_label = st.selectbox(
            "Select degree program",
            options=list(_DEGREE_OPTIONS.keys()),
            key="selected_degree_label",
        )
        selected_degree_key = _DEGREE_OPTIONS[selected_degree_label]

        role_input = st.text_input(
            "Your target role",
            value=st.session_state.target_role,
            placeholder="e.g., Data Scientist, ML Engineer, Robotics Engineer...",
            key="role_input_field",
        )
        if st.button("Get Course Roadmap", type="primary", key="get_roadmap_btn"):
            if not role_input.strip():
                st.warning("Please enter a target role first.")
            elif not st.session_state.stevens_courses_data:
                st.error("Could not load course data. Check that stevens_courses.json exists.")
            else:
                st.session_state.target_role = role_input.strip()
                st.session_state.selected_degree_key = selected_degree_key
                with st.spinner("Building your personalized course roadmap..."):
                    recs = _recommend_courses_for_role(
                        st.session_state.target_role,
                        st.session_state.stevens_courses_data,
                        degree_filter=selected_degree_key,
                    )
                st.session_state.course_recommendations = recs
                st.rerun()

        if st.session_state.course_recommendations and st.session_state.stevens_courses_data:
            _render_course_roadmap(
                st.session_state.course_recommendations,
                st.session_state.stevens_courses_data,
                st.session_state.target_role,
            )

        # ── Document Upload ───────────────────────────────────────────────────
        st.divider()
        st.header("📄 Upload Document")
        uploaded_file = st.file_uploader(
            "Choose a file",
            type=["pdf", "docx", "txt"],
            help="Upload a PDF, Word document, or text file"
        )

        if uploaded_file:
            st.success(f"✅ Uploaded: {uploaded_file.name}")

        with st.container():
            st.markdown('<div class="lottie-bottom">', unsafe_allow_html=True)
            lottie_url = "https://lottie.host/386084db-01c7-46ea-94ee-a61f78d0d5b6/1BeZ2kxvLW.json"
            lottie_json = load_lottieurl(lottie_url)
            if lottie_json:
                st_lottie(lottie_json, height=200)
            st.markdown('</div>', unsafe_allow_html=True)

    if "messages" not in st.session_state:
        st.session_state.messages = []

    if "document_text" not in st.session_state:
        st.session_state.document_text = ""

    if uploaded_file and st.session_state.document_text == "":
        with st.spinner("Processing document..."):
            document_text = process_uploaded_file(uploaded_file)
            if document_text:
                st.session_state.document_text = document_text

                # Generate automatic summary
                with st.spinner("Generating document summary..."):
                    try:
                        summary_prompt = f"""
                        Please provide a detailed summary of the following document. Include:
                        1. Main topic/subject
                        2. Key points and themes
                        3. Important details or findings
                        4. Structure and organization
                        5. Any notable conclusions or recommendations

                        Document Content:
                        {document_text}

                        Please make the summary comprehensive but concise.
                        """

                        summary = call_hf(summary_prompt, MODEL_GENERAL)

                        # Add summary as assistant message
                        st.session_state.messages.append({
                            "role": "assistant",
                            "content": f"📄 **Document Summary for {uploaded_file.name}:**\n\n{summary}"
                        })
                    except Exception as e:
                        st.error(f"Error generating summary: {str(e)}")

                st.rerun()

    col1, col2 = st.columns([2, 1])

    with col1:
        # Display chat messages from history
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

        # ── Voice input via AssemblyAI ────────────────────────────────────────
        with st.expander("🎤 Voice Input (speak your question)", expanded=False):
            recorded_audio = st.audio_input("Record your question")
            if recorded_audio is not None:
                if not st.session_state.document_text:
                    st.warning("Please upload a document first!")
                else:
                    with st.spinner("Transcribing with AssemblyAI..."):
                        transcript = transcribe_audio_assemblyai(recorded_audio.getvalue())
                    if transcript:
                        st.success(f"Transcribed: **{transcript}**")
                        if st.button("Send transcribed question to Hera", key="send_voice"):
                            st.session_state.messages.append({"role": "user", "content": transcript})
                            with st.spinner("Thinking..."):
                                try:
                                    full_prompt = f"""
                                    Based on the following document content, please answer the user's question:

                                    Document Content:
                                    {st.session_state.document_text}

                                    User Question: {transcript}

                                    Please provide a helpful and accurate answer based only on the information in the document. If the answer cannot be found in the document, please say so.
                                    """
                                    answer = call_hf(full_prompt, MODEL_GENERAL)
                                    st.session_state.messages.append({"role": "assistant", "content": answer})
                                except Exception as e:
                                    st.error(f"Error generating response: {str(e)}")
                            st.rerun()

        # Chat input logic
        if prompt := st.chat_input("Ask a question about your document..."):
            if not st.session_state.document_text:
                st.warning("Please upload a document first!")
            else:
                st.session_state.messages.append({"role": "user", "content": prompt})

                with st.spinner("Thinking..."):
                    try:
                        full_prompt = f"""
                        Based on the following document content, please answer the user's question:

                        Document Content:
                        {st.session_state.document_text}

                        User Question: {prompt}

                        Please provide a helpful and accurate answer based only on the information in the document. If the answer cannot be found in the document, please say so.
                        """

                        answer = call_hf(full_prompt, MODEL_GENERAL)
                        st.session_state.messages.append({"role": "assistant", "content": answer})
                    except Exception as e:
                        st.error(f"Error generating response: {str(e)}")
                
                st.rerun()

    with col2:
        st.write("### Actions")
        b_col1, b_col2 = st.columns(2, gap="small")
        with b_col1:
            if st.button("🎵 AudioBook", width='stretch'):
                if synthesize_audio_from_document():
                    st.rerun()
            if st.button("📚 FlashCard", width='stretch'):
                if generate_flashcards():
                    st.rerun()
            if st.button("🧠 Quizz", width='stretch'):
                if generate_quiz():
                    st.rerun()
        with b_col2:
            if st.button("🗺️ Roadmap", width='stretch'):
                if generate_document_roadmap():
                    st.rerun()
            if st.button("📄 StudyGuide", width='stretch'):
                if generate_comprehensive_pdf():
                    st.rerun()
            if st.button("🎬 AI Video", help="Generate video with Veo 3.0 (requires billing)", width='stretch'):
                if generate_ai_video():
                    st.rerun()

        # Educational Game Button
        if st.button("🎮 Educational Game", width='stretch', help="Launch interactive maze game based on your document"):
            if launch_educational_game():
                st.rerun()

        # Show real-time analytics if tracking is active
        if st.session_state.accessibility_active and st.session_state.accessibility_tracker:
            st.write("### 🧠 Live Analytics")

            try:
                # Get current analytics data
                analytics_data = st.session_state.accessibility_tracker.analytics_data

                if analytics_data['timestamps']:
                    # Create real-time metrics display
                    latest_data = {
                        'stress': analytics_data['stress_levels'][-1] if analytics_data['stress_levels'] else 0,
                        'attention': analytics_data['attention_scores'][-1] if analytics_data['attention_scores'] else 70,
                        'engagement': analytics_data['engagement_levels'][-1] if analytics_data['engagement_levels'] else 50,
                        'emotion': analytics_data['emotions'][-1] if analytics_data['emotions'] else 'neutral'
                    }

                    # Display metrics with color coding
                    stress_color = "🔴" if latest_data['stress'] > 70 else "🟡" if latest_data['stress'] > 40 else "🟢"
                    attention_color = "🟢" if latest_data['attention'] > 70 else "🟡" if latest_data['attention'] > 50 else "🔴"
                    engagement_color = "🟢" if latest_data['engagement'] > 70 else "🟡" if latest_data['engagement'] > 50 else "🔴"

                    st.write(f"{stress_color} **Stress:** {latest_data['stress']:.0f}%")
                    st.write(f"{attention_color} **Attention:** {latest_data['attention']:.0f}%")
                    st.write(f"{engagement_color} **Engagement:** {latest_data['engagement']:.0f}%")
                    st.write(f"😊 **Emotion:** {latest_data['emotion'].title()}")

                    # Show mini timeline graph
                    if len(analytics_data['timestamps']) > 5:
                        recent_count = min(10, len(analytics_data['timestamps']))
                        fig = go.Figure()

                        fig.add_trace(go.Scatter(
                            y=analytics_data['stress_levels'][-recent_count:],
                            mode='lines',
                            name='Stress',
                            line=dict(color='red', width=2)
                        ))

                        fig.add_trace(go.Scatter(
                            y=analytics_data['attention_scores'][-recent_count:],
                            mode='lines',
                            name='Attention',
                            line=dict(color='blue', width=2)
                        ))

                        fig.add_trace(go.Scatter(
                            y=analytics_data['engagement_levels'][-recent_count:],
                            mode='lines',
                            name='Engagement',
                            line=dict(color='green', width=2)
                        ))

                        fig.update_layout(
                            height=200,
                            margin=dict(t=20, b=20, l=20, r=20),
                            showlegend=False,
                            xaxis=dict(showticklabels=False),
                            yaxis=dict(range=[0, 100])
                        )

                        st.plotly_chart(fig, width='stretch')

            except Exception as e:
                st.write("📊 Analytics initializing...")

        lottie_url_2 = "https://lottie.host/3ae4f794-0101-499b-888f-3743146d410e/ntRtMqOUj0.json"
        lottie_json_2 = load_lottieurl(lottie_url_2)
        if lottie_json_2:
            st_lottie(lottie_json_2, height=200)

    # Show audio player if AudioBook is ready
    if st.session_state.get('show_audio_player', False):
        st.success("🎵 Your AudioBook is ready!")
        st.audio(st.session_state.audio_data, format="audio/mp3")
        st.download_button(
            label="📥 Download AudioBook MP3",
            data=st.session_state.audio_data,
            file_name="audiobook.mp3",
            mime="audio/mpeg",
            width='stretch',
        )
        if st.button("❌ Close AudioBook"):
            st.session_state.show_audio_player = False
            st.rerun()

    # Show PDF download button if PDF is ready
    if st.session_state.get('show_pdf_download', False):
        st.success("✅ Your comprehensive study guide PDF is ready!")
        st.download_button(
            label="📥 Download Study Guide PDF",
            data=st.session_state.pdf_data,
            file_name="comprehensive_study_guide.pdf",
            mime="application/pdf",
            width='stretch'
        )
        if st.button("❌ Close Download"):
            st.session_state.show_pdf_download = False
            st.rerun()

    # Show video download button if video is ready
    if st.session_state.get('show_video_download', False):
        st.success("🎬 Your AI-generated video is ready!")
        st.download_button(
            label="📥 Download AI Video",
            data=st.session_state.video_data,
            file_name=st.session_state.get('video_filename', 'zeuzy_video.mp4'),
            mime="video/mp4",
            width='stretch'
        )
        if st.button("❌ Close Video Download"):
            st.session_state.show_video_download = False
            st.rerun()

    # Show accessibility report download button if report is ready
    if st.session_state.get('show_accessibility_pdf_download', False):
        st.success("🧠 Your accessibility analytics report is ready!")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        st.download_button(
            label="📥 Download Accessibility Report",
            data=st.session_state.accessibility_pdf_data,
            file_name=f"accessibility_report_{timestamp}.pdf",
            mime="application/pdf",
            width='stretch'
        )
        if st.button("❌ Close Accessibility Download"):
            st.session_state.show_accessibility_pdf_download = False
            st.rerun()


    # Show flashcards popup if flashcards are generated
    if st.session_state.get('show_flashcards', False):
        show_flashcards_popup()

    # Show quiz popup if quiz is generated
    if st.session_state.get('show_quiz', False):
        show_quiz_popup()

if __name__ == "__main__":
    main()