using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// The main AI controller using the goal-selection model.
    ///
    /// KEY CHANGE from old system:
    /// OLD: Weighted sum of all factors → pick highest total score
    /// NEW: Select goal via trait roll → evaluate moves ONLY for that goal
    ///
    /// This creates personality-driven behavior where a Bully will ignore
    /// great words because TRAP activated, and a Scholar will ignore
    /// trap opportunities because SCORE activated.
    /// </summary>
    public class AIBrain
    {
        public AIPersonality Personality { get; private set; }
        public AIPerception Perception { get; private set; }
        public Player AIPlayer { get; private set; }
        public AIDifficulty Difficulty { get; private set; }

        private WordScorer _wordScorer;
        private GoalSelector _goalSelector;
        private Random _random;

        // Last goal selected (for debugging/display)
        public GoalSelectionResult LastGoalSelection { get; private set; }

        public AIBrain(
            Player aiPlayer,
            AIPersonality personality,
            WordScorer wordScorer,
            AIDifficulty difficulty = AIDifficulty.Apprentice,
            int? seed = null)
        {
            AIPlayer = aiPlayer;
            Personality = personality;
            Difficulty = difficulty;
            _wordScorer = wordScorer;
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
            _goalSelector = new GoalSelector(seed);
            Perception = new AIPerception(aiPlayer, seed);
        }

        /// <summary>
        /// Changes the AI difficulty.
        /// </summary>
        public void SetDifficulty(AIDifficulty difficulty)
        {
            Difficulty = difficulty;
        }

        /// <summary>
        /// Chooses the best move for the current game state.
        /// Returns null if no valid moves exist.
        /// </summary>
        public AIMove ChooseMove(GameState state)
        {
            // Update perception of game state
            Perception.Update(state);

            // Calculate situational values
            float boardFill = (float)state.Tiles.Count / state.Board.HexCount;
            float perceivedLead = Perception.GetPerceivedLead();
            float momentum = Perception.GetMomentum();
            int lastOpponentScore = Perception.GetLastOpponentScore();

            // Get shifted trait ranges based on current situation
            var shiftedRanges = Personality.GetShiftedRanges(
                Difficulty,
                boardFill,
                perceivedLead,
                Perception.MyMaxPressure,
                Perception.OpponentMaxPressure,
                Perception.HandQuality,
                momentum,
                lastOpponentScore
            );

            // Select goal using priority cascade
            LastGoalSelection = _goalSelector.SelectGoal(
                Personality.GoalPriority,
                shiftedRanges
            );

            AIGoal activeGoal = LastGoalSelection.SelectedGoal;

            // Get Zipf threshold for vocabulary filtering
            float zipfThreshold = Personality.GetZipfThreshold(Difficulty);

            // Generate candidate moves
            var candidates = GenerateCandidateMoves(state);

            if (candidates.Count == 0)
                return null;

            // Evaluate all candidates FOR THE ACTIVE GOAL ONLY
            var evaluated = new List<GoalEvaluationResult>();
            foreach (var move in candidates)
            {
                var eval = AIGoalEvaluators.Evaluate(
                    move,
                    state,
                    activeGoal,
                    AIPlayer,
                    _wordScorer,
                    zipfThreshold,
                    perceivedLead,
                    boardFill
                );
                evaluated.Add(eval);
            }

            // Sort by score descending
            evaluated.Sort((a, b) => b.Score.CompareTo(a.Score));

            // Select from top moves using weighted randomness
            return SelectMove(evaluated);
        }

        /// <summary>
        /// Generates candidate moves.
        /// For each glyphling → each valid destination → each cast position → each letter in hand.
        /// </summary>
        private List<AIMove> GenerateCandidateMoves(GameState state)
        {
            var candidates = new List<AIMove>();
            var hand = state.Hands[AIPlayer];

            // Get all AI glyphlings that can move
            var myGlyphlings = new List<Glyphling>();
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == AIPlayer && g.IsPlaced)
                {
                    var moves = GameRules.GetValidMoves(state, g);
                    if (moves.Count > 0)
                    {
                        myGlyphlings.Add(g);
                    }
                }
            }

            // Generate all possible moves
            foreach (var glyphling in myGlyphlings)
            {
                var moveDestinations = GameRules.GetValidMoves(state, glyphling);

                foreach (var dest in moveDestinations)
                {
                    // Temporarily move glyphling to get cast positions
                    var originalPos = glyphling.Position;
                    glyphling.Position = dest;

                    var castPositions = GameRules.GetValidCastPositions(state, glyphling);

                    glyphling.Position = originalPos;

                    // For each cast position, try each unique letter in hand
                    foreach (var castPos in castPositions)
                    {
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

            // If too many candidates, sample randomly
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
        /// Selects a move from evaluated candidates.
        /// Uses weighted randomness for variety.
        /// </summary>
        private AIMove SelectMove(List<GoalEvaluationResult> evaluated)
        {
            if (evaluated.Count == 0)
                return null;

            // Get best score
            float bestScore = evaluated[0].Score;

            // Calculate threshold for "good enough" moves
            float threshold;
            if (bestScore > 0)
            {
                // Moves within 80% of best are considered
                threshold = bestScore * 0.8f;
            }
            else
            {
                // If best is negative, be more lenient
                threshold = bestScore - 5f;
            }

            // Gather moves above threshold (max 8)
            var topMoves = new List<GoalEvaluationResult>();
            foreach (var eval in evaluated)
            {
                if (eval.Score >= threshold && topMoves.Count < 8)
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
                float weight = Math.Max(0.1f, eval.Score - threshold + 1f);
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
        /// </summary>
        public List<char> ChooseDiscards(GameState state)
        {
            var hand = state.Hands[AIPlayer];
            var discards = new List<char>();

            // Assess hand quality
            float handQuality = HandQualityAssessor.Assess(hand);

            // Higher Pragmatism personalities are more willing to cycle
            // Use the base range center as threshold modifier
            float pragmatismCenter = 50f;
            if (Personality.BaseTraitRanges.TryGetValue(AITrait.Pragmatism, out var pragRange))
            {
                pragmatismCenter = (pragRange.Min + pragRange.Max) / 2f;
            }

            // Threshold: lower Pragmatism = need worse hand to discard
            float threshold = 5f - (pragmatismCenter / 25f); // 3-5 range

            if (handQuality >= threshold)
            {
                // Hand is acceptable
                return discards;
            }

            // Sort letters by junk score (worst first)
            var sortedHand = new List<(char letter, float junk)>();
            foreach (var letter in hand)
            {
                float junk = LetterJunkAssessor.Assess(letter, hand);
                sortedHand.Add((letter, junk));
            }
            sortedHand.Sort((a, b) => b.junk.CompareTo(a.junk));

            // Discard worst letters (up to 4)
            int maxDiscard = Math.Min(4, hand.Count - 1);

            for (int i = 0; i < maxDiscard && i < sortedHand.Count; i++)
            {
                // Only discard truly junky letters
                if (sortedHand[i].junk >= 3f)
                {
                    discards.Add(sortedHand[i].letter);
                }
            }

            return discards;
        }

        /// <summary>
        /// Chooses a position for draft placement based on personality.
        /// </summary>
        public HexCoord ChooseDraftPosition(GameState state, List<HexCoord> validPositions)
        {
            if (validPositions == null || validPositions.Count == 0)
                return default;

            if (validPositions.Count == 1)
                return validPositions[0];

            // Get personality traits for decision-making
            float aggression = 50f, caution = 50f;
            if (Personality.BaseTraitRanges.TryGetValue(AITrait.Aggression, out var aggRange))
                aggression = (aggRange.Min + aggRange.Max) / 2f;
            if (Personality.BaseTraitRanges.TryGetValue(AITrait.Caution, out var cautRange))
                caution = (cautRange.Min + cautRange.Max) / 2f;

            // Calculate board center
            int minCol = int.MaxValue, maxCol = int.MinValue;
            int minRow = int.MaxValue, maxRow = int.MinValue;
            foreach (var hex in state.Board.BoardHexes)
            {
                if (hex.Column < minCol) minCol = hex.Column;
                if (hex.Column > maxCol) maxCol = hex.Column;
                if (hex.Row < minRow) minRow = hex.Row;
                if (hex.Row > maxRow) maxRow = hex.Row;
            }
            float centerCol = (minCol + maxCol) / 2f;
            float centerRow = (minRow + maxRow) / 2f;
            float maxCenterDist = Math.Max(maxCol - minCol, maxRow - minRow) / 2f;

            // Find placed glyphlings
            var opponentGlyphlings = new List<HexCoord>();
            var ownGlyphlings = new List<HexCoord>();
            foreach (var g in state.Glyphlings)
            {
                if (!g.IsPlaced) continue;
                if (g.Owner == AIPlayer)
                    ownGlyphlings.Add(g.Position.Value);
                else
                    opponentGlyphlings.Add(g.Position.Value);
            }

            // Score each valid position
            var scored = new List<(HexCoord pos, float score)>();

            foreach (var pos in validPositions)
            {
                float score = 0f;

                // Center control (high for most personalities)
                float distFromCenter = Math.Abs(pos.Column - centerCol) + Math.Abs(pos.Row - centerRow);
                float centerScore = (maxCenterDist - distFromCenter) / maxCenterDist;
                score += centerScore * 5f;

                // Distance to opponents
                if (opponentGlyphlings.Count > 0)
                {
                    float minOppDist = float.MaxValue;
                    foreach (var opp in opponentGlyphlings)
                    {
                        float dist = HexDistance(pos, opp);
                        if (dist < minOppDist) minOppDist = dist;
                    }

                    // High aggression = prefer closer to opponents
                    float aggressionScore = (10f - minOppDist) * (aggression / 100f) * 0.5f;
                    score += aggressionScore;

                    // High caution = prefer further from opponents
                    float defenseScore = minOppDist * (caution / 100f) * 0.3f;
                    score += defenseScore;
                }

                // Mobility (count valid adjacent hexes)
                int mobility = 0;
                for (int dir = 0; dir < 6; dir++)
                {
                    var neighbor = pos.GetNeighbor(dir);
                    if (state.Board.IsBoardHex(neighbor) && !state.Board.IsPerimeterHex(neighbor))
                    {
                        if (!state.HasGlyphling(neighbor) && !state.HasTile(neighbor))
                            mobility++;
                    }
                }
                score += mobility * 1.5f;

                // Spread from own glyphlings (for 2nd placement)
                if (ownGlyphlings.Count > 0)
                {
                    float minOwnDist = float.MaxValue;
                    foreach (var own in ownGlyphlings)
                    {
                        float dist = HexDistance(pos, own);
                        if (dist < minOwnDist) minOwnDist = dist;
                    }

                    // Low aggression = spread out, high aggression = cluster
                    float spreadPreference = (100f - aggression) / 100f;
                    score += minOwnDist * spreadPreference * 0.3f;
                }

                // Small random factor
                score += (float)_random.NextDouble() * 2f;

                scored.Add((pos, score));
            }

            // Sort by score descending
            scored.Sort((a, b) => b.score.CompareTo(a.score));

            // Pick from top candidates with some randomness
            int topCount = Math.Min(3, scored.Count);
            int pick = _random.Next(topCount);
            return scored[pick].pos;
        }

        private float HexDistance(HexCoord a, HexCoord b)
        {
            int dc = Math.Abs(a.Column - b.Column);
            int dr = Math.Abs(a.Row - b.Row);
            return dc + Math.Max(0, dr - dc / 2);
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
