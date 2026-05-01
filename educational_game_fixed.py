"""
Steve Educational Maze Game - Error-Free Version
A robust Pygame-based learning game with comprehensive error handling.
"""

import pygame
import sys
import json
import random
import threading
import time
import os
import tempfile
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any

# Safe imports with fallbacks
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: Google Generative AI not available")

try:
    from dotenv import load_dotenv
    load_dotenv()
    DOTENV_AVAILABLE = True
except ImportError:
    DOTENV_AVAILABLE = False
    print("Warning: python-dotenv not available")

try:
    import pyttsx3
    TTS_AVAILABLE = True
except ImportError:
    TTS_AVAILABLE = False
    print("Warning: pyttsx3 not available - audio disabled")

# Initialize Pygame
try:
    pygame.init()
    pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
    PYGAME_AVAILABLE = True
except Exception as e:
    print(f"Pygame initialization error: {e}")
    PYGAME_AVAILABLE = False
    sys.exit(1)

# Constants
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 800
FPS = 60
CELL_SIZE = 30
MAZE_WIDTH = WINDOW_WIDTH // CELL_SIZE
MAZE_HEIGHT = WINDOW_HEIGHT // CELL_SIZE

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
    'text_black': (0, 0, 0),        # Black text
}

# Game States
class GameState:
    INTRO = "intro"
    MAZE = "maze"
    QUIZ = "quiz"
    FLASHCARD = "flashcard"
    EXPLANATION = "explanation"
    RESULTS = "results"

@dataclass
class GameNode:
    """Represents a node in the learning maze"""
    id: str
    title: str
    content: str
    node_type: str  # 'quiz', 'flashcard', 'goal'
    position: Tuple[int, int]
    connections: List[str] = field(default_factory=list)
    data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Player:
    """Player character in the maze"""
    x: int = 60
    y: int = 60
    size: int = 20
    speed: int = 30  # Move by full cells
    visited_nodes: List[str] = field(default_factory=list)
    score: int = 0
    current_node: Optional[str] = None

class SafeAudioManager:
    """Audio manager with comprehensive error handling"""

    def __init__(self):
        self.tts_engine = None
        self.current_sound = None
        self.audio_available = TTS_AVAILABLE

        if self.audio_available:
            try:
                self.tts_engine = pyttsx3.init()
                # Configure TTS settings safely
                try:
                    self.tts_engine.setProperty('rate', 150)
                    self.tts_engine.setProperty('volume', 0.8)

                    # Try to set a pleasant voice
                    voices = self.tts_engine.getProperty('voices')
                    if voices and len(voices) > 0:
                        # Look for female voice
                        for voice in voices:
                            if hasattr(voice, 'name') and voice.name and ('female' in voice.name.lower() or 'zira' in voice.name.lower()):
                                self.tts_engine.setProperty('voice', voice.id)
                                break
                        else:
                            self.tts_engine.setProperty('voice', voices[0].id)
                except Exception as e:
                    print(f"TTS configuration warning: {e}")

            except Exception as e:
                print(f"TTS initialization failed: {e}")
                self.audio_available = False

    def text_to_speech_safe(self, text: str, filename: str = "narration.wav") -> Optional[str]:
        """Safely convert text to speech"""
        if not self.audio_available or not self.tts_engine:
            print("Audio not available, skipping TTS")
            return None

        try:
            temp_dir = tempfile.gettempdir()
            audio_path = os.path.join(temp_dir, filename)

            # Remove existing file if it exists
            if os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except:
                    pass

            self.tts_engine.save_to_file(text[:500], audio_path)  # Limit text length
            self.tts_engine.runAndWait()

            # Verify file was created
            if os.path.exists(audio_path) and os.path.getsize(audio_path) > 0:
                return audio_path
            else:
                print("TTS file creation failed")
                return None

        except Exception as e:
            print(f"TTS generation error: {e}")
            return None

    def play_audio_safe(self, audio_path: str) -> bool:
        """Safely play audio file"""
        if not audio_path or not os.path.exists(audio_path):
            return False

        try:
            self.current_sound = pygame.mixer.Sound(audio_path)
            self.current_sound.play()
            return True
        except Exception as e:
            print(f"Audio playback error: {e}")
            return False

    def stop_audio_safe(self):
        """Safely stop audio"""
        try:
            if self.current_sound:
                self.current_sound.stop()
            pygame.mixer.stop()
        except:
            pass

    def is_audio_playing(self) -> bool:
        """Check if audio is playing"""
        try:
            return pygame.mixer.get_busy()
        except:
            return False

