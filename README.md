# MIRROR LOOP

> “The AI said what I wanted to hear.  
> But why did I want to hear it?”

**MIRROR LOOP** is a self-reflection app powered by generative AI.  
It transforms your daily messages into opportunities for contemplation, using Buddhist-inspired cognitive labeling and questioning.  
This is not a productivity tool. It’s a gateway to awareness.

---

## 🧭 Philosophy

MIRROR LOOP is rooted in a simple insight:  
**AI does not think—but it reflects.**  
Just as a mirror has no shape of its own, a large language model (LLM) has no will.  
Its output is shaped entirely by our input, our desires, and our unspoken expectations.

> ✨ The Buddha taught that our thoughts and actions arise from causes and conditions.  
> What if our AI interactions could reveal those conditions back to us?

In Buddhist tradition, a *善知識* (*kalyāṇa-mitra*) is a good friend who helps us grow in wisdom.  
MIRROR LOOP turns AI into such a companion—not by simulating empathy, but by making visible the forces behind our speech and questions.

See [`philosophy.md`](./philosophy.md) for the full vision.

---

## 🧠 What It Does

- Receives your text messages via LINE (or other channels)
- Labels the underlying mental states based on **Yogācāra Buddhist psychology** (the 51 mental factors)
- Calculates an "illusion score" that reflects how much craving, delusion, or bias is present
- Stores results in Notion for personal journaling and insight tracking
- Encourages self-inquiry through AI-powered questioning

---

## 🔧 Tech Stack

| Layer           | Technology            |
| --------------- | --------------------- |
| Messaging       | LINE Messaging API    |
| AI Inference    | OpenAI API (GPT-4/4o) |
| Data Storage    | Notion API            |
| Backend Hosting | Render                |
| Runtime         | Node.js               |

---

## 🛠️ Project Structure

```
mirrorloop/
├── index.js          # Webhook handler for LINE + OpenAI + Notion
├── .env.example      # API keys and config (never commit actual .env)
├── philosophy.md     # Core vision and conceptual background
├── README.md         # You are here
└── docs/
    └── architecture.md # (optional) System diagram and call flow
```

---

## 🚀 Getting Started

1. Clone the repo  
   ```bash
   git clone https://github.com/your-username/mirrorloop.git
   ```

2. Set up environment variables  
   Create a `.env` file based on `.env.example` with your LINE, OpenAI, and Notion credentials.

3. Deploy to Render or your preferred backend platform.

4. Set your LINE webhook URL to point to your deployed endpoint.

---

## 🤝 Why Contribute?

MIRROR LOOP is not just code.  
It’s a quiet revolution in how we relate to thought, desire, and technology.

If you believe AI should be used not just to automate, but to illuminate—  
if you believe in developing wisdom-driven technology—  
we welcome your contributions.

---

## 📄 License

MIT License.

---

## 🙏 Acknowledgements

Inspired by Buddhist philosophy, especially Yogācāra and Abhidharma thought  
Built with OpenAI, Notion, and LINE API  
Supported by quiet evenings of contemplation
# mirrorloop
