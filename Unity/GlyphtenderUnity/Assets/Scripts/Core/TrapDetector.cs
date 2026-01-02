using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Evaluates the trap value of moves based on how much they restrict opponent movement.
    /// Used by AI to prioritize positional plays that corner opponents.
    /// </summary>
    public static class TrapDetector
    {
        /// <summary>
        /// Result of trap evaluation for a single opponent glyphling.
        /// </summary>
        public class TrapResult
        {
            public Glyphling Target { get; set; }
            public int MovesBefore { get; set; }
            public int MovesAfter { get; set; }
            public int MovesRestricted => MovesBefore - MovesAfter;
            public bool IsKillShot => MovesAfter == 0;
            public bool IsNearKillShot => MovesAfter <= 2 && MovesAfter > 0;
            public int LeylineBlocks { get; set; }
            public float WallSynergyBonus { get; set; }
            public float TriangleBonus { get; set; }
        }

        /// <summary>
        /// Combined trap evaluation for all opponent glyphlings.
        /// </summary>
        public class TrapEvaluation
        {
            public List<TrapResult> Results { get; set; } = new List<TrapResult>();
            public float TotalScore { get; set; }
            public bool HasKillShot { get; set; }
            public bool HasNearKillShot { get; set; }
        }

        /// <summary>
        /// Evaluates the trap value of placing a tile at a position.
        /// Considers movement restriction delta for all opponent glyphlings.
        /// </summary>
        /// <param name="state">Current game state</param>
        /// <param name="castPosition">Where the tile will be placed</param>
        /// <param name="glyphlingDestination">Where the AI glyphling will end up</param>
        /// <param name="aiPlayer">The AI player</param>
        /// <returns>Trap evaluation with scores for each opponent glyphling</returns>
        public static TrapEvaluation Evaluate(
            GameState state,
            HexCoord castPosition,
            HexCoord glyphlingDestination,
            Player aiPlayer)
        {
            var evaluation = new TrapEvaluation();
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;

            // Find opponent glyphlings
            var opponentGlyphlings = new List<Glyphling>();
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == opponent && g.IsPlaced)
                {
                    opponentGlyphlings.Add(g);
                }
            }

            // Evaluate each opponent glyphling
            foreach (var target in opponentGlyphlings)
            {
                var result = EvaluateTarget(state, target, castPosition, glyphlingDestination, aiPlayer);
                evaluation.Results.Add(result);

                if (result.IsKillShot)
                    evaluation.HasKillShot = true;
                if (result.IsNearKillShot)
                    evaluation.HasNearKillShot = true;
            }

            // Calculate total score
            evaluation.TotalScore = CalculateTotalScore(evaluation);

            return evaluation;
        }

        /// <summary>
        /// Evaluates trap value against a specific opponent glyphling.
        /// </summary>
        private static TrapResult EvaluateTarget(
            GameState state,
            Glyphling target,
            HexCoord castPosition,
            HexCoord glyphlingDestination,
            Player aiPlayer)
        {
            var result = new TrapResult { Target = target };

            // Target must be placed
            if (!target.IsPlaced)
            {
                return result;
            }

            // Count moves BEFORE the play
            result.MovesBefore = CountValidMoves(state, target);

            // Simulate the move: add tile at cast position
            bool hadTile = state.Tiles.ContainsKey(castPosition);
            Tile oldTile = hadTile ? state.Tiles[castPosition] : null;
            state.Tiles[castPosition] = new Tile('X', aiPlayer, castPosition); // Letter doesn't matter for movement

            // Find and temporarily move our glyphling
            Glyphling ourGlyphling = null;
            HexCoord? originalPos = null;
            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == aiPlayer && g.IsPlaced)
                {
                    // Find which glyphling is making this move (closest to destination)
                    var moves = GameRules.GetValidMoves(state, g);
                    if (moves.Contains(glyphlingDestination) || g.Position.Value == glyphlingDestination)
                    {
                        ourGlyphling = g;
                        originalPos = g.Position;
                        g.Position = glyphlingDestination;
                        break;
                    }
                }
            }

            // Count moves AFTER the play
            result.MovesAfter = CountValidMoves(state, target);

            // Calculate leyline blocks
            result.LeylineBlocks = CountLeylineBlocks(target.Position.Value, castPosition, glyphlingDestination);

            // Calculate wall synergy
            result.WallSynergyBonus = CalculateWallSynergy(state, target, castPosition, glyphlingDestination);

            // Calculate triangle bonus
            result.TriangleBonus = CalculateTriangleBonus(target.Position.Value, castPosition, glyphlingDestination);

            // Restore state
            if (hadTile)
            {
                state.Tiles[castPosition] = oldTile;
            }
            else
            {
                state.Tiles.Remove(castPosition);
            }

            if (ourGlyphling != null)
            {
                ourGlyphling.Position = originalPos;
            }

            return result;
        }

        /// <summary>
        /// Counts valid moves for a glyphling in the current state.
        /// </summary>
        private static int CountValidMoves(GameState state, Glyphling glyphling)
        {
            var moves = GameRules.GetValidMoves(state, glyphling);
            return moves.Count;
        }

        /// <summary>
        /// Counts how many leylines from the target are blocked by cast/glyphling positions.
        /// </summary>
        private static int CountLeylineBlocks(HexCoord targetPos, HexCoord castPos, HexCoord glyphlingPos)
        {
            int blocks = 0;

            // Check all 6 directions from target
            for (int dir = 0; dir < 6; dir++)
            {
                // Check if cast position is on this leyline
                if (IsOnLeyline(targetPos, castPos, dir))
                    blocks++;

                // Check if glyphling position is on this leyline
                if (IsOnLeyline(targetPos, glyphlingPos, dir))
                    blocks++;
            }

            return blocks;
        }

        /// <summary>
        /// Checks if a position lies on a leyline from origin in the given direction.
        /// </summary>
        private static bool IsOnLeyline(HexCoord origin, HexCoord position, int direction)
        {
            if (origin == position) return false;

            // Walk along the leyline and see if we hit the position
            var current = origin;
            for (int i = 0; i < 20; i++) // Max board size safety
            {
                current = current.GetNeighbor(direction);
                if (current == position)
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Calculates bonus for trapping opponent near walls.
        /// </summary>
        private static float CalculateWallSynergy(
            GameState state,
            Glyphling target,
            HexCoord castPos,
            HexCoord glyphlingPos)
        {
            if (!target.IsPlaced)
                return 0f;

            float bonus = 0f;

            // Count how many directions from target lead off the board
            int wallDirections = 0;
            for (int dir = 0; dir < 6; dir++)
            {
                var neighbor = target.Position.Value.GetNeighbor(dir);
                if (!state.Board.IsBoardHex(neighbor))
                {
                    wallDirections++;
                }
            }

            // More walls = more valuable to block remaining directions
            if (wallDirections >= 3)
            {
                bonus += 2.0f; // Cornered against wall
            }
            else if (wallDirections >= 2)
            {
                bonus += 1.0f; // Near edge
            }
            else if (wallDirections >= 1)
            {
                bonus += 0.5f; // Against one wall
            }

            return bonus;
        }

        /// <summary>
        /// Calculates bonus for creating a triangle trap (glyphling + cast block two leylines).
        /// </summary>
        private static float CalculateTriangleBonus(
            HexCoord targetPos,
            HexCoord castPos,
            HexCoord glyphlingPos)
        {
            // Check if cast and glyphling are on different leylines from target
            int castLeyline = -1;
            int glyphlingLeyline = -1;

            for (int dir = 0; dir < 6; dir++)
            {
                if (IsOnLeyline(targetPos, castPos, dir))
                    castLeyline = dir;
                if (IsOnLeyline(targetPos, glyphlingPos, dir))
                    glyphlingLeyline = dir;
            }

            // Triangle formed when blocking two different leylines
            if (castLeyline >= 0 && glyphlingLeyline >= 0 && castLeyline != glyphlingLeyline)
            {
                // Extra bonus if the leylines are adjacent (tighter trap)
                int diff = Math.Abs(castLeyline - glyphlingLeyline);
                if (diff == 1 || diff == 5) // Adjacent directions
                {
                    return 2.0f;
                }
                return 1.5f;
            }

            return 0f;
        }

        /// <summary>
        /// Calculates the total trap score from individual results.
        /// </summary>
        private static float CalculateTotalScore(TrapEvaluation evaluation)
        {
            float total = 0f;

            foreach (var result in evaluation.Results)
            {
                float score = 0f;

                // Base score: movement restriction delta
                // Each move restricted is valuable
                score += result.MovesRestricted * 1.5f;

                // Kill shot: massive bonus for fully trapping
                if (result.IsKillShot)
                {
                    score += 15.0f;
                }
                // Near kill shot: significant bonus when close to trapping
                else if (result.IsNearKillShot)
                {
                    score += 8.0f;
                }

                // Leyline blocking bonus
                score += result.LeylineBlocks * 0.5f;

                // Wall synergy
                score += result.WallSynergyBonus;

                // Triangle formation
                score += result.TriangleBonus;

                // Penalty for giving opponent MORE moves (bad positioning)
                if (result.MovesRestricted < 0)
                {
                    score += result.MovesRestricted * 0.5f; // Negative contribution
                }

                total += score;
            }

            return total;
        }

        /// <summary>
        /// Quick check if an opponent is already in a vulnerable position (few moves).
        /// </summary>
        public static bool IsVulnerable(GameState state, Glyphling glyphling)
        {
            int moves = CountValidMoves(state, glyphling);
            return moves <= 4;
        }

        /// <summary>
        /// Gets the most vulnerable opponent glyphling.
        /// </summary>
        public static Glyphling GetMostVulnerableOpponent(GameState state, Player aiPlayer)
        {
            Player opponent = aiPlayer == Player.Yellow ? Player.Blue : Player.Yellow;
            Glyphling mostVulnerable = null;
            int fewestMoves = int.MaxValue;

            foreach (var g in state.Glyphlings)
            {
                if (g.Owner == opponent && g.IsPlaced)
                {
                    int moves = CountValidMoves(state, g);
                    if (moves < fewestMoves)
                    {
                        fewestMoves = moves;
                        mostVulnerable = g;
                    }
                }
            }

            return mostVulnerable;
        }
    }
}