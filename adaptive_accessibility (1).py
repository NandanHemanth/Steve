import cv2
import numpy as np
import mediapipe as mp
from deepface import DeepFace
import time
import json
from collections import deque, defaultdict
import threading
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple, Optional
import logging
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import base64
from io import BytesIO
import plotly.graph_objs as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import warnings
warnings.filterwarnings('ignore')

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

@dataclass
class AccessibilityAssessment:
    """Comprehensive accessibility needs assessment"""
    visual_impairment_indicators: float = 0.0
    motor_impairment_indicators: float = 0.0
    attention_difficulties: float = 0.0
    cognitive_load_stress: float = 0.0
    reading_difficulties: float = 0.0
    recommendations: List[str] = None

@dataclass
class LearningState:
    """Current learning and emotional state"""
    primary_emotion: str = "neutral"
    emotion_confidence: float = 0.0
    stress_level: float = 0.0
    attention_score: float = 0.0
    engagement_level: float = 0.0
    fatigue_level: float = 0.0
    accessibility_needs: AccessibilityAssessment = None

class AdaptiveLearningCV:
    """
    Revolutionary Computer Vision system for adaptive learning
    Tracks emotions, stress, ADHD indicators, and accessibility needs
    """
    
    def __init__(self, buffer_size=30):
        # Initialize MediaPipe components (legacy solutions API; gracefully skip if unavailable)
        try:
            self.mp_face_mesh = mp.solutions.face_mesh
            self.mp_hands = mp.solutions.hands
            self.mp_pose = mp.solutions.pose
            self.mp_drawing = mp.solutions.drawing_utils

            self.face_mesh = self.mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                enable_segmentation=False,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self._mediapipe_available = True
        except AttributeError:
            # mediapipe >= 0.10.15 removed the legacy solutions namespace
            self.face_mesh = None
            self.hands = None
            self.pose = None
            self._mediapipe_available = False
            logging.getLogger(__name__).warning(
                "mediapipe.solutions not available — running in demo/simulated-data mode."
            )
        
        # Data buffers for temporal analysis
        self.emotion_buffer = deque(maxlen=buffer_size)
        self.attention_buffer = deque(maxlen=buffer_size)
        self.movement_buffer = deque(maxlen=buffer_size)
        self.blink_buffer = deque(maxlen=buffer_size)
        self.head_pose_buffer = deque(maxlen=buffer_size)
        
        # Tracking variables
        self.last_blink_time = time.time()
        self.blink_count = 0
        self.last_significant_movement = time.time()
        self.baseline_established = False
        self.baseline_metrics = {}
        
        # ADHD and attention tracking
        self.fidget_count = 0
        self.head_movement_variance = 0.0
        self.sustained_attention_time = 0.0
        
        # Accessibility indicators
        self.screen_distance_history = deque(maxlen=20)
        self.text_tracking_difficulty = 0.0
        self.motor_precision_scores = deque(maxlen=10)

        # Analytics and data storage
        self.analytics_data = {
            'timestamps': [],
            'emotions': [],
            'stress_levels': [],
            'adhd_scores': [],
            'accessibility_needs': [],
            'attention_scores': [],
            'fatigue_levels': [],
            'engagement_levels': [],
            'motor_precision': [],
            'visual_strain': [],
            'cognitive_load': []
        }

        # Session tracking
        self.session_start_time = datetime.now()
        self.total_adaptations = 0
        self.critical_alerts = []

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def detect_emotions(self, frame):
        """Enhanced emotion detection with confidence scoring"""
        try:
            # Use DeepFace for emotion analysis
            result = DeepFace.analyze(
                frame, 
                actions=['emotion'], 
                enforce_detection=False,
                silent=True
            )
            
            if isinstance(result, list):
                result = result[0]
            
            emotions = result['emotion']
            dominant_emotion = result['dominant_emotion']
            confidence = emotions[dominant_emotion] / 100.0
            
            return dominant_emotion, confidence, emotions
            
        except Exception as e:
            self.logger.warning(f"Emotion detection failed: {e}")
            return "neutral", 0.0, {"neutral": 100}

    def analyze_eye_patterns(self, landmarks):
        """Analyze eye movements for attention and accessibility indicators"""
        if not landmarks:
            return {}
        
        # Eye landmark indices for MediaPipe face mesh
        LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
        RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
        
        left_eye_points = [(landmarks[i].x, landmarks[i].y) for i in LEFT_EYE_INDICES]
        right_eye_points = [(landmarks[i].x, landmarks[i].y) for i in RIGHT_EYE_INDICES]
        
        # Calculate eye aspect ratios
        left_ear = self._calculate_eye_aspect_ratio(left_eye_points)
        right_ear = self._calculate_eye_aspect_ratio(right_eye_points)
        avg_ear = (left_ear + right_ear) / 2.0
        
        # Detect blinks
        blink_detected = avg_ear < 0.25
        current_time = time.time()
        
        if blink_detected and (current_time - self.last_blink_time) > 0.3:
            self.blink_count += 1
            self.last_blink_time = current_time
        
        self.blink_buffer.append(avg_ear)
        
        # Calculate blink rate (blinks per minute)
        time_window = 60  # seconds
        recent_blinks = sum(1 for t in self.blink_buffer if time.time() - t < time_window) if self.blink_buffer else 0
        blink_rate = (recent_blinks / time_window) * 60
        
        # Analyze gaze patterns for reading difficulties
        gaze_stability = np.std([ear for ear in self.blink_buffer]) if len(self.blink_buffer) > 5 else 0
        
        return {
            'blink_rate': blink_rate,
            'eye_aspect_ratio': avg_ear,
            'gaze_stability': gaze_stability,
            'potential_reading_difficulty': gaze_stability > 0.1 or blink_rate > 25
        }

    def _calculate_eye_aspect_ratio(self, eye_points):
        """Calculate eye aspect ratio for blink detection"""
        if len(eye_points) < 6:
            return 0.3  # Default value
        
        # Vertical eye distances
        vertical_1 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
        vertical_2 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
        
        # Horizontal eye distance
        horizontal = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
        
        # Calculate EAR
        ear = (vertical_1 + vertical_2) / (2.0 * horizontal + 1e-6)
        return ear

    def analyze_head_pose(self, landmarks):
        """Analyze head position and movement patterns"""
        if not landmarks:
            return {}
        
        # Key facial landmarks for head pose estimation
        nose_tip = landmarks[1]
        chin = landmarks[18]
        left_eye = landmarks[33]
        right_eye = landmarks[362]
        left_ear = landmarks[234]
        right_ear = landmarks[454]
        
        # Calculate head tilt and rotation
        eye_center = ((left_eye.x + right_eye.x) / 2, (left_eye.y + right_eye.y) / 2)
        nose_point = (nose_tip.x, nose_tip.y)
        
        # Head movement analysis
        head_position = {
            'x': nose_point[0],
            'y': nose_point[1],
            'tilt': np.arctan2(right_eye.y - left_eye.y, right_eye.x - left_eye.x)
        }
        
        self.head_pose_buffer.append(head_position)
        
        if len(self.head_pose_buffer) > 10:
            # Calculate head movement variance (ADHD indicator)
            positions = list(self.head_pose_buffer)
            x_variance = np.var([p['x'] for p in positions])
            y_variance = np.var([p['y'] for p in positions])
            tilt_variance = np.var([p['tilt'] for p in positions])
            
            self.head_movement_variance = x_variance + y_variance + tilt_variance
        
        return {
            'head_position': head_position,
            'movement_variance': self.head_movement_variance,
            'excessive_movement': self.head_movement_variance > 0.01  # ADHD indicator
        }

    def analyze_hand_movements(self, frame):
        """Analyze hand movements for motor skills and fidgeting"""
        if not self._mediapipe_available or self.hands is None:
            return {'hands_detected': 0, 'fidgeting_detected': False, 'motor_precision': 1.0, 'tremor_detected': False}
        results = self.hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
        hand_data = {
            'hands_detected': 0,
            'fidgeting_detected': False,
            'motor_precision': 1.0,
            'tremor_detected': False
        }
        
        if results.multi_hand_landmarks:
            hand_data['hands_detected'] = len(results.multi_hand_landmarks)
            
            for hand_landmarks in results.multi_hand_landmarks:
                # Analyze hand stability and precision
                fingertip_coords = []
                for i in [4, 8, 12, 16, 20]:  # Fingertip landmarks
                    fingertip_coords.append([
                        hand_landmarks.landmark[i].x,
                        hand_landmarks.landmark[i].y
                    ])
                
                # Calculate hand steadiness
                if len(self.movement_buffer) > 5:
                    current_pos = np.mean(fingertip_coords, axis=0)
                    self.movement_buffer.append(current_pos)
                    
                    # Detect excessive movement (fidgeting)
                    recent_movements = list(self.movement_buffer)[-10:]
                    if len(recent_movements) > 5:
                        movement_std = np.std(recent_movements, axis=0)
                        total_movement = np.sum(movement_std)
                        
                        if total_movement > 0.05:  # Threshold for fidgeting
                            hand_data['fidgeting_detected'] = True
                            self.fidget_count += 1
                        
                        # Motor precision assessment
                        hand_data['motor_precision'] = max(0.0, 1.0 - (total_movement * 10))
                        self.motor_precision_scores.append(hand_data['motor_precision'])
                else:
                    current_pos = np.mean(fingertip_coords, axis=0)
                    self.movement_buffer.append(current_pos)
        
        return hand_data

    def assess_accessibility_needs(self, eye_data, head_data, hand_data, emotion_data):
        """Comprehensive accessibility assessment"""
        assessment = AccessibilityAssessment()
        recommendations = []
        
        # Visual impairment indicators
        visual_score = 0.0
        if eye_data.get('potential_reading_difficulty', False):
            visual_score += 0.3
        if eye_data.get('blink_rate', 0) > 25:  # Excessive blinking
            visual_score += 0.2
        if len(self.screen_distance_history) > 5:
            avg_distance = np.mean(self.screen_distance_history)
            if avg_distance < 0.3:  # Too close to screen
                visual_score += 0.2
        
        assessment.visual_impairment_indicators = min(visual_score, 1.0)
        
        # Motor impairment indicators
        motor_score = 0.0
        avg_precision = np.mean(self.motor_precision_scores) if self.motor_precision_scores else 1.0
        if avg_precision < 0.7:
            motor_score += 0.4
        if hand_data.get('tremor_detected', False):
            motor_score += 0.3
        
        assessment.motor_impairment_indicators = min(motor_score, 1.0)
        
        # Attention difficulties (ADHD indicators)
        attention_score = 0.0
        if head_data.get('excessive_movement', False):
            attention_score += 0.3
        if hand_data.get('fidgeting_detected', False):
            attention_score += 0.3
        if self.fidget_count > 5:  # Recent fidgeting
            attention_score += 0.2
            self.fidget_count = max(0, self.fidget_count - 1)  # Decay
        
        assessment.attention_difficulties = min(attention_score, 1.0)
        
        # Cognitive load and stress
        stress_emotions = ['angry', 'fear', 'sad']
        stress_score = sum(emotion_data.get(emotion, 0) for emotion in stress_emotions) / 100.0
        assessment.cognitive_load_stress = stress_score
        
        # Reading difficulties
        reading_score = 0.0
        if eye_data.get('gaze_stability', 0) > 0.1:
            reading_score += 0.4
        if eye_data.get('blink_rate', 0) < 8:  # Too few blinks
            reading_score += 0.2
        
        assessment.reading_difficulties = min(reading_score, 1.0)
        
        # Generate recommendations
        if assessment.visual_impairment_indicators > 0.5:
            recommendations.extend([
                "Enable high contrast mode",
                "Increase font size",
                "Reduce screen brightness",
                "Enable audio descriptions"
            ])
        
        if assessment.motor_impairment_indicators > 0.5:
            recommendations.extend([
                "Enable larger click targets",
                "Reduce required precision",
                "Enable voice control",
                "Simplify navigation"
            ])
        
        if assessment.attention_difficulties > 0.5:
            recommendations.extend([
                "Reduce visual distractions",
                "Shorter content segments",
                "Frequent breaks",
                "Clear progress indicators"
            ])
        
        if assessment.cognitive_load_stress > 0.6:
            recommendations.extend([
                "Simplify content presentation",
                "Add calming background music",
                "Suggest break time",
                "Reduce information density"
            ])
        
        if assessment.reading_difficulties > 0.5:
            recommendations.extend([
                "Use dyslexia-friendly fonts",
                "Increase line spacing",
                "Enable text-to-speech",
                "Add reading guides"
            ])
        
        assessment.recommendations = recommendations
        return assessment

    def calculate_learning_state(self, emotion, confidence, emotions, eye_data, head_data, hand_data):
        """Calculate comprehensive learning state"""
        state = LearningState()
        
        # Basic emotion data
        state.primary_emotion = emotion
        state.emotion_confidence = confidence
        
        # Stress calculation
        stress_indicators = emotions.get('angry', 0) + emotions.get('fear', 0) + emotions.get('sad', 0)
        state.stress_level = min(stress_indicators / 100.0, 1.0)
        
        # Attention score based on multiple factors
        attention_factors = []
        
        # Eye-based attention
        if eye_data.get('blink_rate', 0) > 0:
            optimal_blink_rate = 15  # blinks per minute
            blink_attention = 1.0 - abs(eye_data['blink_rate'] - optimal_blink_rate) / optimal_blink_rate
            attention_factors.append(max(0, blink_attention))
        
        # Head movement stability
        if not head_data.get('excessive_movement', False):
            attention_factors.append(0.8)
        else:
            attention_factors.append(0.3)
        
        # Hand stability
        if not hand_data.get('fidgeting_detected', False):
            attention_factors.append(0.8)
        else:
            attention_factors.append(0.4)
        
        state.attention_score = np.mean(attention_factors) if attention_factors else 0.5
        
        # Engagement based on emotion and attention
        positive_emotions = emotions.get('happy', 0) + emotions.get('surprise', 0)
        state.engagement_level = (positive_emotions / 100.0 * 0.7) + (state.attention_score * 0.3)
        
        # Fatigue detection
        fatigue_indicators = 0.0
        if eye_data.get('blink_rate', 0) > 25:
            fatigue_indicators += 0.3
        if emotions.get('sad', 0) > 50:
            fatigue_indicators += 0.2
        if state.attention_score < 0.3:
            fatigue_indicators += 0.2
        
        state.fatigue_level = min(fatigue_indicators, 1.0)
        
        # Accessibility assessment
        state.accessibility_needs = self.assess_accessibility_needs(
            eye_data, head_data, hand_data, emotions
        )
        
        return state

    def process_frame(self, frame):
        """Main processing function for each frame"""
        if frame is None:
            return None

        if not self._mediapipe_available:
            # Return simulated data when mediapipe solutions API is unavailable
            import random
            learning_state = LearningState(
                primary_emotion="neutral",
                emotion_confidence=0.8,
                stress_level=random.uniform(0.2, 0.5),
                attention_score=random.uniform(60, 90),
                engagement_level=random.uniform(50, 80),
                fatigue_level=random.uniform(0.1, 0.3),
                accessibility_needs=AccessibilityAssessment(),
            )
            self._store_analytics_data(learning_state, {}, {})
            return {
                'learning_state': learning_state,
                'raw_data': {'emotions': {}, 'eye_data': {}, 'head_data': {}, 'hand_data': {}},
                'timestamp': time.time(),
            }

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Emotion detection
        emotion, confidence, emotions = self.detect_emotions(frame)

        # Face mesh analysis
        face_results = self.face_mesh.process(rgb_frame)
        eye_data = {}
        head_data = {}
        
        if face_results.multi_face_landmarks:
            for face_landmarks in face_results.multi_face_landmarks:
                # Analyze eyes and head pose
                eye_data = self.analyze_eye_patterns(face_landmarks.landmark)
                head_data = self.analyze_head_pose(face_landmarks.landmark)
        
        # Hand movement analysis
        hand_data = self.analyze_hand_movements(frame)
        
        # Calculate comprehensive learning state
        learning_state = self.calculate_learning_state(
            emotion, confidence, emotions, eye_data, head_data, hand_data
        )
        
        # Store in buffers for trend analysis
        self.emotion_buffer.append({
            'emotion': emotion,
            'confidence': confidence,
            'timestamp': time.time()
        })

        self.attention_buffer.append({
            'score': learning_state.attention_score,
            'timestamp': time.time()
        })

        # Store analytics data
        self._store_analytics_data(learning_state, eye_data, hand_data)

        return {
            'learning_state': learning_state,
            'raw_data': {
                'emotions': emotions,
                'eye_data': eye_data,
                'head_data': head_data,
                'hand_data': hand_data
            },
            'timestamp': time.time()
        }

    def get_trend_analysis(self, window_minutes=5):
        """Analyze trends over specified time window"""
        current_time = time.time()
        cutoff_time = current_time - (window_minutes * 60)
        
        # Filter recent data
        recent_emotions = [e for e in self.emotion_buffer if e['timestamp'] > cutoff_time]
        recent_attention = [a for a in self.attention_buffer if a['timestamp'] > cutoff_time]
        
        if not recent_emotions or not recent_attention:
            return None
        
        # Calculate trends
        emotion_trend = {}
        attention_scores = [a['score'] for a in recent_attention]
        
        return {
            'avg_attention': np.mean(attention_scores),
            'attention_stability': 1.0 - np.std(attention_scores),
            'dominant_emotions': [e['emotion'] for e in recent_emotions[-5:]],
            'engagement_trend': 'improving' if len(attention_scores) > 1 and attention_scores[-1] > attention_scores[0] else 'declining',
            'recommendations_needed': np.mean(attention_scores) < 0.5 or np.std(attention_scores) > 0.3
        }

    def _store_analytics_data(self, learning_state, eye_data, hand_data):
        """Store analytics data with timestamps for visualization"""
        timestamp = datetime.now()

        # Calculate derived metrics
        adhd_score = self._calculate_adhd_score(learning_state)
        visual_strain = self._calculate_visual_strain(eye_data)
        cognitive_load = self._calculate_cognitive_load(learning_state)

        # Store all data points
        self.analytics_data['timestamps'].append(timestamp)
        self.analytics_data['emotions'].append(learning_state.primary_emotion)
        self.analytics_data['stress_levels'].append(learning_state.stress_level * 100)
        self.analytics_data['adhd_scores'].append(adhd_score)
        self.analytics_data['accessibility_needs'].append(len(learning_state.accessibility_needs.recommendations) if learning_state.accessibility_needs and learning_state.accessibility_needs.recommendations else 0)
        self.analytics_data['attention_scores'].append(learning_state.attention_score * 100)
        self.analytics_data['fatigue_levels'].append(learning_state.fatigue_level * 100)
        self.analytics_data['engagement_levels'].append(learning_state.engagement_level * 100)
        self.analytics_data['motor_precision'].append(hand_data.get('motor_precision', 1.0) * 100)
        self.analytics_data['visual_strain'].append(visual_strain)
        self.analytics_data['cognitive_load'].append(cognitive_load)

        # Keep only recent data (last 1000 points)
        for key in self.analytics_data:
            if len(self.analytics_data[key]) > 1000:
                self.analytics_data[key] = self.analytics_data[key][-1000:]

        # Check for critical alerts
        self._check_critical_alerts(learning_state, adhd_score, visual_strain, cognitive_load)

    def _calculate_adhd_score(self, learning_state):
        """Calculate ADHD risk score based on multiple factors"""
        score = 0.0

        # Attention difficulties
        if learning_state.accessibility_needs:
            score += learning_state.accessibility_needs.attention_difficulties * 40

        # Movement patterns
        if self.fidget_count > 3:
            score += 20

        # Head movement variance
        if self.head_movement_variance > 0.01:
            score += 25

        # Sustained attention
        if learning_state.attention_score < 0.4:
            score += 15

        return min(score, 100)

    def _calculate_visual_strain(self, eye_data):
        """Calculate visual strain indicators"""
        strain = 0.0

        blink_rate = eye_data.get('blink_rate', 15)
        if blink_rate > 25 or blink_rate < 8:
            strain += 30

        if eye_data.get('potential_reading_difficulty', False):
            strain += 40

        gaze_stability = eye_data.get('gaze_stability', 0.05)
        if gaze_stability > 0.1:
            strain += 30

        return min(strain, 100)

    def _calculate_cognitive_load(self, learning_state):
        """Calculate cognitive load indicators"""
        load = 0.0

        # Stress contribution
        load += learning_state.stress_level * 40

        # Fatigue contribution
        load += learning_state.fatigue_level * 30

        # Attention strain
        if learning_state.attention_score < 0.5:
            load += 30

        return min(load, 100)

    def _check_critical_alerts(self, learning_state, adhd_score, visual_strain, cognitive_load):
        """Check for critical conditions requiring immediate attention"""
        current_time = datetime.now()

        # High stress alert
        if learning_state.stress_level > 0.8:
            self.critical_alerts.append({
                'type': 'high_stress',
                'message': 'High stress level detected - consider immediate break',
                'timestamp': current_time,
                'severity': 'high'
            })

        # Visual strain alert
        if visual_strain > 75:
            self.critical_alerts.append({
                'type': 'visual_strain',
                'message': 'Severe visual strain detected - adjust display settings',
                'timestamp': current_time,
                'severity': 'high'
            })

        # ADHD support needed
        if adhd_score > 70:
            self.critical_alerts.append({
                'type': 'adhd_support',
                'message': 'ADHD patterns detected - enable structured support',
                'timestamp': current_time,
                'severity': 'medium'
            })

        # Cognitive overload
        if cognitive_load > 80:
            self.critical_alerts.append({
                'type': 'cognitive_overload',
                'message': 'Cognitive overload detected - simplify content',
                'timestamp': current_time,
                'severity': 'high'
            })

        # Keep only recent alerts (last 24 hours)
        cutoff_time = current_time - timedelta(hours=24)
        self.critical_alerts = [alert for alert in self.critical_alerts if alert['timestamp'] > cutoff_time]

    def generate_analytics_report(self, time_window_hours=24):
        """Generate comprehensive analytics report with insights and recommendations"""
        cutoff_time = datetime.now() - timedelta(hours=time_window_hours)

        # Filter recent data
        recent_data = self._filter_recent_data(cutoff_time)

        if not recent_data['timestamps']:
            return {'error': 'No data available for the specified time window'}

        # Calculate summary statistics
        summary_stats = self._calculate_summary_statistics(recent_data)

        # Generate insights
        insights = self._generate_insights(recent_data, summary_stats)

        # Create visualizations
        visualizations = self._create_tiny_graphs(recent_data)

        # Performance metrics
        performance_metrics = self._calculate_performance_metrics(recent_data)

        return {
            'summary': summary_stats,
            'insights': insights,
            'visualizations': visualizations,
            'performance_metrics': performance_metrics,
            'critical_alerts': self.critical_alerts[-10:],  # Last 10 alerts
            'recommendations': self._generate_recommendations(summary_stats),
            'generated_at': datetime.now(),
            'data_points': len(recent_data['timestamps']),
            'session_duration': str(datetime.now() - self.session_start_time)
        }

    def _filter_recent_data(self, cutoff_time):
        """Filter analytics data based on timestamp"""
        filtered_data = {key: [] for key in self.analytics_data.keys()}

        for i, timestamp in enumerate(self.analytics_data['timestamps']):
            if timestamp >= cutoff_time:
                for key in self.analytics_data.keys():
                    if i < len(self.analytics_data[key]):
                        filtered_data[key].append(self.analytics_data[key][i])

        return filtered_data

    def _calculate_summary_statistics(self, data):
        """Calculate comprehensive summary statistics"""
        stats = {}

        if data['stress_levels']:
            stats['avg_stress'] = np.mean(data['stress_levels'])
            stats['max_stress'] = np.max(data['stress_levels'])
            stats['stress_trend'] = 'increasing' if len(data['stress_levels']) > 1 and data['stress_levels'][-1] > data['stress_levels'][0] else 'stable'

        if data['emotions']:
            emotion_counts = pd.Series(data['emotions']).value_counts()
            stats['dominant_emotion'] = emotion_counts.index[0] if len(emotion_counts) > 0 else 'neutral'
            stats['emotion_diversity'] = len(emotion_counts)

        if data['adhd_scores']:
            stats['avg_adhd_risk'] = np.mean(data['adhd_scores'])
            stats['adhd_category'] = self._categorize_adhd_risk(stats['avg_adhd_risk'])

        if data['attention_scores']:
            stats['avg_attention'] = np.mean(data['attention_scores'])
            stats['attention_stability'] = 100 - np.std(data['attention_scores'])

        if data['visual_strain']:
            stats['avg_visual_strain'] = np.mean(data['visual_strain'])
            stats['max_visual_strain'] = np.max(data['visual_strain'])

        if data['cognitive_load']:
            stats['avg_cognitive_load'] = np.mean(data['cognitive_load'])
            stats['peak_cognitive_load'] = np.max(data['cognitive_load'])

        if data['engagement_levels']:
            stats['avg_engagement'] = np.mean(data['engagement_levels'])
            stats['engagement_trend'] = self._calculate_trend(data['engagement_levels'])

        return stats

    def _generate_insights(self, data, stats):
        """Generate AI-powered insights from the data"""
        insights = []

        # Stress insights
        if 'avg_stress' in stats:
            if stats['avg_stress'] > 60:
                insights.append({
                    'type': 'stress',
                    'message': f"High average stress level ({stats['avg_stress']:.1f}%). Consider implementing stress reduction techniques.",
                    'priority': 'high',
                    'action': 'immediate'
                })
            elif stats.get('stress_trend') == 'increasing':
                insights.append({
                    'type': 'stress',
                    'message': "Stress levels are trending upward. Monitor closely and consider preventive measures.",
                    'priority': 'medium',
                    'action': 'monitor'
                })

        # Attention insights
        if 'avg_attention' in stats:
            if stats['avg_attention'] < 50:
                insights.append({
                    'type': 'attention',
                    'message': f"Low attention scores ({stats['avg_attention']:.1f}%). Recommend shorter learning sessions and breaks.",
                    'priority': 'high',
                    'action': 'adapt'
                })
            elif stats.get('attention_stability', 100) < 70:
                insights.append({
                    'type': 'attention',
                    'message': "Attention levels are unstable. Consider structured learning approaches.",
                    'priority': 'medium',
                    'action': 'structure'
                })

        # ADHD insights
        if 'avg_adhd_risk' in stats and stats['avg_adhd_risk'] > 60:
            insights.append({
                'type': 'adhd',
                'message': f"ADHD patterns detected ({stats['adhd_category']}). Enable structured support features.",
                'priority': 'high',
                'action': 'support'
            })

        # Visual strain insights
        if 'avg_visual_strain' in stats and stats['avg_visual_strain'] > 50:
            insights.append({
                'type': 'visual',
                'message': f"Visual strain detected ({stats['avg_visual_strain']:.1f}%). Adjust display settings and lighting.",
                'priority': 'medium',
                'action': 'environment'
            })

        # Engagement insights
        if 'avg_engagement' in stats:
            if stats['avg_engagement'] < 40:
                insights.append({
                    'type': 'engagement',
                    'message': "Low engagement levels. Consider more interactive content and gamification.",
                    'priority': 'medium',
                    'action': 'content'
                })

        return insights

    def _create_tiny_graphs(self, data):
        """Create tiny, Flask-ready visualizations using Plotly"""
        visualizations = {}

        # Emotion distribution pie chart
        if data['emotions']:
            emotion_counts = pd.Series(data['emotions']).value_counts()
            fig_emotions = px.pie(
                values=emotion_counts.values,
                names=emotion_counts.index,
                title="Emotion Distribution",
                width=300, height=250,
                color_discrete_sequence=px.colors.qualitative.Set3
            )
            fig_emotions.update_layout(
                margin=dict(t=40, b=20, l=20, r=20),
                font=dict(size=10)
            )
            visualizations['emotions_pie'] = json.dumps(fig_emotions, cls=PlotlyJSONEncoder)

        # Multi-metric timeline
        if data['timestamps'] and len(data['timestamps']) > 1:
            df = pd.DataFrame({
                'Time': data['timestamps'],
                'Stress': data['stress_levels'],
                'Attention': data['attention_scores'],
                'Engagement': data['engagement_levels']
            })

            fig_timeline = go.Figure()
            fig_timeline.add_trace(go.Scatter(x=df['Time'], y=df['Stress'], name='Stress', line=dict(color='red', width=2)))
            fig_timeline.add_trace(go.Scatter(x=df['Time'], y=df['Attention'], name='Attention', line=dict(color='blue', width=2)))
            fig_timeline.add_trace(go.Scatter(x=df['Time'], y=df['Engagement'], name='Engagement', line=dict(color='green', width=2)))

            fig_timeline.update_layout(
                title="Real-time Metrics",
                width=500, height=250,
                margin=dict(t=40, b=40, l=40, r=40),
                legend=dict(x=0, y=1),
                font=dict(size=10)
            )
            visualizations['metrics_timeline'] = json.dumps(fig_timeline, cls=PlotlyJSONEncoder)

        # ADHD Risk Gauge
        if data['adhd_scores']:
            latest_adhd = data['adhd_scores'][-1] if data['adhd_scores'] else 0
            fig_adhd = go.Figure(go.Indicator(
                mode = "gauge+number+delta",
                value = latest_adhd,
                domain = {'x': [0, 1], 'y': [0, 1]},
                title = {'text': "ADHD Risk Score"},
                delta = {'reference': 30},
                gauge = {
                    'axis': {'range': [None, 100]},
                    'bar': {'color': "darkblue"},
                    'steps': [
                        {'range': [0, 30], 'color': "lightgreen"},
                        {'range': [30, 60], 'color': "yellow"},
                        {'range': [60, 100], 'color': "red"}
                    ],
                    'threshold': {
                        'line': {'color': "red", 'width': 4},
                        'thickness': 0.75,
                        'value': 70
                    }
                }
            ))
            fig_adhd.update_layout(width=300, height=250, margin=dict(t=30, b=20, l=20, r=20))
            visualizations['adhd_gauge'] = json.dumps(fig_adhd, cls=PlotlyJSONEncoder)

        # Accessibility needs heatmap
        if data['timestamps'] and data['visual_strain'] and data['cognitive_load']:
            recent_count = min(20, len(data['timestamps']))
            heatmap_data = np.array([
                data['visual_strain'][-recent_count:],
                data['cognitive_load'][-recent_count:],
                data['stress_levels'][-recent_count:]
            ])

            fig_heatmap = px.imshow(
                heatmap_data,
                labels=dict(x="Time Points", y="Metrics", color="Intensity"),
                y=['Visual Strain', 'Cognitive Load', 'Stress Level'],
                title="Accessibility Strain Heatmap",
                width=400, height=200,
                color_continuous_scale="RdYlGn_r"
            )
            fig_heatmap.update_layout(margin=dict(t=40, b=20, l=60, r=20))
            visualizations['accessibility_heatmap'] = json.dumps(fig_heatmap, cls=PlotlyJSONEncoder)

        # Performance radar chart
        if all(key in data and data[key] for key in ['attention_scores', 'engagement_levels', 'motor_precision']):
            avg_attention = np.mean(data['attention_scores'][-10:]) if len(data['attention_scores']) >= 10 else np.mean(data['attention_scores'])
            avg_engagement = np.mean(data['engagement_levels'][-10:]) if len(data['engagement_levels']) >= 10 else np.mean(data['engagement_levels'])
            avg_motor = np.mean(data['motor_precision'][-10:]) if len(data['motor_precision']) >= 10 else np.mean(data['motor_precision'])

            categories = ['Attention', 'Engagement', 'Motor Precision', 'Focus Stability']
            values = [avg_attention, avg_engagement, avg_motor, avg_attention]  # Repeat first value to close radar

            fig_radar = go.Figure()
            fig_radar.add_trace(go.Scatterpolar(
                r=values,
                theta=categories,
                fill='toself',
                name='Performance'
            ))
            fig_radar.update_layout(
                polar=dict(
                    radialaxis=dict(
                        visible=True,
                        range=[0, 100]
                    )),
                title="Performance Overview",
                width=300, height=250,
                margin=dict(t=40, b=20, l=20, r=20)
            )
            visualizations['performance_radar'] = json.dumps(fig_radar, cls=PlotlyJSONEncoder)

        return visualizations

    def _calculate_performance_metrics(self, data):
        """Calculate key performance indicators"""
        metrics = {}

        if data['attention_scores']:
            metrics['attention_efficiency'] = np.mean(data['attention_scores'])
            metrics['attention_consistency'] = 100 - np.std(data['attention_scores'])

        if data['engagement_levels']:
            metrics['engagement_rate'] = np.mean(data['engagement_levels'])
            metrics['peak_engagement'] = np.max(data['engagement_levels'])

        if data['stress_levels']:
            stress_spikes = sum(1 for s in data['stress_levels'] if s > 70)
            metrics['stress_management'] = max(0, 100 - (stress_spikes / len(data['stress_levels']) * 100))

        if data['visual_strain']:
            metrics['visual_comfort'] = max(0, 100 - np.mean(data['visual_strain']))

        metrics['total_adaptations'] = self.total_adaptations
        metrics['critical_events'] = len([alert for alert in self.critical_alerts if alert['severity'] == 'high'])

        return metrics

    def _generate_recommendations(self, stats):
        """Generate actionable recommendations based on analysis"""
        recommendations = []

        if 'avg_stress' in stats and stats['avg_stress'] > 50:
            recommendations.append({
                'category': 'stress_management',
                'action': 'Implement stress reduction techniques',
                'details': ['Deep breathing exercises', 'Progressive muscle relaxation', '5-minute mindfulness breaks'],
                'priority': 'high' if stats['avg_stress'] > 70 else 'medium'
            })

        if 'avg_adhd_risk' in stats and stats['avg_adhd_risk'] > 40:
            recommendations.append({
                'category': 'adhd_support',
                'action': 'Enable ADHD-friendly features',
                'details': ['Structured task breakdown', 'Frequent breaks', 'Clear progress indicators', 'Reduced distractions'],
                'priority': 'high' if stats['avg_adhd_risk'] > 60 else 'medium'
            })

        if 'avg_attention' in stats and stats['avg_attention'] < 60:
            recommendations.append({
                'category': 'attention_improvement',
                'action': 'Optimize attention and focus',
                'details': ['Shorter learning sessions', 'Interactive content', 'Gamification elements'],
                'priority': 'high'
            })

        if 'avg_visual_strain' in stats and stats['avg_visual_strain'] > 40:
            recommendations.append({
                'category': 'visual_comfort',
                'action': 'Reduce visual strain',
                'details': ['Adjust screen brightness', 'Increase font size', 'Use high contrast mode', 'Take regular eye breaks'],
                'priority': 'medium'
            })

        return recommendations

    def _categorize_adhd_risk(self, score):
        """Categorize ADHD risk based on score"""
        if score < 30:
            return 'Low Risk'
        elif score < 60:
            return 'Moderate Risk'
        else:
            return 'High Risk'

    def _calculate_trend(self, values):
        """Calculate trend direction for a series of values"""
        if len(values) < 2:
            return 'stable'

        first_half = np.mean(values[:len(values)//2])
        second_half = np.mean(values[len(values)//2:])

        if second_half > first_half * 1.1:
            return 'increasing'
        elif second_half < first_half * 0.9:
            return 'decreasing'
        else:
            return 'stable'

    def get_flask_interface_data(self):
        """Get all data formatted for Flask application"""
        latest_analytics = self.generate_analytics_report(time_window_hours=1)

        # Current state from latest data points
        current_state = {
            'emotion': self.analytics_data['emotions'][-1] if self.analytics_data['emotions'] else 'neutral',
            'stress_level': self.analytics_data['stress_levels'][-1] if self.analytics_data['stress_levels'] else 0,
            'adhd_risk': self.analytics_data['adhd_scores'][-1] if self.analytics_data['adhd_scores'] else 0,
            'attention_score': self.analytics_data['attention_scores'][-1] if self.analytics_data['attention_scores'] else 70,
            'engagement_level': self.analytics_data['engagement_levels'][-1] if self.analytics_data['engagement_levels'] else 50,
            'visual_strain': self.analytics_data['visual_strain'][-1] if self.analytics_data['visual_strain'] else 0,
            'cognitive_load': self.analytics_data['cognitive_load'][-1] if self.analytics_data['cognitive_load'] else 0,
            'adaptations_active': self.total_adaptations
        }

        return {
            'current_state': current_state,
            'analytics': latest_analytics,
            'recommendations': self._get_current_recommendations(),
            'critical_alerts': [alert for alert in self.critical_alerts if alert['timestamp'] > datetime.now() - timedelta(hours=1)],
            'session_info': {
                'duration': str(datetime.now() - self.session_start_time),
                'data_points': len(self.analytics_data['timestamps']),
                'adaptations_made': self.total_adaptations
            },
            'status': 'active',
            'last_updated': datetime.now().isoformat()
        }

    def _get_current_recommendations(self):
        """Get immediate recommendations based on current state"""
        recommendations = []

        if self.analytics_data['stress_levels'] and self.analytics_data['stress_levels'][-1] > 60:
            recommendations.append("Take a 5-minute breathing break")

        if self.analytics_data['adhd_scores'] and self.analytics_data['adhd_scores'][-1] > 50:
            recommendations.append("Switch to structured task format")

        if self.analytics_data['attention_scores'] and self.analytics_data['attention_scores'][-1] < 50:
            recommendations.append("Consider a short break to refocus")

        if self.analytics_data['visual_strain'] and self.analytics_data['visual_strain'][-1] > 60:
            recommendations.append("Adjust screen brightness and take eye break")

        return recommendations if recommendations else ["Continue with current approach"]

    def export_session_data(self):
        """Export comprehensive session data for analysis"""
        return {
            'session_summary': {
                'total_emotions': len(self.emotion_buffer),
                'total_attention_points': len(self.attention_buffer),
                'avg_attention': np.mean([a['score'] for a in self.attention_buffer]) if self.attention_buffer else 0,
                'fidget_episodes': self.fidget_count,
                'session_duration_minutes': (time.time() - self.attention_buffer[0]['timestamp']) / 60 if self.attention_buffer else 0,
                'total_adaptations': self.total_adaptations,
                'critical_alerts_count': len(self.critical_alerts)
            },
            'analytics_data': self.analytics_data,
            'raw_buffers': {
                'emotions': list(self.emotion_buffer),
                'attention': list(self.attention_buffer),
                'movements': list(self.movement_buffer),
                'head_poses': list(self.head_pose_buffer)
            },
            'critical_alerts': self.critical_alerts
        }

    def generate_pdf_report(self, filename="accessibility_report.pdf"):
        """Generate a professional PDF report with ReportLab and Matplotlib"""
        doc = SimpleDocTemplate(filename, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        # Custom Styles
        title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor("#0056D2"), spaceAfter=10, alignment=1)
        subtitle_style = ParagraphStyle('SubtitleStyle', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor("#475569"), spaceAfter=20, alignment=1)
        heading_style = ParagraphStyle('HeadingStyle', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor("#1E293B"), spaceAfter=12, spaceBefore=15)
        subheading_style = ParagraphStyle('SubheadingStyle', parent=styles['Heading3'], fontSize=14, textColor=colors.HexColor("#334155"), spaceAfter=8, spaceBefore=12)
        text_style = styles['Normal']
        bullet_style = ParagraphStyle('BulletStyle', parent=styles['Normal'], leftIndent=20, spaceAfter=2)
        
        # Title
        story.append(Paragraph("Accessibility Analytics Report", title_style))
        story.append(Paragraph("Comprehensive Emotion, Attention, Stress & Engagement Analysis", subtitle_style))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ParagraphStyle('DateStyle', parent=styles['Normal'], alignment=1, spaceAfter=20)))

        # Safety check for empty data
        if not self.analytics_data or not self.analytics_data['timestamps']:
            story.append(Paragraph("No sufficient data was collected during this session to generate a detailed analytics profile.", text_style))
            story.append(Spacer(1, 0.2 * inch))
            story.append(Paragraph("To generate a full report, please ensure the AI Track is active for at least 30-60 seconds during your study session.", text_style))
            doc.build(story)
            print(f"Report generated (Empty session): {filename}")
            return filename

        report_data = self.generate_analytics_report()
        metrics = self._calculate_performance_metrics(self.analytics_data)

        # ── Executive Summary ──
        story.append(Paragraph("Executive Summary", heading_style))
        summary = report_data.get('summary', {})
        story.append(Paragraph(f"• Average Stress Level: {summary.get('avg_stress', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Average Attention Score: {summary.get('avg_attention', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Average Engagement Level: {summary.get('avg_engagement', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Dominant Emotion: {summary.get('dominant_emotion', 'neutral').title()}", bullet_style))
        story.append(Paragraph(f"• Session Duration: {report_data.get('session_duration', '0:00:00')}", bullet_style))
        story.append(Paragraph(f"• Data Points Collected: {report_data.get('data_points', 0)}", bullet_style))
        story.append(Spacer(1, 0.2 * inch))

        # ── Detailed Performance Analysis ──
        story.append(Paragraph("Detailed Performance Analysis", heading_style))
        
        # Emotional State Analysis
        story.append(Paragraph("Emotional State Analysis", subheading_style))
        story.append(Paragraph("Throughout the session, your emotional patterns revealed important insights about your learning experience:", text_style))
        unique_emotions = set(self.analytics_data['emotions']) if self.analytics_data['emotions'] else set()
        story.append(Paragraph(f"• Primary Emotion: {summary.get('dominant_emotion', 'neutral').title()}", bullet_style))
        story.append(Paragraph(f"• Emotional Diversity: {len(unique_emotions)} different emotions detected", bullet_style))
        story.append(Paragraph(f"• Emotional Stability: {'Stable' if len(unique_emotions) <= 2 else 'Variable'}", bullet_style))
        story.append(Paragraph(f"Interpretation: {'Positive emotional state indicates good learning conditions and engagement.' if summary.get('dominant_emotion') in ['happy', 'focused'] else 'Varying emotions may indicate a challenging or stimulating learning environment.'}", text_style))
        
        # Emotion Graph
        if self.analytics_data['emotions']:
            emotion_counts = pd.Series(self.analytics_data['emotions']).value_counts()
            plt.figure(figsize=(6, 3))
            plt.pie(emotion_counts.values, labels=emotion_counts.index, autopct='%1.1f%%', colors=sns.color_palette('pastel'))
            plt.title("Emotion Distribution")
            img_buf = BytesIO()
            plt.savefig(img_buf, format='png', bbox_inches='tight', dpi=100)
            plt.close()
            story.append(Image(img_buf, width=5*inch, height=2.5*inch))
        
        story.append(Spacer(1, 0.2 * inch))

        # Attention & Focus Analysis
        story.append(Paragraph("Attention & Focus Analysis", subheading_style))
        story.append(Paragraph("Your attention patterns during the learning session show:", text_style))
        story.append(Paragraph(f"• Average Attention Score: {summary.get('avg_attention', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Attention Stability: {metrics.get('attention_consistency', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Focus Quality: {'Excellent' if summary.get('avg_attention', 0) > 80 else 'Good' if summary.get('avg_attention', 0) > 60 else 'Fair'}", bullet_style))
        story.append(Paragraph(f"Analysis: {'Strong focus maintained.' if summary.get('avg_attention', 0) > 70 else 'Good attention levels but could be improved with structured breaks and engagement techniques.'}", text_style))
        
        # Attention Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['attention_scores'], color='#0056D2', linewidth=2)
        plt.title("Attention Levels Over Time")
        plt.ylabel("Score")
        plt.grid(True, alpha=0.3)
        img_buf = BytesIO()
        plt.savefig(img_buf, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf, width=5*inch, height=2.5*inch))
        
        story.append(PageBreak())

        # Stress Level Analysis
        story.append(Paragraph("Stress Level Analysis", subheading_style))
        story.append(Paragraph("Stress monitoring throughout your session indicates:", text_style))
        peak_stress = max(self.analytics_data['stress_levels']) if self.analytics_data['stress_levels'] else 0
        stress_trend = self._calculate_trend(self.analytics_data['stress_levels']) if self.analytics_data['stress_levels'] else 'stable'
        story.append(Paragraph(f"• Average Stress Level: {summary.get('avg_stress', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Peak Stress Level: {peak_stress:.1f}%", bullet_style))
        story.append(Paragraph(f"• Stress Trend: {stress_trend.title()}", bullet_style))
        story.append(Paragraph(f"Implications: {'Stress levels are rising. Consider taking breaks and reducing cognitive load.' if stress_trend == 'increasing' else 'Stress levels are well managed.'}", text_style))

        # Stress Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['stress_levels'], color='#EF4444', linewidth=2)
        plt.title("Stress Intensity Profile")
        plt.ylabel("Stress %")
        plt.grid(True, alpha=0.3)
        img_buf_stress = BytesIO()
        plt.savefig(img_buf_stress, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf_stress, width=5*inch, height=2.5*inch))

        story.append(Spacer(1, 0.2 * inch))

        # Engagement Level Analysis
        story.append(Paragraph("Engagement Level Analysis", subheading_style))
        story.append(Paragraph("Your engagement with the learning material shows:", text_style))
        peak_engagement = max(self.analytics_data['engagement_levels']) if self.analytics_data['engagement_levels'] else 0
        engagement_trend = self._calculate_trend(self.analytics_data['engagement_levels']) if self.analytics_data['engagement_levels'] else 'stable'
        story.append(Paragraph(f"• Average Engagement: {summary.get('avg_engagement', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Engagement Trend: {engagement_trend.title()}", bullet_style))
        story.append(Paragraph(f"• Peak Engagement: {peak_engagement:.1f}%", bullet_style))
        story.append(Paragraph(f"Assessment: {'High engagement.' if summary.get('avg_engagement', 0) > 70 else 'Moderate engagement. Consider more interactive elements and varied content presentation.'}", text_style))

        # Engagement Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['engagement_levels'], color='#10B981', linewidth=2)
        plt.title("Engagement Levels Over Time")
        plt.ylabel("Engagement %")
        plt.grid(True, alpha=0.3)
        img_buf_eng = BytesIO()
        plt.savefig(img_buf_eng, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf_eng, width=5*inch, height=2.5*inch))

        story.append(PageBreak())

        # ── Accessibility Insights ──
        story.append(Paragraph("Accessibility Insights", heading_style))

        # ADHD Risk Assessment
        story.append(Paragraph("ADHD Risk Assessment", subheading_style))
        avg_adhd = summary.get('avg_adhd_risk', 0)
        adhd_risk_level = self._categorize_adhd_risk(avg_adhd)
        story.append(Paragraph(f"ADHD Risk Score: {avg_adhd:.1f}% ({adhd_risk_level})", text_style))
        story.append(Paragraph("Low ADHD risk. Current attention patterns appear typical for learning activities." if avg_adhd < 40 else "Elevated ADHD risk detected. Consider structuring tasks into smaller chunks.", text_style))
        
        # ADHD Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['adhd_scores'], color='#F59E0B', linewidth=2)
        plt.title("ADHD Risk Indicators Over Time")
        plt.ylabel("Risk Score")
        plt.grid(True, alpha=0.3)
        img_buf_adhd = BytesIO()
        plt.savefig(img_buf_adhd, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf_adhd, width=5*inch, height=2.5*inch))
        story.append(Spacer(1, 0.2 * inch))

        # Visual Strain Assessment
        story.append(Paragraph("Visual Strain Assessment", subheading_style))
        avg_visual = summary.get('avg_visual_strain', 0)
        peak_visual = max(self.analytics_data['visual_strain']) if self.analytics_data['visual_strain'] else 0
        story.append(Paragraph(f"Average Visual Strain: {avg_visual:.1f}% Peak Visual Strain: {peak_visual:.1f}%", text_style))
        story.append(Paragraph("Visual comfort levels are good. Current display settings appear appropriate." if avg_visual < 50 else "High visual strain detected. Recommend adjusting display settings.", text_style))

        # Visual Strain Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['visual_strain'], color='#8B5CF6', linewidth=2)
        plt.title("Visual Strain Over Time")
        plt.ylabel("Strain %")
        plt.grid(True, alpha=0.3)
        img_buf_vis = BytesIO()
        plt.savefig(img_buf_vis, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf_vis, width=5*inch, height=2.5*inch))
        
        story.append(PageBreak())

        # Cognitive Load Assessment
        story.append(Paragraph("Cognitive Load Assessment", subheading_style))
        avg_cog = summary.get('avg_cognitive_load', 0)
        peak_cog = max(self.analytics_data['cognitive_load']) if self.analytics_data['cognitive_load'] else 0
        story.append(Paragraph(f"Average Cognitive Load: {avg_cog:.1f}% Peak Cognitive Load: {peak_cog:.1f}%", text_style))
        story.append(Paragraph("Cognitive load is manageable. Current learning pace appears appropriate." if avg_cog < 60 else "High cognitive load detected. Consider simplifying material.", text_style))

        # Cognitive Load Graph
        plt.figure(figsize=(6, 3))
        plt.plot(self.analytics_data['cognitive_load'], color='#EC4899', linewidth=2)
        plt.title("Cognitive Load Over Time")
        plt.ylabel("Load %")
        plt.grid(True, alpha=0.3)
        img_buf_cog = BytesIO()
        plt.savefig(img_buf_cog, format='png', bbox_inches='tight', dpi=100)
        plt.close()
        story.append(Image(img_buf_cog, width=5*inch, height=2.5*inch))
        
        story.append(Spacer(1, 0.2 * inch))

        # ── Personalized Recommendations ──
        story.append(Paragraph("Personalized Recommendations", heading_style))
        for rec in report_data.get('recommendations', []):
            story.append(Paragraph(rec['category'].replace('_', ' ').title(), subheading_style))
            story.append(Paragraph(f"Action: {rec['action']}", text_style))
            for detail in rec.get('details', []):
                story.append(Paragraph(f"• {detail}", bullet_style))
            story.append(Paragraph(f"Priority: {rec['priority'].title()}", text_style))
            story.append(Spacer(1, 0.1 * inch))

        if not report_data.get('recommendations'):
            story.append(Paragraph("General", subheading_style))
            story.append(Paragraph("Action: Continue current study habits", text_style))
            story.append(Paragraph("Priority: Low", text_style))

        story.append(Spacer(1, 0.2 * inch))

        # ── Technical Insights ──
        story.append(Paragraph("Technical Insights", heading_style))
        for insight in report_data.get('insights', []):
            story.append(Paragraph(f"{insight.get('type', 'General').replace('_', ' ').title()} Insight", subheading_style))
            story.append(Paragraph(insight.get('message', ''), text_style))
            story.append(Paragraph(f"Recommended Action: {insight.get('action', 'None')}", text_style))
            story.append(Spacer(1, 0.1 * inch))
        
        if not report_data.get('insights'):
             story.append(Paragraph("General Insight", subheading_style))
             story.append(Paragraph("Performance is stable across all metrics.", text_style))
             story.append(Paragraph("Recommended Action: Monitor", text_style))

        story.append(Spacer(1, 0.2 * inch))

        # ── Performance Metrics ──
        story.append(Paragraph("Performance Metrics", heading_style))
        story.append(Paragraph(f"• Attention Efficiency: {metrics.get('attention_efficiency', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Engagement Rate: {metrics.get('engagement_rate', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Stress Management: {metrics.get('stress_management', 0):.1f}%", bullet_style))
        story.append(Paragraph(f"• Visual Comfort: {metrics.get('visual_comfort', 0):.1f}%", bullet_style))

        doc.build(story)
        print(f"Report generated successfully: {filename}")
        return filename

