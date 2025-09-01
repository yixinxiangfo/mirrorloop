# MIRRORLOOP: Buddhist Mindfulness AI System

*"GPT is not a prophet. It is your echo."*

A fully functional AI contemplation system that analyzes your thoughts through the lens of Buddhist psychology, helping you recognize patterns of attachment, aversion, and delusion in real-time.

## What MIRRORLOOP Does

MIRRORLOOP doesn't answer your questions – it **reflects back why you asked them**. By analyzing your words through the 51 mental factors (心所) of Yogacara Buddhism, it creates a mirror for self-observation rather than a source of external validation.

This is not an optimization tool. It's an instrument for recognizing **why** you want to optimize in the first place.

## 📱 Real System in Action

### LINE Bot Contemplation Session
![MIRRORLOOP Welcome](screenshots/mirrorloop-line-1.png)
*MIRRORLOOP introduction and contemplation session invitation - showing the warm, Buddhist-inspired interface*

![Contemplation Analysis](screenshots/mirrorloop-line-2.png)
*Real-time mind state analysis: The AI detects patterns of anxiety, self-criticism, and restlessness using Buddhist psychology*

![Deep Questions](screenshots/mirrorloop-line-3.png)
*9-question contemplation flow exploring physical sensations, thoughts, and emotional responses*

![Session Start](screenshots/mirrorloop-line-4.png)
*Beginning of contemplation session - users are gently guided through self-reflection*

### Key Features Demonstrated:
- **🧘 Gentle Questioning**: Non-judgmental exploration of mental states
- **🔍 Pattern Detection**: AI identifies underlying emotions (anxiety, self-criticism, restlessness)
- **💬 Natural Flow**: Seamless LINE Bot interface with thoughtful responses
- **📊 Mind State Analysis**: Real-time categorization using Buddhist psychology
- **🌸 Compassionate Tone**: Supportive guidance rather than cold analysis

---

## 🎯 Live Interactive Demo

