using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Fuzzy tracking of game score.
    /// The AI doesn't know exact scores — it estimates based on observed 
    /// scoring events, with confidence that decays over time.
    /// </summary>
    public class ScorePerception
    {
        public float MyEstimate { get; private set; } = 0f;
        public float OpponentEstimate { get; private set; } = 0f;
        public float Confidence { get; private set; } = 0.5f;

        /// <summary>
        /// The opponent's most recent score (for morale calculations).
        /// </summary>
        public int LastOpponentScore { get; private set; } = 0;

        // Recent scores for momentum tracking
        private List<int> _myRecentScores = new List<int>();
        private List<int> _opponentRecentScores = new List<int>();

        private Random _random;

        public ScorePerception(int? seed = null)
        {
            _random = seed.HasValue ? new Random(seed.Value) : new Random();
        }

        /// <summary>
        /// Record points the AI scored this turn.
        /// </summary>
        public void ObserveMyScore(int points)
        {
            MyEstimate += points;
            _myRecentScores.Add(points);
            if (_myRecentScores.Count > AIConstants.MomentumWindow)
                _myRecentScores.RemoveAt(0);

            // Boost confidence when scoring
            Confidence = Math.Min(AIConstants.ConfidenceMax, Confidence + AIConstants.ConfidenceBoostOnScore);
        }

        /// <summary>
        /// Record points the opponent scored this turn.
        /// </summary>
        public void ObserveOpponentScore(int points)
        {
            OpponentEstimate += points;
            LastOpponentScore = points;  // Track for morale
            _opponentRecentScores.Add(points);
            if (_opponentRecentScores.Count > AIConstants.MomentumWindow)
                _opponentRecentScores.RemoveAt(0);

            // Boost confidence (we saw it happen)
            Confidence = Math.Min(AIConstants.ConfidenceMax, Confidence + AIConstants.ConfidenceBoostOnObserve);
        }

        /// <summary>
        /// Called at end of each turn. Decays confidence and adds drift.
        /// </summary>
        public void EndTurn()
        {
            // Confidence decays
            Confidence = Math.Max(AIConstants.ConfidenceMin, Confidence - AIConstants.ConfidenceDecay);

            // Estimates drift randomly based on uncertainty
            float uncertainty = 1f - Confidence;
            float drift = (float)(_random.NextDouble() * 2 - 1) * AIConstants.ScoreDriftRange * uncertainty;

            MyEstimate = Math.Max(0, MyEstimate + drift * 0.5f);
            OpponentEstimate = Math.Max(0, OpponentEstimate + drift * 0.5f);
        }

        /// <summary>
        /// Returns perceived point differential (positive = AI is ahead).
        /// Includes noise based on confidence.
        /// </summary>
        public float GetPerceivedLead()
        {
            float baseLead = MyEstimate - OpponentEstimate;

            // Add noise inversely proportional to confidence
            float noiseRange = AIConstants.PerceivedLeadNoiseMultiplier * (1f - Confidence);
            float noise = (float)(_random.NextDouble() * 2 - 1) * noiseRange;

            return baseLead + noise;
        }

        /// <summary>
        /// Returns momentum from -5 to +5.
        /// Positive = AI has been scoring more recently.
        /// </summary>
        public float GetMomentum()
        {
            int myRecent = 0;
            foreach (var s in _myRecentScores) myRecent += s;

            int oppRecent = 0;
            foreach (var s in _opponentRecentScores) oppRecent += s;

            float diff = myRecent - oppRecent;
            return Math.Max(-AIConstants.MomentumMax, Math.Min(AIConstants.MomentumMax, diff / AIConstants.MomentumDivisor));
        }

        /// <summary>
        /// Resets perception for a new game.
        /// </summary>
        public void Reset()
        {
            MyEstimate = 0;
            OpponentEstimate = 0;
            Confidence = 0.5f;
            LastOpponentScore = 0;
            _myRecentScores.Clear();
            _opponentRecentScores.Clear();
        }
    }

    /// <summary>
    /// Assesses the quality of a hand of letters.
    /// Returns 0-10 score.
    /// </summary>
    public static class HandQualityAssessor
    {
        private static readonly HashSet<char> Vowels = new HashSet<char> { 'A', 'E', 'I', 'O', 'U' };
        private static readonly HashSet<char> CommonLetters = new HashSet<char> { 'E', 'T', 'A', 'O', 'I', 'N', 'S', 'R', 'L' };
        private static readonly HashSet<char> HardLetters = new HashSet<char> { 'X', 'Z', 'J', 'V' };
        private static readonly HashSet<char> WordStarters = new HashSet<char> { 'S', 'T', 'C', 'P', 'B', 'M', 'D' };
        private static readonly HashSet<char> WordEnders = new HashSet<char> { 'S', 'E', 'D', 'T', 'N', 'R', 'Y' };

        /// <summary>
        /// Evaluates hand quality from 0-10.
        /// </summary>
        public static float Assess(List<char> hand)
        {
            if (hand == null || hand.Count == 0)
                return 0f;

            float score = AIConstants.HandQualityBaseline;

            // Count vowels and consonants
            int vowelCount = 0;
            foreach (var c in hand)
            {
                if (Vowels.Contains(char.ToUpper(c)))
                    vowelCount++;
            }
            int consonantCount = hand.Count - vowelCount;

            // Vowel/consonant balance
            if (vowelCount < AIConstants.VowelMinimum)
                score -= AIConstants.TooFewVowelsPenalty;
            else if (vowelCount > AIConstants.VowelMaximum)
                score -= AIConstants.TooManyVowelsPenalty;

            if (consonantCount < AIConstants.ConsonantMinimum)
                score -= AIConstants.TooFewConsonantsPenalty;

            // Common letters boost
            int commonCount = 0;
            foreach (var c in hand)
            {
                if (CommonLetters.Contains(char.ToUpper(c)))
                    commonCount++;
            }
            score += commonCount * AIConstants.CommonLetterBonus;

            // Duplicates penalty
            Dictionary<char, int> counts = new Dictionary<char, int>();
            foreach (var c in hand)
            {
                char upper = char.ToUpper(c);
                if (!counts.ContainsKey(upper))
                    counts[upper] = 0;
                counts[upper]++;
            }
            foreach (var kvp in counts)
            {
                if (kvp.Value >= 3)
                    score -= AIConstants.TripleDuplicatePenalty;
                else if (kvp.Value == 2)
                    score -= AIConstants.DoubleDuplicatePenalty;
            }

            // Hard letters penalty
            int hardCount = 0;
            foreach (var c in hand)
            {
                if (HardLetters.Contains(char.ToUpper(c)))
                    hardCount++;
            }
            score -= hardCount * AIConstants.HardLetterPenalty;

            // Word starters bonus
            int starterCount = 0;
            foreach (var c in hand)
            {
                if (WordStarters.Contains(char.ToUpper(c)))
                    starterCount++;
            }
            score += starterCount * AIConstants.WordStarterBonus;

            // Word enders bonus
            int enderCount = 0;
            foreach (var c in hand)
            {
                if (WordEnders.Contains(char.ToUpper(c)))
                    enderCount++;
            }
            score += enderCount * AIConstants.WordEnderBonus;

            // Clamp to 0-10
            return Math.Max(0f, Math.Min(AIConstants.TraitMax, score));
        }
    }

    /// <summary>
    /// Assesses how "junk" a specific letter is within a hand.
    /// Higher = AI wants to dump this letter more.
    /// </summary>
    public static class LetterJunkAssessor
    {
        private static readonly HashSet<char> Vowels = new HashSet<char> { 'A', 'E', 'I', 'O', 'U' };
        private static readonly HashSet<char> HardLetters = new HashSet<char> { 'Q', 'X', 'Z', 'J', 'V' };

        /// <summary>
        /// Evaluates how much the AI wants to get rid of this letter (0-10).
        /// Considers: hard letters, duplicates, vowel/consonant balance.
        /// </summary>
        public static float Assess(char letter, List<char> hand)
        {
            if (hand == null || hand.Count == 0)
                return 0f;

            char upper = char.ToUpper(letter);
            float junkScore = 0f;

            // Hard letters are always somewhat junky
            if (HardLetters.Contains(upper))
            {
                junkScore += AIConstants.JunkHardLetterBase;

                // Q without U is extra junky
                if (upper == 'Q')
                {
                    bool hasU = false;
                    foreach (var c in hand)
                    {
                        if (char.ToUpper(c) == 'U')
                        {
                            hasU = true;
                            break;
                        }
                    }
                    if (!hasU)
                    {
                        junkScore += AIConstants.JunkQWithoutU;
                    }
                }
            }

            // Count duplicates of this letter
            int duplicates = 0;
            foreach (var c in hand)
            {
                if (char.ToUpper(c) == upper)
                    duplicates++;
            }

            // 3+ of same letter = extra copies are junk
            if (duplicates >= 3)
            {
                junkScore += AIConstants.JunkTripleDuplicate;
            }
            else if (duplicates >= 2)
            {
                junkScore += AIConstants.JunkDoubleDuplicate;
            }

            // Check vowel/consonant balance
            int vowelCount = 0;
            foreach (var c in hand)
            {
                if (Vowels.Contains(char.ToUpper(c)))
                    vowelCount++;
            }
            bool isVowel = Vowels.Contains(upper);

            // Too many vowels = extra vowels are junk
            if (isVowel && vowelCount >= AIConstants.VowelExcessThreshold)
            {
                junkScore += AIConstants.JunkExcessVowel;
            }
            // Too few vowels = consonants are somewhat junky
            else if (!isVowel && vowelCount <= AIConstants.VowelStarvedThreshold)
            {
                junkScore += AIConstants.JunkVowelStarvedConsonant;
            }
            // No vowels = consonants are very junky
            else if (!isVowel && vowelCount == 0)
            {
                junkScore += AIConstants.JunkNoVowelConsonant;
            }

            return Math.Min(AIConstants.TraitMax, junkScore);
        }
    }

    /// <summary>
    /// Assesses how much pressure (tangle danger) a glyphling is under.
    /// Returns 0-10 score. High = close to being tangled.
    /// </summary>
    public static class GlyphlingPressureAssessor
    {
        /// <summary>
        /// Calculates pressure score for a glyphling.
        /// </summary>
        public static float Assess(
            GameState state,
            Glyphling glyphling,
            Player aiPlayer)
        {
            float pressure = 0f;

            // Count blocked directions (0-6)
            var validMoves = GameRules.GetValidMoves(state, glyphling);

            // If no valid moves, glyphling is tangled (max pressure)
            if (validMoves.Count == 0)
                return AIConstants.TraitMax;

            // Fewer escape routes = more pressure
            HashSet<int> openDirections = new HashSet<int>();
            foreach (var move in validMoves)
            {
                int dir = GetDirection(glyphling.Position, move);
                if (dir >= 0)
                    openDirections.Add(dir);
            }

            int blockedDirections = AIConstants.HexDirections - openDirections.Count;
            pressure += blockedDirections * AIConstants.PressurePerBlockedDirection;

            // Few escape routes penalty
            if (openDirections.Count <= 1)
                pressure += AIConstants.PressureSingleEscapePenalty;
            else if (openDirections.Count <= 2)
                pressure += AIConstants.PressureDoubleEscapePenalty;

            // Check if opponent glyphlings are nearby
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner != opponent) continue;

                int distance = HexDistance(glyphling.Position, g.Position);
                if (distance == 1)
                    pressure += AIConstants.PressureAdjacentOpponent;
                else if (distance == 2)
                    pressure += AIConstants.PressureNearbyOpponent;
            }

            return Math.Min(AIConstants.TraitMax, pressure);
        }

        /// <summary>
        /// Gets the direction index (0-5) from one hex to another, or -1 if not adjacent/in-line.
        /// </summary>
        private static int GetDirection(HexCoord from, HexCoord to)
        {
            int dc = to.Column - from.Column;
            int dr = to.Row - from.Row;

            // Flat-top hex directions (simplified - just need to categorize)
            if (dc == 0 && dr > 0) return 0;  // Down
            if (dc == 0 && dr < 0) return 1;  // Up
            if (dc > 0 && dr >= 0) return 2;  // Down-right
            if (dc > 0 && dr < 0) return 3;   // Up-right
            if (dc < 0 && dr >= 0) return 4;  // Down-left
            if (dc < 0 && dr < 0) return 5;   // Up-left

            return -1;
        }

        /// <summary>
        /// Approximate hex distance between two positions.
        /// </summary>
        private static int HexDistance(HexCoord a, HexCoord b)
        {
            // Offset coordinate distance approximation
            int dc = Math.Abs(a.Column - b.Column);
            int dr = Math.Abs(a.Row - b.Row);
            return dc + Math.Max(0, dr - dc / 2);
        }
    }

    /// <summary>
    /// Combined perception of the game state from the AI's perspective.
    /// </summary>
    public class AIPerception
    {
        public ScorePerception ScorePerception { get; private set; }
        public float HandQuality { get; private set; }
        public float MyMaxPressure { get; private set; }
        public float OpponentMaxPressure { get; private set; }

        private Player _aiPlayer;

        public AIPerception(Player aiPlayer, int? seed = null)
        {
            _aiPlayer = aiPlayer;
            ScorePerception = new ScorePerception(seed);
        }

        /// <summary>
        /// Updates all perceptions based on current game state.
        /// Call this at the start of each AI turn.
        /// </summary>
        public void Update(GameState state)
        {
            // Assess hand quality
            HandQuality = HandQualityAssessor.Assess(state.Hands[_aiPlayer]);

            // Assess glyphling pressures
            MyMaxPressure = 0f;
            OpponentMaxPressure = 0f;

            Player opponent = _aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            foreach (var g in state.Glyphlings)
            {
                float pressure = GlyphlingPressureAssessor.Assess(state, g, _aiPlayer);

                if (g.Owner == _aiPlayer)
                {
                    if (pressure > MyMaxPressure)
                        MyMaxPressure = pressure;
                }
                else
                {
                    if (pressure > OpponentMaxPressure)
                        OpponentMaxPressure = pressure;
                }
            }
        }

        /// <summary>
        /// Record that the AI scored points.
        /// </summary>
        public void OnMyScore(int points)
        {
            ScorePerception.ObserveMyScore(points);
        }

        /// <summary>
        /// Record that the opponent scored points.
        /// </summary>
        public void OnOpponentScore(int points)
        {
            ScorePerception.ObserveOpponentScore(points);
        }

        /// <summary>
        /// Called at end of each turn.
        /// </summary>
        public void EndTurn()
        {
            ScorePerception.EndTurn();
        }

        /// <summary>
        /// Gets the perceived score lead (positive = AI ahead).
        /// </summary>
        public float GetPerceivedLead()
        {
            return ScorePerception.GetPerceivedLead();
        }

        /// <summary>
        /// Gets momentum (-5 to +5).
        /// </summary>
        public float GetMomentum()
        {
            return ScorePerception.GetMomentum();
        }

        /// <summary>
        /// Gets the opponent's last score (for morale calculations).
        /// </summary>
        public int GetLastOpponentScore()
        {
            return ScorePerception.LastOpponentScore;
        }

        /// <summary>
        /// Resets for a new game.
        /// </summary>
        public void Reset()
        {
            ScorePerception.Reset();
            HandQuality = AIConstants.HandQualityBaseline;
            MyMaxPressure = 0f;
            OpponentMaxPressure = 0f;
        }
    }
}