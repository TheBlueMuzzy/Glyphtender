using System;
using System.Collections.Generic;
using System.Linq;

namespace Glyphtender.Core
{
    /// <summary>
    /// The main AI controller that makes decisions.
    /// Ties together perception, personality, detection, and evaluation.
    /// </summary>
    public class AIBrain
    {
        public Personality Personality { get; private set; }
        public AIPerception Perception { get; private set; }
        public Player AIPlayer { get; private set; }

        private WordScorer _wordScorer;
        private Random _random;

        // For cycle mode (discarding letters)
        private static readonly Dictionary<char, int> LetterValues = new Dictionary<char, int>
        {
            {'E', 5}, {'A', 5},
            {'I', 4}, {'O', 4}, {'N', 4}, {'R', 4}, {'T', 4}, {'S', 4},
            {'L', 3}, {'U', 3}, {'D', 3},
            {'G', 2}, {'B', 2}, {'C', 2}, {'M', 2}, {'P', 2}, {'F', 2}, {'H', 2},
            {'V', 1}, {'W', 1}, {'Y', 1}, {'K', 1},
            {'J', 0}, {'X', 0}, {'Z', 0}, {'Q', 0}
        };

        public AIBrain(Player aiPlayer, Personality personality, WordScorer wordScorer, int? seed = null)
        {
            AIPlayer = aiPlayer;
            Personality = personality;
            _wordScorer = wordScorer;
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
            Perception = new AIPerception(aiPlayer, seed);
        }

        /// <summary>
        /// Chooses the best move for the current game state.
        /// Returns null if no valid moves exist.
        /// </summary>
        public AIMove ChooseMove(GameState state)
        {
            // Update perception of game state
            Perception.Update(state);

            // Calculate board fill for endgame awareness
            float boardFill = (float)state.Tiles.Count / state.Board.HexCount;

            // Roll effective traits for this turn
            Personality.RollEffectiveTraits(
                Perception.GetPerceivedLead(),
                Perception.MyMaxPressure,
                Perception.OpponentMaxPressure,
                Perception.HandQuality,
                Perception.GetMomentum(),
                boardFill
            );

            // Generate candidate moves
            var candidates = GenerateCandidateMoves(state);

            if (candidates.Count == 0)
                return null;

            // Evaluate all candidates
            var evaluated = new List<EvaluatedMove>();
            foreach (var move in candidates)
            {
                var eval = AIMoveEvaluator.Evaluate(
                    move, state, Personality.EffectiveTraits, AIPlayer, _wordScorer);
                evaluated.Add(eval);
            }

            // Sort by score descending
            evaluated.Sort((a, b) => b.TotalScore.CompareTo(a.TotalScore));

            // Select from top moves using weighted randomness
            return SelectMove(evaluated);
        }

        /// <summary>
        /// Generates candidate moves using goal-directed search.
        /// Instead of all possible moves, focuses on word opportunities.
        /// </summary>
        private List<AIMove> GenerateCandidateMoves(GameState state)
        {
            var candidates = new List<AIMove>();
            var hand = state.Hands[AIPlayer];

            // Get all AI glyphlings
            var myGlyphlings = new List<Glyphling>();
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == AIPlayer)
                    myGlyphlings.Add(g);
            }

            // For each glyphling, for each reachable position, for each cast position, for each letter
            foreach (var glyphling in myGlyphlings)
            {
                // Get valid move destinations (including staying put if already there)
                var moveDestinations = GameRules.GetValidMoves(state, glyphling);

                // Add current position as an option (move distance 0)
                if (!moveDestinations.Contains(glyphling.Position))
                    moveDestinations.Add(glyphling.Position);

                foreach (var dest in moveDestinations)
                {
                    // Temporarily move glyphling to get cast positions
                    var originalPos = glyphling.Position;
                    glyphling.Position = dest;

                    var castPositions = GameRules.GetValidCastPositions(state, glyphling);

                    glyphling.Position = originalPos;

                    // For each cast position, try each letter in hand
                    foreach (var castPos in castPositions)
                    {
                        // Use a set to avoid duplicate letters
                        var triedLetters = new HashSet<char>();

                        foreach (var letter in hand)
                        {
                            if (triedLetters.Contains(letter))
                                continue;
                            triedLetters.Add(letter);

                            candidates.Add(new AIMove
                            {
                                Glyphling = glyphling,
                                Destination = dest,
                                CastPosition = castPos,
                                Letter = letter
                            });
                        }
                    }
                }
            }