# Flask Integration Helper Class
class FlaskAccessibilityAPI:
    """
    Helper class for Flask integration with REST API endpoints
    Provides easy-to-use interface for web applications
    """

    def __init__(self):
        self.tracker = AdaptiveLearningCV()
        self.is_active = False
        self.camera = None
        self.processing_thread = None
        self.stop_processing = False

    def start_tracking(self, camera_index=0):
        """Start the tracking system with camera"""
        try:
            self.camera = cv2.VideoCapture(camera_index)
            if not self.camera.isOpened():
                return {"status": "error", "message": "Could not open camera"}

            self.is_active = True
            self.stop_processing = False

            # Start processing in separate thread
            self.processing_thread = threading.Thread(target=self._process_camera_stream)
            self.processing_thread.daemon = True
            self.processing_thread.start()

            return {"status": "success", "message": "Tracking started successfully"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to start tracking: {str(e)}"}

    def stop_tracking(self):
        """Stop the tracking system"""
        self.is_active = False
        self.stop_processing = True

        if self.processing_thread and self.processing_thread.is_alive():
            self.processing_thread.join(timeout=2.0)

        if self.camera:
            self.camera.release()

        return {"status": "success", "message": "Tracking stopped successfully"}

    def _process_camera_stream(self):
        """Process camera stream in separate thread"""
        frame_count = 0
        while self.is_active and not self.stop_processing:
            try:
                ret, frame = self.camera.read()
                if not ret:
                    continue

                frame_count += 1
                # Process every 3rd frame for performance
                if frame_count % 3 == 0:
                    self.tracker.process_frame(frame)

                time.sleep(0.1)  # Small delay to prevent overwhelming
            except Exception as e:
                self.tracker.logger.error(f"Processing error: {e}")

    def get_current_analysis(self):
        """Get current frame analysis without camera access"""
        if not self.is_active:
            return {"status": "error", "message": "Tracking not active"}

        try:
            # Return current state from stored analytics
            return {"status": "success", "data": self.tracker.get_flask_interface_data()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_analytics_dashboard_data(self):
        """Get complete dashboard data for Flask frontend"""
        try:
            return {
                "status": "success",
                "data": self.tracker.get_flask_interface_data()
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_tiny_graphs_json(self, time_window_hours=1):
        """Get tiny graphs as JSON for Flask templates"""
        try:
            report = self.tracker.generate_analytics_report(time_window_hours=time_window_hours)
            if 'error' in report:
                return {"status": "error", "message": report['error']}

            return {
                "status": "success",
                "visualizations": report.get('visualizations', {}),
                "summary": report.get('summary', {}),
                "insights": report.get('insights', [])
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_real_time_data(self):
        """Get real-time data for live updates"""
        if not self.is_active:
            return {"status": "inactive", "message": "Tracking not active"}

        try:
            current_data = self.tracker.get_flask_interface_data()
            return {
                "status": "active",
                "timestamp": datetime.now().isoformat(),
                "current_state": current_data['current_state'],
                "recommendations": current_data['recommendations'],
                "critical_alerts": current_data['critical_alerts']
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def export_session_analytics(self):
        """Export complete session data for download"""
        try:
            session_data = self.tracker.export_session_data()
            analytics_report = self.tracker.generate_analytics_report(time_window_hours=24)

            export_data = {
                **session_data,
                'full_analytics_report': analytics_report,
                'export_timestamp': datetime.now().isoformat(),
                'export_version': '1.0'
            }

            return {"status": "success", "data": export_data}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def generate_pdf_report(self):
        """Generate and return path to PDF report"""
        try:
            filename = f"report_{int(time.time())}.pdf"
            path = self.tracker.generate_pdf_report(filename)
            return {"status": "success", "pdf_path": path}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def simulate_demo_data(self, duration_minutes=5):
        """Generate demo data for testing Flask integration"""
        try:
            demo_emotions = ['happy', 'neutral', 'focused', 'stressed', 'engaged', 'tired']
            demo_count = duration_minutes * 12  # 12 data points per minute

            for i in range(demo_count):
                # Create mock learning state
                mock_emotion = np.random.choice(demo_emotions)
                mock_state = LearningState(
                    primary_emotion=mock_emotion,
                    emotion_confidence=np.random.uniform(0.6, 0.95),
                    stress_level=np.random.uniform(0.1, 0.8),
                    attention_score=np.random.uniform(0.3, 0.9),
                    engagement_level=np.random.uniform(0.2, 0.85),
                    fatigue_level=np.random.uniform(0.1, 0.7),
                    accessibility_needs=AccessibilityAssessment(
                        visual_impairment_indicators=np.random.uniform(0.0, 0.5),
                        motor_impairment_indicators=np.random.uniform(0.0, 0.4),
                        attention_difficulties=np.random.uniform(0.0, 0.6),
                        cognitive_load_stress=np.random.uniform(0.1, 0.7),
                        reading_difficulties=np.random.uniform(0.0, 0.3),
                        recommendations=[]
                    )
                )

                # Mock eye and hand data
                mock_eye_data = {
                    'blink_rate': np.random.randint(10, 25),
                    'gaze_stability': np.random.uniform(0.02, 0.15),
                    'potential_reading_difficulty': np.random.choice([True, False], p=[0.2, 0.8])
                }

                mock_hand_data = {
                    'motor_precision': np.random.uniform(0.6, 1.0),
                    'fidgeting_detected': np.random.choice([True, False], p=[0.3, 0.7])
                }

                # Store the data
                self.tracker._store_analytics_data(mock_state, mock_eye_data, mock_hand_data)

                # Small delay to simulate real-time data collection
                time.sleep(0.01)

            return {
                "status": "success",
                "message": f"Generated {demo_count} demo data points over {duration_minutes} minutes",
                "data_points": demo_count
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_accessibility_recommendations(self):
        """Get current accessibility recommendations"""
        try:
            current_data = self.tracker.get_flask_interface_data()
            analytics = current_data['analytics']

            recommendations = {
                'immediate': current_data['recommendations'],
                'detailed': analytics.get('recommendations', []),
                'critical_alerts': current_data['critical_alerts'],
                'performance_suggestions': []
            }

            # Add performance-based suggestions
            if 'performance_metrics' in analytics:
                metrics = analytics['performance_metrics']
                if metrics.get('attention_efficiency', 70) < 50:
                    recommendations['performance_suggestions'].append("Consider shorter learning sessions")
                if metrics.get('stress_management', 70) < 50:
                    recommendations['performance_suggestions'].append("Implement regular stress breaks")
                if metrics.get('visual_comfort', 70) < 50:
                    recommendations['performance_suggestions'].append("Adjust display settings for comfort")

            return {"status": "success", "recommendations": recommendations}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_learning_insights(self):
        """Get AI-powered learning insights"""
        try:
            analytics = self.tracker.generate_analytics_report(time_window_hours=2)
            if 'error' in analytics:
                return {"status": "error", "message": analytics['error']}

            insights = {
                'summary': analytics.get('summary', {}),
                'trends': analytics.get('insights', []),
                'performance': analytics.get('performance_metrics', {}),
                'recommendations': analytics.get('recommendations', []),
                'session_overview': {
                    'duration': analytics.get('session_duration', '0:00:00'),
                    'data_points': analytics.get('data_points', 0),
                    'adaptations_made': self.tracker.total_adaptations
                }
            }

            return {"status": "success", "insights": insights}
        except Exception as e:
            return {"status": "error", "message": str(e)}

# Demo and testing functionality
def create_sample_flask_data():
    """Create sample data for Flask application testing"""
    flask_api = FlaskAccessibilityAPI()

    print("Generating sample data for Flask integration...")

    # Generate demo data
    result = flask_api.simulate_demo_data(duration_minutes=3)
    print(f"[SUCCESS] Demo data generation: {result['message']}")

    # Get dashboard data
    dashboard_data = flask_api.get_analytics_dashboard_data()
    print(f"Dashboard data status: {dashboard_data['status']}")

    # Get tiny graphs
    graphs_data = flask_api.get_tiny_graphs_json()
    print(f"Graphs generation status: {graphs_data['status']}")
    if graphs_data['status'] == 'success':
        print(f"Generated {len(graphs_data['visualizations'])} visualizations")

    # Get insights
    insights_data = flask_api.get_learning_insights()
    print(f"Insights generation status: {insights_data['status']}")

    return flask_api, dashboard_data, graphs_data, insights_data

# Example usage and testing
# ── Flask Server for Frontend Integration ──
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
api = FlaskAccessibilityAPI()

@app.route('/api/track/start', methods=['POST'])
def start_track():
    res = api.start_tracking()
    return jsonify(res)

@app.route('/api/track/stop', methods=['POST'])
def stop_track():
    print("API: Stopping track...")
    api.stop_tracking()
    print("API: Generating report...")
    res = api.generate_pdf_report()
    print(f"API: Report result: {res}")
    return jsonify(res)

@app.route('/api/track/status', methods=['GET'])
def get_status():
    return jsonify({"active": api.is_active})

@app.route('/api/track/report/<filename>', methods=['GET'])
def download_report(filename):
    import os
    file_path = os.path.abspath(filename)
    print(f"API: Serving file from {file_path}")
    return send_file(file_path, as_attachment=True)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--server":
        print("Starting Accessibility API Server on port 8788...")
        app.run(port=8788, debug=False)
    else:
        print("ADAPTIVE ACCESSIBILITY TRACKER - DEMO MODE")
        print("=" * 60)
        demo_mode = input("Choose demo mode:\n1. Camera tracking\n2. Flask integration demo\n3. Generate sample data\nEnter choice (1-3): ").strip()

        if demo_mode == "1":
            print("\nStarting Camera Tracking Mode...")
            cv_system = AdaptiveLearningCV()
            cap = cv2.VideoCapture(0)
            print("Press 'q' to quit, 's' to save session data, 'a' for analytics report")
            frame_count = 0
            last_analysis_time = time.time()

            while True:
                ret, frame = cap.read()
                if not ret: break
                frame_count += 1
                if frame_count % 3 == 0:
                    try:
                        result = cv_system.process_frame(frame)
                        if result:
                            state = result['learning_state']
                            cv2.putText(frame, f"Emotion: {state.primary_emotion}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    except Exception as e: print(f"Error: {e}")
                cv2.imshow('Adaptive Learning CV System', frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'): break
            cap.release()
            cv2.destroyAllWindows()
        elif demo_mode == "2":
            flask_api, _, _, _ = create_sample_flask_data()
            print("Demo data generated.")
        elif demo_mode == "3":
            tracker = AdaptiveLearningCV()
            report = tracker.generate_analytics_report()
            print("Analytics report generated.")
        else:
            print("Invalid choice.")
    print("\nProcess completed.")

