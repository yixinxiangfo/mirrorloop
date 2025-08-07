// sessionStore.js
const sessions = {}; // userId → sessionData

function getSession(userId) {
  return sessions[userId] || null;
}

function createSession(userId) {
  sessions[userId] = {
    currentQuestionIndex: 0,
    answers: [],
    isComplete: false
  };
}

function updateSession(userId, answer) {
  if (!sessions[userId]) return;
  sessions[userId].answers.push(answer);
  sessions[userId].currentQuestionIndex += 1;
}

function clearSession(userId) {
  delete sessions[userId];
}

module.exports = {
  getSession,
  createSession,
  updateSession,
  clearSession
};
