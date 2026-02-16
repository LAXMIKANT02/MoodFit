# MoodFit AI

MoodFit AI is an AI-powered productivity and wellness assistant that helps users:

- 🏋️ Track exercise performance  
- 🪑 Monitor posture in real-time  
- 😀 Analyze emotional state  
- 📊 View detailed session analytics  
- 📈 Track progress over time  

The system uses pose landmark detection powered by Google MediaPipe and intelligent scoring algorithms to provide real-time feedback and performance insights.

---

## 🚀 Features

### 1️⃣ Fitness Tracking
Supports exercises like:
- Squats  
- Pushups  
- Lunges  
- Plank  

Includes:
- AI-based angle detection  
- Rep detection  
- Accuracy scoring (0–100%)  
- Good vs Bad rep classification  

---

### 2️⃣ Yoga Mode
Supports poses like:
- Tree Pose  
- Warrior II  

Includes:
- Hold-based evaluation  
- Stability scoring  
- Posture alignment analysis  

---

### 3️⃣ Posture Detection
- Real-time body angle monitoring  
- Detects incorrect sitting posture  
- Helps prevent back strain  

---

### 4️⃣ Emotion Tracking
- AI-based emotion recognition  
- Supports mental wellness monitoring  

---

### 5️⃣ Session Logs
- View past sessions  
- Detailed analytics graphs  
- Frame-level scoring  
- Rep-level scoring  
- Delete sessions  

---

## 🧠 AI Scoring System

The system evaluates:

- Knee angle  
- Elbow angle  
- Back angle  
- Body alignment  
- Hip angle  

Each frame is scored:

| Score Range | Category  |
|------------|-----------|
| ≥ 0.85     | Excellent |
| ≥ 0.65     | Good      |
| ≥ 0.40     | Fair      |
| < 0.40     | Poor      |

Final accuracy is calculated as:

```
Average Frame Score × 100
```

---

## 📊 Analytics System

Analytics includes:

- Total frames  
- Correct frames  
- Accuracy percentage  
- Good reps  
- Bad reps  
- Frame category distribution  
- Rep category distribution  
- Timeline graph visualization  

---

## 🗂 Project Structure

```
src/
│
├── pages/
│   ├── Home.tsx
│   ├── Logs.tsx
│   ├── ModeSelect.tsx
│   ├── PostureDetection.tsx
│   ├── SessionRecorder.tsx
│   └── Settings.tsx
│
├── utils/
│   ├── analytics.ts
│   └── sessionStorage.ts
│
└── components/
    └── SessionGraph.tsx
```

---

## 💾 Data Storage

Sessions are stored using:

- localStorage API  

Two storage types:

### 1️⃣ Session Summary
- Lightweight data  
- Basic session information  

### 2️⃣ Full Session
- Frame-by-frame landmark data  
- Used for detailed analytics  

---

## 🛠 Technologies Used

- React  
- TypeScript  
- Tailwind CSS  
- Google MediaPipe Pose  
- LocalStorage API  

---

## 🧮 Rep Detection Logic

- Uses smoothing algorithm  
- Detects peaks and valleys  
- Minimum frame threshold for valid rep  
- Depth check against ideal angle  
- Score-based classification  

---

## 📌 Modes

| Mode      | Description                                   |
|-----------|----------------------------------------------|
| Exercise  | Dynamic reps-based workout tracking          |
| Yoga      | Static hold-based pose evaluation            |

---

## ⚙️ How to Run

```bash
npm install
npm start
```

Then open:

```
http://localhost:3000
```

---

## 🔮 Future Improvements

- Cloud database integration  
- User authentication  
- Real-time alerts  
- Export analytics as PDF  
- Leaderboard system  
- AI posture correction suggestions  

---

## 📈 Overall Weighted Score

Final performance score is calculated as:

```
Average Frame Score × 100
```

This ensures smooth and fair evaluation.

---

## 👨‍💻 SoulSociety

Laxmikant, Pradyumna and Mahant Singh
CSE Students  
AI Fitness & Productivity System  

---

## 🏆 Project Purpose

This project demonstrates:

- AI-based motion analysis  
- Real-time analytics processing  
- React + TypeScript architecture  
- Data visualization  
- Performance scoring algorithms  

It is designed as an intelligent productivity and fitness assistant.

---

# MoodFit AI  
Stay Fit. Sit Right. Stay Focused.
