
# GEMINI.md

## Project Overview

This project is a Streamlit web application called "Hera - Greek Goddesses RAG Assistant". It's designed as a beautiful, interactive learning tool with a Greek mythology theme. The core feature is a Retrieval-Augmented Generation (RAG) chatbot named Hera that can answer questions based on uploaded documents (PDF, DOCX, and TXT). The application uses the Gemini API for its generative AI capabilities.

The user interface is styled with a Greek-inspired theme, including custom fonts and Lottie animations. It features a 2x3 grid of "Learning Widgets" that hint at functionalities like video generation, audio content creation, flashcards, quizzes, reports, and exercises.

## Building and Running

To run this application, you need to have Python and the dependencies listed in `requirements.txt` installed.

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up your environment:**
    Create a `.env` file in the root of the project and add your Gemini API key like this:
    ```
    GEMINI_API_KEY="YOUR_API_KEY"
    ```

3.  **Run the application:**
    ```bash
    streamlit run app.py
    ```

## Development Conventions

*   **Technology Stack:** The application is built with Python and Streamlit. It uses the `google-generativeai` library to interact with the Gemini API.
*   **File Handling:** The application can process PDF, DOCX, and TXT files. The text extraction logic is in the `process_uploaded_file` function in `app.py`.
*   **Styling:** The application uses custom CSS injected via `st.markdown` to create its unique theme.
*   **State Management:** Streamlit's `session_state` is used to maintain chat history and the content of the uploaded document.
*   **Modularity:** The `README.md` suggests a more modular structure with `hera_app.py` and `run_hera.py`, but the current implementation is a single script (`app.py`). Future development could involve refactoring the code into smaller, more manageable modules.
