"""
Steve Educational Maze Game
A dynamic Pygame-based learning game that adapts to any document content.

Features:
- Audio narration of document summary
- Maze based on document roadmap
- Quizzes at leaf nodes
- Flashcards at intermediate nodes
- Final explanation assessment with AI scoring
"""

import pygame
import sys
import json
import random
import threading
import time
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any
import google.generativeai as genai
from dotenv import load_dotenv
import os
import tempfile
import subprocess
from pathlib import Path

# Initialize environment
load_dotenv()

# Constants
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800
FPS = 60

# Colors (Greek mythology themed)
COLORS = {
    'background': (25, 35, 50),      # Dark blue-gray
    'wall': (139, 122, 80),          # Golden brown
    'path': (240, 240, 230),         # Off-white
    'player': (255, 215, 0),         # Gold
    'quiz_node': (220, 20, 60),      # Crimson
    'flashcard_node': (70, 130, 180), # Steel blue
    'goal': (50, 205, 50),           # Lime green
    'text': (255, 255, 255),         # White
    'ui_bg': (45, 55, 70),          # Dark gray-blue
    'button': (100, 149, 237),       # Cornflower blue
    'button_hover': (65, 105, 225),  # Royal blue
}

# Game States
class GameState:
    INTRO = "intro"
    MAZE = "maze"
    QUIZ = "quiz"
    FLASHCARD = "flashcard"
    EXPLANATION = "explanation"
    RESULTS = "results"
    PAUSED = "paused"

@dataclass
class GameNode:
    """Represents a node in the learning maze"""
    id: str
    title: str
    content: str
    node_type: str  # 'quiz', 'flashcard', 'goal'
    position: Tuple[int, int]
    connections: List[str] = field(default_factory=list)
    data: Dict[str, Any] = field(default_factory=dict)  # Quiz questions, flashcard data, etc.

@dataclass
class Player:
    """Player character in the maze"""
    x: int
    y: int
    size: int = 20
    speed: int = 2
    visited_nodes: List[str] = field(default_factory=list)
    score: int = 0
    current_node: Optional[str] = None

class AudioManager:
    """Handles audio playback for narration and sound effects"""

    def __init__(self):
        pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
        self.current_audio = None
        self.is_playing = False

    def text_to_speech(self, text: str, filename: str = "narration.wav") -> str:
        """Convert text to speech using TTS and save as audio file"""
        try:
            # Use Windows SAPI for TTS (cross-platform alternative would be gTTS)
            import pyttsx3
            engine = pyttsx3.init()
            engine.setProperty('rate', 150)  # Speed of speech
            engine.setProperty('volume', 0.8)  # Volume level

            # Set voice to a pleasant one if available
            voices = engine.getProperty('voices')
            if voices:
                # Try to find a female voice for better learning experience
                for voice in voices:
                    if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                        engine.setProperty('voice', voice.id)
                        break
                else:
                    engine.setProperty('voice', voices[0].id)

            temp_dir = tempfile.gettempdir()
            audio_path = os.path.join(temp_dir, filename)
            engine.save_to_file(text, audio_path)
            engine.runAndWait()

            return audio_path
        except Exception as e:
            print(f"TTS Error: {e}")
            return None

    def play_audio(self, audio_path: str):
        """Play audio file"""
        try:
            if audio_path and os.path.exists(audio_path):
                self.current_audio = pygame.mixer.Sound(audio_path)
                self.current_audio.play()
                self.is_playing = True
        except Exception as e:
            print(f"Audio playback error: {e}")

    def stop_audio(self):
        """Stop current audio"""
        if self.current_audio:
            self.current_audio.stop()
            self.is_playing = False

    def is_audio_playing(self) -> bool:
        """Check if audio is currently playing"""
        return pygame.mixer.get_busy()