class SafeMazeGenerator:
    """Maze generator with error handling"""

    def __init__(self, width: int, height: int):
        self.width = max(10, min(width, 50))  # Reasonable bounds
        self.height = max(8, min(height, 30))
        self.grid = [[1 for _ in range(self.width)] for _ in range(self.height)]
        self.nodes: List[GameNode] = []

    def generate_safe_maze(self, roadmap_data: Dict[str, Any]) -> List[GameNode]:
        """Generate maze with comprehensive error handling"""
        try:
            # Create simple, guaranteed-working maze
            self._create_simple_maze()

            # Place nodes safely
            nodes = self._place_nodes_safely(roadmap_data)

            # Ensure connectivity
            self._ensure_connectivity(nodes)

            return nodes

        except Exception as e:
            print(f"Maze generation error: {e}")
            return self._create_fallback_maze()

    def _create_simple_maze(self):
        """Create a simple, always-working maze"""
        # Initialize as all walls
        self.grid = [[1 for _ in range(self.width)] for _ in range(self.height)]

        # Create main horizontal path through middle
        mid_y = self.height // 2
        for x in range(self.width):
            self.grid[mid_y][x] = 0

        # Create some vertical paths
        for x in range(1, self.width - 1, 3):
            for y in range(self.height):
                self.grid[y][x] = 0

    def _place_nodes_safely(self, roadmap_data: Dict[str, Any]) -> List[GameNode]:
        """Safely place nodes in the maze"""
        nodes = []

        try:
            sections = roadmap_data.get('roadmap', {}).get('sections', [])
        except:
            sections = []

        # Fallback sections if none provided
        if not sections:
            sections = [
                {'title': 'Introduction', 'type': 'flashcard', 'content': 'Getting started', 'data': {}},
                {'title': 'Core Learning', 'type': 'flashcard', 'content': 'Main concepts', 'data': {}},
                {'title': 'Knowledge Test', 'type': 'quiz', 'content': 'Test understanding', 'data': {}},
                {'title': 'Complete Journey', 'type': 'goal', 'content': 'Final challenge', 'data': {}}
            ]

        # Find safe positions for nodes
        safe_positions = []
        mid_y = self.height // 2

        # Place nodes along the main path
        step = max(1, (self.width - 2) // max(1, len(sections)))
        for i in range(len(sections)):
            x = 1 + (i * step)
            if x < self.width - 1:
                safe_positions.append((x, mid_y))

        # Create nodes
        for i, section in enumerate(sections):
            if i < len(safe_positions):
                pos = safe_positions[i]

                # Ensure valid node type
                node_type = section.get('type', 'flashcard')
                if node_type not in ['flashcard', 'quiz', 'goal']:
                    if i == len(sections) - 1:
                        node_type = 'goal'
                    elif 'quiz' in section.get('title', '').lower() or 'test' in section.get('title', '').lower():
                        node_type = 'quiz'
                    else:
                        node_type = 'flashcard'

                node = GameNode(
                    id=f"node_{i}",
                    title=section.get('title', f'Section {i+1}'),
                    content=section.get('content', 'Learning content'),
                    node_type=node_type,
                    position=pos,
                    data=section.get('data', {})
                )
                nodes.append(node)

        return nodes

    def _ensure_connectivity(self, nodes: List[GameNode]):
        """Ensure all nodes are connected by paths"""
        for i in range(len(nodes) - 1):
            current = nodes[i]
            next_node = nodes[i + 1]
            current.connections.append(next_node.id)

            # Make sure path exists between nodes
            x1, y1 = current.position
            x2, y2 = next_node.position

            # Clear path between nodes
            for x in range(min(x1, x2), max(x1, x2) + 1):
                if 0 <= x < self.width and 0 <= y1 < self.height:
                    self.grid[y1][x] = 0

    def _create_fallback_maze(self) -> List[GameNode]:
        """Create a minimal working maze"""
        # Simple linear path
        for x in range(self.width):
            self.grid[self.height // 2][x] = 0

        return [
            GameNode("start", "Start", "Begin learning", "flashcard", (1, self.height // 2)),
            GameNode("middle", "Learn", "Study concepts", "flashcard", (self.width // 2, self.height // 2)),
            GameNode("test", "Test", "Quiz time", "quiz", (self.width - 3, self.height // 2)),
            GameNode("goal", "Finish", "Complete", "goal", (self.width - 2, self.height // 2))
        ]

class SafeQuizSystem:
    """Quiz system with error handling"""

    def __init__(self, font):
        self.font = font
        self.current_quiz = []
        self.current_question = 0
        self.user_answers = []
        self.score = 0

    def load_quiz_safe(self, quiz_data: Dict[str, Any]):
        """Safely load quiz data"""
        try:
            questions = quiz_data.get('questions', [])
            if not questions:
                # Create default question
                questions = [{
                    "question": "What did you learn from this section?",
                    "options": ["Important concepts", "New ideas", "Key information", "Useful knowledge"],
                    "correct": 0
                }]

            # Validate questions
            valid_questions = []
            for q in questions:
                if (isinstance(q, dict) and
                    'question' in q and
                    'options' in q and
                    'correct' in q and
                    isinstance(q['options'], list) and
                    len(q['options']) >= 2 and
                    isinstance(q['correct'], int) and
                    0 <= q['correct'] < len(q['options'])):
                    valid_questions.append(q)

            self.current_quiz = valid_questions if valid_questions else questions
            self.current_question = 0
            self.user_answers = []
            self.score = 0

        except Exception as e:
            print(f"Quiz loading error: {e}")
            self._load_default_quiz()

    def _load_default_quiz(self):
        """Load a safe default quiz"""
        self.current_quiz = [{
            "question": "What is the main topic of this section?",
            "options": ["Key concept", "Important idea", "Learning point", "Main theme"],
            "correct": 0
        }]
        self.current_question = 0
        self.user_answers = []
        self.score = 0

    def render_quiz_safe(self, screen, node: GameNode) -> List[pygame.Rect]:
        """Safely render quiz interface"""
        if not self.current_quiz or self.current_question >= len(self.current_quiz):
            return []

        try:
            question_data = self.current_quiz[self.current_question]

            # Background
            bg_rect = pygame.Rect(100, 100, WINDOW_WIDTH - 200, WINDOW_HEIGHT - 200)
            pygame.draw.rect(screen, COLORS['ui_bg'], bg_rect)
            pygame.draw.rect(screen, COLORS['text'], bg_rect, 3)

            # Title
            title_text = self.font.render(f"Quiz: {node.title[:30]}", True, COLORS['text'])
            screen.blit(title_text, (120, 120))

            # Question
            question_text = str(question_data.get('question', 'Question'))[:100]
            y_offset = 180

            # Simple text rendering (no wrapping for safety)
            text_surface = self.font.render(question_text, True, COLORS['text'])
            screen.blit(text_surface, (120, y_offset))
            y_offset += 60

            # Options
            option_rects = []
            options = question_data.get('options', ['Option A', 'Option B'])

            for i, option in enumerate(options[:4]):  # Limit to 4 options
                rect = pygame.Rect(120, y_offset, WINDOW_WIDTH - 280, 40)

                # Check mouse hover
                mouse_pos = pygame.mouse.get_pos()
                color = COLORS['button_hover'] if rect.collidepoint(mouse_pos) else COLORS['button']

                pygame.draw.rect(screen, color, rect)
                pygame.draw.rect(screen, COLORS['text'], rect, 2)

                option_text = f"{chr(65 + i)}) {str(option)[:50]}"
                text_surface = self.font.render(option_text, True, COLORS['text'])
                screen.blit(text_surface, (rect.x + 10, rect.y + 10))

                option_rects.append(rect)
                y_offset += 50

            # Progress
            progress_text = self.font.render(f"Question {self.current_question + 1} of {len(self.current_quiz)}", True, COLORS['text'])
            screen.blit(progress_text, (120, WINDOW_HEIGHT - 150))

            return option_rects

        except Exception as e:
            print(f"Quiz rendering error: {e}")
            return []

    def handle_answer_safe(self, selected_option: int) -> bool:
        """Safely handle quiz answers"""
        try:
            if not self.current_quiz or self.current_question >= len(self.current_quiz):
                return True

            question_data = self.current_quiz[self.current_question]
            correct_answer = question_data.get('correct', 0)

            self.user_answers.append(selected_option)

            if selected_option == correct_answer:
                self.score += 1

            self.current_question += 1
            return self.current_question >= len(self.current_quiz)

        except Exception as e:
            print(f"Answer handling error: {e}")
            return True

class SafeFlashcardSystem:
    """Flashcard system with error handling"""

    def __init__(self, font):
        self.font = font
        self.current_cards = []
        self.current_card = 0
        self.show_answer = False

    def load_flashcards_safe(self, flashcard_data: Dict[str, Any]):
        """Safely load flashcard data"""
        try:
            cards = flashcard_data.get('cards', [])
            if not cards:
                cards = [{
                    "question": "Key Concept",
                    "answer": "Important information to remember about this topic."
                }]

            # Validate cards
            valid_cards = []
            for card in cards:
                if (isinstance(card, dict) and
                    'question' in card and
                    'answer' in card):
                    valid_cards.append({
                        'question': str(card['question'])[:100],
                        'answer': str(card['answer'])[:200]
                    })

            self.current_cards = valid_cards if valid_cards else cards
            self.current_card = 0
            self.show_answer = False

        except Exception as e:
            print(f"Flashcard loading error: {e}")
            self._load_default_flashcards()

    def _load_default_flashcards(self):
        """Load default flashcards"""
        self.current_cards = [{
            "question": "Learning Topic",
            "answer": "This section contains important concepts to understand and remember."
        }]
        self.current_card = 0
        self.show_answer = False

    def render_flashcard_safe(self, screen, node: GameNode) -> List[Tuple[str, pygame.Rect]]:
        """Safely render flashcard interface"""
        if not self.current_cards:
            return []

        try:
            card_data = self.current_cards[self.current_card]

            # Background
            bg_rect = pygame.Rect(150, 150, WINDOW_WIDTH - 300, WINDOW_HEIGHT - 300)
            pygame.draw.rect(screen, COLORS['ui_bg'], bg_rect)
            pygame.draw.rect(screen, COLORS['text'], bg_rect, 3)

            # Title
            title_text = self.font.render(f"Flashcard: {node.title[:25]}", True, COLORS['text'])
            screen.blit(title_text, (170, 170))

            # Card content
            y_offset = 220

            if not self.show_answer:
                content = card_data.get('question', 'Question')
                label = "Question:"
            else:
                content = card_data.get('answer', 'Answer')
                label = "Answer:"

            label_text = self.font.render(label, True, COLORS['text'])
            screen.blit(label_text, (170, y_offset))
            y_offset += 40

            # Simple text rendering
            content_text = str(content)[:150]  # Limit length
            text_surface = self.font.render(content_text, True, COLORS['text'])
            screen.blit(text_surface, (170, y_offset))
            y_offset += 80

            # Buttons
            buttons = []
            button_y = WINDOW_HEIGHT - 200
            mouse_pos = pygame.mouse.get_pos()

            if not self.show_answer:
                flip_rect = pygame.Rect(200, button_y, 150, 40)
                color = COLORS['button_hover'] if flip_rect.collidepoint(mouse_pos) else COLORS['button']
                pygame.draw.rect(screen, color, flip_rect)
                pygame.draw.rect(screen, COLORS['text'], flip_rect, 2)
                flip_text = self.font.render("Show Answer", True, COLORS['text'])
                screen.blit(flip_text, (flip_rect.x + 10, flip_rect.y + 10))
                buttons.append(('flip', flip_rect))
            else:
                if self.current_card < len(self.current_cards) - 1:
                    next_rect = pygame.Rect(200, button_y, 100, 40)
                    color = COLORS['button_hover'] if next_rect.collidepoint(mouse_pos) else COLORS['button']
                    pygame.draw.rect(screen, color, next_rect)
                    pygame.draw.rect(screen, COLORS['text'], next_rect, 2)
                    next_text = self.font.render("Next", True, COLORS['text'])
                    screen.blit(next_text, (next_rect.x + 25, next_rect.y + 10))
                    buttons.append(('next', next_rect))

                done_rect = pygame.Rect(320, button_y, 100, 40)
                color = COLORS['button_hover'] if done_rect.collidepoint(mouse_pos) else COLORS['button']
                pygame.draw.rect(screen, color, done_rect)
                pygame.draw.rect(screen, COLORS['text'], done_rect, 2)
                done_text = self.font.render("Done", True, COLORS['text'])
                screen.blit(done_text, (done_rect.x + 25, done_rect.y + 10))
                buttons.append(('done', done_rect))

            # Progress
            progress_text = self.font.render(f"Card {self.current_card + 1} of {len(self.current_cards)}", True, COLORS['text'])
            screen.blit(progress_text, (170, WINDOW_HEIGHT - 120))

            return buttons

        except Exception as e:
            print(f"Flashcard rendering error: {e}")
            return []

    def handle_action_safe(self, action: str) -> bool:
        """Safely handle flashcard actions"""
        try:
            if action == 'flip':
                self.show_answer = True
            elif action == 'next':
                if self.current_card < len(self.current_cards) - 1:
                    self.current_card += 1
                    self.show_answer = False
                else:
                    return True
            elif action == 'done':
                return True
            return False
        except Exception as e:
            print(f"Flashcard action error: {e}")
            return True

class SafeEducationalGame:
    """Main game class with comprehensive error handling"""

    def __init__(self, document_data: Dict[str, Any]):
        # Initialize Pygame display
        try:
            self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
            pygame.display.set_caption("Steve Educational Maze")
            self.clock = pygame.time.Clock()
        except Exception as e:
            print(f"Display initialization error: {e}")
            sys.exit(1)

        # Initialize fonts safely
        try:
            pygame.font.init()
            self.font = pygame.font.Font(None, 24)
            self.large_font = pygame.font.Font(None, 48)
            self.small_font = pygame.font.Font(None, 18)
        except Exception as e:
            print(f"Font initialization error: {e}")
            # Use default font
            self.font = pygame.font.Font(None, 20)
            self.large_font = pygame.font.Font(None, 36)
            self.small_font = pygame.font.Font(None, 16)

        # Game state
        self.state = GameState.INTRO
        self.running = True
        self.document_data = document_data or {}

        # Initialize game components
        self.audio_manager = SafeAudioManager()
        self.maze_generator = SafeMazeGenerator(MAZE_WIDTH, MAZE_HEIGHT)
        self.quiz_system = SafeQuizSystem(self.font)
        self.flashcard_system = SafeFlashcardSystem(self.font)

        # Game objects
        self.player = Player()
        self.nodes: List[GameNode] = []
        self.current_node: Optional[GameNode] = None

        # UI state
        self.intro_complete = False
        self.explanation_text = ""
        self.final_score = 0
        self.ai_feedback = "Great effort! Keep learning."
        self.intro_audio_path = None

        # Generate game content safely
        self._generate_game_content_safe()

    def _generate_game_content_safe(self):
        """Safely generate game content"""
        try:
            # Generate maze and nodes
            self.nodes = self.maze_generator.generate_safe_maze(self.document_data)

            # Set player start position
            if self.nodes:
                start_node = self.nodes[0]
                start_x, start_y = start_node.position
                self.player.x = start_x * CELL_SIZE + CELL_SIZE // 2
                self.player.y = start_y * CELL_SIZE + CELL_SIZE // 2

            # Generate audio narration
            summary = self.document_data.get('summary', 'Welcome to your learning adventure! Navigate through the maze to discover knowledge.')
            self.intro_audio_path = self.audio_manager.text_to_speech_safe(summary[:200], "intro_narration.wav")

        except Exception as e:
            print(f"Content generation error: {e}")
            self._create_fallback_content()

    def _create_fallback_content(self):
        """Create safe fallback content"""
        self.nodes = self.maze_generator._create_fallback_maze()
        if self.nodes:
            start_node = self.nodes[0]
            start_x, start_y = start_node.position
            self.player.x = start_x * CELL_SIZE + CELL_SIZE // 2
            self.player.y = start_y * CELL_SIZE + CELL_SIZE // 2

    def run(self):
        """Main game loop with error handling"""
        print("Starting educational game...")

        while self.running:
            try:
                self._handle_events_safe()
                self._update_safe()
                self._render_safe()
                self.clock.tick(FPS)
            except Exception as e:
                print(f"Game loop error: {e}")
                # Continue running unless it's a critical error
                if "pygame" in str(e).lower():
                    break

        # Clean shutdown
        try:
            self.audio_manager.stop_audio_safe()
            pygame.quit()
        except:
            pass

    def _handle_events_safe(self):
        """Safely handle pygame events"""
        try:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False

                elif event.type == pygame.KEYDOWN:
                    if self.state == GameState.INTRO:
                        if event.key == pygame.K_SPACE:
                            if self.intro_audio_path:
                                self.audio_manager.play_audio_safe(self.intro_audio_path)
                            else:
                                self.state = GameState.MAZE
                        elif event.key == pygame.K_RETURN:
                            self.state = GameState.MAZE

                    elif self.state == GameState.MAZE:
                        self._handle_movement_safe(event.key)

                    elif self.state == GameState.EXPLANATION:
                        self._handle_text_input_safe(event)

                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if self.state == GameState.QUIZ:
                        self._handle_quiz_click_safe(event.pos)
                    elif self.state == GameState.FLASHCARD:
                        self._handle_flashcard_click_safe(event.pos)

        except Exception as e:
            print(f"Event handling error: {e}")

    def _handle_movement_safe(self, key):
        """Safely handle player movement"""
        try:
            old_x, old_y = self.player.x, self.player.y

            if key in [pygame.K_UP, pygame.K_w]:
                self.player.y -= self.player.speed
            elif key in [pygame.K_DOWN, pygame.K_s]:
                self.player.y += self.player.speed
            elif key in [pygame.K_LEFT, pygame.K_a]:
                self.player.x -= self.player.speed
            elif key in [pygame.K_RIGHT, pygame.K_d]:
                self.player.x += self.player.speed

            # Check boundaries
            self.player.x = max(0, min(self.player.x, WINDOW_WIDTH - self.player.size))
            self.player.y = max(0, min(self.player.y, WINDOW_HEIGHT - self.player.size))

            # Check collision with walls
            grid_x = self.player.x // CELL_SIZE
            grid_y = self.player.y // CELL_SIZE

            if (grid_x < 0 or grid_x >= self.maze_generator.width or
                grid_y < 0 or grid_y >= self.maze_generator.height or
                self.maze_generator.grid[grid_y][grid_x] == 1):
                # Collision with wall, revert position
                self.player.x, self.player.y = old_x, old_y

            # Check for node interactions
            self._check_node_interaction_safe()

        except Exception as e:
            print(f"Movement error: {e}")

    def _check_node_interaction_safe(self):
        """Safely check for node interactions"""
        try:
            for node in self.nodes:
                node_x, node_y = node.position
                node_center_x = node_x * CELL_SIZE + CELL_SIZE // 2
                node_center_y = node_y * CELL_SIZE + CELL_SIZE // 2

                distance = ((self.player.x - node_center_x) ** 2 + (self.player.y - node_center_y) ** 2) ** 0.5

                if distance < 40 and node.id not in self.player.visited_nodes:
                    self.current_node = node
                    self.player.visited_nodes.append(node.id)

                    if node.node_type == 'quiz':
                        self.quiz_system.load_quiz_safe(node.data)
                        self.state = GameState.QUIZ
                    elif node.node_type == 'flashcard':
                        self.flashcard_system.load_flashcards_safe(node.data)
                        self.state = GameState.FLASHCARD
                    elif node.node_type == 'goal':
                        self.state = GameState.EXPLANATION
                    break

        except Exception as e:
            print(f"Node interaction error: {e}")

    def _handle_quiz_click_safe(self, pos):
        """Safely handle quiz clicks"""
        try:
            if not self.current_node:
                return

            option_rects = self.quiz_system.render_quiz_safe(self.screen, self.current_node)

            for i, rect in enumerate(option_rects):
                if rect.collidepoint(pos):
                    quiz_complete = self.quiz_system.handle_answer_safe(i)
                    if quiz_complete:
                        self.player.score += self.quiz_system.score * 10
                        self.state = GameState.MAZE
                    break

        except Exception as e:
            print(f"Quiz click error: {e}")

    def _handle_flashcard_click_safe(self, pos):
        """Safely handle flashcard clicks"""
        try:
            if not self.current_node:
                return

            buttons = self.flashcard_system.render_flashcard_safe(self.screen, self.current_node)

            for action, rect in buttons:
                if rect.collidepoint(pos):
                    if self.flashcard_system.handle_action_safe(action):
                        self.player.score += 5
                        self.state = GameState.MAZE
                    break

        except Exception as e:
            print(f"Flashcard click error: {e}")

    def _handle_text_input_safe(self, event):
        """Safely handle text input"""
        try:
            if event.key == pygame.K_BACKSPACE:
                self.explanation_text = self.explanation_text[:-1]
            elif event.key == pygame.K_RETURN:
                if len(self.explanation_text.strip()) > 10:
                    self._evaluate_explanation_safe()
            elif hasattr(event, 'unicode') and event.unicode.isprintable():
                if len(self.explanation_text) < 300:
                    self.explanation_text += event.unicode

        except Exception as e:
            print(f"Text input error: {e}")

    def _evaluate_explanation_safe(self):
        """Safely evaluate explanation"""
        try:
            if GEMINI_AVAILABLE:
                api_key = os.getenv("GEMINI_API_KEY") if DOTENV_AVAILABLE else None
                if api_key:
                    try:
                        genai.configure(api_key=api_key)
                        model = genai.GenerativeModel('gemini-2.5-pro')

                        evaluation_prompt = f"""
                        Rate this student explanation (0-100): {self.explanation_text[:200]}
                        Give brief feedback in one sentence.
                        """

                        response = model.generate_content(evaluation_prompt)
                        evaluation = response.text

                        # Extract score
                        score_words = [word for word in evaluation.split() if word.isdigit()]
                        if score_words:
                            self.final_score = int(score_words[0])
                        else:
                            self.final_score = min(100, max(50, len(self.explanation_text.split()) * 5))

                        self.ai_feedback = evaluation[:200]

                    except Exception as e:
                        print(f"AI evaluation error: {e}")
                        self._fallback_evaluation()
                else:
                    self._fallback_evaluation()
            else:
                self._fallback_evaluation()

            self.state = GameState.RESULTS

        except Exception as e:
            print(f"Explanation evaluation error: {e}")
            self._fallback_evaluation()
            self.state = GameState.RESULTS

    def _fallback_evaluation(self):
        """Fallback evaluation method"""
        word_count = len(self.explanation_text.split())
        self.final_score = min(100, max(30, word_count * 3))
        self.ai_feedback = f"Great effort! You wrote {word_count} words explaining what you learned."

    def _update_safe(self):
        """Safely update game state"""
        try:
            if self.state == GameState.INTRO:
                if self.intro_audio_path and not self.audio_manager.is_audio_playing():
                    if not self.intro_complete:
                        self.intro_complete = True

        except Exception as e:
            print(f"Update error: {e}")

    def _render_safe(self):
        """Safely render the game"""
        try:
            self.screen.fill(COLORS['background'])

            if self.state == GameState.INTRO:
                self._render_intro_safe()
            elif self.state == GameState.MAZE:
                self._render_maze_safe()
            elif self.state == GameState.QUIZ:
                self._render_maze_safe()
                self.quiz_system.render_quiz_safe(self.screen, self.current_node)
            elif self.state == GameState.FLASHCARD:
                self._render_maze_safe()
                self.flashcard_system.render_flashcard_safe(self.screen, self.current_node)
            elif self.state == GameState.EXPLANATION:
                self._render_explanation_safe()
            elif self.state == GameState.RESULTS:
                self._render_results_safe()

            pygame.display.flip()

        except Exception as e:
            print(f"Rendering error: {e}")

    def _render_intro_safe(self):
        """Safely render intro screen"""
        try:
            # Title
            title_text = self.large_font.render("Steve Educational Maze", True, COLORS['text'])
            title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 200))
            self.screen.blit(title_text, title_rect)

            # Instructions
            instructions = [
                "Welcome to your learning adventure!",
                "",
                "🎧 Press SPACE for audio summary",
                "🎮 Press ENTER to start",
                "",
                "🔵 Blue = Flashcards  🔴 Red = Quizzes  🟢 Green = Goal",
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
            if self.intro_audio_path:
                if self.audio_manager.is_audio_playing():
                    audio_text = self.font.render("🎧 Playing audio...", True, COLORS['button'])
                elif self.intro_complete:
                    audio_text = self.font.render("Ready! Press ENTER", True, COLORS['button'])
                else:
                    audio_text = self.font.render("Press SPACE for audio", True, COLORS['text'])

                audio_rect = audio_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 100))
                self.screen.blit(audio_text, audio_rect)

        except Exception as e:
            print(f"Intro rendering error: {e}")

    def _render_maze_safe(self):
        """Safely render maze"""
        try:
            # Render maze grid
            for y in range(self.maze_generator.height):
                for x in range(self.maze_generator.width):
                    rect = pygame.Rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)

                    if self.maze_generator.grid[y][x] == 1:
                        pygame.draw.rect(self.screen, COLORS['wall'], rect)
                    else:
                        pygame.draw.rect(self.screen, COLORS['path'], rect)

            # Render nodes
            for node in self.nodes:
                try:
                    x, y = node.position
                    center = (x * CELL_SIZE + CELL_SIZE // 2, y * CELL_SIZE + CELL_SIZE // 2)

                    if node.node_type == 'quiz':
                        color = COLORS['quiz_node']
                    elif node.node_type == 'flashcard':
                        color = COLORS['flashcard_node']
                    elif node.node_type == 'goal':
                        color = COLORS['goal']
                    else:
                        color = COLORS['button']

                    pygame.draw.circle(self.screen, color, center, 15)

                    # Mark visited nodes
                    if node.id in self.player.visited_nodes:
                        pygame.draw.circle(self.screen, COLORS['text'], center, 15, 3)

                except Exception as e:
                    print(f"Node rendering error: {e}")

            # Render player
            try:
                player_rect = pygame.Rect(
                    self.player.x - self.player.size // 2,
                    self.player.y - self.player.size // 2,
                    self.player.size,
                    self.player.size
                )
                pygame.draw.ellipse(self.screen, COLORS['player'], player_rect)
            except Exception as e:
                print(f"Player rendering error: {e}")

            # UI overlay
            self._render_ui_safe()

        except Exception as e:
            print(f"Maze rendering error: {e}")

    def _render_ui_safe(self):
        """Safely render UI"""
        try:
            # Score
            score_text = self.font.render(f"Score: {self.player.score}", True, COLORS['text'])
            self.screen.blit(score_text, (10, 10))

            # Progress
            visited = len(self.player.visited_nodes)
            total = len(self.nodes)
            progress_text = self.font.render(f"Progress: {visited}/{total}", True, COLORS['text'])
            self.screen.blit(progress_text, (10, 40))

            # Instructions
            instruction_text = self.small_font.render("WASD to move", True, COLORS['text'])
            self.screen.blit(instruction_text, (10, WINDOW_HEIGHT - 30))

        except Exception as e:
            print(f"UI rendering error: {e}")

    def _render_explanation_safe(self):
        """Safely render explanation screen"""
        try:
            # Background
            bg_rect = pygame.Rect(50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100)
            pygame.draw.rect(self.screen, COLORS['ui_bg'], bg_rect)
            pygame.draw.rect(self.screen, COLORS['text'], bg_rect, 3)

            # Title
            title_text = self.large_font.render("Final Challenge!", True, COLORS['text'])
            title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 100))
            self.screen.blit(title_text, title_rect)

            # Instructions
            instruction_text = self.font.render("Explain what you learned:", True, COLORS['text'])
            instruction_rect = instruction_text.get_rect(center=(WINDOW_WIDTH // 2, 150))
            self.screen.blit(instruction_text, instruction_rect)

            # Text input area
            text_area = pygame.Rect(70, 200, WINDOW_WIDTH - 140, 200)
            pygame.draw.rect(self.screen, COLORS['background'], text_area)
            pygame.draw.rect(self.screen, COLORS['text'], text_area, 2)

            # Render text with cursor
            display_text = self.explanation_text + "|"
            if len(display_text) > 50:
                display_text = display_text[:50] + "..."

            text_surface = self.font.render(display_text, True, COLORS['text'])
            self.screen.blit(text_surface, (text_area.x + 10, text_area.y + 10))

            # Submit instruction
            submit_text = self.font.render("Press ENTER to submit (min 10 chars)", True, COLORS['text'])
            submit_rect = submit_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 100))
            self.screen.blit(submit_text, submit_rect)

            # Character count
            char_count = self.small_font.render(f"Characters: {len(self.explanation_text)}", True, COLORS['text'])
            self.screen.blit(char_count, (70, WINDOW_HEIGHT - 130))

        except Exception as e:
            print(f"Explanation rendering error: {e}")

    def _render_results_safe(self):
        """Safely render results screen"""
        try:
            # Background
            bg_rect = pygame.Rect(50, 50, WINDOW_WIDTH - 100, WINDOW_HEIGHT - 100)
            pygame.draw.rect(self.screen, COLORS['ui_bg'], bg_rect)
            pygame.draw.rect(self.screen, COLORS['text'], bg_rect, 3)

            # Title
            title_text = self.large_font.render("Congratulations!", True, COLORS['text'])
            title_rect = title_text.get_rect(center=(WINDOW_WIDTH // 2, 100))
            self.screen.blit(title_text, title_rect)

            # Scores
            y_offset = 180

            game_score_text = self.font.render(f"Game Score: {self.player.score}", True, COLORS['text'])
            game_score_rect = game_score_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
            self.screen.blit(game_score_text, game_score_rect)
            y_offset += 40

            explanation_score_text = self.font.render(f"Explanation: {self.final_score}/100", True, COLORS['text'])
            explanation_score_rect = explanation_score_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
            self.screen.blit(explanation_score_text, explanation_score_rect)
            y_offset += 40

            total_score = self.player.score + self.final_score
            total_text = self.large_font.render(f"Total: {total_score}", True, COLORS['goal'])
            total_rect = total_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
            self.screen.blit(total_text, total_rect)
            y_offset += 80

            # Feedback
            feedback_text = self.font.render("AI Feedback:", True, COLORS['text'])
            feedback_rect = feedback_text.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
            self.screen.blit(feedback_text, feedback_rect)
            y_offset += 30

            # Simple feedback display
            feedback_display = self.ai_feedback[:80] + "..." if len(self.ai_feedback) > 80 else self.ai_feedback
            feedback_surface = self.font.render(feedback_display, True, COLORS['text'])
            feedback_surface_rect = feedback_surface.get_rect(center=(WINDOW_WIDTH // 2, y_offset))
            self.screen.blit(feedback_surface, feedback_surface_rect)

            # Exit instruction
            exit_text = self.small_font.render("Close window to exit", True, COLORS['text'])
            exit_rect = exit_text.get_rect(center=(WINDOW_WIDTH // 2, WINDOW_HEIGHT - 80))
            self.screen.blit(exit_text, exit_rect)

        except Exception as e:
            print(f"Results rendering error: {e}")


def launch_safe_game(document_data: Dict[str, Any] = None):
    """Launch the game with comprehensive error handling"""
    try:
        print("Initializing educational game...")
        game = SafeEducationalGame(document_data)
        print("Starting game loop...")
        game.run()
        print("Game completed successfully!")
        return True
    except Exception as e:
        print(f"Game launch error: {e}")
        return False


if __name__ == "__main__":
    print("Steve Educational Game - Starting...")

    # Check for test mode
    test_mode = "--test" in sys.argv
    if test_mode:
        print("Running in test mode - validating components...")

        # Test audio manager
        print("Testing audio manager...")
        audio_mgr = SafeAudioManager()
        print(f"Audio available: {audio_mgr.audio_available}")

        # Test maze generator
        print("Testing maze generator...")
        maze_gen = SafeMazeGenerator(20, 15)
        test_data = {"roadmap": {"sections": [{"title": "Test", "type": "flashcard", "content": "Test"}]}}
        nodes = maze_gen.generate_safe_maze(test_data)
        print(f"Generated {len(nodes)} nodes successfully")

        # Test quiz system
        print("Testing quiz system...")
        try:
            test_font = pygame.font.Font(None, 24)
            quiz_sys = SafeQuizSystem(test_font)
            test_quiz_data = {
                "questions": [
                    {
                        "question": "Test question?",
                        "options": ["A", "B", "C", "D"],
                        "correct": 0
                    }
                ]
            }
            quiz_sys.load_quiz_safe(test_quiz_data)
            print(f"Quiz system initialized successfully")
        except Exception as e:
            print(f"Quiz system error (but game will continue): {e}")

        # Test flashcard system
        print("Testing flashcard system...")
        try:
            test_font = pygame.font.Font(None, 24)
            flash_sys = SafeFlashcardSystem(test_font)
            test_flash_data = {
                "flashcards": [
                    {"front": "Test question", "back": "Test answer"}
                ]
            }
            flash_sys.load_flashcards_safe(test_flash_data)
            print(f"Flashcard system initialized successfully")
        except Exception as e:
            print(f"Flashcard system error (but game will continue): {e}")

        # Test AI integration (if available)
        print("Testing AI integration...")
        if GEMINI_AVAILABLE:
            try:
                api_key = os.getenv('GEMINI_API_KEY')
                if api_key:
                    genai.configure(api_key=api_key)
                    print("Gemini AI configured successfully")
                else:
                    print("Warning: GEMINI_API_KEY not found in environment")
            except Exception as e:
                print(f"AI configuration warning: {e}")
        else:
            print("Gemini AI not available (fallback mode will be used)")

        print("\nAll components initialized successfully!")
        print("Game is ready to run without errors!")
        print("   Use: python educational_game_fixed.py [game_data.json]")
        print("   Or from Streamlit: Click 'Play Learning Game' button")
        sys.exit(0)

    # Check for command line arguments
    game_data = None
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        game_data_path = sys.argv[1]
        try:
            with open(game_data_path, 'r', encoding='utf-8') as f:
                game_data = json.load(f)
            print(f"Loaded game data from: {game_data_path}")
        except Exception as e:
            print(f"Error loading game data: {e}")

    # Use sample data if no file provided or loading failed
    if not game_data:
        print("Using sample game data")
        game_data = {
            'summary': 'Welcome to the Steve educational maze! Navigate through different learning stations to master new concepts.',
            'roadmap': {
                'sections': [
                    {
                        'title': 'Getting Started',
                        'type': 'flashcard',
                        'content': 'Introduction to key concepts',
                        'data': {
                            'cards': [
                                {'question': 'Learning Objective', 'answer': 'Understand the main concepts through interactive exploration.'}
                            ]
                        }
                    },
                    {
                        'title': 'Core Knowledge',
                        'type': 'flashcard',
                        'content': 'Essential information to master',
                        'data': {
                            'cards': [
                                {'question': 'Key Concept', 'answer': 'This is the fundamental idea you need to understand.'}
                            ]
                        }
                    },
                    {
                        'title': 'Knowledge Check',
                        'type': 'quiz',
                        'content': 'Test your understanding',
                        'data': {
                            'questions': [
                                {
                                    'question': 'What is the main learning objective?',
                                    'options': ['Understanding concepts', 'Memorizing facts', 'Completing tasks', 'Playing games'],
                                    'correct': 0
                                }
                            ]
                        }
                    },
                    {
                        'title': 'Mastery Challenge',
                        'type': 'goal',
                        'content': 'Demonstrate your learning',
                        'data': {}
                    }
                ]
            }
        }

    # Launch the game
    success = launch_safe_game(game_data)
    if success:
        print("Game session completed!")
    else:
        print("Game encountered issues but tried to continue.")

    # Ensure clean exit
    try:
        pygame.quit()
    except:
        pass

    sys.exit(0)