document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const setupArea = document.getElementById('setupArea');
    const chatArea = document.getElementById('chatArea');
    const chatHistory = document.getElementById('chatHistory');
    const answerInput = document.getElementById('answerInput');
    const submitBtn = document.getElementById('submitAnswerBtn');
    const companyLabel = document.getElementById('companyLabel');
    const progressLabel = document.getElementById('progressLabel');

    let questions = [];
    let currentQuestionIndex = 0;
    let scores = [];
    let currentCompany = '';

    // Company Selection
    document.querySelectorAll('.company-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const company = btn.getAttribute('data-company');
            await startInterview(company);
        });
    });

    // PDF Download
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.onclick = async () => {
            try {
                const currentCompany = companyLabel.innerText || 'Top_MNC';
                const res = await fetch(`/api/interview/download?company=${currentCompany}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentCompany}_Interview_PYQs.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (err) {
                console.error("PDF Download failed", err);
            }
        };
    }

    async function startInterview(company) {
        setupArea.style.display = 'none';
        chatArea.style.display = 'flex';
        companyLabel.innerText = company;
        currentCompany = company;
        scores = [];

        try {
            chatHistory.innerHTML = '<div style="text-align:center; padding: 2rem;">Loading questions...</div>';
            
            const res = await fetch(`/api/interview/questions/${company}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            questions = data.questions;
            currentQuestionIndex = 0;
            chatHistory.innerHTML = '';
            
            askCurrentQuestion();
        } catch (err) {
            console.error(err);
            chatHistory.innerHTML = '<div style="color:red">Failed to start interview.</div>';
        }
    }

    function askCurrentQuestion() {
        if (currentQuestionIndex >= questions.length) {
            // Calculate average score and save
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            addBotMessage(`Interview complete. Generating your Career Readiness Report...`);
            answerInput.disabled = true;
            submitBtn.disabled = true;
            
            // Show Report Modal
            setTimeout(() => {
                const modal = document.getElementById('reportModal');
                if (modal) {
                    modal.style.display = 'flex';
                    document.getElementById('report-score').innerText = `${avgScore}%`;
                    
                    const statusEl = document.getElementById('report-status');
                    const insightsEl = document.getElementById('report-insights');
                    
                    if (avgScore >= 80) {
                        statusEl.innerText = "Elite Candidate";
                        statusEl.style.color = "#10b981";
                        insightsEl.innerText = "Your technical accuracy and communication are top-tier. You are ready for high-stakes interviews at major tech firms.";
                    } else if (avgScore >= 60) {
                        statusEl.innerText = "Industry Ready";
                        statusEl.style.color = "var(--accent)";
                        insightsEl.innerText = "Strong performance. Focus on refining your system design explanations and edge-case handling for a perfect score.";
                    } else {
                        statusEl.innerText = "Growth Required";
                        statusEl.style.color = "#ef4444";
                        insightsEl.innerText = "You have the foundation, but need more practice with technical clarity. Review the model answers carefully and retry.";
                    }
                }
            }, 1500);
            
            // Save to backend
            fetch('/api/users/interview-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ company: currentCompany, score: avgScore })
            }).catch(err => console.error('Failed to save score:', err));
            
            return;
        }

        const q = questions[currentQuestionIndex];
        progressLabel.innerText = `Q ${currentQuestionIndex + 1} of ${questions.length}`;
        addBotMessage(`Here is your question: **${q}**`);
        
        // Add a "Show Answer" hint (Better scoping to avoid connection errors)
        const hintDiv = document.createElement('div');
        hintDiv.className = 'hint-link';
        hintDiv.style.cssText = 'font-size: 0.8rem; color: var(--accent); cursor: pointer; margin-top: -1rem; margin-left: 2rem; margin-bottom: 1rem; transition: opacity 0.3s;';
        hintDiv.innerHTML = '<i class="fas fa-lightbulb"></i> Stuck? Click to see the answer';
        hintDiv.onclick = (e) => showAnswer(q, e.currentTarget);
        chatHistory.appendChild(hintDiv);
        scrollToBottom();
    }

    async function showAnswer(question, element) {
        if (element.classList.contains('loading')) return;
        
        try {
            element.classList.add('loading');
            const originalHTML = element.innerHTML;
            element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ConnectAI is thinking...';
            
            const res = await fetch('/api/interview/answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ question })
            });

            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            
            if (data.answer) {
                // Remove the hint link before showing the answer
                element.style.opacity = '0';
                setTimeout(() => element.remove(), 300);
                
                addBotMessage(`**Optimal Answer:** ${data.answer}`, true);
            } else {
                addBotMessage("I'm sorry, I don't have a specific solution for that question in my database yet.");
                element.innerHTML = originalHTML;
                element.classList.remove('loading');
            }
        } catch (err) {
            console.error("AI Tutor Connection Error:", err);
            addBotMessage("Oops! I had trouble connecting to my brain. Please check if the server is running.");
            element.classList.remove('loading');
        }
    }

    submitBtn.addEventListener('click', async () => {
        const text = answerInput.value.trim();
        if (!text) return;

        answerInput.value = '';
        addUserMessage(text);
        
        // Disable input while evaluating
        answerInput.disabled = true;
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/interview/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    question: questions[currentQuestionIndex],
                    answer: text
                })
            });
            const evaluation = await res.json();
            scores.push(evaluation.score);
            addFeedbackMessage(`Score: ${evaluation.score}/100. ${evaluation.feedback}`);
            
            // Move to next question after short delay
            setTimeout(() => {
                currentQuestionIndex++;
                answerInput.disabled = false;
                submitBtn.disabled = false;
                answerInput.focus();
                askCurrentQuestion();
            }, 2000);

        } catch (err) {
            console.error(err);
            answerInput.disabled = false;
            submitBtn.disabled = false;
        }
    });

    function addBotMessage(text, useTypewriter = false) {
        const div = document.createElement('div');
        div.className = 'msg-bubble msg-bot';
        
        // Process bold markers
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        if (useTypewriter) {
            div.innerHTML = '';
            chatHistory.appendChild(div);
            typeWriter(div, formattedText);
        } else {
            div.innerHTML = formattedText;
            chatHistory.appendChild(div);
            scrollToBottom();
        }
    }

    function typeWriter(element, html, speed = 15) {
        let i = 0;
        element.innerHTML = "";
        
        // Simple typewriter that handles HTML tags
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const plainText = tempDiv.innerText;
        const htmlContent = html;

        // We use a simplified version: show the full content but reveal characters
        // or just use interval for plain text if tags are simple.
        // For robustness with <strong>, we'll reveal char by char.
        let currentHTML = "";
        let charIndex = 0;
        
        const timer = setInterval(() => {
            if (charIndex < htmlContent.length) {
                // If we hit a tag, add it all at once to keep it valid
                if (htmlContent[charIndex] === '<') {
                    const closingBracket = htmlContent.indexOf('>', charIndex);
                    currentHTML += htmlContent.substring(charIndex, closingBracket + 1);
                    charIndex = closingBracket + 1;
                } else {
                    currentHTML += htmlContent[charIndex];
                    charIndex++;
                }
                element.innerHTML = currentHTML;
                scrollToBottom();
            } else {
                clearInterval(timer);
            }
        }, speed);
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'msg-bubble msg-user';
        div.innerText = text;
        chatHistory.appendChild(div);
        scrollToBottom();
    }

    function addFeedbackMessage(text) {
        const div = document.createElement('div');
        div.className = 'feedback-bubble';
        div.innerText = text;
        chatHistory.appendChild(div);
        scrollToBottom();
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});
