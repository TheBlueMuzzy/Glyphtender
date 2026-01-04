using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Result of evaluating a move for a specific goal.
    /// Each goal has its own scoring criteria.
    /// </summary>
    public class GoalEvaluationResult
    {
        public AIMove Move { get; set; }
        public AIGoal Goal { get; set; }
        public float Score { get; set; }
        public string Reasoning { get; set; }

        // Goal-specific data (varies by goal type)
        public int WordPoints { get; set; }
        public int WordCount { get; set; }
        public int LongestWordLength { get; set; }
        public float TrapValue { get; set; }
        public float DenialValue { get; set; }
        public float SafetyValue { get; set; }
        public float SetupValue { get; set; }
        public float StealValue { get; set; }
        public float JunkValue { get; set; }
        public bool IsKillShot { get; set; }
        public bool IsSelfTangle { get; set; }
    }

    /// <summary>
    /// Evaluates moves for a specific goal.
    /// Each goal has completely different scoring criteria.
    ///
    /// This is the key change from the old system:
    /// OLD: All factors combined with weights
    /// NEW: Only the active goal's criteria matter
    /// </summary>
    public static class AIGoalEvaluators
    {
        /// <summary>
        /// Evaluates a move for the given goal.
        /// Returns a score where higher = better for that goal.
        /// </summary>
        public static GoalEvaluationResult Evaluate(
            AIMove move,
            GameState state,
            AIGoal goal,
            Player aiPlayer,
            WordScorer wordScorer,
            float zipfThreshold,
            float perceivedLead,
            float boardFillPercent)
        {
            switch (goal)
            {
                case AIGoal.Trap:
                    return EvaluateTrap(move, state, aiPlayer, perceivedLead, boardFillPercent);
                case AIGoal.Score:
                    return EvaluateScore(move, state, aiPlayer, wordScorer, zipfThreshold);
                case AIGoal.Deny:
                    return EvaluateDeny(move, state, aiPlayer, wordScorer, zipfThreshold);
                case AIGoal.Escape:
                    return EvaluateEscape(move, state, aiPlayer);
                case AIGoal.Build:
                    return EvaluateBuild(move, state, aiPlayer, wordScorer);
                case AIGoal.Steal:
                    return EvaluateSteal(move, state, aiPlayer, wordScorer, zipfThreshold);
                case AIGoal.Dump:
                    return EvaluateDump(move, state, aiPlayer);
                default:
                    return EvaluateScore(move, state, aiPlayer, wordScorer, zipfThreshold);
            }
        }

        /// <summary>
        /// TRAP: Corner opponent glyphlings, reduce their movement options.
        /// Also considers self-tangle for endgame close-out when ahead.
        /// </summary>
        private static GoalEvaluationResult EvaluateTrap(
            AIMove move,
            GameState state,
            Player aiPlayer,
            float perceivedLead,
            float boardFillPercent)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Trap
            };

            // Simulate the move
            var simState = state.Clone();
            var simGlyphling = FindGlyphling(simState, move.Glyphling);
            if (simGlyphling == null)
            {
                result.Score = float.MinValue;
                result.Reasoning = "Invalid glyphling";
                return result;
            }

            simGlyphling.Position = move.Destination;
            simState.Tiles[move.CastPosition] = new Tile(move.Letter, aiPlayer, move.CastPosition);

            Player opponent = GetOpponent(aiPlayer);
            float totalTrapValue = 0f;
            var reasons = new List<string>();

            // Evaluate trap potential for each opponent glyphling
            foreach (var g in simState.Glyphlings)
            {
                if (g.Owner != opponent || !g.IsPlaced) continue;

                // Count valid moves before and after
                int movesBefore = GameRules.GetValidMoves(state, g).Count;

                // Need to find the equivalent glyphling in simState
                Glyphling simOpponent = null;
                foreach (var sg in simState.Glyphlings)
                {
                    if (sg.Owner == opponent && sg.Index == g.Index)
                    {
                        simOpponent = sg;
                        break;
                    }
                }

                if (simOpponent == null) continue;

                int movesAfter = GameRules.GetValidMoves(simState, simOpponent).Count;
                int movesReduced = movesBefore - movesAfter;

                if (movesReduced > 0)
                {
                    // Movement restriction value
                    float restrictionValue = movesReduced * 5f;

                    // Kill shot bonus (reduced to 0 moves = tangle)
                    if (movesAfter == 0)
                    {
                        result.IsKillShot = true;

                        // Calculate adjacency bonus
                        int ourAdjacency = CountAdjacency(simState, simOpponent.Position.Value, aiPlayer);
                        float adjacencyBonus = ourAdjacency * 3f; // +3 per adjacent piece

                        restrictionValue += 50f + adjacencyBonus;
                        reasons.Add($"KILL({ourAdjacency}adj)");
                    }
                    else if (movesAfter <= 2)
                    {
                        restrictionValue += 15f;
                        reasons.Add($"restrict({movesReduced})");
                    }

                    totalTrapValue += restrictionValue;
                }
            }

            // Check for self-tangle opportunity (endgame close-out)
            if (boardFillPercent > 0.8f && perceivedLead > 15f)
            {
                // Check if our glyphling would be tangled after this move
                int ourMovesAfter = GameRules.GetValidMoves(simState, simGlyphling).Count;
                if (ourMovesAfter == 0)
                {
                    // Calculate opponent adjacency (they get points for this)
                    int oppAdjacency = CountAdjacency(simState, simGlyphling.Position.Value, opponent);
                    float selfTangleCost = oppAdjacency * 3f;

                    // Worth it if we're far enough ahead
                    float netValue = perceivedLead - selfTangleCost;
                    if (netValue > 5f)
                    {
                        result.IsSelfTangle = true;
                        totalTrapValue += 30f + netValue;
                        reasons.Add($"self-tangle(net+{netValue:F0})");
                    }
                }
            }

            result.TrapValue = totalTrapValue;
            result.Score = totalTrapValue;
            result.Reasoning = reasons.Count > 0 ? string.Join(",", reasons) : "no trap value";

            return result;
        }

        /// <summary>
        /// SCORE: Maximize word points this turn.
        /// Pure scoring - the Scholar's goal.
        /// </summary>
        private static GoalEvaluationResult EvaluateScore(
            AIMove move,
            GameState state,
            Player aiPlayer,
            WordScorer wordScorer,
            float zipfThreshold)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Score
            };

            // Simulate the move
            var simState = state.Clone();
            var simGlyphling = FindGlyphling(simState, move.Glyphling);
            if (simGlyphling == null)
            {
                result.Score = float.MinValue;
                result.Reasoning = "Invalid glyphling";
                return result;
            }

            simGlyphling.Position = move.Destination;
            simState.Tiles[move.CastPosition] = new Tile(move.Letter, aiPlayer, move.CastPosition);

            // Find words at the cast position
            var wordsFound = wordScorer.FindWordsAt(simState, move.CastPosition, move.Letter);

            // Filter by vocabulary (Zipf threshold)
            var allowedWords = new List<WordResult>();
            foreach (var word in wordsFound)
            {
                if (wordScorer.IsWordAllowedForZipf(word.Letters, zipfThreshold))
                {
                    allowedWords.Add(word);
                }
            }

            int totalPoints = 0;
            int longestWord = 0;
            var wordNames = new List<string>();

            foreach (var word in allowedWords)
            {
                int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, simState, aiPlayer);
                totalPoints += wordScore;

                if (word.Letters.Length > longestWord)
                    longestWord = word.Letters.Length;

                wordNames.Add($"{word.Letters}({wordScore})");
            }

            result.WordPoints = totalPoints;
            result.WordCount = allowedWords.Count;
            result.LongestWordLength = longestWord;

            // Score is simply the points earned
            // Bonus for longer words (efficiency)
            float lengthBonus = longestWord >= 5 ? (longestWord - 4) * 2f : 0f;

            // Bonus for multi-word plays
            float multiWordBonus = allowedWords.Count > 1 ? (allowedWords.Count - 1) * 3f : 0f;

            result.Score = totalPoints + lengthBonus + multiWordBonus;
            result.Reasoning = wordNames.Count > 0 ? string.Join(",", wordNames) : "no words";

            return result;
        }

        /// <summary>
        /// DENY: Block opponent's opportunities.
        /// Contests positions they want, blocks their leylines.
        /// </summary>
        private static GoalEvaluationResult EvaluateDeny(
            AIMove move,
            GameState state,
            Player aiPlayer,
            WordScorer wordScorer,
            float zipfThreshold)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Deny
            };

            float denialValue = 0f;
            var reasons = new List<string>();

            Player opponent = GetOpponent(aiPlayer);

            // Check if this position blocks opponent's leylines
            float leylineBlocking = CalculateLeylineBlocking(state, move.CastPosition, opponent);
            if (leylineBlocking > 0)
            {
                denialValue += leylineBlocking * 3f;
                reasons.Add($"block-ley({leylineBlocking:F0})");
            }

            // Check if this position is near opponent tiles (potential word completion)
            int nearOpponentTiles = CountNearbyTiles(state, move.CastPosition, opponent, 2);
            if (nearOpponentTiles > 0)
            {
                denialValue += nearOpponentTiles * 2f;
                reasons.Add($"near-opp({nearOpponentTiles})");
            }

            // Check if we're blocking an almost-complete word
            // (This is where ContestDetector would plug in)
            float almostWordValue = ContestDetector.GetDenialValue(state, move.CastPosition, aiPlayer, wordScorer);
            if (almostWordValue > 0)
            {
                denialValue += almostWordValue;
                reasons.Add($"deny-word({almostWordValue:F0})");
            }

            // Bonus if using a junk letter (double duty: deny + dump)
            float junkBonus = LetterJunkAssessor.Assess(move.Letter, state.Hands[aiPlayer]);
            if (junkBonus > 3f)
            {
                denialValue += junkBonus;
                reasons.Add("junk");
            }

            result.DenialValue = denialValue;
            result.Score = denialValue;
            result.Reasoning = reasons.Count > 0 ? string.Join(",", reasons) : "no denial";

            return result;
        }

        /// <summary>
        /// ESCAPE: Protect own glyphling, move to safer position.
        /// The Survivor's priority.
        /// </summary>
        private static GoalEvaluationResult EvaluateEscape(
            AIMove move,
            GameState state,
            Player aiPlayer)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Escape
            };

            // Simulate the move
            var simState = state.Clone();
            var simGlyphling = FindGlyphling(simState, move.Glyphling);
            if (simGlyphling == null)
            {
                result.Score = float.MinValue;
                result.Reasoning = "Invalid glyphling";
                return result;
            }

            // Calculate pressure before move
            float pressureBefore = GlyphlingPressureAssessor.Assess(state, move.Glyphling, aiPlayer);

            // Apply move
            simGlyphling.Position = move.Destination;
            simState.Tiles[move.CastPosition] = new Tile(move.Letter, aiPlayer, move.CastPosition);

            // Calculate pressure after move
            float pressureAfter = GlyphlingPressureAssessor.Assess(simState, simGlyphling, aiPlayer);

            // Improvement in safety
            float safetyImprovement = pressureBefore - pressureAfter;

            // Count escape routes after move
            int escapeRoutes = GameRules.GetValidMoves(simState, simGlyphling).Count;

            // Count unique directions
            var directions = new HashSet<int>();
            foreach (var movePos in GameRules.GetValidMoves(simState, simGlyphling))
            {
                int dir = GetDirection(simGlyphling.Position.Value, movePos);
                if (dir >= 0) directions.Add(dir);
            }

            float safetyValue = 0f;
            var reasons = new List<string>();

            // Bonus for reducing pressure
            if (safetyImprovement > 0)
            {
                safetyValue += safetyImprovement * 5f;
                reasons.Add($"safer({safetyImprovement:F1})");
            }

            // Bonus for having escape routes
            safetyValue += escapeRoutes * 2f;
            safetyValue += directions.Count * 3f;

            if (escapeRoutes >= 4)
            {
                reasons.Add("open");
            }
            else if (escapeRoutes <= 2)
            {
                safetyValue -= 10f; // Still risky
                reasons.Add("risky");
            }

            // Penalty for moving toward danger
            if (safetyImprovement < 0)
            {
                safetyValue += safetyImprovement * 3f; // Negative = penalty
                reasons.Add("danger!");
            }

            result.SafetyValue = safetyValue;
            result.Score = safetyValue;
            result.Reasoning = reasons.Count > 0 ? string.Join(",", reasons) : $"{escapeRoutes}routes";

            return result;
        }

        /// <summary>
        /// BUILD: Create future word opportunities.
        /// Gaps, extensions, intersection potential.
        /// </summary>
        private static GoalEvaluationResult EvaluateBuild(
            AIMove move,
            GameState state,
            Player aiPlayer,
            WordScorer wordScorer)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Build
            };

            // Use SetupDetector to evaluate future potential
            var setupEval = SetupDetector.Evaluate(state, move.CastPosition, move.Letter, aiPlayer, wordScorer);

            float buildValue = setupEval.TotalValue;
            var reasons = new List<string>();

            if (setupEval.GapValue > 0)
                reasons.Add($"gap({setupEval.GapValue:F0})");
            if (setupEval.ExtensionValue > 0)
                reasons.Add($"ext({setupEval.ExtensionValue:F0})");
            if (setupEval.IntersectionValue > 0)
                reasons.Add($"cross({setupEval.IntersectionValue:F0})");

            // Bonus for placing near our own tiles (chain building)
            int nearOwnTiles = CountNearbyTiles(state, move.CastPosition, aiPlayer, 2);
            if (nearOwnTiles > 0)
            {
                buildValue += nearOwnTiles * 1.5f;
                reasons.Add($"chain({nearOwnTiles})");
            }

            result.SetupValue = buildValue;
            result.Score = buildValue;
            result.Reasoning = reasons.Count > 0 ? string.Join(",", reasons) : "no setup";

            return result;
        }

        /// <summary>
        /// STEAL: Complete words using mostly opponent tiles.
        /// The Vulture's specialty.
        /// </summary>
        private static GoalEvaluationResult EvaluateSteal(
            AIMove move,
            GameState state,
            Player aiPlayer,
            WordScorer wordScorer,
            float zipfThreshold)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Steal
            };

            // Simulate the move
            var simState = state.Clone();
            var simGlyphling = FindGlyphling(simState, move.Glyphling);
            if (simGlyphling == null)
            {
                result.Score = float.MinValue;
                result.Reasoning = "Invalid glyphling";
                return result;
            }

            simGlyphling.Position = move.Destination;
            simState.Tiles[move.CastPosition] = new Tile(move.Letter, aiPlayer, move.CastPosition);

            Player opponent = GetOpponent(aiPlayer);

            // Find words at the cast position
            var wordsFound = wordScorer.FindWordsAt(simState, move.CastPosition, move.Letter);

            float stealValue = 0f;
            var reasons = new List<string>();

            foreach (var word in wordsFound)
            {
                if (!wordScorer.IsWordAllowedForZipf(word.Letters, zipfThreshold))
                    continue;

                // Count ownership
                int ourTiles = 0;
                int oppTiles = 0;

                foreach (var pos in word.Positions)
                {
                    if (simState.Tiles.TryGetValue(pos, out var tile))
                    {
                        if (tile.Owner == aiPlayer)
                            ourTiles++;
                        else if (tile.Owner == opponent)
                            oppTiles++;
                    }
                }

                // Steal value based on how many opponent tiles we're using
                if (oppTiles > ourTiles)
                {
                    // True steal - majority opponent tiles
                    int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, simState, aiPlayer);
                    float stealBonus = oppTiles * 3f; // Bonus per stolen tile

                    stealValue += wordScore + stealBonus;
                    reasons.Add($"STEAL:{word.Letters}({oppTiles}opp)");
                }
                else if (oppTiles > 0)
                {
                    // Partial steal
                    int wordScore = WordScorer.ScoreWordForPlayer(word.Letters, word.Positions, simState, aiPlayer);
                    float stealBonus = oppTiles * 1.5f;

                    stealValue += wordScore + stealBonus;
                    reasons.Add($"steal:{word.Letters}({oppTiles}opp)");
                }
            }

            result.StealValue = stealValue;
            result.WordPoints = (int)stealValue; // Approximate
            result.Score = stealValue;
            result.Reasoning = reasons.Count > 0 ? string.Join(",", reasons) : "no steal";

            return result;
        }

        /// <summary>
        /// DUMP: Discard junk letters.
        /// Get rid of Q without U, excess vowels, duplicates.
        /// </summary>
        private static GoalEvaluationResult EvaluateDump(
            AIMove move,
            GameState state,
            Player aiPlayer)
        {
            var result = new GoalEvaluationResult
            {
                Move = move,
                Goal = AIGoal.Dump
            };

            var hand = state.Hands[aiPlayer];

            // How junky is this letter?
            float junkScore = LetterJunkAssessor.Assess(move.Letter, hand);

            var reasons = new List<string>();

            if (junkScore >= 7f)
                reasons.Add($"dump:{move.Letter}(junk{junkScore:F0})");
            else if (junkScore >= 4f)
                reasons.Add($"discard:{move.Letter}");
            else
                reasons.Add($"{move.Letter}(not-junk)");

            // Bonus for dumping in a non-harmful location
            // (far from both players' glyphlings)
            float safetyBonus = 0f;
            float minDistance = float.MaxValue;

            foreach (var g in state.Glyphlings)
            {
                if (!g.IsPlaced) continue;
                float dist = HexDistance(move.CastPosition, g.Position.Value);
                if (dist < minDistance) minDistance = dist;
            }

            if (minDistance >= 3)
            {
                safetyBonus = 3f;
                reasons.Add("safe-dump");
            }

            result.JunkValue = junkScore;
            result.Score = junkScore + safetyBonus;
            result.Reasoning = string.Join(",", reasons);

            return result;
        }

        #region Helper Methods

        private static Glyphling FindGlyphling(GameState state, Glyphling original)
        {
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == original.Owner && g.Index == original.Index)
                    return g;
            }
            return null;
        }

        private static Player GetOpponent(Player player)
        {
            return player == Player.Yellow ? Player.Blue : Player.Yellow;
        }

        private static int CountAdjacency(GameState state, HexCoord pos, Player player)
        {
            int count = 0;
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = pos.GetNeighbor(dir);

                // Count tiles
                if (state.Tiles.TryGetValue(neighbor, out var tile))
                {
                    if (tile.Owner == player)
                        count++;
                }

                // Count glyphlings
                foreach (var g in state.Glyphlings)
                {
                    if (g.Owner == player && g.IsPlaced && g.Position.Value.Equals(neighbor))
                        count++;
                }
            }
            return count;
        }

        private static int CountNearbyTiles(GameState state, HexCoord pos, Player player, int maxDistance)
        {
            int count = 0;
            foreach (var kvp in state.Tiles)
            {
                if (kvp.Value.Owner == player)
                {
                    if (HexDistance(pos, kvp.Key) <= maxDistance)
                        count++;
                }
            }
            return count;
        }

        private static float CalculateLeylineBlocking(GameState state, HexCoord castPos, Player opponent)
        {
            float blocking = 0f;

            // Check if the cast position is on any leyline that leads to opponent glyphlings
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner != opponent || !g.IsPlaced) continue;

                // Check all 6 directions from opponent glyphling
                for (int dir = 0; dir < 6; dir++)
                {
                    var current = g.Position.Value;
                    for (int dist = 1; dist <= 10; dist++)
                    {
                        current = current.GetNeighbor(dir);
                        if (!state.Board.IsBoardHex(current)) break;

                        if (current.Equals(castPos))
                        {
                            // We're blocking this leyline
                            blocking += 1f;
                            break;
                        }

                        // Stop if blocked by tile or glyphling
                        if (state.Tiles.ContainsKey(current)) break;
                        if (state.HasGlyphling(current)) break;
                    }
                }
            }

            return blocking;
        }

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

        private static float HexDistance(HexCoord a, HexCoord b)
        {
            int dc = Math.Abs(a.Column - b.Column);
            int dr = Math.Abs(a.Row - b.Row);
            return dc + Math.Max(0, dr - dc / 2);
        }

        #endregion
    }
}