class MazeGenerator:
    """Generates a maze based on document roadmap structure"""

    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.grid = [[1 for _ in range(width)] for _ in range(height)]  # 1 = wall, 0 = path
        self.nodes: List[GameNode] = []

    def generate_from_roadmap(self, roadmap_data: Dict[str, Any]) -> List[GameNode]:
        """Generate maze structure from document roadmap"""
        try:
            # Create a simple but engaging maze layout
            self._create_base_maze()

            # Place nodes based on roadmap structure
            nodes = self._place_nodes_from_roadmap(roadmap_data)

            # Connect nodes with paths
            self._connect_nodes(nodes)

            return nodes

        except Exception as e:
            print(f"Maze generation error: {e}")
            return self._create_default_maze()

    def _create_base_maze(self):
        """Create basic maze structure"""
        # Initialize all as walls
        self.grid = [[1 for _ in range(self.width)] for _ in range(self.height)]

        # Create main path
        for y in range(1, self.height - 1, 2):
            for x in range(1, self.width - 1, 2):
                self.grid[y][x] = 0  # Path

                # Add random connections
                if random.random() > 0.3:
                    if x < self.width - 2:
                        self.grid[y][x + 1] = 0
                    if y < self.height - 2:
                        self.grid[y + 1][x] = 0

    def _place_nodes_from_roadmap(self, roadmap_data: Dict[str, Any]) -> List[GameNode]:
        """Place game nodes based on roadmap structure"""
        nodes = []

        # Extract content sections from roadmap
        sections = roadmap_data.get('sections', [])
        if not sections:
            # Fallback: create nodes from basic structure
            sections = [
                {"title": "Introduction", "type": "flashcard", "content": "Starting point"},
                {"title": "Main Concept", "type": "flashcard", "content": "Core learning"},
                {"title": "Practice", "type": "quiz", "content": "Test knowledge"},
                {"title": "Goal", "type": "goal", "content": "Final destination"}
            ]

        # Place nodes throughout the maze
        available_positions = []
        for y in range(1, self.height - 1, 4):
            for x in range(1, self.width - 1, 4):
                if self.grid[y][x] == 0:  # Path position
                    available_positions.append((x, y))

        random.shuffle(available_positions)

        for i, section in enumerate(sections[:len(available_positions)]):
            pos = available_positions[i]
            node_type = section.get('type', 'flashcard')

            # Ensure we have quiz nodes at leaf positions
            if i == len(sections) - 2:  # Second to last
                node_type = 'quiz'
            elif i == len(sections) - 1:  # Last
                node_type = 'goal'

            node = GameNode(
                id=f"node_{i}",
                title=section.get('title', f'Section {i+1}'),
                content=section.get('content', ''),
                node_type=node_type,
                position=pos,
                data=section.get('data', {})
            )
            nodes.append(node)

        return nodes

    def _connect_nodes(self, nodes: List[GameNode]):
        """Create connections between nodes"""
        for i in range(len(nodes) - 1):
            current = nodes[i]
            next_node = nodes[i + 1]
            current.connections.append(next_node.id)

            # Create path between nodes
            self._create_path_between(current.position, next_node.position)

    def _create_path_between(self, pos1: Tuple[int, int], pos2: Tuple[int, int]):
        """Create a clear path between two positions"""
        x1, y1 = pos1
        x2, y2 = pos2

        # Simple L-shaped path
        current_x, current_y = x1, y1

        # Move horizontally first
        while current_x != x2:
            self.grid[current_y][current_x] = 0
            current_x += 1 if x2 > x1 else -1

        # Move vertically
        while current_y != y2:
            self.grid[current_y][current_x] = 0
            current_y += 1 if y2 > y1 else -1

        # Ensure destination is clear
        self.grid[y2][x2] = 0

    def _create_default_maze(self) -> List[GameNode]:
        """Create a default maze if roadmap parsing fails"""
        # Simple linear maze
        nodes = [
            GameNode("start", "Start", "Begin your journey", "flashcard", (2, 2)),
            GameNode("middle", "Learn", "Study the concepts", "flashcard", (10, 5)),
            GameNode("test", "Test", "Answer questions", "quiz", (18, 8)),
            GameNode("goal", "Complete", "Explain what you learned", "goal", (25, 10))
        ]

        # Connect nodes
        for i in range(len(nodes) - 1):
            nodes[i].connections.append(nodes[i + 1].id)

        return nodes

