
const simulateScoring = (quizQuestions, answers) => {
    let correctCount = 0;
    let totalQuestions = quizQuestions.length;

    quizQuestions.forEach((question, index) => {
        let userAnswer = answers.find(a => a.questionId === (question.id || question._id || String(index)));

        // Fallback: match by index if ID match failed
        if (!userAnswer) {
            userAnswer = answers.find(a => String(a.questionId) === String(index));
        }

        if (userAnswer) {
            const submitted = String(userAnswer.selectedOption);
            const correctRef = question.correctAnswer;

            let isCorrect = false;

            // If correctAnswer is an index (number or numeric string) and options exist
            if (Array.isArray(question.options) &&
                (typeof correctRef === 'number' || (!isNaN(Number(correctRef)) && String(Number(correctRef)) === String(correctRef)))) {
                const index = Number(correctRef);
                if (index >= 0 && index < question.options.length) {
                    const correctOptionValue = String(question.options[index]);
                    isCorrect = submitted === correctOptionValue;
                    console.log(`Q${index + 1}: Matching by index ${index}. Correct: "${correctOptionValue}", Submitted: "${submitted}" -> ${isCorrect}`);
                } else {
                    console.log(`Q${index + 1}: Index ${index} out of bounds.`);
                }
            } else {
                // Fallback to direct string comparison if it's not an index
                isCorrect = submitted === String(correctRef);
                console.log(`Q${index + 1}: Matching by string. Correct: "${correctRef}", Submitted: "${submitted}" -> ${isCorrect}`);
            }

            if (isCorrect) {
                correctCount++;
            }
        } else {
            console.log(`Q${index + 1}: No answer found.`);
        }
    });

    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    return { correctCount, totalQuestions, score };
};

// Test Case 1: Standard Numeric Index
console.log("--- Test Case 1: Numeric Index ---");
const questions1 = [
    { options: ["Red", "Green", "Blue"], correctAnswer: 1 }, // Green
    { options: ["10", "20", "30"], correctAnswer: 2 }       // 30
];
const answers1 = [
    { questionId: "0", selectedOption: "Green" },
    { questionId: "1", selectedOption: "30" }
];
console.log(simulateScoring(questions1, answers1));

// Test Case 2: String Index
console.log("\n--- Test Case 2: String Index ---");
const questions2 = [
    { options: ["A", "B", "C"], correctAnswer: "0" } // A
];
const answers2 = [
    { questionId: "0", selectedOption: "A" }
];
console.log(simulateScoring(questions2, answers2));

// Test Case 3: Direct Text Match (legacy)
console.log("\n--- Test Case 3: Text Match ---");
const questions3 = [
    { options: ["Yes", "No"], correctAnswer: "Yes" }
];
const answers3 = [
    { questionId: "0", selectedOption: "Yes" }
];
console.log(simulateScoring(questions3, answers3));

// Test Case 4: Mismatch
console.log("\n--- Test Case 4: Mismatch ---");
const questions4 = [
    { options: ["Small", "Large"], correctAnswer: 1 } // Large
];
const answers4 = [
    { questionId: "0", selectedOption: "Small" }
];
console.log(simulateScoring(questions4, answers4));

// Test Case 5: Complex IDs
console.log("\n--- Test Case 5: Complex IDs ---");
const questions5 = [
    { id: "q_1", options: ["High", "Low"], correctAnswer: 0 }
];
const answers5 = [
    { questionId: "q_1", selectedOption: "High" }
];
console.log(simulateScoring(questions5, answers5));
