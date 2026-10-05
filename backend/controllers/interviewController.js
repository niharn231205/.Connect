const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const answersPath = path.join(__dirname, '../data/interviewAnswers.json');
let interviewAnswers = [];
try {
    const data = fs.readFileSync(answersPath, 'utf8');
    interviewAnswers = JSON.parse(data);
} catch (err) {
    console.error("Could not load interview answers", err);
}

const pyqList = [
    "Longest substring without repeating characters",
    "Maximum subarray sum (Kadane’s algorithm)",
    "Design a URL shortener like TinyURL",
    "Detect cycle in a linked list",
    "Scale a search engine to billions of queries",
    "Reverse a linked list",
    "Check if two strings are anagrams",
    "Median of two sorted arrays",
    "Design a navigation system like Google Maps",
    "Compare quicksort vs mergesort time complexity",
    "Find longest palindromic substring",
    "Implement trie data structure",
    "Word ladder shortest transformation sequence",
    "Find k closest points to origin",
    "Design Google Docs collaboration system",
    "Implement autocomplete search",
    "Top K frequent elements",
    "Binary tree level order traversal",
    "Serialize and deserialize binary tree",
    "Design distributed cache",
    "Implement LFU cache",
    "Minimum window substring",
    "Find duplicate number in array",
    "Implement LRU cache",
    "Design YouTube recommendation system",
    "Graph shortest path (Dijkstra)",
    "Design Google Drive storage system",
    "Reverse nodes in k-group",
    "Count number of islands",
    "Design rate limiter",
    "Balanced parentheses validation",
    "Merge k sorted lists",
    "Design online code judge system",
    "Find kth smallest element in BST",
    "Course schedule (topological sort)",
    "Design Google Photos system",
    "Implement min stack",
    "Find majority element",
    "Sliding window maximum",
    "Design distributed logging system",
    "Check if binary tree is balanced",
    "Search in rotated sorted array",
    "Implement priority queue",
    "Design search autocomplete ranking",
    "Longest increasing subsequence",
    "Find median in data stream",
    "Design chat system",
    "Evaluate reverse polish notation",
    "Graph clone problem",
    "Design scalable notification system"
];

const getQuestionsByCompany = (req, res) => {
    try {
        const { company } = req.params;
        // In this implementation, since all MNCS share a similar set based on the dataset,
        // we will pick 5 random questions
        const shuffled = [...pyqList].sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, 5);

        res.json({
            company: company,
            questions: selectedQuestions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching questions' });
    }
};

const evaluateAnswer = (req, res) => {
    try {
        const { question, answer } = req.body;
        
        // Simple heuristic: length of answer, code blocks, technical keywords
        let score = 0;
        let feedback = "";
        
        const text = answer.toLowerCase();

        if (text.length > 50) score += 20;
        if (text.length > 150) score += 20;
        
        const technicalKeywords = ['function', 'class', 'let', 'const', 'return', 'if', 'for', 'while', 'map', 'filter', 'reduce', 'hash', 'array', 'pointer', 'node', 'tree', 'graph', 'time', 'complexity', 'space', 'O(n)'];
        
        let keywordCount = 0;
        technicalKeywords.forEach(kw => {
            if (text.includes(kw)) keywordCount++;
        });

        score += Math.min(60, keywordCount * 15);

        if (score < 40) {
            feedback = "Your answer is a bit brief or lacks technical depth. Try explaining the time and space complexity, or write pseudo-code using core programming concepts.";
        } else if (score < 70) {
            feedback = "Good attempt! You mentioned some solid concepts. Consider expanding on edge cases and optimal data structures.";
        } else {
            feedback = "Excellent response! You demonstrated a clear technical understanding of the problem and potential implementations.";
        }

        res.json({
            score: Math.min(100, score),
            feedback: feedback
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error evaluating answer' });
    }
};

const downloadQuestionsPDF = (req, res) => {
    try {
        const company = req.query.company || 'Top MNC';
        const doc = new PDFDocument({ margin: 50 });
        const filename = `${company}_Interview_PYQs.pdf`;
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', result.length);
            res.send(result);
        });

        // --- PDF Content ---
        doc.fillColor('#4f46e5').fontSize(26).text(`${company} Interview Prep`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#111827').fontSize(12).text('.Connect Professional Career Suite', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(16).fillColor('#111827').text('Top 50 Frequently Asked Questions', { underline: true });
        doc.moveDown();

        pyqList.forEach((q, index) => {
            doc.fontSize(11).fillColor('#374151').text(`${index + 1}. ${q}`, { bold: true });
            doc.moveDown(0.5);
        });

        // --- Answers Section ---
        doc.addPage();
        doc.fillColor('#4f46e5').fontSize(20).text('Optimal Technical Solutions', { align: 'center' });
        doc.moveDown(1.5);

        interviewAnswers.forEach((entry, index) => {
            doc.fontSize(12).fillColor('#4f46e5').text(`Q${index + 1}: ${entry.question}`);
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#374151').text(`Solution: ${entry.answer}`, { align: 'justify' });
            doc.moveDown(1.5);
            
            // Add a separator line
            doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(1.5);
        });

        doc.end();
    } catch (error) {
        console.error("PDF Generation Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating PDF' });
        }
    }
};

const getAnswer = (req, res) => {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ message: 'Question is required' });

        console.log(`Searching for answer to: ${question}`);
        
        // Normalize search string
        const normalize = (str) => str.toLowerCase()
            .replace(/[^\w\s]/gi, '') // Remove punctuation
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();

        const searchNorm = normalize(question);
        
        const entry = interviewAnswers.find(a => normalize(a.question) === searchNorm);
        
        if (entry) {
            res.json({ answer: entry.answer });
        } else {
            console.warn(`No match found for: ${searchNorm}`);
            res.status(404).json({ message: 'Answer not found for this question' });
        }
    } catch (error) {
        console.error("Fetch Answer Error:", error);
        res.status(500).json({ message: 'Error fetching answer' });
    }
};

module.exports = {
    getQuestionsByCompany,
    evaluateAnswer,
    downloadQuestionsPDF,
    getAnswer
};