class QuizSystem:
    """Handles quiz interactions at leaf nodes"""

    def __init__(self, font):
        self.font = font
        self.current_quiz = None
        self.current_question = 0
        self.user_answers = []
        self.score = 0

    def load_quiz(self, quiz_data: Dict[str, Any]):
        """Load quiz questions for current node"""
        self.current_quiz = quiz_data.get('questions', [])
        self.current_question = 0
        self.user_answers = []
        self.score = 0

        # If no quiz data provided, create default questions
        if not self.current_quiz:
            self.current_quiz = [
                {
                    "question": "What is the main topic of this section?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct": 0
                }
            ]

    def render_quiz(self, screen, node: GameNode):
        """Render quiz interface"""
        if not self.current_quiz or self.current_question >= len(self.current_quiz):
            return False

        question_data = self.current_quiz[self.current_question]

        # Background
        pygame.draw.rect(screen, COLORS['ui_bg'], (100, 100, WINDOW_WIDTH - 200, WINDOW_HEIGHT - 200))
        pygame.draw.rect(screen, COLORS['text'], (100, 100, WINDOW_WIDTH - 200, WINDOW_HEIGHT - 200), 3)

        # Title
        title_text = self.font.render(f"Quiz: {node.title}", True, COLORS['text'])
        screen.blit(title_text, (120, 120))

        # Question
        question_text = question_data['question']
        y_offset = 180

        # Wrap question text
        words = question_text.split()
        lines = []
        current_line = ""

        for word in words:
            test_line = current_line + word + " "
            if self.font.size(test_line)[0] < WINDOW_WIDTH - 280:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word + " "
        if current_line:
            lines.append(current_line)

        for line in lines:
            text = self.font.render(line, True, COLORS['text'])
            screen.blit(text, (120, y_offset))
            y_offset += 30

        # Options
        y_offset += 20
        option_rects = []

        for i, option in enumerate(question_data['options']):
            rect = pygame.Rect(120, y_offset, WINDOW_WIDTH - 280, 40)
            color = COLORS['button_hover'] if rect.collidepoint(pygame.mouse.get_pos()) else COLORS['button']
            pygame.draw.rect(screen, color, rect)
            pygame.draw.rect(screen, COLORS['text'], rect, 2)

            option_text = self.font.render(f"{chr(65 + i)}) {option}", True, COLORS['text'])
            screen.blit(option_text, (rect.x + 10, rect.y + 10))

            option_rects.append(rect)
            y_offset += 50

        # Progress
        progress_text = self.font.render(f"Question {self.current_question + 1} of {len(self.current_quiz)}", True, COLORS['text'])
        screen.blit(progress_text, (120, WINDOW_HEIGHT - 150))

        return option_rects

    def handle_answer(self, selected_option: int) -> bool:
        """Handle quiz answer selection"""
        if not self.current_quiz:
            return True

        question_data = self.current_quiz[self.current_question]
        correct_answer = question_data['correct']

        self.user_answers.append(selected_option)

        if selected_option == correct_answer:
            self.score += 1

        self.current_question += 1

        # Check if quiz is complete
        return self.current_question >= len(self.current_quiz)