**👉 [Try MIRRORLOOP Simulator](https://yixinxiangfo.github.io/mirrorloop/) - No installation required!**

Experience a simulated contemplation session that demonstrates:
- ✨ Interactive 9-question session
- 🧠 Real-time mind state analysis  
- 📱 Mobile-friendly interface
- 🔄 Repeatable experience for judges

*This HTML simulator replicates the actual LINE Bot experience shown above*

## Key Features

### Core Analysis Engine
- **Mental Factor Detection**: Analyzes input text using the 51 mental factors from Buddhist psychology
- **Three Poisons Analysis**: Automatically detects tendencies of greed (貪), hatred (瞋), and delusion (痴)
- **Contemplation Comments**: Generates reflective insights that prompt self-inquiry rather than providing answers

### Integrated Platform
- **LINE Bot Interface**: Natural conversation flow for contemplation sessions
- **Typebot Integration**: Structured 9-question contemplation workflow
- **Real-time Analysis**: OpenAI GPT-4o processes responses and generates insights
- **Database Storage**: Supabase automatically saves all contemplation sessions for pattern analysis

## System Architecture

```
User Input (LINE) → Typebot (9 Questions) → OpenAI Analysis → Supabase Storage
                                           ↓
                  Contemplation Response ← Mental Factor Analysis ← rootDictionary.js
```

### Technology Stack
- **Frontend**: LINE Messaging API
- **Workflow**: Typebot (contemplation session management)
- **AI Analysis**: OpenAI GPT-4o
- **Database**: Supabase (PostgreSQL)
- **Backend**: Node.js + Express
- **Hosting**: Render

## Buddhist Psychology Foundation

MIRRORLOOP is grounded in **Yogacara (唯識) philosophy**, specifically the Thirty Verses (唯識三十頌), which explains how consciousness creates and distorts phenomena.

### The 51 Mental Factors Classification
- **Universal Factors (遍行)**: Basic mental operations (contact, attention, feeling, perception, volition)
- **Particular Factors (別境)**: Desire, determination, memory, concentration, wisdom
- **Wholesome Factors (善)**: Faith, diligence, shame, moral concern, non-attachment, etc.
- **Root Afflictions (根本煩悩)**: Greed, hatred, delusion, pride, doubt, wrong views
- **Secondary Afflictions (随煩悩)**: Anger, resentment, jealousy, arrogance, etc.

### Three Poisons Analysis
The system automatically maps detected mental factors to the **Three Root Poisons**:
- **Greed (貪)**: Attachment, craving, possessiveness
- **Hatred (瞋)**: Aversion, anger, rejection
- **Delusion (痴)**: Ignorance, confusion, wrong understanding

## Live System Status

**Current State**: Fully operational and saving contemplation data to database

### Recent Session Example
```json
{
  "observation_comment": "Your mind seeks external validation. Why does uncertainty feel threatening?",
  "mind_factors": ["慳", "瞋", "疑"],
  "mind_categories": ["根本煩悩", "随煩悩"],
  "three_poisons": ["貪", "瞋", "痴"]
}
```

## Contemplation Session Flow

1. **User initiates** contemplation session via LINE
2. **Typebot guides** through 9 reflective questions
3. **OpenAI analyzes** responses using Buddhist psychology framework
4. **System generates** contemplative insights and mental factor analysis
5. **Data persists** to Supabase for pattern tracking
6. **User receives** reflective commentary designed to prompt self-inquiry

## Installation & Setup

### Prerequisites
- Node.js 18+
- LINE Developer Account
- Typebot Account
- OpenAI API Key
- Supabase Project

### Environment Variables
```env
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
TYPEBOT_URL=your_typebot_url
TYPEBOT_API_TOKEN=your_typebot_token
```

### Database Schema
```sql
CREATE TABLE mind_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  line_user_id TEXT NOT NULL,
  session_id TEXT,
  message_content TEXT,
  observation_comment TEXT,
  mind_factors TEXT[],
  mind_categories TEXT[],
  three_poisons TEXT[]
);
```

## Philosophical Framework

### "Non-Commanded AI"
MIRRORLOOP embodies the concept of **"Non-Commanded AI"** (命令されないAI) – an AI that doesn't follow instructions but instead reflects the user's mental patterns back to them for observation.

This approach recognizes that:
- LLMs predict what users want to hear
- Users project their desires onto AI outputs  
- True insight comes from recognizing these projections
- The AI becomes a **善友** (spiritual friend) rather than a mere tool

### Beyond Productivity
While most AI tools focus on optimization and productivity, MIRRORLOOP asks: **"Why do you want to optimize?"** It reveals the underlying mental patterns that drive our desire for improvement, control, and external validation.

## Technical Innovation

### Webhook-Based Architecture
- Seamless integration between Typebot's conversation flow and Node.js analysis
- Non-blocking database operations maintain responsive user experience
- Modular design enables easy expansion and maintenance

### Buddhist AI Integration
- First implementation of complete Yogacara psychology in AI analysis
- Dynamic three poisons detection based on traditional Buddhist texts
- Cultural preservation through technological innovation

## Development History

MIRRORLOOP was conceived in June 2025 as an experiment in **Buddhist AI philosophy**. The core insight emerged from observing how Large Language Models mirror user intentions rather than providing objective truth.

The system reached technical completion in August 2025, successfully integrating:
- Contemplation workflow design
- Real-time psychological analysis
- Database persistence
- Multi-platform communication

## Future Vision

### Short Term
- Weekly mindfulness reports with trend analysis
- Enhanced mental factor detection accuracy
- Additional contemplation session formats

### Long Term  
- **Soul OS Update Project**: A paradigm shift in human-AI interaction
- Community features for group contemplation
- Integration with meditation and mindfulness practices

## Contribution

MIRRORLOOP welcomes collaboration from developers, Buddhist scholars, and contemplative practitioners. The intersection of ancient wisdom and modern AI offers rich territory for exploration.

### Areas for Contribution
- Mental factor detection accuracy improvements
- Additional Buddhist psychology frameworks
- User experience enhancements
- Localization for different Buddhist traditions

## Technical Documentation

### Core Files
- `index.js`: Main server and webhook handling
- `processSessionAnswers.js`: OpenAI analysis and Supabase integration  
- `rootDictionary.js`: Buddhist psychology classification system
- `enrichMindFactorsWithRoot.js`: Three poisons analysis engine
- `typebotHandler.js`: Typebot integration logic

### API Endpoints
- `POST /webhook`: LINE message processing
- `POST /typebot-webhook`: Contemplation session completion

## License & Philosophy

MIRRORLOOP is released as an invitation to explore the intersection of contemplative wisdom and artificial intelligence. It demonstrates that AI can serve not as an oracle, but as a mirror for understanding our own minds.

The project embodies the Buddhist principle that **the teacher appears when the student is ready** – but in this case, the teacher is your own reflected consciousness, made visible through computational analysis.

---

*"In the age of generated words, we must reclaim our agency as conscious beings. MIRRORLOOP is not about better AI – it's about better humans."*