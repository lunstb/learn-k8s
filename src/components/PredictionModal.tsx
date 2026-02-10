import { useState } from 'react';
import { useSimulatorStore } from '../simulation/store';

export function PredictionModal() {
  const predictionPending = useSimulatorStore((s) => s.predictionPending);
  const predictionResult = useSimulatorStore((s) => s.predictionResult);
  const currentLesson = useSimulatorStore((s) => s.currentLesson);
  const currentStep = useSimulatorStore((s) => s.currentStep);
  const submitPrediction = useSimulatorStore((s) => s.submitPrediction);
  const advanceStep = useSimulatorStore((s) => s.advanceStep);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  if (!currentLesson?.steps) return null;
  const step = currentLesson.steps[currentStep];
  if (!step?.prediction) return null;
  if (!predictionPending && !predictionResult) return null;

  const { question, choices, correctIndex, explanation } = step.prediction;

  const handleSubmit = () => {
    if (selectedChoice === null) return;
    submitPrediction(selectedChoice);
  };

  const handleContinue = () => {
    setSelectedChoice(null);
    advanceStep();
  };

  return (
    <div className="prediction-overlay">
      <div className="prediction-modal">
        <h3 className="prediction-question">{question}</h3>

        {predictionPending && (
          <>
            <div className="prediction-choices">
              {choices.map((choice, i) => (
                <label
                  key={i}
                  className={`prediction-choice ${selectedChoice === i ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="prediction"
                    checked={selectedChoice === i}
                    onChange={() => setSelectedChoice(i)}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary prediction-submit"
              onClick={handleSubmit}
              disabled={selectedChoice === null}
            >
              Submit
            </button>
          </>
        )}

        {predictionResult && (
          <div className="prediction-result">
            <div className={`prediction-verdict ${predictionResult}`}>
              {predictionResult === 'correct' ? 'Correct!' : 'Incorrect'}
            </div>
            {predictionResult === 'incorrect' && (
              <div className="prediction-answer">
                The correct answer was: <strong>{choices[correctIndex]}</strong>
              </div>
            )}
            <div className="prediction-explanation">{explanation}</div>
            <button className="btn btn-primary prediction-continue" onClick={handleContinue}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