class FlashcardSystem:
    """Handles flashcard interactions at intermediate nodes"""

    def __init__(self, font):
        self.font = font
        self.current_cards = []
        self.current_card = 0
        self.show_answer = False

    def load_flashcards(self, flashcard_data: Dict[str, Any]):
        """Load flashcards for current node"""
        self.current_cards = flashcard_data.get('cards', [])
        self.current_card = 0
        self.show_answer = False

        # Default flashcard if none provided
        if not self.current_cards:
            self.current_cards = [
                {
                    "question": "Key Concept",
                    "answer": "This is an important concept to remember."
                }
            ]

    def render_flashcard(self, screen, node: GameNode):
        """Render flashcard interface"""
        if not self.current_cards:
            return []

        card_data = self.current_cards[self.current_card]

        # Background
        pygame.draw.rect(screen, COLORS['ui_bg'], (150, 150, WINDOW_WIDTH - 300, WINDOW_HEIGHT - 300))
        pygame.draw.rect(screen, COLORS['text'], (150, 150, WINDOW_WIDTH - 300, WINDOW_HEIGHT - 300), 3)

        # Title
        title_text = self.font.render(f"Flashcard: {node.title}", True, COLORS['text'])
        screen.blit(title_text, (170, 170))

        # Card content
        y_offset = 220

        if not self.show_answer:
            # Show question
            content = card_data['question']
            label = "Question:"
        else:
            # Show answer
            content = card_data['answer']
            label = "Answer:"

        label_text = self.font.render(label, True, COLORS['text'])
        screen.blit(label_text, (170, y_offset))
        y_offset += 40

        # Wrap content text
        words = content.split()
        lines = []
        current_line = ""

        for word in words:
            test_line = current_line + word + " "
            if self.font.size(test_line)[0] < WINDOW_WIDTH - 380:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word + " "
        if current_line:
            lines.append(current_line)

        for line in lines:
            text = self.font.render(line, True, COLORS['text'])
            screen.blit(text, (170, y_offset))
            y_offset += 25

        # Buttons
        buttons = []
        button_y = WINDOW_HEIGHT - 200

        if not self.show_answer:
            flip_rect = pygame.Rect(200, button_y, 150, 40)
            color = COLORS['button_hover'] if flip_rect.collidepoint(pygame.mouse.get_pos()) else COLORS['button']
            pygame.draw.rect(screen, color, flip_rect)
            pygame.draw.rect(screen, COLORS['text'], flip_rect, 2)
            flip_text = self.font.render("Show Answer", True, COLORS['text'])
            screen.blit(flip_text, (flip_rect.x + 10, flip_rect.y + 10))
            buttons.append(('flip', flip_rect))
        else:
            next_rect = pygame.Rect(200, button_y, 100, 40)
            color = COLORS['button_hover'] if next_rect.collidepoint(pygame.mouse.get_pos()) else COLORS['button']
            pygame.draw.rect(screen, color, next_rect)
            pygame.draw.rect(screen, COLORS['text'], next_rect, 2)
            next_text = self.font.render("Next", True, COLORS['text'])
            screen.blit(next_text, (next_rect.x + 25, next_rect.y + 10))
            buttons.append(('next', next_rect))

            if self.current_card < len(self.current_cards) - 1:
                continue_rect = pygame.Rect(320, button_y, 100, 40)
                color = COLORS['button_hover'] if continue_rect.collidepoint(pygame.mouse.get_pos()) else COLORS['button']
                pygame.draw.rect(screen, color, continue_rect)
                pygame.draw.rect(screen, COLORS['text'], continue_rect, 2)
                continue_text = self.font.render("Continue", True, COLORS['text'])
                screen.blit(continue_text, (continue_rect.x + 10, continue_rect.y + 10))
                buttons.append(('continue', continue_rect))
            else:
                done_rect = pygame.Rect(320, button_y, 100, 40)
                color = COLORS['button_hover'] if done_rect.collidepoint(pygame.mouse.get_pos()) else COLORS['button']
                pygame.draw.rect(screen, color, done_rect)
                pygame.draw.rect(screen, COLORS['text'], done_rect, 2)
                done_text = self.font.render("Done", True, COLORS['text'])
                screen.blit(done_text, (done_rect.x + 25, done_rect.y + 10))
                buttons.append(('done', done_rect))

        # Progress
        progress_text = self.font.render(f"Card {self.current_card + 1} of {len(self.current_cards)}", True, COLORS['text'])
        screen.blit(progress_text, (170, WINDOW_HEIGHT - 120))

        return buttons

    def handle_action(self, action: str) -> bool:
        """Handle flashcard interactions"""
        if action == 'flip':
            self.show_answer = True
        elif action == 'next':
            self.current_card = min(self.current_card + 1, len(self.current_cards) - 1)
            self.show_answer = False
        elif action == 'continue':
            return True  # Continue to next node
        elif action == 'done':
            return True  # Complete flashcards

        return False

