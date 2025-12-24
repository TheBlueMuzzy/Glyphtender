using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// A complete move the AI could make.
    /// </summary>
    public class AIMove
    {
        public Glyphling Glyphling { get; set; }
        public HexCoord Destination { get; set; }
        public HexCoord CastPosition { get; set; }
        public char Letter { get; set; }

        /// <summary>
        /// Creates a copy of this move.
        /// </summary>
        public AIMove Clone()
        {
            return new AIMove
            {
                Glyphling = Glyphling,
                Destination = Destination,
                CastPosition = CastPosition,
                Letter = Letter
            };
        }
    }

    /// <summary>
    /// A move with its evaluation breakdown.
    /// </summary>
    public class EvaluatedMove
    {
        public AIMove Move { get; set; }

        // Scoring factors
        public int WordPoints { get; set; }
        public int WordCount { get; set; }
        public int LongestWordLength { get; set; }
        public float BlocksOpponent { get; set; }
        public float ThreatensTangle { get; set; }
        public bool StealsWord { get; set; }
        public float SelfTangleRisk { get; set; }
        public float PositionalValue { get; set; }
        public float TrapScore { get; set; }
        public bool HasKillShot { get; set; }

        // Final weighted score
        public float TotalScore { get; set; }

        // For debugging
        public string Reasoning { get; set; }
    }

    /// <summary>
    /// Evaluates moves based on personality-weighted factors.
    /// </summary>
    public static class AIMoveEvaluator
    {
        /// <summary>
        /// Evaluates a single move and returns a scored EvaluatedMove.
        /// </summary>
        public static EvaluatedMove Evaluate(
            AIMove move,
            GameState state,
            EffectiveTraits traits,
            Player aiPlayer,
            WordScorer wordScorer,
            float perceivedLead = 0f)
        {
            var eval = new EvaluatedMove { Move = move };

            // Clone state to simulate the move
            var simState = state.Clone();

            // Find the glyphling in the cloned state
            Glyphling simGlyphling = null;
            foreach (var g in simState.Glyphlings)
            {
                if (g.Owner == move.Glyphling.Owner && g.Index == move.Glyphling.Index)
                {
                    simGlyphling = g;
                    break;
                }
            }

            if (simGlyphling == null)
            {
                eval.TotalScore = float.MinValue;
                eval.Reasoning = "Invalid glyphling";
                return eval;
            }

            // Simulate the move
            simGlyphling.Position = move.Destination;

            // Place the tile
            simState.Tiles[move.CastPosition] = new Tile(move.Letter, aiPlayer, move.CastPosition);

            // Calculate word score using WordScorer
            var wordsFound = wordScorer.FindWordsAt(simState, move.CastPosition, move.Letter);

            // Filter words by Verbosity - AI only "knows" words within its vocabulary level
            var allowedWords = new List<WordResult>();
            foreach (var word in wordsFound)
            {
                if (wordScorer.IsWordAllowedForVerbosity(word.Letters, traits.Verbosity))
                {
                    allowedWords.Add(word);
                }
            }

            eval.WordCount = allowedWords.Count;
            eval.WordPoints = 0;
            eval.LongestWordLength = 0;

            foreach (var word in allowedWords)
            {
                // Use the Glyphtender scoring: length + ownership bonus
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, simState, aiPlayer);
                eval.WordPoints += wordScore;

                if (word.Letters.Length > eval.LongestWordLength)
                    eval.LongestWordLength = word.Letters.Length;
            }

            // Calculate opponent blocking
            eval.BlocksOpponent = CalculateBlocking(move, state, aiPlayer);

            // Calculate tangle threat to opponent
            eval.ThreatensTangle = CalculateTangleThreat(simState, aiPlayer);

            // Calculate self tangle risk
            eval.SelfTangleRisk = CalculateSelfTangleRisk(simState, simGlyphling, aiPlayer);

            // Calculate positional value (escape routes, leyline access)
            eval.PositionalValue = CalculatePositionalValue(simState, simGlyphling);

            // Check if this steals opponent's word
            eval.StealsWord = CheckIfSteals(move, state, aiPlayer);

            // Evaluate trap value (movement restriction)
            var trapEval = TrapDetector.Evaluate(state, move.CastPosition, move.Destination, aiPlayer);
            eval.TrapScore = trapEval.TotalScore;
            eval.HasKillShot = trapEval.HasKillShot;

            // Calculate weighted total score based on personality
            eval.TotalScore = CalculateWeightedScore(eval, traits, perceivedLead);

            // Build reasoning string
            eval.Reasoning = BuildReasoning(eval);

            return eval;
        }

        /// <summary>
        /// Calculates how much this move blocks opponent's mobility.
        /// </summary>
        private static float CalculateBlocking(AIMove move, GameState state, Player aiPlayer)
        {
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;
            float blocking = 0f;

            // Check how close the cast position is to opponent glyphlings
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner != opponent) continue;

                int distance = HexDistance(move.CastPosition, g.Position);
                if (distance == 1)
                    blocking += 2f;  // Adjacent to opponent
                else if (distance == 2)
                    blocking += 1f;
                else if (distance == 3)
                    blocking += 0.5f;
            }

            return blocking;
        }

        /// <summary>
        /// Calculates how much pressure this move puts on opponent glyphlings.
        /// </summary>
        private static float CalculateTangleThreat(GameState simState, Player aiPlayer)
        {
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;
            float maxPressure = 0f;

            foreach (var g in simState.Glyphlings)
            {
                if (g.Owner != opponent) continue;

                float pressure = GlyphlingPressureAssessor.Assess(simState, g, aiPlayer);
                if (pressure > maxPressure)
                    maxPressure = pressure;
            }

            // Normalize to 0-5 range for scoring
            return maxPressure / 2f;
        }

        /// <summary>
        /// Calculates how much danger this move puts the AI's glyphling in.
        /// </summary>
        private static float CalculateSelfTangleRisk(GameState simState, Glyphling glyphling, Player aiPlayer)
        {
            float pressure = GlyphlingPressureAssessor.Assess(simState, glyphling, aiPlayer);

            // Normalize to 0-5 range
            return pressure / 2f;
        }

        /// <summary>
        /// Calculates the positional value of where the glyphling ends up.
        /// More escape routes and leyline access = higher value.
        /// </summary>
        private static float CalculatePositionalValue(GameState simState, Glyphling glyphling)
        {
            var validMoves = GameRules.GetValidMoves(simState, glyphling);

            // More moves = better position
            float value = validMoves.Count * 0.3f;

            // Count unique directions
            var directions = new HashSet<int>();
            foreach (var move in validMoves)
            {
                int dir = GetDirection(glyphling.Position, move);
                if (dir >= 0) directions.Add(dir);
            }

            // Bonus for having multiple escape directions
            value += directions.Count * 0.5f;

            // Penalty for being near edges (fewer options)
            if (IsNearEdge(glyphling.Position, simState.Board))
                value -= 1f;

            return Math.Max(0f, value);
        }

        /// <summary>
        /// Checks if this move completes an opponent's almost-word (stealing it).
        /// </summary>
        private static bool CheckIfSteals(AIMove move, GameState state, Player aiPlayer)
        {
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            // Check tiles adjacent to cast position
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = move.CastPosition.GetNeighbor(dir);
                if (state.Tiles.TryGetValue(neighbor, out var tile))
                {
                    if (tile.Owner == opponent)
                    {
                        // There's an opponent tile adjacent � this might be a steal
                        return true;
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Calculates the final weighted score based on personality traits.
        /// </summary>
        private static float CalculateWeightedScore(EvaluatedMove eval, EffectiveTraits traits, float perceivedLead)
        {
            float score = 0f;

            // Word points weighted by Greed
            score += eval.WordPoints * (traits.Greed / 5f);

            // Longest word weighted by Verbosity
            score += eval.LongestWordLength * (traits.Verbosity / 5f);

            // Word count weighted by Cleverness
            score += eval.WordCount * (traits.Cleverness / 5f) * 2f;

            // Blocking weighted by Spite
            score += eval.BlocksOpponent * (traits.Spite / 5f);

            // Tangle threat weighted by Aggression
            score += eval.ThreatensTangle * (traits.Aggression / 5f);

            // Steal bonus weighted by Opportunism
            if (eval.StealsWord)
                score += 3f * (traits.Opportunism / 5f);

            // Self tangle risk PENALIZED by Protectiveness
            score -= eval.SelfTangleRisk * (traits.Protectiveness / 5f);

            // Positional value weighted by Positional trait
            score += eval.PositionalValue * (traits.Positional / 5f);

            // Trap score weighted by TrapFocus
            score += eval.TrapScore * (traits.TrapFocus / 5f);

            // Kill shot evaluation — ending the game when losing = bad
            // Uses perceived lead (fuzzy), not actual score
            if (eval.HasKillShot)
            {
                if (perceivedLead > 10)
                {
                    // Feels comfortably ahead — go for the kill
                    score += 20f;
                }
                else if (perceivedLead > 0)
                {
                    // Feels slightly ahead — kill shot is good but not urgent
                    score += 10f;
                }
                else if (perceivedLead > -10)
                {
                    // Feels close or slightly behind — risky, small bonus
                    score += 3f;
                }
                // If feels way behind (perceivedLead <= -10), no bonus
            }

            return score;
        }

        /// <summary>
        /// Builds a human-readable reasoning string for debugging.
        /// </summary>
        private static string BuildReasoning(EvaluatedMove eval)
        {
            var parts = new List<string>();

            if (eval.WordPoints > 0)
                parts.Add($"{eval.WordPoints}pts");

            if (eval.WordCount > 1)
                parts.Add($"{eval.WordCount}words");

            if (eval.LongestWordLength >= 5)
                parts.Add($"{eval.LongestWordLength}let");

            if (eval.StealsWord)
                parts.Add("steal");

            if (eval.ThreatensTangle > 2)
                parts.Add("threat");

            if (eval.SelfTangleRisk > 2)
                parts.Add("risky");

            if (eval.BlocksOpponent > 1)
                parts.Add("block");

            if (eval.HasKillShot)
                parts.Add("KILL");
            else if (eval.TrapScore > 5)
                parts.Add("trap");

            return string.Join(",", parts);
        }

        /// <summary>
        /// Gets approximate direction from one hex to another.
        /// </summary>
        private static int GetDirection(HexCoord from, HexCoord to)
        {
            int dc = to.Column - from.Column;
            int dr = to.Row - from.Row;

            if (dc == 0 && dr > 0) return 0;
            if (dc == 0 && dr < 0) return 1;
            if (dc > 0 && dr >= 0) return 2;
            if (dc > 0 && dr < 0) return 3;
            if (dc < 0 && dr >= 0) return 4;
            if (dc < 0 && dr < 0) return 5;

            return -1;
        }

        /// <summary>
        /// Checks if a position is near the edge of the board.
        /// </summary>
        private static bool IsNearEdge(HexCoord pos, Board board)
        {
            int edgeCount = 0;
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = pos.GetNeighbor(dir);
                if (!board.IsBoardHex(neighbor))
                    edgeCount++;
            }
            return edgeCount >= 2;
        }

        /// <summary>
        /// Approximate hex distance.
        /// </summary>
        private static int HexDistance(HexCoord a, HexCoord b)
        {
            int dc = Math.Abs(a.Column - b.Column);
            int dr = Math.Abs(a.Row - b.Row);
            return dc + Math.Max(0, dr - dc / 2);
        }
    }
}