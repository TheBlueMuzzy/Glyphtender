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

        private const int MomentumWindow = 5;
        private const float ConfidenceDecay = 0.05f;
        private const float DriftRange = 3f;

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
            if (_myRecentScores.Count > MomentumWindow)
                _myRecentScores.RemoveAt(0);

            // Boost confidence when scoring
            Confidence = Math.Min(1f, Confidence + 0.1f);
        }

        /// <summary>
        /// Record points the opponent scored this turn.
        /// </summary>
        public void ObserveOpponentScore(int points)
        {
            OpponentEstimate += points;
            LastOpponentScore = points;  // Track for morale
            _opponentRecentScores.Add(points);
            if (_opponentRecentScores.Count > MomentumWindow)
                _opponentRecentScores.RemoveAt(0);

            // Boost confidence (we saw it happen)
            Confidence = Math.Min(1f, Confidence + 0.08f);
        }

        /// <summary>
        /// Called at end of each turn. Decays confidence and adds drift.
        /// </summary>
        public void EndTurn()
        {
            // Confidence decays
            Confidence = Math.Max(0.1f, Confidence - ConfidenceDecay);

            // Estimates drift randomly based on uncertainty
            float uncertainty = 1f - Confidence;
            float drift = (float)(_random.NextDouble() * 2 - 1) * DriftRange * uncertainty;

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
            float noiseRange = 20f * (1f - Confidence);
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
            return Math.Max(-5f, Math.Min(5f, diff / 10f));
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

            float score = 5f;  // Baseline

            // Count vowels and consonants
            int vowelCount = 0;
            foreach (var c in hand)
            {
                if (Vowels.Contains(char.ToUpper(c)))
                    vowelCount++;
            }
            int consonantCount = hand.Count - vowelCount;

            // Vowel/consonant balance (ideal ~3 vowels, ~5 consonants for 8-tile hand)
            if (vowelCount < 2)
                score -= 1.5f;  // Too few vowels
            else if (vowelCount > 4)
                score -= 1f;    // Too many vowels

            if (consonantCount < 3)
                score -= 1.5f;  // Too few consonants

            // Common letters boost
            int commonCount = 0;
            foreach (var c in hand)
            {
                if (CommonLetters.Contains(char.ToUpper(c)))
                    commonCount++;
            }
            score += commonCount * 0.25f;

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
                    score -= 1f;
                else if (kvp.Value == 2)
                    score -= 0.3f;
            }

            // Hard letters penalty
            int hardCount = 0;
            foreach (var c in hand)
            {
                if (HardLetters.Contains(char.ToUpper(c)))
                    hardCount++;
            }
            score -= hardCount * 0.4f;

            // Word starters bonus
            int starterCount = 0;
            foreach (var c in hand)
            {
                if (WordStarters.Contains(char.ToUpper(c)))
                    starterCount++;
            }
            score += starterCount * 0.15f;

            // Word enders bonus
            int enderCount = 0;
            foreach (var c in hand)
            {
                if (WordEnders.Contains(char.ToUpper(c)))
                    enderCount++;
            }
            score += enderCount * 0.15f;

            // Clamp to 0-10
            return Math.Max(0f, Math.Min(10f, score));
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
                junkScore += 3f;

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
                        junkScore += 4f;
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
                junkScore += 3f;
            }
            else if (duplicates >= 2)
            {
                junkScore += 1f;
            }

            // Check vowel/consonant balance
            int vowelCount = 0;
            foreach (var c in hand)
            {
                if (Vowels.Contains(char.ToUpper(c)))
                    vowelCount++;
            }
            int consonantCount = hand.Count - vowelCount;
            bool isVowel = Vowels.Contains(upper);

            // Too many vowels (5+) = extra vowels are junk
            if (isVowel && vowelCount >= 5)
            {
                junkScore += 2f;
            }
            // Too few vowels (1 or less) = consonants are somewhat junky
            else if (!isVowel && vowelCount <= 1)
            {
                junkScore += 1.5f;
            }
            // No vowels = consonants are very junky
            else if (!isVowel && vowelCount == 0)
            {
                junkScore += 3f;
            }

            return Math.Min(10f, junkScore);
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
            int blockedDirections = 0;
            var validMoves = GameRules.GetValidMoves(state, glyphling);

            // If no valid moves, glyphling is tangled (max pressure)
            if (validMoves.Count == 0)
                return 10f;

            // Fewer escape routes = more pressure
            // A glyphling with moves in all 6 directions has 0 pressure from blocking
            // Count unique directions that have at least one valid move
            HashSet<int> openDirections = new HashSet<int>();
            foreach (var move in validMoves)
            {
                // Determine which direction this move is in
                int dir = GetDirection(glyphling.Position, move);
                if (dir >= 0)
                    openDirections.Add(dir);
            }

            blockedDirections = 6 - openDirections.Count;
            pressure += blockedDirections * 1.5f;

            // Few escape routes penalty
            if (openDirections.Count <= 1)
                pressure += 2f;
            else if (openDirections.Count <= 2)
                pressure += 1f;

            // Check if opponent glyphlings are nearby
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner != opponent) continue;

                int distance = HexDistance(glyphling.Position, g.Position);
                if (distance == 1)
                    pressure += 1.5f;  // Adjacent opponent
                else if (distance == 2)
                    pressure += 0.5f;  // Opponent 2 away
            }

            return Math.Min(10f, pressure);
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
            HandQuality = 5f;
            MyMaxPressure = 0f;
            OpponentMaxPressure = 0f;
        }
    }
}