class EducationalGame:
    """Main game class that orchestrates the educational maze experience"""

    def __init__(self, document_data: Dict[str, Any]):
        # Initialize Pygame
        pygame.init()

        # Set up display
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("Steve Educational Maze")

        # Clock for FPS
        self.clock = pygame.time.Clock()

        # Fonts
        self.font = pygame.font.Font(None, 24)
        self.large_font = pygame.font.Font(None, 48)
        self.small_font = pygame.font.Font(None, 18)

        # Game state
        self.state = GameState.INTRO
        self.running = True

        # Document data
        self.document_data = document_data

        # Game components
        self.audio_manager = AudioManager()
        self.maze_generator = MazeGenerator(30, 20)
        self.quiz_system = QuizSystem(self.font)
        self.flashcard_system = FlashcardSystem(self.font)

        # Game objects
        self.player = Player(2, 2)  # Start position
        self.nodes: List[GameNode] = []
        self.current_node: Optional[GameNode] = None

        # UI state
        self.intro_complete = False
        self.explanation_text = ""
        self.final_score = 0

        # Generate game content
        self._generate_game_content()

    def _generate_game_content(self):
        """Generate game content from document data"""
        try:
            # Generate maze and nodes
            roadmap_data = self.document_data.get('roadmap', {})
            self.nodes = self.maze_generator.generate_from_roadmap(roadmap_data)

            # Set player start position
            if self.nodes:
                start_node = self.nodes[0]
                self.player.x, self.player.y = start_node.position

            # Generate audio narration
            summary = self.document_data.get('summary', 'Welcome to the educational maze game!')
            audio_path = self.audio_manager.text_to_speech(summary, "intro_narration.wav")
            if audio_path:
                self.intro_audio_path = audio_path

        except Exception as e:
            print(f"Content generation error: {e}")
            self._create_fallback_content()

    def _create_fallback_content(self):
        """Create fallback content if generation fails"""
        self.nodes = self.maze_generator._create_default_maze()
        if self.nodes:
            self.player.x, self.player.y = self.nodes[0].position

    def run(self):
        """Main game loop"""
        while self.running:
            self._handle_events()
            self._update()
            self._render()
            self.clock.tick(FPS)

        pygame.quit()

    def _handle_events(self):
        """Handle pygame events"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False

            elif event.type == pygame.KEYDOWN:
                if self.state == GameState.INTRO:
                    if event.key == pygame.K_SPACE:
                        if hasattr(self, 'intro_audio_path'):
                            self.audio_manager.play_audio(self.intro_audio_path)
                        else:
                            self.state = GameState.MAZE
                    elif event.key == pygame.K_RETURN:
                        self.state = GameState.MAZE

                elif self.state == GameState.MAZE:
                    self._handle_movement(event.key)

                elif self.state == GameState.EXPLANATION:
                    self._handle_text_input(event)

            elif event.type == pygame.MOUSEBUTTONDOWN:
                if self.state == GameState.QUIZ:
                    self._handle_quiz_click(event.pos)
                elif self.state == GameState.FLASHCARD:
                    self._handle_flashcard_click(event.pos)

    def _handle_movement(self, key):
        """Handle player movement"""
        old_x, old_y = self.player.x, self.player.y

        if key == pygame.K_UP or key == pygame.K_w:
            self.player.y -= self.player.speed
        elif key == pygame.K_DOWN or key == pygame.K_s:
            self.player.y += self.player.speed
        elif key == pygame.K_LEFT or key == pygame.K_a:
            self.player.x -= self.player.speed
        elif key == pygame.K_RIGHT or key == pygame.K_d:
            self.player.x += self.player.speed

        # Check collision with walls
        grid_x = self.player.x // 20
        grid_y = self.player.y // 20

        if (grid_x < 0 or grid_x >= self.maze_generator.width or
            grid_y < 0 or grid_y >= self.maze_generator.height or
            self.maze_generator.grid[grid_y][grid_x] == 1):
            # Collision with wall, revert position
            self.player.x, self.player.y = old_x, old_y

        # Check for node interactions
        self._check_node_interaction()

    def _check_node_interaction(self):
        """Check if player is near a node"""
        for node in self.nodes:
            node_x, node_y = node.position
            distance = ((self.player.x - node_x * 20) ** 2 + (self.player.y - node_y * 20) ** 2) ** 0.5

            if distance < 30 and node.id not in self.player.visited_nodes:
                self.current_node = node
                self.player.visited_nodes.append(node.id)

                if node.node_type == 'quiz':
                    self.quiz_system.load_quiz(node.data)
                    self.state = GameState.QUIZ
                elif node.node_type == 'flashcard':
                    self.flashcard_system.load_flashcards(node.data)
                    self.state = GameState.FLASHCARD
                elif node.node_type == 'goal':
                    self.state = GameState.EXPLANATION
                break

    def _handle_quiz_click(self, pos):
        """Handle quiz option clicks"""
        option_rects = self.quiz_system.render_quiz(self.screen, self.current_node)

        for i, rect in enumerate(option_rects):
            if rect.collidepoint(pos):
                quiz_complete = self.quiz_system.handle_answer(i)
                if quiz_complete:
                    self.player.score += self.quiz_system.score * 10
                    self.state = GameState.MAZE
                break

    def _handle_flashcard_click(self, pos):
        """Handle flashcard button clicks"""
        buttons = self.flashcard_system.render_flashcard(self.screen, self.current_node)

        for action, rect in buttons:
            if rect.collidepoint(pos):
                if self.flashcard_system.handle_action(action):
                    self.player.score += 5
                    self.state = GameState.MAZE
                break

    def _handle_text_input(self, event):
        """Handle text input for final explanation"""
        if event.key == pygame.K_BACKSPACE:
            self.explanation_text = self.explanation_text[:-1]
        elif event.key == pygame.K_RETURN:
            if len(self.explanation_text.strip()) > 20:  # Minimum explanation length
                self._evaluate_explanation()
        elif event.unicode.isprintable():
            if len(self.explanation_text) < 500:  # Maximum length
                self.explanation_text += event.unicode

    def _evaluate_explanation(self):
        """Evaluate the final explanation using AI"""
        try:
            # Use Gemini to evaluate the explanation
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel('gemini-2.5-pro')

                evaluation_prompt = f"""
                Evaluate this student's explanation of what they learned from the document.

                Original Document Summary: {self.document_data.get('summary', 'Not available')}

                Student's Explanation: {self.explanation_text}

                Please provide:
                1. A score from 0-100
                2. Brief feedback on understanding
                3. Areas for improvement

                Format: Score: [number] | Feedback: [text] | Improvements: [text]
                """

                response = model.generate_content(evaluation_prompt)
                evaluation = response.text

                # Parse score
                if "Score:" in evaluation:
                    score_part = evaluation.split("Score:")[1].split("|")[0].strip()
                    try:
                        self.final_score = int(score_part)
                    except:
                        self.final_score = 70  # Default score
                else:
                    self.final_score = 70

                self.ai_feedback = evaluation
            else:
                # Fallback scoring
                self.final_score = min(100, max(50, len(self.explanation_text.split()) * 2))
                self.ai_feedback = "Score based on explanation length and effort."

            self.state = GameState.RESULTS

        except Exception as e:
            print(f"Evaluation error: {e}")
            self.final_score = 70
            self.ai_feedback = "Unable to evaluate explanation automatically."
            self.state = GameState.RESULTS

    def _update(self):
        """Update game state"""
        if self.state == GameState.INTRO:
            # Check if intro audio finished
            if hasattr(self, 'intro_audio_path') and not self.audio_manager.is_audio_playing():
                if not self.intro_complete:
                    self.intro_complete = True

    def _render(self):
        """Render the current game state"""
        self.screen.fill(COLORS['background'])

        if self.state == GameState.INTRO:
            self._render_intro()
        elif self.state == GameState.MAZE:
            self._render_maze()
        elif self.state == GameState.QUIZ:
            self._render_maze()  # Background
            self.quiz_system.render_quiz(self.screen, self.current_node)
        elif self.state == GameState.FLASHCARD:
            self._render_maze()  # Background
            self.flashcard_system.render_flashcard(self.screen, self.current_node)
        elif self.state == GameState.EXPLANATION:
            self._render_explanation()
        elif self.state == GameState.RESULTS:
            self._render_results()

        pygame.display.flip()

    def _render_intro(self):
        """Render intro screen"""
        # Title
        title_text = self.large_font.render("Steve Educational Maze", True, COLORS['text'])
        title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 200))
        self.screen.blit(title_text, title_rect)

        # Instructions
        instructions = [
            "Welcome to your personalized learning adventure!",
            "",
            "🎧 Press SPACE to hear the document summary",
            "🎮 Press ENTER to start the maze",
            "",
            "Navigate through the maze to learn and test your knowledge:",
            "🔵 Blue nodes = Flashcards (study materials)",
            "🔴 Red nodes = Quizzes (test your knowledge)",
            "🟢 Green node = Final goal (explain what you learned)",
            "",
            "Use WASD or arrow keys to move"
        ]

        y_offset = 300
        for instruction in instructions:
            if instruction:
                text = self.font.render(instruction, True, COLORS['text'])
                text_rect = text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
                self.screen.blit(text, text_rect)
            y_offset += 30

        # Audio status
        if hasattr(self, 'intro_audio_path'):
            if self.audio_manager.is_audio_playing():
                audio_text = self.font.render("🎧 Playing audio narration...", True, COLORS['button'])
                audio_rect = audio_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 100))
                self.screen.blit(audio_text, audio_rect)
            elif self.intro_complete:
                ready_text = self.font.render("Ready to start! Press ENTER", True, COLORS['button'])
                ready_rect = ready_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 100))
                self.screen.blit(ready_text, ready_rect)

    def _render_maze(self):
        """Render the maze and player"""
        # Render maze grid
        cell_size = 20
        for y in range(self.maze_generator.height):
            for x in range(self.maze_generator.width):
                rect = pygame.Rect(x * cell_size, y * cell_size, cell_size, cell_size)

                if self.maze_generator.grid[y][x] == 1:  # Wall
                    pygame.draw.rect(self.screen, COLORS['wall'], rect)
                else:  # Path
                    pygame.draw.rect(self.screen, COLORS['path'], rect)

        # Render nodes
        for node in self.nodes:
            x, y = node.position
            center = (x * cell_size + cell_size // 2, y * cell_size + cell_size // 2)

            if node.node_type == 'quiz':
                color = COLORS['quiz_node']
            elif node.node_type == 'flashcard':
                color = COLORS['flashcard_node']
            elif node.node_type == 'goal':
                color = COLORS['goal']
            else:
                color = COLORS['button']

            pygame.draw.circle(self.screen, color, center, 15)

            # Node label
            if node.id in self.player.visited_nodes:
                pygame.draw.circle(self.screen, COLORS['text'], center, 15, 3)

        # Render player
        player_rect = pygame.Rect(self.player.x - self.player.size // 2,
                                self.player.y - self.player.size // 2,
                                self.player.size, self.player.size)
        pygame.draw.ellipse(self.screen, COLORS['player'], player_rect)

        # UI overlay
        self._render_ui()

    def _render_ui(self):
        """Render game UI"""
        # Score
        score_text = self.font.render(f"Score: {self.player.score}", True, COLORS['text'])
        self.screen.blit(score_text, (10, 10))

        # Progress
        visited = len(self.player.visited_nodes)
        total = len(self.nodes)
        progress_text = self.font.render(f"Progress: {visited}/{total} nodes", True, COLORS['text'])
        self.screen.blit(progress_text, (10, 40))

        # Instructions
        instruction_text = self.font.render("Use WASD or arrows to move", True, COLORS['text'])
        self.screen.blit(instruction_text, (10, WINDOW_HEIGHT - 30))

    def _render_explanation(self):
        """Render explanation input screen"""
        # Background
        pygame.draw.rect(self.screen, COLORS['ui_bg'], (50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100))
        pygame.draw.rect(self.screen, COLORS['text'], (50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100), 3)

        # Title
        title_text = self.large_font.render("Final Challenge!", True, COLORS['text'])
        title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 100))
        self.screen.blit(title_text, title_rect)

        # Instructions
        instruction_text = self.font.render("Explain what you learned from this document:", True, COLORS['text'])
        instruction_rect = instruction_text.get_rect(center=(WINDOW_WIDTH // 2, 150))
        self.screen.blit(instruction_text, instruction_rect)

        # Text input area
        text_area = pygame.Rect(70, 200, WINDOW_WIDTH - 140, 300)
        pygame.draw.rect(self.screen, COLORS['background'], text_area)
        pygame.draw.rect(self.screen, COLORS['text'], text_area, 2)

        # Render explanation text with word wrapping
        words = self.explanation_text.split()
        lines = []
        current_line = ""

        for word in words:
            test_line = current_line + word + " "
            if self.font.size(test_line)[0] < text_area.width - 20:
                current_line = test_line
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word + " "
        if current_line:
            lines.append(current_line)

        # Add cursor
        if len(lines) == 0:
            lines.append("|")
        else:
            lines[-1] += "|"

        y_offset = text_area.y + 10
        for line in lines[:12]:  # Limit visible lines
            text = self.font.render(line, True, COLORS['text'])
            self.screen.blit(text, (text_area.x + 10, y_offset))
            y_offset += 25

        # Submit instruction
        submit_text = self.font.render("Press ENTER to submit (minimum 20 characters)", True, COLORS['text'])
        submit_rect = submit_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 100))
        self.screen.blit(submit_text, submit_rect)

        # Character count
        char_count = self.font.render(f"Characters: {len(self.explanation_text)}/500", True, COLORS['text'])
        self.screen.blit(char_count, (70, WINDOW_HEIGHT - 130))

    def _render_results(self):
        """Render final results screen"""
        # Background
        pygame.draw.rect(self.screen, COLORS['ui_bg'], (50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100))
        pygame.draw.rect(self.screen, COLORS['text'], (50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100), 3)

        # Title
        title_text = self.large_font.render("Game Complete!", True, COLORS['text'])
        title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 100))
        self.screen.blit(title_text, title_rect)

        # Scores
        y_offset = 180

        game_score_text = self.font.render(f"Game Score: {self.player.score}", True, COLORS['text'])
        game_score_rect = game_score_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
        self.screen.blit(game_score_text, game_score_rect)
        y_offset += 40

        explanation_score_text = self.font.render(f"Explanation Score: {self.final_score}/100", True, COLORS['text'])
        explanation_score_rect = explanation_score_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
        self.screen.blit(explanation_score_text, explanation_score_rect)
        y_offset += 40

        total_score = self.player.score + self.final_score
        total_text = self.large_font.render(f"Total Score: {total_score}", True, COLORS['goal'])
        total_rect = total_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
        self.screen.blit(total_text, total_rect)
        y_offset += 80

        # AI Feedback
        feedback_title = self.font.render("AI Feedback:", True, COLORS['text'])
        feedback_title_rect = feedback_title.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
        self.screen.blit(feedback_title, feedback_title_rect)
        y_offset += 30

        # Wrap feedback text
        if hasattr(self, 'ai_feedback'):
            feedback_words = self.ai_feedback.split()
            feedback_lines = []
            current_line = ""

            for word in feedback_words:
                test_line = current_line + word + " "
                if self.font.size(test_line)[0] < WINDOW_WIDTH - 120:
                    current_line = test_line
                else:
                    if current_line:
                        feedback_lines.append(current_line)
                    current_line = word + " "
            if current_line:
                feedback_lines.append(current_line)

            for line in feedback_lines[:6]:  # Limit lines
                text = self.font.render(line, True, COLORS['text'])
                text_rect = text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
                self.screen.blit(text, text_rect)
                y_offset += 25

        # Exit instruction
        exit_text = self.font.render("Close window to exit", True, COLORS['text'])
        exit_rect = exit_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 80))
        self.screen.blit(exit_text, exit_rect)


def launch_game(document_data: Dict[str, Any]):
    """Launch the educational game with document data"""
    try:
        game = EducationalGame(document_data)
        game.run()
        return True
    except Exception as e:
        print(f"Game launch error: {e}")
        return False


if __name__ == "__main__":
    # Check for command line arguments
    if len(sys.argv) > 1:
        # Load game data from file
        game_data_path = sys.argv[1]
        try:
            with open(game_data_path, 'r', encoding='utf-8') as f:
                game_data = json.load(f)
            print(f"Loaded game data from: {game_data_path}")
        except Exception as e:
            print(f"Error loading game data: {e}")
            game_data = None
    else:
        game_data = None

    # Use sample data if no file provided or loading failed
    if not game_data:
        print("Using sample game data")
        game_data = {
            'summary': 'Welcome to the educational maze game! Navigate through and learn.',
            'roadmap': {
                'sections': [
                    {'title': 'Introduction', 'type': 'flashcard', 'content': 'Start here', 'data': {}},
                    {'title': 'Main Concepts', 'type': 'flashcard', 'content': 'Learn key ideas', 'data': {}},
                    {'title': 'Practice Quiz', 'type': 'quiz', 'content': 'Test your knowledge', 'data': {}},
                    {'title': 'Final Challenge', 'type': 'goal', 'content': 'Complete the journey', 'data': {}}
                ]
            }
        }

    # Launch the game
    print("Starting Steve Educational Game...")
    launch_game(game_data)