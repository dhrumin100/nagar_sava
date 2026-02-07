# नागरसेवा (Nagarseva)

Nagarseva is a citizen–corporation communication and issue-reporting platform.  
It enables residents to raise complaints, track resolutions, and interact with their municipal corporation in a transparent, structured manner.

---

## ✨ Features

- 📝 **Report Issues** – Citizens can submit complaints with descriptions, photos, and categories.  
- 📊 **Dashboard** – Track issue status, timelines, and resolution progress.  
- 🔔 **Alerts System** – Escalation alerts if an issue is not resolved within a certain time frame.  
- 🌐 **Multilingual Support** – Supports Gujarati, Hindi, and English for wider accessibility.  
- 📱 **Responsive Design** – Optimized for desktop and mobile devices.  
- 🏛 **Admin Panel** – For corporation teams to manage, prioritize, and resolve citizen issues.  

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite  
- **UI Framework:** Tailwind CSS + shadcn/ui  
- **Backend:** Node.js + Express  
- **Database:** MongoDB  
- **Auth & Security:** JWT authentication  
- **Deployment:** Docker, Ngrok (for local tunneling)  

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or later)  
- npm or yarn  
- MongoDB instance  

### Installation

```bash
# Clone the repository
git clone https://github.com/NOT-in-SYNC/Nagarseva-vad.git
cd Nagarseva-vad

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# (Update DB connection, JWT secret, etc.)

# Start development server
npm run dev