            // If we have too many candidates, sample randomly
            int maxCandidates = 300;
            if (candidates.Count > maxCandidates)
            {
                var sampled = new List<AIMove>();
                var indices = new HashSet<int>();

                while (sampled.Count < maxCandidates)
                {
                    int idx = _random.Next(candidates.Count);
                    if (!indices.Contains(idx))
                    {
                        indices.Add(idx);
                        sampled.Add(candidates[idx]);
                    }
                }

                candidates = sampled;
            }

            return candidates;
        }

        /// <summary>
        /// Selects a move from evaluated candidates using weighted randomness.
        /// Higher scored moves are more likely, but not guaranteed.
        /// This adds variety and unpredictability.
        /// </summary>
        private AIMove SelectMove(List<EvaluatedMove> evaluated)
        {
            if (evaluated.Count == 0)
                return null;

            // Get flexibility from personality
            float flexibility = Personality.SubTraits.Flexibility;

            // Calculate threshold for "good enough" moves
            float bestScore = evaluated[0].TotalScore;
            float threshold;

            if (bestScore > 0)
            {
                // Threshold is a percentage of best score
                // High flexibility = lower threshold = more variety
                threshold = bestScore * (0.7f + (1f - flexibility) * 0.25f);
            }
            else
            {
                // If best score is negative, use absolute threshold
                threshold = bestScore - 3f;
            }

            // Gather moves above threshold (max 8)
            var topMoves = new List<EvaluatedMove>();
            foreach (var eval in evaluated)
            {
                if (eval.TotalScore >= threshold && topMoves.Count < 8)
                    topMoves.Add(eval);
            }

            // Fallback if nothing above threshold
            if (topMoves.Count == 0)
            {
                for (int i = 0; i < Math.Min(5, evaluated.Count); i++)
                    topMoves.Add(evaluated[i]);
            }

            // Weighted random selection
            var weights = new List<float>();
            float totalWeight = 0f;

            foreach (var eval in topMoves)
            {
                float weight = Math.Max(0.1f, eval.TotalScore - threshold + 1f);
                weights.Add(weight);
                totalWeight += weight;
            }

            // Roll
            float roll = (float)_random.NextDouble() * totalWeight;
            float cumulative = 0f;

            for (int i = 0; i < topMoves.Count; i++)
            {
                cumulative += weights[i];
                if (roll <= cumulative)
                    return topMoves[i].Move;
            }

            // Fallback
            return topMoves[0].Move;
        }

        /// <summary>
        /// Chooses which letters to discard when no word was formed (cycle mode).
        /// Returns list of letters to discard, or empty list to keep all.
        /// </summary>
        public List<char> ChooseDiscards(GameState state)
        {
            var hand = state.Hands[AIPlayer];
            var discards = new List<char>();

            // Check if hand is "acceptable" based on hand optimism
            float handQuality = HandQualityAssessor.Assess(hand);
            float threshold = 4f + Personality.SubTraits.HandOptimism * 3f;  // 4-7 range

            if (handQuality >= threshold)
            {
                // Hand is good enough, keep it
                return discards;
            }

            // Sort letters by value (worst first)
            var sortedHand = new List<char>(hand);
            sortedHand.Sort((a, b) => GetLetterValue(a).CompareTo(GetLetterValue(b)));

            // How many to discard based on patience
            // Low patience = discard more
            float patience = Personality.EffectiveTraits.Patience;
            int maxDiscard = (int)(3 + (10 - patience) / 3);  // 3-6 range
            maxDiscard = Math.Min(maxDiscard, hand.Count - 1);  // Keep at least 1

            // Discard worst letters
            for (int i = 0; i < maxDiscard && i < sortedHand.Count; i++)
            {
                char letter = sortedHand[i];
                int value = GetLetterValue(letter);

                // Only discard truly bad letters (value 0-2)
                if (value <= 2)
                {
                    discards.Add(letter);
                }
            }

            return discards;
        }

        /// <summary>
        /// Gets the strategic value of a letter (for discard decisions).
        /// </summary>
        private int GetLetterValue(char letter)
        {
            char upper = char.ToUpper(letter);
            return LetterValues.TryGetValue(upper, out int value) ? value : 2;
        }

        /// <summary>
        /// Called when AI scores points.
        /// </summary>
        public void OnScore(int points)
        {
            Perception.OnMyScore(points);
        }

        /// <summary>
        /// Called when opponent scores points.
        /// </summary>
        public void OnOpponentScore(int points)
        {
            Perception.OnOpponentScore(points);
        }

        /// <summary>
        /// Called at end of turn.
        /// </summary>
        public void EndTurn()
        {
            Perception.EndTurn();
        }

        /// <summary>
        /// Resets the AI for a new game.
        /// </summary>
        public void Reset()
        {
            Perception.Reset();
        }
    }
}