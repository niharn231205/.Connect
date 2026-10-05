import sys
import os
import json
import re
import math

# Try importing external libraries, set flags if unavailable
HAS_PYPDF2 = False
try:
    import PyPDF2
    HAS_PYPDF2 = True
except ImportError:
    pass

HAS_DOCX = False
try:
    import docx
    HAS_DOCX = True
except ImportError:
    pass

HAS_SKLEARN = False
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    pass

HAS_NLTK = False
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    # Ensure they are downloaded
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt', quiet=True)
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        nltk.download('punkt_tab', quiet=True)
    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        nltk.download('stopwords', quiet=True)
    HAS_NLTK = True
except ImportError:
    pass

# Hardcoded Stopwords Fallback
STOPWORDS_FALLBACK = set([
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd",
    'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers',
    'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
    'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should',
    "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't",
    'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't",
    'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't",
    'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"
])

# Comprehensive technical skills dictionary
SKILL_DICTIONARY = {
    # Programming Languages
    "javascript": ["javascript", "js", "es6", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "python": ["python", "py"],
    "java": ["java"],
    "c++": ["c++", "cpp"],
    "c#": ["c#", "csharp"],
    "php": ["php"],
    "ruby": ["ruby", "rails"],
    "go": ["golang", "go language"],
    "rust": ["rust"],
    "swift": ["swift"],
    "kotlin": ["kotlin"],
    "sql": ["sql", "mysql", "postgresql", "sqlite", "oracle"],
    
    # Frontend
    "react": ["react", "react.js", "reactjs", "next.js", "nextjs"],
    "angular": ["angular", "angularjs"],
    "vue": ["vue", "vue.js", "vuejs"],
    "html": ["html", "html5"],
    "css": ["css", "css3", "sass", "scss", "tailwind", "bootstrap"],
    "redux": ["redux", "redux-toolkit"],
    
    # Backend / Runtime
    "node.js": ["node.js", "nodejs", "node"],
    "express": ["express", "express.js", "expressjs"],
    "django": ["django"],
    "flask": ["flask"],
    "spring boot": ["spring boot", "spring"],
    "laravel": ["laravel"],
    "fastapi": ["fastapi"],
    
    # Databases & Caching
    "mongodb": ["mongodb", "mongo"],
    "postgresql": ["postgresql", "postgres"],
    "mysql": ["mysql"],
    "redis": ["redis"],
    "firebase": ["firebase", "firestore"],
    
    # DevOps & Cloud
    "docker": ["docker"],
    "kubernetes": ["kubernetes", "k8s"],
    "aws": ["aws", "amazon web services", "s3", "ec2", "lambda"],
    "azure": ["azure"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "git": ["git", "github", "gitlab"],
    "cicd": ["ci/cd", "ci-cd", "jenkins", "github actions"],
    
    # Machine Learning & Data Science
    "machine learning": ["machine learning", "ml"],
    "deep learning": ["deep learning", "dl"],
    "natural language processing": ["natural language processing", "nlp"],
    "tensorflow": ["tensorflow", "tf"],
    "pytorch": ["pytorch"],
    "scikit-learn": ["scikit-learn", "sklearn"],
    "pandas": ["pandas"],
    "numpy": ["numpy"],
    "opencv": ["opencv"],
    
    # Other / Concepts
    "rest api": ["rest api", "restful api", "apis"],
    "graphql": ["graphql"],
    "system design": ["system design", "microservices"],
    "agile": ["agile", "scrum", "kanban"],
    "unit testing": ["unit testing", "jest", "mocha", "pytest"],
    "communication": ["communication", "teamwork", "leadership", "collaboration"]
}

def extract_text_from_pdf(pdf_path):
    """Extracts text from a PDF file."""
    text = ""
    if not HAS_PYPDF2:
        return "[Notice: PyPDF2 not installed. Could not extract text from PDF.]"
    
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        return f"[Error parsing PDF: {str(e)}]"

def extract_text_from_docx(docx_path):
    """Extracts text from a DOCX file."""
    text = ""
    if not HAS_DOCX:
        return "[Notice: python-docx not installed. Could not extract text from DOCX.]"
    
    try:
        doc = docx.Document(docx_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text += cell.text + " "
                text += "\n"
        return text
    except Exception as e:
        return f"[Error parsing DOCX: {str(e)}]"

def extract_text(file_path):
    """Helper to route extraction based on file extension."""
    if not os.path.exists(file_path):
        return ""
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    else:
        # Try reading as plain text
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except:
            return ""

def preprocess_text(text):
    """Cleans text: tokenization, lowercase, stopword removal, lemmatization."""
    if not text:
        return []
    
    # Convert to lowercase and clean punctuation
    text = text.lower()
    text = re.sub(r'[^\w\s\-\.]', ' ', text)
    
    # Tokenization
    if HAS_NLTK:
        tokens = word_tokenize(text)
        stop_words = set(stopwords.words('english'))
    else:
        tokens = text.split()
        stop_words = STOPWORDS_FALLBACK
        
    # Filter stopwords and short tokens
    cleaned_tokens = []
    for token in tokens:
        token = token.strip('.')
        if token not in stop_words and len(token) > 1:
            # Simple manual lemmatizer fallback (remove common suffixes)
            if token.endswith('ing') and len(token) > 5:
                token = token[:-3]
            elif token.endswith('ed') and len(token) > 4:
                token = token[:-2]
            elif token.endswith('s') and not token.endswith('ss') and len(token) > 3:
                token = token[:-1]
            cleaned_tokens.append(token)
            
    return cleaned_tokens

def extract_skills(text):
    """Extracts skills from text using a pre-defined dictionary."""
    text_lower = text.lower()
    extracted = []
    
    # Keyword search for multi-word or single word skills
    for skill_name, aliases in SKILL_DICTIONARY.items():
        for alias in aliases:
            # Use word boundaries to prevent matching "java" in "javascript"
            pattern = r'\b' + re.escape(alias) + r'\b'
            # For special chars like c++ or .net, relax boundary check slightly
            if '+' in alias or '.' in alias:
                pattern = re.escape(alias)
            
            if re.search(pattern, text_lower):
                extracted.append(skill_name)
                break # Avoid duplicate aliases
                
    return list(set(extracted))

def calculate_cosine_similarity_fallback(tokens1, tokens2):
    """Pure-Python TF-IDF and Cosine Similarity computation if sklearn is missing."""
    vocab = list(set(tokens1 + tokens2))
    if not vocab:
        return 0.0
        
    # Count term frequencies
    def get_tf(tokens):
        tf = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        return tf
        
    tf1 = get_tf(tokens1)
    tf2 = get_tf(tokens2)
    
    # local IDF:
    df = {}
    for word in vocab:
        df[word] = 0
        if word in tf1: df[word] += 1
        if word in tf2: df[word] += 1
        
    def get_vector(tf):
        vec = []
        for word in vocab:
            if word in tf:
                idf = math.log(3.0 / (df[word] + 0.5)) # smoothed idf
                vec.append(tf[word] * idf)
            else:
                vec.append(0.0)
        return vec
        
    vec1 = get_vector(tf1)
    vec2 = get_vector(tf2)
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))
    
    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
        
    return (dot_product / (magnitude1 * magnitude2))

def calculate_similarity(text1, text2):
    """Calculates similarity percentage between two texts using TF-IDF."""
    tokens1 = preprocess_text(text1)
    tokens2 = preprocess_text(text2)
    
    if not tokens1 or not tokens2:
        return 0
        
    if HAS_SKLEARN:
        try:
            vectorizer = TfidfVectorizer(stop_words='english')
            tfidf = vectorizer.fit_transform([" ".join(tokens1), " ".join(tokens2)])
            sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
            return int(round(sim * 100))
        except Exception:
            pass
            
    sim = calculate_cosine_similarity_fallback(tokens1, tokens2)
    return int(round(sim * 100))

def generate_keyword_frequency(text, limit=15):
    """Generates word count frequencies for top keywords."""
    tokens = preprocess_text(text)
    freq = {}
    for t in tokens:
        if t.isalpha() and len(t) > 2:
            freq[t] = freq.get(t, 0) + 1
            
    sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [{"text": k, "value": v} for k, v in sorted_freq[:limit]]

def analyze_resume(resume_text):
    """Calculates ATS metrics, skill clouds, and suggestion text."""
    skills = extract_skills(resume_text)
    
    ats_score = 45 # Base score
    suggestions_list = []
    
    experience_keywords = ["experience", "work history", "employment", "professional background", "positions held"]
    has_experience = any(kw in resume_text.lower() for kw in experience_keywords)
    if has_experience:
        ats_score += 15
    else:
        suggestions_list.append("Add a detailed Work Experience section to list prior responsibilities.")
        
    education_keywords = ["education", "degree", "university", "college", "academic qualification"]
    has_education = any(kw in resume_text.lower() for kw in education_keywords)
    if has_education:
        ats_score += 15
    else:
        suggestions_list.append("Add an Education section outlining your academic background.")
        
    has_email = "@" in resume_text
    has_phone = re.search(r'\b\d{10}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b', resume_text) is not None
    if has_email and has_phone:
        ats_score += 15
    else:
        suggestions_list.append("Ensure your email address and phone number are clearly visible.")
        
    if len(skills) >= 8:
        ats_score += 10
    elif len(skills) >= 4:
        ats_score += 5
    else:
        suggestions_list.append("Integrate more technical skill keywords matching your industry.")
        
    missing_skills = []
    if len(skills) < 5:
        missing_skills = ["Docker", "AWS", "SQL", "Unit Testing", "Git"]
        
    formatting_critique = "Structure is decent, but could use more quantifiable metrics."
    if ats_score >= 85:
        formatting_critique = "Excellent keyword density and professional structure."
    elif ats_score >= 70:
        formatting_critique = "Good balance, but consider adding more industry-specific tools."
    else:
        formatting_critique = "Formatting needs significant improvement to pass automated filters."

    return {
        "atsScore": min(ats_score, 100),
        "skills": skills,
        "keywords": generate_keyword_frequency(resume_text, 12),
        "suggestions": {
            "missingSkills": [s for s in missing_skills if s.lower() not in [x.lower() for x in skills]],
            "formatting": formatting_critique,
            "keywordsToAdd": suggestions_list
        }
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        test_text = "Experienced Python developer with React, Javascript, and machine learning skills."
        print(json.dumps({
            "status": "active",
            "has_pypdf2": HAS_PYPDF2,
            "has_docx": HAS_DOCX,
            "has_sklearn": HAS_SKLEARN,
            "has_nltk": HAS_NLTK,
            "extracted_skills": extract_skills(test_text),
            "clean_tokens": preprocess_text(test_text)[:5]
        }, indent=2))
        return

    if len(sys.argv) < 3:
        print(json.dumps({"error": "Insufficient arguments."}))
        return

    mode = sys.argv[1]
    
    if mode == '--resume':
        file_path = sys.argv[2]
        if not os.path.exists(file_path):
            print(json.dumps({"error": f"File not found: {file_path}"}))
            return
        
        extracted_text = extract_text(file_path)
        analysis = analyze_resume(extracted_text)
        analysis["extractedText"] = extracted_text
        print(json.dumps(analysis))
        
    elif mode == '--match':
        resume_path = sys.argv[2]
        jd_input = sys.argv[3]
        
        if os.path.exists(jd_input):
            jd_text = extract_text(jd_input)
        else:
            jd_text = jd_input
            
        resume_text = extract_text(resume_path)
        
        if not resume_text:
            print(json.dumps({"error": "Failed to extract text from resume."}))
            return
            
        match_percentage = calculate_similarity(resume_text, jd_text)
        
        resume_skills = extract_skills(resume_text)
        jd_skills = extract_skills(jd_text)
        
        matched_skills = [s for s in jd_skills if s.lower() in [x.lower() for x in resume_skills]]
        missing_skills = [s for s in jd_skills if s.lower() not in [x.lower() for x in resume_skills]]
        
        jd_keywords = generate_keyword_frequency(jd_text, 10)
        
        print(json.dumps({
            "matchPercentage": match_percentage,
            "matchedSkills": matched_skills,
            "missingSkills": missing_skills,
            "jdSkills": jd_skills,
            "resumeSkills": resume_skills,
            "jdKeywords": jd_keywords
        }))
    else:
        print(json.dumps({"error": f"Unknown mode: {mode}"}))

if __name__ == '__main__':
    main()
